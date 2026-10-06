/**
 * `@sinete/nfse`: NFS-e Nacional (Sefin Nacional e ADN), leiaute 1.01.
 *
 * Entrada do domínio (`DadosDps`), montagem validada no XSD vigente (`montarDps`, que já inclui a declaração UTF-8
 * exigida pela Sefin), assinatura por splice (`assinarDps`), pedidos de evento (`montarPedidoCancelamento`) e o cliente
 * REST com mTLS (`criarClienteNfse`): emissão síncrona, substituição, consultas, eventos e parâmetros municipais com
 * cache. Rejeição é desfecho (`RejeicaoNfse`, com os códigos do Anexo I e II e o catálogo do `@sinete/rejeicoes/nfse`),
 * não exceção. O emissor (DPS gravada antes do envio, trava, retomada) está em `@sinete/emissor/nfse` (ADR 0010), e o
 * DANFSe sai do XML da NFS-e pelo `danfse` de `@sinete/da/nfse`.
 */

export type { DpsMontada, MontarDpsOpcoes, ResultadoMontagemDps } from './build.ts';
export { assinarDps, DECLARACAO_XML, montarDps } from './build.ts';
export type {
  ClienteNfse,
  ClienteNfseOpcoes,
  EnvioOpcoes,
  EventoRegistrado,
  FiltroEventos,
  NfseConsultada,
  NfseGerada,
  ResolucaoEnvio,
} from './client.ts';
export { criarClienteNfse, resolverEnvioSemResposta } from './client.ts';
export type { ChaveNfse, IdDpsPartes, InscricaoFederal } from './codigos.ts';
export {
  codigoServicoParametrizacao,
  cTribNacDps,
  idDps,
  idPedidoEvento,
  inscricaoId,
  lerChaveNfse,
  TIPOS_EVENTO,
} from './codigos.ts';
export type {
  AnaliseFiscalPedido,
  CancelamentoPedido,
  PedidoEventoMontado,
  PedidoEventoOpcoes,
  ResultadoPedidoEvento,
} from './evento.ts';
export { assinarPedidoEvento, montarPedidoAnaliseFiscal, montarPedidoCancelamento } from './evento.ts';
export { comprimirGzipBase64, descomprimirGzipBase64 } from './gzip.ts';
export type { LeiauteNfse } from './leiaute.ts';
export { leiauteVigente, NFSE_NS, VERSAO_LEIAUTE } from './leiaute.ts';
export type {
  ClassificacaoIbsCbs,
  DadosDps,
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
  ParametrosOpcoes,
  RespostaParametrizacao,
} from './parametros.ts';
export { cacheEmMemoria, criarParametrosMunicipais } from './parametros.ts';
export type { RecuperacaoEvento } from './recuperar.ts';
export { recuperarEventoRegistrado } from './recuperar.ts';
export type { MensagemNfse, RejeicaoNfse, ResultadoNfse } from './respostas.ts';
export { rotuloDoCaminho } from './rotulo.ts';
export type { Valor } from './valores.ts';
export { formatarValor } from './valores.ts';
