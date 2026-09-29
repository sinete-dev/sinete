/**
 * NFC-e (modelo 65): as regras de montagem que valem só para ela e o `infNFeSupl` (QR Code e URL de consulta por
 * chave). As regras vêm do MOC 7.0 Anexo I (regras de validação com modelo 65 e aplicação obrigatória), da NT 2023.002
 * (emitente pessoa física, v1.01), da NT 2025.001 v1.03 (QR Code versão 3 e pagamentos) e da NT 2025.002 v1.51 (reforma
 * tributária); o leiaute do QR Code, do Manual de Padrões Técnicos do DANFE NFC-e e QR Code, versão 6.0 (março de
 * 2025), itens 4.3 e 4.4. Regra opcional por UF (aplicação "Facult." sem mudança posterior) não entra aqui: a SEFAZ da
 * UF decide, e recusar localmente bloquearia a venda onde a regra não vale.
 */

import type { Ambiente, Signer, Uf } from '@sinete/core';
import { tpAmbOf } from '@sinete/core';
import { base64Encode, c14n, firstChild, parseXml, SHA1_DIGEST_INFO_PREFIX } from '@sinete/core/xml';
import { parseCnpj } from '@sinete/validators';
import urls from '../data/nfce-urls.json' with { type: 'json' };
import { Decimal } from '../decimal.ts';
import type { Issues } from '../issues.ts';
import type { NfeInput } from '../model.ts';

/**
 * Versão do QR Code da NFC-e. A 3 (padrão) dispensa o CSC: na emissão normal leva só chave, versão e ambiente, e na
 * contingência off-line leva a assinatura dos parâmetros com o certificado da nota (NT 2025.001, item 02.1). A 2 usa
 * o CSC e o identificador dele (`idCSC`), fornecidos pela SEFAZ da UF; o emitente pessoa física não pode usá-la
 * (ZX02-222, rejeição 444).
 */
export type QrCodeNfceOpcoes =
  | { readonly versao: '3' }
  | {
      readonly versao: '2';
      /** Identificador do CSC na SEFAZ (até 6 dígitos); os zeros à esquerda saem do QR Code (Manual 6.0, 4.3.1). */
      readonly idCSC: string;
      /** O CSC (16 a 36 caracteres, Manual 6.0, 4.6). Nunca vai para o XML: só entra no hash. */
      readonly CSC: string;
    };

/** O que a montagem deixa pronto para o `infNFeSupl` da NFC-e. */
export interface NfceSupl {
  readonly versao: '2' | '3';
  /** URL de consulta por chave de acesso (`urlChave`), impressa no DANFC-e. */
  readonly urlChave: string;
  /** Endereço do QR Code até o `?p=`, inclusive. */
  readonly base: string;
  /** Parâmetros já separados por `|`: completos, ou de 1 a 7 quando falta a assinatura (versão 3 off-line). */
  readonly parametros: string;
  /** Versão 3 em contingência off-line: os parâmetros são assinados com o certificado da nota (Manual 6.0, 4.4.2). */
  readonly assinar: boolean;
}

type Entrada = { readonly url: string | null; readonly desde?: string; readonly nota?: string };
type TabelaUrls = Readonly<Record<Ambiente, Readonly<Record<string, readonly Entrada[]>>>>;

/** O endereço vigente no dia (`AAAA-MM-DD`, horário de Brasília): o de início mais recente que não passou do dia. */
function vigente(lista: readonly Entrada[] | undefined, dia: string): Entrada | undefined {
  let achado: Entrada | undefined;
  for (const e of lista ?? []) {
    if ((e.desde ?? '') <= dia && (achado === undefined || (e.desde ?? '') >= (achado.desde ?? ''))) achado = e;
  }
  return achado;
}

/**
 * Endereços da NFC-e da UF no ambiente e no dia (`data/nfce-urls.json`, das tabelas do Portal Nacional da NFC-e). O
 * `qrCode` é `undefined` onde a tabela não traz o endereço completo (AM e MA publicam sem o protocolo): informe
 * `BuildNfeOptions.urlQrCode`.
 */
