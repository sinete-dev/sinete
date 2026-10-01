/**
 * `@sinete/nfe/ibs-cbs`: tudo o que quem emite NF-e precisa do IBS/CBS, sem importar `@sinete/ibs-cbs` nem
 * `@sinete/ibs-cbs-dados` diretamente.
 *
 * Reexporta o motor inteiro (`@sinete/ibs-cbs`: alíquotas, cálculo, regras da NT 2025.002 e determinação de CST e
 * cClassTrib) e o leitor do dataset (`@sinete/ibs-cbs-dados`: `carregarDataset`, `conferirDataset`, diff, tipos). O dataset
 * embarcado não entra aqui, para não ir para o bundle de quem não o usa: `carregarDatasetEmbarcado()`, na raiz do
 * `@sinete/nfe`, o importa sob demanda. `Dec`, `DataIso` e `Vigencia` vêm do motor (os de `Dec` e `DataIso` são os
 * mesmos; a `Vigencia` dos dados, com os campos do dataset, fica acessível pelos tipos que a usam).
 *
 * Experimental (ADR 0016, seção 5) até o `@sinete/ibs-cbs` sair 1.0: a calculadora espera a norma da base de cálculo
 * (NT 2025.002, UB16-10), e este subpath pode mudar em minor, sempre com changeset.
 *
 * @experimental
 */

// biome-ignore lint/performance/noReExportAll: o subpath existe para reexportar o motor inteiro, e as duas pontas são do mesmo repo.
export * from '@sinete/ibs-cbs';
export type {
  AliquotasCredPres,
  Aplicabilidade,
  BaseLegal,
  BaseLegalClassTrib,
  BundleDoDataset,
  CalculoCredPres,
  CodigoErroDadosIbsCbs,
  ConteudoTributario,
  CreditoClassTrib,
  CredPresVigente,
  DatasetIbsCbs,
  DiferencaDeDatasets,
  DiferencaDeTabela,
  ExcecaoDePrefixo,
  ExpressoesDoTratamento,
  Familia,
  FiltroClassTrib,
  FiltroDeAtores,
  FonteDoDataset,
  GruposClassTrib,
  GruposCredPres,
  GruposCst,
  IdDaFonte,
  Indicador,
  IndicadoresDoTratamento,
  ManifestoDaTabela,
  ManifestoDoDataset,
  MudancaDeCampo,
  MudancaDeRegistro,
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
  ResultadoAplicabilidade,
  TabelasDoDataset,
  TipoDeAliquota,
  TipoDeMudanca,
  Tributo,
  VinculoDfe,
  VinculoTratamento,
} from '@sinete/ibs-cbs-dados';
export {
  aplicabilidade,
  carregarDataset,
  compararDatasets,
  conferirDataset,
  DESLOCAMENTO_BRASILIA_MIN,
  dataCivil,
  ErroDadosIbsCbs,
  ehDataIso,
  exigirDataIso,
  formatarDiferenca,
  jsonCanonico,
  NOMES_DAS_TABELAS,
  tabelaCanonica,
  tipoDeMudanca,
  VERSAO_DO_FORMATO_DOS_DADOS,
  versaoDoConteudo,
  vigente,
} from '@sinete/ibs-cbs-dados';
