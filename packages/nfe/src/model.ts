/**
 * Modelo de entrada da NF-e: o que quem emite descreve. O builder (`buildNfe`) transforma isto no objeto tipado do
 * `@sinete/schemas` do pacote de liberação vigente, calcula os valores derivados e os totais em decimal exato e
 * confere as regras antes de qualquer serialização.
 *
 * Convenções:
 * - Nomes de campo do leiaute (MOC) onde eles existem (`xNome`, `NCM`, `CFOP`, `qCom`, `pICMS`); nomes em português
 *   para os agrupamentos que o leiaute não nomeia (`emitente`, `itens`, `pagamento`).
 * - Números entram como `DecimalInput` (`'12.34'`, `12.34`, `12n` ou `Decimal`). Prefira texto: `number` perde dígitos
 *   acima de 15 algarismos. Nada é convertido para ponto flutuante nas contas.
 * - Valores derivados (`vProd`, `vICMS`, `vPIS`, totais) são opcionais: omitidos, o builder calcula; informados, o
 *   builder usa o valor dado e confere a coerência com tolerância de R$ 0,01 (a mesma das regras de validação).
 * - Códigos do leiaute ficam como uniões de literais (`CST: '00'`), com constantes nomeadas onde ajudam
 *   (`MotivoDesoneracaoIcms`, `TipoPagamento`).
 * - Grupos raros ou puramente informativos (veículo novo, medicamento, combustível, DI, exportação, rastro, cana,
 *   monofasia do IBS/CBS) entram já no tipo gerado do schema, sem tradução: o builder só os repassa.
 */

import type { Uf } from '@sinete/core';
import type {
  TCIBS_NFe,
  TIS,
  TMonofasia,
  TNFe_infNFe_agropecuario,
  TNFe_infNFe_cana,
  TNFe_infNFe_compra,
  TNFe_infNFe_det_obsItem,
  TNFe_infNFe_det_prod_arma,
  TNFe_infNFe_det_prod_comb,
  TNFe_infNFe_det_prod_DI,
  TNFe_infNFe_det_prod_detExport,
  TNFe_infNFe_det_prod_gCred,
  TNFe_infNFe_det_prod_infProdEmb,
  TNFe_infNFe_det_prod_infProdNFF,
  TNFe_infNFe_det_prod_med,
  TNFe_infNFe_det_prod_rastro,
  TNFe_infNFe_det_prod_veicProd,
  TNFe_infNFe_exporta,
  TNFe_infNFe_ide_NFref_refECF,
  TNFe_infNFe_ide_NFref_refNF,
  TNFe_infNFe_infAdic_obsCont,
  TNFe_infNFe_infAdic_obsFisco,
  TNFe_infNFe_infAdic_procRef,
  TNFe_infNFe_infIntermed,
  TNFe_infNFe_pag_detPag_card,
  TTribNFe,
  TVeiculo,
} from '@sinete/schemas/nfe/PL_010f';
import type { DecimalInput } from './decimal.ts';
import type { Instante } from './time.ts';

// ---------------------------------------------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------------------------------------------

/** CNPJ (numérico ou alfanumérico) ou CPF, exclusivos. Aceitam máscara; o builder normaliza. */
export type DocumentoPessoa =
  | { readonly CNPJ: string; readonly CPF?: never }
  | { readonly CPF: string; readonly CNPJ?: never };

/** Endereço no Brasil (`TEnderEmi`, `TEndereco`, `TLocal`). */
export interface Endereco {
  readonly xLgr: string;
  readonly nro: string;
  readonly xCpl?: string;
  readonly xBairro: string;
  /** Código IBGE do município, 7 dígitos. */
  readonly cMun: string;
  readonly xMun: string;
  readonly UF: Uf;
  /** 8 dígitos, com ou sem máscara. */
  readonly CEP?: string;
  /** DDD + número, só dígitos (6 a 14). */
  readonly fone?: string;
}

/** Endereço de destinatário no exterior: o leiaute usa `cMun` 9999999, `xMun` EXTERIOR e `UF` EX. */
export interface EnderecoExterior {
  readonly exterior: true;
  readonly xLgr: string;
  readonly nro: string;
  readonly xCpl?: string;
  readonly xBairro: string;
  /** Código do país (tabela do BACEN, até 4 dígitos). */
  readonly cPais: string;
  readonly xPais: string;
  readonly fone?: string;
}

/** Código de Regime Tributário (C21): 1 Simples Nacional; 2 Simples com excesso de sublimite; 3 Regime Normal; 4 MEI. */
export type Crt = '1' | '2' | '3' | '4';

/** Emitente (grupo C). Produtor rural pessoa física emite com CPF, nas séries 920 a 969. */
export type Emitente = DocumentoPessoa & {
  readonly xNome: string;
  readonly xFant?: string;
  /** No emitente o CEP é obrigatório (`TEnderEmi`). */
  readonly endereco: Endereco & { readonly CEP: string };
  /** Inscrição estadual; `ISENTO` só na NF-e avulsa (RV C17-30). Opcional a partir do PL_010f (NT 2026.007). */
  readonly IE?: string;
  /** IE do substituto tributário na UF de destino. */
  readonly IEST?: string;
  readonly IM?: string;
  readonly CNAE?: string;
  readonly CRT: Crt;
  readonly ISUFEmit?: string;
};

/**
 * Indicador da IE do destinatário (E16a): 1 contribuinte do ICMS; 2 contribuinte isento de inscrição (não informar a
 * IE); 9 não contribuinte.
 */
export type IndIEDest = '1' | '2' | '9';

/** Destinatário (grupo E). No exterior, `idEstrangeiro` no lugar do CNPJ/CPF. */
export type Destinatario = (
  | DocumentoPessoa
  | { readonly idEstrangeiro: string; readonly CNPJ?: never; readonly CPF?: never }
) & {
  readonly xNome?: string;
  readonly endereco?: Endereco | EnderecoExterior;
  readonly indIEDest: IndIEDest;
  readonly IE?: string;
  readonly ISUF?: string;
  readonly IM?: string;
  readonly email?: string;
};

