// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_010d_v1.03. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * Inutilização de numeração da NF-e: inutNFe, retInutNFe e ProcInutNFe.
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - nfe/PL_010d_v1.03 (PL_010d_v1.03.zip)
 */
import type { ComplexType, DescricaoModuloSchema, ElementoRaiz, SimpleType } from "../../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: DescricaoModuloSchema = {
  "subpath": "nfe/inutilizacao/PL_010d",
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
 * Tipo Ambiente
 * xsd:TAmb
 */
export type TAmb = "1" | "2";

/**
 * Tipo Código da UF da tabela do IBGE
 * xsd:TCodUfIBGE
 */
export type TCodUfIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53";

/**
 * Tipo Modelo Documento Fiscal
 * xsd:TMod
 */
export type TMod = "55" | "65";

/**
 * Dados do Pedido de Inutilização de Numeração da Nota Fiscal Eletrônica
 * xsd: tipo anônimo de TInutNFe.infInut
 */
export type TInutNFe_infInut = {
  /** @attribute pattern `ID[0-9]{4}[0-9A-Z]{12}[0-9]{25}` */
  Id: string;
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
  xServ: "INUTILIZAR";
  /**
   * Código da UF do emitente
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * Ano de inutilização da numeração
   * xsd:Tano, pattern `[0-9]{2}`
   */
  ano: string;
  /**
   * CNPJ do emitente
   * xsd:TCnpj, tamanho 0..14, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ: string;
  /**
   * Modelo da NF-e (55, 65 etc.)
   * xsd:TMod
   */
  mod: TMod;
  /**
   * Série da NF-e
   * xsd:TSerie, pattern `0|[1-9]{1}[0-9]{0,2}`
   */
  serie: string;
  /**
   * Número da NF-e inicial
   * xsd:TNF, pattern `[1-9]{1}[0-9]{0,8}`
   */
  nNFIni: string;
  /**
   * Número da NF-e final
   * xsd:TNF, pattern `[1-9]{1}[0-9]{0,8}`
   */
  nNFFin: string;
  /**
   * Justificativa do pedido de inutilização
   * xsd:TJust, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xJust: string;
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
 * Tipo Pedido de Inutilização de Numeração da Nota Fiscal Eletrônica
 * xsd: TInutNFe
 */
export type TInutNFe = {
  /** @attribute xsd:TVerInutNFe, pattern `4\.00` */
  versao: string;
  /** Dados do Pedido de Inutilização de Numeração da Nota Fiscal Eletrônica */
  infInut: TInutNFe_infInut;
  Signature: SignatureType;
};

/**
 * Dados do Retorno do Pedido de Inutilização de Numeração da Nota Fiscal Eletrônica
 * xsd: tipo anônimo de TRetInutNFe.infInut
 */
export type TRetInutNFe_infInut = {
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
   * Código da UF que atendeu a solicitação
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * Ano de inutilização da numeração
   * xsd:Tano, pattern `[0-9]{2}`
   */
  ano?: string;
  /**
   * CNPJ do emitente
   * xsd:TCnpj, tamanho 0..14, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ?: string;
  /**
   * Modelo da NF-e (55, etc.)
   * xsd:TMod
   */
  mod?: TMod;
  /**
   * Série da NF-e
   * xsd:TSerie, pattern `0|[1-9]{1}[0-9]{0,2}`
   */
  serie?: string;
  /**
   * Número da NF-e inicial
   * xsd:TNF, pattern `[1-9]{1}[0-9]{0,8}`
   */
  nNFIni?: string;
  /**
   * Número da NF-e final
   * xsd:TNF, pattern `[1-9]{1}[0-9]{0,8}`
   */
  nNFFin?: string;
  /**
   * Data e hora de recebimento, no formato AAAA-MM-DDTHH:MM:SS. Deve ser preenchida com data e hora da gravação no Banco em caso de Confirmação. Em caso de Rejeição, com data e hora do recebimento do Pedido de Inutilização.
   * xsd:TDateTimeUTC
   */
  dhRecbto: string;
  /**
   * Número do Protocolo de Status da NF-e. 1 posição (1 – Secretaria de Fazenda Estadual 2 – Receita Federal); 2 - código da UF - 2 posições ano; 10 seqüencial no ano.
   * xsd:TProt, tamanho 0..17, pattern `[0-9]{15}|[0-9]{17}`
   */
  nProt?: string;
};

/**
 * Tipo retorno do Pedido de Inutilização de Numeração da Nota Fiscal Eletrônica
 * xsd: TRetInutNFe
 */
export type TRetInutNFe = {
  /** @attribute xsd:TVerInutNFe, pattern `4\.00` */
  versao: string;
  /** Dados do Retorno do Pedido de Inutilização de Numeração da Nota Fiscal Eletrônica */
  infInut: TRetInutNFe_infInut;
  Signature?: SignatureType;
};

/**
 * Tipo Pedido de inutilzação de númeração de  NF-e processado
 * xsd: TProcInutNFe
 */
export type TProcInutNFe = {
  /** @attribute xsd:TVerInutNFe, pattern `4\.00` */
  versao: string;
  inutNFe: TInutNFe;
  retInutNFe: TRetInutNFe;
};


// ---------- descritores de tipo simples ----------
const st_TVerInutNFe: SimpleType = { b: "token", p: [["4\\.00"]], nm: "TVerInutNFe" };
const st$0: SimpleType = { b: "ID", p: [["ID[0-9]{4}[0-9A-Z]{12}[0-9]{25}"]] };
const st_TAmb: SimpleType = { b: "string", e: ["1","2"], nm: "TAmb" };
const st$1: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], e: ["INUTILIZAR"], nm: "TServ" };
const st_TCodUfIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53"], nm: "TCodUfIBGE" };
const st_Tano: SimpleType = { b: "string", p: [["[0-9]{2}"]], nm: "Tano" };
const st_TCnpj: SimpleType = { b: "string", p: [["[0-9A-Z]{12}[0-9]{2}"]], mx: 14, nm: "TCnpj" };
const st_TMod: SimpleType = { b: "string", e: ["55","65"], nm: "TMod" };
const st_TSerie: SimpleType = { b: "string", p: [["0|[1-9]{1}[0-9]{0,2}"]], nm: "TSerie" };
const st_TNF: SimpleType = { b: "string", p: [["[1-9]{1}[0-9]{0,8}"]], nm: "TNF" };
const st_TJust: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 15, mx: 255, nm: "TJust" };
const st$2: SimpleType = { b: "ID" };
const st$3: SimpleType = { b: "anyURI" };
const st$4: SimpleType = { b: "anyURI", mn: 2 };
const st_TTransformURI: SimpleType = { b: "anyURI", e: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature","http://www.w3.org/TR/2001/REC-xml-c14n-20010315"], nm: "TTransformURI" };
const st$5: SimpleType = { b: "string" };
const st_DigestValueType: SimpleType = { b: "base64Binary", nm: "DigestValueType" };
const st$6: SimpleType = { b: "base64Binary" };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st_TStat: SimpleType = { b: "string", p: [["[0-9]{3,4}"]], mx: 4, nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st_TDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([\\-,\\+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TDateTimeUTC" };
const st_TProt: SimpleType = { b: "string", p: [["[0-9]{15}|[0-9]{17}"]], mx: 17, nm: "TProt" };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const TInutNFe_infInut: ComplexType<TInutNFe_infInut> = { id: "TInutNFe.infInut", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "Id", t: st$0, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "xServ", t: st$1 }, { e: "cUF", t: st_TCodUfIBGE }, { e: "ano", t: st_Tano }, { e: "CNPJ", t: st_TCnpj }, { e: "mod", t: st_TMod }, { e: "serie", t: st_TSerie }, { e: "nNFIni", t: st_TNF }, { e: "nNFFin", t: st_TNF }, { e: "xJust", t: st_TJust }] } };
export const SignedInfoType_CanonicalizationMethod: ComplexType<SignedInfoType_CanonicalizationMethod> = { id: "SignedInfoType.CanonicalizationMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$3, r: 1, f: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" }] };
export const SignedInfoType_SignatureMethod: ComplexType<SignedInfoType_SignatureMethod> = { id: "SignedInfoType.SignatureMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$3, r: 1, f: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" }] };
export const TransformType: ComplexType<TransformType> = { id: "TransformType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st_TTransformURI, r: 1 }], c: { g: "s", i: [{ e: "XPath", t: st$5 }], n: 0, x: -1 } };
export const TransformsType: ComplexType<TransformsType> = { id: "TransformsType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "Transform", t: TransformType, n: 2, x: 2 }] } };
export const ReferenceType_DigestMethod: ComplexType<ReferenceType_DigestMethod> = { id: "ReferenceType.DigestMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$3, r: 1, f: "http://www.w3.org/2000/09/xmldsig#sha1" }] };
export const ReferenceType: ComplexType<ReferenceType> = { id: "ReferenceType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$2 }, { a: "URI", t: st$4, r: 1 }, { a: "Type", t: st$3 }], c: { g: "s", i: [{ e: "Transforms", t: TransformsType, u: ["Algorithm"] }, { e: "DigestMethod", t: ReferenceType_DigestMethod }, { e: "DigestValue", t: st_DigestValueType }] } };
export const SignedInfoType: ComplexType<SignedInfoType> = { id: "SignedInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$2 }], c: { g: "s", i: [{ e: "CanonicalizationMethod", t: SignedInfoType_CanonicalizationMethod }, { e: "SignatureMethod", t: SignedInfoType_SignatureMethod }, { e: "Reference", t: ReferenceType }] } };
export const SignatureValueType: ComplexType<SignatureValueType> = { id: "SignatureValueType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$2 }], tx: st$6 };
export const X509DataType: ComplexType<X509DataType> = { id: "X509DataType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "X509Certificate", t: st$6 }] } };
export const KeyInfoType: ComplexType<KeyInfoType> = { id: "KeyInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$2 }], c: { g: "s", i: [{ e: "X509Data", t: X509DataType }] } };
export const SignatureType: ComplexType<SignatureType> = { id: "SignatureType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$2 }], c: { g: "s", i: [{ e: "SignedInfo", t: SignedInfoType }, { e: "SignatureValue", t: SignatureValueType }, { e: "KeyInfo", t: KeyInfoType }] } };
export const TInutNFe: ComplexType<TInutNFe> = { id: "TInutNFe", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerInutNFe, r: 1 }], c: { g: "s", i: [{ e: "infInut", t: TInutNFe_infInut }, { e: "Signature", t: SignatureType, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TRetInutNFe_infInut: ComplexType<TRetInutNFe_infInut> = { id: "TRetInutNFe.infInut", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "Id", t: st$2 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "cUF", t: st_TCodUfIBGE }, { e: "ano", t: st_Tano, n: 0 }, { e: "CNPJ", t: st_TCnpj, n: 0 }, { e: "mod", t: st_TMod, n: 0 }, { e: "serie", t: st_TSerie, n: 0 }, { e: "nNFIni", t: st_TNF, n: 0 }, { e: "nNFFin", t: st_TNF, n: 0 }, { e: "dhRecbto", t: st_TDateTimeUTC }, { e: "nProt", t: st_TProt, n: 0 }] } };
export const TRetInutNFe: ComplexType<TRetInutNFe> = { id: "TRetInutNFe", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerInutNFe, r: 1 }], c: { g: "s", i: [{ e: "infInut", t: TRetInutNFe_infInut }, { e: "Signature", t: SignatureType, n: 0, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TProcInutNFe: ComplexType<TProcInutNFe> = { id: "TProcInutNFe", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerInutNFe, r: 1 }], c: { g: "s", i: [{ e: "inutNFe", t: TInutNFe }, { e: "retInutNFe", t: TRetInutNFe }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `inutNFe` (tipo TInutNFe). */
export const inutNFeElement: ElementoRaiz<TInutNFe> = { nome: "inutNFe", ns: "http://www.portalfiscal.inf.br/nfe", tipo: TInutNFe };
/** Elemento raiz `retInutNFe` (tipo TRetInutNFe). */
export const retInutNFeElement: ElementoRaiz<TRetInutNFe> = { nome: "retInutNFe", ns: "http://www.portalfiscal.inf.br/nfe", tipo: TRetInutNFe };
/** Elemento raiz `ProcInutNFe` (tipo TProcInutNFe). */
export const ProcInutNFeElement: ElementoRaiz<TProcInutNFe> = { nome: "ProcInutNFe", ns: "http://www.portalfiscal.inf.br/nfe", tipo: TProcInutNFe };
