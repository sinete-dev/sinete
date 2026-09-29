#!/usr/bin/env bun
/**
 * Gera os PFX SINTÉTICOS de teste do @sinete/cert com o OpenSSL 3 (precisa de `-not_before`/`-not_after`, 3.4+).
 *
 * Nada aqui é certificado real: a AC é autoassinada e descartável ("AC SINTETICA SINETE"), as chaves são geradas na
 * hora e os documentos são os exemplos clássicos de dígito verificador válido (CNPJ 11.222.333/0001-81, CPF
 * 111.444.777-35), que não pertencem a ninguém. Os arquivos gerados ficam registrados em
 * scripts/secrets-allowlist.txt. Rodar de novo gera chaves novas (os testes não dependem de bytes fixos).
 *
 * Uso: bun packages/cert/test/fixtures/gerar.ts   (OPENSSL=/caminho/do/openssl para escolher o binário)
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $ } from 'bun';

const openssl = process.env.OPENSSL ?? 'openssl';
const out = import.meta.dir;
const work = await mkdtemp(path.join(tmpdir(), 'sinete-fixtures-'));
export const SENHA = 'sinete-teste';
export const SENHA_ACENTUADA = 'Açaí#2026';

const version = (await $`${openssl} version`.text()).trim();
if (!/^OpenSSL 3\.([4-9]|\d\d)/.test(version)) throw new Error(`precisa de OpenSSL 3.4+, achei: ${version}`);

// Leiaute dos otherName ICP-Brasil (DOC-ICP-04, item 7.1.2.3): data de nascimento (8, ddmmaaaa), CPF (11), NIS (11),
// RG (15) e órgão expedidor + UF (10). Campo sem valor vai com zeros.
const pessoa = `01011980${'11144477735'}${'0'.repeat(11)}${'0'.repeat(15)}${'0'.repeat(10)}`;

const cnf = (body: string): string => `[req]\ndistinguished_name = dn\nprompt = no\n[dn]\n${body}\n`;
const ext = `
[ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
[ecnpj]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, nonRepudiation, keyEncipherment
extendedKeyUsage = clientAuth, emailProtection
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
authorityInfoAccess = caIssuers;URI:http://ac-sintetica.invalid/ac.p7b, OCSP;URI:http://ocsp.ac-sintetica.invalid
subjectAltName = @ecnpj_san
[ecnpj_san]
otherName.1 = 2.16.76.1.3.4;PRINTABLESTRING:${pessoa}
otherName.2 = 2.16.76.1.3.2;PRINTABLESTRING:FULANO SINTETICO DE TESTE
otherName.3 = 2.16.76.1.3.3;OCTETSTRING:11222333000181
otherName.4 = 2.16.76.1.3.7;PRINTABLESTRING:000000000000
email.1 = teste@sintetico.invalid
[ecpf]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, nonRepudiation, keyEncipherment
extendedKeyUsage = clientAuth
subjectAltName = @ecpf_san
[ecpf_san]
otherName.1 = 2.16.76.1.3.1;UTF8STRING:${pessoa}
otherName.2 = 2.16.76.1.3.6;PRINTABLESTRING:000000000000
otherName.3 = 2.16.76.1.3.5;PRINTABLESTRING:0000000000000000000
`;
const f = (n: string): string => path.join(work, n);
await Bun.write(f('ext.cnf'), ext);

async function key(name: string): Promise<void> {
  await $`${openssl} genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out ${f(`${name}.key`)}`.quiet();
}

async function cert(opts: {
  name: string;
  subject: string;
  ext: string;
  issuer?: string;
  notBefore: string;
  notAfter: string;
  keyName?: string;
}): Promise<void> {
  const k = f(`${opts.keyName ?? opts.name}.key`);
  await Bun.write(f(`${opts.name}.req.cnf`), cnf(opts.subject));
  await $`${openssl} req -new -key ${k} -config ${f(`${opts.name}.req.cnf`)} -out ${f(`${opts.name}.csr`)}`.quiet();
  const signer = opts.issuer ? ['-CA', f(`${opts.issuer}.pem`), '-CAkey', f(`${opts.issuer}.key`)] : ['-signkey', k];
  await $`${openssl} x509 -req -in ${f(`${opts.name}.csr`)} ${signer} -sha256 -set_serial ${`0x${crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')}`} -not_before ${opts.notBefore} -not_after ${opts.notAfter} -extfile ${f('ext.cnf')} -extensions ${opts.ext} -out ${f(`${opts.name}.pem`)}`.quiet();
}

async function pfx(name: string, args: string[], password = SENHA): Promise<void> {
  await $`${openssl} pkcs12 -export ${args} -passout ${`pass:${password}`} -out ${path.join(out, name)}`.quiet();
  console.log(`gerado ${name}`);
}

try {
  await key('raiz');
  await key('inter');
  await key('ecnpj');
  await key('ecpf');
  await cert({
    name: 'raiz',
    subject: 'C = BR\nO = SINETE TESTE\nCN = AC RAIZ SINTETICA SINETE',
    ext: 'ca',
    notBefore: '20250101000000Z',
    notAfter: '20450101000000Z',
  });
  await cert({
    name: 'inter',
    subject: 'C = BR\nO = SINETE TESTE\nCN = AC SINTETICA SINETE v1',
    ext: 'ca',
    issuer: 'raiz',
    notBefore: '20250101000000Z',
    notAfter: '20400101000000Z',
  });
  const ecnpjSubject =
    'C = BR\nO = ICP-Brasil\nOU = AC SINTETICA SINETE v1\nOU = Certificado PJ A1\nCN = EMPRESA SINTETICA DE TESTE LTDA:11222333000181';
  // Duas folhas com a mesma chave: a renovada vale mais tempo e é a que deve ser escolhida.
  await cert({
    name: 'ecnpj-2026',
    keyName: 'ecnpj',
    subject: ecnpjSubject,
    ext: 'ecnpj',
    issuer: 'inter',
    notBefore: '20260101000000Z',
    notAfter: '20270101000000Z',
  });
  await cert({
    name: 'ecnpj-2028',
    keyName: 'ecnpj',
    subject: ecnpjSubject,
    ext: 'ecnpj',
    issuer: 'inter',
    notBefore: '20260601000000Z',
    notAfter: '20280601000000Z',
  });
  await cert({
    name: 'ecpf',
    subject: 'C = BR\nO = ICP-Brasil\nOU = Certificado PF A1\nCN = FULANO SINTETICO DE TESTE:11144477735',
    ext: 'ecpf',
    issuer: 'inter',
    notBefore: '20260101000000Z',
    notAfter: '20270101000000Z',
  });
  await Bun.write(f('cadeia.pem'), (await Bun.file(f('inter.pem')).text()) + (await Bun.file(f('raiz.pem')).text()));
  await Bun.write(
    f('multi.pem'),
    (await Bun.file(f('ecnpj-2028.pem')).text()) + (await Bun.file(f('inter.pem')).text()),
  );

  const leafA = ['-inkey', f('ecnpj.key'), '-in', f('ecnpj-2026.pem')];
  // Perfil típico de A1 antigo exportado pelo Windows: RC2-40 no certificado, 3DES na chave, MAC SHA-1.
  await pfx('ecnpj-legacy.pfx', ['-legacy', ...leafA]);
  await pfx('ecnpj-3des-cadeia.pfx', [
    ...leafA,
    '-certfile',
    f('cadeia.pem'),
    '-keypbe',
    'PBE-SHA1-3DES',
    '-certpbe',
    'PBE-SHA1-3DES',
    '-macalg',
    'sha1',
  ]);
  await pfx('ecnpj-aes.pfx', leafA);
  await pfx('ecnpj-multi.pfx', ['-legacy', ...leafA, '-certfile', f('multi.pem')]);
  await pfx('ecpf-legacy-acentuada.pfx', ['-legacy', '-inkey', f('ecpf.key'), '-in', f('ecpf.pem')], SENHA_ACENTUADA);
  await pfx('ecnpj-rc2-128.pfx', [...leafA, '-legacy', '-keypbe', 'PBE-SHA1-RC2-128', '-certpbe', 'PBE-SHA1-RC2-128']);
  await pfx('sem-chave.pfx', ['-nokeys', '-in', f('ecnpj-2026.pem')]);
} finally {
  await rm(work, { recursive: true, force: true });
}
