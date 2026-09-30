/**
 * Montagem de documentos sintéticos para falar com o simulador: NF-e do PL_010f, eventos, inutilização e consultas,
 * assinados com certificados gerados na hora. Nenhum dado real: os CNPJ têm DV calculado sobre bases inventadas.
 */

import { expect } from 'bun:test';
import type { Assinador, RelogioManual } from '@sinete/core';
import { relogioManual } from '@sinete/core';
import { assinarXml, codificarBase64, decodificarBase64, elementosFilhos, lerXml } from '@sinete/core/xml';
import type { ElementParticle, GroupParticle, RootElement, SimpleType } from '@sinete/schemas';
import { validateRoot } from '@sinete/schemas';
import * as cad from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import * as consulta from '@sinete/schemas/nfe/consulta-protocolo/PL_010d';
import * as dist from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import * as canc from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import * as cce from '@sinete/schemas/nfe/evento-cce/PL_010d';
import * as inut from '@sinete/schemas/nfe/inutilizacao/PL_010d';
import * as PL_010f from '@sinete/schemas/nfe/PL_010f';
import * as status from '@sinete/schemas/nfe/status-servico/PL_009q';
import { soap12ContentType, soap12Envelope, soapBody } from '@sinete/transport';
import { calcularDvCnpj, montarChaveAcesso } from '@sinete/validators';
import type {
  SefazSim,
  SefazSimOptions,
  SimAutorizador,
  SimRequest,
  SimResult,
  SyntheticCertificate,
} from '../src/index.ts';
import {
  createSefazSim,
  NFE_NS,
  NFE_SERVICES,
  SIM_BASE_URL,
  simTransport,
  soapAction,
  syntheticCertificate,
  wsdlNamespace,
} from '../src/index.ts';

/** Raiz de cada retorno: toda resposta do simulador é conferida contra o schema oficial. */
export const RET_ROOTS: Readonly<Record<keyof typeof NFE_SERVICES, RootElement<unknown>>> = {
  NfeStatusServico: status.retConsStatServElement,
  NFeAutorizacao: PL_010f.retEnviNFeElement,
  NFeRetAutorizacao: PL_010f.retConsReciNFeElement,
  NfeConsultaProtocolo: consulta.retConsSitNFeElement,
  RecepcaoEvento: canc.retEnvEventoElement,
  NfeInutilizacao: inut.retInutNFeElement,
  NfeConsultaCadastro: cad.retConsCadElement,
  NFeDistribuicaoDFe: dist.retDistDFeIntElement,
};

export const cnpj = (base12: string): string => base12 + calcularDvCnpj(base12);

/** CNPJ sintéticos: emitente, destinatário, transmissor terceiro (contabilidade) e transportador. */
export const EMITENTE: string = cnpj('112223330001');
export const DESTINATARIO: string = cnpj('445556660001');
export const TERCEIRO: string = cnpj('778889990001');
export const TRANSPORTADOR: string = cnpj('121212120001');
export const IE_EMITENTE = '111111110110';
export const INICIO = '2026-09-26T10:00:00-03:00';

export interface Certs {
  readonly ac: SyntheticCertificate;
  readonly emitente: SyntheticCertificate;
  readonly destinatario: SyntheticCertificate;
  readonly terceiro: SyntheticCertificate;
  readonly servidor: SyntheticCertificate;
  /** e-CNPJ do emitente já vencido (291, 281). */
  readonly vencido: SyntheticCertificate;
  /** Titular sem o otherName com o documento (292, 282). */
  readonly semDocumento: SyntheticCertificate;
  /** e-CPF (227, 472). */
  readonly ecpf: SyntheticCertificate;
}

export const CPF = '11144477735';

let cached: Promise<Certs> | undefined;

/** Certificados sintéticos, gerados uma vez por processo de teste (RSA-2048 é lento). */
export function certs(): Promise<Certs> {
  cached ??= (async (): Promise<Certs> => {
    const clock = relogioManual(INICIO);
    const ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
    const titular = (cnpjDoc: string): Promise<SyntheticCertificate> =>
      syntheticCertificate({ clock, role: 'titular', cnpj: cnpjDoc, issuer: ac });
    const [emitente, destinatario, terceiro, servidor, vencido, semDocumento, ecpf] = await Promise.all([
      titular(EMITENTE),
      titular(DESTINATARIO),
      titular(TERCEIRO),
      syntheticCertificate({ clock, role: 'servidor', issuer: ac }),
      syntheticCertificate({ clock, role: 'titular', cnpj: EMITENTE, issuer: ac, validDays: -2 }),
      syntheticCertificate({ clock, role: 'titular', cnpj: EMITENTE, issuer: ac, omitDocumentExtension: true }),
      syntheticCertificate({ clock, role: 'titular', cpf: CPF, issuer: ac }),
    ]);
    return { ac, emitente, destinatario, terceiro, servidor, vencido, semDocumento, ecpf };
  })();
  return cached;
}

