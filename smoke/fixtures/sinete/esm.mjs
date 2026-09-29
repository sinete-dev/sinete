import { runChecks } from './checks.mjs';
const rt = typeof Deno !== 'undefined' ? `deno ${Deno.version.deno}` : typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;
const failures = await runChecks().catch((e) => [`exceção: ${e}`]);
// Sem entrada raiz: `import 'sinete'` não resolve (quem quer tudo escolhe o que importa).
const raiz = await import('sinete').then(
  () => 'importou',
  () => 'recusou',
);
if (raiz !== 'recusou') failures.push('a raiz do guarda-chuva não pode existir');
console.log(JSON.stringify({ ok: failures.length === 0, rt, mode: 'import', failures }));
