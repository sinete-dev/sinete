// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_010d_v1.03. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * Consulta cadastro de contribuintes (CCC): ConsCad e retConsCad.
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - nfe/PL_010d_v1.03 (PL_010d_v1.03.zip)
 */
import type { ComplexType, RootElement, SchemaModuleInfo, SimpleType } from "../../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: SchemaModuleInfo = {
  "subpath": "nfe/consulta-cadastro/PL_010d",
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
 * Tipo Sigla da UF consultada
 * xsd:TUfCons
 */
export type TUfCons = "AC" | "AL" | "AM" | "AP" | "BA" | "CE" | "DF" | "ES" | "GO" | "MA" | "MG" | "MS" | "MT" | "PA" | "PB" | "PE" | "PI" | "PR" | "RJ" | "RN" | "RO" | "RR" | "RS" | "SC" | "SE" | "SP" | "TO" | "SU";

/**
 * Dados do Pedido de Consulta de cadastro de contribuintes
 * xsd: tipo anônimo de TConsCad.infCons
 */
export type TConsCad_infCons = {
  /**
   * Serviço Solicitado
   * xsd:TServ, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xServ: "CONS-CAD";
  /**
   * sigla da UF consultada, utilizar SU para SUFRAMA
   * xsd:TUfCons
   */
  UF: TUfCons;
} & (
  ({
  /**
   * Inscrição Estadual do contribuinte
   * xsd:TIe, pattern `[0-9]{2,14}|ISENTO`
   */
  IE: string;
  CNPJ?: never; CPF?: never;
})
  | ({
  /**
   * CNPJ do contribuinte
   * xsd:TCnpjVar, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ: string;
  IE?: never; CPF?: never;
})
  | ({
  /**
   * CPF do contribuinte
   * xsd:TCpfVar, pattern `[0-9]{3,11}`
   */
  CPF: string;
  IE?: never; CNPJ?: never;
})
);

/**
 * Tipo Pedido de Consulta de cadastro de contribuintes
 * xsd: TConsCad
 */
export type TConsCad = {
  /** @attribute xsd:TVerConsCad, pattern `2\.00` */
  versao: string;
  /** Dados do Pedido de Consulta de cadastro de contribuintes */
  infCons: TConsCad_infCons;
};

/**
 * Tipo Dados do Endereço
 * xsd: TEndereco
 */
export type TEndereco = {
  /**
   * Logradouro
   * xsd:TString, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xLgr?: string;
  /**
   * Número
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  nro?: string;
  /**
   * Complemento
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xCpl?: string;
  /**
   * Bairro
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xBairro?: string;
  /**
   * Código do município (utilizar a tabela do IBGE), informar 9999999 para operações com o exterior.
   * xsd:TCodMunIBGE, pattern `[0-9]{7}`
   */
  cMun?: string;
  /**
   * Nome do município
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMun?: string;
  /**
   * CEP
   * pattern `[0-9]{7,8}`
   */
  CEP?: string;
};

/**
 * Tipo Sigla da UF
 * xsd:TUf
 */
export type TUf = "AC" | "AL" | "AM" | "AP" | "BA" | "CE" | "DF" | "ES" | "GO" | "MA" | "MG" | "MS" | "MT" | "PA" | "PB" | "PE" | "PI" | "PR" | "RJ" | "RN" | "RO" | "RR" | "RS" | "SC" | "SE" | "SP" | "TO" | "EX";

/**
 * Informações cadastrais do contribuinte consultado
 * xsd: tipo anônimo de TRetConsCad.infCons.infCad
 */
