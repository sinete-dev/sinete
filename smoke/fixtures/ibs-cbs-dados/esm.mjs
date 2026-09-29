import { runChecks } from './checks.mjs';
const rt = typeof Deno !== 'undefined' ? `deno ${Deno.version.deno}` : typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;
const failures = await runChecks().catch((e) => [`exceção: ${e}`]);
console.log(JSON.stringify({ ok: failures.length === 0, rt, mode: 'import', failures }));
