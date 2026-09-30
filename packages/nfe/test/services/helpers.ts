/**
 * Dublês dos serviços: transporte falso que grava as requisições e devolve envelopes SOAP 1.2 sintéticos, chaves de
 * acesso com DV válido sobre CNPJ/CPF sintéticos e NF-e mínima assinada com chave WebCrypto gerada no teste.
 */
import type { Assinador } from '@sinete/core';
import { loggerEmMemoria, relogioFixo } from '@sinete/core';
import { assinarXml } from '@sinete/core/xml';
import type { PedidoTransporte, RespostaTransporte, Transporte } from '@sinete/transport';
import { montarChaveAcesso } from '@sinete/validators';
import type { ClienteNfe, ClienteNfeOpcoes } from '../../src/services/index.ts';
import { criarClienteNfe } from '../../src/services/index.ts';
import { generateTestKeys } from '../helpers/test-keys.ts';

export const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
export const SOAP12 = 'http://www.w3.org/2003/05/soap-envelope';

/** CNPJ e CPF sintéticos com DV válido. */
export const CNPJ_EMIT = '11222333000181';
export const CNPJ_DEST = '11444777000161';
export const CPF_EMIT = '12345678909';

export function chave(
  over: {
    cUF?: string;
    emitente?: string;
    mod?: string;
    serie?: number;
    nNF?: number;
    cNF?: string;
    tpEmis?: string;
  } = {},
): string {
  return montarChaveAcesso({
    cUF: over.cUF ?? '35',
    aamm: '2609',
    emitente: over.emitente ?? CNPJ_EMIT,
    mod: over.mod ?? '55',
    serie: over.serie ?? 1,
    nNF: over.nNF ?? 123,
    tpEmis: over.tpEmis ?? '1',
    cNF: over.cNF ?? '12345678',
  });
}

let signerPromise: Promise<Assinador> | undefined;
export function testSigner(): Promise<Assinador> {
  signerPromise ??= generateTestKeys().then((k) => k.dataSigner);
  return signerPromise;
}

/** NF-e mínima (só o que o cliente lê: raiz, Id e assinatura), assinada. */
export async function nfeAssinada(ch: string = chave()): Promise<string> {
  const xml = `<NFe xmlns="${NFE_NS}"><infNFe Id="NFe${ch}" versao="4.00"><ide><cUF>${ch.slice(0, 2)}</cUF><cNF>${ch.slice(35, 43)}</cNF><natOp>VENDA &amp; TESTE</natOp></ide></infNFe></NFe>`;
  return assinarXml(xml, { id: `NFe${ch}` }, await testSigner());
}

export function digestOf(signed: string): string {
  const m = /<DigestValue>([^<]+)<\/DigestValue>/.exec(signed);
  if (!m?.[1]) throw new Error('sem DigestValue');
  return m[1];
}

export interface Gravada {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly timeoutMs?: number;
}

export type Resposta = string | { readonly status?: number; readonly body: string } | ((r: Gravada) => string);

export interface FakeTransport extends Transporte {
  readonly requests: Gravada[];
  push(...r: Resposta[]): void;
}

export function fakeTransport(...inicial: Resposta[]): FakeTransport {
  const fila: Resposta[] = [...inicial];
  const requests: Gravada[] = [];
  const te = new TextEncoder();
  return {
    capacidades: {
      runtime: 'personalizada',
      renegociacao: true,
      tls12Cbc: true,
      tls12Dhe: true,
      controleDeSigalgs: false,
      conferenciaDoCertificadoLocal: false,
    },
    requests,
    push(...r) {
      fila.push(...r);
    },
    async enviar(req: PedidoTransporte): Promise<RespostaTransporte> {
      const body = typeof req.corpo === 'string' ? req.corpo : new TextDecoder().decode(req.corpo ?? new Uint8Array());
      const g: Gravada = {
        url: req.url,
        headers: req.cabecalhos ?? {},
        body,
        ...(req.timeoutMs === undefined ? {} : { timeoutMs: req.timeoutMs }),
      };
      requests.push(g);
      const next = fila.shift();
      if (next === undefined) throw new Error(`sem resposta enfileirada para ${req.url}`);
      const r = typeof next === 'function' ? { body: next(g) } : typeof next === 'string' ? { body: next } : next;
      const bytes = te.encode(r.body);
      return {
        status: r.status ?? 200,
        cabecalhos: { 'content-type': 'application/soap+xml; charset=utf-8' },
        corpo: bytes,
        tls: { protocolo: 'TLSv1.2', cifra: undefined, retomada: false, certificadoLocalCarregado: undefined },
        texto: () => r.body,
      };
    },
    async fechar() {},
  };
}

