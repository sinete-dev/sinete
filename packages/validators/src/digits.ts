/**
 * Primitivas de dígito verificador compartilhadas pelos validadores.
 *
 * O valor de cada caractere segue a NT Conjunta 2025.001 v1.00 (CNPJ alfanumérico), item 2: código ASCII menos 48.
 * Algarismos continuam valendo 0 a 9 e letras maiúsculas passam a valer A=17, B=18 e assim por diante. A mesma regra
 * vale para o DV da chave de acesso (item 5 da mesma NT), e para documentos só numéricos ela não muda nada.
 */

import type { Ocorrencia } from '@sinete/core';
import { ErroDeValidacao } from '@sinete/core';

/** Valor de um caractere no cálculo do DV: código ASCII menos 48 (NT Conjunta 2025.001, item 2). */
export function charValue(c: string): number {
  return c.charCodeAt(0) - 48;
}

/** Soma ponderada `Σ valor(texto[i]) × pesos[i]`. */
export function weightedSum(text: string, weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += charValue(text[i] ?? '0') * (weights[i] ?? 0);
  return sum;
}

/** Pesos de 2 a `max` aplicados da direita para a esquerda, reiniciando em 2, alinhados da esquerda para a direita. */
export function cyclicWeights(length: number, max = 9): number[] {
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.unshift(2 + (i % (max - 1)));
  return out;
}

/** Módulo 11 no padrão da RFB: resto menor que 2 vira 0, senão 11 menos o resto. */
export function mod11Complement(sum: number): number {
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

/** Remove os separadores de máscara usuais (ponto, hífen, barra e espaço). */
export function stripMask(value: string): string {
  return value.replace(/[.\-/\s]/g, '');
}

/** Todos os caracteres iguais (`00000000000`, `AAAAAAAAAAAAAA`): passa no DV em alguns documentos e nunca é válido. */
export function allSame(value: string): boolean {
  return value.length > 0 && value.split('').every((c) => c === value[0]);
}

/** Monta uma ocorrência de validação com o caminho do campo. */
export function issue(path: string, code: string, message: string): Ocorrencia {
  return { caminho: path, code, mensagem: message };
}

/** Aplica uma máscara com `#` como posição de caractere; sobra de caracteres vai no fim, sem máscara. */
export function applyMask(value: string, mask: string): string {
  let out = '';
  let j = 0;
  for (const m of mask) {
    if (j >= value.length) break;
    if (m === '#') out += value[j++];
    else out += m;
  }
  return out + value.slice(j);
}

/**
 * Lança `ValidationError` (código `validacao_falhou`) com uma ocorrência de código estável. Usado pelas funções de
 * cálculo de dígito quando a base não tem o formato esperado: erro do chamador, não dado a validar.
 */
export function throwInvalid(path: string, code: string, message: string): never {
  throw new ErroDeValidacao(message, [issue(path, code, message)]);
}
