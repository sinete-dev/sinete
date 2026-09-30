// Verificações do @sinete/ibs-cbs/validar compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import { bundledDataset } from '@sinete/ibs-cbs-dados/bundled';
import { calculateAt } from '@sinete/ibs-cbs/calcular';
import { officialRates } from '@sinete/ibs-cbs/aliquotas';
import { documentFromRoc, NT_TABLES, RULES, validate } from '@sinete/ibs-cbs/validar';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const dataset = bundledDataset();
  const op = { modelo: 55, place: { uf: 'SP', cMun: '3550308' }, items: [{ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' }] };
  const roc = calculateAt(op, { dataset, rates: officialRates(), date: '2026-10-10' });
  const time = contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') });
  const doc = documentFromRoc(roc, { modelo: 55, crt: 3, finNFe: 1 });
  const ok = validate(doc, { dataset, time, ambiente: 'producao' });
  expect('documento do motor passa', ok.violations.length === 0 && ok.evaluated.includes('UB35-10'));
  const item = doc.items[0];
  const cbs = item.IBSCBS.gIBSCBS.gCBS;
  const broken = { ...doc, items: [{ ...item, IBSCBS: { ...item.IBSCBS, gIBSCBS: { ...item.IBSCBS.gIBSCBS, gCBS: { ...cbs, vCBS: '1.00' } } } }] };
  const bad = validate(broken, { dataset, time, ambiente: 'producao' });
  expect('vCBS errado acusado', bad.violations.some((v) => v.rule === 'UB67-10' && v.cStat === '1069'));
  expect('catálogo', RULES.length > 50 && NT_TABLES.tpNFDebito.length > 0);
  return failures;
}
