// Verificações do @sinete/ibs-cbs/aliquotas compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { isSimulated, officialRates, RateUnknownError, requireRate, withOverrides } from '@sinete/ibs-cbs/aliquotas';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const p = officialRates();
  const r2026 = p.nominal('2026-10-10');
  expect('CBS 2026 oficial', r2026.CBS.status === 'official' && r2026.CBS.value === '0.9');
  expect('IBS 2027 da LC', p.nominal('2027-03-01').IBSUF.value === '0.05');
  const cbs2027 = p.nominal('2027-03-01').CBS;
  expect('CBS 2027 desconhecida', cbs2027.status === 'unknown' && cbs2027.value === null);
  try {
    requireRate(cbs2027, '2027-03-01');
    failures.push('alíquota desconhecida virou número');
  } catch (e) {
    expect('erro tipado', e instanceof RateUnknownError && e.code === 'ibscbs_aliquota_desconhecida');
  }
  const sim = withOverrides(p, [{ tributo: 'CBS', value: '8.8', reason: 'simulação' }]).nominal('2027-03-01');
  expect('informada', sim.CBS.status === 'user-provided' && isSimulated(sim));
  return failures;
}
