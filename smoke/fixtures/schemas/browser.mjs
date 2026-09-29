import { runChecks } from './checks.mjs';
let failures;
try {
  failures = runChecks();
} catch (e) {
  failures = [String(e)];
}
globalThis.__result = { ok: failures.length === 0, rt: navigator.userAgent, mode: 'browser', failures };
