/**
 * Bordas do protocolo: GZip da área de dados, respostas SOAP defeituosas (fault, corpo que não é XML, retorno ausente
 * ou sem cStat) e documentos assinados recusados antes de montar o `mdfeProc`.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import type { DataSigner } from '@sinete/core';
import { ConfigError, fixedClock, ProtocolError } from '@sinete/core';
import { base64Encode, firstChild, parseXml } from '@sinete/core/xml';
import { syntheticCertificate } from '@sinete/sefaz-sim';
import type { Transport, TransportResponse } from '@sinete/transport';
import { buildChaveAcesso } from '@sinete/validators';
import { createMdfeClient, documentoAssinado, gunzipBase64, gzipBase64, MDFE_NS, sliceElement } from '../src/index.ts';
import { EMISSAO } from './helpers/mdfe.ts';

const SOAP12 = 'http://www.w3.org/2003/05/soap-envelope';

let signer: DataSigner;
beforeAll(async () => {
  const clock = fixedClock(EMISSAO);
  const ac = await syntheticCertificate({ clock, role: 'ac' });
  signer = (await syntheticCertificate({ clock, role: 'titular', cnpj: '11222333000181', issuer: ac })).signer;
}, 30_000);

function respondendo(body: string, status = 200): Transport {
  return {
    capabilities: {
      runtime: 'custom',
      renegotiation: true,
      tls12Cbc: true,
      tls12Dhe: true,
      sigalgsControl: false,
      clientCertificateCheck: false,
    },
    async send(): Promise<TransportResponse> {
      return {
        status,
        headers: {},
        body: new TextEncoder().encode(body),
        tls: { protocol: 'TLSv1.2', cipher: undefined, resumed: false, clientCertificateLoaded: undefined },
        text: () => body,
      };
    },
    async close() {},
  };
}

const envelope = (inner: string): string =>
  `<soap:Envelope xmlns:soap="${SOAP12}"><soap:Body><mdfeStatusServicoMDFResult xmlns="${MDFE_NS}/wsdl/MDFeStatusServico">${inner}</mdfeStatusServicoMDFResult></soap:Body></soap:Envelope>`;

const status = (body: string, http = 200): Promise<unknown> =>
  createMdfeClient({ transport: respondendo(body, http), signer, ambiente: 'homologacao', clock: fixedClock(EMISSAO) })
    .statusServico()
    .catch((e: unknown) => e);

describe('gzip da área de dados', () => {
  test('ida e volta, Base64 inválido e bytes que não são GZip viram ProtocolError', async () => {
    expect(await gunzipBase64(await gzipBase64('<MDFe>ação</MDFe>'))).toBe('<MDFe>ação</MDFe>');
    expect(await gunzipBase64('!!!').catch((e: unknown) => e)).toBeInstanceOf(ProtocolError);
    const texto = base64Encode(new TextEncoder().encode('nao e gzip'));
    expect(await gunzipBase64(texto).catch((e: unknown) => e)).toBeInstanceOf(ProtocolError);
    const grande = await gzipBase64('A'.repeat(1024 * 1024));
    expect(((await gunzipBase64(grande, 1000).catch((e: unknown) => e)) as ProtocolError).message).toContain(
      'passa de',
    );
    expect((await gunzipBase64(grande, 2 * 1024 * 1024)).length).toBe(1024 * 1024);
  });
});

describe('respostas SOAP defeituosas', () => {
  test('fault, corpo que não é XML, retorno ausente e retorno sem cStat', async () => {
    const fault = `<soap:Envelope xmlns:soap="${SOAP12}"><soap:Body><soap:Fault><soap:Code><soap:Value>soap:Receiver</soap:Value></soap:Code><soap:Reason><soap:Text xml:lang="pt-BR">falha interna</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>`;
    const f = await status(fault, 500);
    expect(f).toBeInstanceOf(ProtocolError);
    expect((f as ProtocolError).message).toContain('falha interna');
    const html = await status('<html><body>Service Unavailable', 503);
    expect(html).toBeInstanceOf(ProtocolError);
    expect((html as ProtocolError).message).toContain('não é XML');
    expect(((await status(envelope('<outro/>'))) as ProtocolError).message).toContain('sem <retConsStatServMDFe>');
    const semCStat = envelope(
      `<retConsStatServMDFe xmlns="${MDFE_NS}" versao="3.00"><tpAmb>2</tpAmb></retConsStatServMDFe>`,
    );
    expect(((await status(semCStat)) as ProtocolError).message).toContain('sem cStat');
    // cStat fora do lugar do leiaute: não basta existir em algum descendente.
    const aninhado = envelope(
      `<retConsStatServMDFe xmlns="${MDFE_NS}" versao="3.00"><tpAmb>2</tpAmb><x><cStat>107</cStat></x></retConsStatServMDFe>`,
    );
    expect(((await status(aninhado)) as ProtocolError).message).toContain('sem cStat');
  });

  test('retEventoMDFe sem infEvento vira ProtocolError, não TypeError', async () => {
    const chave = buildChaveAcesso({
      cUF: '51',
      aamm: '2609',
      emitente: '11222333000181',
      mod: '58',
      serie: 1,
      nNF: 1,
      tpEmis: '1',
      cNF: '12345678',
    });
    const corpo = `<soap:Envelope xmlns:soap="${SOAP12}"><soap:Body><mdfeRecepcaoEventoResult xmlns="${MDFE_NS}/wsdl/MDFeRecepcaoEvento"><retEventoMDFe xmlns="${MDFE_NS}" versao="3.00"><cStat>135</cStat></retEventoMDFe></mdfeRecepcaoEventoResult></soap:Body></soap:Envelope>`;
    const client = createMdfeClient({
      transport: respondendo(corpo),
      signer,
      ambiente: 'homologacao',
      clock: fixedClock(EMISSAO),
    });
    const e = await client
      .cancelar({ chave, nProt: '951260000000001', xJust: 'VIAGEM NAO REALIZADA TESTE' })
      .catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ProtocolError);
    expect((e as ProtocolError).message).toContain('retEventoMDFe/infEvento');
  });
});

describe('documento assinado', () => {
  const assinatura =
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo/><SignatureValue/><KeyInfo/><Reference><DigestValue>abc=</DigestValue></Reference></Signature>';

  test('recusa XML malformado, raiz errada, raiz sem o default do MDF-e e documento sem assinatura', () => {
    expect(() => documentoAssinado('<MDFe', 'MDFe', 'infMDFe')).toThrow(ConfigError);
    expect(() => documentoAssinado(`<NFe xmlns="${MDFE_NS}"/>`, 'MDFe', 'infMDFe')).toThrow(/esperado <MDFe>/);
    const prefixado = `<m:MDFe xmlns:m="${MDFE_NS}"><m:infMDFe Id="MDFe1"/>${assinatura}</m:MDFe>`;
    expect(() => documentoAssinado(prefixado, 'MDFe', 'infMDFe')).toThrow(/declarar xmlns/);
    expect(() => documentoAssinado(`<MDFe xmlns="${MDFE_NS}"><infMDFe Id="MDFe1"/></MDFe>`, 'MDFe', 'infMDFe')).toThrow(
      /sem assinatura/,
    );
    const ok = documentoAssinado(
      `<MDFe xmlns="${MDFE_NS}"><infMDFe Id="MDFe1"/>${assinatura}</MDFe>`,
      'MDFe',
      'infMDFe',
    );
    expect(ok.id).toBe('MDFe1');
    expect(ok.digestValue).toBe('abc=');
  });

  test('prefixo redeclarado dentro do recorte não ganha declaração na raiz (C14N do irmão assinado)', () => {
    const doc = parseXml(
      `<a xmlns="${MDFE_NS}" xmlns:p="urn:p"><b><p:c xmlns:p="urn:p"/><p:d xmlns:p="urn:p"/></b></a>`,
    );
    const b = firstChild(doc.root, 'b', MDFE_NS);
    if (b === undefined) throw new Error('sem <b>');
    expect(sliceElement(doc, b)).toBe('<b><p:c xmlns:p="urn:p"/><p:d xmlns:p="urn:p"/></b>');
  });

  test('o recorte leva os prefixos declarados em ancestrais', () => {
    const doc = parseXml(`<a xmlns="${MDFE_NS}" xmlns:p="urn:p"><b><p:c/></b></a>`);
    const b = firstChild(doc.root, 'b', MDFE_NS);
    if (b === undefined) throw new Error('sem <b>');
    expect(sliceElement(doc, b)).toBe('<b xmlns:p="urn:p"><p:c/></b>');
  });
});
