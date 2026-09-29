/**
 * O cliente TS contra o contrato de `docs/signer-contract/`: todo frame das fixtures passa pelo JSON Schema, os casos
 * de `guard.json` dão o mesmo veredito na `allowlistPolicy` que dão na guarda do helper
 * (`helpers/signer-tls/internal/policy/policy_test.go`), e as conversas são reproduzidas contra o cliente com um
 * helper de mentira que fala exatamente os frames das fixtures.
 */
import { describe, expect, test } from 'bun:test';
import { X509Certificate } from 'node:crypto';
import path from 'node:path';
import { icpBrasilCertificates } from '@sinete/cert';
import type { Ambiente } from '@sinete/core';
import { memoryLogger, TimeoutError } from '@sinete/core';
import { prepareRequest } from '../src/common.ts';
import { ambienteHosts } from '../src/endpoints.ts';
import { PolicyError, SignerError, TransportError } from '../src/errors.ts';
import { allowlistPolicy } from '../src/policy.ts';
import type { SignerChannel } from '../src/signer.ts';
import { connectSignerChannel, parseTlsTranscript } from '../src/signer.ts';
import type { TlsSigner } from '../src/types.ts';

const DIR = path.join(import.meta.dir, '../../../docs/signer-contract');
const schema = (await Bun.file(path.join(DIR, 'schema/frame.schema.json')).json()) as Schema;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface Schema {
  readonly [k: string]: unknown;
}

/**
 * Validador mínimo de JSON Schema 2020-12, só com o que o schema do contrato usa: type, const, enum, required,
 * properties, additionalProperties, items, pattern, minLength, maxLength, minimum, maximum, oneOf, anyOf, allOf, not,
 * if/then e $ref local. Devolve a lista de problemas (vazia: válido).
 */
function validate(s: Schema, v: Json, at = '$'): string[] {
  if (typeof s.$ref === 'string') {
    const target = (s.$ref as string)
      .replace(/^#\//, '')
      .split('/')
      .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], schema);
    return validate(target as Schema, v, at);
  }
  const errs: string[] = [];
  const typeOf = (x: Json): string =>
    x === null ? 'null' : Array.isArray(x) ? 'array' : Number.isInteger(x) ? 'integer' : typeof x;
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
    const t = typeOf(v);
    if (!types.some((x) => x === t || (x === 'number' && t === 'integer')))
      errs.push(`${at}: tipo ${t}, esperado ${types}`);
  }
  if ('const' in s && JSON.stringify(s.const) !== JSON.stringify(v))
    errs.push(`${at}: diferente de ${JSON.stringify(s.const)}`);
  if (Array.isArray(s.enum) && !(s.enum as Json[]).some((e) => JSON.stringify(e) === JSON.stringify(v))) {
    errs.push(`${at}: ${JSON.stringify(v)} fora do enum`);
  }
  if (typeof v === 'string') {
    if (typeof s.pattern === 'string' && !new RegExp(s.pattern as string, 'u').test(v))
      errs.push(`${at}: não casa ${s.pattern}`);
    if (typeof s.minLength === 'number' && v.length < (s.minLength as number)) errs.push(`${at}: curto`);
    if (typeof s.maxLength === 'number' && v.length > (s.maxLength as number)) errs.push(`${at}: longo`);
  }
  if (typeof v === 'number') {
    if (typeof s.minimum === 'number' && v < (s.minimum as number)) errs.push(`${at}: abaixo do mínimo`);
    if (typeof s.maximum === 'number' && v > (s.maximum as number)) errs.push(`${at}: acima do máximo`);
  }
  if (Array.isArray(v) && s.items) {
    for (const [i, x] of v.entries()) errs.push(...validate(s.items as Schema, x, `${at}[${i}]`));
  }
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    for (const r of (s.required as string[] | undefined) ?? []) if (!(r in v)) errs.push(`${at}: falta ${r}`);
    const props = (s.properties as Record<string, Schema> | undefined) ?? {};
    for (const [k, x] of Object.entries(v)) {
      if (props[k]) errs.push(...validate(props[k], x, `${at}.${k}`));
      else if (s.additionalProperties === false) errs.push(`${at}: propriedade a mais ${k}`);
      else if (typeof s.additionalProperties === 'object') {
        errs.push(...validate(s.additionalProperties as Schema, x, `${at}.${k}`));
      }
    }
  }
  if (Array.isArray(s.allOf)) for (const x of s.allOf as Schema[]) errs.push(...validate(x, v, at));
  if (Array.isArray(s.anyOf) && !(s.anyOf as Schema[]).some((x) => validate(x, v, at).length === 0)) {
    errs.push(`${at}: nenhum anyOf`);
  }
  if (Array.isArray(s.oneOf)) {
    const n = (s.oneOf as Schema[]).filter((x) => validate(x, v, at).length === 0).length;
    if (n !== 1) errs.push(`${at}: ${n} ramos do oneOf`);
  }
  if (s.not && validate(s.not as Schema, v, at).length === 0) errs.push(`${at}: casou o not`);
  if (s.if && validate(s.if as Schema, v, at).length === 0 && s.then) errs.push(...validate(s.then as Schema, v, at));
  return errs;
}