export interface SendOptions {
  readonly autorizador?: SimAutorizador;
  /** Certificado do canal; `null` sem certificado. Padrão: o do harness. */
  readonly canal?: SyntheticCertificate | null;
}

export interface Harness {
  readonly clock: RelogioManual;
  readonly sim: SefazSim;
  readonly c: Certs;
  /** Envia a área de dados pelo transporte em processo e devolve o retorno, conferido contra o schema oficial. */
  send(servico: keyof typeof NFE_SERVICES, payload: string, options?: SendOptions): Promise<string>;
  /** Pedido cru ao simulador, sem transporte. */
  raw(request: Partial<SimRequest> & { readonly path: string }): Promise<SimResult>;
}

export async function harness(
  options: Partial<SefazSimOptions> = {},
  canalPadrao?: SyntheticCertificate,
): Promise<Harness> {
  const c = await certs();
  const clock = relogioManual(INICIO);
  const sim = createSefazSim({ clock, ...options });
  const padrao = canalPadrao ?? c.terceiro;
  return {
    clock,
    sim,
    c,
    async send(servico, payload, o = {}): Promise<string> {
      const canal = o.canal === undefined ? padrao : o.canal;
      const transport = simTransport(sim, canal === null ? {} : { clientCertificate: canal.der });
      const res = await transport.send({
        url: sim.url(SIM_BASE_URL, servico, o.autorizador),
        headers: { 'content-type': soap12ContentType(soapAction(NFE_SERVICES[servico])) },
        body: envelope(servico, payload),
      });
      const ret = unwrap(servico, res.text());
      expect(validateRoot(RET_ROOTS[servico], ret)).toEqual([]);
      return ret;
    },
    raw: (request): Promise<SimResult> => sim.handle({ clientCertificate: padrao.der, ...request }),
  };
}

/** Envelope SOAP 1.2 do pedido, como o pacote do documento vai montar. */
export function envelope(servico: keyof typeof NFE_SERVICES, payload: string): string {
  const def = NFE_SERVICES[servico];
  const ns = wsdlNamespace(def);
  const dados = `<nfeDadosMsg xmlns="${ns}">${payload}</nfeDadosMsg>`;
  return soap12Envelope(
    def.style === 'operacao' ? `<${def.operation} xmlns="${ns}">${dados}</${def.operation}>` : dados,
  );
}

/** Retorno (`retEnviNFe`...) de dentro do envelope de resposta, como fatia da string. */
export function unwrap(servico: keyof typeof NFE_SERVICES, envelopeText: string): string {
  const body = soapBody(envelopeText);
  const doc = lerXml(body);
  const holder = NFE_SERVICES[servico].style === 'operacao' ? elementosFilhos(doc.raiz)[0] : doc.raiz;
  const el = holder && elementosFilhos(holder)[0];
  if (!el) throw new Error(`resposta inesperada: ${body}`);
  return body.slice(el.inicio, el.fim);
}

/** Texto de um elemento pelo nome local (primeira ocorrência). */
export function tag(xml: string, name: string): string | undefined {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`).exec(xml);
  return m?.[1];
}

export function tags(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`, 'g'))].map((m) => m[1] as string);
}

export interface NfeParams {
  readonly nNF?: number;
  readonly serie?: number;
  readonly cNF?: string;
  readonly dhEmi?: string;
  readonly tpEmis?: string;
  readonly tpAmb?: string;
  readonly cUF?: string;
  readonly mod?: '55' | '65';
  readonly emitente?: string;
  readonly ie?: string;
  readonly destinatario?: string;
  readonly autXML?: readonly string[];
  readonly transportador?: string;
  readonly signer?: SyntheticCertificate;
  /** Estraga a chave: o Id não corresponde aos campos (502). */
  readonly idErrado?: boolean;
  readonly vNF?: string;
  /** Trocas de texto no `infNFe` antes de assinar (`['<tpImp>4</tpImp>', '<tpImp>1</tpImp>']`). */
  readonly trocas?: readonly (readonly [string, string])[];
  /** Só NFC-e: o texto do `qrCode`; `null` monta a NFC-e sem `infNFeSupl`. Padrão: versão 3 on-line. */
  readonly qrCode?: string | null;
}

