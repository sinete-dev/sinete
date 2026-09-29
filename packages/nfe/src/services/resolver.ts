/**
 * Envio sem resposta e duplicidade na autorização.
 *
 * Idempotência: a chave de acesso contém o `cNF` e o número da nota, e o `digVal` do protocolo é o DigestValue do
 * conteúdo autorizado. Enquanto o mesmo XML assinado (os mesmos bytes) for reenviado, a SEFAZ ou autoriza, ou devolve
 * duplicidade (204) com o protocolo existente. Gerar outro `cNF`, outro `dhEmi` ou reassinar depois de um envio sem
 * resposta cria uma segunda nota para o mesmo número: a primeira pode ter sido autorizada, e a segunda cai em 539
 * (duplicidade com diferença na chave) ou, pior, é autorizada com outra chave se o número mudar. Por isso:
 *
 * 1. grave o XML assinado antes de enviar;
 * 2. envio sem resposta (timeout, conexão caída) ou 204: consulte a chave (`resolverEnvioSemResposta`);
 * 3. `reenviar` (cStat 217, a NF-e não consta): reenvie exatamente os bytes gravados;
 * 4. `concluida`: o `nfeProc` vem montado com o XML gravado, sem novo envio.
 *
 * O `digVal` é opcional no protocolo (`TProtNFe/infProt/digVal`, minOccurs 0 no `leiauteNFe_v4.00.xsd` do PL_010), e
 * há autorizador que o omite. Sem ele, nada prova que o conteúdo registrado é o destes bytes, e as duas decisões se
 * separam:
 *
 * - denegação (110, 301, 302, 303; MOC 7.0 Anexo I, tabela 4.4.3 e regras 1C17-40, 5E17-40 e 5E17-60) é decisão
 *   sobre a chave: a NF-e fica registrada como denegada e o número não pode ser reaproveitado nem inutilizado, qualquer
 *   que seja o conteúdo. A resolução é `concluida` com o protocolo, e `conteudo` diz se o `digVal` confere, falta ou
 *   difere; o `nfeProc` só vem quando confere;
 * - autorização sem `digVal` não prova que a NF-e autorizada é esta: `sem-prova`, e quem chama decide com um humano.
 *
 * Fontes: MOC 7.0 Anexo I (RV 204 "Duplicidade de NF-e", RV 539 "Duplicidade de NF-e com diferença na Chave de
 * Acesso [chNFe: ...]") e serviço de consulta protocolo (cStat 217; 561, 562 e 613 quando a numeração tem outra NF-e).
 */

import type { Rejected } from '@sinete/core';
import { authorized, denied } from '@sinete/core';
import type { AutorizacaoOutcome, ConsultaOutcome, NfeClient, ProtocoloNfe } from './client.ts';
import { cstatEm } from './outcome.ts';
import { documentoAssinado } from './proc.ts';

/**
 * O que o `digVal` do protocolo diz dos bytes assinados: `confere` (é o DigestValue deles), `sem-digval` (o protocolo
 * não o traz) ou `difere` (a SEFAZ registrou outro conteúdo com a mesma chave).
 */
export type ConteudoDoProtocolo = 'confere' | 'sem-digval' | 'difere';

/** O que fazer com uma NF-e cujo envio ficou sem resposta ou voltou como duplicidade. */
export type ResolucaoEnvio =
  /**
   * A chave está decidida: autorizada (ou cancelada) com o mesmo conteúdo, e `outcome` traz o protocolo e o `nfeProc`;
   * ou denegada, com qualquer conteúdo (a denegação é da chave), e `outcome` traz o protocolo, com o `nfeProc` só
   * quando `conteudo` é `confere`.
   */
  | {
      readonly acao: 'concluida';
      readonly situacao: 'autorizada' | 'cancelada' | 'denegada';
      readonly conteudo: ConteudoDoProtocolo;
      readonly outcome: AutorizacaoOutcome;
    }
  /** A NF-e não consta na SEFAZ (217): reenvie `nfeAssinada`, os mesmos bytes. */
  | { readonly acao: 'reenviar'; readonly nfeAssinada: string }
  /**
   * Existe outra NF-e para o mesmo número: a mesma chave com outro conteúdo (`digVal` diferente) ou outra chave (539 no
   * envio, ou 561, 562 e 613 na consulta; `chNFe` extraída do `xMotivo` quando vier). Não reenvie: recupere a nota registrada e descarte a local.
   */
  | {
      readonly acao: 'divergente';
      readonly chNFe?: string;
      readonly consulta?: ConsultaOutcome;
      readonly motivo: Rejected | ConsultaOutcome;
    }
  /**
   * A chave está autorizada (ou cancelada), mas o protocolo não traz `digVal`: nada prova que o conteúdo autorizado é o
   * destes bytes. Não reenvie nem descarte a nota local, e não a guarde como autorizada sem conferir o XML registrado
   * na SEFAZ (a Distribuição DF-e ou o portal devolvem a NF-e autorizada).
   */
  | { readonly acao: 'sem-prova'; readonly situacao: 'autorizada' | 'cancelada'; readonly consulta: ConsultaOutcome }
  /**
   * A consulta não decidiu (serviço paralisado, consumo indevido, rejeição de schema, situação sem protocolo): tente de
   * novo mais tarde, sem descartar a nota local.
   */
  | { readonly acao: 'indefinida'; readonly outcome: ConsultaOutcome };

