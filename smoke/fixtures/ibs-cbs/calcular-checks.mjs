// Verificações do @sinete/ibs-cbs/calcular compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { fixedClock, timeContext } from '@sinete/core';
import { bundledDataset } from '@sinete/ibs-cbs-dados/bundled';
import { calculate, ClassificationError, Decimal, UnsupportedRegimeError } from '@sinete/ibs-cbs/calcular';
import { officialRates } from '@sinete/ibs-cbs/aliquotas';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const options = {
    dataset: bundledDataset(),
    rates: officialRates(),
    time: timeContext({ emissao: fixedClock('2026-10-10T12:00:00-03:00') }),
  };
  const op = (item) => ({ modelo: 55, place: { uf: 'SP', cMun: '3550308' }, items: [{ n: 1, ...item }] });
  const roc = calculate(op({ cst: '000', cClassTrib: '000001', base: '1000.00' }), options);
  const g = roc.items[0]?.IBSCBS.gIBSCBS;
  expect('CBS', g?.gCBS.pCBS === '0.90' && g?.gCBS.vCBS === '9.00');
  expect('IBS', g?.gIBSUF.vIBSUF === '1.00' && roc.total.IBSCBSTot.gIBS.vIBS === '1.00');
  expect('proveniência', roc.asOf === '2026-10-10' && roc.contentVersion === options.dataset.contentVersion);
  expect('HALF_EVEN', Decimal.parse('0.125').setScale(2, 'HALF_EVEN').toString() === '0.12');
  try {
    calculate(op({ cst: '000', cClassTrib: '999999', base: '1' }), options);
    failures.push('cClassTrib inexistente aceito');
  } catch (e) {
    expect('classificação', e instanceof ClassificationError && e.reason === 'cclasstrib_inexistente');
  }
  try {
    calculate(op({ cst: '000', cClassTrib: '000001', base: '1', monophase: {} }), options);
    failures.push('monofasia calculada');
  } catch (e) {
    expect('monofasia', e instanceof UnsupportedRegimeError && e.regime === 'monofasia');
  }
  return failures;
}
