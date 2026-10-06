/**
 * PKI descartável do laboratório TLS, gerada na hora com o OpenSSL 3 (nada fica no repo). Cada execução da suíte cria
 * chaves novas num diretório temporário, apagado no fim.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** OpenSSL 3 do PATH (ou de `OPENSSL`); `undefined` quando não há (o LibreSSL do macOS não serve). */
export function findOpenssl(): string | undefined {
  for (const bin of [process.env.OPENSSL, 'openssl', '/opt/homebrew/opt/openssl@3/bin/openssl'].filter(Boolean)) {
    try {
      const v = execFileSync(bin as string, ['version'], { encoding: 'utf8' });
      if (/^OpenSSL 3\./.test(v)) return bin as string;
    } catch {}
  }
  return undefined;
}

export interface Pki {
  readonly dir: string;
  readonly openssl: string;
  /** Caminhos dos arquivos, para o s_server. */
  readonly files: Record<
    | 'ca'
    | 'srv'
    | 'srvKey'
    | 'cli'
    | 'cliKey'
    | 'badSrv'
    | 'badSrvKey'
    | 'wrongName'
    | 'wrongNameKey'
    | 'crlRevogaCliente',
    string
  >;
  readonly caPem: string;
  readonly clientCertPem: string;
  readonly clientKeyPem: string;
  /** PFX legado (RC2-40 + 3DES) do cliente, senha `lab`, ou `undefined` se o OpenSSL não tiver o provider legado. */
  readonly clientPfxLegacy: Uint8Array | undefined;
  cleanup(): void;
}

const EXT = `
[ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
[srv]
basicConstraints = CA:FALSE
extendedKeyUsage = serverAuth
subjectAltName = DNS:localhost, IP:127.0.0.1, IP:::1
[wrong]
basicConstraints = CA:FALSE
extendedKeyUsage = serverAuth
subjectAltName = DNS:outro-host.invalid
[cli]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
`;

export function createPki(): Pki {
  const openssl = findOpenssl();
  if (!openssl) throw new Error('OpenSSL 3 não encontrado');
  const dir = mkdtempSync(path.join(tmpdir(), 'sinete-tls-lab-'));
  const f = (n: string): string => path.join(dir, n);
  writeFileSync(f('ext.cnf'), EXT);
  const run = (...args: string[]): void => {
    execFileSync(openssl, args, { stdio: 'ignore' });
  };
  const key = (n: string): void =>
    run('genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048', '-out', f(`${n}.key`));
  const cert = (n: string, cn: string, ext: string, issuer?: string): void => {
    run('req', '-new', '-key', f(`${n}.key`), '-subj', `/CN=${cn}`, '-out', f(`${n}.csr`));
    const sign = issuer ? ['-CA', f(`${issuer}.pem`), '-CAkey', f(`${issuer}.key`)] : ['-signkey', f(`${n}.key`)];
    run(
      'x509',
      '-req',
      '-in',
      f(`${n}.csr`),
      ...sign,
      '-days',
      '2',
      '-sha256',
      '-extfile',
      f('ext.cnf'),
      '-extensions',
      ext,
      '-out',
      f(`${n}.pem`),
    );
  };
  for (const n of ['ca', 'srv', 'cli', 'badca', 'badsrv', 'wrong']) key(n);
  cert('ca', 'Laboratorio sinete AC', 'ca');
  cert('srv', 'localhost', 'srv', 'ca');
  cert('cli', 'Cliente de laboratorio', 'cli', 'ca');
  cert('badca', 'AC fora da confianca', 'ca');
  cert('badsrv', 'localhost', 'srv', 'badca');
  cert('wrong', 'outro-host.invalid', 'wrong', 'ca');
  // CRL da AC de laboratório que revoga o certificado do cliente, para o s_server com `-crl_check` mandar o alerta 44.
  const serial = execFileSync(openssl, ['x509', '-in', f('cli.pem'), '-noout', '-serial'], { encoding: 'utf8' })
    .trim()
    .replace(/^serial=/, '');
  const ontem = new Date(Date.now() - 86_400_000).toISOString().replace(/[-:T]/g, '').slice(2, 14);
  writeFileSync(f('index.txt'), `R\t991231235959Z\t${ontem}Z\t${serial}\tunknown\t/CN=Cliente de laboratorio\n`);
  writeFileSync(
    f('ca.cnf'),
    `[ca]\ndefault_ca = lab\n[lab]\ndatabase = ${f('index.txt')}\ncrlnumber = ${f('crlnumber')}\ndefault_md = sha256\ndefault_crl_days = 2\n`,
  );
  writeFileSync(f('crlnumber'), '01\n');
  run('ca', '-config', f('ca.cnf'), '-gencrl', '-keyfile', f('ca.key'), '-cert', f('ca.pem'), '-out', f('crl.pem'));
  let clientPfxLegacy: Uint8Array | undefined;
  try {
    run(
      'pkcs12',
      '-export',
      '-legacy',
      '-inkey',
      f('cli.key'),
      '-in',
      f('cli.pem'),
      '-passout',
      'pass:lab',
      '-out',
      f('cli.pfx'),
    );
    clientPfxLegacy = new Uint8Array(readFileSync(f('cli.pfx')));
  } catch {
    clientPfxLegacy = undefined;
  }
  return {
    dir,
    openssl,
    files: {
      ca: f('ca.pem'),
      srv: f('srv.pem'),
      srvKey: f('srv.key'),
      cli: f('cli.pem'),
      cliKey: f('cli.key'),
      badSrv: f('badsrv.pem'),
      badSrvKey: f('badsrv.key'),
      wrongName: f('wrong.pem'),
      wrongNameKey: f('wrong.key'),
      crlRevogaCliente: f('crl.pem'),
    },
    caPem: readFileSync(f('ca.pem'), 'utf8'),
    clientCertPem: readFileSync(f('cli.pem'), 'utf8'),
    clientKeyPem: readFileSync(f('cli.key'), 'utf8'),
    clientPfxLegacy,
    cleanup: (): void => rmSync(dir, { recursive: true, force: true }),
  };
}
