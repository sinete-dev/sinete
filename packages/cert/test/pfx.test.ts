import { describe, expect, test } from 'bun:test';
import { createPrivateKey, X509Certificate } from 'node:crypto';
import { relogioFixo } from '@sinete/core';
import forge from 'node-forge';
import type { LeitorPkcs12 } from '../src/index.ts';
import {
  abrirPfx,
  conferirBytes,
  dersDoPem,
  ErroCertificado,
  leitorPkcs12Forge,
  lerCertificado,
  senhaNoFormatoLegado,
} from '../src/index.ts';
import { fixture, SENHA, SENHA_ACENTUADA } from './helpers.ts';

const clock = relogioFixo('2026-09-25T12:00:00Z');

describe('abrirPfx: perfis de cifra', () => {
  test.each([
    ['ecnpj-legacy.pfx', SENHA, 'RC2-40 + 3DES (-legacy)'],
    ['ecnpj-3des-cadeia.pfx', SENHA, '3DES + 3DES com cadeia'],
    ['ecnpj-aes.pfx', SENHA, 'PBES2 AES-256, MAC SHA-256'],
    ['ecpf-legacy-acentuada.pfx', SENHA_ACENTUADA, 'legado com senha acentuada'],
  ])('%s (%s)', async (file, password) => {
    const ks = await abrirPfx(fixture(file), { senha: password, relogio: clock });
    expect(ks.tipo).toBe('a1');
    expect(ks.validade).toBe('valido');
    const signer = await ks.assinador();
    const data = new TextEncoder().encode('<SignedInfo>x</SignedInfo>');
    const sig = await signer.assinar(data, 'SHA-1');
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      await crypto.subtle.importKey(
        'spki',
        ks.certificado.spki as Uint8Array<ArrayBuffer>,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
        false,
        ['verify'],
      ),
      sig as Uint8Array<ArrayBuffer>,
      data,
    );
    expect(ok).toBe(true);
    expect(await signer.certificadoDer()).toEqual(ks.certificado.der);
  });

  test('RC2-128 vira pfx_nao_suportado', async () => {
    await expect(abrirPfx(fixture('ecnpj-rc2-128.pfx'), { senha: SENHA, relogio: clock })).rejects.toMatchObject({
      code: 'pfx_nao_suportado',
    });
  });

  test('senha errada vira pfx_senha_incorreta, sem a senha na mensagem', async () => {
    const e = await abrirPfx(fixture('ecnpj-legacy.pfx'), { senha: 'errada', relogio: clock }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroCertificado);
    expect((e as ErroCertificado).code).toBe('pfx_senha_incorreta');
    expect(JSON.stringify(e)).not.toContain('errada');
  });

  test('senha acentuada errada também tenta a variante e falha tipada', async () => {
    await expect(abrirPfx(fixture('ecnpj-legacy.pfx'), { senha: 'Senhá', relogio: clock })).rejects.toMatchObject({
      code: 'pfx_senha_incorreta',
    });
  });

  test('arquivo que não é PFX vira pfx_invalido', async () => {
    await expect(
      abrirPfx(new TextEncoder().encode('isto não é um PFX'), { senha: SENHA, relogio: clock }),
    ).rejects.toMatchObject({
      code: 'pfx_invalido',
    });
  });

  test('PFX sem chave', async () => {
    await expect(abrirPfx(fixture('sem-chave.pfx'), { senha: SENHA, relogio: clock })).rejects.toMatchObject({
      code: 'pfx_sem_chave',
    });
  });

  test('bytes extras no fim são tolerados (base64 de cofre com 1 byte a mais)', async () => {
    const pfx = fixture('ecnpj-legacy.pfx');
    const padded = new Uint8Array(pfx.length + 1);
    padded.set(pfx);
    const ks = await abrirPfx(padded, { senha: SENHA, relogio: clock });
    expect(ks.identidade.cnpj).toBe('11222333000181');
  });
});

