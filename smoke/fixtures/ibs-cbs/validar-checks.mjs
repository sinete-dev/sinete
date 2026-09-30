// Verificações do @sinete/ibs-cbs/validar compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';
import { calcularEm } from '@sinete/ibs-cbs/calcular';
import { aliquotasOficiais } from '@sinete/ibs-cbs/aliquotas';
import { documentoDoRoc, TABELAS_NT, REGRAS, validar } from '@sinete/ibs-cbs/validar';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const dataset = datasetEmbarcado();
  const op = { modelo: 55, local: { uf: 'SP', cMun: '3550308' }, itens: [{ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' }] };
  const roc = calcularEm(op, { dataset, aliquotas: aliquotasOficiais(), data: '2026-10-10' });
  const time = contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') });
  const doc = documentoDoRoc(roc, { modelo: 55, crt: 3, finNFe: 1 });
  const ok = validar(doc, { dataset, tempo: time, ambiente: 'producao' });
  expect('documento do motor passa', ok.violacoes.length === 0 && ok.avaliadas.includes('UB35-10'));
  const item = doc.itens[0];
  const cbs = item.IBSCBS.gIBSCBS.gCBS;
  const broken = { ...doc, itens: [{ ...item, IBSCBS: { ...item.IBSCBS, gIBSCBS: { ...item.IBSCBS.gIBSCBS, gCBS: { ...cbs, vCBS: '1.00' } } } }] };
  const bad = validar(broken, { dataset, tempo: time, ambiente: 'producao' });
  expect('vCBS errado acusado', bad.violacoes.some((v) => v.regra === 'UB67-10' && v.cStat === '1069'));
  expect('catálogo', REGRAS.length > 50 && TABELAS_NT.tpNFDebito.length > 0);
  return failures;
}
