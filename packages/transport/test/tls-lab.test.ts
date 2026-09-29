/**
 * Laboratório TLS: o transporte contra servidores locais que imitam o que a SEFAZ faz (renegociação iniciada pelo
 * servidor, só CBC, só DHE, certificado exigido no handshake), em Bun (em processo), Node e Deno (subprocessos). Nada
 * sai de 127.0.0.1. Sem OpenSSL 3 no PATH, a suíte é pulada; sem `node` com type stripping ou sem `deno`, só a
 * runtime ausente é pulada.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import path from 'node:path';
import { bytesToBase64 } from '@sinete/cert';
import type { LabClientInput, LabClientResult } from './lab/client-core.ts';
import { runLabClient } from './lab/client-core.ts';
import type { Pki } from './lab/pki.ts';
import { createPki, findOpenssl } from './lab/pki.ts';
import { presentedInRenegotiation, renegotiationServer, wwwServer } from './lab/servers.ts';

const openssl = findOpenssl();
const clientScript = path.join(import.meta.dir, 'lab/client.ts');

function nodeWithTypeStripping(): boolean {
  const r = Bun.spawnSync(['node', '-e', 'process.exit(process.features.typescript ? 0 : 1)']);
  return r.exitCode === 0;
}
const runtimes: ('bun' | 'node' | 'deno')[] = ['bun'];
if (openssl && nodeWithTypeStripping()) runtimes.push('node');
if (openssl && Bun.which('deno')) runtimes.push('deno');

async function run(runtime: 'bun' | 'node' | 'deno', input: LabClientInput): Promise<LabClientResult> {
  if (runtime === 'bun') return runLabClient(input);
  const cmd =
    runtime === 'node'
      ? ['node', clientScript, JSON.stringify(input)]
      : ['deno', 'run', '--allow-all', '--quiet', clientScript, JSON.stringify(input)];
  const p = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe', cwd: path.join(import.meta.dir, '..') });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  const last = out.trim().split('\n').at(-1) ?? '';
  try {
    return JSON.parse(last) as LabClientResult;
  } catch {
    throw new Error(`${runtime}: saída inesperada: ${out} ${err}`);
  }
}

const RENEG_PROFILE = {
  clientCert: 'renegotiation',
  ecdheAead: true,
  clientCertEvidence: 'verificado',
  cipher: 'x',
} as const;
const DHE_PROFILE = {
  clientCert: 'handshake',
  ecdheAead: false,
  keyExchange: 'dhe',
  cipher: 'DHE-RSA-AES128-GCM-SHA256',
} as const;
const CBC_PROFILE = {
  clientCert: 'handshake',
  ecdheAead: false,
  keyExchange: 'ecdhe',
  cipher: 'ECDHE-RSA-AES128-SHA256',
} as const;

describe.skipIf(!openssl)('laboratório TLS', () => {
  let pki: Pki;
  let base: Omit<LabClientInput, 'url'>;
  const handshakeArgs = (): string[] => [
    '-tls1_2',
    '-Verify',
    '1',
    '-verify_return_error',
    '-CAfile',
    pki.files.ca,
    '-naccept',
    '1',
  ];

  beforeAll(() => {
    pki = createPki();
    base = { certChain: pki.clientCertPem, key: pki.clientKeyPem, additionalCa: [pki.caPem] };
  });
  afterAll(() => pki?.cleanup());

  describe.each(runtimes)('%s', (runtime) => {
    const nodeLike = runtime !== 'deno';

    test('certificado pedido no handshake: o servidor recebe o certificado', async () => {
      const srv = await wwwServer(pki, handshakeArgs());
      const r = await run(runtime, { ...base, url: `${srv.url}/` });
      await srv.finished(1000);
      expect(r.error).toBeUndefined();
      expect(r.status).toBe(200);
      expect(r.body).toContain('Subject: CN=Cliente de laboratorio');
      if (nodeLike) expect(r.tls).toMatchObject({ protocol: 'TLSv1.2', clientCertificateLoaded: true });
    });

    test('renegociação iniciada pelo servidor, como o IIS da SEFAZ', async () => {
      const srv = await renegotiationServer(pki);
      const r = await run(runtime, { ...base, url: `${srv.url}/NfeStatusServico4.asmx` });
      const log = await srv.finished(1500);
      if (nodeLike) {
        expect(r.error).toBeUndefined();
        expect(r.status).toBe(200);
        expect(r.body).toBe('renegociado');
        expect(presentedInRenegotiation(log)).toBe(true);
      } else {
        // rustls responde no_renegotiation: é por isso que o transporte do Deno recusa esses hosts antes.
        expect(log).toContain('no_renegotiation');
        expect(r.error?.code).toBe('certificado_nao_apresentado');
        expect(presentedInRenegotiation(log)).toBe(false);
      }
    });

    test('host com perfil de renegociação', async () => {
      const srv = await renegotiationServer(pki);
      const r = await run(runtime, { ...base, url: `${srv.url}/x`, profile: RENEG_PROFILE });
      const log = await srv.finished(nodeLike ? 1500 : 300);
      if (nodeLike) {
        expect(r.status).toBe(200);
        expect(presentedInRenegotiation(log)).toBe(true);
      } else {
        expect(r.error).toMatchObject({ name: 'TransportUnsupportedError', code: 'nao_suportado' });
        expect(r.error?.details).toMatchObject({ host: '127.0.0.1' });
        // recusa antes de abrir socket
        expect(log).not.toContain('ClientHello');
      }
    });

    test('host só com CBC', async () => {
      const srv = await wwwServer(pki, [...handshakeArgs(), '-cipher', 'ECDHE-RSA-AES128-SHA256']);
      const r = await run(runtime, { ...base, url: `${srv.url}/` });
      await srv.finished(1000);
      if (nodeLike) {
        expect(r.status).toBe(200);
        expect(r.body).toContain('Cipher is ECDHE-RSA-AES128-SHA256');
        expect(r.body).toContain('Subject: CN=Cliente de laboratorio');
      } else {
        expect(r.error?.code).toBe('certificado_nao_apresentado');
        expect(r.error?.details).toMatchObject({ alert: 'handshake_failure' });
      }
    });

    test('host só com CBC e perfil nos dados', async () => {
      const srv = await wwwServer(pki, [...handshakeArgs(), '-cipher', 'ECDHE-RSA-AES128-SHA256']);
      const r = await run(runtime, { ...base, url: `${srv.url}/`, profile: CBC_PROFILE });
      const log = await srv.finished(nodeLike ? 1000 : 300);
      if (nodeLike) expect(r.status).toBe(200);
      else {
        expect(r.error).toMatchObject({ name: 'TransportUnsupportedError', code: 'nao_suportado' });
        expect(log).not.toContain('Cipher is');
      }
    });

    test('host só com DHE: só o Node fala (BoringSSL e rustls não têm DHE)', async () => {
      const srv = await wwwServer(pki, [...handshakeArgs(), '-cipher', 'DHE-RSA-AES128-GCM-SHA256']);
      const r = await run(runtime, { ...base, url: `${srv.url}/` });
      await srv.finished(1000);
      if (runtime === 'node') {
        expect(r.status).toBe(200);
        expect(r.body).toContain('Cipher is DHE-RSA-AES128-GCM-SHA256');
      } else expect(r.error?.details).toMatchObject({ alert: 'handshake_failure' });
      // com o perfil de GO produção nos dados, Bun e Deno recusam antes de abrir socket
      const srv2 = await wwwServer(pki, [...handshakeArgs(), '-cipher', 'DHE-RSA-AES128-GCM-SHA256']);
      const r2 = await run(runtime, { ...base, url: `${srv2.url}/`, profile: DHE_PROFILE });
      await srv2.finished(runtime === 'node' ? 1000 : 300);
      if (runtime === 'node') expect(r2.status).toBe(200);
      else expect(r2.error).toMatchObject({ name: 'TransportUnsupportedError', code: 'nao_suportado' });
    });

    test('política recusa antes de abrir socket', async () => {
      const srv = await wwwServer(pki, handshakeArgs());
      const r = await run(runtime, { ...base, url: `${srv.url}/`, allowHosts: ['homologacao.exemplo.invalid'] });
      const log = await srv.finished(300);
      expect(r.error).toMatchObject({ name: 'PolicyError', code: 'politica_recusou' });
      expect(log).not.toContain('Cipher is');
    });

    test('PFX legado (RC2-40 + 3DES) lido em JS e apresentado no TLS', async () => {
      if (!pki.clientPfxLegacy) return;
      const pfx = { pfxB64: bytesToBase64(pki.clientPfxLegacy), password: 'lab', additionalCa: [pki.caPem] };
      const srv = await wwwServer(pki, handshakeArgs());
      const r = await run(runtime, { ...pfx, url: `${srv.url}/` });
      await srv.finished(1000);
      expect(r.status).toBe(200);
      expect(r.body).toContain('Subject: CN=Cliente de laboratorio');
      if (nodeLike) {
        const reneg = await renegotiationServer(pki);
        const r2 = await run(runtime, { ...pfx, url: `${reneg.url}/` });
        expect(r2.status).toBe(200);
        expect(presentedInRenegotiation(await reneg.finished(1500))).toBe(true);
      }
    });

    test('servidor que recusa a AC do cliente', async () => {
      const bad = path.join(pki.dir, 'badca.pem');
      const srv = await wwwServer(pki, [
        '-tls1_2',
        '-Verify',
        '1',
        '-verify_return_error',
        '-CAfile',
        bad,
        '-naccept',
        '1',
      ]);
      const r = await run(runtime, { ...base, url: `${srv.url}/` });
      await srv.finished(1000);
      expect(r.error?.code).toBe('certificado_recusado');
      expect(r.error?.details).toMatchObject({ alert: 'unknown_ca' });
    });

    test('cadeia do servidor fora da confiança', async () => {
      const srv = await wwwServer(pki, ['-tls1_2', '-naccept', '1'], 'badSrv');
      const r = await run(runtime, { ...base, url: `${srv.url}/` });
      await srv.finished(500);
      expect(r.error?.code).toBe('cadeia_servidor_nao_confiavel');
    });

    test('certificado do servidor de outro host', async () => {
      const srv = await wwwServer(pki, ['-tls1_2', '-naccept', '1'], 'wrongName');
      const r = await run(runtime, { ...base, url: `${srv.url}/` });
      await srv.finished(500);
      expect(r.error?.code).toBe('nome_servidor_divergente');
    });
  });
});
