import { describe, expect, test } from 'bun:test';
import { fixedClock } from '@sinete/core';
import forge from 'node-forge';
import { buildChain, icpBrasilCertificates, openPfx, parseCertificate, verifyIssuedBy } from '../src/index.ts';
import { fixture, SENHA } from './helpers.ts';

const clock = fixedClock('2026-09-25T12:00:00Z');

async function sintetico() {
  const ks = await openPfx(fixture('ecnpj-3des-cadeia.pfx'), { password: SENHA, clock });
  const root = ks.extraCertificates.find((c) => c.selfIssued);
  const inter = ks.extraCertificates.find((c) => !c.selfIssued);
  if (!root || !inter) throw new Error('fixture sem cadeia');
  return { ks, root, inter };
}

describe('buildChain', () => {
  test('cadeia completa até a âncora dada', async () => {
    const { ks, root, inter } = await sintetico();
    const r = await buildChain(ks.certificate, { intermediates: [inter], anchors: [root], clock });
    expect(r.status).toBe('confiavel');
    expect(r.chain.map((c) => c.subject.commonName)).toEqual([
      'EMPRESA SINTETICA DE TESTE LTDA:11222333000181',
      'AC SINTETICA SINETE v1',
      'AC RAIZ SINTETICA SINETE',
    ]);
    expect(r.anchor?.der).toEqual(root.der);
    expect(r.expired).toEqual([]);
  });

  test('raiz fora das âncoras (padrão: ICP-Brasil)', async () => {
    const { ks } = await sintetico();
    const r = await buildChain(ks.certificate, { intermediates: ks.extraCertificates });
    expect(r.status).toBe('raiz_desconhecida');
    expect(r.chain).toHaveLength(3);
  });

  test('PFX só com a folha: incompleta, com o emissor que faltou', async () => {
    const ks = await openPfx(fixture('ecnpj-legacy.pfx'), { password: SENHA, clock });
    const r = await buildChain(ks.certificate.der);
    expect(r.status).toBe('incompleta');
    expect(r.missingIssuer).toBe('C=BR, O=SINETE TESTE, CN=AC SINTETICA SINETE v1');
  });

  test('assinatura adulterada', async () => {
    const { ks, root, inter } = await sintetico();
    const der = ks.certificate.der.slice();
    der[der.length - 5] = (der[der.length - 5] as number) ^ 0xff;
    const r = await buildChain(parseCertificate(der), { intermediates: [inter], anchors: [root] });
    expect(r.status).toBe('assinatura_invalida');
  });

  test('elos vencidos no instante do relógio', async () => {
    const { ks, root, inter } = await sintetico();
    const r = await buildChain(ks.certificate, {
      intermediates: [inter],
      anchors: [root],
      clock: fixedClock('2041-01-01T00:00:00Z'),
    });
    expect(r.status).toBe('confiavel');
    expect(r.expired.map((c) => c.subject.commonName)).toEqual([
      'EMPRESA SINTETICA DE TESTE LTDA:11222333000181',
      'AC SINTETICA SINETE v1',
    ]);
  });

  test('intermediárias SSL do bundle sobem até a raiz v10', async () => {
    for (const inter of icpBrasilCertificates().filter((c) => c.kind === 'intermediate')) {
      const r = await buildChain(inter.der);
      expect(r.status).toBe('confiavel');
      expect(r.anchor?.subject.commonName).toBe('Autoridade Certificadora Raiz Brasileira v10');
    }
  });

  test('algoritmo fora do escopo não é dado como inválido', async () => {
    const { ks, inter } = await sintetico();
    const pss = { ...ks.certificate, signatureAlgorithm: '1.2.840.113549.1.1.10' };
    expect(await verifyIssuedBy(pss, inter)).toBeUndefined();
    const r = await buildChain(pss, { intermediates: [inter], anchors: [] });
    expect(r.status).toBe('incompleta');
  });

  test('limite de profundidade', async () => {
    const { ks, root, inter } = await sintetico();
    const r = await buildChain(ks.certificate, { intermediates: [inter], anchors: [root], maxDepth: 1 });
    expect(r.status).toBe('incompleta');
  });
});

