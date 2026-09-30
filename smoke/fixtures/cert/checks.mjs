// Verificações do @sinete/cert compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { relogioFixo } from '@sinete/core';
import {
  decodificarBase64,
  montarCadeia,
  ErroCertificado,
  ICP_BRASIL_BUNDLE,
  certificadosIcpBrasil,
  pemTlsIcpBrasil,
  abrirPfx,
  conferirBytes,
} from '@sinete/cert';
import { PFX_LEGACY_B64, SENHA } from './pfx.mjs';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = relogioFixo('2026-09-25T12:00:00Z');
  const pfx = decodificarBase64(PFX_LEGACY_B64);
  const ks = await abrirPfx(pfx, { senha: SENHA, relogio: clock });
  expect('PFX legado RC2-40 + 3DES', ks.tipo === 'a1' && ks.validade === 'valido');
  expect('identidade e-CNPJ', ks.identidade.tipo === 'e-CNPJ' && ks.identidade.cnpj === '11222333000181');
  expect('responsável', ks.identidade.pessoa?.cpf === '11144477735');
  const data = new TextEncoder().encode('<SignedInfo/>');
  const signer = await ks.assinador();
  for (const hash of ['SHA-1', 'SHA-256']) {
    const sig = await signer.assinar(data, hash);
    expect(`assina e confere ${hash}`, sig.length === 256 && (await conferirBytes(ks.certificado, data, sig, hash)));
  }
  let err;
  try {
    await abrirPfx(pfx, { senha: SENHA, relogio: relogioFixo('2031-01-01T00:00:00Z') });
  } catch (e) {
    err = e;
  }
  expect('trava de validade', err instanceof ErroCertificado && err.code === 'certificado_expirado');
  try {
    await abrirPfx(pfx, { senha: 'errada', relogio: clock });
  } catch (e) {
    err = e;
  }
  expect('senha errada tipada', err?.code === 'pfx_senha_incorreta');
  expect('bundle versionado', /^\d{4}\.\d{2}\.\d{2}$/.test(ICP_BRASIL_BUNDLE.versao));
  expect('bundle com 4 raízes', certificadosIcpBrasil().filter((c) => c.tipo === 'raiz').length === 4);
  expect('bundle TLS em PEM', pemTlsIcpBrasil().every((p) => p.startsWith('-----BEGIN CERTIFICATE-----')));
  const inter = certificadosIcpBrasil().find((c) => c.tipo === 'intermediaria');
  const chain = await montarCadeia(inter.der);
  expect('cadeia até a raiz v10', chain.situacao === 'confiavel' && /v10$/.test(chain.ancora?.subject.commonName ?? ''));
  const pem = ks.tlsPem();
  expect('PEM para TLS', pem.cadeia.includes('BEGIN CERTIFICATE') && pem.chave.includes('PRIVATE KEY'));
  return failures;
}