/** Chave com CNPJ alfanumérico (NT 2025.001): 6 dígitos, 12 alfanuméricos, 26 dígitos. */
const CHAVE_NO_MOTIVO = /\[\s*chNFe\s*:\s*([0-9]{6}[0-9A-Z]{12}[0-9]{26})\s*\]/i;

/** Chave de acesso que a SEFAZ informa no `xMotivo` da rejeição 539 (`[chNFe:...]`), se houver. */
export function chaveDaDuplicidade(xMotivo: string): string | undefined {
  return CHAVE_NO_MOTIVO.exec(xMotivo)?.[1]?.toUpperCase();
}

/**
 * Resolve um envio de autorização sem resposta, ou cuja resposta foi 204 ou 539, consultando a chave da NF-e
 * assinada. `anterior` é o desfecho do envio, quando houve um.
 */
export async function resolverEnvioSemResposta(
  client: NfeClient,
  nfeAssinada: string,
  anterior?: AutorizacaoOutcome,
): Promise<ResolucaoEnvio> {
  const a = documentoAssinado(nfeAssinada, 'NFe', 'infNFe');
  const chave = a.id.slice(3);
  if (anterior && anterior.status === 'rejected' && cstatEm(anterior.cStat, 'duplicidadeChaveDiferente')) {
    const outra = chaveDaDuplicidade(anterior.xMotivo);
    return { acao: 'divergente', motivo: anterior, ...(outra === undefined ? {} : { chNFe: outra }) };
  }
  const consulta = await client.consultar(chave, nfeAssinada);
  if (consulta.status === 'rejected') {
    if (cstatEm(consulta.cStat, 'naoConsta')) return { acao: 'reenviar', nfeAssinada: a.xml };
    // 561, 562 e 613 na consulta: a chave local não consta, mas a numeração dela tem outra NF-e (outro mês, outro cNF
    // ou outra chave). É a mesma situação da 539 no envio; o 562 traz a chave registrada no xMotivo.
    if (cstatEm(consulta.cStat, 'outraNfeNoNumero')) {
      const outra = chaveDaDuplicidade(consulta.xMotivo);
      return { acao: 'divergente', motivo: consulta, ...(outra === undefined ? {} : { chNFe: outra }) };
    }
    return { acao: 'indefinida', outcome: consulta };
  }
  if (consulta.status === 'pending') return { acao: 'indefinida', outcome: consulta };
  const v = consulta.value;
  const p: ProtocoloNfe | undefined = v.protocolo;
  if (!p) return { acao: 'indefinida', outcome: consulta };
  const conteudo: ConteudoDoProtocolo =
    p.digVal === undefined ? 'sem-digval' : v.digValConfere === true ? 'confere' : 'difere';
  const protStatus = { cStat: p.cStat, xMotivo: p.xMotivo };
  // A denegação é da chave: o número está denegado com qualquer conteúdo, e o `conteudo` diz se é o destes bytes.
  if (v.situacao === 'denegada')
    return { acao: 'concluida', situacao: 'denegada', conteudo, outcome: denied(protStatus, p) };
  // Só um digVal presente e diferente prova outro conteúdo para a chave.
  if (conteudo === 'difere') return { acao: 'divergente', chNFe: chave, consulta, motivo: consulta };
  if (conteudo === 'sem-digval') return { acao: 'sem-prova', situacao: v.situacao, consulta };
  if (p.nfeProc === undefined) return { acao: 'indefinida', outcome: consulta };
  return { acao: 'concluida', situacao: v.situacao, conteudo, outcome: authorized(protStatus, p) };
}
