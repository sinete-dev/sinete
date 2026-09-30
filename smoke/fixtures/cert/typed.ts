// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { AssinadorDeDados } from '@sinete/core';
import { relogioFixo } from '@sinete/core';
import type { CertificadoA1, CodigoErroCertificado, SituacaoCadeia, IdentidadeIcp, Certificado, LeitorPkcs12 } from '@sinete/cert';
import { montarCadeia, abrirPfx } from '@sinete/cert';

export async function usar(bytes: Uint8Array): Promise<string> {
  const ks: CertificadoA1 = await abrirPfx(bytes, { senha: 'x', relogio: relogioFixo('2026-09-25T12:00:00Z') });
  const generic: Certificado = ks;
  const signer: AssinadorDeDados = await ks.assinador();
  const id: IdentidadeIcp = generic.identidade;
  const status: SituacaoCadeia = (await montarCadeia(ks.certificado)).situacao;
  const reader: LeitorPkcs12 = { nome: 'meu', ler: () => ({ chavesPrivadas: [], certificados: [] }) };
  const code: CodigoErroCertificado = 'pfx_senha_incorreta';
  // @ts-expect-error hash fora do contrato
  await signer.assinar(new Uint8Array(), 'MD5');
  return `${id.tipo} ${status} ${reader.nome} ${code}`;
}