export function urlsNfce(
  uf: Uf,
  ambiente: Ambiente,
  dia: string,
): { readonly qrCode: string | undefined; readonly urlChave: string | undefined } {
  const q = vigente((urls.qrCode as TabelaUrls)[ambiente][uf], dia);
  const c = vigente((urls.urlChave as TabelaUrls)[ambiente][uf], dia);
  return { qrCode: q?.url ?? undefined, urlChave: c?.url ?? undefined };
}

const te = new TextEncoder();
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

async function sha1(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-1', bytes as Uint8Array<ArrayBuffer>));
}

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * `digVal` do QR Code versão 2 off-line: o DigestValue do `infNFe` (SHA-1 do C14N, em Base64, o mesmo da assinatura)
 * convertido para hexadecimal caractere a caractere (Manual 6.0, 4.3.2 e o exemplo de 4.3.6.2: `yzGY...` vira
 * `797a4759...`).
 */
async function digValHex(xml: string): Promise<string> {
  const doc = parseXml(xml);
  const inf = firstChild(doc.root, 'infNFe', NFE_NS);
  if (inf === undefined) throw new Error('NF-e montada sem infNFe');
  return hexDoDigestValue(base64Encode(await sha1(te.encode(c14n(inf)))));
}

/** O DigestValue em Base64 convertido para hexadecimal, caractere a caractere (Manual 6.0, 4.3.5, passo 1). */
export function hexDoDigestValue(digestValue: string): string {
  return hex(te.encode(digestValue));
}

/** Hash do QR Code versão 2: SHA-1 dos parâmetros concatenados ao CSC, em hexadecimal (Manual 6.0, 4.3.4 e 4.3.5). */
export async function hashQrCodeV2(parametros: string, csc: string): Promise<string> {
  return hex(await sha1(te.encode(parametros + csc))).toUpperCase();
}

export interface DadosQrCode {
  readonly chave: string;
  readonly ambiente: Ambiente;
  readonly tpEmis: string;
  /** `dhEmi` do documento. */
  readonly dhEmi: string;
  /** `vNF` como vai no XML (ponto decimal, sem milhar). */
  readonly vNF: string;
  readonly dest?: { readonly CNPJ?: string; readonly CPF?: string; readonly idEstrangeiro?: string };
  /** O XML montado (`<NFe>` sem assinatura): o `digVal` da versão 2 off-line sai dele. */
  readonly xml: string;
}

/**
 * Parâmetros do QR Code (Manual 6.0): versão 2 on-line `chave|2|tpAmb|idCSC|hash` e off-line
 * `chave|2|tpAmb|dia|vNF|digVal|idCSC|hash`, com o hash SHA-1 em hexadecimal dos parâmetros concatenados ao CSC
 * (4.3.4 e 4.3.5); versão 3 on-line `chave|3|tpAmb` e off-line `chave|3|tpAmb|dia|vNF|tpIdDest|idDest`, que o
 * certificado assina (4.4.1 e 4.4.2). Destinatário não identificado deixa os campos 6 e 7 vazios; o estrangeiro, só o
 * 7. Na contingência off-line (tpEmis 9) entram o dia da emissão e o valor da nota, que o consumidor confere sem a
 * nota ter chegado à SEFAZ.
 */
export async function parametrosQrCode(
  d: DadosQrCode,
  qr: QrCodeNfceOpcoes,
): Promise<{ readonly parametros: string; readonly assinar: boolean }> {
  const tpAmb = tpAmbOf(d.ambiente);
  const offline = d.tpEmis === '9';
  const dia = d.dhEmi.slice(8, 10);
  if (qr.versao === '3') {
    if (!offline) return { parametros: `${d.chave}|3|${tpAmb}`, assinar: false };
    const dest = d.dest;
    const [tp, id] =
      dest?.CNPJ !== undefined
        ? ['1', dest.CNPJ]
        : dest?.CPF !== undefined
          ? ['2', dest.CPF]
          : dest?.idEstrangeiro !== undefined
            ? ['3', '']
            : ['', ''];
    return { parametros: `${d.chave}|3|${tpAmb}|${dia}|${d.vNF}|${tp}|${id}`, assinar: true };
  }
  const idCSC = String(Number(qr.idCSC));
  const antes = offline
    ? `${d.chave}|2|${tpAmb}|${dia}|${d.vNF}|${await digValHex(d.xml)}|${idCSC}`
    : `${d.chave}|2|${tpAmb}|${idCSC}`;
  return { parametros: `${antes}|${await hashQrCodeV2(antes, qr.CSC)}`, assinar: false };
}

