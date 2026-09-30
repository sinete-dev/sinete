// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_MDFe_300b_NT012025_1.05. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * MDF-e 3.00b (NT 2025.001 v1.04): MDFe, mdfeProc e retMDFe (retorno da recepção síncrona), com o infModal (xs:any) ligado aos quatro modais como dado.
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - mdfe/PL_MDFe_300b_NT012025_1.05 (PL_MDFe_300b_NT012025_1.04.zip)
 */
import type { ComplexType, DescricaoModuloSchema, ElementoRaiz, SimpleType } from "../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: DescricaoModuloSchema = {
  "subpath": "mdfe/3.00b",
  "documento": "mdfe",
  "pl": "PL_MDFe_300b_NT012025_1.05",
  "fontes": [
    {
      "pacote": "mdfe/PL_MDFe_300b_NT012025_1.05",
      "arquivo": "PL_MDFe_300b_NT012025_1.04.zip",
      "sha256": "fc53c880bd757d5b03b79de15dd7687259dfbfa38fed85e9ebb9c638b93854cc",
      "url": "https://dfe-portal.svrs.rs.gov.br/MDFE/DownloadArquivoEstatico/?sistema=MDFE&tipoArquivo=2&nomeArquivo=PL_MDFe_300b_NT012025_1.04.zip"
    }
  ]
};

// ---------- tipos ----------

/**
 * Informações dos Municípios de Carregamento
 * xsd: tipo anônimo de TMDFe.infMDFe.ide.infMunCarrega
 */
