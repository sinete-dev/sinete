/**
 * Tipos do `@sinete/ibs-cbs/validar`.
 *
 * O documento validado é a parte de IBS/CBS de uma NF-e ou NFC-e: identificação mínima (modelo, CRT, finalidade, tipo
 * de nota de débito ou crédito), itens com o grupo `IBSCBS` no formato do `@sinete/ibs-cbs/calcular` e o total `IBSCBSTot`.
 * Serve tanto para conferir o `Roc` que o motor gerou (`documentoDoRoc`) quanto um XML lido de fora.
 */
import type { DataIso, IBSCBS, IBSCBSTot, TpEnteGov } from '../calcular/index.ts';

export type Dec = string;
export type Modelo = 55 | 65;
export type Ambiente = 'producao' | 'homologacao';

export interface ItemDasRegras {
  readonly nItem: number;
  readonly IBSCBS?: IBSCBS;
  /** NCM do produto (UB56-10, exceção 3). */
  readonly ncm?: string;
  /** Valor do produto (UB125-10 e UB129-10). */
  readonly vProd?: Dec;
  /** Combustível da tabela de tributação monofásica (UB12-10, exceção 2). */
  readonly combustivelMonofasico?: boolean;
  /** `indBemMovelUsado=1` (UB120-20, exceção). */
  readonly bemMovelUsado?: boolean;
}

export interface DocumentoDasRegras {
  readonly modelo: Modelo;
  /** Código de Regime Tributário do emitente (1, 2 e 4 Simples Nacional e MEI; 3 regime normal). */
  readonly crt: 1 | 2 | 3 | 4;
  /** `finNFe`: 1 normal, 2 complementar, 3 ajuste, 4 devolução, 5 nota de crédito, 6 nota de débito. */
  readonly finNFe: 1 | 2 | 3 | 4 | 5 | 6;
  readonly tpNFDebito?: string;
  readonly tpNFCredito?: string;
  /** Data de emissão da NF-e referenciada, na devolução ou complementar (UB12-10, exceção 1). */
  readonly emissaoReferenciada?: DataIso;
  /** Município do emitente e do destinatário, código IBGE (UB56-10, exceção 3). */
  readonly munEmitente?: string;
  readonly munDestinatario?: string;
  readonly gCompraGov?: { readonly tpEnteGov: TpEnteGov; readonly pRedutor: Dec; readonly tpOperGov?: 1 | 2 };
  readonly itens: readonly ItemDasRegras[];
  readonly IBSCBSTot?: IBSCBSTot;
}

/** A partir de quando a regra vale, por ambiente, pela data de emissão. */
export interface Ativacao {
  readonly homologacao: DataIso;
  readonly producao: DataIso;
  /** Só para estes CRT (UB12-10). */
  readonly crt?: readonly (1 | 2 | 3 | 4)[];
}

export interface DescricaoDaRegra {
  /** Identificador da NT (`UB35-10`). */
  readonly id: string;
  /** Código de rejeição (`1041`). */
  readonly cStat: string;
  /** Descrição curta do que a regra confere. */
  readonly titulo: string;
  readonly modelos: readonly Modelo[];
  /** Uma ou mais janelas: a primeira que casar com o CRT vale. */
  readonly ativacao: readonly Ativacao[];
  /** `NT 2025.002 v1.51, UB35-10`. */
  readonly fonte: string;
  /** Interpretação adotada onde o texto da NT não fecha a questão. */
  readonly nota?: string;
}

export interface Violacao {
  readonly regra: string;
  readonly cStat: string;
  readonly item?: number;
  /** O que foi encontrado, em português, com os valores. */
  readonly message: string;
  readonly fonte: string;
}

/** Regra da NT que este pacote não confere, com o motivo. */
export interface NaoImplementada {
  readonly id: string;
  readonly motivo: string;
}

export interface RelatorioDeValidacao {
  readonly violacoes: readonly Violacao[];
  /** Regras avaliadas (ativas na data, no ambiente, no modelo e no CRT). */
  readonly avaliadas: readonly string[];
  /** Regras fora da vigência de implantação na data de emissão, ou de outro modelo ou CRT. */
  readonly inativas: readonly string[];
  /** Data civil de emissão usada para a implantação e para as regras que dependem do ano de emissão. */
  readonly dataDaEmissao: DataIso;
  /** Data civil do fato gerador usada para as tabelas. */
  readonly dataDoFato: DataIso;
}

/** Tabelas próprias da NT 2025.002 embarcadas no pacote (`TABELAS_NT`). */
export interface TabelasNt {
  readonly fonte: {
    readonly id: string;
    readonly titulo: string;
    readonly versao: string;
    readonly publicadaEm: string;
    readonly url: string;
    readonly sha256: string;
  };
  /** Tipos de nota de débito (`tpNFDebito`) e o cClassTrib que cada um exige (`null`: qualquer um). */
  readonly tpNFDebito: readonly {
    readonly codigo: string;
    readonly descricao: string;
    readonly cClassTrib: string | null;
  }[];
  readonly tpNFCredito: readonly {
    readonly codigo: string;
    readonly descricao: string;
    readonly cClassTrib: string | null;
  }[];
  /** cClassTrib que só cabem em nota de débito ou crédito do tipo indicado (UB14-60). */
  readonly classTribPorTipoDeNota: readonly {
    readonly cClassTrib: string;
    readonly tpNFDebito: string | null;
    readonly tpNFCredito: string | null;
  }[];
  /** Alíquotas exigidas por ano de emissão (`null`: a NT não fixa). */
  readonly aliquotasPorAnoDeEmissao: readonly {
    readonly inicio: number;
    readonly fim: number;
    readonly pIBSUF: Dec | null;
    readonly pIBSMun: Dec | null;
    readonly pCBS: Dec | null;
    readonly legal: string;
  }[];
  /** Municípios da ZFM e das áreas de livre comércio. */
  readonly areasIncentivadas: readonly { readonly area: string; readonly municipios: readonly string[] }[];
  readonly ncmExcluidosDaCbsZero: {
    readonly prefixos: readonly string[];
    readonly permitidoDentroDe: readonly string[];
    readonly nota: string;
  };
}