/** Local de retirada ou de entrega (grupos F e G), quando diferente do endereço do emitente ou destinatário. */
export type Local = DocumentoPessoa &
  Endereco & {
    readonly xNome?: string;
    readonly email?: string;
    readonly IE?: string;
  };

// ---------------------------------------------------------------------------------------------------------------
// Documentos referenciados
// ---------------------------------------------------------------------------------------------------------------

/**
 * NF de produtor em papel (modelo 04) ou avulsa (01) referenciada (BA10). O modelo 04 foi extinto pelo Ajuste
 * SINIEF 10/2022; o builder só aceita a referência a notas emitidas antes do fim da vigência (`data/produtor-rural.json`).
 */
export type RefNfp = DocumentoPessoa & {
  readonly cUF: string;
  /** Ano e mês da emissão da nota referenciada, `AAMM`. */
  readonly AAMM: string;
  /** IE do produtor ou `ISENTO`. */
  readonly IE: string;
  readonly mod: '01' | '04';
  readonly serie: string | number;
  readonly nNF: string | number;
};

/** Documento referenciado no nível da nota (grupo BA). */
export type Referenciada =
  | { readonly refNFe: string }
  | { readonly refNFeSig: string }
  | { readonly refNF: TNFe_infNFe_ide_NFref_refNF }
  | { readonly refNFP: RefNfp }
  | { readonly refCTe: string }
  | { readonly refECF: TNFe_infNFe_ide_NFref_refECF };

// ---------------------------------------------------------------------------------------------------------------
// Produto
// ---------------------------------------------------------------------------------------------------------------

/** Grupo específico do produto (choice do grupo I): no máximo um. Repassado como veio. */
export type ProdutoEspecifico =
  | { readonly veicProd: TNFe_infNFe_det_prod_veicProd }
  | { readonly med: TNFe_infNFe_det_prod_med }
  | { readonly arma: readonly TNFe_infNFe_det_prod_arma[] }
  | { readonly comb: TNFe_infNFe_det_prod_comb }
  | { readonly nRECOPI: string };

/** Produto ou serviço do item (grupo I). */
export interface Produto {
  readonly cProd: string;
  /** GTIN; padrão `SEM GTIN`. */
  readonly cEAN?: string;
  readonly cBarra?: string;
  readonly xProd: string;
  /** NCM de 8 dígitos (ou só o capítulo, 2 dígitos, fora do comércio exterior). */
  readonly NCM: string;
  readonly NVE?: readonly string[];
  readonly CEST?: string;
  readonly indEscala?: 'S' | 'N';
  readonly CNPJFab?: string;
  readonly cBenef?: string;
  readonly gCred?: readonly TNFe_infNFe_det_prod_gCred[];
  readonly tpCredPresIBSZFM?: '0' | '1' | '2' | '3' | '4';
  readonly EXTIPI?: string;
  /** CFOP de 4 dígitos. */
  readonly CFOP: string;
  /** Unidade comercial (até 6 caracteres). */
  readonly uCom: string;
  /** Quantidade comercial, até 4 casas. */
  readonly qCom: DecimalInput;
  /** Valor unitário comercial, até 10 casas. */
  readonly vUnCom: DecimalInput;
  /** Valor bruto; padrão `qCom × vUnCom` arredondado em 2 casas. */
  readonly vProd?: DecimalInput;
  /** GTIN da unidade tributável; padrão igual a `cEAN`. */
  readonly cEANTrib?: string;
  readonly cBarraTrib?: string;
  /** Unidade tributável; padrão igual a `uCom`. */
  readonly uTrib?: string;
  /** Quantidade tributável; padrão igual a `qCom`. */
  readonly qTrib?: DecimalInput;
  /** Valor unitário tributável; padrão `vUnCom` quando unidade e quantidade coincidem, senão `vProd / qTrib`. */
  readonly vUnTrib?: DecimalInput;
  readonly vFrete?: DecimalInput;
  readonly vSeg?: DecimalInput;
  /** Desconto incondicional do item. */
  readonly vDesc?: DecimalInput;
  readonly vOutro?: DecimalInput;
  /** 1 (padrão): o valor do item compõe o total da nota; 0: não compõe. */
  readonly indTot?: '0' | '1';
  readonly indBemMovelUsado?: '1';
  readonly DI?: readonly TNFe_infNFe_det_prod_DI[];
  readonly detExport?: readonly TNFe_infNFe_det_prod_detExport[];
  readonly xPed?: string;
  readonly nItemPed?: string;
  readonly nFCI?: string;
  readonly rastro?: readonly TNFe_infNFe_det_prod_rastro[];
  readonly infProdNFF?: TNFe_infNFe_det_prod_infProdNFF;
  readonly infProdEmb?: TNFe_infNFe_det_prod_infProdEmb;
  readonly especifico?: ProdutoEspecifico;
}

// ---------------------------------------------------------------------------------------------------------------
// ICMS
// ---------------------------------------------------------------------------------------------------------------

/** Origem da mercadoria (N11, `Torig`): 0 nacional; 1 e 2 estrangeira; 3 a 8 conforme conteúdo de importação. */
export type Origem = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

/** Modalidade da BC do ICMS (N13): 0 MVA; 1 pauta; 2 preço tabelado máximo; 3 valor da operação. */
export type ModBC = '0' | '1' | '2' | '3';

/** Modalidade da BC do ICMS ST (N18): 0 preço tabelado; 1 lista negativa; 2 positiva; 3 neutra; 4 MVA; 5 pauta; 6 valor da operação. */
export type ModBCST = '0' | '1' | '2' | '3' | '4' | '5' | '6';

