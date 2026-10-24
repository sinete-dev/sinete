/**
 * Abre o A1 do operador só em memória, pelo `@sinete/cert`. Duas origens:
 *
 * - `--op <referência>`: lê os campos `pfx_base64` e `senha` do item com o leitor de segredos, por spawn sem shell. A referência escolhe o leitor
 *   (`--op-bin` sobrepõe): `vw://cofre/item` usa `vw-agentes` (Vaultwarden); `op://cofre/item` usa `op` (1Password). O segredo volta pelo stdout do filho e nunca passa por argv, env de outro processo ou disco.
 * - `--pfx <arquivo>`: lê o PFX do disco (o do operador) e a senha da variável de `--senha-env` (padrão
 *   `SINETE_PFX_SENHA`), como o `sinete doctor`.
 *
 * Nada daqui imprime, grava ou devolve senha, chave ou PFX: quem chama recebe o `Certificado` e a cadeia.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import type { CertificadoA1, CertificadoX509, ResultadoCadeia } from '@sinete/cert';
import { abrirPfx, dersDoPem, lerCertificado, montarCadeia } from '@sinete/cert';
import { relogioDoSistema } from '@sinete/core';

export interface OrigemCertificado {
  readonly op?: string;
  readonly opBin?: string;
  readonly pfx?: string;
  readonly senhaEnv?: string;
  /** PEM com intermediárias da AC (o PFX legado costuma trazer só a folha). */
  readonly cadeia?: string;
}

export interface Certificado {
  readonly ks: CertificadoA1;
  /** Bytes do PFX, só em memória: o `sinete doctor` programático abre de novo. */
  readonly pfx: Uint8Array;
  readonly senha: string;
  readonly cadeia: ResultadoCadeia;
  /** Intermediárias extras lidas de `--cadeia`. */
  readonly extras: readonly CertificadoX509[];
}

/** Leitor padrão pelo esquema da referência: `vw://` é o `vw-agentes`; qualquer outra (`op://`) segue o `op`. */
export function leitorPadrao(ref: string): string {
  return ref.startsWith('vw://') ? 'vw-agentes' : 'op';
}

function opRead(bin: string, ref: string): string {
  const r = spawnSync(bin, ['read', ref], {
    encoding: 'utf8',
    env: { ...process.env, OP_AGENTES_NO_CACHE: '1', VW_AGENTES_NO_CACHE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 22,
    shell: false,
  });
  if (r.status !== 0) {
    // Só o código e um trecho saneado do stderr: o stdout pode ter segredo parcial.
    const err = String(r.stderr ?? '')
      .replace(/[^\x20-\x7e]/g, '')
      .slice(0, 200);
    throw new Error(`${bin} read falhou (${ref.replace(/.*\//, '…/')}): status ${r.status}; ${err}`);
  }
  return r.stdout;
}

function base64(text: string): Uint8Array {
  const bin = atob(text.replace(/\s+/g, ''));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function abrirCertificado(o: OrigemCertificado): Promise<Certificado> {
  let pfx: Uint8Array;
  let senha: string;
  if (o.op !== undefined) {
    const ref = o.op.replace(/\/+$/, '');
    const bin = o.opBin ?? leitorPadrao(ref);
    pfx = base64(opRead(bin, `${ref}/pfx_base64`));
    senha = opRead(bin, `${ref}/senha`).replace(/\r?\n$/, '');
  } else if (o.pfx !== undefined) {
    pfx = new Uint8Array(readFileSync(o.pfx));
    const nome = o.senhaEnv ?? 'SINETE_PFX_SENHA';
    const v = process.env[nome];
    if (v === undefined) throw new Error(`defina ${nome} com a senha do PFX`);
    senha = v;
    // Nenhum filho (xmllint, CLI do 1Password) herda a senha.
    delete process.env[nome];
  } else {
    throw new Error('informe --op <referência> ou --pfx <arquivo>');
  }
  const ks = await abrirPfx(pfx, { senha: senha, relogio: relogioDoSistema });
  const extras = o.cadeia ? dersDoPem(readFileSync(o.cadeia, 'utf8')).map((d) => lerCertificado(d)) : [];
  const cadeia = await montarCadeia(ks.certificado, {
    intermediarias: [...ks.certificadosExtras, ...extras],
    relogio: relogioDoSistema,
  });
  return { ks, pfx, senha, cadeia, extras };
}