interface FxFrame {
  readonly from: 'client' | 'helper';
  readonly of?: string;
  readonly flavor?: 'static' | 'p11';
  readonly frame: { v: number; id: string; method?: string; params?: Json; result?: Json; error?: Json };
}

const fixtureFiles = [...new Bun.Glob('fixtures/*.json').scanSync({ cwd: DIR })].filter(
  (f) => !f.endsWith('guard.json'),
);
const fixtures = await Promise.all(
  fixtureFiles.map(async (f) => ({
    name: f,
    ...((await Bun.file(path.join(DIR, f)).json()) as { frames: FxFrame[] }),
  })),
);

const resultDef = (method: string): Schema => ({
  $ref: `#/$defs/${method.replace(/\.(\w)/, (_, c: string) => c.toUpperCase())}Result`,
});

describe('schema e fixtures', () => {
  test('PROTOCOL_VERSION é 1', async () => {
    expect((await Bun.file(path.join(DIR, 'PROTOCOL_VERSION')).text()).trim()).toBe('1');
  });

  test.each(fixtures.map((f) => [f.name, f] as const))('%s: todo frame passa pelo schema', (_, f) => {
    expect(f.frames.length).toBeGreaterThan(0);
    for (const fr of f.frames) {
      // O frame de v=2 existe para testar a recusa: fora dele, tudo é v1.
      if (fr.frame.v !== 1) {
        expect(validate(schema, fr.frame as Json)).toContain('$.v: diferente de 1');
        continue;
      }
      expect(validate(schema, fr.frame as Json)).toEqual([]);
      if (fr.of !== undefined) expect(validate(resultDef(fr.of), fr.frame.result as Json)).toEqual([]);
    }
  });

  test('o schema recusa o que o contrato proíbe', () => {
    const bad: Json[] = [
      { id: 'c1', method: 'hello', params: {} },
      { v: 1, id: 'c1', method: 'hello', params: {}, result: {} },
      { v: 1, id: 'c1', method: 'formatar', params: {} },
      { v: 1, id: 'c1', error: { code: 'inventado', message: 'x' } },
      {
        v: 1,
        id: 'c1',
        method: 'http.request',
        params: { identity: 'k', url: 'http://x', method: 'POST', headers: {}, body: '' },
      },
      {
        v: 1,
        id: 'h1',
        method: 'sign',
        params: {
          identity: 'k',
          scheme: 'rsa_pss_rsae_sha256',
          mode: 'digest',
          digest: 'AA==',
          context: { purpose: 'tls12-client-certificate-verify', host: 'x', conn: 1, handshake: 1 },
        },
      },
      {
        v: 1,
        id: 'h1',
        method: 'sign',
        params: {
          identity: 'k',
          scheme: 'rsa_pkcs1_sha256',
          mode: 'message',
          digest: 'AA==',
          context: { purpose: 'tls12-client-certificate-verify', host: 'x', conn: 1, handshake: 1 },
        },
      },
      { v: 1, id: 'c1', method: 'dfe.sign', params: { identity: 'k', signedInfo: 'AA==', hash: 'MD5' } },
    ];
    for (const b of bad) expect(validate(schema, b).length).toBeGreaterThan(0);
  });
});

describe('guarda: os casos de guard.json na allowlistPolicy', async () => {
  const fx = (await Bun.file(path.join(DIR, 'fixtures/guard.json')).json()) as {
    cases: {
      name: string;
      ambientes: Ambiente[];
      tpAmb?: '1' | '2';
      requireTpAmb?: boolean;
      url: string;
      method: 'GET' | 'POST';
      headers: Record<string, string>;
      body: string;
      allow: boolean;
    }[];
  };
  test.each(fx.cases.map((c) => [c.name, c] as const))('%s', async (_, c) => {
    const lab = c.ambientes.length === 0;
    const url = new URL(c.url);
    const hosts = lab ? ['127.0.0.1', 'localhost', '::1'] : c.ambientes.flatMap((a) => ambienteHosts(a));
    const policy = allowlistPolicy({
      hosts,
      ...(lab ? { ports: [url.port === '' ? 443 : Number(url.port)] } : {}),
      ...(c.tpAmb === undefined ? {} : { tpAmb: c.tpAmb }),
      ...(c.requireTpAmb === undefined ? {} : { requireTpAmbInBody: c.requireTpAmb }),
    });
    const r = await prepareRequest(
      {
        url: c.url,
        method: c.method,
        headers: c.headers,
        ...(c.body === '' && c.method === 'GET' ? {} : { body: c.body }),
      },
      { identity: { kind: 'pem', certChain: '', key: '' }, policy },
    ).then(
      () => true,
      () => false,
    );
    expect(r).toBe(c.allow);
  });
});