/**
 * Assinatura dos parâmetros 1 a 7 do QR Code versão 3 off-line: RSA com SHA-1 (PKCS#1 v1.5), em Base64, com o mesmo
 * certificado que assina a NFC-e (Manual 6.0, 4.4.2, parâmetro 8).
 */
export async function assinarParametros(parametros: string, signer: Signer): Promise<string> {
  const bytes = te.encode(parametros);
  if (signer.kind === 'data') return base64Encode(await signer.sign(bytes, 'SHA-1'));
  const h = await sha1(bytes);
  const di = new Uint8Array(SHA1_DIGEST_INFO_PREFIX.length + h.length);
  di.set(SHA1_DIGEST_INFO_PREFIX);
  di.set(h, SHA1_DIGEST_INFO_PREFIX.length);
  return base64Encode(await signer.signDigestInfo(di));
}

/** CFOP da prestação de serviço tributada pelo ISSQN na NFC-e (MOC 7.0 Anexo I, RV I08-150 a I08-170). */
const CFOP_ISSQN = '5933';

/** Valor da NFC-e acima do qual o destinatário tem de ser identificado (MOC 7.0 Anexo I, RV W16-40, rejeição 750). */
export const NFCE_LIMITE_SEM_DESTINATARIO = '10000.00';

/** Meios de pagamento que a NFC-e não aceita: 14 duplicata mercantil (YA02-10), 90 sem pagamento (YA02-40), 99 outros (YA02-50). */
const TPAG_VEDADOS: Readonly<Record<string, string>> = {
  '14': 'duplicata mercantil não é meio de pagamento da NFC-e (YA02-10, rejeição 857)',
  '90': 'a NFC-e sempre tem pagamento: tPag 90 (sem pagamento) é recusado (YA02-40, rejeição 899)',
  '99': 'tPag 99 (outros) não é aceito na NFC-e (YA02-50, rejeição 436, NT 2020.006)',
};

/** Identificação já resolvida pelo montador (com os padrões aplicados). */
export interface IdeNfce {
  readonly tpNF: string;
  readonly idDest: string;
  readonly tpImp: string;
  readonly finNFe: string;
  readonly indFinal: string;
  readonly indPres: string;
}

/**
 * Regras da NFC-e sobre a entrada (origem `entrada`, ADR 0011), todas de aplicação obrigatória. Grupos que a NFC-e
 * não tem saem como `grupo_vedado` no caminho da entrada.
 */
