/**
 * Tabela de CFOP do Portal da NF-e (IT 2023.002): vigência e os indicadores que as regras de validação da SEFAZ
 * consultam (`indDevol` na I08-144, `indRetor` e `indRemes` na N12-70, `indExcIBSCBS` na I08-191). Dado gerado por
 * `tools/cfop-data` a partir da planilha oficial, com o sha256 conferido.
 */
import type { FonteDeDados } from '@sinete/core';
import table from './data/cfop.json' with { type: 'json' };

/** Indicadores e vigência de um CFOP, com os nomes das colunas da tabela oficial. */
export interface IndicadoresCfop {
  readonly cfop: string;
  /** `AAAA-MM-DD`. */
  readonly inicioVigencia: string;
  /** `AAAA-MM-DD`; ausente enquanto vigente. */
  readonly fimVigencia?: string;
  /** Permitido na NF-e e na NFC-e. */
  readonly indNFe: boolean;
  readonly indComunica: boolean;
  readonly indTransp: boolean;
  /** Devolução de mercadoria. */
  readonly indDevol: boolean;
  /** Retorno de mercadoria. */
  readonly indRetor: boolean;
  /** Anulação de valor. */
  readonly indAnula: boolean;
  /** Remessa de mercadoria. */
  readonly indRemes: boolean;
  /** Operação com combustível ou lubrificante, como na planilha (0, 1 ou 2). */
  readonly indComb: '0' | '1' | '2';
  /** Permitido na NF-e de contribuinte exclusivo do IBS/CBS (NT 2026.007). */
  readonly indExcIBSCBS: boolean;
}

export interface DescricaoTabelaCfop {
  readonly versaoDoFormato: number;
  readonly versao: string;
  readonly fontes: readonly FonteDeDados[];
  /** sha256 da planilha de onde a tabela saiu. */
  readonly sha256: string;
}

/** Metadados da tabela de CFOP: versão (data da coleta), fonte e sha256 da planilha. */
export const TABELA_CFOP: DescricaoTabelaCfop = {
  versaoDoFormato: table.versaoDoFormato,
  versao: table.versao,
  fontes: table.fontes,
  sha256: table.sha256,
};

const LINHAS = table.cfop as unknown as Readonly<Record<string, readonly [string, string | null, string]>>;

/**
 * Indicadores do CFOP (`'5202'`, `'5.202'`), ou `undefined` quando o código não está na tabela. Quem confere uma regra
 * da SEFAZ com o indicador não recusa o CFOP desconhecido: a tabela pode estar atrás da do Portal.
 */
export function indicadoresCfop(cfop: string): IndicadoresCfop | undefined {
  const codigo = cfop.replace(/\D/g, '');
  if (!/^\d{4}$/.test(codigo) || !Object.hasOwn(LINHAS, codigo)) return undefined;
  const linha = LINHAS[codigo];
  if (linha === undefined) return undefined;
  const [inicioVigencia, fim, ind] = linha;
  const bit = (k: number): boolean => ind[k] === '1';
  return {
    cfop: codigo,
    inicioVigencia,
    ...(fim === null ? {} : { fimVigencia: fim }),
    indNFe: bit(0),
    indComunica: bit(1),
    indTransp: bit(2),
    indDevol: bit(3),
    indRetor: bit(4),
    indAnula: bit(5),
    indRemes: bit(6),
    indComb: (ind[7] ?? '0') as IndicadoresCfop['indComb'],
    indExcIBSCBS: bit(8),
  };
}
