// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_MDFe_300b_NT012025_1.05. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * Consultas do MDF-e 3.00b: status do serviço (consStatServMDFe), situação (consSitMDFe, cujo retorno traz protMDFe e procEventoMDFe como xs:any bruto em $any) e MDF-e não encerrados (consMDFeNaoEnc).
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - mdfe/PL_MDFe_300b_NT012025_1.05 (PL_MDFe_300b_NT012025_1.04.zip)
 */
import type { ComplexType, RootElement, SchemaModuleInfo, SimpleType } from "../../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: SchemaModuleInfo = {
  "subpath": "mdfe/servicos/3.00b",
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
 * Tipo Ambiente
 * xsd:TAmb
 */
export type TAmb = "1" | "2";

/**
 * Tipo Pedido de Consulta do Status do Serviço MDFe
 * xsd: TConsStatServ
 */
export type TConsStatServ = {
  /** @attribute xsd:TVerConsStat, pattern `3\.00` */
  versao: string;
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
  xServ: string;
};

/**
 * Tipo Código da UF da tabela do IBGE
 * xsd:TCodUfIBGE
 */
export type TCodUfIBGE = "11" | "12" | "13" | "14" | "15" | "16" | "17" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "31" | "32" | "33" | "35" | "41" | "42" | "43" | "50" | "51" | "52" | "53";

/**
 * Tipo Resultado da Consulta do Status do Serviço MDFe
 * xsd: TRetConsStatServ
 */
export type TRetConsStatServ = {
  /** @attribute xsd:TVerConsStat, pattern `3\.00` */
  versao: string;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Versão do Aplicativo que processou o CT-e
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
  /**
   * Código da UF responsável pelo serviço
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * AAAA-MM-DDTHH:MM:SS TZD
   * xsd:TDateTimeUTC
   */
  dhRecbto: string;
  /**
   * Tempo médio de resposta do serviço (em segundos) dos últimos 5 minutos
   * pattern `[0-9]{1,4}`
   */
  tMed?: string;
  /**
   * AAAA-MM-DDTHH:MM:SS TZD. Deve ser preenchida com data e hora previstas para o retorno dos serviços prestados.
   * xsd:TDateTimeUTC
   */
  dhRetorno?: string;
  /**
   * Campo observação utilizado para incluir informações ao contribuinte
   * tamanho 1..255
   */
  xObs?: string;
};

/**
 * Tipo Pedido de Consulta da Situação Atual do MDF-e
 * xsd: TConsSitMDFe
 */
