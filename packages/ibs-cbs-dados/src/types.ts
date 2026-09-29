/**
 * Schema do dataset do `@sinete/ibs-cbs-dados` (versão `DATA_SCHEMA_VERSION`).
 *
 * Todo registro é fato normativo extraído de fonte oficial fixada por hash (`manifest.sources`), com vigência explícita
 * no tempo do fato gerador. Datas são `AAAA-MM-DD` e as vigências são fechadas nas duas pontas (`from <= data <= to`),
 * como nas consultas da Calculadora. Decimais vêm como texto, nunca como `number`.
 */

/** Data civil `AAAA-MM-DD`. */
export type IsoDate = string;

/** Decimal em texto (`'0.9'`, `'60'`, `'0.05'`). */
export type Dec = string;

/** Intervalo de vigência, fechado nas duas pontas; `to: null` é vigência aberta. */
export interface Validity {
  readonly from: IsoDate;
  readonly to: IsoDate | null;
}

/** Família da tabela: CST e cClassTrib do IBS/CBS ou do Imposto Seletivo (os códigos se repetem entre famílias). */
export type Family = 'CBS_IBS' | 'IS';

/** Tributo como a Calculadora o identifica. */
export type Tributo = 'CBS' | 'IBSUF' | 'IBSMun' | 'IS';

/**
 * Indicador de grupo do leiaute. Na CST, 1 é "exige" e 0 é "não é permitido" (legenda do IT 2025.002); no
 * `ind_gCredPresOper`, 1 é "permite, sem exigir" (NT 2025.002, UB120, observação 2).
 */
export type Indicator = 'required' | 'allowed' | 'forbidden';

/** Fonte de onde veio um registro, pelo id em `manifest.sources`. */
export type SourceId = string;

export interface CstGroups {
  readonly gIBSCBS: Indicator;
  readonly gIBSCBSMono: Indicator;
  readonly gRed: Indicator;
  readonly gDif: Indicator;
  readonly gTransfCred: Indicator;
  readonly gCredPresIBSZFM: Indicator;
  readonly gAjusteCompet: Indicator;
  /** `ind_RedutorBC`, só no IT (a Calculadora não tem a coluna); `null` quando o IT não traz a CST. */
  readonly redutorBC: Indicator | null;
}

export interface CstRecord {
  /** Chave estável: `família:código:início da vigência`. */
  readonly key: string;
  readonly family: Family;
  readonly code: string;
  readonly description: string;
  readonly tributos: readonly Tributo[];
  readonly groups: CstGroups;
  readonly validity: Validity;
  readonly sources: readonly SourceId[];
}

/** Tipo de alíquota exatamente como publicado. */
export type RateKind =
  | 'Padrão'
  | 'Uniforme setorial'
  | 'Uniforme nacional (referência)'
  | 'Fixa'
  | 'Sem alíquota'
  | 'Alíquotas Combinadas (Ad Valorem e Ad Rem)';

/** Nomenclatura que o cClassTrib exige para o item. */
export type Nomenclature = 'NCM' | 'NBS' | 'NBS ou NCM' | 'CIB' | 'CIB ou NCM' | 'Não possui';

export interface ClassTribGroups {
  /** `ind_gTribRegular` (IT); a Calculadora expressa o mesmo pela flag do tratamento. */
  readonly gTribRegular: Indicator | null;
  readonly gCredPresOper: Indicator;
  readonly gMonoPadrao: Indicator;
  readonly gMonoReten: Indicator;
  readonly gMonoRet: Indicator;
  readonly gMonoDif: Indicator;
  /** `ind_gpBioDiferenca` (IT v1.60); `null` quando o IT não traz o código. */
  readonly gpBioDiferenca: Indicator | null;
  readonly gEstornoCred: Indicator;
}

export interface ClassTribCredit {
  /** Adquirente pode apropriar crédito de CBS. */
  readonly buyerCbs: boolean;
  readonly buyerIbs: boolean;
  readonly presumedSupplier: boolean;
  readonly presumedBuyer: boolean;
  /** Efeito sobre o crédito da operação antecedente. */
  readonly priorOperation: 'Manutenção' | 'Anulação' | null;
}

export interface ByTributo {
  readonly tributo: Tributo;
  readonly validity: Validity;
}

export interface ReductionRecord extends ByTributo {
  /** Percentual de redução da alíquota (`60` = 60%). */
  readonly pRed: Dec;
}

export interface FixedRateRecord extends ByTributo {
  /** Alíquota fixa em percentual. */
  readonly rate: Dec;
}

export interface DfeLink {
  /** Sigla da Calculadora (`NF-e`, `NFC-e`, `NFS-e`...). */
  readonly sigla: string;
  /** Modelo do documento (`55`, `65`, `91`...). */
  readonly modelo: number;
  readonly validity: Validity;
}

