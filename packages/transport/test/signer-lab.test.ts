/**
 * O cliente `@sinete/transport/signer` contra o helper `sinete-signer` de verdade, compilado na hora, e contra os
 * servidores do laboratório TLS (`openssl s_server` que renegocia como o IIS, só CBC, só DHE). Nada sai do loopback:
 * o helper sobe com `--lab`. Com SoftHSM instalado, o mesmo vale para o token PKCS#11, com a chave gerada dentro dele.
 * Sem Go ou sem OpenSSL 3, a suíte é pulada.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { constants, createPrivateKey, privateEncrypt, X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loggerEmMemoria } from '@sinete/core';
import { assinarXml, prepararAssinatura } from '@sinete/core/xml';
import { criarTransporteNode, ErroSigner, ErroTransporte, politicaDeHostsPermitidos } from '../src/index.node.ts';
import type { ConexaoSigner } from '../src/signer.node.ts';
import { assinadorTlsDeCryptoKey, assinadorTlsDeDigest, conectarSigner, iniciarSigner } from '../src/signer.node.ts';
import type { Pki } from './lab/pki.ts';
import { createPki, findOpenssl } from './lab/pki.ts';
import { presentedInRenegotiation, renegotiationServer, wwwServer } from './lab/servers.ts';
import type { SignerBinaries } from './lab/signer-bin.ts';
import { signerBinaries } from './lab/signer-bin.ts';

// Subir o laboratório (PKI pelo OpenSSL, token SoftHSM, helper) passa dos 5 s padrão em máquina carregada.
const LAB_SETUP_MS = 60_000;

const openssl = findOpenssl();
const bins = openssl ? await signerBinaries() : undefined;

const der = (pem: string): Uint8Array => new Uint8Array(new X509Certificate(pem).raw);

describe.skipIf(!bins || !openssl)('sinete-signer de verdade no laboratório TLS', () => {
  const b = bins as SignerBinaries;
  let pki: Pki;
  let signer: ConexaoSigner;
  const logger = loggerEmMemoria();
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
  const digestSigner = () => {
    const key = createPrivateKey(pki.clientKeyPem);
    return assinadorTlsDeDigest(
      {
        tipo: 'digest',
        certificadoDer: async () => der(pki.clientCertPem),
        assinarDigestInfo: async (di) =>
          new Uint8Array(privateEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, di)),
      },
      [der(pki.clientCertPem)],
    );
  };
  const transportFor = (identity: Awaited<ReturnType<ConexaoSigner['abrirRemoto']>>, port: number) =>
    criarTransporteNode({
      identidade: identity.identidadeTls,
      politica: politicaDeHostsPermitidos({ hosts: ['127.0.0.1', 'localhost'], portas: [port] }),
    });

  beforeAll(async () => {
    pki = createPki();
    signer = await iniciarSigner({ binario: b.static, lab: true, logger });
  }, LAB_SETUP_MS);
  afterAll(async () => {
    await signer?.fechar();
    pki?.cleanup();
  });

  test('hello: protocolo 1, sabor estático sem PKCS#11, laboratório', () => {
    expect(signer.hello).toMatchObject({ protocol: 1, lab: true, backends: ['remote'], ambientes: ['laboratorio'] });
    expect(signer.hello.helper).toMatch(/^sinete-signer\//);
  });

  test('renegociação iniciada pelo servidor com a chave no processo JS (modo digest)', async () => {
    const id = await signer.abrirRemoto({
      assinador: digestSigner(),
      hostsPermitidos: ['127.0.0.1'],
      acsAdicionais: [pki.caPem],
    });
    const srv = await renegotiationServer(pki);
    const t = transportFor(id, srv.port);
    const r = await t.enviar({ url: `${srv.url}/ws/NFeStatusServico4.asmx`, corpo: '<x/>' });
    const log = await srv.finished(1500);
    expect(r.status).toBe(200);
    expect(r.texto()).toBe('renegociado');
    expect(r.tls.assinaturas).toBe(1);
    expect(r.tls.protocolo).toBe('TLS 1.2');
    expect(presentedInRenegotiation(log)).toBe(true);
    // O CertificateVerify sai em PKCS#1 com SHA-256 (rsa_pkcs1_sha256 = 0x0401), nunca PSS.
    expect(log).not.toMatch(/rsa_pss/i);
    await t.fechar();
    await id.fechar();
  });

  test('só CBC e modo message (CryptoKey não exportável), com o transcript conferido', async () => {
    const pkcs8 = createPrivateKey(pki.clientKeyPem).export({ format: 'der', type: 'pkcs8' });
    const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
      'sign',
    ]);
    const id = await signer.abrirRemoto({
      assinador: assinadorTlsDeCryptoKey(key, [der(pki.clientCertPem)]),
      hostsPermitidos: ['localhost'],
      acsAdicionais: [pki.caPem],
    });
    const srv = await wwwServer(pki, [...handshakeArgs(), '-cipher', 'ECDHE-RSA-AES128-SHA256']);
    const t = transportFor(id, srv.port);
    const r = await t.enviar({ url: `https://localhost:${srv.port}/`, metodo: 'GET' });
    await srv.finished(1000);
    expect(r.status).toBe(200);
    expect(r.texto()).toContain('Cipher is ECDHE-RSA-AES128-SHA256');
    expect(r.texto()).toContain('Subject: CN=Cliente de laboratorio');
    expect(r.tls.assinaturas).toBe(1);
    await t.fechar();
    await id.fechar();
  });

  test('só DHE: o crypto/tls não tem DHE e o servidor aborta com handshake_failure', async () => {
    const id = await signer.abrirRemoto({
      assinador: digestSigner(),
      hostsPermitidos: ['127.0.0.1'],
      acsAdicionais: [pki.caPem],
    });
    const srv = await wwwServer(pki, [...handshakeArgs(), '-cipher', 'DHE-RSA-AES128-GCM-SHA256']);
    const t = transportFor(id, srv.port);
    const e = await t.enviar({ url: `${srv.url}/`, metodo: 'GET' }).catch((x: unknown) => x);
    await srv.finished(500);
    expect(e).toBeInstanceOf(ErroTransporte);
    expect(e).toMatchObject({ code: 'certificado_nao_apresentado', detalhes: { alerta: 'handshake_failure' } });
    await t.fechar();
    await id.fechar();
  });

  test('política do dono da chave: host fora da lista vira assinatura_tls_recusada', async () => {
    const id = await signer.abrirRemoto({
      assinador: digestSigner(),
      hostsPermitidos: ['localhost'],
      acsAdicionais: [pki.caPem],
    });
    const srv = await wwwServer(pki, handshakeArgs());
    const t = transportFor(id, srv.port);
    const e = await t.enviar({ url: `${srv.url}/`, metodo: 'GET' }).catch((x: unknown) => x);
    await srv.finished(500);
    expect(e).toBeInstanceOf(ErroSigner);
    expect(e).toMatchObject({ code: 'assinatura_tls_recusada' });
    expect((e as Error).message).toContain('host fora da política do dono da chave: 127.0.0.1');
    await t.fechar();
    await id.fechar();
  });

  test('servidor de AC fora da confiança: cadeia_servidor_nao_confiavel', async () => {
    const id = await signer.abrirRemoto({ assinador: digestSigner(), hostsPermitidos: ['127.0.0.1'] });
    const srv = await wwwServer(pki, handshakeArgs(), 'badSrv');
    const t = transportFor(id, srv.port);
    await expect(t.enviar({ url: `${srv.url}/`, metodo: 'GET' })).rejects.toMatchObject({
      code: 'cadeia_servidor_nao_confiavel',
    });
    srv.stop();
    await t.fechar();
    await id.fechar();
  });

  test('guarda do helper antes do socket, mesmo sem política no transporte', async () => {
    const id = await signer.abrirRemoto({ assinador: digestSigner(), hostsPermitidos: ['127.0.0.1'] });
    const t = criarTransporteNode({ identidade: id.identidadeTls });
    await expect(t.enviar({ url: 'https://hnfe.sefaz.ba.gov.br/ws', corpo: '<x/>' })).rejects.toMatchObject({
      code: 'politica_recusou',
    });
    await t.fechar();
    await id.fechar();
  });

  test('sabor estático recusa PKCS#11 com pkcs11_falhou', async () => {
    await expect(
      signer.abrirPkcs11({ modulo: '/x/lib.so', token: 't', rotulo: 'l', pin: async () => '0000' }),
    ).rejects.toMatchObject({ code: 'pkcs11_falhou' });
  });

  test('binário ausente: signer_indisponivel', async () => {
    await expect(iniciarSigner({ binario: '/nao/existe/sinete-signer', lab: true })).rejects.toMatchObject({
      code: 'signer_indisponivel',
    });
    await expect(iniciarSigner({ binario: b.static })).rejects.toMatchObject({ code: 'config_invalida' });
  });

  test.skipIf(process.platform === 'win32')('socket Unix: helper em contêiner próprio', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sinete-signer-sock-'));
    const sock = path.join(dir, 's.sock');
    const proc = Bun.spawn([b.static, '--lab', '--socket', sock], { stderr: 'pipe', stdout: 'ignore' });
    try {
      for (let i = 0; i < 100 && !(await Bun.file(sock).exists()); i++) await Bun.sleep(20);
      const c = await conectarSigner({ caminhoDoSocket: sock });
      expect(c.hello.lab).toBe(true);
      const id = await c.abrirRemoto({
        assinador: digestSigner(),
        hostsPermitidos: ['127.0.0.1'],
        acsAdicionais: [pki.caPem],
      });
      const srv = await wwwServer(pki, handshakeArgs());
      const t = transportFor(id, srv.port);
      const r = await t.enviar({ url: `${srv.url}/`, metodo: 'GET' });
      await srv.finished(500);
      expect(r.texto()).toContain('Subject: CN=Cliente de laboratorio');
      expect((await c.estatisticas())[id.id]).toMatchObject({ signatures: 1, backend: 'remote' });
      await c.fechar();
    } finally {
      proc.kill();
      await proc.exited;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe.skipIf(!b.p11 || !b.p11lab || !b.softhsmModule)('token PKCS#11 (SoftHSM)', () => {
    let dir: string;
    let p11: ConexaoSigner;
    const CNPJ = '11222333000181';

    beforeAll(async () => {
      dir = mkdtempSync(path.join(tmpdir(), 'sinete-softhsm-'));
      writeFileSync(path.join(dir, 'ac.key'), readKey(pki.dir));
      const pem = execFileSync(
        b.p11lab as string,
        [
          '--dir',
          dir,
          '--pin',
          '4321',
          '--ca-cert',
          pki.files.ca,
          '--ca-key',
          path.join(dir, 'ac.key'),
          '--cnpj',
          CNPJ,
        ],
        { encoding: 'utf8' },
      );
      expect(pem).toContain('BEGIN CERTIFICATE');
      rmSync(path.join(dir, 'ac.key'));
      p11 = await iniciarSigner({
        binario: b.p11 as string,
        lab: true,
        env: { SOFTHSM2_CONF: path.join(dir, 'softhsm2.conf') },
      });
    }, LAB_SETUP_MS);
    afterAll(async () => {
      await p11?.fechar();
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    test('mTLS pelo token na renegociação, chave nunca fora do token', async () => {
      expect(p11.hello.backends).toContain('pkcs11');
      const id = await p11.abrirPkcs11({
        modulo: b.softhsmModule as string,
        token: 'sinete-lab',
        rotulo: 'certificado-a3',
        pin: async () => '4321',
        acsAdicionais: [pki.caPem],
      });
      expect(id).toMatchObject({ backend: 'pkcs11', cnpj: CNPJ });
      expect(id.assinadorDeDocumentos).toBeDefined();
      const srv = await renegotiationServer(pki);
      const t = transportFor(id, srv.port);
      const r = await t.enviar({ url: `${srv.url}/ws/NFeStatusServico4.asmx`, corpo: '<x/>' });
      const log = await srv.finished(1500);
      expect(r.status).toBe(200);
      expect(r.tls.assinaturas).toBe(1);
      expect(presentedInRenegotiation(log)).toBe(true);
      await t.fechar();
      await id.fechar();
    });

    test('assinadorDeDocumentos assina o SignedInfo de uma NF-e do titular e recusa o de outro emitente', async () => {
      const id = await p11.abrirPkcs11({
        modulo: b.softhsmModule as string,
        token: 'sinete-lab',
        idDaChave: '0102',
        pin: async () => '4321',
      });
      const ds = id.assinadorDeDocumentos;
      if (!ds) throw new Error('sem assinadorDeDocumentos');
      const chave = (doc: string): string => `352609${doc}550010000000011000000011`;
      const xml = (doc: string): string =>
        `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${chave(doc)}" versao="4.00"><emit><CNPJ>${doc}</CNPJ></emit></infNFe></NFe>`;
      const ok = await prepararAssinatura(xml(CNPJ), {
        id: `NFe${chave(CNPJ)}`,
        certificadoDer: await ds.certificadoDer(),
      });
      const sig = await ds.assinar(ok.signedInfo, 'SHA-1');
      const pub = await crypto.subtle.importKey(
        'spki',
        new X509Certificate(Buffer.from(await ds.certificadoDer())).publicKey.export({ format: 'der', type: 'spki' }),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
        false,
        ['verify'],
      );
      expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pub, sig as Uint8Array<ArrayBuffer>, ok.signedInfo)).toBe(
        true,
      );
      const outro = await prepararAssinatura(xml('44555666000181'), {
        id: `NFe${chave('44555666000181')}`,
        certificadoDer: await ds.certificadoDer(),
      });
      await expect(ds.assinar(outro.signedInfo, 'SHA-1')).rejects.toMatchObject({
        code: 'assinatura_documento_recusada',
      });
      expect((await p11.estatisticas())[id.id]).toMatchObject({ signatures: 1, backend: 'pkcs11' });
      await id.fechar();
    });

    test('assinadorDeDocumentos assina a manifestação do destinatário (Id com a chave de outro emitente) pelo elemento', async () => {
      const id = await p11.abrirPkcs11({
        modulo: b.softhsmModule as string,
        token: 'sinete-lab',
        idDaChave: '0102',
        pin: async () => '4321',
      });
      const ds = id.assinadorDeDocumentos;
      if (!ds) throw new Error('sem assinadorDeDocumentos');
      const chave = '35260944555666000181550010000000011000000011';
      const evId = `ID210210${chave}01`;
      const xml = (autor: string): string =>
        `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${evId}"><cOrgao>91</cOrgao><tpAmb>2</tpAmb><CNPJ>${autor}</CNPJ><chNFe>${chave}</chNFe><dhEvento>2026-09-28T10:00:00-03:00</dhEvento><tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento>`;
      // assinarXml passa o elemento canonicalizado no ContextoDaAssinatura, e o helper confere o autor nele.
      const assinado = await assinarXml(xml(CNPJ), { id: evId }, ds);
      expect(assinado).toContain('<SignatureValue>');
      expect(assinado).not.toContain('@@SINETE');
      // Sem o elemento, a referência é só a chave de outro emitente: recusa.
      const prep = await prepararAssinatura(xml(CNPJ), { id: evId, certificadoDer: await ds.certificadoDer() });
      await expect(ds.assinar(prep.signedInfo, 'SHA-1')).rejects.toMatchObject({
        code: 'assinatura_documento_recusada',
      });
      // Autor que não é o titular: recusa mesmo com o elemento.
      await expect(assinarXml(xml('44555666000181'), { id: evId }, ds)).rejects.toMatchObject({
        code: 'assinatura_documento_recusada',
      });
      await id.fechar();
    });

    test('PIN errado: pkcs11_falhou, sem o PIN na mensagem', async () => {
      const e = await p11
        .abrirPkcs11({
          modulo: b.softhsmModule as string,
          token: 'sinete-lab',
          rotulo: 'certificado-a3',
          pin: async () => '9999',
        })
        .catch((x: unknown) => x);
      expect(e).toMatchObject({ code: 'pkcs11_falhou' });
      expect((e as Error).message).not.toContain('9999');
    });
  });
});

/** Chave da AC do laboratório, para o p11lab emitir o certificado do token (PKCS#8 em PEM). */
function readKey(dir: string): string {
  return createPrivateKey(readFileSync(path.join(dir, 'ca.key'), 'utf8'))
    .export({ format: 'pem', type: 'pkcs8' })
    .toString();
}
