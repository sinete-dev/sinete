import { runChecks } from './checks.mjs';
import { runChecks as runXmlChecks } from './xml-checks.mjs';
const rt = typeof Deno !== 'undefined' ? `deno ${Deno.version.deno}` : typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;
const failures = [...runChecks(), ...(await runXmlChecks().catch((e) => [`xml: exceção: ${e}`]))];
console.log(JSON.stringify({ ok: failures.length === 0, rt, mode: 'import', failures }));
