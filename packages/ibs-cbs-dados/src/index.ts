/**
 * `@sinete/ibs-cbs-dados`: dados oficiais do IBS/CBS versionados, com leitor tipado e sem regra de negócio.
 *
 * O dataset vem do SQLite da Calculadora offline da RFB e das tabelas do IT 2025.002, fixados por hash e extraídos por
 * `tools/ibs-cbs-dados` (ADR 0007). Esta entrada tem o leitor, a aplicabilidade de NCM/NBS e o diff semântico; o dataset
 * embarcado está em `@sinete/ibs-cbs-dados/bundled`, e qualquer outro bundle compatível pode ser carregado em runtime com
 * `carregarDataset` (depois de `conferirDataset`, se veio de fora).
 */

export type { Aplicabilidade, ResultadoAplicabilidade } from './applicability.ts';
export { aplicabilidade } from './applicability.ts';
export { jsonCanonico, tabelaCanonica } from './canonical.ts';
export type { ConteudoTributario, CredPresVigente, DatasetIbsCbs, FiltroClassTrib, FiltroDeAtores } from './dataset.ts';
export {
  carregarDataset,
  conferirDataset,
  NOMES_DAS_TABELAS,
  VERSAO_DO_FORMATO_DOS_DADOS,
  versaoDoConteudo,
} from './dataset.ts';
export { DESLOCAMENTO_BRASILIA_MIN, dataCivil, ehDataIso, exigirDataIso, vigente } from './dates.ts';
export type {
  DiferencaDeDatasets,
  DiferencaDeTabela,
  MudancaDeCampo,
  MudancaDeRegistro,
  TipoDeMudanca,
} from './diff.ts';
export { compararDatasets, formatarDiferenca, tipoDeMudanca } from './diff.ts';
export type { CodigoErroDadosIbsCbs } from './errors.ts';
export { ErroDadosIbsCbs } from './errors.ts';
export type {
  AliquotasCredPres,
  BaseLegal,
  BaseLegalClassTrib,
  BundleDoDataset,
  CalculoCredPres,
  CreditoClassTrib,
  DataIso,
  Dec,
  ExcecaoDePrefixo,
  ExpressoesDoTratamento,
  Familia,
  FonteDoDataset,
  GruposClassTrib,
  GruposCredPres,
  GruposCst,
  IdDaFonte,
  Indicador,
  IndicadoresDoTratamento,
  ManifestoDaTabela,
  ManifestoDoDataset,
  NomeDaTabela,
  Nomenclatura,
  PapelDoAtor,
  PorTributo,
  RegistroAliquotaFixa,
  RegistroAnexo,
  RegistroAplicabilidade,
  RegistroAtor,
  RegistroAtorClassTrib,
  RegistroClassTrib,
  RegistroCredPres,
  RegistroCst,
  RegistroGrupoDeAtores,
  RegistroNfseNbs,
  RegistroReducao,
  RegistroRedutorCompraGov,
  RegistroTipoDfe,
  RegistroTransferenciaCbs,
  RegistroTratamento,
  TabelasDoDataset,
  TipoDeAliquota,
  Tributo,
  Vigencia,
  VinculoDfe,
  VinculoTratamento,
} from './types.ts';