export interface LegalBasis {
  /** Referência curta (`Art. 137`). */
  readonly short: string;
  readonly text: string;
  /** Norma (`LC 214/2025`). */
  readonly reference: string;
  readonly validity: Validity;
}

export interface ClassTribLegal {
  /** Dispositivo da LC 214/2025 citado no IT (`Art. 125`). */
  readonly lc214: string | null;
  readonly link: string | null;
  /** Fundamentação legal da Calculadora, com vigência. */
  readonly basis: readonly LegalBasis[];
}

export interface TreatmentLink {
  readonly treatment: number;
  readonly validity: Validity;
}

export interface ClassTribRecord {
  readonly key: string;
  readonly family: Family;
  readonly code: string;
  readonly cst: string;
  /** Nome curto do IT; `null` quando o código não está no IT. */
  readonly name: string | null;
  readonly description: string;
  readonly rateKind: RateKind;
  readonly nomenclature: Nomenclature | null;
  readonly annex: string | null;
  /** `tpRBSN` (IT v1.60): tipo de receita bruta do Simples Nacional. */
  readonly tpRBSN: number;
  readonly credit: ClassTribCredit;
  readonly groups: ClassTribGroups;
  readonly treatments: readonly TreatmentLink[];
  readonly reductions: readonly ReductionRecord[];
  readonly fixedRates: readonly FixedRateRecord[];
  readonly dfe: readonly DfeLink[];
  readonly legal: ClassTribLegal;
  /** Modelo de memória de cálculo da Calculadora. */
  readonly memoriaTemplate: string;
  readonly validity: Validity;
  readonly updatedAt: IsoDate | null;
  readonly sources: readonly SourceId[];
}

export interface TreatmentExpressions {
  readonly aliquota: string | null;
  readonly aliquotaEfetiva: string | null;
  readonly baseCalculo: string;
  readonly tributoCalculado: string;
  readonly tributoDevido: string | null;
  readonly percentualDiferimento: string | null;
  readonly valorDiferimento: string | null;
}

export interface TreatmentFlags {
  readonly incompativelComSuspensao: boolean;
  /** `TRTR_IN_EXIGE_GRUPO_DESONERACAO`: exige o grupo de tributação regular. */
  readonly exigeGrupoTribRegular: boolean;
  readonly possuiPercentualReducao: boolean;
  readonly possuiAjuste: boolean;
  readonly possuiRedutor: boolean;
  readonly possuiMonofasia: boolean;
}

/** Tratamento tributário da Calculadora: as regras de cálculo como expressões aritméticas. */
export interface TreatmentRecord {
  readonly key: string;
  readonly id: number;
  readonly description: string;
  readonly expr: TreatmentExpressions;
  readonly flags: TreatmentFlags;
  readonly validity: Validity;
}

export interface CredPresGroups {
  readonly gCBSCredPres: Indicator;
  readonly gIBSCredPres: Indicator;
}

/** Orientação de alíquota do IT: texto quando não é um número, decimal em texto quando é. */
export interface CredPresRates {
  readonly cbs: string | null;
  readonly ibs: string | null;
  readonly pAliqCredPresCBS: string | null;
  readonly pAliqCredPresIBS: string | null;
  readonly pRedTransicaoIBS: string | null;
}

export interface CredPresCalculation {
  readonly pAliq: string | null;
  readonly base: string | null;
  readonly formula: string | null;
  readonly impediment: string | null;
}

/** Código de classificação do crédito presumido (`cCredPres`, IT 2025.002, tabela 04). */
export interface CredPresRecord {
  readonly key: string;
  readonly code: number;
  readonly description: string;
  /** Texto do dispositivo da LC 214/2025. */
  readonly legal: string;
  readonly viaDocument: boolean;
  readonly viaEvent: boolean;
  /** `ind_DeduzCredPres`: o crédito é abatido do tributo do item (`vIBS`, UB54a-10). */
  readonly deductsFromTax: boolean;
  readonly groups: CredPresGroups;
  readonly rates: CredPresRates;
  /** Orientação sobre o cClassTrib da nota referenciada. */
  readonly referencedClassTrib: string | null;
  readonly validity: { readonly cbs: Validity | null; readonly ibs: Validity | null };
  readonly calculation: CredPresCalculation;
  readonly sources: readonly SourceId[];
}

export interface PrefixException {
  readonly prefix: string;
  readonly validity: Validity;
}

/** Vínculo de NCM ou NBS (por prefixo) com um cClassTrib, com as exceções do anexo. */
export interface ApplicabilityRecord {
  readonly key: string;
  /** Chave do cClassTrib vinculado (`família:código:início`). */
  readonly classTribKey: string;
  readonly family: Family;
  readonly cClassTrib: string;
  readonly prefix: string;
  /** Item do anexo (`I/1`), quando houver. */
  readonly annexItem: string | null;
  readonly validity: Validity;
  readonly exceptions: readonly PrefixException[];
}