/**
 * Motivo da desoneração do ICMS (N28), com os nomes das tabelas do leiaute. Cada CST aceita um subconjunto (o tipo de
 * cada grupo restringe): CST 20 e 70 e 90: 3, 9, 10, 11, 12 (20) ou 3, 9, 12; CST 30: 6, 7, 9; CST 40/41/50: 1, 3, 4, 5,
 * 6, 7, 8, 9, 10, 11, 16, 90; partilha: 9, 10, 11.
 */
export const MotivoDesoneracaoIcms: {
  readonly TAXI: '1';
  readonly AGROPECUARIA: '3';
  readonly FROTISTA_LOCADORA: '4';
  readonly DIPLOMATICO_CONSULAR: '5';
  readonly UTILITARIOS_MOTOCICLETAS_AMAZONIA_ALC: '6';
  readonly SUFRAMA: '7';
  readonly VENDA_ORGAO_PUBLICO: '8';
  readonly OUTROS: '9';
  readonly DEFICIENTE_CONDUTOR: '10';
  readonly DEFICIENTE_NAO_CONDUTOR: '11';
  readonly FOMENTO_AGROPECUARIO: '12';
  readonly OLIMPIADAS_RIO_2016: '16';
  readonly SOLICITADO_PELO_FISCO: '90';
} = {
  TAXI: '1',
  AGROPECUARIA: '3',
  FROTISTA_LOCADORA: '4',
  DIPLOMATICO_CONSULAR: '5',
  UTILITARIOS_MOTOCICLETAS_AMAZONIA_ALC: '6',
  SUFRAMA: '7',
  VENDA_ORGAO_PUBLICO: '8',
  OUTROS: '9',
  DEFICIENTE_CONDUTOR: '10',
  DEFICIENTE_NAO_CONDUTOR: '11',
  FOMENTO_AGROPECUARIO: '12',
  OLIMPIADAS_RIO_2016: '16',
  SOLICITADO_PELO_FISCO: '90',
};

export type MotivoDesoneracaoIcms = (typeof MotivoDesoneracaoIcms)[keyof typeof MotivoDesoneracaoIcms];

/** Desoneração do ICMS: valor e motivo andam juntos (RV N27a/N28). */
export interface Desoneracao<M extends MotivoDesoneracaoIcms> {
  readonly vICMSDeson: DecimalInput;
  readonly motDesICMS: M;
  /** 1: o desonerado deduz do valor do item e do total (NT 2023.004); 0 ou ausente: não deduz. */
  readonly indDeduzDeson?: '0' | '1';
}

/** Desoneração do ICMS-ST (N33a/N33b): 3 uso na agropecuária; 9 outros; 12 fomento agropecuário. */
export interface DesoneracaoSt {
  readonly vICMSSTDeson: DecimalInput;
  readonly motDesICMSST: '3' | '9' | '12';
}

/** Parte própria do ICMS. `vBC` padrão: valor da operação (vProd + vFrete + vSeg + vOutro - vDesc) já reduzido por `pRedBC`. */
export interface IcmsProprio {
  /** Padrão `'3'` (valor da operação). */
  readonly modBC?: ModBC;
  readonly vBC?: DecimalInput;
  readonly pICMS: DecimalInput;
  /** Padrão `vBC × pICMS / 100`. */
  readonly vICMS?: DecimalInput;
}

/** FCP da operação própria. `vBCFCP` padrão `vBC`; `vFCP` padrão `vBCFCP × pFCP / 100`. */
export interface IcmsFcp {
  readonly vBCFCP?: DecimalInput;
  readonly pFCP?: DecimalInput;
  readonly vFCP?: DecimalInput;
}

/**
 * ICMS retido por substituição tributária. Com `modBCST` 4 (MVA) e sem `vBCST`, a base é
 * (vProd + vFrete + vSeg + vOutro - vDesc + vIPI) × (1 + pMVAST/100) × (1 - pRedBCST/100). `vICMSST` padrão
 * `vBCST × pICMSST / 100 - ICMS próprio` (MOC N23); `vFCPST` padrão `vBCFCPST × pFCPST / 100 - vFCP` (RV N23d-10).
 */
export interface IcmsSt {
  readonly modBCST: ModBCST;
  readonly pMVAST?: DecimalInput;
  readonly pRedBCST?: DecimalInput;
  readonly vBCST?: DecimalInput;
  readonly pICMSST: DecimalInput;
  readonly vICMSST?: DecimalInput;
  readonly vBCFCPST?: DecimalInput;
  readonly pFCPST?: DecimalInput;
  readonly vFCPST?: DecimalInput;
  /**
   * ICMS próprio a abater do ST quando o grupo não tem ICMS próprio destacado (CST 30, CSOSN 201, 202, 203, 900).
   * Ausente, nada é abatido. Não vai para o XML.
   */
  readonly vICMSDeducaoST?: DecimalInput;
}

/** ICMS-ST retido anteriormente (CST 60, CSOSN 500). Todos informativos. */
export interface IcmsStRetido {
  readonly vBCSTRet?: DecimalInput;
  readonly pST?: DecimalInput;
  readonly vICMSSubstituto?: DecimalInput;
  readonly vICMSSTRet?: DecimalInput;
  readonly vBCFCPSTRet?: DecimalInput;
  readonly pFCPSTRet?: DecimalInput;
  readonly vFCPSTRet?: DecimalInput;
  readonly pRedBCEfet?: DecimalInput;
  readonly vBCEfet?: DecimalInput;
  readonly pICMSEfet?: DecimalInput;
  readonly vICMSEfet?: DecimalInput;
}

interface IcmsBase {
  readonly orig: Origem;
  /** Discrimina os grupos de partilha (`Part`) e de repasse de ST (`ST`); ausente nos demais. */
  readonly grupo?: undefined;
}