describe('restrições do emissor (RFC 5280, 6.1.4)', () => {
  const pki = forge.pki;
  const der = (c: forge.pki.Certificate): Uint8Array =>
    Uint8Array.from(forge.asn1.toDer(pki.certificateToAsn1(c)).getBytes(), (ch) => ch.charCodeAt(0));
  function make(
    cn: string,
    issuer: { cert?: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey } | undefined,
    keys: forge.pki.rsa.KeyPair,
    ext: object[],
  ): forge.pki.Certificate {
    const c = pki.createCertificate();
    c.publicKey = keys.publicKey;
    c.serialNumber = String(Math.floor(Math.random() * 1e9));
    c.validity.notBefore = new Date('2026-01-01T00:00:00Z');
    c.validity.notAfter = new Date('2030-01-01T00:00:00Z');
    c.setSubject([{ name: 'commonName', value: cn }]);
    c.setIssuer(issuer?.cert ? issuer.cert.subject.attributes : [{ name: 'commonName', value: cn }]);
    c.setExtensions(ext);
    c.sign(issuer?.key ?? keys.privateKey, forge.md.sha256.create());
    return c;
  }
  const kp = (): forge.pki.rsa.KeyPair => pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const ca = (pathLen?: number) => [
    { name: 'basicConstraints', cA: true, ...(pathLen === undefined ? {} : { pathLenConstraint: pathLen }) },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true },
  ];
  const ee = [
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true },
  ];

  test('folha comum não emite certificado', async () => {
    const rk = kp();
    const root = make('raiz', undefined, rk, ca());
    const lk = kp();
    const leaf = make('folha', { cert: root, key: rk.privateKey }, lk, ee);
    const forged = make('forjado', { cert: leaf, key: lk.privateKey }, kp(), ee);
    const r = await buildChain(der(forged), { intermediates: [der(leaf)], anchors: [der(root)] });
    expect(r.status).toBe('emissor_nao_autorizado');
    expect((await buildChain(der(leaf), { anchors: [der(root)] })).status).toBe('confiavel');
  });

  test('AC sem keyCertSign e pathLenConstraint estourado', async () => {
    const rk = kp();
    const semKcs = make('raiz sem kcs', undefined, rk, [
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', cRLSign: true },
    ]);
    const f1 = make('folha', { cert: semKcs, key: rk.privateKey }, kp(), ee);
    expect((await buildChain(der(f1), { anchors: [der(semKcs)] })).status).toBe('emissor_nao_autorizado');
    const r0k = kp();
    const root0 = make('raiz pathlen 0', undefined, r0k, ca(0));
    const ik = kp();
    const inter = make('intermediaria', { cert: root0, key: r0k.privateKey }, ik, ca());
    const leaf = make('folha 2', { cert: inter, key: ik.privateKey }, kp(), ee);
    expect(parseCertificate(der(root0)).pathLenConstraint).toBe(0);
    const r = await buildChain(der(leaf), { intermediates: [der(inter)], anchors: [der(root0)] });
    expect(r.status).toBe('emissor_nao_autorizado');
    const root1 = make('raiz pathlen 1', undefined, r0k, ca(1));
    const inter1 = make('intermediaria', { cert: root1, key: r0k.privateKey }, ik, ca());
    const leaf1 = make('folha 2', { cert: inter1, key: ik.privateKey }, kp(), ee);
    expect((await buildChain(der(leaf1), { intermediates: [der(inter1)], anchors: [der(root1)] })).status).toBe(
      'confiavel',
    );
  });

  test('intermediária autoassinada e com certificação cruzada: a ordem não esconde o caminho confiável', async () => {
    const rk = kp();
    const root = make('raiz', undefined, rk, ca());
    const ik = kp();
    const autoassinada = make('intermediaria', undefined, ik, ca());
    const cruzada = make('intermediaria', { cert: root, key: rk.privateKey }, ik, ca());
    const leaf = make('folha', { cert: cruzada, key: ik.privateKey }, kp(), ee);
    for (const intermediates of [
      [der(autoassinada), der(cruzada)],
      [der(cruzada), der(autoassinada)],
    ]) {
      const r = await buildChain(der(leaf), { intermediates, anchors: [der(root)] });
      expect(r.status).toBe('confiavel');
      expect(r.chain.map((c) => c.subject.text)).toEqual(['CN=folha', 'CN=intermediaria', 'CN=raiz']);
    }
    const semRaiz = await buildChain(der(leaf), { intermediates: [der(autoassinada), der(cruzada)], anchors: [] });
    expect(semRaiz.status).toBe('raiz_desconhecida');
  });

  test('nome do emissor em outro tipo de string, caixa e espaços diferentes', async () => {
    const rk = kp();
    const root = pki.createCertificate();
    root.publicKey = rk.publicKey;
    root.serialNumber = '01';
    root.validity.notBefore = new Date('2026-01-01T00:00:00Z');
    root.validity.notAfter = new Date('2030-01-01T00:00:00Z');
    const nome = (value: string, tag: number) => [{ name: 'commonName', value, valueTagClass: tag }];
    root.setSubject(nome('Raiz  Teste', forge.asn1.Type.UTF8));
    root.setIssuer(nome('Raiz  Teste', forge.asn1.Type.UTF8));
    root.setExtensions(ca());
    root.sign(rk.privateKey, forge.md.sha256.create());
    const leaf = make('folha', { key: rk.privateKey }, kp(), ee);
    leaf.setIssuer(nome('raiz teste', forge.asn1.Type.PRINTABLESTRING));
    leaf.sign(rk.privateKey, forge.md.sha256.create());
    expect((await buildChain(der(leaf), { anchors: [der(root)] })).status).toBe('confiavel');
    const outro = make('folha', { key: rk.privateKey }, kp(), ee);
    outro.setIssuer(nome('raiz outra', forge.asn1.Type.PRINTABLESTRING));
    outro.sign(rk.privateKey, forge.md.sha256.create());
    expect((await buildChain(der(outro), { anchors: [der(root)] })).status).toBe('incompleta');
  });

  test('extensão crítica desconhecida em folha ou intermediária impede a confiança', async () => {
    const rk = kp();
    const root = make('raiz', undefined, rk, ca());
    const critica = {
      id: '1.2.3.4.5',
      critical: true,
      value: forge.asn1.toDer(forge.asn1.create(0, 5, false, '')).getBytes(),
    };
    const leaf = make('folha', { cert: root, key: rk.privateKey }, kp(), [...ee, critica]);
    expect(parseCertificate(der(leaf)).unsupportedCriticalExtensions).toEqual(['1.2.3.4.5']);
    const r = await buildChain(der(leaf), { anchors: [der(root)] });
    expect(r.status).toBe('extensao_critica_nao_suportada');
    const nc = {
      id: '2.5.29.30',
      critical: true,
      value: forge.asn1.toDer(forge.asn1.create(0, 16, true, [])).getBytes(),
    };
    const ik = kp();
    const inter = make('intermediaria', { cert: root, key: rk.privateKey }, ik, [...ca(), nc]);
    const leaf2 = make('folha 2', { cert: inter, key: ik.privateKey }, kp(), ee);
    const r2 = await buildChain(der(leaf2), { intermediates: [der(inter)], anchors: [der(root)] });
    expect(r2.status).toBe('extensao_critica_nao_suportada');
    const naoCritica = make('folha 3', { cert: root, key: rk.privateKey }, kp(), [
      ...ee,
      { ...critica, critical: false },
    ]);
    expect((await buildChain(der(naoCritica), { anchors: [der(root)] })).status).toBe('confiavel');
  });

  test('intermediária vencida e renovada com o mesmo nome e chave: prefere a válida em qualquer ordem', async () => {
    const rk = kp();
    const root = make('raiz', undefined, rk, ca());
    const ik = kp();
    const vencida = make('intermediaria', { cert: root, key: rk.privateKey }, ik, ca());
    vencida.validity.notBefore = new Date('2020-01-01T00:00:00Z');
    vencida.validity.notAfter = new Date('2025-01-01T00:00:00Z');
    vencida.sign(rk.privateKey, forge.md.sha256.create());
    const renovada = make('intermediaria', { cert: root, key: rk.privateKey }, ik, ca());
    const leaf = make('folha', { cert: renovada, key: ik.privateKey }, kp(), ee);
    for (const intermediates of [
      [der(vencida), der(renovada)],
      [der(renovada), der(vencida)],
    ]) {
      const r = await buildChain(der(leaf), { intermediates, anchors: [der(root)], clock });
      expect(r.status).toBe('confiavel');
      expect(r.expired).toEqual([]);
      expect(r.chain[1]?.der).toEqual(der(renovada));
    }
    const soVencida = await buildChain(der(leaf), { intermediates: [der(vencida)], anchors: [der(root)], clock });
    expect(soVencida.status).toBe('confiavel');
    expect(soVencida.expired.map((c) => c.subject.commonName)).toEqual(['intermediaria']);
  });
});
