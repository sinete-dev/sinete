/** Execução de um envio do laboratório, igual em Bun (em processo), Node e Deno (via `client.ts`). */
import { abrirPfx, decodificarBase64 } from '@sinete/cert';
import type { ErroSinete } from '@sinete/core';
import { relogioDoSistema } from '@sinete/core';
import type { EndpointResolvido, IdentidadeTls, PerfilTls, Transporte } from '../../src/index.node.ts';
import { criarTransporte, detectarRuntime, politicaDeHostsPermitidos } from '../../src/index.node.ts';

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
  /**
   * Com `antesDeConectar` que recusa a primeira conexão: dois envios, o primeiro vetado pelo gancho e o segundo
   * normal. Num servidor de uma conexão só (`-naccept 1`), o segundo só passa se o vetado não chegou a conectar.
   */
  vetarPrimeiraConexao?: boolean;
}

export interface LabClientResult {
  runtime: string;
  status?: number;
  body?: string;
  tls?: unknown;
  error?: { name: string | undefined; code: string | undefined; detalhes: unknown; message: string | undefined };
  /** Com `vetarPrimeiraConexao`: se o primeiro envio rejeitou com o próprio erro lançado pelo gancho. */
  vetoIntacto?: boolean;
  ganchos?: number;
}

function errorOf(e: unknown): NonNullable<LabClientResult['error']> {
  // O tipo do erro, e não uma forma solta: um membro renomeado no core quebra a compilação aqui.
  const err = e as Partial<Pick<ErroSinete, 'name' | 'code' | 'detalhes' | 'message'>>;
  return { name: err.name, code: err.code, detalhes: err.detalhes, message: err.message };
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
  const veto = new Error('sem vaga');
  let ganchos = 0;
  let transport: Transporte;
  try {
    transport = criarTransporte({
      identidade: identity,
      acsAdicionais: input.additionalCa,
      timeoutMs: input.timeoutMs ?? 10_000,
      ...(input.allowHosts ? { politica: politicaDeHostsPermitidos({ hosts: input.allowHosts, portas: [port] }) } : {}),
      ...(input.vetarPrimeiraConexao
        ? {
            antesDeConectar: () => {
              if (++ganchos === 1) throw veto;
            },
          }
        : {}),
    });
  } catch (e) {
    return { runtime: detectarRuntime(), error: errorOf(e) };
  }
  const endpoint = input.profile
    ? ({
        host: '127.0.0.1',
        url: input.url,
        tls: { host: '127.0.0.1', ...input.profile },
      } as unknown as EndpointResolvido)
    : undefined;
  try {
    let vetoIntacto: boolean | undefined;
    if (input.vetarPrimeiraConexao) {
      try {
        await transport.enviar({ url: input.url });
        vetoIntacto = false;
      } catch (e) {
        vetoIntacto = e === veto;
      }
    }
    const res = await transport.enviar({ url: input.url, ...(endpoint ? { endpoint } : {}) });
    return {
      runtime: transport.capacidades.runtime,
      status: res.status,
      body: res.texto(),
      tls: res.tls,
      ...(vetoIntacto === undefined ? {} : { vetoIntacto, ganchos }),
    };
  } catch (e) {
    return { runtime: transport.capacidades.runtime, error: errorOf(e) };
  } finally {
    await transport.fechar();
  }
}
