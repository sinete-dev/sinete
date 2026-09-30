// Verificações do @sinete/ibs-cbs/calcular compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';
import { calcular, ErroClassificacao, Decimal, ErroRegimeNaoSuportado } from '@sinete/ibs-cbs/calcular';
import { aliquotasOficiais } from '@sinete/ibs-cbs/aliquotas';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const options = {
    dataset: datasetEmbarcado(),
    aliquotas: aliquotasOficiais(),
    tempo: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
  };
  const op = (item) => ({ modelo: 55, local: { uf: 'SP', cMun: '3550308' }, itens: [{ n: 1, ...item }] });
  const roc = calcular(op({ cst: '000', cClassTrib: '000001', base: '1000.00' }), options);
  const g = roc.itens[0]?.IBSCBS.gIBSCBS;
  expect('CBS', g?.gCBS.pCBS === '0.90' && g?.gCBS.vCBS === '9.00');
  expect('IBS', g?.gIBSUF.vIBSUF === '1.00' && roc.total.IBSCBSTot.gIBS.vIBS === '1.00');
  expect('proveniência', roc.dataDeReferencia === '2026-10-10' && roc.versaoDoConteudo === options.dataset.versaoDoConteudo);
  expect('HALF_EVEN', Decimal.parse('0.125').setScale(2, 'HALF_EVEN').toString() === '0.12');
  try {
    calcular(op({ cst: '000', cClassTrib: '999999', base: '1' }), options);
    failures.push('cClassTrib inexistente aceito');
  } catch (e) {
    expect('classificação', e instanceof ErroClassificacao && e.motivo === 'cclasstrib_inexistente');
  }
  try {
    calcular(op({ cst: '000', cClassTrib: '000001', base: '1', monofasia: {} }), options);
    failures.push('monofasia calculada');
  } catch (e) {
    expect('monofasia', e instanceof ErroRegimeNaoSuportado && e.regime === 'monofasia');
  }
  return failures;
}
