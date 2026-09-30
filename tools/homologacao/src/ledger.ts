/**
 * Registro de uso do certificado: uma linha por operação, com hora, runtime, host, serviço e desfecho. Nunca corpo,
 * nunca segredo. O arquivo fica fora do repo (`~/.local/state/sinete/cert-usage.log` por padrão).
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { relogioDoSistema } from '@sinete/core';
import { detectRuntime } from '@sinete/transport';

export const LEDGER_PADRAO: string = join(homedir(), '.local/state/sinete/cert-usage.log');

const limpo = (s: string): string => s.replace(/[\r\n\t]+/g, ' ').slice(0, 300);

export interface Ledger {
  readonly path: string;
  registrar(host: string, servico: string, desfecho: string): void;
}

export function ledger(path: string = LEDGER_PADRAO, now: () => Date = () => relogioDoSistema.agora()): Ledger {
  return {
    path,
    registrar(host, servico, desfecho): void {
      mkdirSync(dirname(path), { recursive: true });
      const linha = [now().toISOString(), detectRuntime(), host, servico, desfecho].map(limpo).join('\t');
      appendFileSync(path, `${linha}\n`);
    },
  };
}
