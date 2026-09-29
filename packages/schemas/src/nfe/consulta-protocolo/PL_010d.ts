// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_010d_v1.03. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * Consulta protocolo (situação) da NF-e: consSitNFe e retConsSitNFe. O detEvento dos eventos devolvidos é xs:any e fica como XML bruto em $any.
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - nfe/PL_010d_v1.03 (PL_010d_v1.03.zip)
 */
import type { ComplexType, RootElement, SchemaModuleInfo, SimpleType } from "../../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: SchemaModuleInfo = {
  "subpath": "nfe/consulta-protocolo/PL_010d",
  "documento": "nfe",
  "pl": "PL_010d_v1.03",
  "fontes": [
    {
      "pacote": "nfe/PL_010d_v1.03",
      "arquivo": "PL_010d_v1.03.zip",
      "sha256": "45ceefe4dfbbfec93958283b650a2f1e1734784f4770d070b9907754de081d9b",
      "url": "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=%2BpBOYTXBtbk="
    }
  ]
};

// ---------- tipos ----------

/**
 * Tipo Versão do Leiaute da Cosulta situação NF-e - 4.00
 * xsd:TVerConsSitNFe
 */
export type TVerConsSitNFe = "4.00";

/**
 * Tipo Ambiente
 * xsd:TAmb
 */
export type TAmb = "1" | "2";

/**
 * Tipo Pedido de Consulta da Situação Atual da Nota Fiscal Eletrônica
 * xsd: TConsSitNFe
 */
