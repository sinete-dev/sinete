/**
 * `@sinete/emissor`: a camada que emite, retoma e cancela documentos com estado entre chamadas (ADR 0010).
 *
 * A raiz tem o que é comum aos documentos e não importa nenhum pacote de documento: o desfecho normalizado, o
 * `TransmissaoStore` (bytes assinados gravados antes do envio, trava entre processos), a política dos bytes,
 * `createEmissor` com o perfil de um documento, `retomarPendentes` para o job e o pool de emissores por certificado.
 * Cada documento tem um subpath que importa o seu pacote: `@sinete/emissor/nfe` (`createNfeEmissor`), `/mdfe` e
 * `/nfse`. O adaptador em memória está em `@sinete/emissor/memoria` e a suíte de contrato do store em
 * `@sinete/emissor/contrato`.
 */

export type { CertificadoA1, CertificadoAberto, OpcoesAbrirCertificado } from './certificado.ts';
export { abrirCertificado } from './certificado.ts';
export type {
  ContingenciaAplicada,
  ContingenciaDoPerfil,
  ContingenciaDosBytes,
  ContingenciaStore,
  EscopoContingencia,
  MudancaContingencia,
  OpcoesContingencia,
  Sonda,
  SondaSvc,
} from './contingencia.ts';
export type {
  ConteudoRegistrado,
  Desfecho,
  DesfechoAutorizado,
  DesfechoDecidido,
  DesfechoDenegado,
  DesfechoDivergente,
  DesfechoEvento,
  DesfechoJaGuardado,
  DesfechoPendente,
  DesfechoRecusado,
  DestinoDosBytes,
  MotivoPendencia,
  SituacaoPosterior,
  TipoDocumento,
} from './desfecho.ts';
export { destinoDosBytes, semResposta } from './desfecho.ts';
export type {
  AoDecidir,
  ContextoEmissor,
  DocumentoAssinado,
  Emissor,
  EntradaPreparada,
  JaGuardado,
  ModoEnvio,
  OpcoesEmissor,
  OpcoesEmitir,
  OpcoesGuarda,
  OpcoesRecusaRepetida,
  OpcoesRetomar,
  OpcoesTrava,
  PerfilDocumento,
  PrepararEntrada,
} from './emissor.ts';
export { createEmissor } from './emissor.ts';
export type { EmissorErrorCode } from './erros.ts';
export {
  RecusaRepetidaError,
  TransmissaoEmAndamentoError,
  TransmissaoJaGravadaError,
  TravaPerdidaError,
} from './erros.ts';
export type { OpcoesPool, PoolDeEmissores } from './pool.ts';
export { createPoolDeEmissores } from './pool.ts';
export type {
  DesfechoRetomada,
  EmissorRetomavel,
  OpcoesRetomada,
  PoliticaRetomada,
  ResumoRetomada,
} from './retomada.ts';
export { POLITICA_RETOMADA_PADRAO, retomarPendentes } from './retomada.ts';
export type {
  EstadoContingencia,
  FiltroPendentes,
  GravacaoTransmissao,
  Instante,
  Recusa,
  RecusaRegistrada,
  RegistroTransmissao,
  TransmissaoStore,
  Trava,
} from './store.ts';