export interface Icms00 extends IcmsBase, IcmsProprio {
  readonly CST: '00';
  readonly pFCP?: DecimalInput;
  readonly vFCP?: DecimalInput;
}

/** Monofásico próprio sobre combustíveis. `vICMSMono` padrão `qBCMono × adRemICMS`. */
export interface Icms02 extends IcmsBase {
  readonly CST: '02';
  readonly qBCMono?: DecimalInput;
  readonly adRemICMS: DecimalInput;
  readonly vICMSMono?: DecimalInput;
}

export interface Icms10 extends IcmsBase, IcmsProprio, IcmsFcp {
  readonly CST: '10';
  readonly st: IcmsSt;
  readonly desoneracaoSt?: DesoneracaoSt;
}

/** Monofásico próprio e com retenção sobre combustíveis. */
export interface Icms15 extends IcmsBase {
  readonly CST: '15';
  readonly qBCMono?: DecimalInput;
  readonly adRemICMS: DecimalInput;
  readonly vICMSMono?: DecimalInput;
  readonly qBCMonoReten?: DecimalInput;
  readonly adRemICMSReten: DecimalInput;
  readonly vICMSMonoReten?: DecimalInput;
  readonly pRedAdRem?: DecimalInput;
  readonly motRedAdRem?: '1' | '9';
}

/** Com redução de base de cálculo. `vBC` padrão: valor da operação × (1 - pRedBC/100). */
export interface Icms20 extends IcmsBase, IcmsProprio, IcmsFcp {
  readonly CST: '20';
  readonly pRedBC: DecimalInput;
  readonly desoneracao?: Desoneracao<'3' | '9' | '10' | '11' | '12'>;
}

/** Isenta ou não tributada, com ST. */
export interface Icms30 extends IcmsBase {
  readonly CST: '30';
  readonly st: IcmsSt;
  readonly desoneracao?: Desoneracao<'6' | '7' | '9'>;
}

/** 40 isenta, 41 não tributada, 50 suspensão. */
export interface Icms40 extends IcmsBase {
  readonly CST: '40' | '41' | '50';
  readonly desoneracao?: Desoneracao<'1' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '16' | '90'>;
}

/**
 * Diferimento (CST 51). Com `pICMS` e sem valores: `vICMSOp = vBC × pICMS`, `vICMSDif = vICMSOp × pDif`,
 * `vICMS = vICMSOp - vICMSDif` (RV N16a e N16c); o FCP segue a mesma conta com `pFCPDif`.
 */
export interface Icms51 extends IcmsBase, IcmsFcp {
  readonly CST: '51';
  readonly modBC?: ModBC;
  readonly pRedBC?: DecimalInput;
  readonly cBenefRBC?: string;
  readonly vBC?: DecimalInput;
  readonly pICMS?: DecimalInput;
  readonly vICMSOp?: DecimalInput;
  /** Percentual do diferimento; 100 difere tudo. */
  readonly pDif?: DecimalInput;
  readonly vICMSDif?: DecimalInput;
  readonly vICMS?: DecimalInput;
  readonly pFCPDif?: DecimalInput;
  readonly vFCPDif?: DecimalInput;
  readonly vFCPEfet?: DecimalInput;
}

/** Monofásico com recolhimento diferido. */
export interface Icms53 extends IcmsBase {
  readonly CST: '53';
  readonly qBCMono?: DecimalInput;
  readonly adRemICMS?: DecimalInput;
  readonly vICMSMonoOp?: DecimalInput;
  readonly pDif?: DecimalInput;
  readonly vICMSMonoDif?: DecimalInput;
  readonly vICMSMono?: DecimalInput;
  readonly qBCMonoDif?: DecimalInput;
  readonly adRemICMSDif?: DecimalInput;
}

/** ICMS cobrado anteriormente por ST. */
export interface Icms60 extends IcmsBase, IcmsStRetido {
  readonly CST: '60';
}

/** Monofásico cobrado anteriormente. */
export interface Icms61 extends IcmsBase {
  readonly CST: '61';
  readonly qBCMonoRet?: DecimalInput;
  readonly adRemICMSRet: DecimalInput;
  readonly vICMSMonoRet?: DecimalInput;
}

/** Com redução de base e ST. */
export interface Icms70 extends IcmsBase, IcmsProprio, IcmsFcp {
  readonly CST: '70';
  readonly pRedBC: DecimalInput;
  readonly st: IcmsSt;
  readonly desoneracao?: Desoneracao<'3' | '9' | '12'>;
  readonly desoneracaoSt?: DesoneracaoSt;
}

/** Outras. Tudo opcional; cada parte informada é calculada como nos grupos equivalentes. */
export interface Icms90 extends IcmsBase, IcmsFcp {
  readonly CST: '90';
  readonly modBC?: ModBC;
  readonly vBC?: DecimalInput;
  readonly pRedBC?: DecimalInput;
  readonly cBenefRBC?: string;
  readonly pICMS?: DecimalInput;
  readonly vICMSOp?: DecimalInput;
  readonly pDif?: DecimalInput;
  readonly vICMSDif?: DecimalInput;
  readonly vICMS?: DecimalInput;
  readonly pFCPDif?: DecimalInput;
  readonly vFCPDif?: DecimalInput;
  readonly vFCPEfet?: DecimalInput;
  readonly st?: IcmsSt;
  readonly desoneracao?: Desoneracao<'3' | '9' | '12'>;
  readonly desoneracaoSt?: DesoneracaoSt;
}