/** Helper de mentira: responde com os frames da fixture e deixa o teste olhar o que o cliente mandou. */
function scriptedHelper(onFrame: (f: Record<string, unknown>, reply: (frame: object) => void) => void): {
  channel: SignerChannel;
  sent: Record<string, unknown>[];
} {
  let listener: (line: string) => void = () => {};
  const closers: ((r: string) => void)[] = [];
  const sent: Record<string, unknown>[] = [];
  const reply = (frame: object): void => {
    queueMicrotask(() => listener(JSON.stringify(frame)));
  };
  return {
    sent,
    channel: {
      send: (line) => {
        const f = JSON.parse(line) as Record<string, unknown>;
        sent.push(f);
        onFrame(f, reply);
      },
      onLine: (l) => {
        listener = l;
      },
      onClose: (l) => {
        closers.push(l);
      },
      close: async () => {
        for (const c of closers) c('fechado');
      },
    },
  };
}

const frameOf = (file: string, pred: (f: FxFrame) => boolean): FxFrame['frame'] => {
  const fx = fixtures.find((x) => x.name.endsWith(file));
  const fr = fx?.frames.find(pred);
  if (!fr) throw new Error(`fixture ${file} sem o frame pedido`);
  return fr.frame;
};

const HELLO = frameOf('hello.json', (f) => f.of === 'hello').result as Record<string, unknown>;
const OPENED = frameOf('identity_open_remote.json', (f) => f.of === 'identity.open').result as Record<string, unknown>;

