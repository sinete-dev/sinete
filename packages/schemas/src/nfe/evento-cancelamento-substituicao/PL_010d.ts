// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_010d_v1.03. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * Cancelamento por substituição da NFC-e (tpEvento 110112, NT 2018.004). Envelope genérico do evento do PL_010d_v1.03 (CNPJ alfanumérico) com o detEvento ligado ao e110112_v1.00.xsd, como a SEFAZ valida: primeiro o envelope, depois o detEvento pelo schema do tipo de evento. Tipos básicos repetidos entre os dois pacotes vêm do PL_010d (o mais novo).
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - nfe/PL_010d_v1.03 (PL_010d_v1.03.zip)
 * - nfe/Evento_CancSubst_v1.01 (Evento_CancSubst.zip)
 */
import type { ComplexType, DescricaoModuloSchema, ElementoRaiz, SimpleType } from "../../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: DescricaoModuloSchema = {
  "subpath": "nfe/evento-cancelamento-substituicao/PL_010d",
  "documento": "nfe",
  "pl": "PL_010d_v1.03",
  "fontes": [
    {
      "pacote": "nfe/PL_010d_v1.03",
      "arquivo": "PL_010d_v1.03.zip",
      "sha256": "45ceefe4dfbbfec93958283b650a2f1e1734784f4770d070b9907754de081d9b",
      "url": "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=%2BpBOYTXBtbk="
    },
    {
      "pacote": "nfe/Evento_CancSubst_v1.01",
      "arquivo": "Evento_CancSubst.zip",
      "sha256": "49a32c2c4dc64413f6ef47ed4756b54121ec56514d5352d6931b9bf43a0706a1",
      "url": "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=6UBZKIOo6qU="
    }
  ]
};

// ---------- tipos ----------

/**
 * Tipo Código da UF da tabela do IBGE
 * xsd:TCodUfIBGE
 */
export type TCodUfIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53";

/**
 * Schema XML de validação do evento do cancelamento por substituição 110112
 * xsd: tipo anônimo de TEvento.infEvento.detEvento
 */