/** Partilha do ICMS entre UF de origem e destino (ICMSPart), CST 10 ou 90 (ou 20). */
export interface IcmsPartilha extends Omit<IcmsProprio, 'modBC'> {
  readonly grupo: 'Part';
  readonly orig: Origem;
  readonly CST: '10' | '20' | '90';
  readonly modBC: ModBC;
  readonly pRedBC?: DecimalInput;
  readonly st: IcmsSt;
  /** Percentual da base da operação própria. */
  readonly pBCOp: DecimalInput;
  /** UF para a qual o ICMS-ST é devido. */
  readonly UFST: Uf | 'EX';
  readonly desoneracao?: Desoneracao<'9' | '10' | '11'>;
}

/** Repasse de ICMS-ST retido anteriormente para a UF de destino (ICMSST), CST 41 ou 60. */
export interface IcmsRepasseSt extends IcmsStRetido {
  readonly grupo: 'ST';
  readonly orig: Origem;
  readonly CST: '41' | '60';
  readonly vBCSTRet: DecimalInput;
  readonly vICMSSTRet: DecimalInput;
  readonly vBCSTDest: DecimalInput;
  readonly vICMSSTDest: DecimalInput;
}

/** Simples Nacional 101: com permissão de crédito. `vCredICMSSN` padrão: valor da operação × pCredSN / 100. */
export interface IcmsSn101 extends IcmsBase {
  readonly CSOSN: '101';
  readonly pCredSN: DecimalInput;
  readonly vCredICMSSN?: DecimalInput;
}

/** Simples Nacional 102, 103, 300, 400. */
export interface IcmsSn102 {
  readonly CSOSN: '102' | '103' | '300' | '400';
  readonly orig?: Origem;
  readonly grupo?: undefined;
}

/** Simples Nacional 201: crédito e ST. */
export interface IcmsSn201 extends IcmsBase {
  readonly CSOSN: '201';
  readonly st: IcmsSt;
  readonly pCredSN: DecimalInput;
  readonly vCredICMSSN?: DecimalInput;
}

/** Simples Nacional 202 e 203: ST sem crédito. */
export interface IcmsSn202 extends IcmsBase {
  readonly CSOSN: '202' | '203';
  readonly st: IcmsSt;
}

/** Simples Nacional 500: cobrado anteriormente. */
export interface IcmsSn500 extends IcmsBase, IcmsStRetido {
  readonly CSOSN: '500';
}

/** Simples Nacional 900: outros. */
export interface IcmsSn900 {
  readonly CSOSN: '900';
  readonly orig?: Origem;
  readonly grupo?: undefined;
  readonly modBC?: ModBC;
  readonly vBC?: DecimalInput;
  readonly pRedBC?: DecimalInput;
  readonly pICMS?: DecimalInput;
  readonly vICMS?: DecimalInput;
  readonly st?: IcmsSt;
  readonly pCredSN?: DecimalInput;
  readonly vCredICMSSN?: DecimalInput;
}

/** Tributação do ICMS do item: um grupo por CST (regime normal) ou CSOSN (Simples Nacional). */
export type Icms =
  | Icms00
  | Icms02
  | Icms10
  | Icms15
  | Icms20
  | Icms30
  | Icms40
  | Icms51
  | Icms53
  | Icms60
  | Icms61
  | Icms70
  | Icms90
  | IcmsPartilha
  | IcmsRepasseSt
  | IcmsSn101
  | IcmsSn102
  | IcmsSn201
  | IcmsSn202
  | IcmsSn500
  | IcmsSn900;

/**
 * ICMS de partilha para a UF de destino (NA, EC 87/2015), venda interestadual a não contribuinte. Os valores
 * `vICMSUFDest` e `vFCPUFDest` são obrigatórios: a conta muda entre base única e base dupla conforme a UF de destino, e
 * esse dado não está aqui.
 */
export interface IcmsUfDest {
  readonly vBCUFDest: DecimalInput;
  readonly vBCFCPUFDest?: DecimalInput;
  readonly pFCPUFDest?: DecimalInput;
  readonly pICMSUFDest: DecimalInput;
  readonly pICMSInter: '4.00' | '7.00' | '12.00';
  /** Padrão 100 (desde 2019). */
  readonly pICMSInterPart?: DecimalInput;
  readonly vFCPUFDest?: DecimalInput;
  readonly vICMSUFDest: DecimalInput;
  /** Padrão 0 (desde 2019). */
  readonly vICMSUFRemet?: DecimalInput;
}

// ---------------------------------------------------------------------------------------------------------------
// IPI, II, ISSQN, PIS, COFINS
// ---------------------------------------------------------------------------------------------------------------

/** IPI tributado (O07): por alíquota (`vBC` padrão valor da operação) ou por unidade (`qUnid × vUnid`). */
export type IpiTributado = {
  readonly CST: '00' | '49' | '50' | '99';
  readonly vIPI?: DecimalInput;
} & (
  | { readonly vBC?: DecimalInput; readonly pIPI: DecimalInput; readonly qUnid?: never; readonly vUnid?: never }
  | { readonly qUnid: DecimalInput; readonly vUnid: DecimalInput; readonly vBC?: never; readonly pIPI?: never }
);

/** IPI não tributado (O08). */
export interface IpiNaoTributado {
  readonly CST: '01' | '02' | '03' | '04' | '05' | '51' | '52' | '53' | '54' | '55';
}

export type Ipi = (IpiTributado | IpiNaoTributado) & {
  /** Código de enquadramento legal; `999` quando não há. */
  readonly cEnq: string;
  readonly CNPJProd?: string;
  readonly cSelo?: string;
  readonly qSelo?: string;
};

/** Imposto de importação (grupo P). */
export interface ImpostoImportacao {
  readonly vBC: DecimalInput;
  readonly vDespAdu: DecimalInput;
  readonly vII: DecimalInput;
  readonly vIOF: DecimalInput;
}

