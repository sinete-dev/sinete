// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check): a raiz e os quatro subpaths.
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import type { Roc as RocRaiz } from '@sinete/ibs-cbs';
import { calcularEm as calculateAtRaiz, aliquotasOficiais as officialRatesRaiz } from '@sinete/ibs-cbs';
import type { AliquotasNominais, Aliquota, ProvedorDeAliquotas, SituacaoDaAliquota } from '@sinete/ibs-cbs/aliquotas';
import { aliquotasOficiais } from '@sinete/ibs-cbs/aliquotas';
import type { OperacaoClassificada, Roc, RegimeNaoSuportado } from '@sinete/ibs-cbs/calcular';
import { calcularEm } from '@sinete/ibs-cbs/calcular';
import type { Determinacao, MotivoDaExclusao, FatosDaOperacao, Resolvedor } from '@sinete/ibs-cbs/determinar';
import { determinar, candidatoUnico } from '@sinete/ibs-cbs/determinar';
import type { Ambiente, TabelasNt, Regra, DocumentoDasRegras, RelatorioDeValidacao } from '@sinete/ibs-cbs/validar';
import { TABELAS_NT, REGRAS, validar } from '@sinete/ibs-cbs/validar';
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';

// aliquotas
{
  const p: ProvedorDeAliquotas = aliquotasOficiais();
  const n: AliquotasNominais = p.nominal('2026-10-10');
  const cbs: Aliquota = n.CBS;
  const status: SituacaoDaAliquota = cbs.situacao;
  // @ts-expect-error estado é uma união fechada
  const bad: SituacaoDaAliquota = 'estimada';
  void [status, bad];
}

// calcular, e a raiz com os mesmos tipos
{
  const op: OperacaoClassificada = {
    modelo: 55,
    local: { uf: 'SP', cMun: '3550308' },
    itens: [{ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' }],
  };
  const roc: Roc = calcularEm(op, { dataset: datasetEmbarcado(), aliquotas: aliquotasOficiais(), data: '2026-10-10' });
  const viaRaiz: RocRaiz = calculateAtRaiz(op, { dataset: datasetEmbarcado(), aliquotas: officialRatesRaiz(), data: '2026-10-10' });
  const v: string | undefined = roc.itens[0]?.IBSCBS.gIBSCBS?.gCBS.vCBS;
  // @ts-expect-error regime é uma união fechada
  const bad: RegimeNaoSuportado = 'simples';
  void [v, viaRaiz, bad];
}

// validar
{
  const doc: DocumentoDasRegras = { modelo: 55, crt: 3, finNFe: 1, itens: [] };
  const report: RelatorioDeValidacao = validar(doc, {
    dataset: datasetEmbarcado(),
    tempo: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
    ambiente: 'homologacao',
  });
  const first: Regra | undefined = REGRAS[0];
  const tables: TabelasNt = TABELAS_NT;
  const code: string | undefined = tables.tpNFCredito[0]?.codigo;
  // @ts-expect-error ambiente é uma união fechada
  const bad: Ambiente = 'teste';
  void [report, first, code, bad];
}

// determinar
{
  const facts: FatosDaOperacao = { modelo: 55, tipo: 'venda', itens: [{ n: 1, ncm: '10063021' }] };
  const mine: Resolvedor = {
    nome: 'meu',
    resolver: async () => ({ tipo: 'abster' }),
  };
  const det: Promise<Determinacao> = determinar(facts, {
    dataset: datasetEmbarcado(),
    tempo: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
    resolvedores: [mine, candidatoUnico()],
  });
  // @ts-expect-error motivo é uma união fechada
  const bad: MotivoDaExclusao = 'palpite';
  void [det, bad];
}
