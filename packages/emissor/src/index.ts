/**
 * `@sinete/emissor`: a camada que emite, retoma e cancela documentos com estado entre chamadas (ADR 0010).
 *
 * A raiz tem o que é comum aos documentos e não importa nenhum pacote de documento: o desfecho normalizado, o
 * `TransmissaoStore` (bytes assinados gravados antes do envio, trava entre processos), a política dos bytes,
 * `retomarPendentes` para o job e o pool de emissores por certificado. Cada documento tem um subpath que importa o seu
 * pacote: `@sinete/emissor/nfe` (`criarEmissorNfe`), `/mdfe` e `/nfse`. O adaptador em memória está em
 * `@sinete/emissor/memoria` e a suíte de contrato do store em `@sinete/emissor/contrato`. `criarEmissor` com um perfil
 * próprio está em `@sinete/emissor/perfil`, experimental (ADR 0016).
 */

export type { AbrirCertificadoOpcoes, CertificadoA1, CertificadoAberto } from './certificado.ts';
export { abrirCertificado } from './certificado.ts';
export type {
  ContingenciaOpcoes,
  ContingenciaStore,
  EscopoContingencia,
  MudancaContingencia,
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
  DocumentoAssinado,
  Emissor,
  EmissorOpcoes,
  EmitirOpcoes,
  EntradaPreparada,
  GuardaOpcoes,
  JaGuardado,
  PrepararEntrada,
  RecusaRepetidaOpcoes,
  RetomarOpcoes,
  TravaOpcoes,
} from './emissor.ts';
export type { CodigoErroEmissor } from './erros.ts';
export {
  ErroRecusaRepetida,
  ErroTransmissaoEmAndamento,
  ErroTransmissaoJaGravada,
  ErroTravaPerdida,
} from './erros.ts';
export type { PoolDeEmissores, PoolOpcoes } from './pool.ts';
export { criarPoolDeEmissores } from './pool.ts';
export type {
  DesfechoRetomada,
  EmissorRetomavel,
  PoliticaRetomada,
  ResumoRetomada,
  RetomadaOpcoes,
} from './retomada.ts';
export { POLITICA_RETOMADA_PADRAO, retomarPendentes } from './retomada.ts';
export type { EnvioOpcoes } from './sinal.ts';
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