/** Envelope SOAP 1.2 de resposta, com o `nfeResultMsg` do WSDL do serviço. */
export function soap(inner: string, wsdl = 'NFeAutorizacao4'): string {
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="${SOAP12}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${wsdl}">${inner}</nfeResultMsg></soap:Body></soap:Envelope>`;
}

export function protNFe(p: {
  chNFe: string;
  cStat?: string;
  xMotivo?: string;
  digVal?: string;
  nProt?: string;
}): string {
  const cStat = p.cStat ?? '100';
  return (
    `<protNFe versao="4.00"><infProt Id="ID135260000000001"><tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic>` +
    `<chNFe>${p.chNFe}</chNFe><dhRecbto>2026-09-10T09:00:01-03:00</dhRecbto>` +
    `${p.nProt === '' ? '' : `<nProt>${p.nProt ?? '135260000000001'}</nProt>`}` +
    `${p.digVal === undefined ? '' : `<digVal>${p.digVal}</digVal>`}` +
    `<cStat>${cStat}</cStat><xMotivo>${p.xMotivo ?? 'Autorizado o uso da NF-e'}</xMotivo></infProt></protNFe>`
  );
}

export function retEnviNFe(p: { cStat: string; xMotivo?: string; inner?: string }): string {
  return (
    `<retEnviNFe xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic>` +
    `<cStat>${p.cStat}</cStat><xMotivo>${p.xMotivo ?? 'Lote processado'}</xMotivo><cUF>35</cUF>` +
    `<dhRecbto>2026-09-10T09:00:00-03:00</dhRecbto>${p.inner ?? ''}</retEnviNFe>`
  );
}

export function retConsReciNFe(p: { cStat: string; xMotivo?: string; inner?: string; nRec?: string }): string {
  return (
    `<retConsReciNFe xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic>` +
    `<nRec>${p.nRec ?? '351000000000001'}</nRec><cStat>${p.cStat}</cStat><xMotivo>${p.xMotivo ?? 'Lote processado'}</xMotivo>` +
    `<cUF>35</cUF><dhRecbto>2026-09-10T09:00:00-03:00</dhRecbto>${p.inner ?? ''}</retConsReciNFe>`
  );
}

export function retConsSitNFe(p: { cStat: string; xMotivo?: string; chNFe: string; inner?: string }): string {
  return (
    `<retConsSitNFe xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic>` +
    `<cStat>${p.cStat}</cStat><xMotivo>${p.xMotivo ?? 'Autorizado o uso da NF-e'}</xMotivo><cUF>35</cUF>` +
    `<dhRecbto>2026-09-10T09:00:00-03:00</dhRecbto><chNFe>${p.chNFe}</chNFe>${p.inner ?? ''}</retConsSitNFe>`
  );
}

export function retEnvEvento(p: {
  cStat?: string;
  xMotivo?: string;
  evento?: { cStat: string; xMotivo?: string; tpEvento: string; chNFe: string; nSeqEvento?: string; nProt?: string };
}): string {
  const e = p.evento;
  const ret = e
    ? `<retEvento versao="1.00"><infEvento><tpAmb>2</tpAmb><verAplic>SVRS202609</verAplic><cOrgao>35</cOrgao>` +
      `<cStat>${e.cStat}</cStat><xMotivo>${e.xMotivo ?? 'Evento registrado e vinculado a NF-e'}</xMotivo>` +
      `<chNFe>${e.chNFe}</chNFe><tpEvento>${e.tpEvento}</tpEvento><nSeqEvento>${e.nSeqEvento ?? '1'}</nSeqEvento>` +
      `<dhRegEvento>2026-09-10T10:00:00-03:00</dhRegEvento>${e.nProt === '' ? '' : `<nProt>${e.nProt ?? '135260000000002'}</nProt>`}</infEvento></retEvento>`
    : '';
  return (
    `<retEnvEvento xmlns="${NFE_NS}" versao="1.00"><idLote>1</idLote><tpAmb>2</tpAmb><verAplic>SVRS202609</verAplic>` +
    `<cOrgao>35</cOrgao><cStat>${p.cStat ?? '128'}</cStat><xMotivo>${p.xMotivo ?? 'Lote de Evento Processado'}</xMotivo>${ret}</retEnvEvento>`
  );
}

export const CLOCK_ISO = '2026-09-10T12:00:00Z';

export function client(
  transport: Transporte,
  over: Partial<ClienteNfeOpcoes> = {},
): Promise<{ c: ClienteNfe; logger: ReturnType<typeof loggerEmMemoria>; sleeps: number[] }> {
  return testSigner().then((signer) => {
    const logger = loggerEmMemoria();
    const sleeps: number[] = [];
    const c = criarClienteNfe({
      transporte: transport,
      assinador: signer,
      ambiente: 'homologacao',
      uf: 'SP',
      relogio: relogioFixo(CLOCK_ISO),
      logger,
      esperar: async (ms) => {
        sleeps.push(ms);
      },
      idLote: () => '42',
      ...over,
    });
    return { c, logger, sleeps };
  });
}

/** Corpo `nfeDadosMsg` enviado (o que está entre as tags do WSDL). */
export function mensagem(g: Gravada): string {
  const m = /<nfeDadosMsg[^>]*>([\s\S]*)<\/nfeDadosMsg>/.exec(g.body);
  if (!m?.[1]) throw new Error('sem nfeDadosMsg');
  return m[1];
}

export async function comprimirGzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Transporte que nunca responde: a requisição fica em curso até o `signal` dela abortar e então rejeita com o motivo,
 * como o `fetch`. Sem `signal` rejeita na hora, o que acusa o método que não repassou o sinal. `enviou` resolve quando a
 * requisição chega ao transporte.
 */
export interface TransportePendente extends Transporte {
  readonly sinais: AbortSignal[];
  readonly enviou: Promise<void>;
}

export function transportePendente(): TransportePendente {
  const base = fakeTransport();
  const sinais: AbortSignal[] = [];
  let avisar: () => void = () => {};
  const enviou = new Promise<void>((r) => {
    avisar = r;
  });
  return {
    ...base,
    sinais,
    enviou,
    enviar(req: PedidoTransporte): Promise<RespostaTransporte> {
      avisar();
      const signal = req.signal;
      if (signal === undefined) return Promise.reject(new Error('requisição sem signal'));
      sinais.push(signal);
      return new Promise((_, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
  };
}