/** Item de anexo da LC 214/2025 citado pelos vínculos de NCM e NBS. */
export interface AnnexRecord {
  readonly key: string;
  readonly annex: string;
  readonly item: string | null;
  readonly description: string | null;
  readonly text: string | null;
  readonly validity: Validity;
}

/** NFS-e: vínculo NBS x cClassTrib x indicador de operação (cIndOp) x item da LC 116. */
export interface NfseNbsRecord {
  readonly key: string;
  readonly nbs: string;
  readonly classTribKey: string;
  readonly cClassTrib: string;
  readonly itemLc116: string;
  readonly cIndOp: string;
  readonly onerosa: boolean;
  readonly adquirenteExterior: boolean;
  readonly validity: Validity;
}

export interface ActorGroupRecord {
  readonly key: string;
  readonly id: number;
  readonly description: string;
  readonly order: number;
  readonly validity: Validity;
}

export interface ActorRecord {
  readonly key: string;
  readonly id: number;
  readonly group: number;
  readonly description: string;
  readonly order: number;
  readonly validity: Validity;
}

export type ActorRole = 'Fornecedor' | 'Adquirente';

export interface ActorClassTribRecord {
  readonly key: string;
  readonly actor: number;
  readonly role: ActorRole;
  readonly classTribKey: string;
  readonly cClassTrib: string;
  readonly validity: Validity;
}

export interface DfeTypeRecord {
  readonly key: string;
  readonly sigla: string;
  readonly modelo: number;
  readonly description: string;
  readonly validity: Validity;
}

/** Redutor de compras governamentais (LC 214/2025, arts. 370 e 472), em percentual. */
export interface GovPurchaseReducerRecord {
  readonly key: string;
  readonly pRedutor: Dec;
  readonly validity: Validity;
}

/** Percentual da CBS transferido ao ente contratante na compra governamental (art. 473, com a transição). */
export interface CbsTransferRecord {
  readonly key: string;
  readonly percent: Dec;
  readonly validity: Validity;
}

export interface DatasetTables {
  readonly cst: readonly CstRecord[];
  readonly classTrib: readonly ClassTribRecord[];
  readonly treatments: readonly TreatmentRecord[];
  readonly credPres: readonly CredPresRecord[];
  readonly ncmApplicability: readonly ApplicabilityRecord[];
  readonly nbsApplicability: readonly ApplicabilityRecord[];
  readonly annexes: readonly AnnexRecord[];
  readonly nfseNbs: readonly NfseNbsRecord[];
  readonly actorGroups: readonly ActorGroupRecord[];
  readonly actors: readonly ActorRecord[];
  readonly actorClassTrib: readonly ActorClassTribRecord[];
  readonly dfeTypes: readonly DfeTypeRecord[];
  readonly govPurchaseReducer: readonly GovPurchaseReducerRecord[];
  readonly cbsTransfer: readonly CbsTransferRecord[];
}

export type TableName = keyof DatasetTables;

/** Artefato oficial de onde o dataset foi extraído. */
export interface DataSource {
  readonly id: SourceId;
  readonly kind: 'CALCULADORA_OFFLINE' | 'IT' | 'NT' | 'LEI';
  readonly title: string;
  /** Versão oficial (`V0057`, `v1.60`). */
  readonly version: string;
  /** Data da versão oficial. */
  readonly date: IsoDate;
  readonly url: string;
  readonly sha256: string;
  /** Hashes adicionais que fixam o artefato (camada do rootfs, arquivo interno). */
  readonly pins?: Readonly<Record<string, string>>;
  readonly notes?: string;
}

export interface TableManifest {
  readonly name: TableName;
  readonly records: number;
  readonly sha256: string;
}

export interface DatasetManifest {
  readonly dataSchemaVersion: number;
  /** Mês da base oficial mais recente dentro do dataset, `AAAA.MM` (a versão do pacote é `AAAA.M.patch`). */
  readonly dataVersion: string;
  /** Data de conhecimento: a data da versão oficial mais recente, não a da coleta (determinismo). */
  readonly knownAt: IsoDate;
  readonly sources: readonly DataSource[];
  readonly tables: readonly TableManifest[];
  /** sha256 das linhas `sha256  nome` das tabelas, em ordem; identifica o conteúdo. */
  readonly datasetSha256: string;
}

/** O dataset serializado: o que o pacote embarca e o que se carrega em runtime de outra origem. */
export interface DatasetBundle {
  readonly manifest: DatasetManifest;
  readonly tables: DatasetTables;
}
