// Verificações do @sinete/ibs-cbs compartilhadas por Node, Deno e Chromium: cada subpath com as próprias e a raiz, que
// precisa reexportar os mesmos objetos (mesma classe, mesma tabela) dos subpaths. Devolve a lista de falhas.
import * as raiz from '@sinete/ibs-cbs';
import * as aliquotas from '@sinete/ibs-cbs/aliquotas';
import * as calcular from '@sinete/ibs-cbs/calcular';
import * as determinar from '@sinete/ibs-cbs/determinar';
import * as validar from '@sinete/ibs-cbs/validar';
import { runChecks as runAliquotas } from './aliquotas-checks.mjs';
import { runChecks as runCalcular } from './calcular-checks.mjs';
import { runChecks as runDeterminar } from './determinar-checks.mjs';
import { runChecks as runValidar } from './validar-checks.mjs';

export async function runChecks() {
  const failures = [];
  const partes = { aliquotas, calcular, validar, determinar };
  const runs = { aliquotas: runAliquotas, calcular: runCalcular, validar: runValidar, determinar: runDeterminar };
  for (const [nome, run] of Object.entries(runs)) {
    const f = await run().catch((e) => [`exceção: ${e}`]);
    failures.push(...f.map((x) => `${nome}: ${x}`));
  }
  for (const [nome, mod] of Object.entries(partes)) {
    for (const [k, v] of Object.entries(mod)) {
      if (raiz[k] !== v) failures.push(`raiz não reexporta ${nome}.${k}`);
    }
  }
  if (raiz.calculate === undefined || raiz.determine === undefined) failures.push('raiz sem calculate/determine');
  return failures;
}