export type TConsSitNFe = {
  /** @attribute xsd:TVerConsSitNFe */
  versao: TVerConsSitNFe;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Serviço Solicitado
   * xsd:TServ, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xServ: "CONSULTAR";
  /**
   * Chaves de acesso da NF-e, compostas por: UF do emitente, AAMM da emissão da NFe, CNPJ do emitente, modelo, série e número da NF-e e código numérico + DV.
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFe: string;
};

/**
 * Dados do protocolo de status
 * xsd: tipo anônimo de TProtNFe.infProt
 */
export type TProtNFe_infProt = {
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
   * Versão do Aplicativo que processou a NF-e
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Chaves de acesso da NF-e, compostas por: UF do emitente, AAMM da emissão da NFe, CNPJ do emitente, modelo, série e número da NF-e e código numérico+DV.
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFe: string;
  /** Data e hora de processamento, no formato AAAA-MM-DDTHH:MM:SS (ou AAAA-MM-DDTHH:MM:SSTZD, de acordo com versão). Deve ser preenchida com data e hora da gravação no Banco em caso de Confirmação. Em caso de Rejeição, com data e hora do recebimento do Lote de NF-e enviado. */
  dhRecbto: string;
  /**
   * Número do Protocolo de Status da NF-e. 1 posição (1 – Secretaria de Fazenda Estadual 2 – Receita Federal); 2 - códiga da UF - 2 posições ano; 10 seqüencial no ano.
   * xsd:TProt, tamanho 0..17, pattern `[0-9]{15}|[0-9]{17}`
   */
  nProt?: string;
  /**
   * Digest Value da NF-e processada. Utilizado para conferir a integridade da NF-e original.
   * xsd:DigestValueType
   */
  digVal?: string;
  /**
   * Código do status da mensagem enviada.
   * xsd:TStat, tamanho 0..4, pattern `[0-9]{3,4}`
   */
  cStat: string;
  /**
   * Descrição literal do status do serviço solicitado.
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
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
 * Tipo Protocolo de status resultado do processamento da NF-e
 * xsd: TProtNFe
 */
export type TProtNFe = {
  /** @attribute xsd:TVerNFe */
  versao: string;
  /** Dados do protocolo de status */
  infProt: TProtNFe_infProt;
  Signature?: SignatureType;
};

/**
 * Tipo Código da UF da tabela do IBGE
 * xsd:TCodUfIBGE
 */
export type TCodUfIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53";

/**
 * Dados do Resultado do Pedido de Cancelamento da Nota Fiscal Eletrônica
 * xsd: tipo anônimo de TRetCancNFe.infCanc
 */
export type TRetCancNFe_infCanc = {
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
   * Versão do Aplicativo que processou o pedido de cancelamento
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Código do status da mensagem enviada.
   * xsd:TStat, tamanho 0..4, pattern `[0-9]{3,4}`
   */
  cStat: string;
  /**
   * Descrição literal do status do serviço solicitado.
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
  /**
   * código da UF de atendimento
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * Chaves de acesso da NF-e, compostas por: UF do emitente, AAMM da emissão da NFe, CNPJ do emitente, modelo, série e número da NF-e e código numérico + DV.
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFe?: string;
  /** Data e hora de recebimento, no formato AAAA-MM-DDTHH:MM:SS. Deve ser preenchida com data e hora da gravação no Banco em caso de Confirmação. */
  dhRecbto?: string;
  /**
   * Número do Protocolo de Status da NF-e. 1 posição (1 – Secretaria de Fazenda Estadual 2 – Receita Federal); 2 - código da UF - 2 posições ano; 10 seqüencial no ano.
   * xsd:TProt, tamanho 0..17, pattern `[0-9]{15}|[0-9]{17}`
   */
  nProt?: string;
};

/**
 * Tipo retorno Pedido de Cancelamento da Nota Fiscal Eletrônica
 * xsd: TRetCancNFe
 */
export type TRetCancNFe = {
  /** @attribute xsd:TVerCancNFe */
  versao: string;
  /** Dados do Resultado do Pedido de Cancelamento da Nota Fiscal Eletrônica */
  infCanc: TRetCancNFe_infCanc;
  Signature?: SignatureType;
};

/**
 * Detalhe Específico do Evento
 * xsd: tipo anônimo de TEvento.infEvento.detEvento
 */
export type TEvento_infEvento_detEvento = {
  /** Atributos de `xs:anyAttribute` (processContents skip). */
  $attrs?: Record<string, string>;
  /** Conteúdo de `xs:any` (processContents skip), como XML bruto em ordem. */
  $any: string[];
};

/**
 * Tipo Código de orgão (UF da tabela do IBGE + 90 RFB)
 * xsd:TCOrgaoIBGE
 */
export type TCOrgaoIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53" | "90" | "91" | "92";

/** xsd: tipo anônimo de TEvento.infEvento */
export type TEvento_infEvento = {
  /**
   * Identificador da TAG a ser assinada, a regra de formação do Id é:
   * “ID” + tpEvento +  chave da NF-e + nSeqEvento
   * @attribute pattern `ID[0-9]{12}[0-9A-Z]{12}[0-9]{28}`
   */
  Id: string;
  /**
   * Código do órgão de recepção do Evento. Utilizar a Tabela do IBGE extendida, utilizar 90 para identificar o Ambiente Nacional
   * xsd:TCOrgaoIBGE
   */
  cOrgao: TCOrgaoIBGE;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Chave de Acesso da NF-e vinculada ao evento
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFe: string;
  /**
   * Data e Hora do Evento, formato UTC (AAAA-MM-DDThh:mm:ssTZD, onde TZD = +hh:mm ou -hh:mm)
   * xsd:TDateTimeUTC
   */
  dhEvento: string;
  /**
   * Tipo do Evento
   * pattern `[0-9]{6}`
   */
  tpEvento: string;
  /**
   * Seqüencial do evento para o mesmo tipo de evento.  Para maioria dos eventos será 1, nos casos em que possa existir mais de um evento, como é o caso da carta de correção, o autor do evento deve numerar de forma seqüencial.
   * pattern `[1-9][0-9]{0,1}`
   */
  nSeqEvento: string;
  /** Versão do Tipo do Evento */
  verEvento: string;
  /** Detalhe Específico do Evento */
  detEvento: TEvento_infEvento_detEvento;
} & (
  ({
  /**
   * CNPJ
   * xsd:TCnpjOpc, tamanho 0..14, pattern `[0-9]{0}|[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * CPF
   * xsd:TCpf, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

/**
 * Tipo Evento
 * xsd: TEvento
 */
export type TEvento = {
  /** @attribute xsd:TVerEvento */
  versao: string;
  infEvento: TEvento_infEvento;
  Signature: SignatureType;
};

/** xsd: tipo anônimo de TRetEvento.infEvento */
export type TRetEvento_infEvento = {
  /** @attribute pattern `ID[0-9]{15}` */
  Id?: string;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Versão do Aplicativo que recebeu o Evento
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Código do órgão de recepção do Evento. Utilizar a Tabela do IBGE extendida, utilizar 90 para identificar o Ambiente Nacional
   * xsd:TCOrgaoIBGE
   */
  cOrgao: TCOrgaoIBGE;
  /**
   * Código do status da registro do Evento
   * xsd:TStat, tamanho 0..4, pattern `[0-9]{3,4}`
   */
  cStat: string;
  /**
   * Descrição literal do status do registro do Evento
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
  /**
   * Chave de Acesso NF-e vinculada
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFe?: string;
  /**
   * Tipo do Evento vinculado
   * pattern `[0-9]{6}`
   */
  tpEvento?: string;
  /**
   * Descrição do Evento
   * xsd:TString, tamanho 5..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xEvento?: string;
  /**
   * Seqüencial do evento
   * pattern `[1-9][0-9]{0,1}`
   */
  nSeqEvento?: string;
  /**
   * email do destinatário
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  emailDest?: string;
  /**
   * Data e Hora de registro do evento formato UTC AAAA-MM-DDTHH:MM:SSTZD
   * xsd:TDateTimeUTC
   */
  dhRegEvento: string;
  /**
   * Número do protocolo de registro do evento
   * xsd:TProt, tamanho 0..17, pattern `[0-9]{15}|[0-9]{17}`
   */
  nProt?: string;
} & (
  ({
  /**
   * CNPJ Destinatário
   * xsd:TCnpjOpc, tamanho 0..14, pattern `[0-9]{0}|[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJDest: string;
  CPFDest?: never;
})
  | ({
  /**
   * CPF Destiantário
   * xsd:TCpf, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPFDest: string;
  CNPJDest?: never;
})
  | ({ CNPJDest?: never; CPFDest?: never })
);

/**
 * Tipo retorno do Evento
 * xsd: TRetEvento
 */
export type TRetEvento = {
  /** @attribute xsd:TRetVerEvento */
  versao: string;
  infEvento: TRetEvento_infEvento;
  Signature?: SignatureType;
};

/**
 * Tipo procEvento
 * xsd: TProcEvento
 */
export type TProcEvento = {
  /** @attribute xsd:TVerEvento */
  versao: string;
  evento: TEvento;
  retEvento: TRetEvento;
};

/**
 * Tipo Retorno de Pedido de Consulta da Situação Atual da Nota Fiscal Eletrônica
 * xsd: TRetConsSitNFe
 */
export type TRetConsSitNFe = {
  /** @attribute xsd:TVerConsSitNFe */
  versao: TVerConsSitNFe;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Versão do Aplicativo que processou a NF-e
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Código do status da mensagem enviada.
   * xsd:TStat, tamanho 0..4, pattern `[0-9]{3,4}`
   */
  cStat: string;
  /**
   * Descrição literal do status do serviço solicitado.
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
  /**
   * código da UF de atendimento
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * AAAA-MM-DDTHH:MM:SSTZD
   * xsd:TDateTimeUTC
   */
  dhRecbto: string;
  /**
   * Chaves de acesso da NF-e consultada
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFe: string;
  /** Protocolo de autorização de uso da NF-e */
  protNFe?: TProtNFe;
  /** Protocolo de homologação de cancelamento de uso da NF-e */
  retCancNFe?: TRetCancNFe;
  /**
   * Protocolo de registro de evento da NF-e
   * ocorre 0..n
   */
  procEventoNFe?: TProcEvento[];
};


// ---------- descritores de tipo simples ----------
const st_TVerConsSitNFe: SimpleType = { b: "string", e: ["4.00"], nm: "TVerConsSitNFe" };
const st_TAmb: SimpleType = { b: "string", e: ["1","2"], nm: "TAmb" };
const st$0: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], e: ["CONSULTAR"], nm: "TServ" };
const st_TChNFe: SimpleType = { b: "string", p: [["[0-9]{6}[0-9A-Z]{12}[0-9]{26}"]], mx: 44, nm: "TChNFe" };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st_TStat: SimpleType = { b: "string", p: [["[0-9]{3,4}"]], mx: 4, nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st_TCodUfIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53"], nm: "TCodUfIBGE" };
const st_TDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([\\-,\\+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TDateTimeUTC" };
const st_TVerNFe: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[1-9]{1}\\.[0-9]{2}"]], nm: "TVerNFe" };
const st$1: SimpleType = { b: "ID" };
const st$2: SimpleType = { b: "dateTime" };
const st_TProt: SimpleType = { b: "string", p: [["[0-9]{15}|[0-9]{17}"]], mx: 17, nm: "TProt" };
const st_DigestValueType: SimpleType = { b: "base64Binary", nm: "DigestValueType" };
const st$3: SimpleType = { b: "anyURI" };
const st$4: SimpleType = { b: "anyURI", mn: 2 };
const st_TTransformURI: SimpleType = { b: "anyURI", e: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature","http://www.w3.org/TR/2001/REC-xml-c14n-20010315"], nm: "TTransformURI" };
const st$5: SimpleType = { b: "string" };
const st$6: SimpleType = { b: "base64Binary" };
const st_TVerCancNFe: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[1-9]{1}\\.[0-9]{2}"]], nm: "TVerCancNFe" };
const st_TVerEvento: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[1-9]{1}\\.[0-9]{2}"]], nm: "TVerEvento" };
const st$7: SimpleType = { b: "ID", p: [["ID[0-9]{12}[0-9A-Z]{12}[0-9]{28}"]] };
const st_TCOrgaoIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53","90","91","92"], nm: "TCOrgaoIBGE" };
const st_TCnpjOpc: SimpleType = { b: "string", p: [["[0-9]{0}|[0-9A-Z]{12}[0-9]{2}"]], mx: 14, nm: "TCnpjOpc" };
const st_TCpf: SimpleType = { b: "string", p: [["[0-9]{11}"]], mx: 11, nm: "TCpf" };
const st$8: SimpleType = { b: "string", p: [["[0-9]{6}"]] };
const st$9: SimpleType = { b: "string", p: [["[1-9][0-9]{0,1}"]] };
const st_TRetVerEvento: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"],["[1-9]{1}\\.[0-9]{2}"]], nm: "TRetVerEvento" };
const st$10: SimpleType = { b: "ID", p: [["ID[0-9]{15}"]] };
const st$11: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 5, mx: 60, nm: "TString" };
const st$12: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 60, nm: "TString" };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const TConsSitNFe: ComplexType<TConsSitNFe> = { id: "TConsSitNFe", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerConsSitNFe, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "xServ", t: st$0 }, { e: "chNFe", t: st_TChNFe }] } };
export const TProtNFe_infProt: ComplexType<TProtNFe_infProt> = { id: "TProtNFe.infProt", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "Id", t: st$1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "chNFe", t: st_TChNFe }, { e: "dhRecbto", t: st$2 }, { e: "nProt", t: st_TProt, n: 0 }, { e: "digVal", t: st_DigestValueType, n: 0 }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }] } };
export const SignedInfoType_CanonicalizationMethod: ComplexType<SignedInfoType_CanonicalizationMethod> = { id: "SignedInfoType.CanonicalizationMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$3, r: 1, f: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" }] };
export const SignedInfoType_SignatureMethod: ComplexType<SignedInfoType_SignatureMethod> = { id: "SignedInfoType.SignatureMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$3, r: 1, f: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" }] };
export const TransformType: ComplexType<TransformType> = { id: "TransformType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st_TTransformURI, r: 1 }], c: { g: "s", i: [{ e: "XPath", t: st$5 }], n: 0, x: -1 } };
export const TransformsType: ComplexType<TransformsType> = { id: "TransformsType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "Transform", t: TransformType, n: 2, x: 2 }] } };
export const ReferenceType_DigestMethod: ComplexType<ReferenceType_DigestMethod> = { id: "ReferenceType.DigestMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$3, r: 1, f: "http://www.w3.org/2000/09/xmldsig#sha1" }] };
export const ReferenceType: ComplexType<ReferenceType> = { id: "ReferenceType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$1 }, { a: "URI", t: st$4, r: 1 }, { a: "Type", t: st$3 }], c: { g: "s", i: [{ e: "Transforms", t: TransformsType, u: ["Algorithm"] }, { e: "DigestMethod", t: ReferenceType_DigestMethod }, { e: "DigestValue", t: st_DigestValueType }] } };
export const SignedInfoType: ComplexType<SignedInfoType> = { id: "SignedInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$1 }], c: { g: "s", i: [{ e: "CanonicalizationMethod", t: SignedInfoType_CanonicalizationMethod }, { e: "SignatureMethod", t: SignedInfoType_SignatureMethod }, { e: "Reference", t: ReferenceType }] } };
export const SignatureValueType: ComplexType<SignatureValueType> = { id: "SignatureValueType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$1 }], tx: st$6 };
export const X509DataType: ComplexType<X509DataType> = { id: "X509DataType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "X509Certificate", t: st$6 }] } };
export const KeyInfoType: ComplexType<KeyInfoType> = { id: "KeyInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$1 }], c: { g: "s", i: [{ e: "X509Data", t: X509DataType }] } };
export const SignatureType: ComplexType<SignatureType> = { id: "SignatureType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$1 }], c: { g: "s", i: [{ e: "SignedInfo", t: SignedInfoType }, { e: "SignatureValue", t: SignatureValueType }, { e: "KeyInfo", t: KeyInfoType }] } };
export const TProtNFe: ComplexType<TProtNFe> = { id: "TProtNFe", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerNFe, r: 1 }], c: { g: "s", i: [{ e: "infProt", t: TProtNFe_infProt }, { e: "Signature", t: SignatureType, n: 0, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TRetCancNFe_infCanc: ComplexType<TRetCancNFe_infCanc> = { id: "TRetCancNFe.infCanc", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "Id", t: st$1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "cUF", t: st_TCodUfIBGE }, { e: "chNFe", t: st_TChNFe, n: 0 }, { e: "dhRecbto", t: st$2, n: 0 }, { e: "nProt", t: st_TProt, n: 0 }] } };
export const TRetCancNFe: ComplexType<TRetCancNFe> = { id: "TRetCancNFe", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerCancNFe, r: 1 }], c: { g: "s", i: [{ e: "infCanc", t: TRetCancNFe_infCanc }, { e: "Signature", t: SignatureType, n: 0, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TEvento_infEvento_detEvento: ComplexType<TEvento_infEvento_detEvento> = { id: "TEvento.infEvento.detEvento", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ w: 1, x: -1 }] }, aa: 1 };
export const TEvento_infEvento: ComplexType<TEvento_infEvento> = { id: "TEvento.infEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "Id", t: st$7, r: 1 }], c: { g: "s", i: [{ e: "cOrgao", t: st_TCOrgaoIBGE }, { e: "tpAmb", t: st_TAmb }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpjOpc }, { e: "CPF", t: st_TCpf }] }, { e: "chNFe", t: st_TChNFe }, { e: "dhEvento", t: st_TDateTimeUTC }, { e: "tpEvento", t: st$8 }, { e: "nSeqEvento", t: st$9 }, { e: "verEvento", t: st$5 }, { e: "detEvento", t: TEvento_infEvento_detEvento }] } };
export const TEvento: ComplexType<TEvento> = { id: "TEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerEvento, r: 1 }], c: { g: "s", i: [{ e: "infEvento", t: TEvento_infEvento }, { e: "Signature", t: SignatureType, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TRetEvento_infEvento: ComplexType<TRetEvento_infEvento> = { id: "TRetEvento.infEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "Id", t: st$10 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cOrgao", t: st_TCOrgaoIBGE }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "chNFe", t: st_TChNFe, n: 0 }, { e: "tpEvento", t: st$8, n: 0 }, { e: "xEvento", t: st$11, n: 0 }, { e: "nSeqEvento", t: st$9, n: 0 }, { g: "c", i: [{ e: "CNPJDest", t: st_TCnpjOpc }, { e: "CPFDest", t: st_TCpf }], n: 0 }, { e: "emailDest", t: st$12, n: 0 }, { e: "dhRegEvento", t: st_TDateTimeUTC }, { e: "nProt", t: st_TProt, n: 0 }] } };
export const TRetEvento: ComplexType<TRetEvento> = { id: "TRetEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TRetVerEvento, r: 1 }], c: { g: "s", i: [{ e: "infEvento", t: TRetEvento_infEvento }, { e: "Signature", t: SignatureType, n: 0, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TProcEvento: ComplexType<TProcEvento> = { id: "TProcEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerEvento, r: 1 }], c: { g: "s", i: [{ e: "evento", t: TEvento }, { e: "retEvento", t: TRetEvento }] } };
export const TRetConsSitNFe: ComplexType<TRetConsSitNFe> = { id: "TRetConsSitNFe", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerConsSitNFe, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "cUF", t: st_TCodUfIBGE }, { e: "dhRecbto", t: st_TDateTimeUTC }, { e: "chNFe", t: st_TChNFe }, { e: "protNFe", t: TProtNFe, n: 0 }, { e: "retCancNFe", t: TRetCancNFe, n: 0 }, { e: "procEventoNFe", t: TProcEvento, n: 0, x: -1 }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `consSitNFe` (tipo TConsSitNFe). */
export const consSitNFeElement: RootElement<TConsSitNFe> = { name: "consSitNFe", ns: "http://www.portalfiscal.inf.br/nfe", type: TConsSitNFe };
/** Elemento raiz `retConsSitNFe` (tipo TRetConsSitNFe). */
export const retConsSitNFeElement: RootElement<TRetConsSitNFe> = { name: "retConsSitNFe", ns: "http://www.portalfiscal.inf.br/nfe", type: TRetConsSitNFe };
