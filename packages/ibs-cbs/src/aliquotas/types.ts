/** Tipos do `@sinete/ibs-cbs/aliquotas`. Datas são civis (`AAAA-MM-DD`) no tempo do fato gerador; decimais vêm como texto. */

export type DataIso = string;
export type Dec = string;

/**
 * Estado de uma alíquota:
 * - `oficial`: publicada em ato oficial (lei, resolução, tabela oficial), com a fonte citada;
 * - `informada`: informada pelo usuário (ex.: simulação de 2027 antes da resolução do Senado), com o motivo;
 * - `desconhecida`: ainda não publicada. Nunca vira zero nem um default silencioso.
 */
export type SituacaoDaAliquota = 'oficial' | 'informada' | 'desconhecida';

/** Tributo com alíquota nominal por ente. */
export type TributoDaAliquota = 'CBS' | 'IBSUF' | 'IBSMun';

export const TRIBUTOS_DAS_ALIQUOTAS: readonly TributoDaAliquota[] = ['CBS', 'IBSUF', 'IBSMun'];

export interface Vigencia {
  readonly inicio: DataIso;
  readonly fim: DataIso | null;
}

/** Local da operação para a alíquota por ente (a partir de 2029, cada UF e município fixa a sua). */
export interface Local {
  /** Sigla da UF. */
  readonly uf: string;
  /** Código IBGE do município, 7 dígitos. */
  readonly cMun: string;
}

export interface Aliquota {
  readonly tributo: TributoDaAliquota;
  readonly situacao: SituacaoDaAliquota;
  /** Percentual (`'0.9'` = 0,9%); `null` quando `desconhecida`. */
  readonly valor: Dec | null;
  /** Dispositivo legal (`LC 214/2025, art. 346`). */
  readonly legal?: string;
  /** Ids das fontes em `TabelaDeAliquotas.fontes`, ou `usuario` para alíquota informada. */
  readonly fontes: readonly string[];
  readonly nota?: string;
  /** Motivo declarado de uma alíquota `informada`. */
  readonly motivo?: string;
  /** Vigência do registro que respondeu. */
  readonly vigencia?: Vigencia;
}

/** As três alíquotas de uma operação. */
export interface AliquotasNominais {
  readonly CBS: Aliquota;
  readonly IBSUF: Aliquota;
  readonly IBSMun: Aliquota;
}

export interface FonteDaAliquota {
  readonly id: string;
  readonly titulo: string;
  readonly url: string;
  readonly versao?: string;
  readonly data?: DataIso;
  readonly sha256?: string;
}

export interface RegistroAliquotaDeReferencia {
  readonly tributo: TributoDaAliquota;
  readonly vigencia: Vigencia;
  readonly situacao: 'oficial' | 'desconhecida';
  readonly aliquota: Dec | null;
  readonly legal: string;
  readonly nota?: string;
  readonly fontes: readonly string[];
}

/** Alíquota própria de um ente (lei estadual ou municipal, art. 14 da LC 214/2025). */
export interface RegistroAliquotaPadrao {
  readonly tributo: 'IBSUF' | 'IBSMun';
  /** UF (IBSUF) ou código IBGE do município (IBSMun). */
  readonly ente: string;
  readonly vigencia: Vigencia;
  readonly aliquota: Dec;
  readonly legal: string;
  readonly fontes: readonly string[];
}

export interface TabelaDeAliquotas {
  readonly versaoDoFormato: number;
  readonly versaoDosDados: string;
  readonly conhecidoEm: DataIso;
  readonly fontes: readonly FonteDaAliquota[];
  readonly referencia: readonly RegistroAliquotaDeReferencia[];
  readonly padrao: readonly RegistroAliquotaPadrao[];
}

/** Fonte de alíquotas por data. `nominal` é a alíquota "padrão" do cClassTrib; `referencia`, a nacional uniforme. */
export interface ProvedorDeAliquotas {
  readonly id: string;
  /** Alíquota padrão do local: a do ente quando houver lei própria, senão a de referência. */
  nominal(data: DataIso, local?: Local): AliquotasNominais;
  /** Alíquota de referência nacional (cClassTrib com tipo "Uniforme nacional (referência)"). */
  referencia(data: DataIso): AliquotasNominais;
}

/** Alíquota informada pelo usuário, com motivo obrigatório. */
export interface AliquotaInformada {
  readonly tributo: TributoDaAliquota;
  readonly valor: Dec;
  readonly motivo: string;
  /** Vigência em que a sobreposição vale; sem ela, vale em qualquer data. */
  readonly vigencia?: Vigencia;
  /** Restringe a uma UF ou município; sem ela, vale em qualquer local. */
  readonly local?: { readonly uf?: string; readonly cMun?: string };
  /** Qual alíquota sobrepor; padrão: as duas. */
  readonly aplicaA?: 'nominal' | 'referencia' | 'ambas';
  /** Onde o usuário tirou o valor (link, ato). */
  readonly fonte?: string;
}