describe('cliente contra as conversas das fixtures', () => {
  test('http.request com sign no meio da renegociação', async () => {
    const req = frameOf('http_request_renegotiation.json', (f) => f.frame.method === 'http.request');
    const sign = frameOf('http_request_renegotiation.json', (f) => f.frame.method === 'sign');
    const res = frameOf('http_request_renegotiation.json', (f) => f.of === 'http.request');
    const signedWith: unknown[] = [];
    const { channel, sent } = scriptedHelper((f, reply) => {
      if (f.method === 'hello') reply({ v: 1, id: f.id, result: HELLO });
      else if (f.method === 'identity.open')
        reply({ v: 1, id: f.id, result: { ...OPENED, id: (f.params as { id: string }).id } });
      else if (f.method === 'http.request') {
        const identity = (f.params as { identity: string }).identity;
        const p = sign.params as Record<string, unknown>;
        reply({ v: 1, id: 'h1', method: 'sign', params: { ...p, identity } });
        (globalThis as { __pending?: unknown }).__pending = { id: f.id, reply };
      } else if (f.id === 'h1') {
        expect(validate(schema, f as Json)).toEqual([]);
        expect(validate(resultDef('sign'), f.result as Json)).toEqual([]);
        const pend = (globalThis as { __pending?: { id: string; reply: (x: object) => void } }).__pending;
        pend?.reply({ v: 1, id: pend.id, result: res.result });
      }
    });
    const c = await connectSignerChannel(channel);
    const signer: TlsSigner = {
      mode: 'digest',
      certificateChain: async () => [new Uint8Array([0x30, 0x82])],
      sign: async (input, scheme, ctx) => {
        signedWith.push({ len: input.length, scheme, ctx });
        return new Uint8Array([1, 2, 3]);
      },
    };
    const id = await c.openRemote({
      id: 'emitente-11222333000181',
      signer,
      allowedHosts: ['homologacao.nfe.fazenda.sp.gov.br'],
    });
    const params = req.params as { url: string; headers: Record<string, string> };
    const r = await c.request(id.id, {
      url: params.url,
      method: 'POST',
      headers: params.headers,
      body: new TextEncoder().encode('<soap>'),
      timeoutMs: 60_000,
    });
    expect(r.status).toBe(200);
    expect(r.tls).toMatchObject({ protocol: 'TLS 1.2', signatures: 1, resumed: false });
    expect(r.text()).toBe('<soap>');
    expect(signedWith).toEqual([
      {
        len: 32,
        scheme: 'rsa_pkcs1_sha256',
        ctx: {
          host: 'homologacao.nfe.fazenda.sp.gov.br',
          purpose: 'tls12-client-certificate-verify',
          connectionId: '1',
          handshake: 2,
        },
      },
    ]);
    // Todo frame que o cliente mandou passa pelo schema, e o http.request tem as chaves da fixture.
    for (const f of sent) expect(validate(schema, f as Json)).toEqual([]);
    const httpSent = sent.find((f) => f.method === 'http.request') as { params: Record<string, unknown> };
    expect(Object.keys(httpSent.params).sort()).toEqual(
      Object.keys(req.params as object)
        .filter((k) => k !== 'service')
        .sort(),
    );
  });

  test('erros do helper viram os erros tipados do sinete', async () => {
    const errs: Record<string, object> = {
      'https://guard.invalid/': frameOf('errors.json', (f) => f.from === 'helper' && f.frame.id === 'c20')
        .error as object,
      'https://alert.invalid/': frameOf('errors.json', (f) => f.frame.id === 'c24').error as object,
      'https://sign.invalid/': frameOf('errors.json', (f) => f.frame.id === 'c25').error as object,
      'https://timeout.invalid/': { code: 'transport', message: 'x', data: { stage: 'response', timeout: true } },
      'https://p11.invalid/': { code: 'pkcs11', message: 'C_Sign: CKR_DEVICE_REMOVED' },
      'https://stimeout.invalid/': { code: 'sign_timeout', message: 'sign sem resposta' },
      'https://reset.invalid/': { code: 'transport', message: 'EOF', data: { stage: 'response', reset: true } },
      'https://ca.invalid/': {
        code: 'transport',
        message: 'x509',
        data: { stage: 'handshake', x509: 'unknown_authority' },
      },
      'https://bad.invalid/': { code: 'identity_exists', message: 'x' },
    };
    const { channel } = scriptedHelper((f, reply) => {
      if (f.method === 'hello') reply({ v: 1, id: f.id, result: HELLO });
      else if (f.method === 'http.request') reply({ v: 1, id: f.id, error: errs[(f.params as { url: string }).url] });
    });
    const c = await connectSignerChannel(channel);
    const send = (url: string) =>
      c.request('k', { url, method: 'GET', headers: {}, body: undefined, timeoutMs: 1000 }).catch((e: unknown) => e);
    expect(await send('https://guard.invalid/')).toBeInstanceOf(PolicyError);
    expect(await send('https://alert.invalid/')).toMatchObject({
      code: 'certificado_nao_apresentado',
      details: { alert: 'handshake_failure', stage: 'handshake' },
    });
    expect(await send('https://sign.invalid/')).toMatchObject({ name: 'SignerError', code: 'assinatura_tls_recusada' });
    expect(await send('https://timeout.invalid/')).toBeInstanceOf(TimeoutError);
    expect(await send('https://p11.invalid/')).toMatchObject({ code: 'pkcs11_falhou' });
    expect(await send('https://stimeout.invalid/')).toMatchObject({ code: 'assinatura_tls_expirou' });
    expect(await send('https://reset.invalid/')).toMatchObject({ code: 'conexao_recusada' });
    expect(await send('https://ca.invalid/')).toMatchObject({ code: 'cadeia_servidor_nao_confiavel' });
    const proto = await send('https://bad.invalid/');
    expect(proto).toBeInstanceOf(SignerError);
    expect(proto).toMatchObject({ code: 'signer_protocolo' });
    expect(await send('https://reset.invalid/')).toBeInstanceOf(TransportError);
  });

  test('recusa helper de outra versão e o sign fora da política do dono da chave', async () => {
    const v2 = scriptedHelper((f, reply) => reply({ v: 1, id: f.id, result: { ...HELLO, protocol: 2 } }));
    await expect(connectSignerChannel(v2.channel)).rejects.toMatchObject({ code: 'signer_protocolo' });
    // Helper v2 de verdade responde com v: 2 no frame: falha já, sem esperar o prazo do controle.
    const v2frame = scriptedHelper((f, reply) => reply({ v: 2, id: f.id, result: { ...HELLO, protocol: 2 } }));
    const t0 = performance.now();
    await expect(connectSignerChannel(v2frame.channel, { controlTimeoutMs: 30_000 })).rejects.toMatchObject({
      code: 'signer_protocolo',
    });
    expect(performance.now() - t0).toBeLessThan(5_000);

    const refused = frameOf('errors.json', (f) => f.frame.id === 'h9');
    const answers: Record<string, unknown>[] = [];
    const { channel } = scriptedHelper((f, reply) => {
      if (f.method === 'hello') reply({ v: 1, id: f.id, result: HELLO });
      else if (f.method === 'identity.open') {
        reply({ v: 1, id: f.id, result: { ...OPENED, id: 'emitente-11222333000181' } });
        reply(refused);
      } else if (f.id === 'h9') answers.push(f);
    });
    const c = await connectSignerChannel(channel);
    let calls = 0;
    await c.openRemote({
      id: 'emitente-11222333000181',
      signer: {
        mode: 'digest',
        certificateChain: async () => [new Uint8Array([0x30])],
        sign: async () => {
          calls++;
          return new Uint8Array([1]);
        },
      },
      allowedHosts: ['homologacao.nfe.fazenda.sp.gov.br'],
    });
    await Bun.sleep(10);
    expect(calls).toBe(0);
    expect(answers).toEqual([
      {
        v: 1,
        id: 'h9',
        error: { code: 'sign_refused', message: 'host fora da política do dono da chave: cav.receita.fazenda.gov.br' },
      },
    ]);
  });

  test('canal que fecha no meio: signer_indisponivel', async () => {
    let close: () => void = () => {};
    const { channel } = scriptedHelper((f, reply) => {
      if (f.method === 'hello') reply({ v: 1, id: f.id, result: HELLO });
      else close();
    });
    const orig = channel.onClose;
    channel.onClose = (l) => {
      close = () => l('processo saiu (1)');
      orig(l);
    };
    const c = await connectSignerChannel(channel);
    await expect(c.stats()).rejects.toMatchObject({ code: 'signer_indisponivel' });
  });
});

