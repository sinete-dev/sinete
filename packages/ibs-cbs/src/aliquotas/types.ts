/** Tipos do `@sinete/ibs-cbs/aliquotas`. Datas são civis (`AAAA-MM-DD`) no tempo do fato gerador; decimais vêm como texto. */

export type IsoDate = string;
export type Dec = string;

/**
 * Estado de uma alíquota:
 * - `official`: publicada em ato oficial (lei, resolução, tabela oficial), com a fonte citada;
 * - `user-provided`: informada pelo usuário (ex.: simulação de 2027 antes da resolução do Senado), com o motivo;
 * - `unknown`: ainda não publicada. Nunca vira zero nem um default silencioso.
 */
export type RateStatus = 'official' | 'user-provided' | 'unknown';

/** Tributo com alíquota nominal por ente. */
export type RateTributo = 'CBS' | 'IBSUF' | 'IBSMun';

export const RATE_TRIBUTOS: readonly RateTributo[] = ['CBS', 'IBSUF', 'IBSMun'];

export interface Validity {
  readonly from: IsoDate;
  readonly to: IsoDate | null;
}

/** Local da operação para a alíquota por ente (a partir de 2029, cada UF e município fixa a sua). */
export interface Place {
  /** Sigla da UF. */
  readonly uf: string;
  /** Código IBGE do município, 7 dígitos. */
  readonly cMun: string;
}

export interface Rate {
  readonly tributo: RateTributo;
  readonly status: RateStatus;
  /** Percentual (`'0.9'` = 0,9%); `null` quando `unknown`. */
  readonly value: Dec | null;
  /** Dispositivo legal (`LC 214/2025, art. 346`). */
  readonly legal?: string;
  /** Ids das fontes em `RatesTable.sources`, ou `user` para alíquota informada. */
  readonly sources: readonly string[];
  readonly note?: string;
  /** Motivo declarado de uma alíquota `user-provided`. */
  readonly reason?: string;
  /** Vigência do registro que respondeu. */
  readonly validity?: Validity;
}

/** As três alíquotas de uma operação. */
export interface NominalRates {
  readonly CBS: Rate;
  readonly IBSUF: Rate;
  readonly IBSMun: Rate;
}

export interface RateSource {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly version?: string;
  readonly date?: IsoDate;
  readonly sha256?: string;
}

export interface ReferenceRateRecord {
  readonly tributo: RateTributo;
  readonly validity: Validity;
  readonly status: 'official' | 'unknown';
  readonly rate: Dec | null;
  readonly legal: string;
  readonly note?: string;
  readonly sources: readonly string[];
}

/** Alíquota própria de um ente (lei estadual ou municipal, art. 14 da LC 214/2025). */
export interface StandardRateRecord {
  readonly tributo: 'IBSUF' | 'IBSMun';
  /** UF (IBSUF) ou código IBGE do município (IBSMun). */
  readonly ente: string;
  readonly validity: Validity;
  readonly rate: Dec;
  readonly legal: string;
  readonly sources: readonly string[];
}

export interface RatesTable {
  readonly schemaVersion: number;
  readonly dataVersion: string;
  readonly knownAt: IsoDate;
  readonly sources: readonly RateSource[];
  readonly reference: readonly ReferenceRateRecord[];
  readonly standard: readonly StandardRateRecord[];
}

/** Fonte de alíquotas por data. `nominal` é a alíquota "padrão" do cClassTrib; `reference`, a nacional uniforme. */
export interface RateProvider {
  readonly id: string;
  /** Alíquota padrão do local: a do ente quando houver lei própria, senão a de referência. */
  nominal(date: IsoDate, place?: Place): NominalRates;
  /** Alíquota de referência nacional (cClassTrib com tipo "Uniforme nacional (referência)"). */
  reference(date: IsoDate): NominalRates;
}

/** Alíquota informada pelo usuário, com motivo obrigatório. */
export interface RateOverride {
  readonly tributo: RateTributo;
  readonly value: Dec;
  readonly reason: string;
  /** Vigência em que a sobreposição vale; sem ela, vale em qualquer data. */
  readonly validity?: Validity;
  /** Restringe a uma UF ou município; sem ela, vale em qualquer local. */
  readonly place?: { readonly uf?: string; readonly cMun?: string };
  /** Qual alíquota sobrepor; padrão: as duas. */
  readonly applies?: 'nominal' | 'reference' | 'both';
  /** Onde o usuário tirou o valor (link, ato). */
  readonly source?: string;
}