/** ISSQN (grupo U), NF-e conjugada. `vISSQN` padrão `vBC × vAliq / 100`. */
export interface Issqn {
  readonly vBC: DecimalInput;
  readonly vAliq: DecimalInput;
  readonly vISSQN?: DecimalInput;
  readonly cMunFG: string;
  readonly cListServ: string;
  readonly vDeducao?: DecimalInput;
  readonly vOutro?: DecimalInput;
  readonly vDescIncond?: DecimalInput;
  readonly vDescCond?: DecimalInput;
  readonly vISSRet?: DecimalInput;
  readonly indISS: '1' | '2' | '3' | '4' | '5' | '6' | '7';
  readonly cServico?: string;
  readonly cMun?: string;
  readonly cPais?: string;
  readonly nProcesso?: string;
  readonly indIncentivo: '1' | '2';
}

/** CSTs de PIS/COFINS do grupo "outras operações" (Q05, S05). */
export type CstPisCofinsOutras =
  | '49'
  | '50'
  | '51'
  | '52'
  | '53'
  | '54'
  | '55'
  | '56'
  | '60'
  | '61'
  | '62'
  | '63'
  | '64'
  | '65'
  | '66'
  | '67'
  | '70'
  | '71'
  | '72'
  | '73'
  | '74'
  | '75'
  | '98'
  | '99';

/**
 * PIS ou COFINS (grupos Q e S), com a mesma forma. `vBC` é obrigatório: a base legal varia (exclusão do ICMS, receita
 * bruta, regime) e não há padrão seguro. O valor (`valor`) padrão é `vBC × aliquota / 100` ou `qBCProd × vAliqProd`.
 */
export type PisCofins =
  | {
      readonly CST: '01' | '02';
      readonly vBC: DecimalInput;
      readonly aliquota: DecimalInput;
      readonly valor?: DecimalInput;
    }
  | {
      readonly CST: '03';
      readonly qBCProd: DecimalInput;
      readonly vAliqProd: DecimalInput;
      readonly valor?: DecimalInput;
    }
  | { readonly CST: '04' | '05' | '06' | '07' | '08' | '09' }
  | {
      readonly CST: CstPisCofinsOutras;
      readonly vBC: DecimalInput;
      readonly aliquota: DecimalInput;
      readonly valor?: DecimalInput;
      readonly qBCProd?: never;
    }
  | {
      readonly CST: CstPisCofinsOutras;
      readonly qBCProd: DecimalInput;
      readonly vAliqProd: DecimalInput;
      readonly valor?: DecimalInput;
      readonly vBC?: never;
    };

/** PIS ou COFINS ST (grupos R e T). `indSoma` 1: o valor compõe o total da nota. */
export type PisCofinsSt = {
  readonly valor?: DecimalInput;
  readonly indSoma?: '0' | '1';
} & (
  | { readonly vBC: DecimalInput; readonly aliquota: DecimalInput; readonly qBCProd?: never }
  | { readonly qBCProd: DecimalInput; readonly vAliqProd: DecimalInput; readonly vBC?: never }
);

// ---------------------------------------------------------------------------------------------------------------
// IBS / CBS
// ---------------------------------------------------------------------------------------------------------------

/**
 * Classificação do item para IBS/CBS (NT 2025.002): o que o `IbsCbsCalculator` recebe. `CST` e `cClassTrib` vêm do
 * cadastro do item (tabela de classificação tributária); o cálculo, as alíquotas e as reduções são da calculadora.
 */
export interface ClassificacaoIbsCbs {
  /** CST do IBS/CBS, 3 dígitos. */
  readonly CST: string;
  /** Código de classificação tributária, 6 dígitos. */
  readonly cClassTrib: string;
  /** Base de cálculo; padrão: o valor que a calculadora devolver. */
  readonly vBC?: DecimalInput;
  readonly indDoacao?: '1';
  /** Código do crédito presumido (`cCredPres`), quando o `cClassTrib` indica. */
  readonly cCredPres?: string;
  /**
   * Tributação regular (`gTribRegular`, UB68): CST e cClassTrib que valeriam sem o tratamento do `cClassTrib`
   * principal. Obrigatória nos que a exigem (suspensão, exportação: 550001 e afins); a calculadora devolve o grupo com
   * as alíquotas e os valores da tributação regular.
   */
  readonly gTribRegular?: { readonly CSTReg: string; readonly cClassTribReg: string };
}

/**
 * IBS/CBS do item: pela classificação (a calculadora injetada devolve o grupo) ou já calculado (grupo do schema
 * pronto, por exemplo vindo de outro sistema).
 */
export type IbsCbsItem =
  | { readonly classificacao: ClassificacaoIbsCbs; readonly grupo?: never }
  | { readonly grupo: TTribNFe; readonly classificacao?: never };

/** Tributos do item (grupo M). ICMS ou ISSQN, exclusivos; o resto conforme a operação. */
export interface ImpostosItem {
  /** Lei 12.741/2012: valor aproximado dos tributos. */
  readonly vTotTrib?: DecimalInput;
  readonly icms?: Icms;
  readonly ipi?: Ipi;
  readonly ii?: ImpostoImportacao;
  readonly issqn?: Issqn;
  readonly pis?: PisCofins;
  readonly pisSt?: PisCofinsSt;
  readonly cofins?: PisCofins;
  readonly cofinsSt?: PisCofinsSt;
  readonly icmsUfDest?: IcmsUfDest;
  /** Imposto Seletivo, repassado como veio (sem cálculo nesta versão). */
  readonly is?: TIS;
  readonly ibsCbs?: IbsCbsItem;
}

/** Item da nota (grupo H). */
export interface Item {
  readonly produto: Produto;
  readonly impostos: ImpostosItem;
  /** Devolução: percentual devolvido e IPI devolvido (grupo UA). */
  readonly impostoDevol?: { readonly pDevol: DecimalInput; readonly vIPIDevol: DecimalInput };
  readonly infAdProd?: string;
  readonly obsItem?: TNFe_infNFe_det_obsItem;
  /** Referência a item de outro DF-e (grupo VC, NT 2025.002). */
  readonly DFeReferenciado?: { readonly chaveAcesso: string; readonly nItem?: string | number };
}

