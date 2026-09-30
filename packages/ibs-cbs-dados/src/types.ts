/**
 * Schema do dataset do `@sinete/ibs-cbs-dados` (versão `VERSAO_DO_FORMATO_DOS_DADOS`).
 *
 * Todo registro é fato normativo extraído de fonte oficial fixada por hash (`manifesto.fontes`), com vigência explícita
 * no tempo do fato gerador. Datas são `AAAA-MM-DD` e as vigências são fechadas nas duas pontas (`inicio <= data <= fim`),
 * como nas consultas da Calculadora. Decimais vêm como texto, nunca como `number`.
 */

/** Data civil `AAAA-MM-DD`. */
export type DataIso = string;

/** Decimal em texto (`'0.9'`, `'60'`, `'0.05'`). */
export type Dec = string;

/** Intervalo de vigência, fechado nas duas pontas; `fim: null` é vigência aberta. */
export interface Vigencia {
  readonly inicio: DataIso;
  readonly fim: DataIso | null;
}

/** Família da tabela: CST e cClassTrib do IBS/CBS ou do Imposto Seletivo (os códigos se repetem entre famílias). */
export type Familia = 'CBS_IBS' | 'IS';

/** Tributo como a Calculadora o identifica. */
export type Tributo = 'CBS' | 'IBSUF' | 'IBSMun' | 'IS';

/**
 * Indicador de grupo do leiaute. Na CST, 1 é "exige" e 0 é "não é permitido" (legenda do IT 2025.002); no
 * `ind_gCredPresOper`, 1 é "permite, sem exigir" (NT 2025.002, UB120, observação 2).
 */
export type Indicador = 'obrigatorio' | 'permitido' | 'vedado';

/** Fonte de onde veio um registro, pelo id em `manifesto.fontes`. */
export type IdDaFonte = string;

export interface GruposCst {
  readonly gIBSCBS: Indicador;
  readonly gIBSCBSMono: Indicador;
  readonly gRed: Indicador;
  readonly gDif: Indicador;
  readonly gTransfCred: Indicador;
  readonly gCredPresIBSZFM: Indicador;
  readonly gAjusteCompet: Indicador;
  /** `ind_RedutorBC`, só no IT (a Calculadora não tem a coluna); `null` quando o IT não traz a CST. */
  readonly redutorBC: Indicador | null;
}

export interface RegistroCst {
  /** Chave estável: `família:código:início da vigência`. */
  readonly chave: string;
  readonly familia: Familia;
  readonly codigo: string;
  readonly descricao: string;
  readonly tributos: readonly Tributo[];
  readonly grupos: GruposCst;
  readonly vigencia: Vigencia;
  readonly fontes: readonly IdDaFonte[];
}

/** Tipo de alíquota exatamente como publicado. */
export type TipoDeAliquota =
  | 'Padrão'
  | 'Uniforme setorial'
  | 'Uniforme nacional (referência)'
  | 'Fixa'
  | 'Sem alíquota'
  | 'Alíquotas Combinadas (Ad Valorem e Ad Rem)';

/** Nomenclatura que o cClassTrib exige para o item. */
export type Nomenclatura = 'NCM' | 'NBS' | 'NBS ou NCM' | 'CIB' | 'CIB ou NCM' | 'Não possui';

export interface GruposClassTrib {
  /** `ind_gTribRegular` (IT); a Calculadora expressa o mesmo pela flag do tratamento. */
  readonly gTribRegular: Indicador | null;
  readonly gCredPresOper: Indicador;
  readonly gMonoPadrao: Indicador;
  readonly gMonoReten: Indicador;
  readonly gMonoRet: Indicador;
  readonly gMonoDif: Indicador;
  /** `ind_gpBioDiferenca` (IT v1.60); `null` quando o IT não traz o código. */
  readonly gpBioDiferenca: Indicador | null;
  readonly gEstornoCred: Indicador;
}

export interface CreditoClassTrib {
  /** Adquirente pode apropriar crédito de CBS. */
  readonly adquirenteCbs: boolean;
  readonly adquirenteIbs: boolean;
  readonly presumidoFornecedor: boolean;
  readonly presumidoAdquirente: boolean;
  /** Efeito sobre o crédito da operação antecedente. */
  readonly operacaoAnterior: 'Manutenção' | 'Anulação' | null;
}

export interface PorTributo {
  readonly tributo: Tributo;
  readonly vigencia: Vigencia;
}

export interface RegistroReducao extends PorTributo {
  /** Percentual de redução da alíquota (`60` = 60%). */
  readonly pRed: Dec;
}

export interface RegistroAliquotaFixa extends PorTributo {
  /** Alíquota fixa em percentual. */
  readonly aliquota: Dec;
}

export interface VinculoDfe {
  /** Sigla da Calculadora (`NF-e`, `NFC-e`, `NFS-e`...). */
  readonly sigla: string;
  /** Modelo do documento (`55`, `65`, `91`...). */
  readonly modelo: number;
  readonly vigencia: Vigencia;
}