export interface Nfe {
  readonly chave: string;
  readonly xml: string;
}

/** Assinatura RSA-SHA1 em Base64 dos parâmetros do QR Code versão 3 off-line (Manual do DANFE NFC-e 6.0, 4.4.2). */
export async function assinarQrCode(params: string, signer: Assinador): Promise<string> {
  const bytes = new TextEncoder().encode(params);
  if (signer.tipo !== 'dados') throw new Error('signer de teste sem modo data');
  return codificarBase64(await signer.assinar(bytes, 'SHA-1'));
}

/** NF-e do PL_010f assinada (modelo da fixture sintética do `@sinete/schemas`). */
export async function nfe(p: NfeParams = {}): Promise<Nfe> {
  const c = await certs();
  const cUF = p.cUF ?? '35';
  const dhEmi = p.dhEmi ?? INICIO;
  const nNF = p.nNF ?? 1;
  const serie = p.serie ?? 1;
  const cNF = p.cNF ?? '12345678';
  const tpEmis = p.tpEmis ?? '1';
  const mod = p.mod ?? '55';
  const emit = p.emitente ?? EMITENTE;
  const aamm = `${dhEmi.slice(2, 4)}${dhEmi.slice(5, 7)}`;
  const chave = montarChaveAcesso({ cUF, aamm, emitente: emit, mod, serie, nNF, tpEmis, cNF });
  const id = p.idErrado ? `NFe${chave.slice(0, 43)}${(Number(chave[43]) + 1) % 10}` : `NFe${chave}`;
  const vNF = p.vNF ?? '10.00';
  const dest = p.destinatario ?? DESTINATARIO;
  const autXML = (p.autXML ?? []).map((d) => `<autXML><CNPJ>${d}</CNPJ></autXML>`).join('');
  const transp =
    p.transportador === undefined
      ? '<transp><modFrete>9</modFrete></transp>'
      : `<transp><modFrete>0</modFrete><transporta><CNPJ>${p.transportador}</CNPJ></transporta></transp>`;
  const inf =
    `<infNFe Id="${id}" versao="4.00"><ide><cUF>${cUF}</cUF><cNF>${cNF}</cNF><natOp>VENDA SINTETICA</natOp>` +
    `<mod>${mod}</mod><serie>${serie}</serie><nNF>${nNF}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>1</idDest>` +
    `<cMunFG>3550308</cMunFG><tpImp>${mod === '65' ? '4' : '1'}</tpImp><tpEmis>${tpEmis}</tpEmis><cDV>${chave[43]}</cDV><tpAmb>${p.tpAmb ?? '2'}</tpAmb>` +
    '<finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>sinete-teste</verProc></ide>' +
    `<emit><CNPJ>${emit}</CNPJ><xNome>EMPRESA SINTETICA DE TESTE LTDA</xNome><enderEmit><xLgr>RUA DE TESTE</xLgr>` +
    '<nro>100</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01001000</CEP>' +
    `</enderEmit><IE>${p.ie ?? IE_EMITENTE}</IE><CRT>1</CRT></emit>` +
    `<dest><CNPJ>${dest}</CNPJ><xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome>` +
    `<indIEDest>9</indIEDest></dest>${autXML}` +
    '<det nItem="1"><prod><cProd>SKU1</cProd><cEAN>SEM GTIN</cEAN><xProd>PRODUTO SINTETICO</xProd><NCM>84713012</NCM>' +
    `<CFOP>5102</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>${vNF}</vUnCom><vProd>${vNF}</vProd>` +
    `<cEANTrib>SEM GTIN</cEANTrib><uTrib>UN</uTrib><qTrib>1.0000</qTrib><vUnTrib>${vNF}</vUnTrib><indTot>1</indTot></prod>` +
    '<imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS><PIS><PISNT><CST>07</CST></PISNT></PIS>' +
    '<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det><total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS>' +
    '<vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST>' +
    `<vFCPSTRet>0.00</vFCPSTRet><vProd>${vNF}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII>` +
    '<vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro>' +
    `<vNF>${vNF}</vNF></ICMSTot></total>${transp}<pag><detPag><tPag>01</tPag><vPag>${vNF}</vPag></detPag></pag></infNFe>`;
  // NFC-e: QR Code versão 3 (Manual do DANFE NFC-e 6.0, 4.4): on-line só com chave, versão e ambiente; off-line com
  // dia, valor, destinatário e a assinatura dos parâmetros pelo certificado da nota. Ou o informado.
  const signer = (p.signer ?? c.emitente).signer;
  let qrCode = p.qrCode;
  if (mod === '65' && qrCode === undefined) {
    const base = `${chave}|3|${p.tpAmb ?? '2'}`;
    const params = tpEmis === '9' ? `${base}|${dhEmi.slice(8, 10)}|${vNF}|1|${dest}` : base;
    const assinatura = tpEmis === '9' ? `|${await assinarQrCode(params, signer)}` : '';
    qrCode = `https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=${params}${assinatura}`;
  }
  const supl =
    mod === '65' && qrCode !== null && qrCode !== undefined
      ? `<infNFeSupl><qrCode>${qrCode}</qrCode>` +
        '<urlChave>https://www.homologacao.nfce.fazenda.sp.gov.br/consulta</urlChave></infNFeSupl>'
      : '';
  const infFinal = (p.trocas ?? []).reduce((t, [de, para]) => t.replace(de, para), inf);
  const xml = await assinarXml(`<NFe xmlns="${NFE_NS}">${infFinal}${supl}</NFe>`, { id }, signer);
  return { chave, xml };
}

