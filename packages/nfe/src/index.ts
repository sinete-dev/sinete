/**
 * `@sinete/nfe`: NF-e modelo 55 e NFC-e modelo 65. Entrada do domínio (`DadosNfe`), montagem com totais em decimal exato e validação
 * estrita (`montarNfe`), assinatura por splice (`assinarNfe`) e os serviços da SEFAZ sobre `@sinete/transport`
 * (`criarClienteNfe`). IBS/CBS pelo motor do sinete por padrão (`calculadoraIbsCbs`), com o dataset carregado sob
 * demanda. O emissor (bytes gravados antes do envio, trava, retomada, cancelamento com recuperação) está em
 * `@sinete/emissor/nfe` (ADR 0010).
 */

export type {
  ExigenciaRespTec,
  MontarNfeOpcoes,
  NfeMontada,
  ResultadoMontagemNfe,
} from './build/build.ts';
export {
  assinarNfe,
  assinaturaQrCode,
  comQrCode,
  exigenciaRespTec,
  hashCsrt,
  montarNfe,
  NFE_NS,
  XNOME_HOMOLOGACAO,
  XPROD_HOMOLOGACAO_NFCE,
} from './build/build.ts';
export type { NfceSupl, QrCodeNfceOpcoes } from './build/nfce.ts';
export { NFCE_LIMITE_SEM_DESTINATARIO, urlsNfce } from './build/nfce.ts';
export { conferirEmitenteDoCertificado } from './build/rejeicoes.ts';
export type { Familia } from './build/values.ts';
export type { DecimalInput, RoundingMode } from './decimal.ts';
export { Decimal, dec, sum } from './decimal.ts';
export type { FormatoDecimal } from './format.ts';
export { formatarDecimal, problemaDeFormato } from './format.ts';
export type { CodigoOcorrenciaNfe } from './issues.ts';
export { CODIGOS_OCORRENCIA_NFE } from './issues.ts';
export type {
  ClassificacaoIbsCbs,
  Cobranca,
  Contingencia,
  Crt,
  CstPisCofinsOutras,
  DadosNfe,
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
export type { CalculadoraIbsCbs, PedidoIbsCbsItem, PedidoIbsCbsNota, RespostaIbsCbs } from './ports.ts';
export { rotuloDoCaminho } from './rotulo.ts';
export type { CalculadoraIbsCbsOpcoes, GrupoIbsCbs } from './rtc.ts';
export { calculadoraIbsCbs, carregarDatasetEmbarcado, localDaOperacao } from './rtc.ts';
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
} from './services/client.ts';
export { autorizadorContingencia, criarClienteNfe } from './services/client.ts';
export { descomprimirGzipBase64 } from './services/gzip.ts';
export type { DocumentoAssinado } from './services/proc.ts';
export { documentoAssinado, nfeAssinadaDoProc, recortarElemento } from './services/proc.ts';
export type { RecuperacaoEvento } from './services/recuperar.ts';
export { recuperarEventoRegistrado } from './services/recuperar.ts';
export type { ConteudoDoProtocolo, ResolucaoEnvio } from './services/resolver.ts';
export { chaveDaDuplicidade, resolverEnvioSemResposta } from './services/resolver.ts';
export type { Instante } from './time.ts';
export { deslocamentoDaUf, formatarDh } from './time.ts';
