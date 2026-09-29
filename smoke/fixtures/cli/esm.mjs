// `runDoctor` programático do @sinete/cli, sem rede: só PFX, cadeia e relógio local.
import { base64ToBytes } from '@sinete/cert';
import { fixedClock } from '@sinete/core';
import { formatReport, main, runDoctor } from '@sinete/cli';
import { PFX_LEGACY_B64, SENHA } from '../cert/pfx.mjs';

const rt = typeof Deno !== 'undefined' ? `deno ${Deno.version.deno}` : typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;
const failures = [];
const expect = (name, cond) => {
  if (!cond) failures.push(name);
};
const report = await runDoctor({ pfx: base64ToBytes(PFX_LEGACY_B64), password: SENHA, clock: fixedClock('2026-09-25T12:00:00Z') });
const pfx = report.checks.find((c) => c.id === 'pfx');
expect('pfx ok', pfx?.status === 'ok' && pfx.message.includes('11.222.333/0001-81'));
expect('cadeia incompleta sem a AC', report.checks.find((c) => c.id === 'cadeia')?.status === 'aviso');
expect('sem material de chave', !JSON.stringify(report).includes('PRIVATE'));
expect('relatório', formatReport(report).at(-1) === 'doctor: nada impede o uso');
const out = [];
const code = await main(['doctor'], { out: (l) => out.push(l), err: (l) => out.push(l), env: {}, promptPassword: async () => undefined, readFile: async () => new Uint8Array() });
expect('main sem pfx', code === 2);
console.log(JSON.stringify({ ok: failures.length === 0, rt, mode: 'import', failures }));
