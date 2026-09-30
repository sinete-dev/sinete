/**
 * Serviços da NF-e (webservices 4.00 da SEFAZ e do Ambiente Nacional). Veja `client.ts` para o contrato de cada
 * operação e `resolver.ts` para a regra de idempotência da autorização.
 */

export type {
  AutorDocumento,
  AutorizacaoOutcome,
  AutorizarOpcoes,
  Cadastro,
  CadastroPedido,
  CancelamentoPedido,
  CancelamentoSubstituicaoPedido,
  CartaCorrecaoPedido,
  ConsultaNfe,
  ConsultaOutcome,
  ConsultaReciboOpcoes,
  Distribuicao,
  DistribuicaoConsulta,
  DistribuicaoOpcoes,
  DocumentoDistribuido,
  EventoOutcome,
  EventoRegistrado,
  Inutilizacao,
  InutilizacaoOutcome,
  InutilizacaoPedido,
  ManifestacaoPedido,
  ManifestacaoTipo,
  NfeClient,
  NfeClientOptions,
  OpcoesEnvio,
  PoliticaRecibo,
  ProtocoloNfe,
  Sleep,
  StatusServico,
  StatusServicoOpcoes,
} from './client.ts';
export { autorizadorContingencia, createNfeClient } from './client.ts';
export { gunzipBase64 } from './gzip.ts';
export type { DocumentoAssinado } from './proc.ts';
export { documentoAssinado, nfeAssinadaDoProc, sliceElement } from './proc.ts';
export type { RecuperacaoEvento } from './recuperar.ts';
export { recuperarEventoRegistrado } from './recuperar.ts';
export type { ConteudoDoProtocolo, ResolucaoEnvio } from './resolver.ts';
export { chaveDaDuplicidade, resolverEnvioSemResposta } from './resolver.ts';
