// biome-ignore-all format: código gerado
// biome-ignore-all lint: código gerado
/**
 * GERADO por tools/xsd-codegen a partir de PL_009q_NT2025_001_v1.00. Não edite: rode `bun run --cwd tools/xsd-codegen gen`.
 *
 * Status do serviço da NF-e: consStatServ e retConsStatServ (os pacotes 010 não redistribuem estes schemas).
 *
 * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):
 * - nfe/PL_009q_NT2025_001_v1.00 (PL_009q_NT2025_001_v1.00.zip)
 */
import type { ComplexType, DescricaoModuloSchema, ElementoRaiz, SimpleType } from "../../runtime/desc.ts";

/** Proveniência deste módulo. */
export const schema: DescricaoModuloSchema = {
  "subpath": "nfe/status-servico/PL_009q",
  "documento": "nfe",
  "pl": "PL_009q_NT2025_001_v1.00",
  "fontes": [
    {
      "pacote": "nfe/PL_009q_NT2025_001_v1.00",
      "arquivo": "PL_009q_NT2025_001_v1.00.zip",
      "sha256": "82a26d04a778fc214bf8c6c6e5c65ea577721e32ed5efa9a11a80098b8f9802f",
      "url": "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=0qRvxtvKcj4="
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
 * Tipo Pedido de Consulta do Status do Serviço
 * xsd: TConsStatServ
 */
export type TConsStatServ = {
  /** @attribute xsd:TVerConsStatServ, pattern `4\.00` */
  versao: string;
  /**
   * Identificação do Ambiente:
   * 1 - Produção
   * 2 - Homologação
   * xsd:TAmb
   */
  tpAmb: TAmb;
  /**
   * Sigla da UF consultada
   * xsd:TCodUfIBGE
   */
  cUF: TCodUfIBGE;
  /**
   * Serviço Solicitado
   * xsd:TServ, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xServ: "STATUS";
};

/**
 * Tipo Resultado da Consulta do Status do Serviço
 * xsd: TRetConsStatServ
 */
export type TRetConsStatServ = {
  /** @attribute xsd:TVerConsStatServ, pattern `4\.00` */
  versao: string;
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
   * xsd:TStat, tamanho 0..3, pattern `[0-9]{3}`
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
   * Data e hora do recebimento da consulta no formato AAAA-MM-DDTHH:MM:SSTZD
   * xsd:TDateTimeUTC
   */
  dhRecbto: string;
  /**
   * Tempo médio de resposta do serviço (em segundos) dos últimos 5 minutos
   * xsd:TMed, pattern `[0-9]{1,4}`
   */
  tMed?: string;
  /**
   * AAAA-MM-DDTHH:MM:SSDeve ser preenchida com data e hora previstas para o retorno dos serviços prestados.
   * xsd:TDateTimeUTC
   */
  dhRetorno?: string;
  /**
   * Campo observação utilizado para incluir informações ao contribuinte
   * xsd:TMotivo, tamanho 1..255, pattern `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}`
   */
  xObs?: string;
};


// ---------- descritores de tipo simples ----------
const st_TVerConsStatServ: SimpleType = { b: "token", p: [["4\\.00"]], nm: "TVerConsStatServ" };
const st_TAmb: SimpleType = { b: "string", e: ["1","2"], nm: "TAmb" };
const st_TCodUfIBGE: SimpleType = { b: "string", e: ["11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29","31","32","33","35","41","42","43","50","51","52","53"], nm: "TCodUfIBGE" };
const st$0: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], e: ["STATUS"], nm: "TServ" };
const st_TVerAplic: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 20, nm: "TVerAplic" };
const st_TStat: SimpleType = { b: "string", p: [["[0-9]{3}"]], mx: 3, nm: "TStat" };
const st_TMotivo: SimpleType = { b: "string", p: [["[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}"]], mn: 1, mx: 255, nm: "TMotivo" };
const st_TDateTimeUTC: SimpleType = { b: "string", p: [["(((20(([02468][048])|([13579][26]))-02-29))|(20[0-9][0-9])-((((0[1-9])|(1[0-2]))-((0[1-9])|(1\\d)|(2[0-8])))|((((0[13578])|(1[02]))-31)|(((0[1,3-9])|(1[0-2]))-(29|30)))))T(20|21|22|23|[0-1]\\d):[0-5]\\d:[0-5]\\d([\\-,\\+](0[0-9]|10|11):00|([\\+](12):00))"]], nm: "TDateTimeUTC" };
const st_TMed: SimpleType = { b: "string", p: [["[0-9]{1,4}"]], nm: "TMed" };

// ---------- descritores de tipo complexo (ordem do XSD) ----------
export const TConsStatServ: ComplexType<TConsStatServ> = { id: "TConsStatServ", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerConsStatServ, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "cUF", t: st_TCodUfIBGE }, { e: "xServ", t: st$0 }] } };
export const TRetConsStatServ: ComplexType<TRetConsStatServ> = { id: "TRetConsStatServ", ns: "http://www.portalfiscal.inf.br/nfe", a: [{ a: "versao", t: st_TVerConsStatServ, r: 1 }], c: { g: "s", i: [{ e: "tpAmb", t: st_TAmb }, { e: "verAplic", t: st_TVerAplic }, { e: "cStat", t: st_TStat }, { e: "xMotivo", t: st_TMotivo }, { e: "cUF", t: st_TCodUfIBGE }, { e: "dhRecbto", t: st_TDateTimeUTC }, { e: "tMed", t: st_TMed, n: 0 }, { e: "dhRetorno", t: st_TDateTimeUTC, n: 0 }, { e: "xObs", t: st_TMotivo, n: 0 }] } };

// ---------- elementos raiz ----------
/** Elemento raiz `consStatServ` (tipo TConsStatServ). */
export const consStatServElement: ElementoRaiz<TConsStatServ> = { nome: "consStatServ", ns: "http://www.portalfiscal.inf.br/nfe", tipo: TConsStatServ };
/** Elemento raiz `retConsStatServ` (tipo TRetConsStatServ). */
export const retConsStatServElement: ElementoRaiz<TRetConsStatServ> = { nome: "retConsStatServ", ns: "http://www.portalfiscal.inf.br/nfe", tipo: TRetConsStatServ };