export function enviNFe(nfes: readonly string[], indSinc: '0' | '1' = '1', idLote = '1'): string {
  return `<enviNFe versao="4.00" xmlns="${NFE_NS}"><idLote>${idLote}</idLote><indSinc>${indSinc}</indSinc>${nfes.join('')}</enviNFe>`;
}

export function consReciNFe(nRec: string, tpAmb = '2'): string {
  return `<consReciNFe versao="4.00" xmlns="${NFE_NS}"><tpAmb>${tpAmb}</tpAmb><nRec>${nRec}</nRec></consReciNFe>`;
}

export function consSitNFe(chave: string, tpAmb = '2'): string {
  return `<consSitNFe versao="4.00" xmlns="${NFE_NS}"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>`;
}

export function consStatServ(cUF = '35', tpAmb = '2'): string {
  return `<consStatServ versao="4.00" xmlns="${NFE_NS}"><tpAmb>${tpAmb}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ>`;
}

export const X_COND_USO: string = (
  ((cce.TEvento_infEvento_detEvento.c as GroupParticle).i[2] as ElementParticle).t as SimpleType
).e?.[1] as string;

export interface EventoParams {
  readonly chave: string;
  readonly tpEvento: string;
  readonly nSeq?: number;
  readonly autor?: string;
  readonly cOrgao?: string;
  readonly dhEvento?: string;
  readonly tpAmb?: string;
  /** Conteúdo do detEvento (sem o elemento). */
  readonly det: string;
  readonly signer?: SyntheticCertificate;
  readonly id?: string;
}

/** Um `evento` assinado. */
export async function evento(p: EventoParams): Promise<string> {
  const c = await certs();
  const seq = p.nSeq ?? 1;
  const id = p.id ?? `ID${p.tpEvento}${p.chave}${String(seq).padStart(2, '0')}`;
  const manifestacao = p.tpEvento.startsWith('2102');
  const cOrgao = p.cOrgao ?? (manifestacao ? '91' : p.chave.slice(0, 2));
  const autor = p.autor ?? (manifestacao ? DESTINATARIO : EMITENTE);
  const signer = p.signer ?? (manifestacao ? c.destinatario : c.emitente);
  const xml =
    `<evento versao="1.00" xmlns="${NFE_NS}"><infEvento Id="${id}"><cOrgao>${cOrgao}</cOrgao><tpAmb>${p.tpAmb ?? '2'}</tpAmb>` +
    `<CNPJ>${autor}</CNPJ><chNFe>${p.chave}</chNFe><dhEvento>${p.dhEvento ?? INICIO}</dhEvento>` +
    `<tpEvento>${p.tpEvento}</tpEvento><nSeqEvento>${seq}</nSeqEvento><verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00">${p.det}</detEvento></infEvento></evento>`;
  return assinarXml(xml, { id }, signer.signer);
}

export function envEvento(eventos: readonly string[], idLote = '1'): string {
  return `<envEvento versao="1.00" xmlns="${NFE_NS}"><idLote>${idLote}</idLote>${eventos.join('')}</envEvento>`;
}

