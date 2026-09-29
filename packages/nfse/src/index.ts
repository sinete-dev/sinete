/**
 * `@sinete/nfse`: NFS-e Nacional (Sefin Nacional e ADN), leiaute 1.01.
 *
 * Entrada do domínio (`DpsInput`), montagem validada no XSD vigente (`buildDps`, que já inclui a declaração UTF-8
 * exigida pela Sefin), assinatura por splice (`signDps`), pedidos de evento (`buildPedidoCancelamento`) e o cliente
 * REST com mTLS (`createNfseClient`): emissão síncrona, substituição, consultas, eventos e parâmetros municipais com
 * cache. Rejeição é desfecho (`NfseRejeicao`, com os códigos do Anexo I e II e o catálogo do `@sinete/rejeicoes/nfse`),
 * não exceção. O emissor (DPS gravada antes do envio, trava, retomada) está em `@sinete/emissor/nfse` (ADR 0010), e o
 * DANFSe sai do XML da NFS-e pelo `danfse` de `@sinete/da/nfse`.
 */

export type { BuildDpsOptions, BuildDpsResult, DpsMontada } from './build.ts';
export { buildDps, DECLARACAO_XML, signDps } from './build.ts';
export type {
  EventoRegistrado,
  FiltroEventos,
  NfseClient,
  NfseClientOptions,
  NfseConsultada,
  NfseGerada,
  OpcoesEnvio,
  ResolucaoEnvio,
} from './client.ts';
export { createNfseClient, resolverEnvioSemResposta } from './client.ts';
export type { ChaveNfse, IdDpsPartes, InscricaoFederal } from './codigos.ts';
export {
  codigoServicoParametrizacao,
  cTribNacDps,
  idDps,
  idPedidoEvento,
  inscricaoId,
  parseChaveNfse,
  TIPOS_EVENTO,
} from './codigos.ts';
export type {
  AnaliseFiscalPedido,
  CancelamentoPedido,
  PedidoEventoMontado,
  PedidoEventoOptions,
  PedidoEventoResult,
} from './evento.ts';
export { buildPedidoAnaliseFiscal, buildPedidoCancelamento, signPedidoEvento } from './evento.ts';
export { gunzipBase64, gzipBase64 } from './gzip.ts';
export type { LeiauteNfse } from './leiaute.ts';
export { leiauteVigente, NFSE_NS, VERSAO_LEIAUTE } from './leiaute.ts';
export type {
  ClassificacaoIbsCbs,
  DpsInput,
  IbsCbsDps,
  Issqn,
  LocalPrestacao,
  Pessoa,
  Prestador,
  Servico,
  Substituicao,
  Tributacao,
  ValoresDps,
} from './model.ts';
export type {
  AliquotaServico,
  CacheParametros,
  ConvenioMunicipal,
  EntradaCache,
  ParametrosMunicipais,
  ParametrosOptions,
  RespostaParametrizacao,
} from './parametros.ts';
export { cacheEmMemoria, createParametrosMunicipais } from './parametros.ts';
export type { NfseMensagem, NfseOutcome, NfseRejeicao } from './respostas.ts';
export type { Valor } from './valores.ts';
export { formatValor } from './valores.ts';
