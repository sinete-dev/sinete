/** Execução de um envio do laboratório, igual em Bun (em processo), Node e Deno (via `client.ts`). */
import { base64ToBytes, openPfx } from '@sinete/cert';
import { relogioDoSistema } from '@sinete/core';
import type { EndpointRef, TlsIdentity, TlsProfile } from '../../src/index.node.ts';
import { allowlistPolicy, createTransport } from '../../src/index.node.ts';

export interface LabClientInput {
  url: string;
  certChain?: string;
  key?: string;
  pfxB64?: string;
  password?: string;
  additionalCa: string[];
  /** Perfil TLS simulado para o host local (para exercitar a recusa do Deno). */
  profile?: Partial<TlsProfile>;
  allowHosts?: string[];
  timeoutMs?: number;
}

export interface LabClientResult {
  runtime: string;
  status?: number;
  body?: string;
  tls?: unknown;
  error?: { name: string | undefined; code: string | undefined; details: unknown; message: string | undefined };
}

export async function runLabClient(input: LabClientInput): Promise<LabClientResult> {
  let identity: TlsIdentity;
  if (input.pfxB64) {
    const ks = await openPfx(base64ToBytes(input.pfxB64), { password: input.password ?? '', clock: relogioDoSistema });
    identity = { kind: 'pem', ...ks.tlsPem() };
  } else identity = { kind: 'pem', certChain: input.certChain ?? '', key: input.key ?? '' };
  const port = Number(new URL(input.url).port);
  const transport = createTransport({
    identity,
    additionalCa: input.additionalCa,
    timeoutMs: input.timeoutMs ?? 10_000,
    ...(input.allowHosts ? { policy: allowlistPolicy({ hosts: input.allowHosts, ports: [port] }) } : {}),
  });
  const endpoint = input.profile
    ? ({ host: '127.0.0.1', url: input.url, tls: { host: '127.0.0.1', ...input.profile } } as unknown as EndpointRef)
    : undefined;
  try {
    const res = await transport.send({ url: input.url, ...(endpoint ? { endpoint } : {}) });
    return { runtime: transport.capabilities.runtime, status: res.status, body: res.text(), tls: res.tls };
  } catch (e) {
    const err = e as { name?: string; code?: string; details?: unknown; message?: string };
    return {
      runtime: transport.capabilities.runtime,
      error: { name: err.name, code: err.code, details: err.details, message: err.message },
    };
  } finally {
    await transport.close();
  }
}
