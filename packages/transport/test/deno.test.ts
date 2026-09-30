/** Transporte do Deno com a API do Deno e o fetch injetados (a execução real está no laboratório TLS). */
import { describe, expect, test } from 'bun:test';
import { ErroDeTempoEsgotado, ErroNaoSuportado, loggerEmMemoria } from '@sinete/core';
import * as nodeEntry from '../src/index.node.ts';
import type { ApiHttpDeno, HelperTlsExterno, RespostaTransporte } from '../src/index.ts';
import {
  CAPACIDADES_DENO,
  criarTransporte,
  criarTransporteDeno,
  ErroTransporteNaoSuportado,
  politicaDeHostsPermitidos,
} from '../src/index.ts';

const identity = { tipo: 'pem' as const, cadeia: 'CERT', chave: 'KEY' };

function fakeDeno() {
  const created: Record<string, unknown>[] = [];
  let closed = 0;
  const api: ApiHttpDeno = {
    createHttpClient(o) {
      created.push(o);
      return { close: () => void closed++ };
    },
  };
  return { api, created, closed: () => closed };
}

describe('criarTransporteDeno', () => {
  test('cliente com identidade, ICP-Brasil somada e HTTP/1.1', async () => {
    const d = fakeDeno();
    const seen: RequestInit[] = [];
    const t = criarTransporteDeno({
      identidade: identity,
      acsAdicionais: ['EXTRA'],
      deno: d.api,
      fetch: (async (_url: string, init: RequestInit) => {
        seen.push(init);
        return new Response('<ok/>', { status: 200, headers: { 'X-Algo': '1' } });
      }) as unknown as typeof fetch,
    });
    expect(t.capacidades).toBe(CAPACIDADES_DENO);
    const created = d.created[0] as { cert: string; key: string; caCerts: string[]; http1: boolean; http2: boolean };
    expect(created).toMatchObject({ cert: 'CERT', key: 'KEY', http1: true, http2: false });
    expect(created.caCerts.at(-1)).toBe('EXTRA');
    expect(created.caCerts.length).toBe(8);
    const r = await t.enviar({ url: 'https://nfe-homologacao.svrs.rs.gov.br/ws/x', corpo: '<a/>' });
    expect(r.status).toBe(200);
    expect(r.texto()).toBe('<ok/>');
    expect(r.cabecalhos['x-algo']).toBe('1');
    expect(r.tls.certificadoLocalCarregado).toBeUndefined();
    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.redirect).toBe('manual');
    expect((seen[0] as { client?: unknown }).client).toBeDefined();
    await t.fechar();
    await t.fechar();
    expect(d.closed()).toBe(1);
    await expect(t.enviar({ url: 'https://nfe-homologacao.svrs.rs.gov.br/' })).rejects.toMatchObject({
      code: 'config_invalida',
    });
  });

  test('recusa hosts que renegociam ou só têm CBC/DHE, antes do fetch', async () => {
    let calls = 0;
    const logger = loggerEmMemoria();
    const t = criarTransporteDeno({
      identidade: identity,
      logger,
      deno: fakeDeno().api,
      fetch: (async () => {
        calls++;
        return new Response('x');
      }) as unknown as typeof fetch,
    });
    for (const url of [
      'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeStatusServico4',
      'https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4',
      'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse',
    ]) {
      const e = await t.enviar({ url }).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(ErroTransporteNaoSuportado);
      expect(e).toBeInstanceOf(ErroNaoSuportado);
      expect((e as ErroTransporteNaoSuportado).code).toBe('nao_suportado');
      expect((e as ErroTransporteNaoSuportado).motivos.length).toBeGreaterThan(0);
    }
    expect(calls).toBe(0);
    await t.fechar();
  });

  test('hostsDesconhecidos: recusar recusa host sem perfil', async () => {
    const t = criarTransporteDeno({
      identidade: identity,
      hostsDesconhecidos: 'recusar',
      deno: fakeDeno().api,
      fetch: (async () => new Response('x')) as never,
    });
    await expect(t.enviar({ url: 'https://meu-endpoint.invalid/' })).rejects.toMatchObject({ code: 'nao_suportado' });
    await t.fechar();
  });

  test('403, prazo, cancelamento e falha classificada', async () => {
    const t = criarTransporteDeno({
      identidade: identity,
      timeoutMs: 50,
      deno: fakeDeno().api,
      fetch: (async (url: string, init: RequestInit) => {
        if (url.endsWith('/403')) return new Response('', { status: 403 });
        if (url.endsWith('/erro'))
          throw new TypeError('error sending request: client error (Connect): invalid peer certificate: UnknownIssuer');
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('abortado', 'AbortError')));
        });
      }) as unknown as typeof fetch,
    });
    const base = 'https://nfe-homologacao.svrs.rs.gov.br';
    await expect(t.enviar({ url: `${base}/403` })).rejects.toMatchObject({ code: 'certificado_ausente_ou_recusado' });
    await expect(t.enviar({ url: `${base}/erro` })).rejects.toMatchObject({ code: 'cadeia_servidor_nao_confiavel' });
    await expect(t.enviar({ url: `${base}/lento` })).rejects.toBeInstanceOf(ErroDeTempoEsgotado);
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 10);
    await expect(t.enviar({ url: `${base}/lento`, signal: ac.signal, timeoutMs: 5000 })).rejects.toMatchObject({
      code: 'cancelado',
    });
    const lax = criarTransporteDeno({
      identidade: identity,
      recusarEm403: false,
      deno: fakeDeno().api,
      fetch: (async () => new Response('', { status: 403 })) as never,
    });
    expect((await lax.enviar({ url: `${base}/403` })).status).toBe(403);
  });

  test('identidade helper não cria cliente nem checa perfil (o helper fala TLS por conta própria)', async () => {
    const d = fakeDeno();
    const helper: HelperTlsExterno = {
      versaoDoProtocolo: 1,
      enviar: async (_id, req): Promise<RespostaTransporte> => ({
        status: req.url.endsWith('/403') ? 403 : 200,
        cabecalhos: {},
        corpo: new Uint8Array(),
        tls: { protocolo: undefined, cifra: undefined, retomada: undefined, certificadoLocalCarregado: undefined },
        texto: () => '',
      }),
      fechar: async () => {},
    };
    const t = criarTransporteDeno({
      identidade: { tipo: 'helper', helper, identidade: 'x' },
      politica: politicaDeHostsPermitidos({ hosts: ['homologacao.nfe.fazenda.sp.gov.br'] }),
      deno: d.api,
    });
    expect(d.created).toHaveLength(0);
    expect((await t.enviar({ url: 'https://homologacao.nfe.fazenda.sp.gov.br/ws' })).status).toBe(200);
    await expect(t.enviar({ url: 'https://homologacao.nfe.fazenda.sp.gov.br/403' })).rejects.toMatchObject({
      code: 'certificado_ausente_ou_recusado',
    });
    await t.fechar();
  });

  test('sem Deno na runtime', () => {
    expect(() => criarTransporteDeno({ identidade: identity })).toThrow(ErroNaoSuportado);
  });
});

describe('criarTransporte por entrada', () => {
  test('entrada default fora do Deno lança em vez de cair num fetch genérico', () => {
    expect(() => criarTransporte({ identidade: identity })).toThrow(expect.objectContaining({ code: 'nao_suportado' }));
  });

  test('entrada default e node escolhem o Deno quando o global existe', () => {
    const g = globalThis as { Deno?: unknown };
    g.Deno = { version: { deno: '2.9.1' }, ...fakeDeno().api };
    try {
      expect(criarTransporte({ identidade: identity }).capacidades.runtime).toBe('deno');
      expect(nodeEntry.criarTransporte({ identidade: identity }).capacidades.runtime).toBe('deno');
    } finally {
      delete g.Deno;
    }
    expect(nodeEntry.detectarRuntime()).toBe('bun');
  });
});
