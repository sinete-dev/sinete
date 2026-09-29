/**
 * MDF-e sintéticos para falar com o simulador sem o `@sinete/mdfe` (que depende deste pacote): o XML do leiaute 3.00b
 * montado à mão, válido no schema, com a chave, o QR Code e a assinatura. Nenhum dado real.
 */

import { expect } from 'bun:test';
import { base64Encode, childElements, parseXml, signXml } from '@sinete/core/xml';
import type { RootElement } from '@sinete/schemas';
import { validateRoot } from '@sinete/schemas';
import * as m300 from '@sinete/schemas/mdfe/3.00b';
import * as ev from '@sinete/schemas/mdfe/eventos/3.00b';
import * as serv from '@sinete/schemas/mdfe/servicos/3.00b';
import { soap12ContentType, soap12Envelope, soapBody } from '@sinete/transport';
import { buildChaveAcesso } from '@sinete/validators';
import type { MdfeServicoSim, SyntheticCertificate } from '../src/index.ts';
import { MDFE_NS, MDFE_SERVICES, SIM_BASE_URL, simTransport, soapAction, wsdlNamespace } from '../src/index.ts';
import type { Harness } from './helpers.ts';
import { CPF, EMITENTE } from './helpers.ts';

export const RET_MDFE: Readonly<Record<MdfeServicoSim, RootElement<unknown>>> = {
  MDFeRecepcaoSinc: m300.retMDFeElement,
  MDFeConsulta: serv.retConsSitMDFeElement,
  MDFeConsNaoEnc: serv.retConsMDFeNaoEncElement,
  MDFeStatusServico: serv.retConsStatServMDFeElement,
  MDFeRecepcaoEvento: ev.retEventoMDFeElement,
};