test('parseTlsTranscript lê o SNI e a folha do servidor', () => {
  const sni = new TextEncoder().encode('nfe-homologacao.svrs.rs.gov.br');
  const ext = [0, 0, 0, sni.length + 5, 0, sni.length + 3, 0, 0, sni.length, ...sni];
  const body = [3, 3, ...new Array(32).fill(0), 0, 0, 2, 0xc0, 0x2f, 1, 0, 0, ext.length, ...ext];
  const hello = [1, 0, 0, body.length, ...body];
  const cert = [0x30, 0x03, 1, 2, 3];
  const certBody = [0, 0, cert.length + 3, 0, 0, cert.length, ...cert];
  const certMsg = [11, 0, 0, certBody.length, ...certBody];
  const t = parseTlsTranscript(new Uint8Array([...hello, 2, 0, 0, 0, ...certMsg]));
  expect(t.sni).toBe('nfe-homologacao.svrs.rs.gov.br');
  expect([...(t.serverCertificate ?? [])]).toEqual(cert);
});

/** Transcript mínimo: ClientHello (com SNI, se houver) e o Certificate do servidor com a folha dada. */
function transcript(sni: string | undefined, leaf: Uint8Array): Uint8Array {
  const name = new TextEncoder().encode(sni ?? '');
  const ext = sni === undefined ? [] : [0, 0, 0, name.length + 5, 0, name.length + 3, 0, 0, name.length, ...name];
  const body = [3, 3, ...new Array(32).fill(0), 0, 0, 2, 0xc0, 0x2f, 1, 0, 0, ext.length, ...ext];
  const hello = [1, 0, 0, body.length, ...body];
  const n = leaf.length;
  const certBody = [0, (n + 3) >> 8, (n + 3) & 0xff, 0, n >> 8, n & 0xff, ...leaf];
  const certMsg = [11, 0, certBody.length >> 8, certBody.length & 0xff, ...certBody];
  return new Uint8Array([...hello, 2, 0, 0, 0, ...certMsg]);
}

// Autoassinado e descartável, com iPAddress 127.0.0.1 e ::1 no SAN (o mesmo do teste do @sinete/cert).
const IP_SAN_PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIB8jCCAZigAwIBAgIUYDkyu6xxlKsqlNGYawjDpeJG+EowCgYIKoZIzj0EAwIw',
  'GTEXMBUGA1UEAwwOaXAtc2FuLmludmFsaWQwHhcNMjYwOTI4MTQyODAyWhcNMzYw',
  'OTI1MTQyODAyWjAZMRcwFQYDVQQDDA5pcC1zYW4uaW52YWxpZDBZMBMGByqGSM49',
  'AgEGCCqGSM49AwEHA0IABPSPISeOUb7VUwZJDXXi2UBHKiFHLDHt5ekL9r5HS8wk',
  'X4CpADfSW80chW26mc6R4fRBo6hTtV1gewfhOnRri2yjgb0wgbowHQYDVR0OBBYE',
  'FKMoe4ywEs5U9Hwgf2t1JHn34a9KMB8GA1UdIwQYMBaAFKMoe4ywEs5U9Hwgf2t1',
  'JHn34a9KMA8GA1UdEwEB/wQFMAMBAf8wZwYDVR0RBGAwXoIOaXAtc2FuLmludmFs',
  'aWSHBH8AAAGHEAAAAAAAAAAAAAAAAAAAAAGHECABDbgAAAAAAAEAAAAAAAGHECAB',
  'DbgAAAABAAEAAQABAAGHEP6AAAAAAAABAAAAAAAAAAAwCgYIKoZIzj0EAwIDSAAw',
  'RQIgQX0iyJ+e8+m6xg2iQKrcjVAZ0J4ngnxM+AzY8poPnqcCIQCEwjY0OPaO4YW9',
  '8w9y7+nGceVHboB/Ocfa54/JFpHcPQ==',
  '-----END CERTIFICATE-----',
].join('\n');

