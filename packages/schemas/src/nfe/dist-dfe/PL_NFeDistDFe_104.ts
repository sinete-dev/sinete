// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_NFeDistDFe_104. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * Distribuição de DF-e de interesse: distDFeInt e retDistDFeInt, mais resNFe e resEvento, que chegam compactados em docZip (o docZip é base64 de gzip e fica como string). O pacote importa o xmldsig-core-schema_v1.01.xsd sem redistribuí-lo; usa-se o do PL_010d_v1.03.
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - nfe/PL_NFeDistDFe_104 (PL_NFeDistDFe_104.zip)
 * - nfe/PL_010d_v1.03 (PL_010d_v1.03.zip)
 */
import type { ComplexType, RootElement, SchemaModuleInfo, SimpleType } from "../../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: SchemaModuleInfo = {
  "subpath": "nfe/dist-dfe/PL_NFeDistDFe_104",
  "documento": "nfe",
  "pl": "PL_NFeDistDFe_104",
  "fontes": [
    {
      "pacote": "nfe/PL_NFeDistDFe_104",
      "arquivo": "PL_NFeDistDFe_104.zip",
      "sha256": "9bd6d478dd04770016783a914111f3e2cc794c6a2f2b62ac7243fb101c138740",
      "url": "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=IzuP2y0G6hk="
    },
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
 * Grupo para distribuir DF-e de interesse
 * xsd: tipo anônimo de distDFeInt.distNSU
 */
export type distDFeInt_distNSU = {
  /**
   * Último NSU recebido pelo ator. Caso seja informado com zero, ou com um NSU muito antigo, a consulta retornará unicamente as informações resumidas e documentos fiscais eletrônicos que tenham sido recepcionados pelo Ambiente Nacional nos últimos 3 meses.
   * xsd:TNSU, pattern `[0-9]{15}`
   */
  ultNSU: string;
};

/**
 * Grupo para consultar um DF-e a partir de um NSU específico
 * xsd: tipo anônimo de distDFeInt.consNSU
 */
export type distDFeInt_consNSU = {
  /**
   * Número Sequencial Único. Geralmente esta consulta será utilizada quando identificado pelo interessado um NSU faltante. O Web Service retornará o documento ou informará que o NSU não existe no Ambiente Nacional. Assim, esta consulta fechará a lacuna do NSU identificado como faltante.
   * xsd:TNSU, pattern `[0-9]{15}`
   */
  NSU: string;
};

/**
 * Grupo para consultar uma NF-e a partir da chave de acesso
 * xsd: tipo anônimo de distDFeInt.consChNFe
 */
export type distDFeInt_consChNFe = {
  /**
   * Chave de acesso da NF-e a ser consultada
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFe: string;
};

/**
 * Tipo Versão dos leiautes do Web Service NFeDistribuicaoDFe
 * xsd:TVerDistDFe
 */
export type TVerDistDFe = "1.01";

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
 * Schema de pedido de distribuição de DF-e de interesse
 * xsd: tipo anônimo de distDFeInt
 */
export type distDFeInt = {
  /** @attribute xsd:TVerDistDFe */
  versao: TVerDistDFe;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Código da UF do Autor
   * xsd:TCodUfIBGE
   */
  cUFAutor?: TCodUfIBGE;
} & (
  ({
  /**
   * CNPJ do interessado no DF-e
   * xsd:TCnpj, tamanho 0..14, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * CPF do interessado no DF-e
   * xsd:TCpf, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
) & (
  ({
  /** Grupo para distribuir DF-e de interesse */
  distNSU: distDFeInt_distNSU;
  consNSU?: never; consChNFe?: never;
})
  | ({
  /** Grupo para consultar um DF-e a partir de um NSU específico */
  consNSU: distDFeInt_consNSU;
  distNSU?: never; consChNFe?: never;
})
  | ({
  /** Grupo para consultar uma NF-e a partir da chave de acesso */
  consChNFe: distDFeInt_consChNFe;
  distNSU?: never; consNSU?: never;
})
);

/**
 * Informação resumida ou documento fiscal eletrônico de interesse da pessoa ou empresa. O conteúdo desta tag estará compactado no padrão gZip. O tipo do campo é base64Binary.
 * xsd: tipo anônimo de retDistDFeInt.loteDistDFeInt.docZip
 */
export type retDistDFeInt_loteDistDFeInt_docZip = {
  /**
   * NSU do documento fiscal
   * @attribute xsd:TNSU, pattern `[0-9]{15}`
   */
  NSU?: string;
  /**
   * Identificação do Schema XML que será utilizado para validar o XML existente no conteúdo da tag docZip. Vai identificar o tipo do documento e sua versão. Exemplos: resNFe_v1.00.xsd, procNFe_v3.10.xsd, resEvento_1.00.xsd, procEventoNFe_v1.00.xsd
   * @attribute
   */
  schema: string;
  $text: string;
};

/**
 * Conjunto de informações resumidas e documentos fiscais eletrônicos de interesse da pessoa ou empresa.
 * xsd: tipo anônimo de retDistDFeInt.loteDistDFeInt
 */
export type retDistDFeInt_loteDistDFeInt = {
  /**
   * Informação resumida ou documento fiscal eletrônico de interesse da pessoa ou empresa. O conteúdo desta tag estará compactado no padrão gZip. O tipo do campo é base64Binary.
   * ocorre 1..1
   */
  docZip: retDistDFeInt_loteDistDFeInt_docZip[];
};

/**
 * Schema do resultado do pedido de distribuição de DF-e de interesse
 * xsd: tipo anônimo de retDistDFeInt
 */
export type retDistDFeInt = {
  /** @attribute xsd:TVerDistDFe */
  versao: TVerDistDFe;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Versão do Web Service NFeDistribuicaoDFe
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Código do status de processamento da requisição
   * xsd:TStat, tamanho 0..3, pattern `[0-9]{3}`
   */
  cStat: string;
  /**
   * Descrição literal do status do processamento da requisição
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
  /**
   * Data e Hora de processamento da requisição no formato AAAA-MM-DDTHH:MM:SSTZD
   * xsd:TDateTimeUTC
   */
  dhResp: string;
  /**
   * Último NSU pesquisado no Ambiente Nacional. Se for o caso, o solicitante pode continuar a consulta a partir deste NSU para obter novos resultados.
   * xsd:TNSU, pattern `[0-9]{15}`
   */
  ultNSU: string;
  /**
   * Maior NSU existente no Ambiente Nacional para o CNPJ/CPF informado
   * xsd:TNSU, pattern `[0-9]{15}`
   */
  maxNSU: string;
  /** Conjunto de informações resumidas e documentos fiscais eletrônicos de interesse da pessoa ou empresa. */
  loteDistDFeInt?: retDistDFeInt_loteDistDFeInt;
};

/**
 * Tipo Versão do leiate resNFe
 * xsd:TVerResNFe
 */
export type TVerResNFe = "1.01";

/**
 * Schema da estrutura XML gerada pelo Ambiente Nacional com o conjunto de informações resumidas de uma NF-e
 * xsd: tipo anônimo de resNFe
 */
export type resNFe = {
  /** @attribute xsd:TVerResNFe */
  versao: TVerResNFe;
  /**
   * Chave de acesso da NF-e
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[0-9A-Z]{12}[0-9]{26}`
   */
  chNFe: string;
  /**
   * Razão Social ou Nome do emitente
   * xsd:TString, tamanho 2..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome: string;
  /**
   * Inscrição Estadual do Emitente
   * xsd:TIe, tamanho 0..14, pattern `[0-9]{2,14}|ISENTO`
   */
  IE: string;
  /**
   * Data e Hora de emissão do Documento Fiscal (AAAA-MM-DDThh:mm:ssTZD) ex.: 2012-09-01T13:00:00-03:00
   * xsd:TDateTimeUTC
   */
  dhEmi: string;
  /** Tipo do Documento Fiscal (0 - entrada; 1 - saída) */
  tpNF: "0" | "1";
  /**
   * Valor Total da NF-e
   * xsd:TDec_1302, pattern `0|0\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\.[0-9]{2})?`
   */
  vNF: string;
  /**
   * Digest Value da NF-e processada. Utilizado para conferir a integridade da NF-e original
   * xsd:DigestValueType
   */
  digVal?: string;
  /**
   * Data e hora de autorização da NF-e, no formato AAAA-MM-DDTHH:MM:SSTZD
   * xsd:TDateTimeUTC
   */
  dhRecbto: string;
  /**
   * Número do Protocolo de Status da NF-e. 1 posição (1 – Secretaria de Fazenda Estadual 2 – Receita Federal); 2 - códiga da UF - 2 posições ano; 10 seqüencial no ano
   * xsd:TProt, tamanho 0..15, pattern `[0-9]{15}`
   */
  nProt: string;
  /**
   * Situação da NF-e
   * 1-Uso autorizado no momento da consulta;
   * 2-Uso denegado;
   */
  cSitNFe: "1" | "2" | "3";
} & (
  ({
  /**
   * CNPJ do Emitente
   * xsd:TCnpj, tamanho 0..14, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * CPF do Emitente
   * xsd:TCpf, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

/**
 * Tipo Versão do leiate resNFe
 * xsd:TVerResEvento
 */
export type TVerResEvento = "1.01";

/**
 * Tipo Código de orgão (UF da tabela do IBGE + 90 RFB)
 * xsd:TCOrgaoIBGE
 */
export type TCOrgaoIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53" | "90" | "91" | "92";

/**
 * Schema da estrutura XML gerada pelo Ambiente Nacional com o conjunto de informações resumidas de um evento de NF-e
 * xsd: tipo anônimo de resEvento
 */
export type resEvento = {
  /** @attribute xsd:TVerResEvento */
  versao: TVerResEvento;
  /**
   * Código do órgão de recepção do Evento. Utilizar a Tabela do IBGE extendida, utilizar 91 para identificar o Ambiente Nacional
   * xsd:TCOrgaoIBGE
   */
  cOrgao: TCOrgaoIBGE;
  /**
   * Chave de acesso da NF-e
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
   * Seqüencial do evento para o mesmo tipo de evento.  Para maioria dos eventos será 1, nos casos em que possa existir mais de um evento, como é o caso da carta de correção, o autor do evento deve numerar de forma seqüencial
   * pattern `[1-9][0-9]{0,1}`
   */
  nSeqEvento: string;
  /**
   * Descrição do Evento
   * xsd:TString, tamanho 5..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xEvento: string;
  /**
   * Data e hora de autorização do evento no formato AAAA-MM-DDTHH:MM:SSTZD
   * xsd:TDateTimeUTC
   */
  dhRecbto: string;
  /**
   * Número do Protocolo do evento. 1 posição (1 – Secretaria de Fazenda Estadual 2 – Receita Federal); 2 - códiga da UF - 2 posições ano; 10 seqüencial no ano
   * xsd:TProt, tamanho 0..15, pattern `[0-9]{15}`
   */
  nProt: string;
} & (
  ({
  /**
   * CNPJ do Emitente
   * xsd:TCnpj, tamanho 0..14, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * CPF do Emitente
   * xsd:TCpf, tamanho 0..11, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);


// ---------- descritores de tipo simples ----------
const st_TVerDistDFe: SimpleType = { b: "string", e: ["1.01"], nm: "TVerDistDFe" };
const st_TAmb: SimpleType = { b: "string", e: ["1","2"], nm: "TAmb" };
const st_TCodUfIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53"], nm: "TCodUfIBGE" };
const st_TCnpj: SimpleType = { b: "string", p: [["[0-9A-Z]{12}[0-9]{2}"]], mx: 14, nm: "TCnpj" };
const st_TCpf: SimpleType = { b: "string", p: [["[0-9]{11}"]], mx: 11, nm: "TCpf" };
const st_TNSU: SimpleType = { b: "token", p: [["[0-9]{15}"]], nm: "TNSU" };
const st_TChNFe: SimpleType = { b: "string", p: [["[0-9]{6}[0-9A-Z]{12}[0-9]{26}"]], mx: 44, nm: "TChNFe" };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st_TStat: SimpleType = { b: "string", p: [["[0-9]{3}"]], mx: 3, nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st_TDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([\\-,\\+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TDateTimeUTC" };
const st$0: SimpleType = { b: "string" };
const st$1: SimpleType = { b: "base64Binary" };
const st_TVerResNFe: SimpleType = { b: "string", e: ["1.01"], nm: "TVerResNFe" };
const st$2: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 2, mx: 60, nm: "TString" };
const st_TIe: SimpleType = { b: "string", p: [["[0-9]{2,14}|ISENTO"]], mx: 14, nm: "TIe" };
const st$3: SimpleType = { b: "string", e: ["0","1"] };
const st_TDec_1302: SimpleType = { b: "string", p: [["0|0\\.[0-9]{2}|[1-9]{1}[0-9]{0,12}(\\.[0-9]{2})?"]], nm: "TDec_1302" };
const st_DigestValueType: SimpleType = { b: "base64Binary", nm: "DigestValueType" };
const st_TProt: SimpleType = { b: "string", p: [["[0-9]{15}"]], mx: 15, nm: "TProt" };
const st$4: SimpleType = { b: "string", e: ["1","2","3"] };
const st_TVerResEvento: SimpleType = { b: "string", e: ["1.01"], nm: "TVerResEvento" };
const st_TCOrgaoIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53","90","91","92"], nm: "TCOrgaoIBGE" };
const st$5: SimpleType = { b: "string", p: [["[0-9]{6}"]] };
const st$6: SimpleType = { b: "string", p: [["[1-9][0-9]{0,1}"]] };
const st$7: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 5, mx: 60, nm: "TString" };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const distDFeInt_distNSU: ComplexType<distDFeInt_distNSU> = { id: "distDFeInt.distNSU", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "ultNSU", t: st_TNSU }] } };
export const distDFeInt_consNSU: ComplexType<distDFeInt_consNSU> = { id: "distDFeInt.consNSU", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "NSU", t: st_TNSU }] } };
export const distDFeInt_consChNFe: ComplexType<distDFeInt_consChNFe> = { id: "distDFeInt.consChNFe", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "chNFe", t: st_TChNFe }] } };
export const distDFeInt: ComplexType<distDFeInt> = { id: "distDFeInt", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerDistDFe, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "cUFAutor", t: st_TCodUfIBGE, n: 0 }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "CPF", t: st_TCpf }] }, { g: "c", i: [{ e: "distNSU", t: distDFeInt_distNSU }, { e: "consNSU", t: distDFeInt_consNSU }, { e: "consChNFe", t: distDFeInt_consChNFe }] }] } };
export const retDistDFeInt_loteDistDFeInt_docZip: ComplexType<retDistDFeInt_loteDistDFeInt_docZip> = { id: "retDistDFeInt.loteDistDFeInt.docZip", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "NSU", t: st_TNSU }, { a: "schema", t: st$0, r: 1 }], tx: st$1 };
export const retDistDFeInt_loteDistDFeInt: ComplexType<retDistDFeInt_loteDistDFeInt> = { id: "retDistDFeInt.loteDistDFeInt", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "docZip", t: retDistDFeInt_loteDistDFeInt_docZip }], x: 50 } };
export const retDistDFeInt: ComplexType<retDistDFeInt> = { id: "retDistDFeInt", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerDistDFe, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "dhResp", t: st_TDateTimeUTC }, { e: "ultNSU", t: st_TNSU }, { e: "maxNSU", t: st_TNSU }, { e: "loteDistDFeInt", t: retDistDFeInt_loteDistDFeInt, n: 0 }] } };
export const resNFe: ComplexType<resNFe> = { id: "resNFe", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerResNFe, r: 1 }], c: { g: "s", i: [{ e: "chNFe", t: st_TChNFe }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "CPF", t: st_TCpf }] }, { e: "xNome", t: st$2 }, { e: "IE", t: st_TIe }, { e: "dhEmi", t: st_TDateTimeUTC }, { e: "tpNF", t: st$3 }, { e: "vNF", t: st_TDec_1302 }, { e: "digVal", t: st_DigestValueType, n: 0 }, { e: "dhRecbto", t: st_TDateTimeUTC }, { e: "nProt", t: st_TProt }, { e: "cSitNFe", t: st$4 }] } };
export const resEvento: ComplexType<resEvento> = { id: "resEvento", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerResEvento, r: 1 }], c: { g: "s", i: [{ e: "cOrgao", t: st_TCOrgaoIBGE }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "CPF", t: st_TCpf }] }, { e: "chNFe", t: st_TChNFe }, { e: "dhEvento", t: st_TDateTimeUTC }, { e: "tpEvento", t: st$5 }, { e: "nSeqEvento", t: st$6 }, { e: "xEvento", t: st$7 }, { e: "dhRecbto", t: st_TDateTimeUTC }, { e: "nProt", t: st_TProt }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `distDFeInt` (tipo distDFeInt). */
export const distDFeIntElement: RootElement<distDFeInt> = { name: "distDFeInt", ns: "http://www.portalfiscal.inf.br/nfe", type: distDFeInt };
/** Elemento raiz `retDistDFeInt` (tipo retDistDFeInt). */
export const retDistDFeIntElement: RootElement<retDistDFeInt> = { name: "retDistDFeInt", ns: "http://www.portalfiscal.inf.br/nfe", type: retDistDFeInt };
/** Elemento raiz `resNFe` (tipo resNFe). */
export const resNFeElement: RootElement<resNFe> = { name: "resNFe", ns: "http://www.portalfiscal.inf.br/nfe", type: resNFe };
/** Elemento raiz `resEvento` (tipo resEvento). */
export const resEventoElement: RootElement<resEvento> = { name: "resEvento", ns: "http://www.portalfiscal.inf.br/nfe", type: resEvento };