export async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'));
  return base64Encode(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/** Envelope do pedido do MDF-e; a recepção vai compactada. */
export async function envelopeMdfe(servico: MdfeServicoSim, payload: string): Promise<string> {
  const def = MDFE_SERVICES[servico];
  const dados = def.compactado === true ? await gzipBase64(payload) : payload;
  return soap12Envelope(`<mdfeDadosMsg xmlns="${wsdlNamespace(def)}">${dados}</mdfeDadosMsg>`);
}

/** Envia pelo transporte em processo e devolve o retorno conferido contra o schema oficial. */
export async function sendMdfe(
  h: Harness,
  servico: MdfeServicoSim,
  payload: string,
  canal: SyntheticCertificate = h.c.ecpf,
  bruto = false,
): Promise<string> {
  const transport = simTransport(h.sim, { clientCertificate: canal.der });
  const res = await transport.send({
    url: h.sim.url(SIM_BASE_URL, servico),
    headers: { 'content-type': soap12ContentType(soapAction(MDFE_SERVICES[servico])) },
    body: bruto
      ? soap12Envelope(`<mdfeDadosMsg xmlns="${wsdlNamespace(MDFE_SERVICES[servico])}">${payload}</mdfeDadosMsg>`)
      : await envelopeMdfe(servico, payload),
  });
  const body = soapBody(res.text());
  const holder = parseXml(body).root;
  expect(holder.local).toBe(`${MDFE_SERVICES[servico].operation}Result`);
  const el = childElements(holder)[0];
  if (!el) throw new Error(`resposta inesperada: ${body}`);
  const ret = body.slice(el.start, el.end);
  expect(validateRoot(RET_MDFE[servico], ret)).toEqual([]);
  return ret;
}

export interface MdfeParams {
  readonly emitente?: { readonly CPF: string } | { readonly CNPJ: string };
  readonly serie?: number;
  readonly nMDF?: number;
  readonly cMDF?: string;
  readonly tpEmit?: '1' | '2' | '3';
  readonly tpEmis?: '1' | '2';
  readonly tpAmb?: '1' | '2';
  readonly dhEmi?: string;
  readonly ufIni?: string;
  readonly ufFim?: string;
  readonly cMunCarrega?: string;
  readonly cMunDescarga?: string;
  readonly percurso?: readonly string[];
  readonly placa?: string;
  readonly carregaPosterior?: boolean;
  /** `false` sem QR Code; texto para trocar a URL inteira. */
  readonly qr?: false | string;
  /** Troca o DV (para a regra F05). */
  readonly cDV?: string;
  readonly tpProp?: '0' | '1' | '2';
  /** CNPJ do proprietário do veículo de tração no lugar do CPF do TAC (com `tpProp`). */
  readonly propCnpj?: string;
  /** CPF do proprietário do veículo de tração (com `tpProp`); padrão o de um TAC sintético. */
  readonly propCpf?: string;
  /** AAMM da chave da NF-e transportada (F37a). */
  readonly aammNFe?: string;
  /** `tpRod` do veículo de tração; padrão 01 (truck). */
  readonly tpRod?: string;
}

export interface Mdfe {
  readonly chave: string;
  readonly xml: string;
}

/** MDF-e rodoviário de carga própria, de MT para SP pelo MS, assinado pelo certificado dado. */
export async function mdfe(signer: SyntheticCertificate, p: MdfeParams = {}): Promise<Mdfe> {
  const emit = p.emitente ?? { CPF };
  const serie = p.serie ?? ('CPF' in emit ? 920 : 1);
  const nMDF = p.nMDF ?? 1;
  const cMDF = p.cMDF ?? '12345678';
  const tpEmis = p.tpEmis ?? '1';
  const tpAmb = p.tpAmb ?? '2';
  const dhEmi = p.dhEmi ?? '2026-09-26T09:00:00-04:00';
  const doc = 'CPF' in emit ? emit.CPF : emit.CNPJ;
  let chave = buildChaveAcesso({
    cUF: '51',
    aamm: `${dhEmi.slice(2, 4)}${dhEmi.slice(5, 7)}`,
    emitente: doc,
    mod: '58',
    serie,
    nNF: nMDF,
    tpEmis,
    cNF: cMDF,
  });
  if (p.cDV !== undefined) chave = chave.slice(0, 43) + p.cDV;
  const ufIni = p.ufIni ?? 'MT';
  const ufFim = p.ufFim ?? 'SP';
  const percurso = (p.percurso ?? (ufIni === 'MT' && ufFim === 'SP' ? ['MS'] : []))
    .map((u) => `<infPercurso><UFPer>${u}</UFPer></infPercurso>`)
    .join('');
  const docTag = 'CPF' in emit ? `<CPF>${emit.CPF}</CPF>` : `<CNPJ>${emit.CNPJ}</CNPJ>`;
  const chNFe = buildChaveAcesso({
    cUF: '51',
    aamm: p.aammNFe ?? '2609',
    emitente: EMITENTE,
    mod: '55',
    serie: 1,
    nNF: nMDF,
    tpEmis: '1',
    cNF: '11111111',
  });
  const prop =
    p.tpProp === undefined
      ? ''
      : `<prop>${p.propCnpj === undefined ? `<CPF>${p.propCpf ?? '52998224725'}</CPF>` : `<CNPJ>${p.propCnpj}</CNPJ>`}<RNTRC>87654321</RNTRC><xNome>TAC SINTETICO</xNome><tpProp>${p.tpProp}</tpProp></prop>`;
  const inf =
    `<infMDFe versao="3.00" Id="MDFe${chave}"><ide><cUF>51</cUF><tpAmb>${tpAmb}</tpAmb><tpEmit>${p.tpEmit ?? '2'}</tpEmit>` +
    `${p.tpProp === undefined ? '' : '<tpTransp>2</tpTransp>'}<mod>58</mod><serie>${serie}</serie><nMDF>${nMDF}</nMDF>` +
    `<cMDF>${cMDF}</cMDF><cDV>${chave.slice(43)}</cDV><modal>1</modal><dhEmi>${dhEmi}</dhEmi><tpEmis>${tpEmis}</tpEmis>` +
    `<procEmi>0</procEmi><verProc>teste</verProc><UFIni>${ufIni}</UFIni><UFFim>${ufFim}</UFFim>` +
    `<infMunCarrega><cMunCarrega>${p.cMunCarrega ?? '5103403'}</cMunCarrega><xMunCarrega>CUIABA</xMunCarrega></infMunCarrega>` +
    `${percurso}${p.carregaPosterior ? '<indCarregaPosterior>1</indCarregaPosterior>' : ''}</ide>` +
    `<emit>${docTag}<IE>00130000019</IE><xNome>EMITENTE SINTETICO</xNome><enderEmit><xLgr>RUA A</xLgr><nro>1</nro>` +
    '<xBairro>CENTRO</xBairro><cMun>5103403</cMun><xMun>CUIABA</xMun><UF>MT</UF></enderEmit></emit>' +
    `<infModal versaoModal="3.00"><rodo><veicTracao><placa>${p.placa ?? 'ABC1D23'}</placa><tara>10000</tara>${prop}` +
    `<condutor><xNome>CONDUTOR SINTETICO</xNome><CPF>52998224725</CPF></condutor><tpRod>${p.tpRod ?? '01'}</tpRod><tpCar>03</tpCar>` +
    '</veicTracao></rodo></infModal>' +
    `<infDoc><infMunDescarga><cMunDescarga>${p.cMunDescarga ?? '3550308'}</cMunDescarga><xMunDescarga>DESTINO</xMunDescarga>` +
    `${p.carregaPosterior ? '' : `<infNFe><chNFe>${chNFe}</chNFe></infNFe>`}</infMunDescarga></infDoc>` +
    `<tot>${p.carregaPosterior ? '' : '<qNFe>1</qNFe>'}<vCarga>1000.00</vCarga><cUnid>01</cUnid><qCarga>100.0000</qCarga></tot></infMDFe>`;
  let qr = p.qr === undefined ? `https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${chave}&tpAmb=${tpAmb}` : p.qr;
  if (qr !== false && tpEmis === '2' && p.qr === undefined) qr = `${qr}&sign=QUJD`;
  const supl = qr === false ? '' : `<infMDFeSupl><qrCodMDFe>${qr.replace(/&/g, '&amp;')}</qrCodMDFe></infMDFeSupl>`;
  const xml = await signXml(`<MDFe xmlns="${MDFE_NS}">${inf}${supl}</MDFe>`, { id: `MDFe${chave}` }, signer.signer);
  return { chave, xml };
}

export function consSit(chave: string, tpAmb = '2'): string {
  return `<consSitMDFe xmlns="${MDFE_NS}" versao="3.00"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chMDFe>${chave}</chMDFe></consSitMDFe>`;
}

export function consNaoEnc(doc: string, tipo: 'CPF' | 'CNPJ' = 'CPF'): string {
  return `<consMDFeNaoEnc xmlns="${MDFE_NS}" versao="3.00"><tpAmb>2</tpAmb><xServ>CONSULTAR NÃO ENCERRADOS</xServ><${tipo}>${doc}</${tipo}></consMDFeNaoEnc>`;
}

export function consStat(tpAmb = '2'): string {
  return `<consStatServMDFe xmlns="${MDFE_NS}" versao="3.00"><tpAmb>${tpAmb}</tpAmb><xServ>STATUS</xServ></consStatServMDFe>`;
}

export interface EventoMdfeParams {
  readonly chave: string;
  readonly tpEvento: string;
  readonly det: string;
  readonly nSeq?: number;
  readonly dhEvento?: string;
  readonly autor?: string;
  readonly id?: string;
}

export async function eventoMdfe(signer: SyntheticCertificate, p: EventoMdfeParams): Promise<string> {
  const nSeq = p.nSeq ?? 1;
  const id = p.id ?? `ID${p.tpEvento}${p.chave}${String(nSeq).padStart(2, '0')}`;
  const autor = p.autor ?? `<CPF>${CPF}</CPF>`;
  const xml =
    `<eventoMDFe xmlns="${MDFE_NS}" versao="3.00"><infEvento Id="${id}"><cOrgao>51</cOrgao><tpAmb>2</tpAmb>${autor}` +
    `<chMDFe>${p.chave}</chMDFe><dhEvento>${p.dhEvento ?? '2026-09-26T10:02:00-03:00'}</dhEvento><tpEvento>${p.tpEvento}</tpEvento>` +
    `<nSeqEvento>${nSeq}</nSeqEvento><detEvento versaoEvento="3.00">${p.det}</detEvento></infEvento></eventoMDFe>`;
  return signXml(xml, { id }, signer.signer);
}

export const detMdfe = {
  canc: (nProt: string): string =>
    `<evCancMDFe><descEvento>Cancelamento</descEvento><nProt>${nProt}</nProt><xJust>JUSTIFICATIVA DE TESTE</xJust></evCancMDFe>`,
  enc: (nProt: string, dtEnc = '2026-09-26', cUF = '35', cMun = '3550308'): string =>
    `<evEncMDFe><descEvento>Encerramento</descEvento><nProt>${nProt}</nProt><dtEnc>${dtEnc}</dtEnc><cUF>${cUF}</cUF><cMun>${cMun}</cMun></evEncMDFe>`,
  condutor: (cpf = '52998224725'): string =>
    `<evIncCondutorMDFe><descEvento>Inclusao Condutor</descEvento><condutor><xNome>NOVO CONDUTOR</xNome><CPF>${cpf}</CPF></condutor></evIncCondutorMDFe>`,
};
