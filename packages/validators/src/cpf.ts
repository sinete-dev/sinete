/**
 * CPF: 9 algarismos de base e 2 dígitos verificadores, módulo 11 da RFB.
 *
 * Regra: 1º DV com pesos 10 a 2 sobre os 9 primeiros algarismos, 2º DV com pesos 11 a 2 sobre os 10 primeiros; resto
 * menor que 2 vira 0, senão 11 menos o resto. Sequências de um só algarismo passam no cálculo e não são CPF válido.
 * Fonte: regra de módulo 11 da Receita Federal para o CPF (cadastro regido pela IN RFB 2.172/2024); é o mesmo cálculo
 * do CNPJ da NT Conjunta 2025.001 v1.00, item 2, com outros pesos.
 */

import type { Ocorrencia, Resultado } from '@sinete/core';
import { falha, ok } from '@sinete/core';
import { allSame, applyMask, issue, mod11Complement, stripMask, throwInvalid, weightedSum } from './digits.ts';

const CPF_WEIGHTS_1: readonly number[] = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const CPF_WEIGHTS_2: readonly number[] = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

/** Os 2 dígitos verificadores de uma base de 9 algarismos. */
export function calcularDvCpf(base: string): string {
  if (!/^\d{9}$/.test(base)) throwInvalid('CPF', 'cpf_base_invalida', 'A base do CPF tem 9 algarismos');
  const d1 = mod11Complement(weightedSum(base, CPF_WEIGHTS_1));
  const d2 = mod11Complement(weightedSum(`${base}${d1}`, CPF_WEIGHTS_2));
  return `${d1}${d2}`;
}

export interface LerOpcoes {
  /** Caminho do campo nas ocorrências (`infNFe.dest.CPF`). Padrão: o nome do documento. */
  readonly caminho?: string;
}

/** Valida e normaliza um CPF (aceita máscara); devolve só os 11 algarismos. */
export function lerCpf(input: string, options: LerOpcoes = {}): Resultado<string, Ocorrencia> {
  const path = options.caminho ?? 'CPF';
  const value = stripMask(input.trim());
  if (!/^\d*$/.test(value)) return falha(issue(path, 'cpf_caractere_invalido', 'CPF só tem algarismos'));
  if (value.length !== 11) return falha(issue(path, 'cpf_tamanho_invalido', 'CPF tem 11 algarismos'));
  if (allSame(value)) return falha(issue(path, 'cpf_digitos_repetidos', 'CPF com todos os algarismos iguais'));
  if (calcularDvCpf(value.slice(0, 9)) !== value.slice(9)) {
    return falha(issue(path, 'cpf_dv_invalido', 'Dígito verificador do CPF não confere'));
  }
  return ok(value);
}

export function cpfValido(input: string): boolean {
  return lerCpf(input).ok;
}

/** `000.000.000-00`. Não valida: formate só o que já passou por `parseCpf`. */
export function formatarCpf(value: string): string {
  return applyMask(stripMask(value), '###.###.###-##');
}