describe('modo message com destino IP: sem SNI e com o endereço no iPAddress do certificado', () => {
  const ipLeaf = new Uint8Array(new X509Certificate(IP_SAN_PEM).raw);
  const semIp = icpBrasilCertificates()[0]?.der ?? new Uint8Array();

  async function signAs(
    host: string,
    t: Uint8Array,
    allowedHosts: string[] = [host],
  ): Promise<Record<string, unknown>> {
    const sha = new Uint8Array(await crypto.subtle.digest('SHA-256', t as Uint8Array<ArrayBuffer>));
    let answer: Record<string, unknown> = {};
    const { channel } = scriptedHelper((f, reply) => {
      if (f.method === 'hello') reply({ v: 1, id: f.id, result: HELLO });
      else if (f.method === 'identity.open') {
        reply({ v: 1, id: f.id, result: { ...OPENED, id: 'ip' } });
        reply({
          v: 1,
          id: 'h1',
          method: 'sign',
          params: {
            identity: 'ip',
            scheme: 'rsa_pkcs1_sha256',
            mode: 'message',
            message: Buffer.from(t).toString('base64'),
            messageSha256: Buffer.from(sha).toString('base64'),
            context: { purpose: 'tls12-client-certificate-verify', host, conn: 1, handshake: 1 },
          },
        });
      } else if (f.id === 'h1') answer = f;
    });
    const c = await connectSignerChannel(channel);
    await c.openRemote({
      id: 'ip',
      signer: {
        mode: 'message',
        certificateChain: async () => [new Uint8Array([0x30])],
        sign: async () => new Uint8Array([1]),
      },
      allowedHosts,
    });
    for (let i = 0; i < 50 && !('result' in answer || 'error' in answer); i++) await Bun.sleep(5);
    return answer;
  }

  test('IPv4 e IPv6 cobertos pelo certificado: assina', async () => {
    expect(await signAs('127.0.0.1', transcript(undefined, ipLeaf))).toMatchObject({ result: { signature: 'AQ==' } });
    expect(await signAs('::1', transcript(undefined, ipLeaf), ['[::1]'])).toMatchObject({
      result: { signature: 'AQ==' },
    });
    // IPv4 mapeado em IPv6 é o mesmo endereço do iPAddress 127.0.0.1, como o Go o compara.
    expect(await signAs('::ffff:127.0.0.1', transcript(undefined, ipLeaf), ['[::ffff:127.0.0.1]'])).toMatchObject({
      result: { signature: 'AQ==' },
    });
    expect(await signAs('::ffff:7f00:1', transcript(undefined, ipLeaf), ['127.0.0.1'])).toMatchObject({
      result: { signature: 'AQ==' },
    });
    expect(await signAs('::ffff:10.0.0.1', transcript(undefined, ipLeaf))).toMatchObject({
      error: { code: 'sign_refused', message: 'o certificado do servidor não cobre o endereço 10.0.0.1' },
    });
  });

  test('certificado sem o endereço, ou SNI presente: recusa', async () => {
    expect(await signAs('127.0.0.1', transcript(undefined, semIp))).toMatchObject({
      error: { code: 'sign_refused', message: 'o certificado do servidor não cobre o endereço 127.0.0.1' },
    });
    expect(await signAs('127.0.0.1', transcript('127.0.0.1', ipLeaf))).toMatchObject({
      error: { code: 'sign_refused' },
    });
  });
});

test('openRemote com id já aberto não mexe na chave da identidade aberta', async () => {
  const { channel, sent } = scriptedHelper((f, reply) => {
    if (f.method === 'hello') reply({ v: 1, id: f.id, result: HELLO });
    else if (f.method === 'identity.open') reply({ v: 1, id: f.id, result: { ...OPENED, id: 'a' } });
  });
  const c = await connectSignerChannel(channel);
  const signer = {
    mode: 'digest' as const,
    certificateChain: async () => [new Uint8Array([0x30])],
    sign: async () => new Uint8Array([1]),
  };
  await c.openRemote({ id: 'a', signer, allowedHosts: ['localhost'] });
  await expect(c.openRemote({ id: 'a', signer, allowedHosts: ['localhost'] })).rejects.toMatchObject({
    code: 'signer_protocolo',
    details: { code: 'identity_exists' },
  });
  expect(sent.filter((f) => f.method === 'identity.open')).toHaveLength(1);
});