export type TRetConsCad_infCons_infCad = {
  /**
   * Número da Inscrição Estadual do contribuinte
   * xsd:TIe, pattern `[0-9]{2,14}|ISENTO`
   */
  IE: string;
  /**
   * Sigla da UF de localização do contribuinte. Em algumas situações, a UF de localização pode ser diferente da UF consultada. Ex. IE de Substituto Tributário.
   * xsd:TUf
   */
  UF: TUf;
  /**
   * Situação cadastral do contribuinte:
   * 0 - não habilitado
   * 1 - habilitado
   */
  cSit: "0" | "1";
  /**
   * Indicador de contribuinte credenciado a emitir NF-e.
   * 0 - Não credenciado para emissão da NF-e;
   * 1 - Credenciado;
   * 2 - Credenciado com obrigatoriedade para todas operações;
   * 3 - Credenciado com obrigatoriedade parcial;
   * 4 – a SEFAZ não fornece a informação.
   * Este indicador significa apenas que o contribuinte é credenciado para emitir NF-e na SEFAZ consultada.
   */
  indCredNFe: "0" | "1" | "2" | "3" | "4";
  /**
   * Indicador de contribuinte credenciado a emitir CT-e.
   * 0 - Não credenciado para emissão da CT-e;
   * 1 - Credenciado;
   * 2 - Credenciado com obrigatoriedade para todas operações;
   * 3 - Credenciado com obrigatoriedade parcial;
   * 4 – a SEFAZ não fornece a informação.
   * Este indicador significa apenas que o contribuinte é credenciado para emitir CT-e na SEFAZ consultada.
   */
  indCredCTe: "0" | "1" | "2" | "3" | "4";
  /**
   * Razão Social ou nome do contribuinte
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xNome: string;
  /**
   * Razão Social ou nome do contribuinte
   * xsd:TString, tamanho 1..60, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xFant?: string;
  /**
   * Regime de Apuração do ICMS
   * tamanho 1..60
   */
  xRegApur?: string;
  /**
   * CNAE Fiscal do contribuinte
   * pattern `[0-9]{6,7}`
   */
  CNAE?: string;
  /** Data de início de atividades do contribuinte */
  dIniAtiv?: string;
  /** Data da última modificação da situação cadastral do contribuinte. */
  dUltSit?: string;
  /** Data de ocorrência da baixa do contribuinte. */
  dBaixa?: string;
  /**
   * Inscrição Estadual Única
   * xsd:TIe, pattern `[0-9]{2,14}|ISENTO`
   */
  IEUnica?: string;
  /**
   * Inscrição Estadual atual
   * xsd:TIe, pattern `[0-9]{2,14}|ISENTO`
   */
  IEAtual?: string;
  /** Endereço */
  ender?: TEndereco;
} & (
  ({
  /**
   * Número do CNPJ  do contribuinte
   * xsd:TCnpjVar, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * Número do CPF do contribuinte
   * xsd:TCpfVar, pattern `[0-9]{3,11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

/**
 * Tipo Código da UF da tabela do IBGE
 * xsd:TCodUfIBGE
 */
export type TCodUfIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53";

/**
 * Dados do Resultado doDados do Pedido de Consulta de cadastro de contribuintes
 * xsd: tipo anônimo de TRetConsCad.infCons
 */
export type TRetConsCad_infCons = {
  /**
   * Versão do Aplicativo que processou o pedido de consulta de cadastro
   * xsd:TVerAplic, tamanho 1..20, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  verAplic: string;
  /**
   * Código do status da mensagem enviada.
   * xsd:TStat, pattern `[0-9]{3}`
   */
  cStat: string;
  /**
   * Descrição literal do status do serviço solicitado.
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xMotivo: string;
  /**
   * sigla da UF consultada, utilizar SU para SUFRAMA
   * xsd:TUfCons
   */
  UF: TUfCons;
  /** Data da Consulta */
  dhCons: string;
  /**
   * código da UF de atendimento
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * Informações cadastrais do contribuinte consultado
   * ocorre 0..n
   */
  infCad?: TRetConsCad_infCons_infCad[];
} & (
  ({
  /**
   * Inscrição Estadual do contribuinte
   * xsd:TIe, pattern `[0-9]{2,14}|ISENTO`
   */
  IE: string;
  CNPJ?: never; CPF?: never;
})
  | ({
  /**
   * CNPJ do contribuinte
   * xsd:TCnpjVar, pattern `[0-9A-Z]{12}[0-9]{2}`
   */
  CNPJ: string;
  IE?: never; CPF?: never;
})
  | ({
  /**
   * CPF do contribuinte
   * xsd:TCpfVar, pattern `[0-9]{3,11}`
   */
  CPF: string;
  IE?: never; CNPJ?: never;
})
);

/**
 * Tipo Retorno Pedido de Consulta de cadastro de contribuintes
 * xsd: TRetConsCad
 */
export type TRetConsCad = {
  /** @attribute xsd:TVerConsCad, pattern `2\.00` */
  versao: string;
  /** Dados do Resultado doDados do Pedido de Consulta de cadastro de contribuintes */
  infCons: TRetConsCad_infCons;
};


// ---------- descritores de tipo simples ----------
const st_TVerConsCad: SimpleType = { b: "token", p: [["2\\.00"]], nm: "TVerConsCad" };
const st$0: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], e: ["CONS-CAD"], nm: "TServ" };
const st_TUfCons: SimpleType = { b: "token", e: ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO","SU"], nm: "TUfCons" };
const st_TIe: SimpleType = { b: "string", p: [["[0-9]{2,14}|ISENTO"]], nm: "TIe" };
const st_TCnpjVar: SimpleType = { b: "string", p: [["[0-9A-Z]{12}[0-9]{2}"]], nm: "TCnpjVar" };
const st_TCpfVar: SimpleType = { b: "string", p: [["[0-9]{3,11}"]], nm: "TCpfVar" };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st_TStat: SimpleType = { b: "string", p: [["[0-9]{3}"]], nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st$1: SimpleType = { b: "dateTime" };
const st_TCodUfIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53"], nm: "TCodUfIBGE" };
const st_TUf: SimpleType = { b: "string", e: ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO","EX"], nm: "TUf" };
const st$2: SimpleType = { b: "token", e: ["0","1"] };
const st$3: SimpleType = { b: "string", e: ["0","1","2","3","4"] };
const st$4: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 60, nm: "TString" };
const st$5: SimpleType = { b: "token", mn: 1, mx: 60 };
const st$6: SimpleType = { b: "token", p: [["[0-9]{6,7}"]] };
const st$7: SimpleType = { b: "date" };
const st$8: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TString" };
const st_TCodMunIBGE: SimpleType = { b: "string", p: [["[0-9]{7}"]], nm: "TCodMunIBGE" };
const st$9: SimpleType = { b: "token", p: [["[0-9]{7,8}"]] };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const TConsCad_infCons: ComplexType<TConsCad_infCons> = { id: "TConsCad.infCons", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "xServ", t: st$0 }, { e: "UF", t: st_TUfCons }, { g: "c", i: [{ e: "IE", t: st_TIe }, { e: "CNPJ", t: st_TCnpjVar }, { e: "CPF", t: st_TCpfVar }] }] } };
export const TConsCad: ComplexType<TConsCad> = { id: "TConsCad", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerConsCad, r: 1 }], c: { g: "s", i: [{ e: "infCons", t: TConsCad_infCons }] } };
export const TEndereco: ComplexType<TEndereco> = { id: "TEndereco", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "xLgr", t: st$8, n: 0 }, { e: "nro", t: st$4, n: 0 }, { e: "xCpl", t: st$4, n: 0 }, { e: "xBairro", t: st$4, n: 0 }, { e: "cMun", t: st_TCodMunIBGE, n: 0 }, { e: "xMun", t: st$4, n: 0 }, { e: "CEP", t: st$9, n: 0 }] } };
export const TRetConsCad_infCons_infCad: ComplexType<TRetConsCad_infCons_infCad> = { id: "TRetConsCad.infCons.infCad", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "IE", t: st_TIe }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpjVar }, { e: "CPF", t: st_TCpfVar }] }, { e: "UF", t: st_TUf }, { e: "cSit", t: st$2 }, { e: "indCredNFe", t: st$3 }, { e: "indCredCTe", t: st$3 }, { e: "xNome", t: st$4 }, { e: "xFant", t: st$4, n: 0 }, { e: "xRegApur", t: st$5, n: 0 }, { e: "CNAE", t: st$6, n: 0 }, { e: "dIniAtiv", t: st$7, n: 0 }, { e: "dUltSit", t: st$7, n: 0 }, { e: "dBaixa", t: st$7, n: 0 }, { e: "IEUnica", t: st_TIe, n: 0 }, { e: "IEAtual", t: st_TIe, n: 0 }, { e: "ender", t: TEndereco, n: 0 }] } };
export const TRetConsCad_infCons: ComplexType<TRetConsCad_infCons> = { id: "TRetConsCad.infCons", ns: "http://www.portalfiscal.inf.br/nfe", c: { g: "s", i: [{ e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "UF", t: st_TUfCons }, { g: "c", i: [{ e: "IE", t: st_TIe }, { e: "CNPJ", t: st_TCnpjVar }, { e: "CPF", t: st_TCpfVar }] }, { e: "dhCons", t: st$1 }, { e: "cUF", t: st_TCodUfIBGE }, { e: "infCad", t: TRetConsCad_infCons_infCad, n: 0, x: -1 }] } };
export const TRetConsCad: ComplexType<TRetConsCad> = { id: "TRetConsCad", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerConsCad, r: 1 }], c: { g: "s", i: [{ e: "infCons", t: TRetConsCad_infCons }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `ConsCad` (tipo TConsCad). */
export const ConsCadElement: RootElement<TConsCad> = { name: "ConsCad", ns: "http://www.portalfiscal.inf.br/nfe", type: TConsCad };
/** Elemento raiz `retConsCad` (tipo TRetConsCad). */
export const retConsCadElement: RootElement<TRetConsCad> = { name: "retConsCad", ns: "http://www.portalfiscal.inf.br/nfe", type: TRetConsCad };
