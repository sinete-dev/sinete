/**
 * `@sinete/core`: a base de todos os pacotes do sinete.
 *
 * Erros tipados, desfechos discriminados da SEFAZ, relógio injetável, logger estruturado, ambiente e tabela de UFs.
 * Sem dependências e sem API de runtime: roda igual em Node, Bun, Deno e no browser.
 */

export type { Ambiente, TpAmb } from './ambiente.ts';
export { AMBIENTES, ambienteDoTpAmb, ehAmbiente, tpAmbDoAmbiente } from './ambiente.ts';
export type { GrupoDeCaminho, TabelaDeRotulos } from './caminho.ts';
export { criarRotuloDoCaminho, normalizarCaminho } from './caminho.ts';
export type { ContextoDeTempo, InstanteInformado, Relogio, RelogioManual } from './clock.ts';
export { contextoDeTempo, formatarDataHoraComFuso, relogioDoSistema, relogioFixo, relogioManual } from './clock.ts';
export type {
  CodigoErroCore,
  CodigoErroSefaz,
  DetalhesDoErro,
  ErroSerializado,
  ErroSineteOpcoes,
  Ocorrencia,
  OrigemOcorrencia,
} from './errors.ts';
export {
  ErroDeConfiguracao,
  ErroDeTempoEsgotado,
  ErroDeValidacao,
  ErroNaoSuportado,
  ErroRespostaInvalida,
  ErroSefaz,
  ErroServicoNaoOferecido,
  ErroSinete,
  ehErroSinete,
  paginaDoErro,
} from './errors.ts';
export type { CamposDeLog, EntradaDeLog, Logger, LoggerEmMemoria, NivelDeLog } from './logger.ts';
export { loggerEmMemoria, loggerSilencioso } from './logger.ts';
export type {
  Autorizado,
  Denegado,
  DicaRejeicao,
  Pendente,
  Recusado,
  Resultado,
  ResultadoSefaz,
  StatusSefaz,
  TipoResultadoSefaz,
  TratadoresDeResultado,
} from './result.ts';
export {
  autorizado,
  criarAutorizado,
  criarDenegado,
  criarPendente,
  criarRecusado,
  denegado,
  ehCStat,
  exigirAutorizado,
  falha,
  ok,
  pendente,
  recusado,
  tratarResultado,
} from './result.ts';
export type {
  Assinador,
  AssinadorDeDados,
  AssinadorDeDigest,
  ContextoDaAssinatura,
  HashDaAssinatura,
  TipoAssinador,
} from './signer.ts';
export type { CUf, DescricaoTabelaUfs, FonteDeDados, Regiao, Uf, UnidadeFederativa } from './uf.ts';
export { ehCUf, ehUf, TABELA_UFS, UFS, ufPorCUf, ufPorSigla } from './uf.ts';
export { formatarVerProc } from './verproc.ts';
