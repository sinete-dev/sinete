/**
 * Unidades da Federação e seus códigos IBGE (`cUF`), como dado versionado (princípio 4).
 *
 * A tabela vive em `data/ufs.json`, com fonte e data de coleta. O código nunca decide por sigla (`if (uf === 'MT')`):
 * quem precisa de um comportamento por UF consulta uma tabela de dados, como esta.
 */

import table from './data/ufs.json' with { type: 'json' };

/** Sigla de UF (tipo `TUf` do leiaute, sem `EX`). */
export type Uf =
  | 'AC'
  | 'AL'
  | 'AM'
  | 'AP'
  | 'BA'
  | 'CE'
  | 'DF'
  | 'ES'
  | 'GO'
  | 'MA'
  | 'MG'
  | 'MS'
  | 'MT'
  | 'PA'
  | 'PB'
  | 'PE'
  | 'PI'
  | 'PR'
  | 'RJ'
  | 'RN'
  | 'RO'
  | 'RR'
  | 'RS'
  | 'SC'
  | 'SE'
  | 'SP'
  | 'TO';

/** Código IBGE da UF, na forma lexical do leiaute (tipo `TCodUfIBGE`). */
export type CUf =
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '21'
  | '22'
  | '23'
  | '24'
  | '25'
  | '26'
  | '27'
  | '28'
  | '29'
  | '31'
  | '32'
  | '33'
  | '35'
  | '41'
  | '42'
  | '43'
  | '50'
  | '51'
  | '52'
  | '53';

export type Regiao = 'N' | 'NE' | 'SE' | 'S' | 'CO';

export interface UnidadeFederativa {
  readonly sigla: Uf;
  readonly cUF: CUf;
  readonly nome: string;
  readonly regiao: Regiao;
}

export interface FonteDeDados {
  readonly titulo: string;
  readonly url: string;
  readonly coletadoEm: string;
}

/** Metadados da tabela: versão (data da revisão), formato e fontes. */
export interface DescricaoTabelaUfs {
  readonly versaoDoFormato: number;
  readonly versao: string;
  readonly fontes: readonly FonteDeDados[];
}

export const TABELA_UFS: DescricaoTabelaUfs = {
  versaoDoFormato: table.versaoDoFormato,
  versao: table.versao,
  fontes: table.fontes,
};

/** As 27 UFs, na ordem do código IBGE. */
export const UFS: readonly UnidadeFederativa[] = table.ufs as readonly UnidadeFederativa[];

const bySigla: ReadonlyMap<string, UnidadeFederativa> = new Map(UFS.map((u) => [u.sigla, u]));
const byCUf: ReadonlyMap<string, UnidadeFederativa> = new Map(UFS.map((u) => [u.cUF, u]));

export function ehUf(value: unknown): value is Uf {
  return typeof value === 'string' && bySigla.has(value);
}

export function ehCUf(value: unknown): value is CUf {
  return typeof value === 'string' && byCUf.has(value);
}

/** Informações da UF pela sigla, ou `undefined` se a sigla não existe. */
export function ufPorSigla(sigla: string): UnidadeFederativa | undefined {
  return bySigla.get(sigla);
}

/** Informações da UF pelo código IBGE (`'35'`), ou `undefined` se o código não existe. */
export function ufPorCUf(cUF: string): UnidadeFederativa | undefined {
  return byCUf.get(cUF);
}
