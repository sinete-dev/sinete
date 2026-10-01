/**
 * O formato dos dados que este motor lê. O `@sinete/ibs-cbs` aceita qualquer `@sinete/ibs-cbs-dados` a partir de
 * `2026.9.2` (versão de calendário, ADR 0016), então um pacote de dados de um ano seguinte, com outro `versaoDoFormato`,
 * pode ser o instalado. O leitor do pacote de dados confere o formato contra a constante dele mesmo; quem garante que o
 * motor entende os dados é esta conferência, com o número que o motor conhece.
 */

import type { DatasetIbsCbs } from '@sinete/ibs-cbs-dados';
import { ErroDadosIbsCbs } from '@sinete/ibs-cbs-dados';

/** `versaoDoFormato` dos dados que este motor lê. Muda junto com o código, nunca importada do pacote de dados. */
export const FORMATO_DOS_DADOS_DO_MOTOR = 2;

/** Lança `ErroDadosIbsCbs` (`ibscbs_dados_versao_incompativel`) se o dataset não é do formato deste motor. */
export function exigirFormatoDosDados(dataset: DatasetIbsCbs): void {
  const v = dataset.manifesto.versaoDoFormato;
  if (v !== FORMATO_DOS_DADOS_DO_MOTOR) {
    throw new ErroDadosIbsCbs(
      'ibscbs_dados_versao_incompativel',
      `versaoDoFormato ${v} dos dados não é o que este @sinete/ibs-cbs lê (${FORMATO_DOS_DADOS_DO_MOTOR}); atualize os dois pacotes juntos`,
      { detalhes: { versaoDoFormato: v, suportada: FORMATO_DOS_DADOS_DO_MOTOR } },
    );
  }
}
