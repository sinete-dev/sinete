/**
 * Política de hosts: a guarda do spike S2 (`spikes/s2-tls/real/guard.ts`) generalizada. Roda antes de qualquer
 * socket e recusa com `PolicyError`. O app monta a própria (a allowlist de homologação, por exemplo) e o transporte
 * aplica em todo envio.
 */

import type { TpAmb } from '@sinete/core';
import { PolicyError } from './errors.ts';
import type { HostPolicy, PolicyRequest } from './types.ts';

export interface AllowlistPolicyOptions {
  /** Hosts aceitos, comparados sem diferenciar maiúsculas. Nada fora da lista passa. */
  readonly hosts: Iterable<string>;
  /** Portas aceitas. Padrão: só a 443. */
  readonly ports?: readonly number[];
  /**
   * Exige que todo `<tpAmb>` do corpo tenha este valor (ex.: `'2'` para só homologação) e recusa corpo sem `tpAmb`
   * quando `requireTpAmbInBody` for `true`.
   */
  readonly tpAmb?: TpAmb;
  readonly requireTpAmbInBody?: boolean;
}

/**
 * Elemento `tpAmb` com qualquer prefixo e atributos (`xmlns` incluso), ou vazio (`<tpAmb/>`). O valor capturado é o
 * texto até o próximo `<`, então conteúdo misto ou aninhado também é recusado por não ser `1` nem `2`.
 */
const TPAMB = /<(?:[\w.-]+:)?tpAmb(?:\s[^>]*?)?(?:\/>|>([^<]*)<)/g;

/** Tira comentários, CDATA e instruções de processamento de uma cópia do corpo, só para inspecionar. */
function inspectable(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '');
}

function bodyText(body: Uint8Array | string | undefined): string | undefined {
  if (body === undefined) return undefined;
  return typeof body === 'string' ? body : new TextDecoder().decode(body);
}

/** Allowlist fechada de hosts, portas e, opcionalmente, do `tpAmb` do corpo. */
export function allowlistPolicy(options: AllowlistPolicyOptions): HostPolicy {
  const hosts = new Set([...options.hosts].map((h) => h.toLowerCase()));
  const ports = options.ports ?? [443];
  return {
    check(req: PolicyRequest): void {
      const port = req.url.port === '' ? 443 : Number(req.url.port);
      if (!ports.includes(port)) throw new PolicyError(`porta não permitida: ${port}`, { port });
      const host = req.url.hostname.toLowerCase();
      if (!hosts.has(host)) throw new PolicyError(`host fora da allowlist: ${host}`, { host });
      if (options.tpAmb === undefined) return;
      const text = bodyText(req.body);
      const found = text === undefined ? [] : [...inspectable(text).matchAll(TPAMB)].map((m) => (m[1] ?? '').trim());
      const wrong = found.filter((v) => v !== options.tpAmb);
      if (wrong.length > 0) {
        throw new PolicyError(`tpAmb diferente de ${options.tpAmb} no corpo: ${wrong.join(',')}`, {
          host,
          tpAmb: wrong,
        });
      }
      if (options.requireTpAmbInBody === true && req.method === 'POST' && found.length === 0) {
        throw new PolicyError('corpo sem tpAmb e a política exige', { host });
      }
    },
  };
}

/** Todas as políticas precisam aceitar, na ordem. */
export function allPolicies(...policies: readonly HostPolicy[]): HostPolicy {
  return {
    async check(req: PolicyRequest): Promise<void> {
      for (const p of policies) await p.check(req);
    },
  };
}
