/**
 * Bordas do protocolo: GZip da área de dados, respostas SOAP defeituosas (fault, corpo que não é XML, retorno ausente
 * ou sem cStat) e documentos assinados recusados antes de montar o `mdfeProc`.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import type { AssinadorDeDados } from '@sinete/core';
import { ErroDeConfiguracao, ErroRespostaInvalida, relogioFixo } from '@sinete/core';
import { codificarBase64, lerXml, primeiroFilho } from '@sinete/core/xml';
import { certificadoSintetico } from '@sinete/sefaz-sim';
import type { RespostaTransporte, Transporte } from '@sinete/transport';
import { montarChaveAcesso } from '@sinete/validators';
import {
  comprimirGzipBase64,
  criarClienteMdfe,
  descomprimirGzipBase64,
  documentoAssinado,
  MDFE_NS,
  recortarElemento,
} from '../src/index.ts';
import { EMISSAO } from './helpers/mdfe.ts';

const SOAP12 = 'http://www.w3.org/2003/05/soap-envelope';

let signer: AssinadorDeDados;
beforeAll(async () => {
  const clock = relogioFixo(EMISSAO);
  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac' });
  signer = (await certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: '11222333000181', emissor: ac }))
    .assinador;
}, 30_000);

function respondendo(body: string, status = 200): Transporte {
  return {
    capacidades: {
      runtime: 'personalizada',
      renegociacao: true,
      tls12Cbc: true,
      tls12Dhe: true,
      controleDeSigalgs: false,
      conferenciaDoCertificadoLocal: false,
    },
    async enviar(): Promise<RespostaTransporte> {
      return {
        status,
        cabecalhos: {},
        corpo: new TextEncoder().encode(body),
        tls: { protocolo: 'TLSv1.2', cifra: undefined, retomada: false, certificadoLocalCarregado: undefined },
        texto: () => body,
      };
    },
    async fechar() {},
  };
}

const envelope = (inner: string): string =>
  `<soap:Envelope xmlns:soap="${SOAP12}"><soap:Body><mdfeStatusServicoMDFResult xmlns="${MDFE_NS}/wsdl/MDFeStatusServico">${inner}</mdfeStatusServicoMDFResult></soap:Body></soap:Envelope>`;

const status = (body: string, http = 200): Promise<unknown> =>
  criarClienteMdfe({
    transporte: respondendo(body, http),
    assinador: signer,
    ambiente: 'homologacao',
    relogio: relogioFixo(EMISSAO),
  })
    .statusServico()
    .catch((e: unknown) => e);

describe('gzip da área de dados', () => {
  test('ida e volta, Base64 inválido e bytes que não são GZip viram ErroRespostaInvalida', async () => {
    expect(await descomprimirGzipBase64(await comprimirGzipBase64('<MDFe>ação</MDFe>'))).toBe('<MDFe>ação</MDFe>');
    expect(await descomprimirGzipBase64('!!!').catch((e: unknown) => e)).toBeInstanceOf(ErroRespostaInvalida);
    const texto = codificarBase64(new TextEncoder().encode('nao e gzip'));
    expect(await descomprimirGzipBase64(texto).catch((e: unknown) => e)).toBeInstanceOf(ErroRespostaInvalida);
    const grande = await comprimirGzipBase64('A'.repeat(1024 * 1024));
    expect(
      ((await descomprimirGzipBase64(grande, 1000).catch((e: unknown) => e)) as ErroRespostaInvalida).message,
    ).toContain('passa de');
    expect((await descomprimirGzipBase64(grande, 2 * 1024 * 1024)).length).toBe(1024 * 1024);
  });
});

describe('respostas SOAP defeituosas', () => {
  test('fault, corpo que não é XML, retorno ausente e retorno sem cStat', async () => {
    const fault = `<soap:Envelope xmlns:soap="${SOAP12}"><soap:Body><soap:Fault><soap:Code><soap:Value>soap:Receiver</soap:Value></soap:Code><soap:Reason><soap:Text xml:lang="pt-BR">falha interna</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>`;
    const f = await status(fault, 500);
    expect(f).toBeInstanceOf(ErroRespostaInvalida);
    expect((f as ErroRespostaInvalida).message).toContain('falha interna');
    const html = await status('<html><body>Service Unavailable', 503);
    expect(html).toBeInstanceOf(ErroRespostaInvalida);
    expect((html as ErroRespostaInvalida).message).toContain('não é XML');
    expect(((await status(envelope('<outro/>'))) as ErroRespostaInvalida).message).toContain(
      'sem <retConsStatServMDFe>',
    );
    const semCStat = envelope(
      `<retConsStatServMDFe xmlns="${MDFE_NS}" versao="3.00"><tpAmb>2</tpAmb></retConsStatServMDFe>`,
    );
    expect(((await status(semCStat)) as ErroRespostaInvalida).message).toContain('sem cStat');
    // cStat fora do lugar do leiaute: não basta existir em algum descendente.
    const aninhado = envelope(
      `<retConsStatServMDFe xmlns="${MDFE_NS}" versao="3.00"><tpAmb>2</tpAmb><x><cStat>107</cStat></x></retConsStatServMDFe>`,
    );
    expect(((await status(aninhado)) as ErroRespostaInvalida).message).toContain('sem cStat');
  });

  test('retEventoMDFe sem infEvento vira ErroRespostaInvalida, não TypeError', async () => {
    const chave = montarChaveAcesso({
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
    const client = criarClienteMdfe({
      transporte: respondendo(corpo),
      assinador: signer,
      ambiente: 'homologacao',
      relogio: relogioFixo(EMISSAO),
    });
    const e = await client
      .cancelar({ chave, nProt: '951260000000001', xJust: 'VIAGEM NAO REALIZADA TESTE' })
      .catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroRespostaInvalida);
    expect((e as ErroRespostaInvalida).message).toContain('retEventoMDFe/infEvento');
  });
});

describe('documento assinado', () => {
  const assinatura =
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo/><SignatureValue/><KeyInfo/><Reference><DigestValue>abc=</DigestValue></Reference></Signature>';

  test('recusa XML malformado, raiz errada, raiz sem o default do MDF-e e documento sem assinatura', () => {
    expect(() => documentoAssinado('<MDFe', 'MDFe', 'infMDFe')).toThrow(ErroDeConfiguracao);
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
    const doc = lerXml(`<a xmlns="${MDFE_NS}" xmlns:p="urn:p"><b><p:c xmlns:p="urn:p"/><p:d xmlns:p="urn:p"/></b></a>`);
    const b = primeiroFilho(doc.raiz, 'b', MDFE_NS);
    if (b === undefined) throw new Error('sem <b>');
    expect(recortarElemento(doc, b)).toBe('<b><p:c xmlns:p="urn:p"/><p:d xmlns:p="urn:p"/></b>');
  });

  test('o recorte leva os prefixos declarados em ancestrais', () => {
    const doc = lerXml(`<a xmlns="${MDFE_NS}" xmlns:p="urn:p"><b><p:c/></b></a>`);
    const b = primeiroFilho(doc.raiz, 'b', MDFE_NS);
    if (b === undefined) throw new Error('sem <b>');
    expect(recortarElemento(doc, b)).toBe('<b xmlns:p="urn:p"><p:c/></b>');
  });
});