describe('escolha do titular', () => {
  test('entre duas folhas da mesma chave, fica a de validade mais longa', async () => {
    const ks = await abrirPfx(fixture('ecnpj-multi.pfx'), { senha: SENHA, relogio: clock });
    expect(ks.certificado.notAfterIso).toBe('2028-06-01T00:00:00Z');
    // a folha antiga não vira intermediária
    expect(ks.certificadosExtras.map((c) => c.subject.commonName)).toEqual(['AC SINTETICA SINETE v1']);
  });

  test('certificado sem chave correspondente', async () => {
    const reader: LeitorPkcs12 = {
      nome: 'teste',
      ler: async () => {
        const real = leitorPkcs12Forge.ler(fixture('ecnpj-3des-cadeia.pfx'), SENHA);
        const other = leitorPkcs12Forge.ler(fixture('ecpf-legacy-acentuada.pfx'), SENHA_ACENTUADA);
        return { chavesPrivadas: (await other).chavesPrivadas, certificados: (await real).certificados };
      },
    };
    await expect(abrirPfx(new Uint8Array(), { senha: SENHA, relogio: clock, leitor: reader })).rejects.toMatchObject({
      code: 'pfx_sem_certificado_da_chave',
    });
  });

  test('zerar a chave devolvida por um leitor injetado não quebra o assinador nem o PEM', async () => {
    const devolvidas: Uint8Array[] = [];
    const reader: LeitorPkcs12 = {
      nome: 'teste',
      ler: async (pfx, senha) => {
        const lido = await leitorPkcs12Forge.ler(pfx, senha);
        devolvidas.push(...lido.chavesPrivadas);
        return lido;
      },
    };
    const ks = await abrirPfx(fixture('ecnpj-aes.pfx'), { senha: SENHA, relogio: clock, leitor: reader });
    const pemAntes = ks.tlsPem().chave;
    for (const k of devolvidas) k.fill(0);
    const data = new TextEncoder().encode('dados');
    const sig = await (await ks.assinador()).assinar(data, 'SHA-256');
    expect(await conferirBytes(ks.certificado, data, sig, 'SHA-256')).toBe(true);
    expect(ks.tlsPem().chave).toBe(pemAntes);
  });

  test('chave que não é RSA', async () => {
    const reader: LeitorPkcs12 = {
      nome: 'teste',
      ler: () => ({ chavesPrivadas: [Uint8Array.of(0x30, 0x03, 0x02, 0x01, 0x00)], certificados: [] }),
    };
    await expect(abrirPfx(new Uint8Array(), { senha: SENHA, relogio: clock, leitor: reader })).rejects.toMatchObject({
      code: 'algoritmo_nao_suportado',
    });
  });
});

describe('trava de validade', () => {
  test('vencido é recusado com detalhes públicos', async () => {
    const e = (await abrirPfx(fixture('ecnpj-legacy.pfx'), {
      senha: SENHA,
      relogio: relogioFixo('2027-01-01T00:00:01Z'),
    }).catch((x: unknown) => x)) as ErroCertificado;
    expect(e.code).toBe('certificado_expirado');
    expect(e.detalhes).toMatchObject({ notAfter: '2027-01-01T00:00:00Z' });
  });

  test('ainda não válido é recusado', async () => {
    await expect(
      abrirPfx(fixture('ecnpj-legacy.pfx'), { senha: SENHA, relogio: relogioFixo('2025-12-31T23:59:59Z') }),
    ).rejects.toMatchObject({ code: 'certificado_ainda_nao_valido' });
  });

  test('aceitarVencido abre e marca a validade', async () => {
    const ks = await abrirPfx(fixture('ecnpj-legacy.pfx'), {
      senha: SENHA,
      relogio: relogioFixo('2030-01-01T00:00:00Z'),
      aceitarVencido: true,
    });
    expect(ks.validade).toBe('expirado');
    const early = await abrirPfx(fixture('ecnpj-legacy.pfx'), {
      senha: SENHA,
      relogio: relogioFixo('2020-01-01T00:00:00Z'),
      aceitarVencido: true,
    });
    expect(early.validade).toBe('ainda_nao_valido');
  });
});

