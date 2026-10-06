/**
 * `@sinete/mdfe`: MDF-e modelo 58, leiaute 3.00b, modal rodoviário.
 *
 * - `montarMdfe`: entrada do domínio (`DadosMdfe`) para o `<MDFe>` canônico validado contra o schema vigente, com a
 *   chave de acesso, os derivados em decimal exato e as regras do MOC conferidas antes de serializar.
 * - `assinarMdfe`: QR Code (com `sign` em contingência off-line) e assinatura por splice; a string devolvida é a final.
 * - `criarClienteMdfe`: status, autorização síncrona, consulta, não encerrados e eventos (cancelamento, encerramento,
 *   inclusão de condutor e de DF-e, pagamento da operação), com os desfechos como `ResultadoSefaz` do core.
 * - O emissor (bytes gravados antes do envio, trava, retomada, cancelamento com recuperação) está em
 *   `@sinete/emissor/mdfe` (ADR 0010).
 * - Percurso por divisas (`conferirPercurso`, `sugerirPercurso`) e o resolvedor de envio sem resposta.
 */

export type { MdfeMontado, MontarMdfeOpcoes, ResultadoMontagemMdfe } from './build/build.ts';
export {
  assinarMdfe,
  assinaturaQrCode,
  comQrCode,
  MDFE_NS,
  montarMdfe,
  pagamentosDoLeiaute,
  prazoContingencia,
  qrCodeMdfe,
} from './build/build.ts';
export type { DecimalInput, FormatoDecimal } from './decimal.ts';
export { Decimal, dec, sum } from './decimal.ts';
export type { CodigoOcorrenciaMdfe } from './issues.ts';
export { CODIGOS_OCORRENCIA_MDFE } from './issues.ts';
export type {
  Aereo,
  Aquaviario,
  CamposMdfe,
  Ciot,
  ComponentePagamento,
  Condutor,
  Contratante,
  CteTransportado,
  DadosBancarios,
  DadosMdfe,
  DadosMdfeAereo,
  DadosMdfeAquaviario,
  DadosMdfeFerroviario,
  DadosMdfeRodoviario,
  Descarregamento,
  DispositivoValePedagio,
  DocumentoContratante,
  DocumentoPessoa,
  EmbarcacaoComboio,
  Emitente,
  EnderecoEmitente,
  Ferroviario,
  LocalLotacao,
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
  TerminalCarregamento,
  TerminalDescarregamento,
  TipoCarroceria,
  TipoRodado,
  TipoTransportador,
  TotaisCarga,
  Trem,
  UnidadeCargaVazia,
  UnidadeTransporteVazia,
  Vagao,
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
  AutorizarOpcoes,
  CancelamentoPedido,
  ClienteMdfe,
  ClienteMdfeOpcoes,
  ConsultaMdfe,
  CStatClasse,
  DocumentoAssinado,
  EncerramentoPedido,
  EnvioOpcoes,
  EventoRegistrado,
  InclusaoCondutorPedido,
  InclusaoDfePedido,
  MdfeNaoEncerrado,
  MdfeServicoCliente,
  PagamentoOperacaoPedido,
  ProtocoloMdfe,
  RecuperacaoEvento,
  ResolucaoEnvio,
  ResultadoAutorizacao,
  ResultadoConsulta,
  ResultadoEvento,
  StatusServico,
} from './services/index.ts';
export {
  chaveDaDuplicidade,
  comprimirGzipBase64,
  criarClienteMdfe,
  cstatEm,
  descomprimirGzipBase64,
  documentoAssinado,
  mdfeAssinadoDoProc,
  recortarElemento,
  recuperarEventoRegistrado,
  resolverEnvioSemResposta,
} from './services/index.ts';
export type { Instante } from './time.ts';
export { deslocamentoDaUf } from './time.ts';
