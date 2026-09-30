/** Execução de um envio do laboratório, igual em Bun (em processo), Node e Deno (via `client.ts`). */
import { abrirPfx, decodificarBase64 } from '@sinete/cert';
import type { ErroSinete } from '@sinete/core';
import { relogioDoSistema } from '@sinete/core';
import type { EndpointResolvido, IdentidadeTls, PerfilTls } from '../../src/index.node.ts';
import { criarTransporte, politicaDeHostsPermitidos } from '../../src/index.node.ts';

export interface LabClientInput {
  url: string;
  certChain?: string;
  key?: string;
  pfxB64?: string;
  password?: string;
  additionalCa: string[];
  /** Perfil TLS simulado para o host local (para exercitar a recusa do Deno). */
  profile?: Partial<PerfilTls>;
  allowHosts?: string[];
  timeoutMs?: number;
}

export interface LabClientResult {
  runtime: string;
  status?: number;
  body?: string;
  tls?: unknown;
  error?: { name: string | undefined; code: string | undefined; detalhes: unknown; message: string | undefined };
}

export async function runLabClient(input: LabClientInput): Promise<LabClientResult> {
  let identity: IdentidadeTls;
  if (input.pfxB64) {
    const ks = await abrirPfx(decodificarBase64(input.pfxB64), {
      senha: input.password ?? '',
      relogio: relogioDoSistema,
    });
    identity = { tipo: 'pem', ...ks.tlsPem() };
  } else identity = { tipo: 'pem', cadeia: input.certChain ?? '', chave: input.key ?? '' };
  const port = Number(new URL(input.url).port);
  const transport = criarTransporte({
    identidade: identity,
    acsAdicionais: input.additionalCa,
    timeoutMs: input.timeoutMs ?? 10_000,
    ...(input.allowHosts ? { politica: politicaDeHostsPermitidos({ hosts: input.allowHosts, portas: [port] }) } : {}),
  });
  const endpoint = input.profile
    ? ({
        host: '127.0.0.1',
        url: input.url,
        tls: { host: '127.0.0.1', ...input.profile },
      } as unknown as EndpointResolvido)
    : undefined;
  try {
    const res = await transport.enviar({ url: input.url, ...(endpoint ? { endpoint } : {}) });
    return { runtime: transport.capacidades.runtime, status: res.status, body: res.texto(), tls: res.tls };
  } catch (e) {
    // O tipo do erro, e não uma forma solta: um membro renomeado no core quebra a compilação aqui.
    const err = e as Partial<Pick<ErroSinete, 'name' | 'code' | 'detalhes' | 'message'>>;
    return {
      runtime: transport.capacidades.runtime,
      error: { name: err.name, code: err.code, detalhes: err.detalhes, message: err.message },
    };
  } finally {
    await transport.fechar();
  }
}
