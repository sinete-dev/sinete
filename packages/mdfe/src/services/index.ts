/** Serviços do MDF-e. Veja `client.ts` para o contrato de cada operação e `resolver.ts` para a idempotência. */

export type {
  AutorDocumento,
  AutorizarOpcoes,
  CancelamentoPedido,
  ClienteMdfe,
  ClienteMdfeOpcoes,
  ConsultaMdfe,
  EncerramentoPedido,
  EnvioOpcoes,
  EventoRegistrado,
  InclusaoCondutorPedido,
  InclusaoDfePedido,
  MdfeNaoEncerrado,
  PagamentoOperacaoPedido,
  ProtocoloMdfe,
  ResultadoAutorizacao,
  ResultadoConsulta,
  ResultadoEvento,
  StatusServico,
} from './client.ts';
export { criarClienteMdfe } from './client.ts';
export { comprimirGzipBase64, descomprimirGzipBase64 } from './gzip.ts';
export type { CStatClasse } from './outcome.ts';
export { cstatEm } from './outcome.ts';
export type { DocumentoAssinado } from './proc.ts';
export { documentoAssinado, MDFE_NS, mdfeAssinadoDoProc, recortarElemento } from './proc.ts';
export type { RecuperacaoEvento } from './recuperar.ts';
export { recuperarEventoRegistrado } from './recuperar.ts';
export type { ResolucaoEnvio } from './resolver.ts';
export { chaveDaDuplicidade, resolverEnvioSemResposta } from './resolver.ts';
export type { MdfeServicoCliente } from './soap.ts';