// ---------------------------------------------------------------------------------------------------------------
// Transporte, cobrança, pagamento, informações adicionais
// ---------------------------------------------------------------------------------------------------------------

/** Modalidade do frete (X02): 0 CIF; 1 FOB; 2 terceiros; 3 próprio do remetente; 4 próprio do destinatário; 9 sem frete. */
export type ModFrete = '0' | '1' | '2' | '3' | '4' | '9';

export interface Transportador {
  readonly CNPJ?: string;
  readonly CPF?: string;
  readonly xNome?: string;
  /** IE ou `ISENTO` (RV X07-20). */
  readonly IE?: string;
  readonly xEnder?: string;
  readonly xMun?: string;
  readonly UF?: Uf | 'EX';
}

export interface Volume {
  readonly qVol?: string | number;
  readonly esp?: string;
  readonly marca?: string;
  readonly nVol?: string;
  /** Peso líquido em kg, 3 casas. */
  readonly pesoL?: DecimalInput;
  readonly pesoB?: DecimalInput;
  readonly lacres?: readonly string[];
}

/** Transporte (grupo X). */
export interface Transporte {
  readonly modFrete: ModFrete;
  readonly transportador?: Transportador;
  /** Retenção do ICMS do transporte; `vICMSRet` padrão `vBCRet × pICMSRet / 100`. */
  readonly retTransp?: {
    readonly vServ: DecimalInput;
    readonly vBCRet: DecimalInput;
    readonly pICMSRet: DecimalInput;
    readonly vICMSRet?: DecimalInput;
    readonly CFOP: string;
    readonly cMunFG: string;
  };
  readonly veicTransp?: TVeiculo;
  readonly reboque?: readonly TVeiculo[];
  readonly vagao?: string;
  readonly balsa?: string;
  readonly volumes?: readonly Volume[];
}

/** Cobrança (grupo Y). `fat.vLiq` padrão `vOrig - vDesc`. */
export interface Cobranca {
  readonly fatura?: {
    readonly nFat?: string;
    readonly vOrig?: DecimalInput;
    readonly vDesc?: DecimalInput;
    readonly vLiq?: DecimalInput;
  };
  readonly duplicatas?: readonly {
    /** Padrão: sequência com 3 dígitos (`001`, `002`), como pede a NT 2016.002. */
    readonly nDup?: string;
    /** `AAAA-MM-DD`. */
    readonly dVenc?: string;
    readonly vDup: DecimalInput;
  }[];
}

/** Meio de pagamento (YA02, NT 2020.006 e seguintes). */
export const TipoPagamento: {
  readonly DINHEIRO: '01';
  readonly CHEQUE: '02';
  readonly CARTAO_CREDITO: '03';
  readonly CARTAO_DEBITO: '04';
  readonly CREDITO_LOJA: '05';
  readonly VALE_ALIMENTACAO: '10';
  readonly VALE_REFEICAO: '11';
  readonly VALE_PRESENTE: '12';
  readonly VALE_COMBUSTIVEL: '13';
  readonly BOLETO: '15';
  readonly DEPOSITO: '16';
  readonly PIX_DINAMICO: '17';
  readonly TRANSFERENCIA_CARTEIRA_DIGITAL: '18';
  readonly FIDELIDADE_CASHBACK: '19';
  readonly PIX_ESTATICO: '20';
  readonly CREDITO_EM_LOJA: '21';
  readonly FALHA_HARDWARE: '22';
  readonly SEM_PAGAMENTO: '90';
  /** Pagamento posterior, com `vPag` zero (NT 2025.001 v1.03, YA02 e YA03-30). */
  readonly PAGAMENTO_POSTERIOR: '91';
  readonly OUTROS: '99';
} = {
  DINHEIRO: '01',
  CHEQUE: '02',
  CARTAO_CREDITO: '03',
  CARTAO_DEBITO: '04',
  CREDITO_LOJA: '05',
  VALE_ALIMENTACAO: '10',
  VALE_REFEICAO: '11',
  VALE_PRESENTE: '12',
  VALE_COMBUSTIVEL: '13',
  BOLETO: '15',
  DEPOSITO: '16',
  PIX_DINAMICO: '17',
  TRANSFERENCIA_CARTEIRA_DIGITAL: '18',
  FIDELIDADE_CASHBACK: '19',
  PIX_ESTATICO: '20',
  CREDITO_EM_LOJA: '21',
  FALHA_HARDWARE: '22',
  SEM_PAGAMENTO: '90',
  PAGAMENTO_POSTERIOR: '91',
  OUTROS: '99',
};

export type TipoPagamento = (typeof TipoPagamento)[keyof typeof TipoPagamento];

export interface DetalhePagamento {
  readonly indPag?: '0' | '1';
  readonly tPag: TipoPagamento;
  /** Descrição do meio de pagamento; recomendada com `tPag` 99. */
  readonly xPag?: string;
  readonly vPag: DecimalInput;
  /** `AAAA-MM-DD`. */
  readonly dPag?: string;
  readonly CNPJPag?: string;
  readonly UFPag?: Uf;
  readonly card?: TNFe_infNFe_pag_detPag_card;
}

/** Pagamento (grupo YA). Ausente, o builder informa `tPag` 90 (sem pagamento) com valor zero. */
export interface Pagamento {
  readonly detPag: readonly DetalhePagamento[];
  readonly vTroco?: DecimalInput;
}

/** Informações adicionais (grupo Z). */
export interface InformacoesAdicionais {
  readonly infAdFisco?: string;
  readonly infCpl?: string;
  readonly obsCont?: readonly TNFe_infNFe_infAdic_obsCont[];
  readonly obsFisco?: readonly TNFe_infNFe_infAdic_obsFisco[];
  readonly procRef?: readonly TNFe_infNFe_infAdic_procRef[];
}

