import { runChecks } from './checks.mjs';
runChecks('browser').then(
  (failures) => {
    globalThis.__result = { ok: failures.length === 0, rt: navigator.userAgent, mode: 'browser', failures };
  },
  (e) => {
    globalThis.__result = { ok: false, rt: navigator.userAgent, mode: 'browser', failures: [String(e?.stack ?? e)] };
  },
);