export type TEvento_infEvento_detEvento = {
  /** @attribute */
  versao: "1.00";
  /** Descrição do Evento - “Cancelamento por substituição” */
  descEvento: "Cancelamento por substituicao";
  /**
   * Código do Órgão Autor do Evento. Informar o Código da UF para este Evento.
   * xsd:TCodUfIBGE
   */
  cOrgaoAutor: TCodUfIBGE;
  /**
   * Autor do Evento de Irregularidade FiscalInformar 5=Fisco para este Evento.
   * Valores: 1=Empresa Emitente, 2=Empresa destinatária; 3=Empresa; 5=Fisco;6=RFB; 9=Outros Órgãos;
   */
  tpAutor: "1";
  /**
   * Versão do Aplicativo que recebeu o Evento
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Número do Protocolo de Status da NF-e. 1 posição (1 – Secretaria de Fazenda Estadual 2 – Receita Federal); 2 posições ano; 10 seqüencial no ano.
   * xsd:TProt, pattern `[0-9]{15}|[0-9]{17}`
   */
  nProt: string;
  /**
   * Justificativa do cancelamento
   * xsd:TJust, tamanho 15..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xJust: string;
  /**
   * Chave de Acesso NF-e vinculada
   * xsd:TChNFe, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFeRef: string;
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
 * xsd: tipo anônimo de TEvento.infEvento.infPAA.PAASignature
 */
export type TEvento_infEvento_infPAA_PAASignature = {
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
 * xsd: tipo anônimo de TEvento.infEvento.infPAA
 */
export type TEvento_infEvento_infPAA = {
  /**
   * CNPJ do Provedor de Assinatura e Autorização
   * xsd:TCnpj, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJPAA: string;
  /** Assinatura RSA do Emitente para DFe gerados por PAA */
  PAASignature: TEvento_infEvento_infPAA_PAASignature;
};

/**
 * Tipo Código de orgão (UF da tabela do IBGE + 90 RFB)
 * xsd:TCOrgaoIBGE
 */
export type TCOrgaoIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53" | "90" | "91" | "92";

/**
 * Tipo Ambiente
 * xsd:TAmb
 */
export type TAmb = "1" | "2";

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
   * xsd:TChNFe, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
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
  /** Schema XML de validação do evento do cancelamento por substituição 110112 */
  detEvento: TEvento_infEvento_detEvento;
  /** Grupo de Informação do Provedor de Assinatura e Autorização */
  infPAA?: TEvento_infEvento_infPAA;
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
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

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
 * Tipo Evento
 * xsd: TEvento
 */
export type TEvento = {
  /** @attribute xsd:TVerEvento, pattern `1\.00` */
  versao: string;
  infEvento: TEvento_infEvento;
  Signature: SignatureType;
};

/**
 * Tipo Lote de Envio
 * xsd: TEnvEvento
 */
export type TEnvEvento = {
  /** @attribute xsd:TVerEnvEvento, pattern `1\.00` */
  versao: string;
  /** pattern `[0-9]{1,15}` */
  idLote: string;
  /** ocorre 1..20 */
  evento: TEvento[];
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
   * xsd:TChNFe, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
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
   * Código do órgão de autor do Evento. Utilizar a Tabela do IBGE extendida, utilizar 90 para identificar o Ambiente Nacional
   * xsd:TCOrgaoIBGE
   */
  cOrgaoAutor?: TCOrgaoIBGE;
  /**
   * email do destinatário
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  emailDest?: string;
  /** Data e Hora de registro do evento formato UTC AAAA-MM-DDTHH:MM:SSTZD */
  dhRegEvento: string;
  /**
   * Número do protocolo de registro do evento
   * xsd:TProt, pattern `[0-9]{15}|[0-9]{17}`
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
   * xsd:TCpf, pattern `[0-9]{11}`
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
  /** @attribute xsd:TVerEvento, pattern `1\.00` */
  versao: string;
  infEvento: TRetEvento_infEvento;
  Signature?: SignatureType;
};

/**
 * Tipo Retorno de Lote de Envio
 * xsd: TRetEnvEvento
 */
export type TRetEnvEvento = {
  /** @attribute xsd:TVerEnvEvento, pattern `1\.00` */
  versao: string;
  /** pattern `[0-9]{1,15}` */
  idLote: string;
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
   * Código do òrgao que registrou o Evento
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
  /** ocorre 0..20 */
  retEvento?: TRetEvento[];
};

/**
 * Tipo procEvento
 * xsd: TProcEvento
 */
export type TProcEvento = {
  /** @attribute xsd:TVerEvento, pattern `1\.00` */
  versao: string;
  evento: TEvento;
  retEvento: TRetEvento;
};


// ---------- descritores de tipo simples ----------
const st_TVerEnvEvento: SimpleType = { b: "string", p: [["1\\.00"]], nm: "TVerEnvEvento" };
const st$0: SimpleType = { b: "string", p: [["[0-9]{1,15}"]] };
const st_TVerEvento: SimpleType = { b: "string", p: [["1\\.00"]], nm: "TVerEvento" };
const st$1: SimpleType = { b: "ID", p: [["ID[0-9]{12}[0-9A-Z]{12}[0-9]{28}"]] };
const st_TCOrgaoIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53","90","91","92"], nm: "TCOrgaoIBGE" };
const st_TAmb: SimpleType = { b: "string", e: ["1","2"], nm: "TAmb" };
const st_TCnpjOpc: SimpleType = { b: "string", p: [["[0-9]{0}|[0-9A-Z]{12}[0-9]{2}"]], mx: 14, nm: "TCnpjOpc" };
const st_TCpf: SimpleType = { b: "string", p: [["[0-9]{11}"]], nm: "TCpf" };
const st_TChNFe: SimpleType = { b: "string", p: [["[0-9]{6}[0-9A-Z]{12}[0-9]{26}"]], nm: "TChNFe" };
const st_TDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([\\-,\\+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TDateTimeUTC" };
const st$2: SimpleType = { b: "string", p: [["[0-9]{6}"]] };
const st$3: SimpleType = { b: "string", p: [["[1-9][0-9]{0,1}"]] };
const st$4: SimpleType = { b: "string" };
const st$5: SimpleType = { b: "string", e: ["1.00"] };
const st$6: SimpleType = { b: "string", e: ["Cancelamento por substituicao"] };
const st_TCodUfIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53"], nm: "TCodUfIBGE" };
const st$7: SimpleType = { b: "string", e: ["1"] };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st_TProt: SimpleType = { b: "string", p: [["[0-9]{15}|[0-9]{17}"]], nm: "TProt" };
const st_TJust: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 15, mx: 255, nm: "TJust" };
const st_TCnpj: SimpleType = { b: "string", p: [["[0-9A-Z]{12}[0-9]{2}"]], nm: "TCnpj" };
const st$8: SimpleType = { b: "base64Binary" };
const st$9: SimpleType = { b: "ID" };
const st$10: SimpleType = { b: "anyURI" };
const st$11: SimpleType = { b: "anyURI", mn: 2 };
const st_TTransformURI: SimpleType = { b: "anyURI", e: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature","http://www.w3.org/TR/2001/REC-xml-c14n-20010315"], nm: "TTransformURI" };
const st_DigestValueType: SimpleType = { b: "base64Binary", nm: "DigestValueType" };
const st_TStat: SimpleType = { b: "string", p: [["[0-9]{3,4}"]], mx: 4, nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st$12: SimpleType = { b: "ID", p: [["ID[0-9]{15}"]] };
const st$13: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 5, mx: 60, nm: "TString" };
const st$14: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 60, nm: "TString" };
const st$15: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d[\\-,\\+](0[0-9]|10|11|12):00"]] };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const TEvento_infEvento_detEvento: ComplexType<TEvento_infEvento_detEvento> = { id: "TEvento.infEvento.detEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st$5, r: 1 }], c: { g: "s", i: [{ e: "descEvento", t: st$6 }, { e: "cOrgaoAutor", t: st_TCodUfIBGE }, { e: "tpAutor", t: st$7 }, { e: "verAplic", t: st_TVerAplic }, { e: "nProt", t: st_TProt }, { e: "xJust", t: st_TJust }, { e: "chNFeRef", t: st_TChNFe }] } };
export const TRSAKeyValueType: ComplexType<TRSAKeyValueType> = { id: "TRSAKeyValueType", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "Modulus", t: st$8 }, { e: "Exponent", t: st$8 }] } };
export const TEvento_infEvento_infPAA_PAASignature: ComplexType<TEvento_infEvento_infPAA_PAASignature> = { id: "TEvento.infEvento.infPAA.PAASignature", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "SignatureValue", t: st$8 }, { e: "RSAKeyValue", t: TRSAKeyValueType }] } };
export const TEvento_infEvento_infPAA: ComplexType<TEvento_infEvento_infPAA> = { id: "TEvento.infEvento.infPAA", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "CNPJPAA", t: st_TCnpj }, { e: "PAASignature", t: TEvento_infEvento_infPAA_PAASignature }] } };
export const TEvento_infEvento: ComplexType<TEvento_infEvento> = { id: "TEvento.infEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "Id", t: st$1, r: 1 }], c: { g: "s", i: [{ e: "cOrgao", t: st_TCOrgaoIBGE }, { e: "tpAmb", t: st_TAmb }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpjOpc }, { e: "CPF", t: st_TCpf }] }, { e: "chNFe", t: st_TChNFe }, { e: "dhEvento", t: st_TDateTimeUTC }, { e: "tpEvento", t: st$2 }, { e: "nSeqEvento", t: st$3 }, { e: "verEvento", t: st$4 }, { e: "detEvento", t: TEvento_infEvento_detEvento }, { e: "infPAA", t: TEvento_infEvento_infPAA, n: 0 }] } };
export const SignedInfoType_CanonicalizationMethod: ComplexType<SignedInfoType_CanonicalizationMethod> = { id: "SignedInfoType.CanonicalizationMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$10, r: 1, f: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" }] };
export const SignedInfoType_SignatureMethod: ComplexType<SignedInfoType_SignatureMethod> = { id: "SignedInfoType.SignatureMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$10, r: 1, f: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" }] };
export const TransformType: ComplexType<TransformType> = { id: "TransformType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st_TTransformURI, r: 1 }], c: { g: "s", i: [{ e: "XPath", t: st$4 }], n: 0, x: -1 } };
export const TransformsType: ComplexType<TransformsType> = { id: "TransformsType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "Transform", t: TransformType, n: 2, x: 2 }] } };
export const ReferenceType_DigestMethod: ComplexType<ReferenceType_DigestMethod> = { id: "ReferenceType.DigestMethod", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Algorithm", t: st$10, r: 1, f: "http://www.w3.org/2000/09/xmldsig#sha1" }] };
export const ReferenceType: ComplexType<ReferenceType> = { id: "ReferenceType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$9 }, { a: "URI", t: st$11, r: 1 }, { a: "Type", t: st$10 }], c: { g: "s", i: [{ e: "Transforms", t: TransformsType, u: ["Algorithm"] }, { e: "DigestMethod", t: ReferenceType_DigestMethod }, { e: "DigestValue", t: st_DigestValueType }] } };
export const SignedInfoType: ComplexType<SignedInfoType> = { id: "SignedInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$9 }], c: { g: "s", i: [{ e: "CanonicalizationMethod", t: SignedInfoType_CanonicalizationMethod }, { e: "SignatureMethod", t: SignedInfoType_SignatureMethod }, { e: "Reference", t: ReferenceType }] } };
export const SignatureValueType: ComplexType<SignatureValueType> = { id: "SignatureValueType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$9 }], tx: st$8 };
export const X509DataType: ComplexType<X509DataType> = { id: "X509DataType", ns: "http://www.w3.org/2000/09/xmldsig#", c: { g: "s", i: [{ e: "X509Certificate", t: st$8 }] } };
export const KeyInfoType: ComplexType<KeyInfoType> = { id: "KeyInfoType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$9 }], c: { g: "s", i: [{ e: "X509Data", t: X509DataType }] } };
export const SignatureType: ComplexType<SignatureType> = { id: "SignatureType", ns: "http://www.w3.org/2000/09/xmldsig#", a: [{ a: "Id", t: st$9 }], c: { g: "s", i: [{ e: "SignedInfo", t: SignedInfoType }, { e: "SignatureValue", t: SignatureValueType }, { e: "KeyInfo", t: KeyInfoType }] } };
export const TEvento: ComplexType<TEvento> = { id: "TEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerEvento, r: 1 }], c: { g: "s", i: [{ e: "infEvento", t: TEvento_infEvento }, { e: "Signature", t: SignatureType, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TEnvEvento: ComplexType<TEnvEvento> = { id: "TEnvEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerEnvEvento, r: 1 }], c: { g: "s", i: [{ e: "idLote", t: st$0 }, { e: "evento", t: TEvento, x: 20 }] } };
export const TRetEvento_infEvento: ComplexType<TRetEvento_infEvento> = { id: "TRetEvento.infEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "Id", t: st$12 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cOrgao", t: st_TCOrgaoIBGE }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "chNFe", t: st_TChNFe, n: 0 }, { e: "tpEvento", t: st$2, n: 0 }, { e: "xEvento", t: st$13, n: 0 }, { e: "nSeqEvento", t: st$3, n: 0 }, { e: "cOrgaoAutor", t: st_TCOrgaoIBGE, n: 0 }, { g: "c", i: [{ e: "CNPJDest", t: st_TCnpjOpc }, { e: "CPFDest", t: st_TCpf }], n: 0 }, { e: "emailDest", t: st$14, n: 0 }, { e: "dhRegEvento", t: st$15 }, { e: "nProt", t: st_TProt, n: 0 }] } };
export const TRetEvento: ComplexType<TRetEvento> = { id: "TRetEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerEvento, r: 1 }], c: { g: "s", i: [{ e: "infEvento", t: TRetEvento_infEvento }, { e: "Signature", t: SignatureType, n: 0, ns: "http://www.w3.org/2000/09/xmldsig#" }] } };
export const TRetEnvEvento: ComplexType<TRetEnvEvento> = { id: "TRetEnvEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerEnvEvento, r: 1 }], c: { g: "s", i: [{ e: "idLote", t: st$0 }, { e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cOrgao", t: st_TCOrgaoIBGE }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "retEvento", t: TRetEvento, n: 0, x: 20 }] } };
export const TProcEvento: ComplexType<TProcEvento> = { id: "TProcEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerEvento, r: 1 }], c: { g: "s", i: [{ e: "evento", t: TEvento }, { e: "retEvento", t: TRetEvento }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `envEvento` (tipo TEnvEvento). */
export const envEventoElement: ElementoRaiz<TEnvEvento> = { nome: "envEvento", ns: "http://www.portalfiscal.inf.br/nfe", tipo: TEnvEvento };
/** Elemento raiz `retEnvEvento` (tipo TRetEnvEvento). */
export const retEnvEventoElement: ElementoRaiz<TRetEnvEvento> = { nome: "retEnvEvento", ns: "http://www.portalfiscal.inf.br/nfe", tipo: TRetEnvEvento };
/** Elemento raiz `procEventoNFe` (tipo TProcEvento). */
export const procEventoNFeElement: ElementoRaiz<TProcEvento> = { nome: "procEventoNFe", ns: "http://www.portalfiscal.inf.br/nfe", tipo: TProcEvento };
