// Verificações do @sinete/cert compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { relogioFixo } from '@sinete/core';
import {
  base64ToBytes,
  buildChain,
  CertError,
  ICP_BRASIL_BUNDLE,
  icpBrasilCertificates,
  icpBrasilTlsPem,
  openPfx,
  verifyBytes,
} from '@sinete/cert';
import { PFX_LEGACY_B64, SENHA } from './pfx.mjs';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = relogioFixo('2026-09-25T12:00:00Z');
  const pfx = base64ToBytes(PFX_LEGACY_B64);
  const ks = await openPfx(pfx, { password: SENHA, clock });
  expect('PFX legado RC2-40 + 3DES', ks.kind === 'a1' && ks.validity === 'valido');
  expect('identidade e-CNPJ', ks.identity.tipo === 'e-CNPJ' && ks.identity.cnpj === '11222333000181');
  expect('responsável', ks.identity.pessoa?.cpf === '11144477735');
  const data = new TextEncoder().encode('<SignedInfo/>');
  const signer = await ks.signer();
  for (const hash of ['SHA-1', 'SHA-256']) {
    const sig = await signer.assinar(data, hash);
    expect(`assina e confere ${hash}`, sig.length === 256 && (await verifyBytes(ks.certificate, data, sig, hash)));
  }
  let err;
  try {
    await openPfx(pfx, { password: SENHA, clock: relogioFixo('2031-01-01T00:00:00Z') });
  } catch (e) {
    err = e;
  }
  expect('trava de validade', err instanceof CertError && err.code === 'certificado_expirado');
  try {
    await openPfx(pfx, { password: 'errada', clock });
  } catch (e) {
    err = e;
  }
  expect('senha errada tipada', err?.code === 'pfx_senha_incorreta');
  expect('bundle versionado', /^\d{4}\.\d{2}\.\d{2}$/.test(ICP_BRASIL_BUNDLE.version));
  expect('bundle com 4 raízes', icpBrasilCertificates().filter((c) => c.kind === 'root').length === 4);
  expect('bundle TLS em PEM', icpBrasilTlsPem().every((p) => p.startsWith('-----BEGIN CERTIFICATE-----')));
  const inter = icpBrasilCertificates().find((c) => c.kind === 'intermediate');
  const chain = await buildChain(inter.der);
  expect('cadeia até a raiz v10', chain.status === 'confiavel' && /v10$/.test(chain.anchor?.subject.commonName ?? ''));
  const pem = ks.tlsPem();
  expect('PEM para TLS', pem.certChain.includes('BEGIN CERTIFICATE') && pem.key.includes('PRIVATE KEY'));
  return failures;
}
