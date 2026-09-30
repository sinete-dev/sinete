/**
 * Serviços da NF-e (webservices 4.00 da SEFAZ e do Ambiente Nacional). Veja `client.ts` para o contrato de cada
 * operação e `resolver.ts` para a regra de idempotência da autorização.
 */

export type {
  AutorDocumento,
  AutorizarOpcoes,
  Cadastro,
  CadastroPedido,
  CancelamentoPedido,
  CancelamentoSubstituicaoPedido,
  CartaCorrecaoPedido,
  ClienteNfe,
  ClienteNfeOpcoes,
  ConsultaNfe,
  ConsultaReciboOpcoes,
  Distribuicao,
  DistribuicaoConsulta,
  DistribuicaoOpcoes,
  DocumentoDistribuido,
  EnvioOpcoes,
  Espera,
  EventoRegistrado,
  Inutilizacao,
  InutilizacaoPedido,
  ManifestacaoPedido,
  ManifestacaoTipo,
  PoliticaRecibo,
  ProtocoloNfe,
  ResultadoAutorizacao,
  ResultadoConsulta,
  ResultadoEvento,
  ResultadoInutilizacao,
  StatusServico,
  StatusServicoOpcoes,
} from './client.ts';
export { autorizadorContingencia, criarClienteNfe } from './client.ts';
export { descomprimirGzipBase64 } from './gzip.ts';
export type { DocumentoAssinado } from './proc.ts';
export { documentoAssinado, nfeAssinadaDoProc, recortarElemento } from './proc.ts';
export type { RecuperacaoEvento } from './recuperar.ts';
export { recuperarEventoRegistrado } from './recuperar.ts';
export type { ConteudoDoProtocolo, ResolucaoEnvio } from './resolver.ts';
export { chaveDaDuplicidade, resolverEnvioSemResposta } from './resolver.ts';
