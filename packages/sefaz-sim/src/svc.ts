/**
 * Respostas da SVC conforme a ativação para a UF (NT 2013.007 v1.03): a consulta status na SVC (item 04.7, regras
 * K05.1 a K05.3: 107, 113 ou 114) e a recepção (item 04.1, regras C03.2 e GB02.2: 114 quando a SVC não está ativada
 * para a UF do emitente). Os textos estão em `data/svc.json`.
 */

import { ufPorCUf } from '@sinete/core';
import type { Runtime, Status } from './context.ts';
import { situacaoSvc, status, svcAtual } from './context.ts';
import table from './data/svc.json' with { type: 'json' };
import { formatInstant } from './time.ts';

const FUSO_SVC_MINUTOS = -180;

/** Status da consulta status na SVC para a UF do `cUF`. */
export function statusDaSvc(rt: Runtime, cUF: string, now: number): Status {
  const s = situacaoSvc(rt, cUF, now);
  if (s.situacao === 'ativa') return status('107');
  if (s.situacao === 'inativa') {
    return { cStat: '114', xMotivo: table.codes['114Status'].replace('[SVC]', svcAtual(rt)) };
  }
  // "dd/mm/aa às hh:mm" no horário de Brasília, o da SVC (SVC-AN e SVC-RS), qualquer que seja o fuso da UF simulada.
  const local = formatInstant(s.ate, FUSO_SVC_MINUTOS);
  const data = `${local.slice(8, 10)}/${local.slice(5, 7)}/${local.slice(2, 4)}`;
  const xMotivo = table.codes['113']
    .replace('[UF]', ufPorCUf(cUF)?.sigla ?? cUF)
    .replace('[data]', data)
    .replace('[hora]', local.slice(11, 16));
  return { cStat: '113', xMotivo };
}

/** 114 na recepção pela SVC quando ela não aceita alguma das UFs do lote (inativa, ou desativando depois da hora). */
export function recepcaoSvcRecusada(rt: Runtime, cUFs: Iterable<string>, now: number): Status | undefined {
  for (const cUF of cUFs) {
    if (situacaoSvc(rt, cUF, now).situacao === 'inativa') return { cStat: '114', xMotivo: table.codes['114Recepcao'] };
  }
  return undefined;
}
