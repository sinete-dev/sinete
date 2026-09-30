/**
 * `@sinete/nfe`: NF-e modelo 55 e NFC-e modelo 65. Entrada do domínio (`NfeInput`), montagem com totais em decimal exato e validação
 * estrita (`buildNfe`), assinatura por splice (`signNfe`) e os serviços da SEFAZ sobre `@sinete/transport`
 * (`createNfeClient`). IBS/CBS pelo motor do sinete por padrão (`ibsCbsCalculator`), com o dataset carregado sob
 * demanda. O emissor (bytes gravados antes do envio, trava, retomada, cancelamento com recuperação) está em
 * `@sinete/emissor/nfe` (ADR 0010).
 */

export type {
  BuildNfeOptions,
  BuildNfeResult,
  BuiltNfe,
  ExigenciaRespTec,
} from './build/build.ts';
export {
  assinaturaQrCode,
  buildNfe,
  comQrCode,
  exigenciaRespTec,
  hashCsrt,
  NFE_NS,
  signNfe,
  XNOME_HOMOLOGACAO,
  XPROD_HOMOLOGACAO_NFCE,
} from './build/build.ts';
export type { NfceSupl, QrCodeNfceOpcoes } from './build/nfce.ts';
export { NFCE_LIMITE_SEM_DESTINATARIO, urlsNfce } from './build/nfce.ts';
export { conferirEmitenteDoCertificado } from './build/rejeicoes.ts';
export type { Familia } from './build/values.ts';
export type { DecimalInput, RoundingMode } from './decimal.ts';
export { Decimal, dec, sum } from './decimal.ts';
export type { DecimalFormat } from './format.ts';
export { formatDecimal, formatProblem } from './format.ts';
export type { NfeIssueCode } from './issues.ts';
export { NFE_ISSUE_CODES } from './issues.ts';
export type {
  ClassificacaoIbsCbs,
  Cobranca,
  Contingencia,
  Crt,
  CstPisCofinsOutras,
  Desoneracao,
  DesoneracaoSt,
  Destinatario,
  DetalhePagamento,
  DocumentoPessoa,
  Emitente,
  Endereco,
  EnderecoExterior,
  FinNFe,
  IbsCbsItem,
  Icms,
  Icms00,
  Icms02,
  Icms10,
  Icms15,
  Icms20,
  Icms30,
  Icms40,
  Icms51,
  Icms53,
  Icms60,
  Icms61,
  Icms70,
  Icms90,
  IcmsFcp,
  IcmsPartilha,
  IcmsProprio,
  IcmsRepasseSt,
  IcmsSn101,
  IcmsSn102,
  IcmsSn201,
  IcmsSn202,
  IcmsSn500,
  IcmsSn900,
  IcmsSt,
  IcmsStRetido,
  IcmsUfDest,
  ImpostoImportacao,
  ImpostosItem,
  IndIEDest,
  InformacoesAdicionais,
  Ipi,
  IpiNaoTributado,
  IpiTributado,
  Issqn,
  Item,
  Local,
  ModBC,
  ModBCST,
  ModFrete,
  NfeInput,
  Origem,
  Pagamento,
  PisCofins,
  PisCofinsSt,
  Produto,
  ProdutoEspecifico,
  Referenciada,
  RefNfp,
  ResponsavelTecnico,
  TCIBS_NFe,
  TMonofasia,
  Transportador,
  Transporte,
  TTribNFe,
  Volume,
} from './model.ts';
export { MotivoDesoneracaoIcms, TipoPagamento } from './model.ts';
export type { IbsCbsCalculator, IbsCbsItemRequest, IbsCbsNotaRequest, IbsCbsResponse } from './ports.ts';
export { rotuloDoCaminho } from './rotulo.ts';
export type { GrupoIbsCbs, IbsCbsCalculatorOptions } from './rtc.ts';
export { carregarDatasetEmbarcado, ibsCbsCalculator, localDaOperacao } from './rtc.ts';
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
} from './services/client.ts';
export { autorizadorContingencia, createNfeClient } from './services/client.ts';
export { gunzipBase64 } from './services/gzip.ts';
export type { DocumentoAssinado } from './services/proc.ts';
export { documentoAssinado, nfeAssinadaDoProc, sliceElement } from './services/proc.ts';
export type { RecuperacaoEvento } from './services/recuperar.ts';
export { recuperarEventoRegistrado } from './services/recuperar.ts';
export type { ConteudoDoProtocolo, ResolucaoEnvio } from './services/resolver.ts';
export { chaveDaDuplicidade, resolverEnvioSemResposta } from './services/resolver.ts';
export type { Instante } from './time.ts';
export { formatDh, offsetDaUf } from './time.ts';
