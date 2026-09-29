/**
 * Binários do `sinete-signer` para os testes: compilados na hora a partir de `helpers/signer-tls/` (o cache do Go
 * deixa isso em ~1 s depois da primeira vez) em `helpers/signer-tls/dist/test/`, ignorado pelo git. Sem Go, os testes
 * que dependem do helper são pulados. O SoftHSM entra só se `softhsm2-util` e o módulo existirem.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildOne, findGo, HELPER_DIR, hostTarget } from '../../../../helpers/signer-tls/scripts/build.ts';

export interface SignerBinaries {
  readonly static: string;
  readonly p11: string | undefined;
  readonly p11lab: string | undefined;
  readonly softhsmModule: string | undefined;
}

let cached: Promise<SignerBinaries | undefined> | undefined;

export function softhsmModule(): string | undefined {
  const candidates = [
    process.env.SOFTHSM2_MODULE,
    '/opt/homebrew/lib/softhsm/libsofthsm2.so',
    '/usr/local/lib/softhsm/libsofthsm2.so',
    '/usr/lib/softhsm/libsofthsm2.so',
    '/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so',
    '/usr/lib/aarch64-linux-gnu/softhsm/libsofthsm2.so',
  ];
  if (!Bun.which('softhsm2-util')) return undefined;
  return candidates.find((c) => c !== undefined && existsSync(c));
}

async function build(): Promise<SignerBinaries | undefined> {
  const go = findGo();
  if (!go) return undefined;
  const out = path.join(HELPER_DIR, 'dist/test');
  const t = hostTarget();
  const stat = await buildOne(go, t, 'static', out);
  let p11: string | undefined;
  let p11lab: string | undefined;
  try {
    p11 = await buildOne(go, t, 'p11', out);
    p11lab = path.join(out, 'p11lab');
    execFileSync(go, ['build', '-o', p11lab, './tools/p11lab'], {
      cwd: HELPER_DIR,
      env: { ...process.env, CGO_ENABLED: '1' },
      stdio: 'ignore',
    });
  } catch {
    // Sem toolchain C: fica só o sabor estático.
    p11 = undefined;
    p11lab = undefined;
  }
  return { static: stat, p11, p11lab, softhsmModule: softhsmModule() };
}

export function signerBinaries(): Promise<SignerBinaries | undefined> {
  cached ??= build();
  return cached;
}