export function conferirNfce(input: NfeInput, ide: IdeNfce, issues: Issues): void {
  const vedado = (path: string, msg: string): void => issues.add(path, 'grupo_vedado', `NFC-e ${msg}`);
  const invalido = (path: string, msg: string): void => issues.add(path, 'campo_invalido', `NFC-e ${msg}`);

  // B. Identificação
  if (input.dhSaiEnt !== undefined) vedado('dhSaiEnt', 'sem data de entrada ou saída (B10-10, rejeição 705)');
  if (input.dPrevEntrega !== undefined) {
    vedado('dPrevEntrega', 'sem data de previsão de entrega (NT 2025.002, B10a-10, rejeição 1153)');
  }
  if (ide.tpNF !== '1') invalido('tpNF', 'só de saída, tpNF 1 (B11-10, rejeição 706)');
  if (ide.idDest !== '1') {
    invalido('idDest', 'só em operação interna, idDest 1 (B11a-10, rejeição 707)');
  }
  if (ide.tpImp !== '4' && ide.tpImp !== '5') {
    invalido('tpImp', 'com DANFC-e: tpImp 4 (impresso) ou 5 (mensagem eletrônica) (B21-10, rejeição 709)');
  }
  if (ide.finNFe !== '1') invalido('finNFe', 'só com finalidade normal, finNFe 1 (B25-20, rejeição 715)');
  if (ide.indFinal !== '1') invalido('indFinal', 'só com consumidor final, indFinal 1 (B25a-10, rejeição 716)');
  if (!['1', '4', '5'].includes(ide.indPres)) {
    invalido('indPres', 'só presencial: indPres 1, 4 (entrega a domicílio) ou 5 (NT 2025.002, B25b-20, rejeição 717)');
  }
  if (input.cMunFGIBS !== undefined && ide.indPres !== '5') {
    invalido(
      'cMunFGIBS',
      'com cMunFGIBS só em operação presencial fora do estabelecimento, indPres 5 (NT 2025.002, B25b-60, rejeição 1000)',
    );
  }
  if (input.cMunFGIBS === undefined && ide.indPres === '5') {
    issues.add(
      'cMunFGIBS',
      'campo_obrigatorio',
      'NFC-e presencial fora do estabelecimento (indPres 5) informa cMunFGIBS (NT 2025.002, B25b-70, rejeição 1005)',
    );
  }
  if (input.referenciadas !== undefined && input.referenciadas.length > 0) {
    vedado('referenciadas', 'não referencia documento fiscal (BA01-10, rejeição 708)');
  }
  if (input.gCompraGov !== undefined)
    vedado('gCompraGov', 'sem compra governamental (NT 2025.002, BB01-10, rejeição 1006)');

  // C. Emitente
  if (input.emitente.IEST !== undefined)
    vedado('emitente.IEST', 'sem IE de substituto tributário (C18-10, rejeição 718)');

  // E. Destinatário: opcional, obrigatório na entrega a domicílio
  const d = input.destinatario;
  if (ide.indPres === '4' && d === undefined) {
    issues.add(
      'destinatario',
      'campo_obrigatorio',
      'NFC-e com entrega a domicílio identifica o destinatário (E01-20, rejeição 787)',
    );
  }
  if (ide.indPres === '4' && d !== undefined && d.endereco === undefined) {
    issues.add(
      'destinatario.endereco',
      'campo_obrigatorio',
      'NFC-e com entrega a domicílio informa o endereço do destinatário (E05-20, rejeição 788)',
    );
  }
  if (d !== undefined) {
    if (d.CNPJ !== undefined && input.emitente.CNPJ !== undefined && digitos(d.CNPJ) === digitos(input.emitente.CNPJ)) {
      invalido('destinatario.CNPJ', 'com destinatário igual ao emitente (E02-20, rejeição 220)');
    }
    if (d.indIEDest !== '9') {
      invalido('destinatario.indIEDest', 'só para não contribuinte, indIEDest 9 (E16a-10, rejeição 789)');
    }
    if (d.ISUF !== undefined) vedado('destinatario.ISUF', 'sem inscrição na Suframa (E18-10, rejeição 730)');
  }

  // I a UA. Itens
  input.itens.forEach((it, n) => {
    const p = `itens[${n}]`;
    const esp = (it.produto.especifico ?? {}) as Record<string, unknown>;
    if (esp.veicProd !== undefined)
      vedado(`${p}.produto.especifico.veicProd`, 'sem veículo novo (J01-10, rejeição 736)');
    if (esp.arma !== undefined) vedado(`${p}.produto.especifico.arma`, 'sem armamento (L01-10, rejeição 738)');
    if (esp.nRECOPI !== undefined)
      vedado(`${p}.produto.especifico.nRECOPI`, 'sem papel imune RECOPI (LB01-10, rejeição 348)');
    if (it.produto.tpCredPresIBSZFM !== undefined) {
      vedado(
        `${p}.produto.tpCredPresIBSZFM`,
        'sem classificação para subapuração do IBS na ZFM (NT 2025.002, I05k-10, rejeição 1165)',
      );
    }
    const cfop = it.produto.CFOP.replace(/\D/g, '');
    const imp = it.impostos;
    if (cfop === CFOP_ISSQN && imp.issqn === undefined) {
      issues.add(
        `${p}.impostos.issqn`,
        'combinacao_invalida',
        'NFC-e com CFOP 5.933 tem o grupo do ISSQN (I08-160, rejeição 374)',
      );
    }
    if (cfop !== CFOP_ISSQN && imp.issqn !== undefined) {
      issues.add(
        `${p}.produto.CFOP`,
        'combinacao_invalida',
        'NFC-e com ISSQN usa o CFOP 5.933 (I08-170, rejeição 374)',
      );
    }
    const icms = imp.icms as { grupo?: string; CST?: string; st?: unknown } | undefined;
    if (icms?.grupo === 'Part') vedado(`${p}.impostos.icms`, 'sem partilha do ICMS entre UF (N12-50, rejeição 741)');
    if (icms?.grupo === 'ST') vedado(`${p}.impostos.icms`, 'sem repasse do ICMS-ST retido (N12-60, rejeição 740)');
    if (icms?.grupo === undefined && icms?.CST === '90' && icms.st !== undefined) {
      vedado(`${p}.impostos.icms.st`, 'com CST 90 sem os dados do ICMS-ST (N12-34, rejeição 381)');
    }
    if (imp.icmsUfDest !== undefined)
      vedado(`${p}.impostos.icmsUfDest`, 'sem ICMS da UF de destino (NA01-10, rejeição 807)');
    if (imp.ipi !== undefined) vedado(`${p}.impostos.ipi`, 'sem IPI (O01-10, rejeição 742)');
    if (imp.ii !== undefined) vedado(`${p}.impostos.ii`, 'sem imposto de importação (P01-10, rejeição 743)');
    if (imp.pisSt !== undefined) vedado(`${p}.impostos.pisSt`, 'sem PIS-ST (R01-10, rejeição 746)');
    if (imp.cofinsSt !== undefined) vedado(`${p}.impostos.cofinsSt`, 'sem COFINS-ST (T01-10, rejeição 749)');
    if (it.impostoDevol !== undefined) vedado(`${p}.impostoDevol`, 'sem devolução de tributos (UA01-20, rejeição 390)');
  });

  // X. Transporte: só na entrega a domicílio
  const tr = input.transporte;
  const entrega = ide.indPres === '4';
  if (tr !== undefined && tr.modFrete !== '9' && !entrega) {
    invalido('transporte.modFrete', 'sem frete fora da entrega a domicílio: modFrete 9 (X02-10, rejeição 753)');
  }
  if (tr?.transportador !== undefined && !entrega) {
    vedado('transporte.transportador', 'só tem transportador na entrega a domicílio (X03-10, rejeição 754)');
  }
  if (entrega && tr?.transportador === undefined) {
    issues.add(
      'transporte.transportador',
      'campo_obrigatorio',
      'NFC-e com entrega a domicílio identifica o transportador (X03-20, rejeição 786)',
    );
  }
  if (tr?.retTransp !== undefined)
    vedado('transporte.retTransp', 'sem retenção do ICMS no transporte (X11-10, rejeição 755)');
  if (tr?.veicTransp !== undefined) vedado('transporte.veicTransp', 'sem veículo de transporte (X18-10, rejeição 756)');
  if (tr?.reboque !== undefined) vedado('transporte.reboque', 'sem reboque (X22-10, rejeição 757)');

  // Y e YA. Cobrança e pagamento
  if (input.cobranca !== undefined) vedado('cobranca', 'sem fatura nem duplicata (Y01-10, rejeição 760)');
  if (input.pagamento === undefined || input.pagamento.detPag.length === 0) {
    issues.add(
      'pagamento',
      'campo_obrigatorio',
      'a NFC-e informa o pagamento: tPag 90 (sem pagamento) é recusado (YA02-40, rejeição 899)',
    );
  } else {
    input.pagamento.detPag.forEach((p, n) => {
      const motivo = TPAG_VEDADOS[p.tPag];
      if (motivo !== undefined) issues.add(`pagamento.detPag[${n}].tPag`, 'pagamento_invalido', motivo);
      // Cartão e PIX pedem o grupo do cartão (NT 2025.001, YA04-10, rejeição 391; obrigatória no modelo 65).
      if (['03', '04', '17'].includes(p.tPag) && p.card === undefined) {
        issues.add(
          `pagamento.detPag[${n}].card`,
          'campo_obrigatorio',
          'pagamento com cartão (tPag 03 ou 04) ou PIX (17) informa o grupo card (NT 2025.001, YA04-10, rejeição 391)',
        );
      }
    });
  }

  // Z. Grupos que a NFC-e não tem
  if (input.exporta !== undefined) vedado('exporta', 'sem comércio exterior (ZA01-30, rejeição 814)');
  if (input.compra !== undefined) vedado('compra', 'sem dados de compra (ZB01-10, rejeição 762)');
  if (input.cana !== undefined) vedado('cana', 'sem aquisição de cana (ZC01-10, rejeição 763)');
}

