/**
 * `@sinete/mdfe`: MDF-e modelo 58, leiaute 3.00b, modal rodoviário.
 *
 * - `buildMdfe`: entrada do domínio (`MdfeInput`) para o `<MDFe>` canônico validado contra o schema vigente, com a
 *   chave de acesso, os derivados em decimal exato e as regras do MOC conferidas antes de serializar.
 * - `signMdfe`: QR Code (com `sign` em contingência off-line) e assinatura por splice; a string devolvida é a final.
 * - `createMdfeClient`: status, autorização síncrona, consulta, não encerrados e eventos (cancelamento, encerramento,
 *   inclusão de condutor e de DF-e, pagamento da operação), com os desfechos como `SefazOutcome` do core.
 * - O emissor (bytes gravados antes do envio, trava, retomada, cancelamento com recuperação) está em
 *   `@sinete/emissor/mdfe` (ADR 0010).
 * - Percurso por divisas (`conferirPercurso`, `sugerirPercurso`) e o resolvedor de envio sem resposta.
 */

export type { BuildMdfeOptions, BuildMdfeResult, BuiltMdfe } from './build/build.ts';
export {
  assinaturaQrCode,
  buildMdfe,
  comQrCode,
  MDFE_NS,
  pagamentosDoLeiaute,
  prazoContingencia,
  qrCodeMdfe,
  signMdfe,
} from './build/build.ts';
export type { DecimalFormat, DecimalInput } from './decimal.ts';
export { Decimal, dec, sum } from './decimal.ts';
export type { MdfeIssueCode } from './issues.ts';
export { MDFE_ISSUE_CODES } from './issues.ts';
export type {
  Ciot,
  ComponentePagamento,
  Condutor,
  Contratante,
  CteTransportado,
  DadosBancarios,
  Descarregamento,
  DispositivoValePedagio,
  DocumentoContratante,
  DocumentoPessoa,
  Emitente,
  EnderecoEmitente,
  LocalLotacao,
  MdfeInput,
  MunicipioCarregamento,
  NfeTransportada,
  PagamentoFrete,
  ParcelaPagamento,
  ProdutoPerigoso,
  ProdutoPredominante,
  Proprietario,
  ResponsavelTecnico,
  Rodoviario,
  Seguro,
  TipoCarroceria,
  TipoRodado,
  TipoTransportador,
  TotaisCarga,
  ValePedagio,
  VeiculoReboque,
  VeiculoTracao,
} from './model.ts';
export { TipoCarga, TipoEmitente } from './model.ts';
export type { TrechoInvalido, UfMdfe } from './percurso.ts';
export { conferirPercurso, saoVizinhas, sugerirPercurso } from './percurso.ts';
export { rotuloDoCaminho } from './rotulo.ts';
export type {
  AutorDocumento,
  AutorizacaoOutcome,
  AutorizarOpcoes,
  CancelamentoPedido,
  ConsultaMdfe,
  ConsultaOutcome,
  CStatClasse,
  DocumentoAssinado,
  EncerramentoPedido,
  EventoOutcome,
  EventoRegistrado,
  InclusaoCondutorPedido,
  InclusaoDfePedido,
  MdfeClient,
  MdfeClientOptions,
  MdfeNaoEncerrado,
  MdfeServicoCliente,
  PagamentoOperacaoPedido,
  ProtocoloMdfe,
  RecuperacaoEvento,
  ResolucaoEnvio,
  StatusServico,
} from './services/index.ts';
export {
  chaveDaDuplicidade,
  createMdfeClient,
  cstatEm,
  documentoAssinado,
  gunzipBase64,
  gzipBase64,
  mdfeAssinadoDoProc,
  recuperarEventoRegistrado,
  resolverEnvioSemResposta,
  sliceElement,
} from './services/index.ts';
export type { Instante } from './time.ts';
export { offsetDaUf } from './time.ts';