export const det = {
  cancelamento: (nProt: string, xJust = 'CANCELAMENTO DE TESTE SINTETICO'): string =>
    `<descEvento>Cancelamento</descEvento><nProt>${nProt}</nProt><xJust>${xJust}</xJust>`,
  substituicao: (nProt: string, chNFeRef: string, cOrgaoAutor = '35', tpAutor = '1'): string =>
    `<descEvento>Cancelamento por substituicao</descEvento><cOrgaoAutor>${cOrgaoAutor}</cOrgaoAutor><tpAutor>${tpAutor}</tpAutor>` +
    `<verAplic>TESTE</verAplic><nProt>${nProt}</nProt><xJust>CANCELAMENTO POR SUBSTITUICAO</xJust><chNFeRef>${chNFeRef}</chNFeRef>`,
  cce: (xCorrecao = 'CORRECAO DO ENDERECO DE ENTREGA'): string =>
    `<descEvento>Carta de Correcao</descEvento><xCorrecao>${xCorrecao}</xCorrecao><xCondUso>${X_COND_USO}</xCondUso>`,
  ciencia: (): string => '<descEvento>Ciencia da Operacao</descEvento>',
  confirmacao: (): string => '<descEvento>Confirmacao da Operacao</descEvento>',
  desconhecimento: (): string => '<descEvento>Desconhecimento da Operacao</descEvento>',
  naoRealizada: (): string =>
    '<descEvento>Operacao nao Realizada</descEvento><xJust>MERCADORIA RECUSADA NA ENTREGA</xJust>',
};

export interface InutParams {
  readonly ini: number;
  readonly fin: number;
  readonly serie?: number;
  readonly ano?: string;
  readonly cnpj?: string;
  readonly signer?: SyntheticCertificate;
  readonly idErrado?: boolean;
  readonly cUF?: string;
}

export async function inutNFe(p: InutParams): Promise<string> {
  const c = await certs();
  const ano = p.ano ?? '26';
  const serie = p.serie ?? 1;
  const doc = p.cnpj ?? EMITENTE;
  const id =
    `ID${p.cUF ?? '35'}${ano}${doc}55${String(serie).padStart(3, '0')}${String(p.ini).padStart(9, '0')}` +
    `${String(p.fin).padStart(9, '0')}`;
  const idUsado = p.idErrado ? `${id.slice(0, -1)}${(Number(id.at(-1)) + 1) % 10}` : id;
  const xml =
    `<inutNFe versao="4.00" xmlns="${NFE_NS}"><infInut Id="${idUsado}"><tpAmb>2</tpAmb><xServ>INUTILIZAR</xServ>` +
    `<cUF>${p.cUF ?? '35'}</cUF><ano>${ano}</ano><CNPJ>${doc}</CNPJ><mod>55</mod><serie>${serie}</serie><nNFIni>${p.ini}</nNFIni>` +
    `<nNFFin>${p.fin}</nNFFin><xJust>NUMERACAO PULADA POR FALHA NO SISTEMA</xJust></infInut></inutNFe>`;
  return assinarXml(xml, { id: idUsado }, (p.signer ?? c.emitente).signer);
}

export function consCad(campo: 'CNPJ' | 'IE' | 'CPF', valor: string, uf = 'SP'): string {
  return `<ConsCad versao="2.00" xmlns="${NFE_NS}"><infCons><xServ>CONS-CAD</xServ><UF>${uf}</UF><${campo}>${valor}</${campo}></infCons></ConsCad>`;
}

export function distDFe(interessado: string, consulta: string, tpAmb = '2'): string {
  return `<distDFeInt versao="1.01" xmlns="${NFE_NS}"><tpAmb>${tpAmb}</tpAmb><cUFAutor>35</cUFAutor><CNPJ>${interessado}</CNPJ>${consulta}</distDFeInt>`;
}

export const distNSU = (ult: number): string => `<distNSU><ultNSU>${String(ult).padStart(15, '0')}</ultNSU></distNSU>`;
export const consNSU = (n: number): string => `<consNSU><NSU>${String(n).padStart(15, '0')}</NSU></consNSU>`;
export const consChNFe = (chave: string): string => `<consChNFe><chNFe>${chave}</chNFe></consChNFe>`;

/** Documentos de um `retDistDFeInt`: NSU, schema e o XML descompactado. */
export async function docZips(ret: string): Promise<{ nsu: string; schema: string; xml: string }[]> {
  const out: { nsu: string; schema: string; xml: string }[] = [];
  for (const m of ret.matchAll(/<docZip NSU="(\d+)" schema="([^"]+)">([^<]+)<\/docZip>/g)) {
    const bytes = decodificarBase64(m[3] as string);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    out.push({ nsu: m[1] as string, schema: m[2] as string, xml: await new Response(stream).text() });
  }
  return out;
}
