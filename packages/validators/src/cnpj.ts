/**
 * CNPJ numérico e alfanumérico.
 *
 * NT Conjunta 2025.001 v1.00 (CNPJ Alfanumérico), itens 2 e 4: 14 posições, as 12 primeiras com letras maiúsculas ou
 * algarismos (raiz de 8 e ordem de 4) e as 2 últimas numéricas (DV); expressão `[A-Z0-9]{12}[0-9]{2}`. O DV continua
 * sendo módulo 11 com pesos 2 a 9 da direita para a esquerda, e cada caractere vale o código ASCII menos 48, de modo
 * que o CNPJ numérico tem o mesmo DV de sempre. A NT 2026.004 v1.01 (NF-e/NFC-e) leva o formato aos schemas, com produção
 * em 1º de julho de 2026. A regra de formação vem da IN RFB 2.229/2024.
 *
 * A NT 2025.001 cita que I, O, U, Q e F podem vir a ser vedadas, pendente de confirmação da RFB; enquanto não for
 * confirmado, o validador aceita qualquer letra maiúscula, como a expressão do schema.
 */

import type { Ocorrencia, Resultado } from '@sinete/core';
import { falha, ok } from '@sinete/core';
import type { LerOpcoes } from './cpf.ts';
import {
  allSame,
  applyMask,
  cyclicWeights,
  issue,
  mod11Complement,
  stripMask,
  throwInvalid,
  weightedSum,
} from './digits.ts';

const CNPJ_WEIGHTS_1: readonly number[] = cyclicWeights(12);
const CNPJ_WEIGHTS_2: readonly number[] = cyclicWeights(13);
const CNPJ_FORMAT = /^[A-Z0-9]{12}\d{2}$/;

/** Os 2 dígitos verificadores de uma base de 12 caracteres (algarismos ou letras maiúsculas). */
export function calcularDvCnpj(base: string): string {
  if (!/^[A-Z0-9]{12}$/.test(base))
    throwInvalid('CNPJ', 'cnpj_base_invalida', 'A base do CNPJ tem 12 caracteres [A-Z0-9]');
  const d1 = mod11Complement(weightedSum(base, CNPJ_WEIGHTS_1));
  const d2 = mod11Complement(weightedSum(`${base}${d1}`, CNPJ_WEIGHTS_2));
  return `${d1}${d2}`;
}

/** Valida e normaliza um CNPJ, numérico ou alfanumérico (aceita máscara e minúsculas); devolve os 14 caracteres. */
export function lerCnpj(entrada: string, opcoes: LerOpcoes = {}): Resultado<string, Ocorrencia> {
  const path = opcoes.caminho ?? 'CNPJ';
  const value = stripMask(entrada.trim()).toUpperCase();
  if (!/^[A-Z0-9]*$/.test(value)) {
    return falha(issue(path, 'cnpj_caractere_invalido', 'CNPJ só tem letras e algarismos'));
  }
  if (value.length !== 14) return falha(issue(path, 'cnpj_tamanho_invalido', 'CNPJ tem 14 caracteres'));
  if (!CNPJ_FORMAT.test(value)) {
    return falha(issue(path, 'cnpj_formato_invalido', 'Os 2 últimos caracteres do CNPJ (DV) são numéricos'));
  }
  if (allSame(value)) return falha(issue(path, 'cnpj_digitos_repetidos', 'CNPJ com todos os caracteres iguais'));
  if (calcularDvCnpj(value.slice(0, 12)) !== value.slice(12)) {
    return falha(issue(path, 'cnpj_dv_invalido', 'Dígito verificador do CNPJ não confere'));
  }
  return ok(value);
}

export function cnpjValido(entrada: string): boolean {
  return lerCnpj(entrada).ok;
}

/** Verdadeiro se o CNPJ (já normalizado ou com máscara) tem alguma letra na raiz ou na ordem. */
export function cnpjAlfanumerico(valor: string): boolean {
  return /[A-Z]/i.test(stripMask(valor).slice(0, 12));
}

/** `00.000.000/0000-00`, também para o alfanumérico (`12.ABC.345/01DE-35`). Não valida. */
export function formatarCnpj(valor: string): string {
  return applyMask(stripMask(valor).toUpperCase(), '##.###.###/####-##');
}
