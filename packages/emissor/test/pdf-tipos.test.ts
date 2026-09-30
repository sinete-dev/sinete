/**
 * As opções do PDF do emissor espelham as do `@sinete/da` sem importar os tipos de lá (o pacote é peer opcional). Este
 * teste é de tipos: o typecheck falha se um espelho e o original deixarem de ter os mesmos membros com os mesmos
 * tipos, ou se um módulo do `@sinete/da` deixar de servir como está na opção `da`.
 */

import { expect, test } from 'bun:test';
import type * as DaMdfe from '@sinete/da/mdfe';
import type { DamdfeOpcoes } from '@sinete/da/mdfe';
import type * as DaNfe from '@sinete/da/nfe';
import type { DanfeOpcoes } from '@sinete/da/nfe';
import type * as DaNfse from '@sinete/da/nfse';
import type { DanfseOpcoes } from '@sinete/da/nfse';
import type { ModuloDamdfe, PdfMdfeOpcoes } from '../src/mdfe.ts';
import type { ModuloDanfe, PdfNfeOpcoes } from '../src/nfe.ts';
import type { ModuloDanfse, PdfNfseOpcoes } from '../src/nfse.ts';

/** `true` só quando `A` e `B` têm exatamente os mesmos membros, todos com tipos mutuamente atribuíveis. */
type Iguais<A, B> = [Required<A>] extends [Required<B>]
  ? [Required<B>] extends [Required<A>]
    ? [keyof A] extends [keyof B]
      ? [keyof B] extends [keyof A]
        ? true
        : false
      : false
    : false
  : false;

const nfe: Iguais<PdfNfeOpcoes, DanfeOpcoes> = true;
const mdfe: Iguais<PdfMdfeOpcoes, DamdfeOpcoes> = true;
const nfse: Iguais<PdfNfseOpcoes, DanfseOpcoes> = true;

// Os módulos do `@sinete/da` servem como estão na opção `da` dos emissores.
const modulos = (a: typeof DaNfe, b: typeof DaMdfe, c: typeof DaNfse): [ModuloDanfe, ModuloDamdfe, ModuloDanfse] => [
  a,
  b,
  c,
];

test('as opções do PDF do emissor espelham as do @sinete/da', () => {
  expect([nfe, mdfe, nfse]).toEqual([true, true, true]);
  expect(typeof modulos).toBe('function');
});
