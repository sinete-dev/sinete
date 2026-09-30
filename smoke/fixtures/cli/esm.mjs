// `rodarDoctor` programático do @sinete/cli, sem rede: só PFX, cadeia e relógio local.
import { decodificarBase64 } from '@sinete/cert';
import { relogioFixo } from '@sinete/core';
import { formatarRelatorio, main, rodarDoctor } from '@sinete/cli';
import { PFX_LEGACY_B64, SENHA } from '../cert/pfx.mjs';

const rt = typeof Deno !== 'undefined' ? `deno ${Deno.version.deno}` : typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;
const failures = [];
const expect = (name, cond) => {
  if (!cond) failures.push(name);
};
const report = await rodarDoctor({ pfx: decodificarBase64(PFX_LEGACY_B64), senha: SENHA, relogio: relogioFixo('2026-09-25T12:00:00Z') });
const pfx = report.verificacoes.find((c) => c.id === 'pfx');
expect('pfx ok', pfx?.situacao === 'ok' && pfx.mensagem.includes('11.222.333/0001-81'));
expect('cadeia incompleta sem a AC', report.verificacoes.find((c) => c.id === 'cadeia')?.situacao === 'aviso');
expect('sem material de chave', !JSON.stringify(report).includes('PRIVATE'));
expect('relatório', formatarRelatorio(report).at(-1) === 'doctor: nada impede o uso');
const out = [];
const code = await main(['doctor'], { saida: (l) => out.push(l), erro: (l) => out.push(l), env: {}, pedirSenha: async () => undefined, lerArquivo: async () => new Uint8Array() });
expect('main sem pfx', code === 2);
console.log(JSON.stringify({ ok: failures.length === 0, rt, mode: 'import', failures }));