/**
 * Responsável técnico (grupo ZD, NT 2018.005). O `hashCSRT` é calculado pelo builder a partir do CSRT (nunca vai para o
 * XML): Base64(SHA-1(CSRT + chave de acesso)).
 */
export interface ResponsavelTecnico {
  readonly CNPJ: string;
  readonly xContato: string;
  readonly email: string;
  readonly fone: string;
  /** CSRT fornecido pela SEFAZ da UF e seu identificador (`idCSRT`, 2 dígitos). */
  readonly csrt?: { readonly idCSRT: string; readonly CSRT: string };
}

// ---------------------------------------------------------------------------------------------------------------
// Identificação e contingência
// ---------------------------------------------------------------------------------------------------------------

/** Finalidade (B25): 1 normal; 2 complementar; 3 ajuste; 4 devolução; 5 nota de crédito; 6 nota de débito. */
export type FinNFe = '1' | '2' | '3' | '4' | '5' | '6';

/**
 * Forma de emissão (B22) fora do normal. A contingência SVC usa o autorizador SVC-AN ou SVC-RS da UF (dado do
 * `@sinete/transport`); FS-DA e EPEC (4 e 5) ficam para outra versão, mas o modelo já os comporta. A NFC-e não tem SVC:
 * a contingência dela é a off-line (9), emitida sem a SEFAZ e transmitida depois.
 */
export interface Contingencia {
  /**
   * 6 SVC-AN, 7 SVC-RS; 2 FS-IA; 4 EPEC; 5 FS-DA; 9 off-line, só NFC-e. Para SVC, `tpEmisSvc` do `NfeClient` escolhe pelo
   * dado da UF.
   */
  readonly tpEmis: '2' | '4' | '5' | '6' | '7' | '9';
  /** Entrada em contingência (`dhCont`). Instante com fuso. */
  readonly dhCont: Instante;
  /** Justificativa, 15 a 256 caracteres. */
  readonly xJust: string;
}

/** Entrada completa de uma NF-e. */
export interface NfeInput {
  /**
   * 55 (NF-e, padrão) ou 65 (NFC-e). Na NFC-e mudam os padrões (`indPres` 1, `indFinal` 1, `tpImp` 4), o destinatário
   * fica opcional, o pagamento passa a ser obrigatório e a montagem acrescenta o `infNFeSupl` (QR Code).
   */
  readonly modelo?: '55' | '65';
  /** 0 a 999; produtor rural pessoa física: 920 a 969. */
  readonly serie: number | string;
  readonly nNF: number | string;
  readonly natOp: string;
  /** 0 entrada; 1 saída. */
  readonly tpNF: '0' | '1';
  /** Padrão `'1'`. */
  readonly finNFe?: FinNFe;
  readonly tpNFDebito?: '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08';
  readonly tpNFCredito?: '01' | '02' | '03' | '04' | '05' | '06';
  /** Padrão: 3 com destinatário estrangeiro, 2 com UF de destino diferente da do emitente, 1 nos demais casos. */
  readonly idDest?: '1' | '2' | '3';
  /** Padrão: 1 na NFC-e e quando o destinatário é não contribuinte (`indIEDest` 9), 0 nos demais. */
  readonly indFinal?: '0' | '1';
  /** Padrão `'9'` (não presencial, outros) na NF-e e `'1'` (presencial) na NFC-e. */
  readonly indPres?: '0' | '1' | '2' | '3' | '4' | '5' | '9';
  readonly indIntermed?: '0' | '1';
  /** Município do fato gerador; padrão o do emitente. */
  readonly cMunFG?: string;
  readonly cMunFGIBS?: string;
  /** Padrão `'1'` (DANFE retrato) na NF-e e `'4'` (DANFC-e impresso) na NFC-e. */
  readonly tpImp?: '0' | '1' | '2' | '3' | '4' | '5' | '6';
  /** Saída ou entrada da mercadoria. */
  readonly dhSaiEnt?: Instante;
  /** `AAAA-MM-DD`. */
  readonly dPrevEntrega?: string;
  /** Código numérico da chave; padrão aleatório (8 dígitos, fora das sequências proibidas). */
  readonly cNF?: string;
  readonly contingencia?: Contingencia;
  readonly referenciadas?: readonly Referenciada[];
  readonly gCompraGov?: {
    readonly tpEnteGov: '1' | '2' | '3' | '4' | '5' | '6';
    readonly pRedutor: DecimalInput;
    readonly tpOperGov: '1' | '2' | '3' | '4';
    readonly refDFeAnt?: readonly string[];
  };
  readonly gPagAntecipado?: readonly string[];
  readonly emitente: Emitente;
  readonly destinatario?: Destinatario;
  readonly retirada?: Local;
  readonly entrega?: Local;
  /** Até 10 CNPJ/CPF autorizados a baixar o XML. */
  readonly autXML?: readonly DocumentoPessoa[];
  readonly itens: readonly Item[];
  readonly transporte?: Transporte;
  readonly cobranca?: Cobranca;
  readonly pagamento?: Pagamento;
  readonly infIntermed?: TNFe_infNFe_infIntermed;
  readonly informacoesAdicionais?: InformacoesAdicionais;
  readonly exporta?: TNFe_infNFe_exporta;
  readonly compra?: TNFe_infNFe_compra;
  readonly cana?: TNFe_infNFe_cana;
  readonly respTec?: ResponsavelTecnico;
  /** Produtor rural: receituário de agrotóxico ou guia de trânsito (GTA e afins), grupo ZF (NT 2024.003). */
  readonly agropecuario?: TNFe_infNFe_agropecuario;
}

/** Os tipos do schema reexportados para quem passa grupos repassados. */
export type { TCIBS_NFe, TMonofasia, TTribNFe };