export type TMDFe_infMDFe_ide_infMunCarrega = {
  /**
   * Código do Município de Carregamento
   * xsd:TCodMunIBGE, pattern `[0-9]{7}`
   */
  cMunCarrega: string;
  /**
   * Nome do Município de Carregamento
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMunCarrega: string;
};

/**
 * Tipo Sigla da UF
 * xsd:TUf
 */
export type TUf = "AC" | "AL" | "AM" | "AP" | "BA" | "CE" | "DF" | "ES" | "GO" | "MA" | "MG" | "MS" | "MT" | "PA" | "PB" | "PE" | "PI" | "PR" | "RJ" | "RN" | "RO" | "RR" | "RS" | "SC" | "SE" | "SP" | "TO" | "EX";

/**
 * Informações do Percurso do MDF-e
 * xsd: tipo anônimo de TMDFe.infMDFe.ide.infPercurso
 */
export type TMDFe_infMDFe_ide_infPercurso = {
  /**
   * Sigla das Unidades da Federação do percurso do veículo.
   * Não é necessário repetir as UF de Início e Fim
   * xsd:TUf
   */
  UFPer: TUf;
};

/**
 * Tipo Código da UF da tabela do IBGE
 * xsd:TCodUfIBGE
 */
export type TCodUfIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53";

/**
 * Tipo Ambiente
 * xsd:TAmb
 */
export type TAmb = "1" | "2";

/**
 * Tipo Emitente
 * xsd:TEmit
 */
export type TEmit = "1" | "2" | "3";

/**
 * Tipo Transportador
 * xsd:TTransp
 */
export type TTransp = "1" | "2" | "3";

/**
 * Tipo Modelo Manifesto de Documento Fiscal Eletrônico
 * xsd:TModMD
 */
export type TModMD = "58";

/**
 * Tipo Modal Manifesto
 * xsd:TModalMD
 */
export type TModalMD = "1" | "2" | "3" | "4";

/**
 * Identificação do MDF-e
 * xsd: tipo anônimo de TMDFe.infMDFe.ide
 */
export type TMDFe_infMDFe_ide = {
  /**
   * Código da UF do emitente do MDF-e
   * Código da UF do emitente do Documento Fiscal. Utilizar a
   * Tabela do IBGE de código de unidades da federação.
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * Tipo do Ambiente
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Tipo do Emitente
   * 1 - Prestador de serviço de transporte
   * 2 - Transportador de Carga Própria 3 - Prestador de serviço de transporte que emitirá CT-e Globalizado
   * OBS: Deve ser preenchido com 2 para emitentes de NF-e e pelas transportadoras quando estiverem fazendo transporte de carga própria. Deve ser preenchido com 3 para transportador de carga que emitirá à posteriori CT-e Globalizado relacionando as NF-e.
   * xsd:TEmit
   */
  tpEmit: TEmit;
  /**
   * Tipo do Transportador
   * 1 - ETC
   * 2 - TAC
   * 3 - CTC
   * xsd:TTransp
   */
  tpTransp?: TTransp;
  /**
   * Modelo do Manifesto Eletrônico
   * Utilizar o código 58 para identificação do MDF-e
   * xsd:TModMD
   */
  mod: TModMD;
  /**
   * Série do Manifesto
   * Informar a série do documento fiscal (informar zero se inexistente).
   * Série na faixa [920-969]: Reservada para emissão por contribuinte pessoa física com inscrição estadual.
   * xsd:TSerie, pattern `0|[1-9]{1}[0-9]{0,2}`
   */
  serie: string;
  /**
   * Número do Manifesto
   * Número que identifica o Manifesto. 1 a 999999999.
   * xsd:TNF, pattern `[1-9]{1}[0-9]{0,8}`
   */
  nMDF: string;
  /**
   * Código numérico que compõe a Chave de Acesso.
   * Código aleatório gerado pelo emitente, com o objetivo de evitar acessos indevidos ao documento.
   * pattern `[0-9]{8}`
   */
  cMDF: string;
  /**
   * Digito verificador da chave de acesso do Manifesto
   * Informar o dígito  de controle da chave de acesso do MDF-e, que deve ser calculado com a aplicação do algoritmo módulo 11 (base 2,9) da chave de acesso.
   * pattern `[0-9]{1}`
   */
  cDV: string;
  /**
   * Modalidade de transporte
   * 1 - Rodoviário;
   * 2 - Aéreo; 3 - Aquaviário; 4 - Ferroviário.
   * xsd:TModalMD
   */
  modal: TModalMD;
  /**
   * Data e hora de emissão do Manifesto
   * Formato AAAA-MM-DDTHH:MM:DD TZD
   * xsd:TDateTimeUTC
   */
  dhEmi: string;
  /**
   * Forma de emissão do Manifesto
   * 1 - Normal
   * ; 2 - Contingência; 3-Regime Especial NFF
   */
  tpEmis: "1" | "2" | "3";
  /**
   * Identificação do processo de emissão do Manifesto
   * 0 - emissão de MDFe com aplicativo do contribuinte
   * 4- emissão de MDFe por Provedor de Assinatura e Autorização - PAA
   * xsd:TProcEmi
   */
  procEmi: "0" | "4";
  /**
   * Versão do processo de emissão
   * Informar a versão do aplicativo emissor de MDF-e.
   * xsd:TString, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verProc: string;
  /**
   * Sigla da UF do Carregamento
   * Utilizar a Tabela do IBGE de código de unidades da federação.
   * Informar 'EX' para operações com o exterior.
   * xsd:TUf
   */
  UFIni: TUf;
  /**
   * Sigla da UF do Descarregamento
   * Utilizar a Tabela do IBGE de código de unidades da federação.
   * Informar 'EX' para operações com o exterior.
   * xsd:TUf
   */
  UFFim: TUf;
  /**
   * Informações dos Municípios de Carregamento
   * ocorre 1..50
   */
  infMunCarrega: TMDFe_infMDFe_ide_infMunCarrega[];
  /**
   * Informações do Percurso do MDF-e
   * ocorre 0..25
   */
  infPercurso?: TMDFe_infMDFe_ide_infPercurso[];
  /**
   * Data e hora previstos de inicio da viagem
   * Formato AAAA-MM-DDTHH:MM:DD TZD
   * xsd:TDateTimeUTC
   */
  dhIniViagem?: string;
  /** Indicador de participação do Canal Verde */
  indCanalVerde?: "1";
  /** Indicador de MDF-e com inclusão da Carga posterior a emissão por evento de inclusão de DF-e */
  indCarregaPosterior?: "1";
};

/**
 * Tipo Dados do Endereço
 * xsd: TEndeEmi
 */
export type TEndeEmi = {
  /**
   * Logradouro
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xLgr: string;
  /**
   * Número
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nro: string;
  /**
   * Complemento
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xCpl?: string;
  /**
   * Bairro
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xBairro: string;
  /**
   * Código do município (utilizar a tabela do IBGE), informar 9999999 para operações com o exterior.
   * xsd:TCodMunIBGE, pattern `[0-9]{7}`
   */
  cMun: string;
  /**
   * Nome do município, , informar EXTERIOR para operações com o exterior.
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMun: string;
  /**
   * CEP
   * Informar zeros não significativos
   * pattern `[0-9]{8}`
   */
  CEP?: string;
  /**
   * Sigla da UF, , informar EX para operações com o exterior.
   * xsd:TUf
   */
  UF: TUf;
  /**
   * Telefone
   * pattern `[0-9]{7,12}`
   */
  fone?: string;
  /**
   * Endereço de E-mail
   * xsd:TEmail, tamanho 6..60, pattern `[^@]+@[^\.]+\..+`
   */
  email?: string;
};

/**
 * Identificação do Emitente do Manifesto
 * xsd: tipo anônimo de TMDFe.infMDFe.emit
 */
export type TMDFe_infMDFe_emit = {
  /**
   * Inscrição Estadual do emitemte
   * xsd:TIe, pattern `[0-9]{2,14}`
   */
  IE?: string;
  /**
   * Razão social ou Nome do emitente
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome: string;
  /**
   * Nome fantasia do emitente
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xFant?: string;
  /** Endereço do emitente */
  enderEmit: TEndeEmi;
} & (
  ({
  /**
   * CNPJ do emitente
   * Informar zeros não significativos
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * CPF do emitente
   * Informar zeros não significativos.
   * Usar com série específica 920-969 para emitente pessoa física com inscrição estadual.
   * Poderá ser usado também para emissão do Regime Especial da Nota Fiscal Fácil
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

/**
 * Dados do CIOT
 * xsd: tipo anônimo de rodo.infANTT.infCIOT
 */
export type rodo_infANTT_infCIOT = {
  /**
   * Código Identificador da Operação de Transporte
   * Também Conhecido como conta frete
   * xsd:TCIOT
   */
  CIOT?: string;
} & (
  ({
  /**
   * Número do CPF responsável pela geração do CIOT
   * Informar os zeros não significativos.
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
  | ({
  /**
   * Número do CNPJ responsável pela geração do CIOT
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
);

/**
 * Informações dos dispositivos do Vale Pedágio
 * xsd: tipo anônimo de rodo.infANTT.valePed.disp
 */
export type rodo_infANTT_valePed_disp = {
  /**
   * CNPJ da empresa fornecedora do Vale-Pedágio
   * - CNPJ da Empresa Fornecedora do Vale-Pedágio, ou seja, empresa que fornece ao Responsável pelo Pagamento do Vale-Pedágio os dispositivos do Vale-Pedágio.
   * - Informar os zeros não significativos.
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJForn: string;
  /**
   * Identificador do vale pedagio obrigatório - IDVPO
   * pattern `[0-9]{1,20}`
   */
  nCompra?: string;
  /**
   * Valor do Vale-Pedagio
   * Valor do Vale-Pedágio obrigatório necessário à livre circulação, desde a origem da operação de transporte até o destino, do transportador contratado.
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vValePed: string;
  /**
   * Tipo do Vale Pedagio
   * 01 - TAG; 04 - Leitura de placa (pela placa de identificação veicular)
   */
  tpValePed?: "01" | "04";
} & (
  ({
  /**
   * CNPJ do responsável pelo pagamento do Vale-Pedágio
   * - responsável pelo pagamento do Vale Pedágio. Informar somente quando o responsável não for o emitente do MDF-e.
   * - Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJPg: string;
  CPFPg?: never;
})
  | ({
  /**
   * CNPJ do responsável pelo pagamento do Vale-Pedágio
   * Informar os zeros não significativos.
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPFPg: string;
  CNPJPg?: never;
})
  | ({ CNPJPg?: never; CPFPg?: never })
);

/**
 * Informações de Vale Pedágio
 * Outras informações sobre Vale-Pedágio obrigatório que não tenham campos específicos devem ser informadas no campo de observações gerais de uso livre pelo contribuinte, visando atender as determinações legais vigentes.
 * xsd: tipo anônimo de rodo.infANTT.valePed
 */
export type rodo_infANTT_valePed = {
  /**
   * Informações dos dispositivos do Vale Pedágio
   * ocorre 1..n
   */
  disp: rodo_infANTT_valePed_disp[];
  /**
   * Categoria de Combinação Veicular
   * Preencher com:
   * 02 Veículo Comercial 2 eixos;0
   * 4 Veículo Comercial 3 eixos;
   * 06 Veículo Comercial 4 eixos;0
   * 7 Veículo Comercial 5 eixos; 0
   * 8 Veículo Comercial 6 eixos;
   * 10 Veículo Comercial 7 eixos;
   * 11 Veículo Comercial 8 eixos;
   * 12 Veículo Comercial 9 eixos;
   * 13 Veículo Comercial 10 eixos;
   * 14 Veículo Comercial Acima de 10 eixos;
   */
  categCombVeic?: "02" | "04" | "06" | "07" | "08" | "10" | "11" | "12" | "13" | "14";
};

/**
 * Grupo de informações do contrato entre transportador e contratante
 * xsd: tipo anônimo de rodo.infANTT.infContratante.infContrato
 */
export type rodo_infANTT_infContratante_infContrato = {
  /**
   * Número do contrato do transportador com o contratante quando este existir para prestações continuadas
   * tamanho 2..20
   */
  NroContrato: string;
  /**
   * Valor global do contrato
   * xsd:TDec_1302Opc, pattern `0\.[0-9]{1}[1-9]{1}|0\.[1-9]{1}[0-9]{1}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vContratoGlobal: string;
};

/**
 * Grupo de informações dos contratantes do serviço de transporte
 * xsd: tipo anônimo de rodo.infANTT.infContratante
 */
export type rodo_infANTT_infContratante = {
  /**
   * Razão social ou Nome do contratante
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome?: string;
  /** Grupo de informações do contrato entre transportador e contratante */
  infContrato?: rodo_infANTT_infContratante_infContrato;
} & (
  ({
  /**
   * Número do CPF do contratante do serviço
   * Informar os zeros não significativos.
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never; idEstrangeiro?: never;
})
  | ({
  /**
   * Número do CNPJ do contratante do serviço
   * Informar os zeros não significativos.
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never; idEstrangeiro?: never;
})
  | ({
  /**
   * Identificador do contratante em caso de contratante estrangeiro
   * tamanho 2..20, pattern `([!-ÿ]{0}|[!-ÿ]{2,20})?`
   */
  idEstrangeiro: string;
  CPF?: never; CNPJ?: never;
})
);

/**
 * Componentes do Pagamentoi do Contrato
 * xsd: tipo anônimo de rodo.infANTT.infPag.Comp
 */
export type rodo_infANTT_infPag_Comp = {
  /**
   * Tipo do Componente
   * Preencher com:
   * 01 - Vale Pedágio;
   * 02 - Impostos, taxas e contribuições;
   * 03 - Despesas (bancárias, meios de pagamento, outras);
   * 04 - Frete
   * 99 - Outros
   */
  tpComp: "01" | "02" | "03" | "04" | "99";
  /**
   * Valor do componente
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vComp: string;
  /**
   * Descrição do componente do tipo Outros
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xComp?: string;
};

/**
 * Informações do pagamento a prazo.
 * Informar somente se indPag for à Prazo
 * xsd: tipo anônimo de rodo.infANTT.infPag.infPrazo
 */
export type rodo_infANTT_infPag_infPrazo = {
  /**
   * Número da Parcela
   * pattern `[0-9]{3}`
   */
  nParcela: string;
  /**
   * Data de vencimento da Parcela (AAAA-MM-DD)
   * xsd:TData
   */
  dVenc: string;
  /**
   * Valor da Parcela
   * xsd:TDec_1302Opc, pattern `0\.[0-9]{1}[1-9]{1}|0\.[1-9]{1}[0-9]{1}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vParcela: string;
};

/**
 * Informações bancárias
 * xsd: tipo anônimo de rodo.infANTT.infPag.infBanc
 */
export type rodo_infANTT_infPag_infBanc = {

} & (
  ({
  /**
   * Número do banco
   * xsd:TString, tamanho 3..5, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  codBanco: string;
  /**
   * Número da agência bancária
   * xsd:TString, tamanho 1..10, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  codAgencia: string;
  CNPJIPEF?: never; PIX?: never;
})
  | ({
  /**
   * Número do CNPJ da Instituição de Pagamento Eletrônico do Frete
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJIPEF: string;
  codBanco?: never; codAgencia?: never; PIX?: never;
})
  | ({
  /**
   * Chave PIX
   * Informar a chave PIX para recebimento do frete.
   * Pode ser email, CPF/ CNPJ (somente numeros), Telefone com a seguinte formatação (+5599999999999) ou a chave aleatória gerada pela instituição.
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  PIX: string;
  codBanco?: never; codAgencia?: never; CNPJIPEF?: never;
})
);

/**
 * Informações do Pagamento do Contrato
 * xsd: tipo anônimo de rodo.infANTT.infPag
 */
export type rodo_infANTT_infPag = {
  /**
   * Razão social ou Nome do respnsável pelo pagamento
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome?: string;
  /**
   * Componentes do Pagamentoi do Contrato
   * ocorre 1..n
   */
  Comp: rodo_infANTT_infPag_Comp[];
  /**
   * Valor Total do Contrato
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vContrato: string;
  /**
   * Indicador de operação de transporte de alto desempenho
   * Operação de transporte com utilização de veículos de frotas dedicadas ou fidelizadas.
   * Preencher com “1” para indicar operação de transporte de alto desempenho, demais casos não informar a tag
   */
  indAltoDesemp?: "1";
  /** Indicador da Forma de Pagamento:0-Pagamento à Vista;1-Pagamento à Prazo; */
  indPag: "0" | "1";
  /**
   * Valor do Adiantamento (usar apenas em pagamento à Prazo
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vAdiant?: string;
  /**
   * Indicador para declarar concordância em antecipar o adiantamento
   * Informar a tag somente se for autorizado antecipar o adiantamento
   */
  indAntecipaAdiant?: "1";
  /**
   * Informações do pagamento a prazo.
   * Informar somente se indPag for à Prazo
   * ocorre 0..n
   */
  infPrazo?: rodo_infANTT_infPag_infPrazo[];
  /**
   * Tipo de Permissão em relação a antecipação das parcelas
   * 0 - Não permite antecipar
   * 1 - Permite antecipar as parcelas
   * 2 - Permite antecipar as parcelas mediante confirmação
   */
  tpAntecip?: "0" | "1" | "2";
  /** Informações bancárias */
  infBanc: rodo_infANTT_infPag_infBanc;
} & (
  ({
  /**
   * Número do CPF do responsável pelo pgto
   * Informar os zeros não significativos.
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never; idEstrangeiro?: never;
})
  | ({
  /**
   * Número do CNPJ do responsável pelo pgto
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never; idEstrangeiro?: never;
})
  | ({
  /**
   * Identificador do responsável pelo pgto em caso de ser estrangeiro
   * tamanho 2..20, pattern `([!-ÿ]{0}|[!-ÿ]{5,20})?`
   */
  idEstrangeiro: string;
  CPF?: never; CNPJ?: never;
})
);

/**
 * Grupo de informações para Agência Reguladora
 * xsd: tipo anônimo de rodo.infANTT
 */
export type rodo_infANTT = {
  /**
   * Registro Nacional de Transportadores Rodoviários de Carga
   * Registro obrigatório do emitente do MDF-e junto à ANTT para exercer a atividade de transportador rodoviário de cargas por conta de terceiros e mediante remuneração.
   * xsd:TRNTRC
   */
  RNTRC?: string;
  /**
   * Dados do CIOT
   * ocorre 0..n
   */
  infCIOT?: rodo_infANTT_infCIOT[];
  /**
   * Informações de Vale Pedágio
   * Outras informações sobre Vale-Pedágio obrigatório que não tenham campos específicos devem ser informadas no campo de observações gerais de uso livre pelo contribuinte, visando atender as determinações legais vigentes.
   */
  valePed?: rodo_infANTT_valePed;
  /**
   * Grupo de informações dos contratantes do serviço de transporte
   * ocorre 0..n
   */
  infContratante?: rodo_infANTT_infContratante[];
  /**
   * Informações do Pagamento do Contrato
   * ocorre 0..n
   */
  infPag?: rodo_infANTT_infPag[];
};

/**
 * Proprietário ou possuidor do Veículo.
 * Só preenchido quando o veículo não pertencer à empresa emitente do MDF-e
 * xsd: tipo anônimo de rodo.veicTracao.prop
 */
export type rodo_veicTracao_prop = {
  /**
   * Registro Nacional dos Transportadores Rodoviários de Carga
   * Registro obrigatório do proprietário, co-proprietário ou arrendatário do veículo junto à ANTT para exercer a atividade de transportador rodoviário de cargas por conta de terceiros e mediante remuneração.
   * xsd:TRNTRC
   */
  RNTRC: string;
  /**
   * Razão Social ou Nome do proprietário
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome: string;
  /**
   * Inscrição Estadual
   * xsd:TIeDest, pattern `[0-9]{0,14}|ISENTO|PR[0-9]{4,8}`
   */
  IE?: string;
  /**
   * UF
   * xsd:TUf
   */
  UF?: TUf;
  /**
   * Tipo Proprietário ou possuidor
   * Preencher com:
   * 0-TAC Agregado;
   * 1-TAC Independente;
   * 2 – Outros.
   */
  tpProp: "0" | "1" | "2";
} & (
  ({
  /**
   * Número do CPF
   * Informar os zeros não significativos.
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
  | ({
  /**
   * Número do CNPJ
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
);

/**
 * Informações do(s) Condutor(es) do veículo
 * xsd: tipo anônimo de rodo.veicTracao.condutor
 */
export type rodo_veicTracao_condutor = {
  /**
   * Nome do Condutor
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome: string;
  /**
   * CPF do Condutor
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
};

/**
 * Dados do Veículo com a Tração
 * xsd: tipo anônimo de rodo.veicTracao
 */
export type rodo_veicTracao = {
  /**
   * Código interno do veículo
   * xsd:TString, tamanho 1..10, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cInt?: string;
  /**
   * Placa do veículo
   * xsd:TPlaca, pattern `[A-Z]{2,3}[0-9]{4}|[A-Z]{3,4}[0-9]{3}|[A-Z0-9]{7}`
   */
  placa: string;
  /**
   * RENAVAM do veículo
   * xsd:TString, tamanho 9..11, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  RENAVAM?: string;
  /**
   * Tara em KG
   * pattern `0|[1-9]{1}[0-9]{0,5}`
   */
  tara: string;
  /**
   * Capacidade em KG
   * pattern `0|[1-9]{1}[0-9]{0,5}`
   */
  capKG?: string;
  /**
   * Capacidade em M3
   * pattern `0|[1-9]{1}[0-9]{0,2}`
   */
  capM3?: string;
  /**
   * Proprietário ou possuidor do Veículo.
   * Só preenchido quando o veículo não pertencer à empresa emitente do MDF-e
   */
  prop?: rodo_veicTracao_prop;
  /**
   * Informações do(s) Condutor(es) do veículo
   * ocorre 1..10
   */
  condutor: rodo_veicTracao_condutor[];
  /**
   * Tipo de Rodado
   * Preencher com:
   * 01 - Truck;
   * 02 - Toco;
   * 03 - Cavalo Mecânico;
   * 04 - VAN;
   * 05 - Utilitário;
   * 06 - Outros.
   */
  tpRod: "01" | "02" | "03" | "04" | "05" | "06";
  /**
   * Tipo de Carroceria
   * Preencher com:
   * 00 - não aplicável;
   * 01 - Aberta;
   * 02 - Fechada/Baú;
   * 03 - Granelera;
   * 04 - Porta Container;
   * 05 - Sider
   */
  tpCar: "00" | "01" | "02" | "03" | "04" | "05";
  /**
   * UF em que veículo está licenciado
   * Sigla da UF de licenciamento do veículo.
   * xsd:TUf
   */
  UF?: TUf;
};

/**
 * Proprietários ou possuidor do Veículo.
 * Só preenchido quando o veículo não pertencer à empresa emitente do MDF-e
 * xsd: tipo anônimo de rodo.veicReboque.prop
 */
export type rodo_veicReboque_prop = {
  /**
   * Registro Nacional dos Transportadores Rodoviários de Carga
   * Registro obrigatório do proprietário, co-proprietário ou arrendatário do veículo junto à ANTT para exercer a atividade de transportador rodoviário de cargas por conta de terceiros e mediante remuneração.
   * xsd:TRNTRC
   */
  RNTRC: string;
  /**
   * Razão Social ou Nome do proprietário
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome: string;
  /**
   * Inscrição Estadual
   * xsd:TIeDest, pattern `[0-9]{0,14}|ISENTO|PR[0-9]{4,8}`
   */
  IE?: string;
  /**
   * UF
   * xsd:TUf
   */
  UF?: TUf;
  /**
   * Tipo Proprietário ou possuidor
   * Preencher com:
   * 0-TAC Agregado;
   * 1-TAC Independente;
   * 2 – Outros.
   */
  tpProp: "0" | "1" | "2";
} & (
  ({
  /**
   * Número do CPF
   * Informar os zeros não significativos.
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
  | ({
  /**
   * Número do CNPJ
   * Informar os zeros não significativos.
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
);

/**
 * Dados dos reboques
 * xsd: tipo anônimo de rodo.veicReboque
 */
export type rodo_veicReboque = {
  /**
   * Código interno do veículo
   * xsd:TString, tamanho 1..10, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cInt?: string;
  /**
   * Placa do veículo
   * xsd:TPlaca, pattern `[A-Z]{2,3}[0-9]{4}|[A-Z]{3,4}[0-9]{3}|[A-Z0-9]{7}`
   */
  placa: string;
  /**
   * RENAVAM do veículo
   * xsd:TString, tamanho 9..11, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  RENAVAM?: string;
  /**
   * Tara em KG
   * pattern `0|[1-9]{1}[0-9]{0,5}`
   */
  tara: string;
  /**
   * Capacidade em KG
   * pattern `0|[1-9]{1}[0-9]{0,5}`
   */
  capKG: string;
  /**
   * Capacidade em M3
   * pattern `0|[1-9]{1}[0-9]{0,2}`
   */
  capM3?: string;
  /**
   * Proprietários ou possuidor do Veículo.
   * Só preenchido quando o veículo não pertencer à empresa emitente do MDF-e
   */
  prop?: rodo_veicReboque_prop;
  /**
   * Tipo de Carroceria
   * Preencher com:
   * 00 - não aplicável;
   * 01 - Aberta;
   * 02 - Fechada/Baú;
   * 03 - Granelera;
   * 04 - Porta Container;
   * 05 - Sider
   */
  tpCar: "00" | "01" | "02" | "03" | "04" | "05";
  /**
   * UF em que veículo está licenciado
   * Sigla da UF de licenciamento do veículo.
   * xsd:TUf
   */
  UF?: TUf;
};

/**
 * Lacres
 * xsd: tipo anônimo de rodo.lacRodo
 */
export type rodo_lacRodo = {
  /**
   * Número do Lacre
   * xsd:TString, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nLacre: string;
};

/**
 * Informações do modal Rodoviário
 * xsd: tipo anônimo de rodo
 */
export type rodo = {
  /** Grupo de informações para Agência Reguladora */
  infANTT?: rodo_infANTT;
  /** Dados do Veículo com a Tração */
  veicTracao: rodo_veicTracao;
  /**
   * Dados dos reboques
   * ocorre 0..3
   */
  veicReboque?: rodo_veicReboque[];
  /**
   * Código de Agendamento no porto
   * xsd:TString, tamanho 0..16, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  codAgPorto?: string;
  /**
   * Lacres
   * ocorre 0..n
   */
  lacRodo?: rodo_lacRodo[];
};

/**
 * Informações do modal Aéreo
 * xsd: tipo anônimo de aereo
 */
export type aereo = {
  /**
   * Marca da Nacionalidade da aeronave
   * tamanho 1..4, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nac: string;
  /**
   * Marca de Matrícula da aeronave
   * tamanho 1..6, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  matr: string;
  /**
   * Número do Voo
   * Formato = AB1234, sendo AB a designação da empresa e 1234 o número do voo. Quando não for possível incluir as marcas de nacionalidade e matrícula sem hífen.
   * xsd:TString, tamanho 5..9, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nVoo: string;
  /**
   * Aeródromo de Embarque
   * O código de três letras IATA do aeroporto de partida deverá ser incluído como primeira anotação. Quando não for possível, utilizar a sigla OACI.
   * xsd:TString, tamanho 3..4, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cAerEmb: string;
  /**
   * Aeródromo de Destino
   * O código de três letras IATA do aeroporto de destino deverá ser incluído como primeira anotação. Quando não for possível, utilizar a sigla OACI.
   * xsd:TString, tamanho 3..4, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cAerDes: string;
  /**
   * Data do Voo
   * Formato AAAA-MM-DD
   * xsd:TData
   */
  dVoo: string;
};

/**
 * Grupo de informações dos terminais de carregamento.
 * xsd: tipo anônimo de aquav.infTermCarreg
 */
export type aquav_infTermCarreg = {
  /**
   * Código do Terminal de Carregamento
   * Preencher de acordo com a Tabela de Terminais de Carregamento. O código de cada Porto está definido no Ministério de Transportes.
   * xsd:TString, tamanho 1..8, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cTermCarreg: string;
  /**
   * Nome do Terminal de Carregamento
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xTermCarreg: string;
};

/**
 * Grupo de informações dos terminais de descarregamento.
 * xsd: tipo anônimo de aquav.infTermDescarreg
 */
export type aquav_infTermDescarreg = {
  /**
   * Código do Terminal de Descarregamento
   * Preencher de acordo com a Tabela de Terminais de Descarregamento. O código de cada Porto está definido no Ministério de Transportes.
   * xsd:TString, tamanho 1..8, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cTermDescarreg: string;
  /**
   * Nome do Terminal de Descarregamento
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xTermDescarreg: string;
};

/**
 * Informações das Embarcações do Comboio
 * xsd: tipo anônimo de aquav.infEmbComb
 */
export type aquav_infEmbComb = {
  /**
   * Código da embarcação do comboio
   * xsd:TString, tamanho 1..10, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cEmbComb: string;
  /**
   * Identificador da Balsa
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xBalsa: string;
};

/**
 * Informações das Undades de Carga vazias
 * xsd: tipo anônimo de aquav.infUnidCargaVazia
 */
export type aquav_infUnidCargaVazia = {
  /**
   * Identificação da unidades de carga vazia
   * xsd:TContainer, tamanho 1..20, pattern `[A-Z0-9]+`
   */
  idUnidCargaVazia: string;
  /**
   * Tipo da unidade de carga vazia
   * 1 - Container; 2 - ULD;3 - Pallet;4 - Outros;
   * xsd:TString, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  tpUnidCargaVazia: "1" | "2" | "3" | "4";
};

/**
 * Informações das Undades de Transporte vazias
 * xsd: tipo anônimo de aquav.infUnidTranspVazia
 */
export type aquav_infUnidTranspVazia = {
  /**
   * Identificação da unidades de transporte vazia
   * xsd:TContainer, tamanho 1..20, pattern `[A-Z0-9]+`
   */
  idUnidTranspVazia: string;
  /**
   * Tipo da unidade de transporte vazia
   * Deve ser preenchido com “1” para Rodoviário Tração do tipo caminhão ou “2” para Rodoviário reboque do tipo carreta
   * xsd:TString, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  tpUnidTranspVazia: "1" | "2";
};

/**
 * Informações do modal Aquaviário
 * xsd: tipo anônimo de aquav
 */
export type aquav = {
  /**
   * Irin do navio sempre deverá ser informado
   * tamanho 1..10
   */
  irin: string;
  /**
   * Código do tipo de embarcação
   * Preencher com código da Tabela de Tipo de Embarcação definida no Ministério dos Transportes
   * pattern `[0-9]{2}`
   */
  tpEmb: string;
  /**
   * Código da embarcação
   * xsd:TString, tamanho 1..10, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cEmbar: string;
  /**
   * Nome da embarcação
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xEmbar: string;
  /**
   * Número da Viagem
   * pattern `[1-9]{1}[0-9]{0,9}`
   */
  nViag: string;
  /**
   * Código do Porto de Embarque
   * Preencher de acordo com Tabela de Portos definida no Ministério dos Transportes
   * xsd:TString, tamanho 1..5, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cPrtEmb: string;
  /**
   * Código do Porto de Destino
   * Preencher de acordo com Tabela de Portos definida no Ministério dos Transportes
   * xsd:TString, tamanho 1..5, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  cPrtDest: string;
  /**
   * Porto de Transbordo
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  prtTrans?: string;
  /**
   * Tipo de Navegação
   * Preencher com:
   * 0 - Interior;
   * 1 - Cabotagem
   */
  tpNav?: "0" | "1";
  /**
   * Grupo de informações dos terminais de carregamento.
   * ocorre 0..5
   */
  infTermCarreg?: aquav_infTermCarreg[];
  /**
   * Grupo de informações dos terminais de descarregamento.
   * ocorre 0..5
   */
  infTermDescarreg?: aquav_infTermDescarreg[];
  /**
   * Informações das Embarcações do Comboio
   * ocorre 0..30
   */
  infEmbComb?: aquav_infEmbComb[];
  /**
   * Informações das Undades de Carga vazias
   * ocorre 0..n
   */
  infUnidCargaVazia?: aquav_infUnidCargaVazia[];
  /**
   * Informações das Undades de Transporte vazias
   * ocorre 0..n
   */
  infUnidTranspVazia?: aquav_infUnidTranspVazia[];
  /**
   * Maritime Mobile Service Identify
   * Preencher com o MMSI (Maritime Mobile Service Identify) fornecido pela ANATEL ou autoridade de telecomunicações de origem da embarcação
   * tamanho 1..9, pattern `[0-9]{9}`
   */
  MMSI?: string;
};

/**
 * Informações da composição do trem
 * xsd: tipo anônimo de ferrov.trem
 */
export type ferrov_trem = {
  /**
   * Prefixo do Trem
   * xsd:TString, tamanho 1..10, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xPref: string;
  /**
   * Data e hora de liberação do trem na origem
   * xsd:TDateTimeUTC
   */
  dhTrem?: string;
  /**
   * Origem do Trem
   * Sigla da estação de origem
   * xsd:TString, tamanho 1..3, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xOri: string;
  /**
   * Destino do Trem
   * Sigla da estação de destino
   * xsd:TString, tamanho 1..3, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xDest: string;
  /**
   * Quantidade de vagões carregados
   * pattern `[1-9]{1}[0-9]{0,2}`
   */
  qVag: string;
};

/**
 * informações dos Vagões
 * xsd: tipo anônimo de ferrov.vag
 */
export type ferrov_vag = {
  /**
   * Peso Base de Cálculo de Frete em Toneladas
   * xsd:TDec_0303, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{3})?`
   */
  pesoBC: string;
  /**
   * Peso Real em Toneladas
   * xsd:TDec_0303, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\.[0-9]{3})?`
   */
  pesoR: string;
  /**
   * Tipo de Vagão
   * xsd:TString, tamanho 3, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  tpVag?: string;
  /**
   * Serie de Identificação do vagão
   * xsd:TString, tamanho 3, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  serie: string;
  /**
   * Número de Identificação do vagão
   * tamanho 1..8, pattern `[1-9]{1}[0-9]{0,7}`
   */
  nVag: string;
  /**
   * Sequencia do vagão na composição
   * pattern `[1-9]{1}[0-9]{0,2}`
   */
  nSeq?: string;
  /**
   * Tonelada Útil
   * Unidade de peso referente à carga útil (apenas o peso da carga transportada), expressa em toneladas.
   * xsd:TDec_0302_0303, pattern `[0-9]{1,3}(\.[0-9]{2,3})?`
   */
  TU: string;
};

/**
 * Informações do modal Ferroviário
 * xsd: tipo anônimo de ferrov
 */
export type ferrov = {
  /** Informações da composição do trem */
  trem: ferrov_trem;
  /**
   * informações dos Vagões
   * ocorre 1..n
   */
  vag: ferrov_vag[];
};

/**
 * Informações do modal
 * xsd: tipo anônimo de TMDFe.infMDFe.infModal
 */
export type TMDFe_infMDFe_infModal = {
  /**
   * Versão do leiaute específico para o Modal
   * @attribute pattern `3\.(0[0-9]|[1-9][0-9])`
   */
  versaoModal: string;
} & (
  ({
  /** Informações do modal Rodoviário */
  rodo: rodo;
  aereo?: never; aquav?: never; ferrov?: never;
})
  | ({
  /** Informações do modal Aéreo */
  aereo: aereo;
  rodo?: never; aquav?: never; ferrov?: never;
})
  | ({
  /** Informações do modal Aquaviário */
  aquav: aquav;
  rodo?: never; aereo?: never; ferrov?: never;
})
  | ({
  /** Informações do modal Ferroviário */
  ferrov: ferrov;
  rodo?: never; aereo?: never; aquav?: never;
})
);

/**
 * Lacres das Unidades de Transporte
 * xsd: tipo anônimo de TUnidadeTransp.lacUnidTransp
 */
export type TUnidadeTransp_lacUnidTransp = {
  /**
   * Número do lacre
   * xsd:TString, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nLacre: string;
};

/**
 * Lacres das Unidades de Carga
 * xsd: tipo anônimo de TUnidCarga.lacUnidCarga
 */
export type TUnidCarga_lacUnidCarga = {
  /**
   * Número do lacre
   * xsd:TString, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nLacre: string;
};

/**
 * Tipo da Unidade de Carga
 * xsd:TtipoUnidCarga
 */
export type TtipoUnidCarga = "1" | "2" | "3" | "4";

/**
 * Tipo Dados Unidade de Carga
 * xsd: TUnidCarga
 */
export type TUnidCarga = {
  /**
   * Tipo da Unidade de Carga
   * 1 - Container;
   * 2 - ULD;
   * 3 - Pallet;
   * 4 - Outros;
   * xsd:TtipoUnidCarga
   */
  tpUnidCarga: TtipoUnidCarga;
  /**
   * Identificação da Unidade de Carga
   * Informar a identificação da unidade de carga, por exemplo: número do container.
   * xsd:TContainer, tamanho 1..20, pattern `[A-Z0-9]+`
   */
  idUnidCarga: string;
  /**
   * Lacres das Unidades de Carga
   * ocorre 0..n
   */
  lacUnidCarga?: TUnidCarga_lacUnidCarga[];
  /**
   * Quantidade rateada (Peso,Volume)
   * xsd:TDec_0302_0303, pattern `[0-9]{1,3}(\.[0-9]{2,3})?`
   */
  qtdRat?: string;
};

/**
 * Tipo da Unidade de Transporte
 * xsd:TtipoUnidTransp
 */
export type TtipoUnidTransp = "1" | "2" | "3" | "4" | "5" | "6" | "7";

/**
 * Tipo Dados Unidade de Transporte
 * xsd: TUnidadeTransp
 */
export type TUnidadeTransp = {
  /**
   * Tipo da Unidade de Transporte
   * 1 - Rodoviário Tração;
   * 2 - Rodoviário Reboque;
   * 3 - Navio;
   * 4 - Balsa;
   * 5 - Aeronave;
   * 6 - Vagão;
   * 7 - Outros
   * xsd:TtipoUnidTransp
   */
  tpUnidTransp: TtipoUnidTransp;
  /**
   * Identificação da Unidade de Transporte
   * Informar a identificação conforme o tipo de unidade de transporte.
   * Por exemplo: para rodoviário tração ou reboque deverá preencher com a placa do veículo.
   * xsd:TContainer, tamanho 1..20, pattern `[A-Z0-9]+`
   */
  idUnidTransp: string;
  /**
   * Lacres das Unidades de Transporte
   * ocorre 0..n
   */
  lacUnidTransp?: TUnidadeTransp_lacUnidTransp[];
  /**
   * Informações das Unidades de Carga (Containeres/ULD/Outros)
   * Dispositivo de carga utilizada (Unit Load Device - ULD) significa todo tipo de contêiner de carga, vagão, contêiner de avião, palete de aeronave com rede ou palete de aeronave com rede sobre um iglu.
   * ocorre 0..n
   */
  infUnidCarga?: TUnidCarga[];
  /**
   * Quantidade rateada (Peso,Volume)
   * xsd:TDec_0302_0303, pattern `[0-9]{1,3}(\.[0-9]{2,3})?`
   */
  qtdRat?: string;
};

/**
 * Preenchido quando for  transporte de produtos classificados pela ONU como perigosos.
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga.infCTe.peri
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_peri = {
  /**
   * Número ONU/UN
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * pattern `[0-9]{4}|ND`
   */
  nONU: string;
  /**
   * Nome apropriado para embarque do produto
   * Ver a legislação de transporte de produtos perigosos aplicada ao modo de transporte
   * xsd:TString, tamanho 1..150, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNomeAE?: string;
  /**
   * Classe ou subclasse/divisão, e risco subsidiário/risco secundário
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * xsd:TString, tamanho 1..40, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xClaRisco?: string;
  /**
   * Grupo de Embalagem
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * Preenchimento obrigatório para o modal aéreo.
   * A legislação para o modal rodoviário e ferroviário não atribui grupo de embalagem para todos os produtos, portanto haverá casos de não preenchimento desse campo.
   * xsd:TString, tamanho 1..6, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  grEmb?: string;
  /**
   * Quantidade total por produto
   * Preencher conforme a legislação de transporte de produtos perigosos aplicada ao modal
   * xsd:TString, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  qTotProd: string;
  /**
   * Quantidade e Tipo de volumes
   * Preencher conforme a legislação de transporte de produtos perigosos aplicada ao modal
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  qVolTipo?: string;
};

/**
 * Grupo de informações da Entrega Parcial (Corte de Voo)
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga.infCTe.infEntregaParcial
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infEntregaParcial = {
  /**
   * Quantidade total de volumes
   * xsd:TDec_1104, pattern `0|0\.[0-9]{4}|[1-9]{1}[0-9]{0,10}(\.[0-9]{4})?`
   */
  qtdTotal: string;
  /**
   * Quantidade de volumes enviados no MDF-e
   * xsd:TDec_1104, pattern `0|0\.[0-9]{4}|[1-9]{1}[0-9]{0,10}(\.[0-9]{4})?`
   */
  qtdParcial: string;
};

/**
 * Grupo de informações das NFe que foram entregues do CTe relacionado
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga.infCTe.infNFePrestParcial
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infNFePrestParcial = {
  /**
   * Nota Fiscal Eletrônica
   * xsd:TChCTe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chNFe: string;
};

/**
 * Conhecimentos de Tranporte - usar este grupo quando for prestador de serviço de transporte
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga.infCTe
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga_infCTe = {
  /**
   * Conhecimento Eletrônico - Chave de Acesso
   * xsd:TChCTe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chCTe: string;
  /**
   * Segundo código de barras
   * xsd:TSegCodBarra, pattern `[0-9]{36}`
   */
  SegCodBarra?: string;
  /** Indicador de Reentrega */
  indReentrega?: "1";
  /**
   * Informações das Unidades de Transporte (Carreta/Reboque/Vagão)
   * Deve ser preenchido com as informações das unidades de transporte utilizadas.
   * ocorre 0..n
   */
  infUnidTransp?: TUnidadeTransp[];
  /**
   * Preenchido quando for  transporte de produtos classificados pela ONU como perigosos.
   * ocorre 0..n
   */
  peri?: TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_peri[];
  /** Grupo de informações da Entrega Parcial (Corte de Voo) */
  infEntregaParcial?: TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infEntregaParcial;
  /** Indicador de Prestação parcial */
  indPrestacaoParcial?: "1";
  /**
   * Grupo de informações das NFe que foram entregues do CTe relacionado
   * ocorre 1..n
   */
  infNFePrestParcial?: TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infNFePrestParcial[];
};

/**
 * Preenchido quando for  transporte de produtos classificados pela ONU como perigosos.
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga.infNFe.peri
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga_infNFe_peri = {
  /**
   * Número ONU/UN
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * pattern `[0-9]{4}|ND`
   */
  nONU: string;
  /**
   * Nome apropriado para embarque do produto
   * Ver a legislação de transporte de produtos perigosos aplicada ao modo de transporte
   * xsd:TString, tamanho 1..150, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNomeAE?: string;
  /**
   * Classe ou subclasse/divisão, e risco subsidiário/risco secundário
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * xsd:TString, tamanho 1..40, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xClaRisco?: string;
  /**
   * Grupo de Embalagem
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * Preenchimento obrigatório para o modal aéreo.
   * A legislação para o modal rodoviário e ferroviário não atribui grupo de embalagem para todos os produtos, portanto haverá casos de não preenchimento desse campo.
   * xsd:TString, tamanho 1..6, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  grEmb?: string;
  /**
   * Quantidade total por produto
   * Preencher conforme a legislação de transporte de produtos perigosos aplicada ao modal
   * xsd:TString, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  qTotProd: string;
  /**
   * Quantidade e Tipo de volumes
   * Preencher conforme a legislação de transporte de produtos perigosos aplicada ao modal
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  qVolTipo?: string;
};

/**
 * Nota Fiscal Eletronica
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga.infNFe
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga_infNFe = {
  /**
   * Nota Fiscal Eletrônica
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chNFe: string;
  /**
   * Segundo código de barras
   * xsd:TSegCodBarra, pattern `[0-9]{36}`
   */
  SegCodBarra?: string;
  /** Indicador de Reentrega */
  indReentrega?: "1";
  /**
   * Informações das Unidades de Transporte (Carreta/Reboque/Vagão)
   * Deve ser preenchido com as informações das unidades de transporte utilizadas.
   * ocorre 0..n
   */
  infUnidTransp?: TUnidadeTransp[];
  /**
   * Preenchido quando for  transporte de produtos classificados pela ONU como perigosos.
   * ocorre 0..n
   */
  peri?: TMDFe_infMDFe_infDoc_infMunDescarga_infNFe_peri[];
};

/**
 * Preenchido quando for  transporte de produtos classificados pela ONU como perigosos.
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga.infMDFeTransp.peri
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp_peri = {
  /**
   * Número ONU/UN
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * pattern `[0-9]{4}|ND`
   */
  nONU: string;
  /**
   * Nome apropriado para embarque do produto
   * Ver a legislação de transporte de produtos perigosos aplicada ao modo de transporte
   * xsd:TString, tamanho 1..150, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNomeAE?: string;
  /**
   * Classe ou subclasse/divisão, e risco subsidiário/risco secundário
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * xsd:TString, tamanho 1..40, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xClaRisco?: string;
  /**
   * Grupo de Embalagem
   * Ver a legislação de transporte de produtos perigosos aplicadas ao modal
   * Preenchimento obrigatório para o modal aéreo.
   * A legislação para o modal rodoviário e ferroviário não atribui grupo de embalagem para todos os produtos, portanto haverá casos de não preenchimento desse campo.
   * xsd:TString, tamanho 1..6, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  grEmb?: string;
  /**
   * Quantidade total por produto
   * Preencher conforme a legislação de transporte de produtos perigosos aplicada ao modal
   * xsd:TString, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  qTotProd: string;
  /**
   * Quantidade e Tipo de volumes
   * Preencher conforme a legislação de transporte de produtos perigosos aplicada ao modal
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  qVolTipo?: string;
};

/**
 * Manifesto Eletrônico de Documentos Fiscais. Somente para modal Aquaviário (vide regras MOC)
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga.infMDFeTransp
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp = {
  /**
   * Manifesto Eletrônico de Documentos Fiscais
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chMDFe: string;
  /** Indicador de Reentrega */
  indReentrega?: "1";
  /**
   * Informações das Unidades de Transporte (Carreta/Reboque/Vagão)
   * Dispositivo de carga utilizada (Unit Load Device - ULD) significa todo tipo de contêiner de carga, vagão, contêiner de avião, palete de aeronave com rede ou palete de aeronave com rede sobre um iglu.
   * ocorre 0..n
   */
  infUnidTransp?: TUnidadeTransp[];
  /**
   * Preenchido quando for  transporte de produtos classificados pela ONU como perigosos.
   * ocorre 0..n
   */
  peri?: TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp_peri[];
};

/**
 * Informações dos Municípios de descarregamento
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc.infMunDescarga
 */
export type TMDFe_infMDFe_infDoc_infMunDescarga = {
  /**
   * Código do Município de Descarregamento
   * xsd:TCodMunIBGE, pattern `[0-9]{7}`
   */
  cMunDescarga: string;
  /**
   * Nome do Município de Descarregamento
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMunDescarga: string;
  /**
   * Conhecimentos de Tranporte - usar este grupo quando for prestador de serviço de transporte
   * ocorre 0..20000
   */
  infCTe?: TMDFe_infMDFe_infDoc_infMunDescarga_infCTe[];
  /**
   * Nota Fiscal Eletronica
   * ocorre 0..20000
   */
  infNFe?: TMDFe_infMDFe_infDoc_infMunDescarga_infNFe[];
  /**
   * Manifesto Eletrônico de Documentos Fiscais. Somente para modal Aquaviário (vide regras MOC)
   * ocorre 0..20000
   */
  infMDFeTransp?: TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp[];
};

/**
 * Informações dos Documentos fiscais vinculados ao manifesto
 * xsd: tipo anônimo de TMDFe.infMDFe.infDoc
 */
export type TMDFe_infMDFe_infDoc = {
  /**
   * Informações dos Municípios de descarregamento
   * ocorre 1..1000
   */
  infMunDescarga: TMDFe_infMDFe_infDoc_infMunDescarga[];
};

/**
 * Informações do responsável pelo seguro da carga
 * xsd: tipo anônimo de TMDFe.infMDFe.seg.infResp
 */
export type TMDFe_infMDFe_seg_infResp = {
  /**
   * Responsável pelo seguro
   * Preencher com:
   * 1- Emitente do MDF-e;
   * 22 - Responsável pela contratação do serviço de transporte (contratante)
   * Dados obrigatórios apenas no modal Rodoviário, depois da lei 11.442/07. Para os demais modais esta informação é opcional.
   * tamanho 1..1
   */
  respSeg: "1" | "2";
} & (
  ({
  /**
   * Número do CNPJ do responsável pelo seguro
   * Obrigatório apenas se responsável pelo seguro for (2) responsável pela contratação do transporte - pessoa jurídica
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * Número do CPF do responsável pelo seguro
   * Obrigatório apenas se responsável pelo seguro for (2) responsável pela contratação do transporte - pessoa física
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
  | ({ CNPJ?: never; CPF?: never })
);

/**
 * Informações da seguradora
 * xsd: tipo anônimo de TMDFe.infMDFe.seg.infSeg
 */
export type TMDFe_infMDFe_seg_infSeg = {
  /**
   * Nome da Seguradora
   * xsd:TString, tamanho 1..30, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xSeg: string;
  /**
   * Número do CNPJ da seguradora
   * Obrigatório apenas se responsável pelo seguro for (2) responsável pela contratação do transporte - pessoa jurídica
   * xsd:TCnpjOpc, pattern `[0-9]{0}|[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
};

/**
 * Informações de Seguro da Carga
 * xsd: tipo anônimo de TMDFe.infMDFe.seg
 */
export type TMDFe_infMDFe_seg = {
  /** Informações do responsável pelo seguro da carga */
  infResp: TMDFe_infMDFe_seg_infResp;
  /** Informações da seguradora */
  infSeg?: TMDFe_infMDFe_seg_infSeg;
  /**
   * Número da Apólice
   * Obrigatório pela lei 11.442/07 (RCTRC)
   * xsd:TString, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nApol?: string;
  /**
   * Número da Averbação
   * Informar as averbações do seguro
   * xsd:TString, tamanho 1..40, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   * ocorre 0..n
   */
  nAver?: string[];
};

/**
 * Informações da localização de carregamento do MDF-e de carga lotação
 * xsd: tipo anônimo de TMDFe.infMDFe.prodPred.infLotacao.infLocalCarrega
 */
export type TMDFe_infMDFe_prodPred_infLotacao_infLocalCarrega = {

} & (
  ({
  /**
   * CEP onde foi carregado o MDF-e
   * Informar zeros não significativos
   * pattern `[0-9]{8}`
   */
  CEP: string;
  latitude?: never; longitude?: never;
})
  | ({
  /**
   * Latitude do ponto geográfico onde foi carregado o MDF-e
   * xsd:TLatitude
   */
  latitude: string;
  /**
   * Latitude do ponto geográfico onde foi carregado o MDF-e
   * xsd:TLongitude
   */
  longitude: string;
  CEP?: never;
})
);

/**
 * Informações da localização de descarregamento do MDF-e de carga lotação
 * xsd: tipo anônimo de TMDFe.infMDFe.prodPred.infLotacao.infLocalDescarrega
 */
export type TMDFe_infMDFe_prodPred_infLotacao_infLocalDescarrega = {

} & (
  ({
  /**
   * CEP onde foi descarregado o MDF-e
   * Informar zeros não significativos
   * pattern `[0-9]{8}`
   */
  CEP: string;
  latitude?: never; longitude?: never;
})
  | ({
  /**
   * Latitude do ponto geográfico onde foi descarregado o MDF-e
   * xsd:TLatitude
   */
  latitude: string;
  /**
   * Latitude do ponto geográfico onde foi descarregado o MDF-e
   * xsd:TLongitude
   */
  longitude: string;
  CEP?: never;
})
);

/**
 * Informações da carga lotação. Informar somente quando MDF-e for de carga lotação
 * xsd: tipo anônimo de TMDFe.infMDFe.prodPred.infLotacao
 */
export type TMDFe_infMDFe_prodPred_infLotacao = {
  /** Informações da localização de carregamento do MDF-e de carga lotação */
  infLocalCarrega: TMDFe_infMDFe_prodPred_infLotacao_infLocalCarrega;
  /** Informações da localização de descarregamento do MDF-e de carga lotação */
  infLocalDescarrega: TMDFe_infMDFe_prodPred_infLotacao_infLocalDescarrega;
};

/**
 * Produto predominante
 * Informar a descrição do produto predominante, conforme o item de maior valor financeiro conforme Resolução ANTT n° 5.867 de 2020).
 * xsd: tipo anônimo de TMDFe.infMDFe.prodPred
 */
export type TMDFe_infMDFe_prodPred = {
  /**
   * Tipo de Carga
   * Conforme Resolução ANTT nº.  5.849/2019.
   * 01-Granel sólido;
   * 02-Granel líquido;
   * 03-Frigorificada;
   * 04-Conteinerizada;
   * 05-Carga Geral;
   * 06-Neogranel;
   * 07-Perigosa (granel sólido);
   * 08-Perigosa (granel líquido);
   * 09-Perigosa (carga frigorificada);
   * 10-Perigosa (conteinerizada);
   * 11-Perigosa (carga geral).
   * 12-Granel pressurizada
   */
  tpCarga: "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12";
  /**
   * Descrição do produto
   * xsd:TString, tamanho 1..120, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xProd: string;
  /**
   * GTIN (Global Trade Item Number) do produto, antigo código EAN ou código de barras
   * pattern `SEM GTIN|[0-9]{0}|[0-9]{8}|[0-9]{12,14}`
   */
  cEAN?: string;
  /**
   * Código NCM
   * pattern `[0-9]{2}|[0-9]{8}`
   */
  NCM?: string;
  /** Informações da carga lotação. Informar somente quando MDF-e for de carga lotação */
  infLotacao?: TMDFe_infMDFe_prodPred_infLotacao;
};

/**
 * Totalizadores da carga transportada e seus documentos fiscais
 * xsd: tipo anônimo de TMDFe.infMDFe.tot
 */
export type TMDFe_infMDFe_tot = {
  /**
   * Quantidade total de CT-e relacionados no Manifesto
   * pattern `[0-9]{1,6}`
   */
  qCTe?: string;
  /**
   * Quantidade total de NF-e relacionadas no Manifesto
   * pattern `[0-9]{1,6}`
   */
  qNFe?: string;
  /**
   * Quantidade total de MDF-e relacionados no Manifesto Aquaviário
   * pattern `[0-9]{1,6}`
   */
  qMDFe?: string;
  /**
   * Valor total da carga / mercadorias transportadas
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vCarga: string;
  /**
   * Código da unidade de medida do Peso Bruto da Carga / Mercadorias transportadas
   * 01 – KG;  02 - TON
   */
  cUnid: "01" | "02";
  /**
   * Peso Bruto Total da Carga / Mercadorias transportadas
   * xsd:TDec_1104, pattern `0|0\.[0-9]{4}|[1-9]{1}[0-9]{0,10}(\.[0-9]{4})?`
   */
  qCarga: string;
};

/**
 * Lacres do MDF-e
 * Preechimento opcional para os modais Rodoviário e Ferroviário
 * xsd: tipo anônimo de TMDFe.infMDFe.lacres
 */
export type TMDFe_infMDFe_lacres = {
  /**
   * número do lacre
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nLacre: string;
};

/**
 * Autorizados para download do XML do DF-e
 * Informar CNPJ ou CPF. Preencher os zeros não significativos.
 * xsd: tipo anônimo de TMDFe.infMDFe.autXML
 */
export type TMDFe_infMDFe_autXML = {

} & (
  ({
  /**
   * CNPJ do autorizado
   * Informar zeros não significativos
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * CPF do autorizado
   * Informar zeros não significativos
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

/**
 * Informações Adicionais
 * xsd: tipo anônimo de TMDFe.infMDFe.infAdic
 */
export type TMDFe_infMDFe_infAdic = {
  /**
   * Informações adicionais de interesse do Fisco
   * Norma referenciada, informações complementares, etc
   * xsd:TString, tamanho 1..2000, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  infAdFisco?: string;
  /**
   * Informações complementares de interesse do Contribuinte
   * xsd:TString, tamanho 1..5000, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  infCpl?: string;
};

/**
 * Tipo Dados da Responsável Técnico
 * xsd: TRespTec
 */
export type TRespTec = {
  /**
   * CNPJ da pessoa jurídica responsável técnica pelo sistema utilizado na emissão do documento fiscal eletrônico
   * Informar o CNPJ da pessoa jurídica desenvolvedora do sistema utilizado na emissão do documento fiscal eletrônico.
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  /**
   * Nome da pessoa a ser contatada
   * Informar o nome da pessoa a ser contatada na empresa desenvolvedora do sistema utilizado na emissão do documento fiscal eletrônico. No caso de pessoa física, informar o respectivo nome.
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xContato: string;
  /**
   * Email da pessoa jurídica a ser contatada
   * xsd:TEmail, tamanho 6..60, pattern `[^@]+@[^\.]+\..+`
   */
  email: string;
  /**
   * Telefone da pessoa jurídica a ser contatada
   * Preencher com o Código DDD + número do telefone.
   * pattern `[0-9]{7,12}`
   */
  fone: string;
  /**
   * Identificador do código de segurança do responsável técnico
   * Identificador do CSRT utilizado para geração do hash
   * pattern `[0-9]{3}`
   */
  idCSRT?: string;
  /**
   * Hash do token do código de segurança do responsável técnico
   * O hashCSRT é o resultado das funções SHA-1 e base64 do token CSRT fornecido pelo fisco + chave de acesso do DF-e. (Implementação em futura NT)
   * Observação: 28 caracteres são representados no schema como 20 bytes do tipo base64Binary
   * tamanho 20
   */
  hashCSRT?: string;
};

/**
 * Grupo de informações do pedido de emissão da Nota Fiscal Fácil
 * xsd: tipo anônimo de TMDFe.infMDFe.infSolicNFF
 */
export type TMDFe_infMDFe_infSolicNFF = {
  /**
   * Solicitação do pedido de emissão da NFF.
   * Será preenchido com a totalidade de campos informados no aplicativo emissor serializado.
   * xsd:TString, tamanho 2..8000, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xSolic: string;
};

/**
 * Tipo que representa uma chave publica padrão RSA
 * xsd: TRSAKeyValueType
 */
export type TRSAKeyValueType = {
  Modulus: string;
  Exponent: string;
};

/**
 * Assinatura RSA do Emitente para DFe gerados por PAA
 * xsd: tipo anônimo de TMDFe.infMDFe.infPAA.PAASignature
 */
export type TMDFe_infMDFe_infPAA_PAASignature = {
  /**
   * Assinatura digital padrão RSA
   * Converter o atributo Id do DFe para array de bytes e assinar com a chave privada do RSA com algoritmo SHA1 gerando um valor no formato base64.
   */
  SignatureValue: string;
  /** Chave Publica no padrão XML RSA Key */
  RSAKeyValue: TRSAKeyValueType;
};

/**
 * Grupo de Informação do Provedor de Assinatura e Autorização
 * xsd: tipo anônimo de TMDFe.infMDFe.infPAA
 */
export type TMDFe_infMDFe_infPAA = {
  /**
   * CNPJ do Provedor de Assinatura e Autorização
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJPAA: string;
  /** Assinatura RSA do Emitente para DFe gerados por PAA */
  PAASignature: TMDFe_infMDFe_infPAA_PAASignature;
};

/**
 * Informações do MDF-e
 * xsd: tipo anônimo de TMDFe.infMDFe
 */
export type TMDFe_infMDFe = {
  /**
   * Versão do leiaute
   * Ex: "3.00"
   * @attribute xsd:TVerMDe, pattern `3\.00`
   */
  versao: string;
  /**
   * Identificador da tag a ser assinada
   * Informar a chave de acesso do MDF-e e precedida do literal "MDFe"
   * @attribute pattern `MDFe[0-9]{44}`
   */
  Id: string;
  /** Identificação do MDF-e */
  ide: TMDFe_infMDFe_ide;
  /** Identificação do Emitente do Manifesto */
  emit: TMDFe_infMDFe_emit;
  /** Informações do modal */
  infModal: TMDFe_infMDFe_infModal;
  /** Informações dos Documentos fiscais vinculados ao manifesto */
  infDoc: TMDFe_infMDFe_infDoc;
  /**
   * Informações de Seguro da Carga
   * ocorre 0..n
   */
  seg?: TMDFe_infMDFe_seg[];
  /**
   * Produto predominante
   * Informar a descrição do produto predominante, conforme o item de maior valor financeiro conforme Resolução ANTT n° 5.867 de 2020).
   */
  prodPred?: TMDFe_infMDFe_prodPred;
  /** Totalizadores da carga transportada e seus documentos fiscais */
  tot: TMDFe_infMDFe_tot;
  /**
   * Lacres do MDF-e
   * Preechimento opcional para os modais Rodoviário e Ferroviário
   * ocorre 0..n
   */
  lacres?: TMDFe_infMDFe_lacres[];
  /**
   * Autorizados para download do XML do DF-e
   * Informar CNPJ ou CPF. Preencher os zeros não significativos.
   * ocorre 0..10
   */
  autXML?: TMDFe_infMDFe_autXML[];
  /** Informações Adicionais */
  infAdic?: TMDFe_infMDFe_infAdic;
  /** Informações do Responsável Técnico pela emissão do DF-e */
  infRespTec?: TRespTec;
  /** Grupo de informações do pedido de emissão da Nota Fiscal Fácil */
  infSolicNFF?: TMDFe_infMDFe_infSolicNFF;
  /** Grupo de Informação do Provedor de Assinatura e Autorização */
  infPAA?: TMDFe_infMDFe_infPAA;
};

/**
 * Informações suplementares do MDF-e
 * xsd: tipo anônimo de TMDFe.infMDFeSupl
 */
export type TMDFe_infMDFeSupl = {
  /**
   * Texto com o QR-Code para consulta do MDF-e
   * tamanho 50..1000
   */
  qrCodMDFe: string;
};

/** xsd: tipo anônimo de SignedInfoType.CanonicalizationMethod */
export type SignedInfoType_CanonicalizationMethod = {
  /** @attribute */
  Algorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
};

/** xsd: tipo anônimo de SignedInfoType.SignatureMethod */
export type SignedInfoType_SignatureMethod = {
  /** @attribute */
  Algorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
};

/** xsd:TTransformURI */
export type TTransformURI = "http://www.w3.org/2000/09/xmldsig#enveloped-signature" | "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

/** xsd: TransformType */
export type TransformType = {
  /** @attribute xsd:TTransformURI */
  Algorithm: TTransformURI;
  /** ocorre 1..1 */
  XPath?: string[];
};

/** xsd: TransformsType */
export type TransformsType = {
  /** ocorre 2..2 */
  Transform: TransformType[];
};

/** xsd: tipo anônimo de ReferenceType.DigestMethod */
export type ReferenceType_DigestMethod = {
  /** @attribute */
  Algorithm: "http://www.w3.org/2000/09/xmldsig#sha1";
};

/** xsd: ReferenceType */
export type ReferenceType = {
  /** @attribute */
  Id?: string;
  /** @attribute tamanho 2..* */
  URI: string;
  /** @attribute */
  Type?: string;
  Transforms: TransformsType;
  DigestMethod: ReferenceType_DigestMethod;
  /** xsd:DigestValueType */
  DigestValue: string;
};

/** xsd: SignedInfoType */
export type SignedInfoType = {
  /** @attribute */
  Id?: string;
  CanonicalizationMethod: SignedInfoType_CanonicalizationMethod;
  SignatureMethod: SignedInfoType_SignatureMethod;
  Reference: ReferenceType;
};

/** xsd: SignatureValueType */
export type SignatureValueType = {
  /** @attribute */
  Id?: string;
  $text: string;
};

/** xsd: X509DataType */
export type X509DataType = {
  X509Certificate: string;
};

/** xsd: KeyInfoType */
export type KeyInfoType = {
  /** @attribute */
  Id?: string;
  X509Data: X509DataType;
};

/** xsd: SignatureType */
export type SignatureType = {
  /** @attribute */
  Id?: string;
  SignedInfo: SignedInfoType;
  SignatureValue: SignatureValueType;
  KeyInfo: KeyInfoType;
};

/**
 * Tipo Manifesto de Documentos Fiscais Eletrônicos
 * xsd: TMDFe
 */
export type TMDFe = {
  /** Informações do MDF-e */
  infMDFe: TMDFe_infMDFe;
  /** Informações suplementares do MDF-e */
  infMDFeSupl?: TMDFe_infMDFeSupl;
  Signature: SignatureType;
};

/**
 * Dados do protocolo de status
 * xsd: tipo anônimo de TProtMDFe.infProt
 */
export type TProtMDFe_infProt = {
  /** @attribute */
  Id?: string;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Versão do Aplicativo que processou a NF-3e
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Chave de acesso do MDF-e
   * xsd:TChMDFe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chMDFe: string;
  /**
   * Data e hora de processamento, no formato AAAA-MM-DDTHH:MM:SS TZD.
   * xsd:TDateTimeUTC
   */
  dhRecbto: string;
  /**
   * Número do Protocolo de Status do MDF-e
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt?: string;
  /**
   * Digest Value do MDF-e processado. Utilizado para conferir a integridade do MDF-e original.
   * xsd:DigestValueType
   */
  digVal?: string;
  /**
   * Código do status do MDF-e
   * xsd:TStat, pattern `[0-9]{3,4}`
   */
  cStat: string;
  /**
   * Descrição literal do status do MDF-e.
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
};

/**
 * Mensagem do Fisco
 * xsd: tipo anônimo de TProtMDFe.infFisco
 */
export type TProtMDFe_infFisco = {
  /**
   * Código do status da mensagem do fisco
   * xsd:TStat, pattern `[0-9]{3,4}`
   */
  cMsg: string;
  /**
   * Mensagem do Fisco
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMsg: string;
};

/**
 * Tipo Protocolo de status resultado do processamento do MDF-e
 * xsd: TProtMDFe
 */
export type TProtMDFe = {
  /** @attribute xsd:TVerMDe, pattern `3\.00` */
  versao: string;
  /** Dados do protocolo de status */
  infProt: TProtMDFe_infProt;
  /** Mensagem do Fisco */
  infFisco?: TProtMDFe_infFisco;
  Signature?: SignatureType;
};

/**
 * MDF-e processado
 * xsd: tipo anônimo de mdfeProc
 */
export type mdfeProc = {
  /** @attribute xsd:TVerMDe, pattern `3\.00` */
  versao: string;
  /**
   * IP do transmissor do documento fiscal para o ambiente autorizador
   * @attribute xsd:TIPv4
   */
  ipTransmissor?: string;
  /**
   * Porta de origem utilizada na conexão (De 0 a 65535)
   * @attribute pattern `[0-9]{1,5}`
   */
  nPortaCon?: string;
  /**
   * Data e Hora da Conexão de Origem
   * @attribute xsd:TDateTimeUTC
   */
  dhConexao?: string;
  MDFe: TMDFe;
  protMDFe: TProtMDFe;
};

/**
 * Tipo Retorno do Pedido de Autorização do MDF-e
 * xsd: TRetMDFe
 */
export type TRetMDFe = {
  /** @attribute xsd:TVerMDe, pattern `3\.00` */
  versao: string;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   */
  tpAmb: string;
  /**
   * Identificação da UF
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * Versão do Aplicativo que recebeu o Arquivo.
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Código do status da mensagem enviada.
   * xsd:TStat, pattern `[0-9]{3,4}`
   */
  cStat: string;
  /**
   * Descrição literal do status do serviço solicitado.
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
  /** Dados do Recibo do Arquivo */
  protMDFe?: TProtMDFe;
};


// ---------- descritores de tipo simples ----------
const st_TVerMDe: SimpleType = { b: "string", p: [["3\\.00"]], nm: "TVerMDe" };
const st_TIPv4: SimpleType = { b: "string", p: [["(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])"]], nm: "TIPv4" };
const st$0: SimpleType = { b: "string", p: [["[0-9]{1,5}"]] };
const st_TDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([\\-,\\+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TDateTimeUTC" };
const st$1: SimpleType = { b: "ID", p: [["MDFe[0-9]{44}"]] };
const st_TCodUfIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53"], nm: "TCodUfIBGE" };
const st_TAmb: SimpleType = { b: "string", e: ["1","2"], nm: "TAmb" };
const st_TEmit: SimpleType = { b: "string", e: ["1","2","3"], nm: "TEmit" };
const st_TTransp: SimpleType = { b: "string", e: ["1","2","3"], nm: "TTransp" };
const st_TModMD: SimpleType = { b: "string", e: ["58"], nm: "TModMD" };
const st_TSerie: SimpleType = { b: "string", p: [["0|[1-9]{1}[0-9]{0,2}"]], nm: "TSerie" };
const st_TNF: SimpleType = { b: "string", p: [["[1-9]{1}[0-9]{0,8}"]], nm: "TNF" };
const st$2: SimpleType = { b: "string", p: [["[0-9]{8}"]] };
const st$3: SimpleType = { b: "string", p: [["[0-9]{1}"]] };
const st_TModalMD: SimpleType = { b: "string", e: ["1","2","3","4"], nm: "TModalMD" };
const st$4: SimpleType = { b: "string", e: ["1","2","3"] };
const st$5: SimpleType = { b: "string", e: ["0","4"], nm: "TProcEmi" };
const st$6: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TString" };
const st_TUf: SimpleType = { b: "string", e: ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO","EX"], nm: "TUf" };
const st_TCodMunIBGE: SimpleType = { b: "string", p: [["[0-9]{7}"]], nm: "TCodMunIBGE" };
const st$7: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 2, mx: 60, nm: "TString" };
const st$8: SimpleType = { b: "string", e: ["1"] };
const st_TCnpj: SimpleType = { b: "string", p: [["[A-Z0-9]{12}[0-9]{2}"]], nm: "TCnpj" };
const st_TCpf: SimpleType = { b: "string", p: [["[0-9]{11}"]], nm: "TCpf" };
const st$9: SimpleType = { b: "string", p: [["[0-9]{2,14}"]], nm: "TIe" };
const st$10: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 60, nm: "TString" };
const st$11: SimpleType = { b: "string", p: [["[0-9]{7,12}"]] };
const st_TEmail: SimpleType = { b: "string", p: [["[^@]+@[^\\.]+\\..+"]], mn: 6, mx: 60, nm: "TEmail" };
const st$12: SimpleType = { b: "string", p: [["3\\.(0[0-9]|[1-9][0-9])"]] };
const st_TRNTRC: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[0-9]{8}"]], nm: "TRNTRC" };
const st$13: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[0-9]{12}"]], nm: "TCIOT" };
const st_TCnpjOpc: SimpleType = { b: "string", p: [["[0-9]{0}|[A-Z0-9]{12}[0-9]{2}"]], nm: "TCnpjOpc" };
const st$14: SimpleType = { b: "string", p: [["[0-9]{1,20}"]] };
const st_TDec_1302: SimpleType = { b: "string", p: [["0|0\\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\\.[0-9]{2})?"]], nm: "TDec_1302" };
const st$15: SimpleType = { b: "string", e: ["01","04"] };
const st$16: SimpleType = { b: "string", e: ["02","04","06","07","08","10","11","12","13","14"] };
const st$17: SimpleType = { b: "string", p: [["([!-ÿ]{0}|[!-ÿ]{2,20})?"]], mn: 2, mx: 20 };
const st$18: SimpleType = { b: "string", mn: 2, mx: 20 };
const st_TDec_1302Opc: SimpleType = { b: "string", p: [["0\\.[0-9]{1}[1-9]{1}|0\\.[1-9]{1}[0-9]{1}|[1-9]{1}[0-9]{0,12}(\\.[0-9]{2})?"]], nm: "TDec_1302Opc" };
const st$19: SimpleType = { b: "string", p: [["([!-ÿ]{0}|[!-ÿ]{5,20})?"]], mn: 2, mx: 20 };
const st$20: SimpleType = { b: "string", e: ["01","02","03","04","99"] };
const st$21: SimpleType = { b: "string", e: ["0","1"] };
const st$22: SimpleType = { b: "string", p: [["[0-9]{3}"]] };
const st_TData: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))"]], nm: "TData" };
const st$23: SimpleType = { b: "string", e: ["0","1","2"] };
const st$24: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 3, mx: 5, nm: "TString" };
const st$25: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 10, nm: "TString" };
const st$26: SimpleType = { b: "string", p: [["[A-Z]{2,3}[0-9]{4}|[A-Z]{3,4}[0-9]{3}|[A-Z0-9]{7}"]], nm: "TPlaca" };
const st$27: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 9, mx: 11, nm: "TString" };
const st$28: SimpleType = { b: "string", p: [["0|[1-9]{1}[0-9]{0,5}"]] };
const st$29: SimpleType = { b: "string", p: [["0|[1-9]{1}[0-9]{0,2}"]] };
const st$30: SimpleType = { b: "string", p: [["[0-9]{0,14}|ISENTO|PR[0-9]{4,8}"]], nm: "TIeDest" };
const st$31: SimpleType = { b: "string", e: ["01","02","03","04","05","06"] };
const st$32: SimpleType = { b: "string", e: ["00","01","02","03","04","05"] };
const st$33: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 0, mx: 16, nm: "TString" };
const st$34: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 4 };
const st$35: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 6 };
const st$36: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 5, mx: 9, nm: "TString" };
const st$37: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 3, mx: 4, nm: "TString" };
const st$38: SimpleType = { b: "string", mn: 1, mx: 10 };
const st$39: SimpleType = { b: "string", p: [["[0-9]{2}"]] };
const st$40: SimpleType = { b: "string", p: [["[1-9]{1}[0-9]{0,9}"]] };
const st$41: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 5, nm: "TString" };
const st$42: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 8, nm: "TString" };
const st_TContainer: SimpleType = { b: "string", p: [["[A-Z0-9]+"]], mn: 1, mx: 20, nm: "TContainer" };
const st$43: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], e: ["1","2","3","4"], nm: "TString" };
const st$44: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], e: ["1","2"], nm: "TString" };
const st$45: SimpleType = { b: "string", p: [["[0-9]{9}"]], mn: 1, mx: 9 };
const st$46: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 3, nm: "TString" };
const st$47: SimpleType = { b: "string", p: [["[1-9]{1}[0-9]{0,2}"]] };
const st_TDec_0303: SimpleType = { b: "string", p: [["0|0\\.[0-9]{2}|[1-9]{1}[0-9]{0,2}(\\.[0-9]{3})?"]], nm: "TDec_0303" };
const st$48: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], l: 3, nm: "TString" };
const st$49: SimpleType = { b: "string", p: [["[1-9]{1}[0-9]{0,7}"]], mn: 1, mx: 8 };
const st$50: SimpleType = { b: "string", p: [["[0-9]{1,3}(\\.[0-9]{2,3})?"]], nm: "TDec_0302_0303" };
const st_TChCTe: SimpleType = { b: "string", p: [["[0-9]{6}[A-Z0-9]{12}[0-9]{26}"]], mx: 44, nm: "TChCTe" };
const st_TSegCodBarra: SimpleType = { b: "string", p: [["[0-9]{36}"]], nm: "TSegCodBarra" };
const st_TtipoUnidTransp: SimpleType = { b: "string", e: ["1","2","3","4","5","6","7"], nm: "TtipoUnidTransp" };
const st_TtipoUnidCarga: SimpleType = { b: "string", e: ["1","2","3","4"], nm: "TtipoUnidCarga" };
const st$51: SimpleType = { b: "string", p: [["[0-9]{4}|ND"]] };
const st$52: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 150, nm: "TString" };
const st$53: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 40, nm: "TString" };
const st$54: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 6, nm: "TString" };
const st_TDec_1104: SimpleType = { b: "string", p: [["0|0\\.[0-9]{4}|[1-9]{1}[0-9]{0,10}(\\.[0-9]{4})?"]], nm: "TDec_1104" };
const st_TChNFe: SimpleType = { b: "string", p: [["[0-9]{6}[A-Z0-9]{12}[0-9]{26}"]], mx: 44, nm: "TChNFe" };
const st$55: SimpleType = { b: "string", e: ["1","2"], mn: 1, mx: 1 };
const st$56: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 30, nm: "TString" };
const st$57: SimpleType = { b: "string", e: ["01","02","03","04","05","06","07","08","09","10","11","12"] };
const st$58: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 120, nm: "TString" };
const st$59: SimpleType = { b: "string", p: [["SEM GTIN|[0-9]{0}|[0-9]{8}|[0-9]{12,14}"]] };
const st$60: SimpleType = { b: "string", p: [["[0-9]{2}|[0-9]{8}"]] };
const st_TLatitude: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[0-9]\\.[0-9]{6}|[1-8][0-9]\\.[0-9]{6}|90\\.[0-9]{6}|-[0-9]\\.[0-9]{6}|-[1-8][0-9]\\.[0-9]{6}|-90\\.[0-9]{6}"]], nm: "TLatitude" };
const st_TLongitude: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[0-9]\\.[0-9]{6}|[1-9][0-9]\\.[0-9]{6}|1[0-7][0-9]\\.[0-9]{6}|180\\.[0-9]{6}|-[0-9]\\.[0-9]{6}|-[1-9][0-9]\\.[0-9]{6}|-1[0-7][0-9]\\.[0-9]{6}|-180\\.[0-9]{6}"]], nm: "TLongitude" };
const st$61: SimpleType = { b: "string", p: [["[0-9]{1,6}"]] };
const st$62: SimpleType = { b: "string", e: ["01","02"] };
const st$63: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 2000, nm: "TString" };
const st$64: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 5000, nm: "TString" };
const st$65: SimpleType = { b: "base64Binary", l: 20 };
const st$66: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 2, mx: 8000, nm: "TString" };
const st$67: SimpleType = { b: "base64Binary" };
const st$68: SimpleType = { b: "string", p: [["((HTTPS?|https?)://.*\\?chMDFe=[0-9]{6}[A-Z0-9]{12}[0-9]{26}&tpAmb=[1-2](&sign=[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1})?)"]], mn: 50, mx: 1000 };
const st$69: SimpleType = { b: "ID" };
const st$70: SimpleType = { b: "anyURI" };
const st$71: SimpleType = { b: "anyURI", mn: 2 };
const st_TTransformURI: SimpleType = { b: "anyURI", e: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature","http://www.w3.org/TR/2001/REC-xml-c14n-20010315"], nm: "TTransformURI" };
const st$72: SimpleType = { b: "string" };
const st_DigestValueType: SimpleType = { b: "base64Binary", nm: "DigestValueType" };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st_TChMDFe: SimpleType = { b: "string", p: [["[0-9]{6}[A-Z0-9]{12}[0-9]{26}"]], mx: 44, nm: "TChMDFe" };
const st_TProt: SimpleType = { b: "string", p: [["[0-9]{15}"]], nm: "TProt" };
const st$73: SimpleType = { b: "string", p: [["[0-9]{3,4}"]], nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st$74: SimpleType = { b: "anyType" };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const TMDFe_infMDFe_ide_infMunCarrega: ComplexType<TMDFe_infMDFe_ide_infMunCarrega> = { id: "TMDFe.infMDFe.ide.infMunCarrega", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cMunCarrega", t: st_TCodMunIBGE }, { e: "xMunCarrega", t: st$7 }] } };
export const TMDFe_infMDFe_ide_infPercurso: ComplexType<TMDFe_infMDFe_ide_infPercurso> = { id: "TMDFe.infMDFe.ide.infPercurso", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "UFPer", t: st_TUf }] } };
export const TMDFe_infMDFe_ide: ComplexType<TMDFe_infMDFe_ide> = { id: "TMDFe.infMDFe.ide", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cUF", t: st_TCodUfIBGE }, { e: "tpAmb", t: st_TAmb }, { e: "tpEmit", t: st_TEmit }, { e: "tpTransp", t: st_TTransp, n: 0 }, { e: "mod", t: st_TModMD }, { e: "serie", t: st_TSerie }, { e: "nMDF", t: st_TNF }, { e: "cMDF", t: st$2 }, { e: "cDV", t: st$3 }, { e: "modal", t: st_TModalMD }, { e: "dhEmi", t: st_TDateTimeUTC }, { e: "tpEmis", t: st$4 }, { e: "procEmi", t: st$5 }, { e: "verProc", t: st$6 }, { e: "UFIni", t: st_TUf }, { e: "UFFim", t: st_TUf }, { e: "infMunCarrega", t: TMDFe_infMDFe_ide_infMunCarrega, x: 50 }, { e: "infPercurso", t: TMDFe_infMDFe_ide_infPercurso, n: 0, x: 25 }, { e: "dhIniViagem", t: st_TDateTimeUTC, n: 0 }, { e: "indCanalVerde", t: st$8, n: 0 }, { e: "indCarregaPosterior", t: st$8, n: 0 }] } };
export const TEndeEmi: ComplexType<TEndeEmi> = { id: "TEndeEmi", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xLgr", t: st$7 }, { e: "nro", t: st$10 }, { e: "xCpl", t: st$10, n: 0 }, { e: "xBairro", t: st$7 }, { e: "cMun", t: st_TCodMunIBGE }, { e: "xMun", t: st$7 }, { e: "CEP", t: st$2, n: 0 }, { e: "UF", t: st_TUf }, { e: "fone", t: st$11, n: 0 }, { e: "email", t: st_TEmail, n: 0 }] } };
export const TMDFe_infMDFe_emit: ComplexType<TMDFe_infMDFe_emit> = { id: "TMDFe.infMDFe.emit", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ g: "c", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "CPF", t: st_TCpf }] }, { e: "IE", t: st$9, n: 0 }, { e: "xNome", t: st$7 }, { e: "xFant", t: st$10, n: 0 }, { e: "enderEmit", t: TEndeEmi }] } };
export const rodo_infANTT_infCIOT: ComplexType<rodo_infANTT_infCIOT> = { id: "rodo.infANTT.infCIOT", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "CIOT", t: st$13, n: 0 }, { g: "c", i: [{ e: "CPF", t: st_TCpf }, { e: "CNPJ", t: st_TCnpjOpc }] }] } };
export const rodo_infANTT_valePed_disp: ComplexType<rodo_infANTT_valePed_disp> = { id: "rodo.infANTT.valePed.disp", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "CNPJForn", t: st_TCnpj }, { g: "c", i: [{ e: "CNPJPg", t: st_TCnpjOpc }, { e: "CPFPg", t: st_TCpf }], n: 0 }, { e: "nCompra", t: st$14, n: 0 }, { e: "vValePed", t: st_TDec_1302 }, { e: "tpValePed", t: st$15, n: 0 }] } };
export const rodo_infANTT_valePed: ComplexType<rodo_infANTT_valePed> = { id: "rodo.infANTT.valePed", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "disp", t: rodo_infANTT_valePed_disp, x: -1 }, { e: "categCombVeic", t: st$16, n: 0 }] } };
export const rodo_infANTT_infContratante_infContrato: ComplexType<rodo_infANTT_infContratante_infContrato> = { id: "rodo.infANTT.infContratante.infContrato", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "NroContrato", t: st$18 }, { e: "vContratoGlobal", t: st_TDec_1302Opc }] } };
export const rodo_infANTT_infContratante: ComplexType<rodo_infANTT_infContratante> = { id: "rodo.infANTT.infContratante", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xNome", t: st$7, n: 0 }, { g: "c", i: [{ e: "CPF", t: st_TCpf }, { e: "CNPJ", t: st_TCnpj }, { e: "idEstrangeiro", t: st$17 }] }, { e: "infContrato", t: rodo_infANTT_infContratante_infContrato, n: 0 }] } };
export const rodo_infANTT_infPag_Comp: ComplexType<rodo_infANTT_infPag_Comp> = { id: "rodo.infANTT.infPag.Comp", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "tpComp", t: st$20 }, { e: "vComp", t: st_TDec_1302 }, { e: "xComp", t: st$7, n: 0 }] } };
export const rodo_infANTT_infPag_infPrazo: ComplexType<rodo_infANTT_infPag_infPrazo> = { id: "rodo.infANTT.infPag.infPrazo", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nParcela", t: st$22 }, { e: "dVenc", t: st_TData }, { e: "vParcela", t: st_TDec_1302Opc }] } };
export const rodo_infANTT_infPag_infBanc: ComplexType<rodo_infANTT_infPag_infBanc> = { id: "rodo.infANTT.infPag.infBanc", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "c", i: [{ g: "s", i: [{ e: "codBanco", t: st$24 }, { e: "codAgencia", t: st$25 }] }, { e: "CNPJIPEF", t: st_TCnpjOpc }, { e: "PIX", t: st$7 }] } };
export const rodo_infANTT_infPag: ComplexType<rodo_infANTT_infPag> = { id: "rodo.infANTT.infPag", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xNome", t: st$7, n: 0 }, { g: "c", i: [{ e: "CPF", t: st_TCpf }, { e: "CNPJ", t: st_TCnpjOpc }, { e: "idEstrangeiro", t: st$19 }] }, { e: "Comp", t: rodo_infANTT_infPag_Comp, x: -1 }, { e: "vContrato", t: st_TDec_1302 }, { e: "indAltoDesemp", t: st$8, n: 0 }, { e: "indPag", t: st$21 }, { e: "vAdiant", t: st_TDec_1302, n: 0 }, { e: "indAntecipaAdiant", t: st$8, n: 0 }, { e: "infPrazo", t: rodo_infANTT_infPag_infPrazo, n: 0, x: -1 }, { e: "tpAntecip", t: st$23, n: 0 }, { e: "infBanc", t: rodo_infANTT_infPag_infBanc }] } };
export const rodo_infANTT: ComplexType<rodo_infANTT> = { id: "rodo.infANTT", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "RNTRC", t: st_TRNTRC, n: 0 }, { e: "infCIOT", t: rodo_infANTT_infCIOT, n: 0, x: -1 }, { e: "valePed", t: rodo_infANTT_valePed, n: 0 }, { e: "infContratante", t: rodo_infANTT_infContratante, n: 0, x: -1 }, { e: "infPag", t: rodo_infANTT_infPag, n: 0, x: -1 }] } };
export const rodo_veicTracao_prop: ComplexType<rodo_veicTracao_prop> = { id: "rodo.veicTracao.prop", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ g: "c", i: [{ e: "CPF", t: st_TCpf }, { e: "CNPJ", t: st_TCnpjOpc }] }, { e: "RNTRC", t: st_TRNTRC }, { e: "xNome", t: st$7 }, { g: "s", i: [{ e: "IE", t: st$30 }, { e: "UF", t: st_TUf }], n: 0 }, { e: "tpProp", t: st$23 }] } };
export const rodo_veicTracao_condutor: ComplexType<rodo_veicTracao_condutor> = { id: "rodo.veicTracao.condutor", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xNome", t: st$7 }, { e: "CPF", t: st_TCpf }] } };
export const rodo_veicTracao: ComplexType<rodo_veicTracao> = { id: "rodo.veicTracao", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cInt", t: st$25, n: 0 }, { e: "placa", t: st$26 }, { e: "RENAVAM", t: st$27, n: 0 }, { e: "tara", t: st$28 }, { e: "capKG", t: st$28, n: 0 }, { e: "capM3", t: st$29, n: 0 }, { e: "prop", t: rodo_veicTracao_prop, n: 0 }, { e: "condutor", t: rodo_veicTracao_condutor, x: 10 }, { e: "tpRod", t: st$31 }, { e: "tpCar", t: st$32 }, { e: "UF", t: st_TUf, n: 0 }] } };
export const rodo_veicReboque_prop: ComplexType<rodo_veicReboque_prop> = { id: "rodo.veicReboque.prop", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ g: "c", i: [{ e: "CPF", t: st_TCpf }, { e: "CNPJ", t: st_TCnpjOpc }] }, { e: "RNTRC", t: st_TRNTRC }, { e: "xNome", t: st$10 }, { g: "s", i: [{ e: "IE", t: st$30 }, { e: "UF", t: st_TUf }], n: 0 }, { e: "tpProp", t: st$23 }] } };
export const rodo_veicReboque: ComplexType<rodo_veicReboque> = { id: "rodo.veicReboque", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cInt", t: st$25, n: 0 }, { e: "placa", t: st$26 }, { e: "RENAVAM", t: st$27, n: 0 }, { e: "tara", t: st$28 }, { e: "capKG", t: st$28 }, { e: "capM3", t: st$29, n: 0 }, { e: "prop", t: rodo_veicReboque_prop, n: 0 }, { e: "tpCar", t: st$32 }, { e: "UF", t: st_TUf, n: 0 }] } };
export const rodo_lacRodo: ComplexType<rodo_lacRodo> = { id: "rodo.lacRodo", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nLacre", t: st$6 }] } };
export const rodo: ComplexType<rodo> = { id: "rodo", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "infANTT", t: rodo_infANTT, n: 0 }, { e: "veicTracao", t: rodo_veicTracao }, { e: "veicReboque", t: rodo_veicReboque, n: 0, x: 3 }, { e: "codAgPorto", t: st$33, n: 0 }, { e: "lacRodo", t: rodo_lacRodo, n: 0, x: -1 }] } };
export const aereo: ComplexType<aereo> = { id: "aereo", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nac", t: st$34 }, { e: "matr", t: st$35 }, { e: "nVoo", t: st$36 }, { e: "cAerEmb", t: st$37 }, { e: "cAerDes", t: st$37 }, { e: "dVoo", t: st_TData }] } };
export const aquav_infTermCarreg: ComplexType<aquav_infTermCarreg> = { id: "aquav.infTermCarreg", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cTermCarreg", t: st$42 }, { e: "xTermCarreg", t: st$10 }] } };
export const aquav_infTermDescarreg: ComplexType<aquav_infTermDescarreg> = { id: "aquav.infTermDescarreg", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cTermDescarreg", t: st$42 }, { e: "xTermDescarreg", t: st$10 }] } };
export const aquav_infEmbComb: ComplexType<aquav_infEmbComb> = { id: "aquav.infEmbComb", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cEmbComb", t: st$25 }, { e: "xBalsa", t: st$10 }] } };
export const aquav_infUnidCargaVazia: ComplexType<aquav_infUnidCargaVazia> = { id: "aquav.infUnidCargaVazia", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "idUnidCargaVazia", t: st_TContainer }, { e: "tpUnidCargaVazia", t: st$43 }] } };
export const aquav_infUnidTranspVazia: ComplexType<aquav_infUnidTranspVazia> = { id: "aquav.infUnidTranspVazia", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "idUnidTranspVazia", t: st_TContainer }, { e: "tpUnidTranspVazia", t: st$44 }] } };
export const aquav: ComplexType<aquav> = { id: "aquav", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "irin", t: st$38 }, { e: "tpEmb", t: st$39 }, { e: "cEmbar", t: st$25 }, { e: "xEmbar", t: st$10 }, { e: "nViag", t: st$40 }, { e: "cPrtEmb", t: st$41 }, { e: "cPrtDest", t: st$41 }, { e: "prtTrans", t: st$10, n: 0 }, { e: "tpNav", t: st$21, n: 0 }, { e: "infTermCarreg", t: aquav_infTermCarreg, n: 0, x: 5 }, { e: "infTermDescarreg", t: aquav_infTermDescarreg, n: 0, x: 5 }, { e: "infEmbComb", t: aquav_infEmbComb, n: 0, x: 30 }, { e: "infUnidCargaVazia", t: aquav_infUnidCargaVazia, n: 0, x: -1 }, { e: "infUnidTranspVazia", t: aquav_infUnidTranspVazia, n: 0, x: -1 }, { e: "MMSI", t: st$45, n: 0 }] } };
export const ferrov_trem: ComplexType<ferrov_trem> = { id: "ferrov.trem", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xPref", t: st$25 }, { e: "dhTrem", t: st_TDateTimeUTC, n: 0 }, { e: "xOri", t: st$46 }, { e: "xDest", t: st$46 }, { e: "qVag", t: st$47 }] } };
export const ferrov_vag: ComplexType<ferrov_vag> = { id: "ferrov.vag", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "pesoBC", t: st_TDec_0303 }, { e: "pesoR", t: st_TDec_0303 }, { e: "tpVag", t: st$48, n: 0 }, { e: "serie", t: st$48 }, { e: "nVag", t: st$49 }, { e: "nSeq", t: st$47, n: 0 }, { e: "TU", t: st$50 }] } };
export const ferrov: ComplexType<ferrov> = { id: "ferrov", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "trem", t: ferrov_trem }, { e: "vag", t: ferrov_vag, x: -1 }] } };
export const TMDFe_infMDFe_infModal: ComplexType<TMDFe_infMDFe_infModal> = { id: "TMDFe.infMDFe.infModal", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versaoModal", t: st$12, r: 1 }], c: { g: "s", i: [{ g: "c", i: [{ e: "rodo", t: rodo }, { e: "aereo", t: aereo }, { e: "aquav", t: aquav }, { e: "ferrov", t: ferrov }] }] } };
export const TUnidadeTransp_lacUnidTransp: ComplexType<TUnidadeTransp_lacUnidTransp> = { id: "TUnidadeTransp.lacUnidTransp", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nLacre", t: st$6 }] } };
export const TUnidCarga_lacUnidCarga: ComplexType<TUnidCarga_lacUnidCarga> = { id: "TUnidCarga.lacUnidCarga", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nLacre", t: st$6 }] } };
export const TUnidCarga: ComplexType<TUnidCarga> = { id: "TUnidCarga", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "tpUnidCarga", t: st_TtipoUnidCarga }, { e: "idUnidCarga", t: st_TContainer }, { e: "lacUnidCarga", t: TUnidCarga_lacUnidCarga, n: 0, x: -1 }, { e: "qtdRat", t: st$50, n: 0 }] } };
export const TUnidadeTransp: ComplexType<TUnidadeTransp> = { id: "TUnidadeTransp", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "tpUnidTransp", t: st_TtipoUnidTransp }, { e: "idUnidTransp", t: st_TContainer }, { e: "lacUnidTransp", t: TUnidadeTransp_lacUnidTransp, n: 0, x: -1 }, { e: "infUnidCarga", t: TUnidCarga, n: 0, x: -1 }, { e: "qtdRat", t: st$50, n: 0 }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_peri: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_peri> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga.infCTe.peri", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nONU", t: st$51 }, { e: "xNomeAE", t: st$52, n: 0 }, { e: "xClaRisco", t: st$53, n: 0 }, { e: "grEmb", t: st$54, n: 0 }, { e: "qTotProd", t: st$6 }, { e: "qVolTipo", t: st$10, n: 0 }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infEntregaParcial: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infEntregaParcial> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga.infCTe.infEntregaParcial", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "qtdTotal", t: st_TDec_1104 }, { e: "qtdParcial", t: st_TDec_1104 }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infNFePrestParcial: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infNFePrestParcial> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga.infCTe.infNFePrestParcial", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "chNFe", t: st_TChCTe }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga_infCTe: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga_infCTe> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga.infCTe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "chCTe", t: st_TChCTe }, { e: "SegCodBarra", t: st_TSegCodBarra, n: 0 }, { e: "indReentrega", t: st$8, n: 0 }, { e: "infUnidTransp", t: TUnidadeTransp, n: 0, x: -1 }, { e: "peri", t: TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_peri, n: 0, x: -1 }, { e: "infEntregaParcial", t: TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infEntregaParcial, n: 0 }, { g: "s", i: [{ e: "indPrestacaoParcial", t: st$8 }, { e: "infNFePrestParcial", t: TMDFe_infMDFe_infDoc_infMunDescarga_infCTe_infNFePrestParcial, x: -1 }], n: 0 }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga_infNFe_peri: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga_infNFe_peri> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga.infNFe.peri", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nONU", t: st$51 }, { e: "xNomeAE", t: st$52, n: 0 }, { e: "xClaRisco", t: st$53, n: 0 }, { e: "grEmb", t: st$54, n: 0 }, { e: "qTotProd", t: st$6 }, { e: "qVolTipo", t: st$10, n: 0 }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga_infNFe: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga_infNFe> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga.infNFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "chNFe", t: st_TChNFe }, { e: "SegCodBarra", t: st_TSegCodBarra, n: 0 }, { e: "indReentrega", t: st$8, n: 0 }, { e: "infUnidTransp", t: TUnidadeTransp, n: 0, x: -1 }, { e: "peri", t: TMDFe_infMDFe_infDoc_infMunDescarga_infNFe_peri, n: 0, x: -1 }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp_peri: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp_peri> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga.infMDFeTransp.peri", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nONU", t: st$51 }, { e: "xNomeAE", t: st$52, n: 0 }, { e: "xClaRisco", t: st$53, n: 0 }, { e: "grEmb", t: st$54, n: 0 }, { e: "qTotProd", t: st$6 }, { e: "qVolTipo", t: st$10, n: 0 }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga.infMDFeTransp", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "chMDFe", t: st_TChNFe }, { e: "indReentrega", t: st$8, n: 0 }, { e: "infUnidTransp", t: TUnidadeTransp, n: 0, x: -1 }, { e: "peri", t: TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp_peri, n: 0, x: -1 }] } };
export const TMDFe_infMDFe_infDoc_infMunDescarga: ComplexType<TMDFe_infMDFe_infDoc_infMunDescarga> = { id: "TMDFe.infMDFe.infDoc.infMunDescarga", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cMunDescarga", t: st_TCodMunIBGE }, { e: "xMunDescarga", t: st$7 }, { e: "infCTe", t: TMDFe_infMDFe_infDoc_infMunDescarga_infCTe, n: 0, x: 20000 }, { e: "infNFe", t: TMDFe_infMDFe_infDoc_infMunDescarga_infNFe, n: 0, x: 20000 }, { e: "infMDFeTransp", t: TMDFe_infMDFe_infDoc_infMunDescarga_infMDFeTransp, n: 0, x: 20000 }] } };
export const TMDFe_infMDFe_infDoc: ComplexType<TMDFe_infMDFe_infDoc> = { id: "TMDFe.infMDFe.infDoc", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "infMunDescarga", t: TMDFe_infMDFe_infDoc_infMunDescarga, x: 1000 }] } };
export const TMDFe_infMDFe_seg_infResp: ComplexType<TMDFe_infMDFe_seg_infResp> = { id: "TMDFe.infMDFe.seg.infResp", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "respSeg", t: st$55 }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "CPF", t: st_TCpf }], n: 0 }] } };
export const TMDFe_infMDFe_seg_infSeg: ComplexType<TMDFe_infMDFe_seg_infSeg> = { id: "TMDFe.infMDFe.seg.infSeg", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xSeg", t: st$56 }, { e: "CNPJ", t: st_TCnpjOpc }] } };
export const TMDFe_infMDFe_seg: ComplexType<TMDFe_infMDFe_seg> = { id: "TMDFe.infMDFe.seg", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "infResp", t: TMDFe_infMDFe_seg_infResp }, { e: "infSeg", t: TMDFe_infMDFe_seg_infSeg, n: 0 }, { e: "nApol", t: st$6, n: 0 }, { e: "nAver", t: st$53, n: 0, x: -1 }] } };
export const TMDFe_infMDFe_prodPred_infLotacao_infLocalCarrega: ComplexType<TMDFe_infMDFe_prodPred_infLotacao_infLocalCarrega> = { id: "TMDFe.infMDFe.prodPred.infLotacao.infLocalCarrega", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "c", i: [{ e: "CEP", t: st$2 }, { g: "s", i: [{ e: "latitude", t: st_TLatitude }, { e: "longitude", t: st_TLongitude }] }] } };
export const TMDFe_infMDFe_prodPred_infLotacao_infLocalDescarrega: ComplexType<TMDFe_infMDFe_prodPred_infLotacao_infLocalDescarrega> = { id: "TMDFe.infMDFe.prodPred.infLotacao.infLocalDescarrega", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "c", i: [{ e: "CEP", t: st$2 }, { g: "s", i: [{ e: "latitude", t: st_TLatitude }, { e: "longitude", t: st_TLongitude }] }] } };
export const TMDFe_infMDFe_prodPred_infLotacao: ComplexType<TMDFe_infMDFe_prodPred_infLotacao> = { id: "TMDFe.infMDFe.prodPred.infLotacao", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "infLocalCarrega", t: TMDFe_infMDFe_prodPred_infLotacao_infLocalCarrega }, { e: "infLocalDescarrega", t: TMDFe_infMDFe_prodPred_infLotacao_infLocalDescarrega }] } };
export const TMDFe_infMDFe_prodPred: ComplexType<TMDFe_infMDFe_prodPred> = { id: "TMDFe.infMDFe.prodPred", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "tpCarga", t: st$57 }, { e: "xProd", t: st$58 }, { e: "cEAN", t: st$59, n: 0 }, { e: "NCM", t: st$60, n: 0 }, { e: "infLotacao", t: TMDFe_infMDFe_prodPred_infLotacao, n: 0 }] } };
export const TMDFe_infMDFe_tot: ComplexType<TMDFe_infMDFe_tot> = { id: "TMDFe.infMDFe.tot", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "qCTe", t: st$61, n: 0 }, { e: "qNFe", t: st$61, n: 0 }, { e: "qMDFe", t: st$61, n: 0 }, { e: "vCarga", t: st_TDec_1302 }, { e: "cUnid", t: st$62 }, { e: "qCarga", t: st_TDec_1104 }] } };
export const TMDFe_infMDFe_lacres: ComplexType<TMDFe_infMDFe_lacres> = { id: "TMDFe.infMDFe.lacres", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nLacre", t: st$10 }] } };
export const TMDFe_infMDFe_autXML: ComplexType<TMDFe_infMDFe_autXML> = { id: "TMDFe.infMDFe.autXML", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ g: "c", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "CPF", t: st_TCpf }] }] } };
export const TMDFe_infMDFe_infAdic: ComplexType<TMDFe_infMDFe_infAdic> = { id: "TMDFe.infMDFe.infAdic", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "infAdFisco", t: st$63, n: 0 }, { e: "infCpl", t: st$64, n: 0 }] } };
export const TRespTec: ComplexType<TRespTec> = { id: "TRespTec", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "xContato", t: st$7 }, { e: "email", t: st_TEmail }, { e: "fone", t: st$11 }, { g: "s", i: [{ e: "idCSRT", t: st$22 }, { e: "hashCSRT", t: st$65 }], n: 0 }] } };
export const TMDFe_infMDFe_infSolicNFF: ComplexType<TMDFe_infMDFe_infSolicNFF> = { id: "TMDFe.infMDFe.infSolicNFF", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "xSolic", t: st$66 }] } };
export const TRSAKeyValueType: ComplexType<TRSAKeyValueType> = { id: "TRSAKeyValueType", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "Modulus", t: st$67 }, { e: "Exponent", t: st$67 }] } };
export const TMDFe_infMDFe_infPAA_PAASignature: ComplexType<TMDFe_infMDFe_infPAA_PAASignature> = { id: "TMDFe.infMDFe.infPAA.PAASignature", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "SignatureValue", t: st$67 }, { e: "RSAKeyValue", t: TRSAKeyValueType }] } };
export const TMDFe_infMDFe_infPAA: ComplexType<TMDFe_infMDFe_infPAA> = { id: "TMDFe.infMDFe.infPAA", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "CNPJPAA", t: st_TCnpj }, { e: "PAASignature", t: TMDFe_infMDFe_infPAA_PAASignature }] } };
export const TMDFe_infMDFe: ComplexType<TMDFe_infMDFe> = { id: "TMDFe.infMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerMDe, r: 1 }, { a: "Id", t: st$1, r: 1 }], c: { g: "s", i: [{ e: "ide", t: TMDFe_infMDFe_ide }, { e: "emit", t: TMDFe_infMDFe_emit }, { e: "infModal", t: TMDFe_infMDFe_infModal }, { e: "infDoc", t: TMDFe_infMDFe_infDoc }, { e: "seg", t: TMDFe_infMDFe_seg, n: 0, x: -1 }, { e: "prodPred", t: TMDFe_infMDFe_prodPred, n: 0 }, { e: "tot", t: TMDFe_infMDFe_tot }, { e: "lacres", t: TMDFe_infMDFe_lacres, n: 0, x: -1 }, { e: "autXML", t: TMDFe_infMDFe_autXML, n: 0, x: 10 }, { e: "infAdic", t: TMDFe_infMDFe_infAdic, n: 0 }, { e: "infRespTec", t: TRespTec, n: 0 }, { e: "infSolicNFF", t: TMDFe_infMDFe_infSolicNFF, n: 0 }, { e: "infPAA", t: TMDFe_infMDFe_infPAA, n: 0 }] } };
export const TMDFe_infMDFeSupl: ComplexType<TMDFe_infMDFeSupl> = { id: "TMDFe.infMDFeSupl", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "qrCodMDFe", t: st$68 }] } };
export const SignedInfoType_CanonicalizationMethod: ComplexType<SignedInfoType_CanonicalizationMethod> = { id: "SignedInfoType.CanonicalizationMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$70, r: 1, f: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" }] };
export const SignedInfoType_SignatureMethod: ComplexType<SignedInfoType_SignatureMethod> = { id: "SignedInfoType.SignatureMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$70, r: 1, f: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" }] };
export const TransformType: ComplexType<TransformType> = { id: "TransformType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st_TTransformURI, r: 1 }], c: { g: "s", i: [{ e: "XPath", t: st$72 }], n: 0, x: -1 } };
export const TransformsType: ComplexType<TransformsType> = { id: "TransformsType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "Transform", t: TransformType, n: 2, x: 2 }] } };
export const ReferenceType_DigestMethod: ComplexType<ReferenceType_DigestMethod> = { id: "ReferenceType.DigestMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$70, r: 1, f: "http://www.w3.org/2000/09/xmldsig#sha1" }] };
export const ReferenceType: ComplexType<ReferenceType> = { id: "ReferenceType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$69 }, { a: "URI", t: st$71, r: 1 }, { a: "Type", t: st$70 }], c: { g: "s", i: [{ e: "Transforms", t: TransformsType, u: ["Algorithm"] }, { e: "DigestMethod", t: ReferenceType_DigestMethod }, { e: "DigestValue", t: st_DigestValueType }] } };
export const SignedInfoType: ComplexType<SignedInfoType> = { id: "SignedInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$69 }], c: { g: "s", i: [{ e: "CanonicalizationMethod", t: SignedInfoType_CanonicalizationMethod }, { e: "SignatureMethod", t: SignedInfoType_SignatureMethod }, { e: "Reference", t: ReferenceType }] } };
export const SignatureValueType: ComplexType<SignatureValueType> = { id: "SignatureValueType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$69 }], tx: st$67 };
export const X509DataType: ComplexType<X509DataType> = { id: "X509DataType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "X509Certificate", t: st$67 }] } };
export const KeyInfoType: ComplexType<KeyInfoType> = { id: "KeyInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$69 }], c: { g: "s", i: [{ e: "X509Data", t: X509DataType }] } };
export const SignatureType: ComplexType<SignatureType> = { id: "SignatureType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$69 }], c: { g: "s", i: [{ e: "SignedInfo", t: SignedInfoType }, { e: "SignatureValue", t: SignatureValueType }, { e: "KeyInfo", t: KeyInfoType }] } };
export const TMDFe: ComplexType<TMDFe> = { id: "TMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "infMDFe", t: TMDFe_infMDFe }, { e: "infMDFeSupl", t: TMDFe_infMDFeSupl, n: 0 }, { e: "Signature", t: SignatureType, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TProtMDFe_infProt: ComplexType<TProtMDFe_infProt> = { id: "TProtMDFe.infProt", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "Id", t: st$69 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "chMDFe", t: st_TChMDFe }, { e: "dhRecbto", t: st_TDateTimeUTC }, { e: "nProt", t: st_TProt, n: 0 }, { e: "digVal", t: st_DigestValueType, n: 0 }, { e: "cStat", t: st$73 }, { e: "xMotivo", t: st_TMotivo }] } };
export const TProtMDFe_infFisco: ComplexType<TProtMDFe_infFisco> = { id: "TProtMDFe.infFisco", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "cMsg", t: st$73 }, { e: "xMsg", t: st_TMotivo }] } };
export const TProtMDFe: ComplexType<TProtMDFe> = { id: "TProtMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerMDe, r: 1 }], c: { g: "s", i: [{ e: "infProt", t: TProtMDFe_infProt }, { e: "infFisco", t: TProtMDFe_infFisco, n: 0 }, { e: "Signature", t: SignatureType, n: 0, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const mdfeProc: ComplexType<mdfeProc> = { id: "mdfeProc", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerMDe, r: 1 }, { a: "ipTransmissor", t: st_TIPv4 }, { a: "nPortaCon", t: st$0 }, { a: "dhConexao", t: st_TDateTimeUTC }], c: { g: "s", i: [{ e: "MDFe", t: TMDFe }, { e: "protMDFe", t: TProtMDFe }] } };
export const TRetMDFe: ComplexType<TRetMDFe> = { id: "TRetMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerMDe, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st$74 }, { e: "cUF", t: st_TCodUfIBGE }, { e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st$73 }, { e: "xMotivo", t: st_TMotivo }, { e: "protMDFe", t: TProtMDFe, n: 0 }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `mdfeProc` (tipo mdfeProc). */
export const mdfeProcElement: ElementoRaiz<mdfeProc> = { nome: "mdfeProc", ns: "http://www.portalfiscal.inf.br/mdfe", tipo: mdfeProc };
/** Elemento raiz `MDFe` (tipo TMDFe). */
export const MDFeElement: ElementoRaiz<TMDFe> = { nome: "MDFe", ns: "http://www.portalfiscal.inf.br/mdfe", tipo: TMDFe };
/** Elemento raiz `retMDFe` (tipo TRetMDFe). */
export const retMDFeElement: ElementoRaiz<TRetMDFe> = { nome: "retMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", tipo: TRetMDFe };
