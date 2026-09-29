import { runChecks } from './checks.mjs';
import { runChecks as runXmlChecks } from './xml-checks.mjs';
runXmlChecks().then(
  (xml) => {
    const failures = [...runChecks(), ...xml];
    globalThis.__result = { ok: failures.length === 0, rt: navigator.userAgent, mode: 'browser', failures };
  },
  (e) => {
    globalThis.__result = { ok: false, rt: navigator.userAgent, mode: 'browser', failures: [`xml: ${e}`] };
  },
);