test('identity.open que responde depois do prazo: o cliente fecha a identidade que ninguém recebeu', async () => {
  const atrasados: (() => void)[] = [];
  const { channel, sent } = scriptedHelper((f, reply) => {
    const params = f.params as Record<string, unknown>;
    if (f.method === 'hello') reply({ v: 1, id: f.id, result: { ...HELLO, backends: ['remote', 'pkcs11'] } });
    else if (f.method === 'identity.open' && atrasados.length < 2) {
      atrasados.push(() => reply({ v: 1, id: f.id, result: { ...OPENED, id: params.id } }));
    } else if (f.method === 'identity.open') reply({ v: 1, id: f.id, result: { ...OPENED, id: params.id } });
    else if (f.method === 'identity.close') reply({ v: 1, id: f.id, result: { closed: true } });
  });
  const logger = memoryLogger();
  const c = await connectSignerChannel(channel, { controlTimeoutMs: 20, logger });
  const signer = {
    mode: 'digest' as const,
    certificateChain: async () => [new Uint8Array([0x30])],
    sign: async () => new Uint8Array([1]),
  };
  await expect(c.openRemote({ id: 'a', signer, allowedHosts: ['localhost'] })).rejects.toBeInstanceOf(TimeoutError);
  await expect(
    c.openPkcs11({ id: 'p', module: '/lab/libsofthsm2.so', token: 'lab', pin: async () => '0000' }),
  ).rejects.toBeInstanceOf(TimeoutError);
  expect(sent.some((f) => f.method === 'identity.close')).toBe(false);

  for (const r of atrasados) r();
  await Bun.sleep(0);
  await Bun.sleep(0);
  const closes = sent.filter((f) => f.method === 'identity.close').map((f) => f.params);
  expect(closes).toEqual([{ identity: 'a' }, { identity: 'p' }]);
  expect(logger.entries.filter((e) => e.level === 'warn')).toHaveLength(2);

  // Fechada a identidade atrasada, o mesmo id abre de novo no canal.
  expect((await c.openRemote({ id: 'a', signer, allowedHosts: ['localhost'] })).id).toBe('a');
});

test('chamador que desiste: o cliente manda cancel com o id da requisição ao helper', async () => {
  const { channel, sent } = scriptedHelper((f, reply) => {
    if (f.method === 'hello') reply({ v: 1, id: f.id, result: HELLO });
    else if (f.method === 'identity.open') reply({ v: 1, id: f.id, result: { ...OPENED, id: 'a' } });
    else if (f.method === 'cancel') reply({ v: 1, id: f.id, result: { cancelled: true } });
  });
  const c = await connectSignerChannel(channel);
  await c.openRemote({
    id: 'a',
    signer: {
      mode: 'digest',
      certificateChain: async () => [new Uint8Array([0x30])],
      sign: async () => new Uint8Array(),
    },
    allowedHosts: ['localhost'],
  });
  const ac = new AbortController();
  const p = c.request(
    'a',
    {
      url: 'https://localhost/',
      method: 'GET',
      headers: {},
      body: undefined,
      timeoutMs: 60_000,
    },
    ac.signal,
  );
  ac.abort();
  await expect(p).rejects.toMatchObject({ code: 'cancelado' });
  const req = sent.find((f) => f.method === 'http.request');
  const cancel = sent.find((f) => f.method === 'cancel');
  expect(cancel?.params).toEqual({ id: req?.id });
  expect(validate(schema, cancel as Json)).toEqual([]);

  const antes = sent.length;
  const ja = new AbortController();
  ja.abort();
  await expect(
    c.request(
      'a',
      { url: 'https://localhost/', method: 'GET', headers: {}, body: undefined, timeoutMs: 60_000 },
      ja.signal,
    ),
  ).rejects.toMatchObject({ code: 'cancelado' });
  expect(sent.slice(antes).some((f) => f.method === 'cancel')).toBe(false);
});

