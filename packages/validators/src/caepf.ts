/**
 * CAEPF (Cadastro de Atividade Econômica da Pessoa Física, IN RFB 1.828/2018): 14 algarismos, sendo os 9 do CPF do
 * titular, 3 de sequência do estabelecimento e 2 de controle.
 *
 * Regra de controle: calculam-se os 2 dígitos pelo módulo 11 do CNPJ (pesos 2 a 9 da direita para a esquerda sobre
 * os 12 primeiros algarismos e depois sobre os 13), soma-se 12 ao número de 2 algarismos formado por eles e, se passar
 * de 99, subtrai-se 100. Fonte: regra divulgada pela RFB para o CAEPF (leiautes do eSocial e da EFD-Reinf, campo
 * `nrInsc` com `tpInsc=3`). A fonte primária em página oficial não estava acessível em 2026-09-25; a regra foi
 * conferida contra uma implementação anterior em produção, com os mesmos titulares.
 */

import type { Ocorrencia, Resultado } from '@sinete/core';
import { falha, ok } from '@sinete/core';
import { calcularDvCnpj } from './cnpj.ts';
import type { LerOpcoes } from './cpf.ts';
import { allSame, applyMask, issue, stripMask, throwInvalid } from './digits.ts';

/** Os 2 dígitos de controle do CAEPF para uma base de 12 algarismos. */
export function calcularDvCaepf(base: string): string {
  if (!/^\d{12}$/.test(base)) throwInvalid('CAEPF', 'caepf_base_invalida', 'A base do CAEPF tem 12 algarismos');
  const n = (Number(calcularDvCnpj(base)) + 12) % 100;
  return String(n).padStart(2, '0');
}

/** Valida e normaliza um CAEPF (aceita máscara); devolve os 14 algarismos. */
export function lerCaepf(entrada: string, opcoes: LerOpcoes = {}): Resultado<string, Ocorrencia> {
  const path = opcoes.caminho ?? 'CAEPF';
  const value = stripMask(entrada.trim());
  if (!/^\d*$/.test(value)) return falha(issue(path, 'caepf_caractere_invalido', 'CAEPF só tem algarismos'));
  if (value.length !== 14) return falha(issue(path, 'caepf_tamanho_invalido', 'CAEPF tem 14 algarismos'));
  if (allSame(value)) return falha(issue(path, 'caepf_digitos_repetidos', 'CAEPF com todos os algarismos iguais'));
  if (calcularDvCaepf(value.slice(0, 12)) !== value.slice(12)) {
    return falha(issue(path, 'caepf_dv_invalido', 'Dígitos de controle do CAEPF não conferem'));
  }
  return ok(value);
}

export function caepfValido(entrada: string): boolean {
  return lerCaepf(entrada).ok;
}

/** `000.000.000/000-00`. Não valida. */
export function formatarCaepf(valor: string): string {
  return applyMask(stripMask(valor), '###.###.###/###-##');
}
