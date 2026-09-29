import type { Clock } from '@sinete/core';
import { SineteError } from '@sinete/core';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

export function element(name: string, text: string): string {
  if (!/^[A-Za-z_][\w.-]*$/.test(name)) throw new SineteError('E100', `nome de elemento inválido: ${name}`);
  return `<${name}>${escapeXml(text)}</${name}>`;
}

/** Recebe o relógio por injeção (import só de tipo atravessando pacotes). */
export function stamp(clock: Clock): string {
  return element('dhEmi', clock.now().toISOString());
}
