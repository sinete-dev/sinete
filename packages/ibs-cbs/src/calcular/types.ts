/**
 * Tipos do `@sinete/ibs-cbs/calcular`.
 *
 * A entrada é uma operação já classificada (CST, cClassTrib e grupos informados por item): o motor não decide
 * classificação, só calcula. A saída (`Roc`) segue os nomes de grupos e campos da NT 2025.002 e do objeto que a
 * Calculadora da RFB devolve (`gIBSCBS`, `gIBSUF`, `gRed`, `gDif`, `gTribRegular`, `gTribCompraGov`, `IBSCBSTot`...),
 * com valores já formatados como no XML: texto decimal com 2 casas nos valores e de 2 a 4 casas nos percentuais.
 */
import type { SituacaoDaAliquota, TributoDaAliquota } from '../aliquotas/index.ts';

/** Decimal em texto (`'1000.00'`, `'0.9'`). */
export type Dec = string;

/** Data civil `AAAA-MM-DD`. */
export type DataIso = string;

/**
 * Tipo de ente governamental comprador (`tpEnteGov`): 1 União, 2 Estado, 3 Distrito Federal, 4 Município. A Calculadora
 * aceita ainda 5 (consórcio público) e 6 (Comitê Gestor do IBS), tratados como Município.
 */
export type TpEnteGov = 1 | 2 | 3 | 4 | 5 | 6;

export interface CompraGovernamental {
  readonly tpEnteGov: TpEnteGov;
  /** `tpOperGov`: 1 fornecimento, 2 recebimento do pagamento. Só é repassado para a saída. */
  readonly tpOperGov?: 1 | 2;
}

/** Local da operação (define as alíquotas próprias de UF e município, quando houver). */
export interface LocalDaOperacao {
  readonly uf: string;
  /** Código IBGE do município, 7 dígitos. */
  readonly cMun: string;
}

/** Alíquotas nominais informadas pelo usuário para o item, em percentual, com motivo obrigatório. */
export interface AliquotasInformadas {
  readonly CBS?: Dec;
  readonly IBSUF?: Dec;
  readonly IBSMun?: Dec;
  readonly motivo: string;
}

/** Grupo de tributação regular (`gTribRegular`), exigido pelos cClassTrib de suspensão e afins. */
export interface TributacaoRegular {
  readonly cst: string;
  readonly cClassTrib: string;
}

export interface CreditoPresumidoTributo {
  /** Percentual do crédito presumido. */
  readonly pCredPres: Dec;
  /** Crédito em condição suspensiva: o valor vai em `vCredPresCondSus` em vez de `vCredPres`. */
  readonly condicional?: boolean;
}

/** Crédito presumido da operação (`gCredPresOper`). */
export interface CreditoPresumido {
  readonly cCredPres: number;
  readonly vBCCredPres: Dec;
  readonly ibs?: CreditoPresumidoTributo;
  readonly cbs?: CreditoPresumidoTributo;
  /**
   * Fornecimento de bem móvel usado (`indBemMovelUsado=1` na NF-e): o crédito presumido vale mesmo com cClassTrib que o
   * veda (NT 2025.002 v1.51, UB120-20, exceção).
   */
  readonly bemMovelUsado?: boolean;
}

/** Crédito presumido do IBS na ZFM (`gCredPresIBSZFM`), com o valor apurado sobre o saldo devedor. */
export interface CreditoPresumidoZfm {
  /** Ano e mês de apuração, `AAAA-MM`. */
  readonly competApur: string;
  readonly tpCredPresIBSZFM: 0 | 1 | 2 | 3 | 4;
  readonly vCredPresIBSZFM: Dec;
}

