/**
 * Contribuinte exclusivo do IBS/CBS (NT 2026.007 v1.10): a NF-e sem `emit/IE` é autorizada só na SVRS (RV C17-11,
 * rejeição 166), e os eventos de autoria do emitente dela também vão à SVRS (RV 1P10-40, rejeição 188), menos na
 * série 890 a 919.
 */
import { describe, expect, test } from 'bun:test';
import { assinarXml } from '@sinete/core/xml';
import { nfeEndpoint } from '@sinete/transport';
import { CNPJ_DEST, CNPJ_EMIT, CPF_EMIT, chave, client, fakeTransport, NFE_NS, testSigner } from './helpers.ts';

const SVRS = (servico: 'NFeAutorizacao' | 'RecepcaoEvento' | 'NfeConsultaProtocolo' | 'NFeRetAutorizacao') =>
  nfeEndpoint({ ambiente: 'homologacao', servico, autorizador: 'SVRS' }).url;
const DA_UF = (servico: 'NFeAutorizacao' | 'RecepcaoEvento' | 'NfeConsultaProtocolo', uf: 'SP' | 'RS') =>
  nfeEndpoint({ ambiente: 'homologacao', servico, uf }).url;

/** NF-e assinada com o grupo `emit`, com ou sem IE. */
async function nfe(ch: string, ie?: string): Promise<string> {
  const emit = `<emit><CNPJ>${CNPJ_EMIT}</CNPJ><xNome>EMITENTE</xNome>${ie === undefined ? '' : `<IE>${ie}</IE>`}<CRT>3</CRT></emit>`;
  const xml = `<NFe xmlns="${NFE_NS}"><infNFe Id="NFe${ch}" versao="4.00"><ide><cUF>${ch.slice(0, 2)}</cUF></ide>${emit}</infNFe></NFe>`;
  return assinarXml(xml, { id: `NFe${ch}` }, await testSigner());
}

/** A URL do único pedido; a resposta não importa (o transporte falso devolve SOAP vazio). */
async function urlDe(chamada: (c: Awaited<ReturnType<typeof client>>['c']) => Promise<unknown>, opcoes = {}) {
  const t = fakeTransport('<x/>');
  const { c } = await client(t, { autor: { CNPJ: CNPJ_EMIT }, ...opcoes });
  await chamada(c).catch(() => undefined);
  expect(t.requests).toHaveLength(1);
  return t.requests[0]?.url;
}

describe('autorização (C17-11)', () => {
  test('NF-e sem IE de SP ou do RS vai à SVRS; com IE, à UF', async () => {
    const sp = chave();
    expect(await urlDe(async (c) => c.autorizar(await nfe(sp)))).toBe(SVRS('NFeAutorizacao'));
    const rs = chave({ cUF: '43' });
    expect(await urlDe(async (c) => c.autorizar(await nfe(rs)))).toBe(SVRS('NFeAutorizacao'));
    expect(await urlDe(async (c) => c.autorizar(await nfe(sp, '110042490114')))).toBe(DA_UF('NFeAutorizacao', 'SP'));
  });

  test('a NF-e enviada é a assinada, byte a byte', async () => {
    const assinada = await nfe(chave());
    const t = fakeTransport('<x/>');
    const { c } = await client(t, {});
    await c.autorizar(assinada).catch(() => undefined);
    expect(t.requests[0]?.body).toContain(assinada.replace(/^<\?xml[^>]*\?>/, ''));
  });

  test('consulta e recibo com a NF-e sem IE vão à SVRS', async () => {
    const ch = chave();
    const assinada = await nfe(ch);
    expect(await urlDe((c) => c.consultar(ch, assinada))).toBe(SVRS('NfeConsultaProtocolo'));
    expect(await urlDe((c) => c.consultarRecibo('351000000000001', assinada))).toBe(SVRS('NFeRetAutorizacao'));
  });

  test('com a NF-e na mão, a IE dela vence a opção do cliente', async () => {
    const ch = chave();
    const comIe = await nfe(ch, '110042490114');
    const o = { contribuinteExclusivoIbsCbs: true };
    expect(await urlDe((c) => c.autorizar(comIe), o)).toBe(DA_UF('NFeAutorizacao', 'SP'));
    expect(await urlDe((c) => c.consultar(ch, comIe), o)).toBe(DA_UF('NfeConsultaProtocolo', 'SP'));
  });
});

describe('eventos do emitente (1P10-40)', () => {
  const pedido = (ch: string) => ({ chave: ch, nProt: '135260000000001', xJust: 'Cancelamento por erro na emissão' });
  const cce = (ch: string) => ({
    chave: ch,
    nSeqEvento: 1,
    xCorrecao: 'Correção do endereço de entrega da mercadoria',
  });

  test('com contribuinteExclusivoIbsCbs, cancelamento, CC-e e consulta sem a nota vão à SVRS', async () => {
    const ch = chave();
    const o = { contribuinteExclusivoIbsCbs: true };
    expect(await urlDe((c) => c.cancelar(pedido(ch)), o)).toBe(SVRS('RecepcaoEvento'));
    expect(await urlDe((c) => c.cartaCorrecao(cce(ch)), o)).toBe(SVRS('RecepcaoEvento'));
    expect(await urlDe((c) => c.consultar(ch), o)).toBe(SVRS('NfeConsultaProtocolo'));
  });

  test('sem a opção, ou na série 890 a 919, ou na NFC-e, o evento fica no autorizador da chave', async () => {
    const ch = chave();
    expect(await urlDe((c) => c.cancelar(pedido(ch)))).toBe(DA_UF('RecepcaoEvento', 'SP'));
    const avulsa = chave({ serie: 890 });
    expect(await urlDe((c) => c.cancelar(pedido(avulsa)), { contribuinteExclusivoIbsCbs: true })).toBe(
      DA_UF('RecepcaoEvento', 'SP'),
    );
    const ultima = chave({ serie: 919, emitente: CPF_EMIT });
    const porCpf = { contribuinteExclusivoIbsCbs: true, autor: { CPF: CPF_EMIT } };
    expect(await urlDe((c) => c.cancelar(pedido(ultima)), porCpf)).toBe(DA_UF('RecepcaoEvento', 'SP'));
    const antes = chave({ serie: 889 });
    expect(await urlDe((c) => c.cancelar(pedido(antes)), { contribuinteExclusivoIbsCbs: true })).toBe(
      SVRS('RecepcaoEvento'),
    );
    const nfce = chave({ mod: '65' });
    expect(await urlDe((c) => c.cancelar(pedido(nfce)), { contribuinteExclusivoIbsCbs: true })).not.toBe(
      SVRS('RecepcaoEvento'),
    );
  });

  test('a manifestação do destinatário continua no Ambiente Nacional', async () => {
    const t = fakeTransport('<x/>');
    const { c } = await client(t, { autor: { CNPJ: CNPJ_DEST }, contribuinteExclusivoIbsCbs: true });
    await c.manifestar({ chave: chave(), tipo: 'ciencia' }).catch(() => undefined);
    expect(t.requests[0]?.url).toBe(
      nfeEndpoint({ ambiente: 'homologacao', servico: 'RecepcaoEvento', autorizador: 'AN' }).url,
    );
  });
});
