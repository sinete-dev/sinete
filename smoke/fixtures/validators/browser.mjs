import { runChecks } from './checks.mjs';
const failures = runChecks();
globalThis.__result = { ok: failures.length === 0, rt: navigator.userAgent, mode: 'browser', failures };
