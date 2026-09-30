// Verificações do @sinete/ibs-cbs/aliquotas compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { ehSimulada, aliquotasOficiais, ErroAliquotaDesconhecida, exigirAliquota, comAliquotasInformadas } from '@sinete/ibs-cbs/aliquotas';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const p = aliquotasOficiais();
  const r2026 = p.nominal('2026-10-10');
  expect('CBS 2026 oficial', r2026.CBS.situacao === 'oficial' && r2026.CBS.valor === '0.9');
  expect('IBS 2027 da LC', p.nominal('2027-03-01').IBSUF.valor === '0.05');
  const cbs2027 = p.nominal('2027-03-01').CBS;
  expect('CBS 2027 desconhecida', cbs2027.situacao === 'desconhecida' && cbs2027.valor === null);
  try {
    exigirAliquota(cbs2027, '2027-03-01');
    failures.push('alíquota desconhecida virou número');
  } catch (e) {
    expect('erro tipado', e instanceof ErroAliquotaDesconhecida && e.code === 'ibscbs_aliquota_desconhecida');
  }
  const sim = comAliquotasInformadas(p, [{ tributo: 'CBS', valor: '8.8', motivo: 'simulação' }]).nominal('2027-03-01');
  expect('informada', sim.CBS.situacao === 'informada' && ehSimulada(sim));
  return failures;
}
