// Verificações do @sinete/ibs-cbs/determinar compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { fixedClock, timeContext } from '@sinete/core';
import { bundledDataset } from '@sinete/ibs-cbs-dados/bundled';
import { calculateAt } from '@sinete/ibs-cbs/calcular';
import { officialRates } from '@sinete/ibs-cbs/aliquotas';
import { constrain, DeterminationError, determine, questionId, toClassified } from '@sinete/ibs-cbs/determinar';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const dataset = bundledDataset();
  const time = timeContext({ emissao: fixedClock('2026-10-10T12:00:00-03:00') });
  const facts = { modelo: 55, kind: 'venda', items: [{ n: 1, ncm: '10063021', description: 'arroz' }] };
  const [item] = constrain(facts, { dataset, time });
  expect('candidato do anexo', item.candidates.some((c) => c.cClassTrib === '200003'));
  expect('exclusão com motivo', item.exclusions.find((e) => e.cClassTrib === '200034')?.reason === 'ncm');
  const asked = await determine(facts, { dataset, time });
  expect('pergunta', !asked.complete && asked.items[0].pending?.[0]?.id === questionId(1));
  const det = await determine(facts, { dataset, time, answers: { [questionId(1)]: '200003' } });
  expect('decidido pelo usuário', det.complete && det.items[0].decided?.provenance.by === 'user');
  const transfer = await determine({ ...facts, kind: 'transferencia' }, { dataset, time });
  expect('regra legal', transfer.items[0].decided?.candidate.cClassTrib === '410002');
  const op = toClassified(det, { modelo: 55, place: { uf: 'SP', cMun: '3550308' } }, () => ({ base: '100.00' }));
  const roc = calculateAt(op, { dataset, rates: officialRates(), date: det.asOf });
  expect('cálculo', roc.items[0]?.IBSCBS.gIBSCBS?.gCBS.gRed?.pRedAliq === '100.00');
  try {
    toClassified(asked, { modelo: 55, place: { uf: 'SP', cMun: '3550308' } }, () => ({ base: '1' }));
    failures.push('determinação incompleta aceita');
  } catch (e) {
    expect('erro tipado', e instanceof DeterminationError && e.reason === 'determinacao_incompleta');
  }
  return failures;
}
