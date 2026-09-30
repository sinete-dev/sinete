// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check): a raiz e os quatro subpaths.
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import type { Roc as RocRaiz } from '@sinete/ibs-cbs';
import { calculateAt as calculateAtRaiz, officialRates as officialRatesRaiz } from '@sinete/ibs-cbs';
import type { NominalRates, Rate, RateProvider, RateStatus } from '@sinete/ibs-cbs/aliquotas';
import { officialRates } from '@sinete/ibs-cbs/aliquotas';
import type { ClassifiedOperation, Roc, UnsupportedRegime } from '@sinete/ibs-cbs/calcular';
import { calculateAt } from '@sinete/ibs-cbs/calcular';
import type { Determination, ExclusionReason, OperationFacts, Resolver } from '@sinete/ibs-cbs/determinar';
import { determine, uniqueCandidate } from '@sinete/ibs-cbs/determinar';
import type { Ambiente, NtTables, Rule, RulesDocument, ValidationReport } from '@sinete/ibs-cbs/validar';
import { NT_TABLES, RULES, validate } from '@sinete/ibs-cbs/validar';
import { bundledDataset } from '@sinete/ibs-cbs-dados/bundled';

// aliquotas
{
  const p: RateProvider = officialRates();
  const n: NominalRates = p.nominal('2026-10-10');
  const cbs: Rate = n.CBS;
  const status: RateStatus = cbs.status;
  // @ts-expect-error estado é uma união fechada
  const bad: RateStatus = 'estimada';
  void [status, bad];
}

// calcular, e a raiz com os mesmos tipos
{
  const op: ClassifiedOperation = {
    modelo: 55,
    place: { uf: 'SP', cMun: '3550308' },
    items: [{ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' }],
  };
  const roc: Roc = calculateAt(op, { dataset: bundledDataset(), rates: officialRates(), date: '2026-10-10' });
  const viaRaiz: RocRaiz = calculateAtRaiz(op, { dataset: bundledDataset(), rates: officialRatesRaiz(), date: '2026-10-10' });
  const v: string | undefined = roc.items[0]?.IBSCBS.gIBSCBS?.gCBS.vCBS;
  // @ts-expect-error regime é uma união fechada
  const bad: UnsupportedRegime = 'simples';
  void [v, viaRaiz, bad];
}

// validar
{
  const doc: RulesDocument = { modelo: 55, crt: 3, finNFe: 1, items: [] };
  const report: ValidationReport = validate(doc, {
    dataset: bundledDataset(),
    time: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
    ambiente: 'homologacao',
  });
  const first: Rule | undefined = RULES[0];
  const tables: NtTables = NT_TABLES;
  const code: string | undefined = tables.tpNFCredito[0]?.code;
  // @ts-expect-error ambiente é uma união fechada
  const bad: Ambiente = 'teste';
  void [report, first, code, bad];
}

// determinar
{
  const facts: OperationFacts = { modelo: 55, kind: 'venda', items: [{ n: 1, ncm: '10063021' }] };
  const mine: Resolver = {
    name: 'meu',
    resolve: async () => ({ kind: 'abstain' }),
  };
  const det: Promise<Determination> = determine(facts, {
    dataset: bundledDataset(),
    time: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
    resolvers: [mine, uniqueCandidate()],
  });
  // @ts-expect-error motivo é uma união fechada
  const bad: ExclusionReason = 'palpite';
  void [det, bad];
}