/** Item classificado: tudo o que o cálculo precisa, sem fato de negócio (CFOP, cliente, descrição). */
export interface ItemClassificado {
  /** Número do item (`nItem`). */
  readonly n: number;
  readonly cst: string;
  readonly cClassTrib: string;
  /** Base de cálculo do IBS e da CBS (`vBC`) já apurada. A composição da UB16-10 ainda é "implementação futura". */
  readonly base: Dec;
  readonly quantidade?: Dec;
  readonly unidade?: string;
  readonly regular?: TributacaoRegular;
  readonly aliquotasInformadas?: AliquotasInformadas;
  /** Percentual de diferimento por tributo, sobrepondo o do tratamento tributário do cClassTrib. */
  readonly diferimento?: Partial<Record<TributoDaAliquota, Dec>>;
  /** Devolução de tributos (`gDevTrib`), só da CBS: percentual devolvido. */
  readonly devolucaoDeTributo?: { readonly pDevTrib: Dec };
  /** `gTransfCred`: valores transferidos (CST 800). */
  readonly transferenciaDeCredito?: { readonly vIBS: Dec; readonly vCBS: Dec };
  /** `gAjusteCompet`: ajuste de competência (CST 811). */
  readonly ajusteDeCompetencia?: { readonly competApur: string; readonly vIBS: Dec; readonly vCBS: Dec };
  /** `gEstornoCred`: estorno de crédito. */
  readonly estornoDeCredito?: { readonly vIBSEstCred: Dec; readonly vCBSEstCred: Dec };
  readonly creditoPresumido?: CreditoPresumido;
  readonly creditoZfm?: CreditoPresumidoZfm;
  /** Monofasia: não suportada; informar lança `ErroRegimeNaoSuportado`. */
  readonly monofasia?: unknown;
  /** Imposto Seletivo: não suportado; informar lança `ErroRegimeNaoSuportado`. */
  readonly impostoSeletivo?: unknown;
}

export interface OperacaoClassificada {
  /** Modelo do DF-e (`55` NF-e, `65` NFC-e, `57` CT-e...), usado para conferir a habilitação do cClassTrib. */
  readonly modelo: number;
  readonly local: LocalDaOperacao;
  readonly compraGovernamental?: CompraGovernamental;
  readonly itens: readonly ItemClassificado[];
}

// ---------- saída ----------

export interface GRed {
  readonly pRedAliq: Dec;
  readonly pAliqEfet: Dec;
}

export interface GDif {
  readonly pDif: Dec;
  readonly vDif: Dec;
}

export interface GDevTrib {
  readonly pDevTrib: Dec;
  readonly vDevTrib: Dec;
}

export interface GIBSUF {
  readonly pIBSUF: Dec;
  readonly gDif?: GDif;
  readonly gRed?: GRed;
  readonly vIBSUF: Dec;
}

export interface GIBSMun {
  readonly pIBSMun: Dec;
  readonly gDif?: GDif;
  readonly gRed?: GRed;
  readonly vIBSMun: Dec;
}

export interface GCBS {
  readonly pCBS: Dec;
  readonly gDif?: GDif;
  readonly gDevTrib?: GDevTrib;
  readonly gRed?: GRed;
  readonly vCBS: Dec;
}

export interface GTribRegular {
  readonly CSTReg: string;
  readonly cClassTribReg: string;
  readonly pAliqEfetRegIBSUF: Dec;
  readonly vTribRegIBSUF: Dec;
  readonly pAliqEfetRegIBSMun: Dec;
  readonly vTribRegIBSMun: Dec;
  readonly pAliqEfetRegCBS: Dec;
  readonly vTribRegCBS: Dec;
}

export interface GTribCompraGov {
  readonly pAliqIBSUF: Dec;
  readonly vTribIBSUF: Dec;
  readonly pAliqIBSMun: Dec;
  readonly vTribIBSMun: Dec;
  readonly pAliqCBS: Dec;
  readonly vTribCBS: Dec;
}

export interface GIBSCBS {
  readonly vBC: Dec;
  readonly gIBSUF: GIBSUF;
  readonly gIBSMun: GIBSMun;
  readonly vIBS: Dec;
  readonly gCBS: GCBS;
  readonly gTribRegular?: GTribRegular;
  readonly gTribCompraGov?: GTribCompraGov;
}

export interface GCredPresTributo {
  readonly pCredPres: Dec;
  readonly vCredPres?: Dec;
  readonly vCredPresCondSus?: Dec;
}