export interface BaseLegal {
  /** Referência curta (`Art. 137`). */
  readonly resumo: string;
  readonly texto: string;
  /** Norma (`LC 214/2025`). */
  readonly referencia: string;
  readonly vigencia: Vigencia;
}

export interface BaseLegalClassTrib {
  /** Dispositivo da LC 214/2025 citado no IT (`Art. 125`). */
  readonly lc214: string | null;
  readonly url: string | null;
  /** Fundamentação legal da Calculadora, com vigência. */
  readonly fundamento: readonly BaseLegal[];
}

export interface VinculoTratamento {
  readonly tratamento: number;
  readonly vigencia: Vigencia;
}

export interface RegistroClassTrib {
  readonly chave: string;
  readonly familia: Familia;
  readonly codigo: string;
  readonly cst: string;
  /** Nome curto do IT; `null` quando o código não está no IT. */
  readonly nome: string | null;
  readonly descricao: string;
  readonly tipoDeAliquota: TipoDeAliquota;
  readonly nomenclatura: Nomenclatura | null;
  readonly anexo: string | null;
  /** `tpRBSN` (IT v1.60): tipo de receita bruta do Simples Nacional. */
  readonly tpRBSN: number;
  readonly credito: CreditoClassTrib;
  readonly grupos: GruposClassTrib;
  readonly tratamentos: readonly VinculoTratamento[];
  readonly reducoes: readonly RegistroReducao[];
  readonly aliquotasFixas: readonly RegistroAliquotaFixa[];
  readonly dfe: readonly VinculoDfe[];
  readonly legal: BaseLegalClassTrib;
  /** Modelo de memória de cálculo da Calculadora. */
  readonly memoriaTemplate: string;
  readonly vigencia: Vigencia;
  readonly atualizadoEm: DataIso | null;
  readonly fontes: readonly IdDaFonte[];
}

export interface ExpressoesDoTratamento {
  readonly aliquota: string | null;
  readonly aliquotaEfetiva: string | null;
  readonly baseCalculo: string;
  readonly tributoCalculado: string;
  readonly tributoDevido: string | null;
  readonly percentualDiferimento: string | null;
  readonly valorDiferimento: string | null;
}

export interface IndicadoresDoTratamento {
  readonly incompativelComSuspensao: boolean;
  /** `TRTR_IN_EXIGE_GRUPO_DESONERACAO`: exige o grupo de tributação regular. */
  readonly exigeGrupoTribRegular: boolean;
  readonly possuiPercentualReducao: boolean;
  readonly possuiAjuste: boolean;
  readonly possuiRedutor: boolean;
  readonly possuiMonofasia: boolean;
}

/** Tratamento tributário da Calculadora: as regras de cálculo como expressões aritméticas. */
export interface RegistroTratamento {
  readonly chave: string;
  readonly id: number;
  readonly descricao: string;
  readonly expressao: ExpressoesDoTratamento;
  readonly indicadores: IndicadoresDoTratamento;
  readonly vigencia: Vigencia;
}

export interface GruposCredPres {
  readonly gCBSCredPres: Indicador;
  readonly gIBSCredPres: Indicador;
}

/** Orientação de alíquota do IT: texto quando não é um número, decimal em texto quando é. */
export interface AliquotasCredPres {
  readonly cbs: string | null;
  readonly ibs: string | null;
  readonly pAliqCredPresCBS: string | null;
  readonly pAliqCredPresIBS: string | null;
  readonly pRedTransicaoIBS: string | null;
}

export interface CalculoCredPres {
  readonly pAliq: string | null;
  readonly base: string | null;
  readonly formula: string | null;
  readonly impedimento: string | null;
}

/** Código de classificação do crédito presumido (`cCredPres`, IT 2025.002, tabela 04). */
export interface RegistroCredPres {
  readonly chave: string;
  readonly codigo: number;
  readonly descricao: string;
  /** Texto do dispositivo da LC 214/2025. */
  readonly legal: string;
  readonly viaDocumento: boolean;
  readonly viaEvento: boolean;
  /** `ind_DeduzCredPres`: o crédito é abatido do tributo do item (`vIBS`, UB54a-10). */
  readonly deduzDoTributo: boolean;
  readonly grupos: GruposCredPres;
  readonly aliquotas: AliquotasCredPres;
  /** Orientação sobre o cClassTrib da nota referenciada. */
  readonly classTribReferenciado: string | null;
  readonly vigencia: { readonly cbs: Vigencia | null; readonly ibs: Vigencia | null };
  readonly calculo: CalculoCredPres;
  readonly fontes: readonly IdDaFonte[];
}

export interface ExcecaoDePrefixo {
  readonly prefixo: string;
  readonly vigencia: Vigencia;
}

/** Vínculo de NCM ou NBS (por prefixo) com um cClassTrib, com as exceções do anexo. */
export interface RegistroAplicabilidade {
  readonly chave: string;
  /** Chave do cClassTrib vinculado (`família:código:início`). */
  readonly chaveClassTrib: string;
  readonly familia: Familia;
  readonly cClassTrib: string;
  readonly prefixo: string;
  /** Item do anexo (`I/1`), quando houver. */
  readonly itemDoAnexo: string | null;
  readonly vigencia: Vigencia;
  readonly excecoes: readonly ExcecaoDePrefixo[];
}