export type TConsSitMDFe = {
  /** @attribute xsd:TVerConsSitMDFe, pattern `3\.00` */
  versao: string;
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
  xServ: string;
  /**
   * Chaves de acesso do MDF-e, compostas por: UF do emitente, AAMM da emissão do MDF-e, CNPJ do emitente, modelo, série, tipo de emissão e número do MDF-e e código numérico + DV.
   * xsd:TChNFe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chMDFe: string;
};

/** xsd: tipo anônimo de TRetConsSitMDFe.protMDFe */
export type TRetConsSitMDFe_protMDFe = {
  /** @attribute */
  versao: "1.00" | "3.00";
  /** Conteúdo de `xs:any` (processContents skip), como XML bruto em ordem. */
  $any: string[];
};

/** xsd: tipo anônimo de TRetConsSitMDFe.procEventoMDFe */
export type TRetConsSitMDFe_procEventoMDFe = {
  /** @attribute */
  versao: "1.00" | "3.00";
  /** Conteúdo de `xs:any` (processContents skip), como XML bruto em ordem. */
  $any: string[];
};

/**
 * Grupo de informações do compartilhamento do MDFe com InfraSA para geração do DTe
 * xsd: tipo anônimo de TRetConsSitMDFe.procInfraSA
 */
export type TRetConsSitMDFe_procInfraSA = {
  /**
   * Número do Protocolo de geração do DTe
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProtDTe: string;
  /**
   * Data e hora de geração do protocolo, no formato AAAA-MM-DDTHH:MM:SS TZD.
   * xsd:TDateTimeUTC
   */
  dhProt: string;
};

/**
 * Tipo Retorno de Pedido de Consulta da Situação Atual do MDF-e
 * xsd: TRetConsSitMDFe
 */
export type TRetConsSitMDFe = {
  /** @attribute xsd:TVerConsSitMDFe, pattern `3\.00` */
  versao: string;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Versão do Aplicativo que processou o MDF-e
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
  /**
   * código da UF de atendimento
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  protMDFe?: TRetConsSitMDFe_protMDFe;
  /** ocorre 0..n */
  procEventoMDFe?: TRetConsSitMDFe_procEventoMDFe[];
  /** Grupo de informações do compartilhamento do MDFe com InfraSA para geração do DTe */
  procInfraSA?: TRetConsSitMDFe_procInfraSA;
};

/**
 * Tipo Pedido de Consulta MDF-e Não Encerrados
 * xsd: TConsMDFeNaoEnc
 */
export type TConsMDFeNaoEnc = {
  /** @attribute xsd:TVerConsMDFeNaoEnc, pattern `3\.00` */
  versao: string;
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
  xServ: string;
} & (
  ({
  /**
   * CNPJ do emitente do MDF-e
   * Informar zeros não significativos
   * xsd:TCnpj, pattern `[A-Z0-9]{12}[0-9]{2}`
   */
  CNPJ: string;
  CPF?: never;
})
  | ({
  /**
   * CPF do emitente do MDF-e
   * Informar zeros não significativos
   * Usar com serie específica 920-969 para emitente pessoa física com inscrição estadual
   * xsd:TCpf, pattern `[0-9]{11}`
   */
  CPF: string;
  CNPJ?: never;
})
);

/** xsd: tipo anônimo de TRetConsMDFeNaoEnc.infMDFe */
export type TRetConsMDFeNaoEnc_infMDFe = {
  /**
   * Chaves de acesso do MDF-e não encerrado
   * xsd:TChMDFe, tamanho 0..44, pattern `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`
   */
  chMDFe: string;
  /**
   * Número do Protocolo de autorização do MDF-e não encerrado
   * xsd:TProt, pattern `[0-9]{15}`
   */
  nProt: string;
};

/**
 * Tipo Retorno de Pedido de Consulta MDF-e não Encerrados
 * xsd: TRetConsMDFeNaoEnc
 */
export type TRetConsMDFeNaoEnc = {
  /** @attribute xsd:TVerConsMDFeNaoEnc, pattern `3\.00` */
  versao: string;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Versão do Aplicativo que processou o MDF-e
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
  /**
   * código da UF de atendimento
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /** ocorre 0..n */
  infMDFe?: TRetConsMDFeNaoEnc_infMDFe[];
};


// ---------- descritores de tipo simples ----------
const st_TVerConsStat: SimpleType = { b: "string", p: [["3\\.00"]], nm: "TVerConsStat" };
const st_TAmb: SimpleType = { b: "string", e: ["1","2"], nm: "TAmb" };
const st_TServ: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], nm: "TServ" };
const st$0: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, ws: "c", nm: "TVerAplic" };
const st_TStat: SimpleType = { b: "string", p: [["[0-9]{3,4}"]], nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st_TCodUfIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53"], nm: "TCodUfIBGE" };
const st_TDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([\\-,\\+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TDateTimeUTC" };
const st$1: SimpleType = { b: "integer", p: [["[0-9]{1,4}"]] };
const st$2: SimpleType = { b: "string", mn: 1, mx: 255, ws: "c" };
const st$3: SimpleType = { b: "string", p: [["3\\.00"]], nm: "TVerConsSitMDFe" };
const st_TChNFe: SimpleType = { b: "string", p: [["[0-9]{6}[A-Z0-9]{12}[0-9]{26}"]], mx: 44, nm: "TChNFe" };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st$4: SimpleType = { b: "string", e: ["1.00","3.00"] };
const st_TProt: SimpleType = { b: "string", p: [["[0-9]{15}"]], nm: "TProt" };
const st$5: SimpleType = { b: "string", p: [["3\\.00"]], nm: "TVerConsMDFeNaoEnc" };
const st_TCnpj: SimpleType = { b: "string", p: [["[A-Z0-9]{12}[0-9]{2}"]], nm: "TCnpj" };
const st_TCpf: SimpleType = { b: "string", p: [["[0-9]{11}"]], nm: "TCpf" };
const st_TChMDFe: SimpleType = { b: "string", p: [["[0-9]{6}[A-Z0-9]{12}[0-9]{26}"]], mx: 44, nm: "TChMDFe" };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const TConsStatServ: ComplexType<TConsStatServ> = { id: "TConsStatServ", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerConsStat, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "xServ", t: st_TServ }] } };
export const TRetConsStatServ: ComplexType<TRetConsStatServ> = { id: "TRetConsStatServ", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st_TVerConsStat, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st$0 }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "cUF", t: st_TCodUfIBGE }, { e: "dhRecbto", t: st_TDateTimeUTC }, { e: "tMed", t: st$1, n: 0 }, { e: "dhRetorno", t: st_TDateTimeUTC, n: 0 }, { e: "xObs", t: st$2, n: 0 }] } };
export const TConsSitMDFe: ComplexType<TConsSitMDFe> = { id: "TConsSitMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st$3, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "xServ", t: st_TServ }, { e: "chMDFe", t: st_TChNFe }] } };
export const TRetConsSitMDFe_protMDFe: ComplexType<TRetConsSitMDFe_protMDFe> = { id: "TRetConsSitMDFe.protMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st$4, r: 1 }], c: { g: "s", i: [{ w: 1 }] } };
export const TRetConsSitMDFe_procEventoMDFe: ComplexType<TRetConsSitMDFe_procEventoMDFe> = { id: "TRetConsSitMDFe.procEventoMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st$4, r: 1 }], c: { g: "s", i: [{ w: 1 }] } };
export const TRetConsSitMDFe_procInfraSA: ComplexType<TRetConsSitMDFe_procInfraSA> = { id: "TRetConsSitMDFe.procInfraSA", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "nProtDTe", t: st_TProt }, { e: "dhProt", t: st_TDateTimeUTC }] } };
export const TRetConsSitMDFe: ComplexType<TRetConsSitMDFe> = { id: "TRetConsSitMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st$3, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "cUF", t: st_TCodUfIBGE }, { e: "protMDFe", t: TRetConsSitMDFe_protMDFe, n: 0 }, { e: "procEventoMDFe", t: TRetConsSitMDFe_procEventoMDFe, n: 0, x: -1 }, { e: "procInfraSA", t: TRetConsSitMDFe_procInfraSA, n: 0 }] } };
export const TConsMDFeNaoEnc: ComplexType<TConsMDFeNaoEnc> = { id: "TConsMDFeNaoEnc", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st$5, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "xServ", t: st_TServ }, { g: "c", i: [{ e: "CNPJ", t: st_TCnpj }, { e: "CPF", t: st_TCpf }] }] } };
export const TRetConsMDFeNaoEnc_infMDFe: ComplexType<TRetConsMDFeNaoEnc_infMDFe> = { id: "TRetConsMDFeNaoEnc.infMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", c: { g: "s", i: [{ e: "chMDFe", t: st_TChMDFe }, { e: "nProt", t: st_TProt }] } };
export const TRetConsMDFeNaoEnc: ComplexType<TRetConsMDFeNaoEnc> = { id: "TRetConsMDFeNaoEnc", ns: "http://www.portalfiscal.inf.br/mdfe", a: [{ a: "versao", t: st$5, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "cUF", t: st_TCodUfIBGE }, { e: "infMDFe", t: TRetConsMDFeNaoEnc_infMDFe, n: 0, x: -1 }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `consStatServMDFe` (tipo TConsStatServ). */
export const consStatServMDFeElement: RootElement<TConsStatServ> = { name: "consStatServMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", type: TConsStatServ };
/** Elemento raiz `retConsStatServMDFe` (tipo TRetConsStatServ). */
export const retConsStatServMDFeElement: RootElement<TRetConsStatServ> = { name: "retConsStatServMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", type: TRetConsStatServ };
/** Elemento raiz `consSitMDFe` (tipo TConsSitMDFe). */
export const consSitMDFeElement: RootElement<TConsSitMDFe> = { name: "consSitMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", type: TConsSitMDFe };
/** Elemento raiz `retConsSitMDFe` (tipo TRetConsSitMDFe). */
export const retConsSitMDFeElement: RootElement<TRetConsSitMDFe> = { name: "retConsSitMDFe", ns: "http://www.portalfiscal.inf.br/mdfe", type: TRetConsSitMDFe };
/** Elemento raiz `consMDFeNaoEnc` (tipo TConsMDFeNaoEnc). */
export const consMDFeNaoEncElement: RootElement<TConsMDFeNaoEnc> = { name: "consMDFeNaoEnc", ns: "http://www.portalfiscal.inf.br/mdfe", type: TConsMDFeNaoEnc };
/** Elemento raiz `retConsMDFeNaoEnc` (tipo TRetConsMDFeNaoEnc). */
export const retConsMDFeNaoEncElement: RootElement<TRetConsMDFeNaoEnc> = { name: "retConsMDFeNaoEnc", ns: "http://www.portalfiscal.inf.br/mdfe", type: TRetConsMDFeNaoEnc };