test('linha com JSON que não é objeto (null, número, lista) vira aviso, não exceção', async () => {
  let listener: (line: string) => void = () => {};
  const logger = memoryLogger();
  const c = connectSignerChannel(
    {
      send: (line) => {
        const f = JSON.parse(line) as { id: string };
        queueMicrotask(() => {
          for (const junk of ['null', '42', '[1]', '"x"']) listener(junk);
          listener(JSON.stringify({ v: 1, id: f.id, result: HELLO }));
        });
      },
      onLine: (l) => {
        listener = l;
      },
      onClose: () => {},
      close: async () => {},
    },
    { logger },
  );
  await expect(c).resolves.toMatchObject({ protocolVersion: 1 });
  expect(logger.entries.filter((e) => e.msg === 'sinete-signer: linha que não é frame')).toHaveLength(4);
});

test('canal que fecha (ou cujo send lança) no meio de um sign: a resposta não sai e nada escapa', async () => {
  const soltas: unknown[] = [];
  const onUnhandled = (e: unknown): void => {
    soltas.push(e);
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    for (const fecharAntes of [true, false]) {
      let listener: (line: string) => void = () => {};
      const closers: ((r: string) => void)[] = [];
      let quebrado = false;
      let liberar: () => void = () => {};
      const logger = memoryLogger();
      const channel: SignerChannel = {
        send: (line) => {
          if (quebrado) throw new Error('canal fechado');
          const f = JSON.parse(line) as { id: string; method?: string };
          queueMicrotask(() => {
            if (f.method === 'hello') listener(JSON.stringify({ v: 1, id: f.id, result: HELLO }));
            else if (f.method === 'identity.open') {
              listener(JSON.stringify({ v: 1, id: f.id, result: { ...OPENED, id: 'a' } }));
              listener(
                JSON.stringify({
                  v: 1,
                  id: 'h1',
                  method: 'sign',
                  params: {
                    identity: 'a',
                    scheme: 'rsa_pkcs1_sha256',
                    mode: 'digest',
                    digest: Buffer.alloc(32).toString('base64'),
                    context: { purpose: 'tls12-client-certificate-verify', host: 'localhost', conn: 1, handshake: 1 },
                  },
                }),
              );
            }
          });
        },
        onLine: (l) => {
          listener = l;
        },
        onClose: (l) => {
          closers.push(l);
        },
        close: async () => {},
      };
      const c = await connectSignerChannel(channel, { logger });
      await c.openRemote({
        id: 'a',
        signer: {
          mode: 'digest',
          certificateChain: async () => [new Uint8Array([0x30])],
          sign: () =>
            new Promise((resolve) => {
              liberar = () => resolve(new Uint8Array([1]));
            }),
        },
        allowedHosts: ['localhost'],
      });
      await Bun.sleep(5);
      quebrado = true;
      if (fecharAntes) for (const l of closers) l('processo saiu (1)');
      liberar();
      await Bun.sleep(20);
      if (!fecharAntes) {
        expect(logger.entries.some((e) => e.msg === 'sinete-signer: resposta ao helper não saiu')).toBe(true);
      }
    }
    expect(soltas).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('send que lança: a chamada falha com signer_indisponivel e não deixa prazo nem pendência', async () => {
  let quebrado = false;
  const { channel } = scriptedHelper((f, reply) => {
    if (f.method === 'hello') reply({ v: 1, id: f.id, result: HELLO });
  });
  const orig = channel.send;
  channel.send = (line) => {
    if (quebrado) throw new Error('EPIPE');
    orig(line);
  };
  const c = await connectSignerChannel(channel, { controlTimeoutMs: 60_000 });
  quebrado = true;
  const t0 = performance.now();
  const e = await c.stats().catch((x: unknown) => x);
  expect(e).toBeInstanceOf(SignerError);
  expect(e).toMatchObject({ code: 'signer_indisponivel' });
  expect(performance.now() - t0).toBeLessThan(1_000);
  const ac = new AbortController();
  const p = c.request(
    'a',
    { url: 'https://localhost/', method: 'GET', headers: {}, body: undefined, timeoutMs: 1_000 },
    ac.signal,
  );
  await expect(p).rejects.toMatchObject({ code: 'signer_indisponivel' });
  ac.abort();
});

test('hello que falha (erro, prazo ou outra versão) fecha o canal recebido', async () => {
  const casos: ((f: Record<string, unknown>, reply: (frame: object) => void) => void)[] = [
    (f, reply) => reply({ v: 1, id: f.id, error: { code: 'error', message: 'quebrou' } }),
    () => {},
    (f, reply) => reply({ v: 2, id: f.id, result: HELLO }),
  ];
  for (const responder of casos) {
    const { channel } = scriptedHelper(responder);
    let fechado = false;
    const close = channel.close;
    channel.close = async () => {
      fechado = true;
      await close();
    };
    await expect(connectSignerChannel(channel, { controlTimeoutMs: 50 })).rejects.toBeInstanceOf(Error);
    expect(fechado).toBe(true);
  }
});