/** Item de anexo da LC 214/2025 citado pelos vínculos de NCM e NBS. */
export interface RegistroAnexo {
  readonly chave: string;
  readonly anexo: string;
  readonly item: string | null;
  readonly descricao: string | null;
  readonly texto: string | null;
  readonly vigencia: Vigencia;
}

/** NFS-e: vínculo NBS x cClassTrib x indicador de operação (cIndOp) x item da LC 116. */
export interface RegistroNfseNbs {
  readonly chave: string;
  readonly nbs: string;
  readonly chaveClassTrib: string;
  readonly cClassTrib: string;
  readonly itemLc116: string;
  readonly cIndOp: string;
  readonly onerosa: boolean;
  readonly adquirenteExterior: boolean;
  readonly vigencia: Vigencia;
}

export interface RegistroGrupoDeAtores {
  readonly chave: string;
  readonly id: number;
  readonly descricao: string;
  readonly ordem: number;
  readonly vigencia: Vigencia;
}

export interface RegistroAtor {
  readonly chave: string;
  readonly id: number;
  readonly grupo: number;
  readonly descricao: string;
  readonly ordem: number;
  readonly vigencia: Vigencia;
}

export type PapelDoAtor = 'Fornecedor' | 'Adquirente';

export interface RegistroAtorClassTrib {
  readonly chave: string;
  readonly ator: number;
  readonly papel: PapelDoAtor;
  readonly chaveClassTrib: string;
  readonly cClassTrib: string;
  readonly vigencia: Vigencia;
}

export interface RegistroTipoDfe {
  readonly chave: string;
  readonly sigla: string;
  readonly modelo: number;
  readonly descricao: string;
  readonly vigencia: Vigencia;
}

/** Redutor de compras governamentais (LC 214/2025, arts. 370 e 472), em percentual. */
export interface RegistroRedutorCompraGov {
  readonly chave: string;
  readonly pRedutor: Dec;
  readonly vigencia: Vigencia;
}

/** Percentual da CBS transferido ao ente contratante na compra governamental (art. 473, com a transição). */
export interface RegistroTransferenciaCbs {
  readonly chave: string;
  readonly percentual: Dec;
  readonly vigencia: Vigencia;
}

export interface TabelasDoDataset {
  readonly cst: readonly RegistroCst[];
  readonly classTrib: readonly RegistroClassTrib[];
  readonly tratamentos: readonly RegistroTratamento[];
  readonly credPres: readonly RegistroCredPres[];
  readonly aplicabilidadeNcm: readonly RegistroAplicabilidade[];
  readonly aplicabilidadeNbs: readonly RegistroAplicabilidade[];
  readonly anexos: readonly RegistroAnexo[];
  readonly nfseNbs: readonly RegistroNfseNbs[];
  readonly gruposDeAtores: readonly RegistroGrupoDeAtores[];
  readonly atores: readonly RegistroAtor[];
  readonly atorClassTrib: readonly RegistroAtorClassTrib[];
  readonly tiposDfe: readonly RegistroTipoDfe[];
  readonly redutorCompraGov: readonly RegistroRedutorCompraGov[];
  readonly transferenciaCbs: readonly RegistroTransferenciaCbs[];
}

export type NomeDaTabela = keyof TabelasDoDataset;

/** Artefato oficial de onde o dataset foi extraído. */
export interface FonteDoDataset {
  readonly id: IdDaFonte;
  readonly tipo: 'CALCULADORA_OFFLINE' | 'IT' | 'NT' | 'LEI';
  readonly titulo: string;
  /** Versão oficial (`V0057`, `v1.60`). */
  readonly versao: string;
  /** Data da versão oficial. */
  readonly data: DataIso;
  readonly url: string;
  readonly sha256: string;
  /** Hashes adicionais que fixam o artefato (camada do rootfs, arquivo interno). */
  readonly pins?: Readonly<Record<string, string>>;
  readonly notas?: string;
}

export interface ManifestoDaTabela {
  readonly nome: NomeDaTabela;
  readonly registros: number;
  readonly sha256: string;
}

export interface ManifestoDoDataset {
  readonly versaoDoFormato: number;
  /** Mês da base oficial mais recente dentro do dataset, `AAAA.MM` (a versão do pacote é `AAAA.M.patch`). */
  readonly versaoDosDados: string;
  /** Data de conhecimento: a data da versão oficial mais recente, não a da coleta (determinismo). */
  readonly conhecidoEm: DataIso;
  readonly fontes: readonly FonteDoDataset[];
  readonly tabelas: readonly ManifestoDaTabela[];
  /** sha256 das linhas `sha256  nome` das tabelas, em ordem; identifica o conteúdo. */
  readonly sha256DoDataset: string;
}

/** O dataset serializado: o que o pacote embarca e o que se carrega em runtime de outra origem. */
export interface BundleDoDataset {
  readonly manifesto: ManifestoDoDataset;
  readonly tabelas: TabelasDoDataset;
}
