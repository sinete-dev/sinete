// No browser entram todos os subpaths de biblioteca (o transporte resolve a condição `default`); só o bin fica de fora.
import { runChecks } from './checks.mjs';
const failures = await runChecks().catch((e) => [`exceção: ${e}`]);
globalThis.__result = { ok: failures.length === 0, rt: navigator.userAgent, mode: 'browser', failures };
