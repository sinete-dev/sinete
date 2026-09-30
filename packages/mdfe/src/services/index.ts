/** Serviços do MDF-e. Veja `client.ts` para o contrato de cada operação e `resolver.ts` para a idempotência. */

export type {
  AutorDocumento,
  AutorizacaoOutcome,
  AutorizarOpcoes,
  CancelamentoPedido,
  ConsultaMdfe,
  ConsultaOutcome,
  EncerramentoPedido,
  EventoOutcome,
  EventoRegistrado,
  InclusaoCondutorPedido,
  InclusaoDfePedido,
  MdfeClient,
  MdfeClientOptions,
  MdfeNaoEncerrado,
  OpcoesEnvio,
  PagamentoOperacaoPedido,
  ProtocoloMdfe,
  StatusServico,
} from './client.ts';
export { createMdfeClient } from './client.ts';
export { gunzipBase64, gzipBase64 } from './gzip.ts';
export type { CStatClasse } from './outcome.ts';
export { cstatEm } from './outcome.ts';
export type { DocumentoAssinado } from './proc.ts';
export { documentoAssinado, MDFE_NS, mdfeAssinadoDoProc, sliceElement } from './proc.ts';
export type { RecuperacaoEvento } from './recuperar.ts';
export { recuperarEventoRegistrado } from './recuperar.ts';
export type { ResolucaoEnvio } from './resolver.ts';
export { chaveDaDuplicidade, resolverEnvioSemResposta } from './resolver.ts';
export type { MdfeServicoCliente } from './soap.ts';