/** O `pag` montado, na forma que as regras de pagamento leem e completam. */
export interface PagMontado {
  readonly detPag: readonly {
    readonly tPag: string;
    readonly vPag: string;
    readonly card?: { readonly tpIntegra?: string; readonly CNPJ?: string; readonly cAut?: string };
  }[];
  vTroco?: string;
}

/**
 * Regras de pagamento da NFC-e sobre o grupo montado, com o `vNF` já calculado (NT 2025.001, item 02.7: YA03-10 a
 * YA06-10 passam a ser obrigatórias; MOC 7.0 Anexo I, YA09-10). Sem `vTroco` e com pagamento acima do total, o builder
 * calcula o troco (YA03-20, rejeição 866); informado, ele tem de ser a diferença (YA09-10, rejeição 869). O pagamento
 * posterior (tPag 91) tem valor zero e dispensa a soma igual ao total (NT 2025.001 v1.03, YA03-10 e YA03-30).
 */
export function pagamentoNfce(pag: PagMontado, vNF: Decimal, issues: Issues): void {
  const total = pag.detPag.reduce((a, p) => a.plus(Decimal.of(p.vPag)), Decimal.ZERO);
  const troco = total.minus(vNF);
  const posterior = pag.detPag.some((p) => p.tPag === '91');
  pag.detPag.forEach((p, n) => {
    if (p.tPag === '91' && !Decimal.of(p.vPag).isZero()) {
      issues.add(
        `pagamento.detPag[${n}].vPag`,
        'pagamento_invalido',
        'pagamento posterior (tPag 91) tem vPag zero (NT 2025.001 v1.03, YA03-30, rejeição 904)',
      );
    }
  });
  if (troco.isNegative() && !posterior) {
    issues.add(
      'pagamento.detPag',
      'pagamento_invalido',
      `pagamentos (${total.toFixed(2)}) abaixo do total da NFC-e (${vNF.toFixed(2)}) (NT 2025.001 v1.03, YA03-10, rejeição 865)`,
    );
  }
  // O troco informado é sempre pagamentos menos o total, também com o pagamento posterior (YA09-10 não tem exceção).
  if (pag.vTroco === undefined) {
    if (!troco.isNegative() && !troco.isZero()) pag.vTroco = troco.toFixed(2);
  } else if (!Decimal.of(pag.vTroco).eq(troco)) {
    issues.add(
      'pagamento.vTroco',
      'valor_divergente',
      `troco ${pag.vTroco} difere de pagamentos menos o total (${troco.toFixed(2)}) (YA09-10, rejeição 869)`,
    );
  }
  pag.detPag.forEach((p, n) => {
    const c = p.card;
    if (c === undefined) return;
    const path = `pagamento.detPag[${n}].card`;
    if (c.tpIntegra === '1' && (c.CNPJ === undefined || c.cAut === undefined)) {
      issues.add(
        path,
        'campo_obrigatorio',
        'cartão integrado à automação (tpIntegra 1) informa o CNPJ da credenciadora e o cAut (NT 2025.001, YA05-10, rejeição 392)',
      );
    }
    if (c.CNPJ !== undefined) {
      const r = parseCnpj(c.CNPJ, { path: `${path}.CNPJ` });
      if (!r.ok) issues.list.push(r.error);
    }
  });
}

const digitos = (s: string): string => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
