// Verificações do @sinete/ibs-cbs/determinar compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';
import { calcularEm } from '@sinete/ibs-cbs/calcular';
import { aliquotasOficiais } from '@sinete/ibs-cbs/aliquotas';
import { restringir, ErroDeterminacao, determinar, idDaPergunta, paraClassificado } from '@sinete/ibs-cbs/determinar';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const dataset = datasetEmbarcado();
  const time = contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') });
  const facts = { modelo: 55, tipo: 'venda', itens: [{ n: 1, ncm: '10063021', descricao: 'arroz' }] };
  const [item] = restringir(facts, { dataset, tempo: time });
  expect('candidato do anexo', item.candidatos.some((c) => c.cClassTrib === '200003'));
  expect('exclusão com motivo', item.exclusoes.find((e) => e.cClassTrib === '200034')?.motivo === 'ncm');
  const asked = await determinar(facts, { dataset, tempo: time });
  expect('pergunta', !asked.completa && asked.itens[0].pendente?.[0]?.id === idDaPergunta(1));
  const det = await determinar(facts, { dataset, tempo: time, respostas: { [idDaPergunta(1)]: '200003' } });
  expect('decidido pelo usuário', det.completa && det.itens[0].decidido?.procedencia.por === 'usuario');
  const transfer = await determinar({ ...facts, tipo: 'transferencia' }, { dataset, tempo: time });
  expect('regra legal', transfer.itens[0].decidido?.candidato.cClassTrib === '410002');
  const op = paraClassificado(det, { modelo: 55, local: { uf: 'SP', cMun: '3550308' } }, () => ({ base: '100.00' }));
  const roc = calcularEm(op, { dataset, aliquotas: aliquotasOficiais(), data: det.dataDeReferencia });
  expect('cálculo', roc.itens[0]?.IBSCBS.gIBSCBS?.gCBS.gRed?.pRedAliq === '100.00');
  try {
    paraClassificado(asked, { modelo: 55, local: { uf: 'SP', cMun: '3550308' } }, () => ({ base: '1' }));
    failures.push('determinação incompleta aceita');
  } catch (e) {
    expect('erro tipado', e instanceof ErroDeterminacao && e.motivo === 'determinacao_incompleta');
  }
  return failures;
}
