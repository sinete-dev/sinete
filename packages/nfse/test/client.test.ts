/**
 * Cliente contra um transporte falso: respostas fora do contrato, validações antes do envio, cache da parametrização
 * e as grafias de resposta observadas. O caminho feliz fica no ponta a ponta contra o simulador.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import {
  contextoDeTempo,
  ErroDeConfiguracao,
  ErroDeValidacao,
  ErroRespostaInvalida,
  loggerEmMemoria,
  relogioManual,
} from '@sinete/core';
import type { SyntheticCertificate } from '@sinete/sefaz-sim';
import { syntheticCertificate } from '@sinete/sefaz-sim';
import type { EndpointRef, Transport, TransportRequest, TransportResponse } from '@sinete/transport';
import { nfseEndpoint } from '@sinete/transport';
import type { NfseClient } from '../src/index.ts';
import {
  buildDps,
  buildPedidoCancelamento,
  cacheEmMemoria,
  createNfseClient,
  createParametrosMunicipais,
  gzipBase64,
  resolverEnvioSemResposta,
  signDps,
  signPedidoEvento,
} from '../src/index.ts';
import { dps, EMISSAO, PRESTADOR, SAO_PAULO } from './helpers.ts';

type Resposta = { readonly status: number; readonly body?: string | Uint8Array };

function falso(respostas: Resposta[]): Transport & { readonly pedidos: TransportRequest[] } {
  const pedidos: TransportRequest[] = [];
  return {
    pedidos,
    capabilities: {
      runtime: 'custom',
      renegotiation: true,
      tls12Cbc: true,
      tls12Dhe: true,
      sigalgsControl: false,
      clientCertificateCheck: false,
    },
    async send(req: TransportRequest): Promise<TransportResponse> {
      pedidos.push(req);
      const r = respostas.shift() ?? { status: 599 };
      const body = typeof r.body === 'string' ? new TextEncoder().encode(r.body) : (r.body ?? new Uint8Array());
      return {
        status: r.status,
        headers: {},
        body,
        tls: { protocol: undefined, cipher: undefined, resumed: undefined, clientCertificateLoaded: undefined },
        text: (): string => new TextDecoder().decode(body),
      };
    },
    close: async (): Promise<void> => undefined,
  };
}

let cert: SyntheticCertificate;
let clock: RelogioManual;
let assinada: string;
let idDps: string;
const CHAVE = `${SAO_PAULO}22${PRESTADOR}${'1'.padStart(13, '0')}2609${'1'.padStart(9, '0')}7`;

beforeAll(async () => {
  clock = relogioManual(EMISSAO);
  cert = await syntheticCertificate({ clock, role: 'titular', cnpj: PRESTADOR });
  const r = buildDps(dps(), { ambiente: 'homologacao', time: contextoDeTempo({ emissao: clock }) });
  if (!r.ok) throw new Error('montagem');
  idDps = r.value.id;
  assinada = await signDps(r.value, cert.signer);
}, 30_000);

function cliente(t: Transport, extra: Partial<Parameters<typeof createNfseClient>[0]> = {}): NfseClient {
  return createNfseClient({ transport: t, ambiente: 'homologacao', clock, ...extra });
}

const json = (o: unknown): string => JSON.stringify(o);

async function nfseXml(id: string, idDpsNaNfse: string): Promise<string> {
  return gzipBase64(
    `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${id}"><nNFSe>1</nNFSe><cStat>103</cStat><dhProc>x</dhProc><DPS versao="1.01"><infDPS Id="${idDpsNaNfse}"/></DPS></infNFSe></NFSe>`,
  );
}

describe('emissão fora do contrato', () => {
  test('HTTP 500, 200 sem chave, NFS-e de outra DPS, raiz errada e gzip inválido', async () => {
    const outra = await nfseXml(CHAVE, 'DPS0');
    const t = falso([
      { status: 500, body: json({ erros: [{ Codigo: 'E9999' }] }) },
      { status: 201, body: json({ nfseXmlGZipB64: 'x' }) },
      { status: 201, body: json({ chaveAcesso: CHAVE, nfseXmlGZipB64: outra }) },
      { status: 201, body: json({ chaveAcesso: CHAVE, nfseXmlGZipB64: await gzipBase64('<outro/>') }) },
      { status: 201, body: json({ chaveAcesso: CHAVE, nfseXmlGZipB64: await gzipBase64('<NFSe') }) },
      { status: 200, body: 'não é json' },
    ]);
    const c = cliente(t, { logger: loggerEmMemoria() });
    await expect(c.autorizar(assinada)).rejects.toThrow('HTTP 500');
    await expect(c.autorizar(assinada)).rejects.toThrow('chaveAcesso');
    await expect(c.autorizar(assinada)).rejects.toThrow('não corresponde');
    await expect(c.autorizar(assinada)).rejects.toThrow('não é uma NFS-e');
    await expect(c.autorizar(assinada)).rejects.toThrow('bem formado');
    await expect(c.autorizar(assinada)).rejects.toBeInstanceOf(ErroRespostaInvalida);
    expect(t.pedidos[0]?.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(t.pedidos[0]?.url).toBe('https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse');
  });

  test('situação da NFS-e fora da tabela e alertas na resposta', async () => {
    const t = falso([
      {
        status: 200,
        body: json({
          chaveAcesso: CHAVE,
          nfseXmlGZipB64: await nfseXml(CHAVE, idDps),
          alertas: [{ codigo: 'E0312', descricao: 'alerta' }],
          versaoAplicativo: 'v1',
        }),
      },
    ]);
    const r = await cliente(t).autorizar(assinada);
    expect(r.tipo === 'autorizado' && r.valor.alertas.map((a) => a.codigo)).toEqual(['E0312']);
    expect(r.xMotivo).toBe('NFS-e Avulsa');
  });

  test('validações antes do envio', async () => {
    const t = falso([]);
    const c = cliente(t);
    await expect(c.autorizar('<DPS/>')).rejects.toThrow('declaração');
    await expect(c.autorizar('<?xml version="1.0"?><DPS')).rejects.toThrow('bem formado');
    await expect(c.autorizar('<?xml version="1.0"?><NFSe/>')).rejects.toThrow('não é uma DPS');
    await expect(cliente(t, { ambiente: 'producao' }).autorizar(assinada)).rejects.toBeInstanceOf(ErroDeConfiguracao);
    expect(t.pedidos).toHaveLength(0);
  });
});

describe('consultas e eventos fora do contrato', () => {
  test('consultas', async () => {
    const t = falso([
      { status: 503 },
      {
        status: 200,
        body: json({ chaveAcesso: CHAVE, nfseXmlGZipB64: await nfseXml(`${CHAVE.slice(0, -1)}8`, idDps) }),
      },
      { status: 500 },
      { status: 200, body: json({ chaveAcesso: '123' }) },
    ]);
    const c = cliente(t);
    await expect(c.consultar(CHAVE)).rejects.toThrow('HTTP 503');
    await expect(c.consultar(CHAVE)).rejects.toThrow('outra chave');
    await expect(c.consultarDps(idDps)).rejects.toThrow('HTTP 500');
    await expect(c.consultarDps(idDps)).rejects.toThrow(ErroDeConfiguracao);
    await expect(c.consultarDps('DPS1')).rejects.toThrow('Id de DPS');
    await expect(c.consultar('1')).rejects.toThrow(ErroDeConfiguracao);
  });

  test('resolver envio sem resposta: DPS processada sem NFS-e é ErroRespostaInvalida', async () => {
    const t = falso([{ status: 200, body: json({ chaveAcesso: CHAVE }) }, { status: 404 }]);
    await expect(resolverEnvioSemResposta(cliente(t), assinada)).rejects.toThrow('não foi encontrada');
    await expect(resolverEnvioSemResposta(cliente(t, { ambiente: 'producao' }), assinada)).rejects.toThrow('tpAmb 2');
    expect(t.pedidos).toHaveLength(2);
  });

  test('eventos: filtro obrigatório, 404 como ausência, JSON inválido e evento de outra NFS-e', async () => {
    const outro = `${CHAVE.slice(0, -1)}8`;
    const ev = (ch: string): string =>
      `<evento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infEvento Id="EVT"><nSeqEvento>1</nSeqEvento><pedRegEvento><infPedReg><chNFSe>${ch}</chNFSe></infPedReg></pedRegEvento></infEvento></evento>`;
    const t = falso([
      { status: 200, body: 'x' },
      { status: 500, body: '{}' },
      { status: 200, body: json([{ arquivoXml: 1 }]) },
      {
        status: 404,
        body: '<!DOCTYPE html><html><head><title>404 - File or directory not found.</title></head></html>',
      },
      { status: 404, body: '{}' },
      { status: 200, body: json({ eventos: [] }) },
      { status: 200, body: json({ tipoAmbiente: 2 }) },
      { status: 200, body: json({ eventos: [{ tipoEvento: '101101' }] }) },
      { status: 200, body: json({ eventos: [{ arquivoXml: 'SDRz%%' }] }) },
      { status: 200, body: json({ eventos: [{ eventoXmlGZipB64: await gzipBase64(ev(outro)) }] }) },
      { status: 201, body: json({ eventoXmlGZipB64: await gzipBase64(ev(outro)) }) },
      { status: 201, body: json({ eventoXmlGZipB64: await gzipBase64('<evento') }) },
      { status: 201, body: json({ eventoXmlGZipB64: await gzipBase64('<outro/>') }) },
      { status: 500 },
      { status: 200, body: json({ eventos: [{ eventoXmlGZipB64: await gzipBase64(ev(CHAVE)) }] }) },
    ]);
    const c = cliente(t, { signer: cert.signer });
    const semFiltro = c.consultarEventos(CHAVE, undefined as unknown as { tpEvento: string; nSeqEvento: number });
    await expect(semFiltro).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(semFiltro).rejects.toThrow('405 sem o tipo e 404 sem a sequência');
    const soTipo = { tpEvento: '101101' } as unknown as { tpEvento: string; nSeqEvento: number };
    await expect(c.consultarEventos(CHAVE, soTipo)).rejects.toThrow('tpEvento e nSeqEvento');
    await expect(c.consultarEventos(CHAVE, { tpEvento: '1', nSeqEvento: 1 })).rejects.toThrow('código de evento');
    await expect(c.consultarEventos(CHAVE, { tpEvento: '101101', nSeqEvento: 0 })).rejects.toThrow('nSeqEvento');
    await expect(c.consultarEventos(CHAVE, { tpEvento: '101101', nSeqEvento: 1.5 })).rejects.toThrow('nSeqEvento');
    expect(t.pedidos).toHaveLength(0);
    const filtro = { tpEvento: '101101', nSeqEvento: 1 };
    await expect(c.consultarEventos(CHAVE, filtro)).rejects.toThrow('HTTP 200');
    expect(t.pedidos[0]?.url).toEndWith(`/nfse/${CHAVE}/eventos/101101/1`);
    await expect(c.consultarEventos(CHAVE, filtro)).rejects.toThrow('HTTP 500');
    await expect(c.consultarEventos(CHAVE, filtro)).rejects.toThrow('HTTP 200');
    expect(await c.consultarEventos(CHAVE, filtro)).toEqual([]);
    expect(await c.consultarEventos(CHAVE, filtro)).toEqual([]);
    expect(await c.consultarEventos(CHAVE, filtro)).toEqual([]);
    await expect(c.consultarEventos(CHAVE, filtro)).rejects.toThrow('resposta sem eventos');
    await expect(c.consultarEventos(CHAVE, filtro)).rejects.toThrow('evento sem arquivoXml');
    await expect(c.consultarEventos(CHAVE, filtro)).rejects.toBeInstanceOf(ErroRespostaInvalida);
    await expect(c.consultarEventos(CHAVE, filtro)).rejects.toThrow('de outra NFS-e');
    const pedido = {
      chave: CHAVE,
      autor: { CNPJ: PRESTADOR },
      cMotivo: '1' as const,
      xMotivo: 'Motivo com mais de 15',
    };
    await expect(c.cancelar(pedido)).rejects.toThrow('outra NFS-e');
    await expect(c.cancelar(pedido)).rejects.toThrow('bem formado');
    await expect(c.cancelar(pedido)).rejects.toThrow('sem evento');
    await expect(c.cancelar(pedido)).rejects.toThrow('HTTP 500');
    const lista = await c.consultarEventos(CHAVE, filtro);
    expect(lista[0]).toMatchObject({ chaveAcesso: CHAVE, tpEvento: '', nSeqEvento: '1', dhProc: '' });
    await expect(c.cancelar({ ...pedido, xMotivo: 'curto' })).rejects.toBeInstanceOf(ErroDeValidacao);
    await expect(c.solicitarAnaliseFiscal({ ...pedido, xMotivo: 'curto' })).rejects.toBeInstanceOf(ErroDeValidacao);
    await expect(cliente(t).cancelar(pedido)).rejects.toThrow('options.signer');
  });

  test('eventos no formato da Sefin real: arquivoXml em base64 do gzip em base64', async () => {
    // Forma observada na produção restrita em 28/09/2026, com chave e XML sintéticos.
    const xml = `<evento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infEvento Id="EVT${CHAVE}101101001"><nSeqEvento>1</nSeqEvento><dhProc>2026-09-28T18:17:10-03:00</dhProc><pedRegEvento><infPedReg><chNFSe>${CHAVE}</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc></e101101></infPedReg></pedRegEvento></infEvento></evento>`;
    const arquivoXml = btoa(await gzipBase64(xml));
    expect(arquivoXml).toStartWith('SDRzSUFBQUFB');
    const t = falso([
      {
        status: 200,
        body: json({
          dataHoraProcessamento: '2026-09-28T18:20:00.000',
          tipoAmbiente: 2,
          versaoAplicativo: 'SefinNacional_1.6.0',
          eventos: [
            {
              chaveAcesso: CHAVE,
              tipoEvento: '101101',
              numeroPedidoRegistroEvento: '1',
              dataHoraRecebimento: '2026-09-28T18:17:10.867',
              arquivoXml,
            },
          ],
        }),
      },
    ]);
    const lista = await cliente(t).consultarEventos(CHAVE, { tpEvento: '101101', nSeqEvento: 1 });
    expect(lista).toEqual([
      {
        xml,
        id: `EVT${CHAVE}101101001`,
        chaveAcesso: CHAVE,
        tpEvento: '101101',
        nSeqEvento: '1',
        dhProc: '2026-09-28T18:17:10-03:00',
      },
    ]);
    expect(t.pedidos[0]).toMatchObject({ method: 'GET', url: expect.stringContaining(`/eventos/101101/1`) });
  });

  test('registrarEvento confere o pedido antes do envio', async () => {
    const t = falso([]);
    const c = cliente(t);
    const r = buildPedidoCancelamento(
      { chave: CHAVE, autor: { CNPJ: PRESTADOR }, cMotivo: '1', xMotivo: 'Motivo com mais de 15' },
      { ambiente: 'producao', clock },
    );
    if (!r.ok) throw new Error('montagem');
    const prod = await signPedidoEvento(r.value, cert.signer);
    await expect(c.registrarEvento('<x')).rejects.toThrow('bem formado');
    await expect(c.registrarEvento('<DPS/>')).rejects.toThrow('não é um pedido');
    await expect(c.registrarEvento(prod)).rejects.toThrow('tpAmb 1');
    await expect(
      cliente(t, { ambiente: 'producao' }).registrarEvento(prod.replace(/^<\?xml[^>]*>/, '')),
    ).rejects.toThrow('declaração');
    expect(t.pedidos).toHaveLength(0);
  });

  test('endpoint sobreposto e sinal de cancelamento repassado', async () => {
    const t = falso([{ status: 404 }]);
    const ep: EndpointRef = {
      ...nfseEndpoint({ ambiente: 'producao', api: 'sefin' }),
      url: 'https://exemplo.invalid/base/',
    };
    const ctl = new AbortController();
    const c = cliente(t, { endpoint: () => ep, timeoutMs: 10 });
    expect(await c.consultar(CHAVE, { signal: ctl.signal })).toBeUndefined();
    expect(t.pedidos[0]).toMatchObject({
      url: `https://exemplo.invalid/base/nfse/${CHAVE}`,
      timeoutMs: 10,
      signal: ctl.signal,
    });
  });
});

describe('parametrização', () => {
  const endpoint = nfseEndpoint({ ambiente: 'homologacao', api: 'parametrizacao' });

  test('resposta fora do formato não entra no cache: a próxima consulta vai de novo ao ADN', async () => {
    const t = falso([
      { status: 200, body: '<html>erro</html>' },
      { status: 200, body: json({ semParametros: true }) },
      { status: 200, body: json({ parametrosConvenio: { aderenteEmissorNacional: 1 } }) },
    ]);
    const p = createParametrosMunicipais({ transport: t, endpoint, clock });
    await expect(p.convenio(SAO_PAULO)).rejects.toThrow('HTTP 200');
    await expect(p.convenio(SAO_PAULO)).rejects.toThrow('parametrosConvenio');
    expect(await p.convenio(SAO_PAULO)).toMatchObject({ aderenteEmissorNacional: true });
    expect(await p.convenio(SAO_PAULO)).toMatchObject({ aderenteEmissorNacional: true });
    expect(t.pedidos).toHaveLength(3);
  });

  test('entradas inválidas não chegam ao transporte', async () => {
    const t = falso([]);
    const p = createParametrosMunicipais({ transport: t, endpoint, clock });
    await expect(p.convenio('355')).rejects.toThrow('município');
    await expect(p.aliquota(SAO_PAULO, '010101', '25/09/2026')).rejects.toThrow('competência');
    await expect(p.aliquota(SAO_PAULO, '0101', '2026-09-25')).rejects.toThrow('tributação');
    await expect(p.beneficio(SAO_PAULO, '1', '2026-09-25')).rejects.toThrow('benefício');
    await expect(p.regimesEspeciais('1', '010101', '2026-09-25')).rejects.toThrow('município');
    await expect(p.retencoes(SAO_PAULO, 'x')).rejects.toThrow('competência');
    await expect(p.historicoAliquotas('x', '010101')).rejects.toThrow('município');
    expect(t.pedidos).toHaveLength(0);
    expect(() => cacheEmMemoria(0)).toThrow(ErroDeConfiguracao);
  });

  test('respostas fora do formato, sem cache, 404 e erro HTTP com mensagem', async () => {
    const t = falso([
      { status: 200, body: json({ semParametros: true }) },
      { status: 200, body: json({ aliquotas: { x: [{ Aliq: 'a' }] } }) },
      { status: 200, body: json({ mensagem: 'x' }) },
      { status: 400, body: json({ mensagem: 'Chamada mal formada.' }) },
      {
        status: 200,
        body: json({ aliquotas: { x: 'nada', y: [{ aliq: 3, dtIni: '2026-01-01T00:00:00', incidencia: 'SIM' }] } }),
      },
      { status: 404, body: '{}' },
      { status: 200, body: json({ parametrosConvenio: { aderenteAmbienteNacional: '1', aderenteMAN: true } }) },
    ]);
    const p = createParametrosMunicipais({ transport: t, endpoint, clock, cache: false, timeoutMs: 5 });
    await expect(p.convenio(SAO_PAULO)).rejects.toThrow('parametrosConvenio');
    await expect(p.historicoAliquotas(SAO_PAULO, '010101')).rejects.toThrow('fora do formato');
    await expect(p.aliquota(SAO_PAULO, '010101', '2026-09-25')).rejects.toThrow('sem aliquotas');
    await expect(p.aliquota(SAO_PAULO, '010101', '2026-09-25')).rejects.toThrow('HTTP 400');
    expect(await p.historicoAliquotas(SAO_PAULO, '01.01.01.001')).toEqual([
      { incidencia: 'SIM', aliquota: '3.00', inicio: '2026-01-01', fim: undefined },
    ]);
    expect(await p.regimesEspeciais(SAO_PAULO, '010101', '2026-09-25')).toBeUndefined();
    expect(await p.convenio(SAO_PAULO)).toMatchObject({
      aderenteAmbienteNacional: true,
      aderenteEmissorNacional: false,
      aderenteMAN: true,
      situacaoEmissaoPadraoContribuintesRFB: undefined,
      permiteAproveitamentoDeCreditos: undefined,
    });
    expect(t.pedidos.map((r) => r.url)).toContain(`${endpoint.url}/${SAO_PAULO}/01.01.01.001/historicoaliquotas`);
    expect(t.pedidos[0]?.timeoutMs).toBe(5);
    await p.limparCache();
  });

  test('cache: consultas simultâneas viram uma, 404 expira antes, limite de entradas e erro HTTP não fica guardado', async () => {
    const t = falso([
      { status: 200, body: json({ parametrosConvenio: {} }) },
      { status: 404, body: '{}' },
      { status: 404, body: '{}' },
      { status: 500, body: '{}' },
      { status: 200, body: json({ parametrosConvenio: {} }) },
    ]);
    const cache = cacheEmMemoria(1);
    const p = createParametrosMunicipais({ transport: t, endpoint, clock, cache, ttlNaoEncontradoMs: 1_000 });
    await Promise.all([p.convenio(SAO_PAULO), p.convenio(SAO_PAULO)]);
    expect(t.pedidos).toHaveLength(1);
    expect(await p.convenio('3509502')).toBeUndefined();
    clock.avancar(2_000);
    expect(await p.convenio('3509502')).toBeUndefined();
    expect(t.pedidos).toHaveLength(3);
    await expect(p.convenio('3304557')).rejects.toThrow('HTTP 500');
    await p.convenio('3304557');
    await p.limparCache();
    expect(await cache.get(`${endpoint.url}/3304557/convenio`)).toBeUndefined();
  });
});