export interface GCredPresOper {
  readonly vBCCredPres: Dec;
  readonly cCredPres: number;
  readonly gIBSCredPres?: GCredPresTributo;
  readonly gCBSCredPres?: GCredPresTributo;
}

export interface GCredPresIBSZFM {
  readonly competApur: string;
  readonly tpCredPresIBSZFM: number;
  readonly vCredPresIBSZFM: Dec;
}

/** Grupo `IBSCBS` do item. Os grupos de escolha exclusiva (UB14k) seguem os indicadores da CST. */
export interface IBSCBS {
  readonly CST: string;
  readonly cClassTrib: string;
  readonly gIBSCBS?: GIBSCBS;
  readonly gTransfCred?: { readonly vIBS: Dec; readonly vCBS: Dec };
  readonly gAjusteCompet?: { readonly competApur: string; readonly vIBS: Dec; readonly vCBS: Dec };
  readonly gEstornoCred?: { readonly vIBSEstCred: Dec; readonly vCBSEstCred: Dec };
  readonly gCredPresOper?: GCredPresOper;
  readonly gCredPresIBSZFM?: GCredPresIBSZFM;
}

/** De onde veio a alíquota usada para um tributo. */
export type OrigemDaAliquota =
  | 'provedor-nominal'
  | 'provedor-referencia'
  | 'dataset-fixa'
  | 'informada'
  | 'sem-aliquota';

export interface AliquotaAplicada {
  readonly tributo: TributoDaAliquota;
  /** Percentual nominal. */
  readonly valor: Dec;
  readonly situacao: SituacaoDaAliquota;
  readonly origem: OrigemDaAliquota;
  readonly legal?: string;
  readonly motivo?: string;
}

export interface RocItem {
  readonly nItem: number;
  readonly IBSCBS: IBSCBS;
  /** Alíquotas usadas, por tributo (vazio quando o item não tem `gIBSCBS`). */
  readonly aliquotas: readonly AliquotaAplicada[];
  /** Alguma alíquota usada não é oficial (informada pelo usuário). */
  readonly simulado: boolean;
}

export interface IBSCBSTot {
  readonly vBCIBSCBS: Dec;
  readonly gIBS: {
    readonly gIBSUF: { readonly vDif: Dec; readonly vDevTrib: Dec; readonly vIBSUF: Dec };
    readonly gIBSMun: { readonly vDif: Dec; readonly vDevTrib: Dec; readonly vIBSMun: Dec };
    readonly vIBS: Dec;
    readonly vCredPres: Dec;
    readonly vCredPresCondSus: Dec;
  };
  readonly gCBS: {
    readonly vDif: Dec;
    readonly vDevTrib: Dec;
    readonly vCBS: Dec;
    readonly vCredPres: Dec;
    readonly vCredPresCondSus: Dec;
  };
  readonly gEstornoCred?: { readonly vIBSEstCred: Dec; readonly vCBSEstCred: Dec };
}

/** Uma conta do cálculo, com as entradas em precisão interna (8 casas), para auditoria. */
export interface EntradaDoRastro {
  readonly item: number;
  readonly tributo?: TributoDaAliquota;
  readonly campo: string;
  readonly formula: string;
  readonly entradas: Readonly<Record<string, string>>;
  readonly resultado: string;
}

export interface Roc {
  /** Data civil do fato gerador usada para dados e alíquotas. */
  readonly dataDeReferencia: DataIso;
  readonly oper?: {
    readonly gCompraGov: { readonly tpEnteGov: TpEnteGov; readonly pRedutor: Dec; readonly tpOperGov?: 1 | 2 };
  };
  readonly itens: readonly RocItem[];
  readonly total: { readonly IBSCBSTot: IBSCBSTot };
  readonly simulado: boolean;
  /** `DatasetIbsCbs.versaoDoConteudo` dos dados usados. */
  readonly versaoDoConteudo: string;
  /** Identificador do provedor de alíquotas. */
  readonly idDasAliquotas: string;
  readonly rastro: readonly EntradaDoRastro[];
}
