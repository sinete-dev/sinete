/**
 * Envio sem resposta e duplicidade na autorização do MDF-e.
 *
 * A chave contém o `cMDF` e o número, e o `digVal` do protocolo é o DigestValue do conteúdo autorizado. Enquanto os
 * mesmos bytes assinados forem reenviados, a SEFAZ autoriza ou devolve duplicidade (204, com `[nProt]` e `[dhAut]`).
 * Gerar outro `cMDF` ou outro `dhEmi` depois de um envio sem resposta cria outro MDF-e para o mesmo número: o primeiro
 * pode ter sido autorizado, e o segundo cai em 539 (duplicidade com diferença na chave, com o `[chMDFe]` autorizado).
 * Por isso:
 *
 * 1. grave o MDF-e assinado antes de enviar;
 * 2. envio sem resposta (timeout, conexão caída) ou 204: consulte a chave (`resolverEnvioSemResposta`);
 * 3. `reenviar` (217, o MDF-e não consta): reenvie exatamente os bytes gravados;
 * 4. `concluida`: o `mdfeProc` vem montado com o XML gravado, sem novo envio.
 *
 * O `digVal` é opcional no protocolo (`TProtMDFe/infProt/digVal`, minOccurs 0 no leiaute 3.00b). Sem ele, nada prova
 * que o MDF-e autorizado é o destes bytes: `sem-prova`, e quem chama decide com um humano, sem reenviar nem descartar.
 *
 * Fontes: MOC MDF-e 3.00b Anexo I, regras F81 (539) e F82 (204); Visão Geral, item 4.3.5 (G04, 217).
 */

import type { Recusado } from '@sinete/core';
import { criarAutorizado } from '@sinete/core';
import type { ClienteMdfe, EnvioOpcoes, ResultadoAutorizacao, ResultadoConsulta } from './client.ts';
import { cstatEm } from './outcome.ts';
import { documentoAssinado } from './proc.ts';

export type ResolucaoEnvio =
  /** A chave consta com o mesmo conteúdo: `resultado` traz o protocolo e o `mdfeProc`. */
  | {
      readonly acao: 'concluida';
      readonly situacao: 'autorizado' | 'cancelado' | 'encerrado';
      readonly resultado: ResultadoAutorizacao;
    }
  /** O MDF-e não consta (217): reenvie `mdfeAssinado`, os mesmos bytes. */
  | { readonly acao: 'reenviar'; readonly mdfeAssinado: string }
  /**
   * Existe outro MDF-e para o mesmo número: a mesma chave com outro conteúdo (`digVal` diferente) ou outra chave (539,
   * `chMDFe` extraída do `xMotivo`). Não reenvie: recupere o MDF-e registrado e descarte o local.
   */
  | {
      readonly acao: 'divergente';
      readonly chMDFe?: string;
      readonly consulta?: ResultadoConsulta;
      readonly motivo: Recusado | ResultadoConsulta;
    }
  /**
   * A chave consta (autorizada, cancelada ou encerrada), mas o protocolo não traz `digVal`: nada prova que o conteúdo
   * autorizado é o destes bytes. Não reenvie nem descarte o local, e não o guarde como autorizado sem conferir o XML
   * registrado na SEFAZ.
   */
  | {
      readonly acao: 'sem-prova';
      readonly situacao: 'autorizado' | 'cancelado' | 'encerrado';
      readonly consulta: ResultadoConsulta;
    }
  /** A consulta não decidiu (serviço paralisado, rejeição de schema, situação sem protocolo): tente de novo depois. */
  | { readonly acao: 'indefinida'; readonly resultado: ResultadoConsulta };

const CHAVE_NO_MOTIVO = /\[\s*chMDFe\s*:\s*([0-9]{6}[0-9A-Z]{12}[0-9]{26})\s*\]/i;

/** Chave que a SEFAZ informa no `xMotivo` da rejeição 539 (`[chMDFe: ...]`), se houver. */
export function chaveDaDuplicidade(xMotivo: string): string | undefined {
  return CHAVE_NO_MOTIVO.exec(xMotivo)?.[1]?.toUpperCase();
}

/**
 * Resolve uma autorização sem resposta, ou cuja resposta foi 204 ou 539, consultando a chave do MDF-e assinado.
 * `anterior` é o desfecho do envio, quando houve um. `opcoes.signal` cancela a consulta (lança o `ErroTransporte` com
 * `code: 'cancelado'`).
 */
export async function resolverEnvioSemResposta(
  cliente: ClienteMdfe,
  mdfeAssinado: string,
  anterior?: ResultadoAutorizacao,
  opcoes?: EnvioOpcoes,
): Promise<ResolucaoEnvio> {
  const a = documentoAssinado(mdfeAssinado, 'MDFe', 'infMDFe');
  const chave = a.id.slice(4);
  if (anterior && anterior.tipo === 'recusado' && cstatEm(anterior.cStat, 'duplicidadeChaveDiferente')) {
    const outra = chaveDaDuplicidade(anterior.xMotivo);
    return { acao: 'divergente', motivo: anterior, ...(outra === undefined ? {} : { chMDFe: outra }) };
  }
  const consulta = await cliente.consultar(chave, mdfeAssinado, opcoes);
  if (consulta.tipo === 'recusado') {
    if (cstatEm(consulta.cStat, 'naoConsta')) return { acao: 'reenviar', mdfeAssinado: a.xml };
    return { acao: 'indefinida', resultado: consulta };
  }
  if (consulta.tipo !== 'autorizado') return { acao: 'indefinida', resultado: consulta };
  const v = consulta.valor;
  const p = v.protocolo;
  if (p?.digVal !== undefined && v.digValConfere === false) {
    return { acao: 'divergente', chMDFe: chave, consulta, motivo: consulta };
  }
  if (p !== undefined && p.digVal === undefined) return { acao: 'sem-prova', situacao: v.situacao, consulta };
  if (!p || v.digValConfere !== true || p.mdfeProc === undefined) return { acao: 'indefinida', resultado: consulta };
  return {
    acao: 'concluida',
    situacao: v.situacao,
    resultado: criarAutorizado({ cStat: p.cStat, xMotivo: p.xMotivo }, p),
  };
}
