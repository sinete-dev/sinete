/**
 * Texto e tamanho dos campos de texto da DPS conferidos na entrada (ADR 0011, revisão de 01/10/2026), como na NF-e e
 * no MDF-e.
 *
 * Antes, o texto fora do tipo do leiaute só aparecia na montagem, com o caminho do XML (`/DPS/infDPS/subst/xMotivo`),
 * e o caractere que o XML não representa recusava o documento inteiro (`caractere_invalido` no caminho `/`). Conferidos
 * aqui, saem como `campo_invalido`, com `origem: 'entrada'`, o caminho da entrada (`substituicao.xMotivo`) e uma
 * mensagem para quem preenche o campo.
 *
 * O tipo vem do schema do leiaute vigente (o `TSDesc2000` da descrição do serviço não é o `TString` da NF-e: aceita
 * espaço nas pontas e qualquer caractere que o XML represente). Os grupos que a entrada repassa no tipo do schema
 * (prestador, tomador, intermediário, substituição e os grupos opcionais do serviço) são conferidos campo a campo.
 */

import type { Ocorrencia } from '@sinete/core';
import type { CampoDeTexto, ComplexType } from '@sinete/schemas';
import { conferirTextos } from '@sinete/schemas';
import type { DadosDps } from './model.ts';

/**
 * Campo de texto da entrada e o elemento da `DPS` que o recebe como veio; um grupo repassado no tipo do schema aponta
 * para o elemento do grupo. Série, número, código de tributação nacional, valores e IBS/CBS a montagem formata e
 * confere.
 */
export const CAMPOS: readonly CampoDeTexto[] = [
  ['substituicao', 'infDPS.subst'],
  ['prestador', 'infDPS.prest'],
  ['tomador', 'infDPS.toma'],
  ['intermediario', 'infDPS.interm'],
  ['servico.local', 'infDPS.serv.locPrest'],
  ['servico.cTribMun', 'infDPS.serv.cServ.cTribMun'],
  ['servico.xDescServ', 'infDPS.serv.cServ.xDescServ'],
  ['servico.cNBS', 'infDPS.serv.cServ.cNBS'],
  ['servico.cIntContrib', 'infDPS.serv.cServ.cIntContrib'],
  ['servico.comExt', 'infDPS.serv.comExt'],
  ['servico.obra', 'infDPS.serv.obra'],
  ['servico.atvEvento', 'infDPS.serv.atvEvento'],
  ['servico.infoCompl', 'infDPS.serv.infoCompl'],
];

/**
 * Confere os textos da entrada: em qualquer campo, o caractere que o XML não representa; nos campos da tabela, o tipo
 * do elemento no leiaute. Tudo sai como `campo_invalido` com o caminho da entrada; o campo que já tem ocorrência de
 * outra conferência da entrada não ganha outra.
 */
export function conferirTextosDaEntrada(entrada: DadosDps, dps: ComplexType, issues: Ocorrencia[]): void {
  const pular = new Set(issues.map((i) => i.caminho));
  for (const t of conferirTextos(entrada, dps, CAMPOS, pular))
    issues.push({ caminho: t.caminho, code: 'campo_invalido', mensagem: t.mensagem });
}
