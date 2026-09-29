import { runChecks } from './checks.mjs';
const failures = await runChecks().catch((e) => [`exceção: ${e}`]);
globalThis.__result = { ok: failures.length === 0, rt: navigator.userAgent, mode: 'browser', failures };