describe('material TLS', () => {
  test('cadeia do cliente sem raiz e chave PKCS#8 que o runtime aceita', async () => {
    const ks = await abrirPfx(fixture('ecnpj-3des-cadeia.pfx'), { senha: SENHA, relogio: clock });
    const { cadeia: certChain, chave: key } = ks.tlsPem();
    const ders = dersDoPem(certChain);
    expect(ders).toHaveLength(2);
    expect(ders[0]).toEqual(ks.certificado.der);
    expect(new X509Certificate(ders[1] as Uint8Array).subject).toContain('AC SINTETICA SINETE v1');
    const k = createPrivateKey(key);
    expect(k.asymmetricKeyType).toBe('rsa');
    expect(new X509Certificate(ders[0] as Uint8Array).checkPrivateKey(k)).toBe(true);
  });

  test('cadeia explícita começa sempre pelo titular', async () => {
    const ks = await abrirPfx(fixture('ecnpj-3des-cadeia.pfx'), { senha: SENHA, relogio: clock });
    const inter = ks.certificadosExtras.filter((c) => !c.selfIssued);
    const { cadeia: certChain } = ks.tlsPem({ cadeia: inter });
    expect(dersDoPem(certChain)[0]).toEqual(ks.certificado.der);
    expect(dersDoPem(certChain)).toHaveLength(2);
  });

  test('troca de chave da AC: auto-emitido assinado pela chave velha segue no TLS, raiz não', async () => {
    const ks = await abrirPfx(fixture('ecnpj-3des-cadeia.pfx'), { senha: SENHA, relogio: clock });
    const pki = forge.pki;
    const velha = pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
    const nova = pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
    const ski = (k: forge.pki.rsa.PublicKey) => pki.getPublicKeyFingerprint(k).getBytes();
    const cert = (pub: forge.pki.rsa.PublicKey, signer: forge.pki.rsa.KeyPair) => {
      const c = pki.createCertificate();
      c.publicKey = pub;
      c.serialNumber = '0a';
      c.validity.notBefore = new Date('2026-01-01T00:00:00Z');
      c.validity.notAfter = new Date('2030-01-01T00:00:00Z');
      c.setSubject([{ name: 'commonName', value: 'AC Rolagem' }]);
      c.setIssuer([{ name: 'commonName', value: 'AC Rolagem' }]);
      c.setExtensions([
        { name: 'basicConstraints', cA: true },
        { name: 'subjectKeyIdentifier' },
        { name: 'authorityKeyIdentifier', keyIdentifier: ski(signer.publicKey) },
      ]);
      c.sign(signer.privateKey, forge.md.sha256.create());
      return lerCertificado(
        Uint8Array.from(forge.asn1.toDer(pki.certificateToAsn1(c)).getBytes(), (ch) => ch.charCodeAt(0)),
      );
    };
    const rolagem = cert(nova.publicKey, velha);
    const raiz = cert(velha.publicKey, velha);
    expect(raiz.authorityKeyId).toBe(raiz.subjectKeyId as string);
    expect(rolagem.authorityKeyId).not.toBe(rolagem.subjectKeyId);
    expect(rolagem.selfIssued && raiz.selfIssued).toBe(true);
    const ders = dersDoPem(ks.tlsPem({ cadeia: [ks.certificado, rolagem, raiz] }).cadeia);
    expect(ders).toEqual([ks.certificado.der, rolagem.der]);
  });
});

describe('senha em ferramenta antiga (Latin-1 byte a byte)', () => {
  test('variante só existe com caractere fora do ASCII', () => {
    expect(senhaNoFormatoLegado('abc123')).toBeUndefined();
    expect(senhaNoFormatoLegado('ç')).toBe('Ã§');
  });

  test('PFX cifrado com a senha mutilada abre com a senha certa', async () => {
    // Gera um PFX 3DES com a senha como o OpenSSL 1.0 a veria (bytes UTF-8 lidos como Latin-1).
    const src = await abrirPfx(fixture('ecnpj-aes.pfx'), { senha: SENHA, relogio: clock });
    const { chave: key, cadeia: certChain } = src.tlsPem();
    const p12 = forge.pkcs12.toPkcs12Asn1(
      forge.pki.privateKeyFromPem(key),
      [forge.pki.certificateFromPem(certChain)],
      senhaNoFormatoLegado('Maçã') as string,
      { algorithm: '3des' },
    );
    const bytes = Uint8Array.from(forge.asn1.toDer(p12).getBytes(), (c) => c.charCodeAt(0));
    const ks = await abrirPfx(bytes, { senha: 'Maçã', relogio: clock });
    expect(ks.certificado.der).toEqual(src.certificado.der);
  });
});
