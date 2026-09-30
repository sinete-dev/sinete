/**
 * CODE-128 (ISO/IEC 15417), o código de barras da chave de acesso no DANFE (MOC 7.0, Anexo II, cap. 2 e Anexo III.01)
 * e no DAMDFE (MOC MDF-e 3.00a, Anexo II, 2.2): subconjunto C, dois dígitos por símbolo, com o híbrido C/A da NT
 * 2025.001 para a chave com CNPJ alfanumérico.
 */

import { ErroDa } from '../errors.ts';

/**
 * Larguras barra/espaço dos 107 símbolos (valores 0 a 106; 105 é o Start C, 106 é o Stop), do Anexo III.01 do MOC e
 * da tabela de caracteres CODE-128 da NT 2025.001.
 */
const PATTERNS: readonly string[] = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 ' +
  '113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
  '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 ' +
  '113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 ' +
  '241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
  '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 ' +
  '211232 2331112'
).split(' ');

/** Zona de silêncio mínima de cada lado, em módulos (MOC 7.0, Anexo II, cap. 2). */
export const QUIET_MODULES = 10;

const START_C = 105;
const CODE_A = 101; // no subconjunto C, troca para o A
const CODE_C = 99; // no subconjunto A, troca para o C
const STOP = 106;

/** Acrescenta o dígito verificador módulo 103 (peso 1 no start e no primeiro dado) e o Stop. */
function fechar(vals: number[]): number[] {
  let sum = vals[0] ?? 0;
  for (let i = 1; i < vals.length; i++) sum += (vals[i] ?? 0) * i;
  return [...vals, sum % 103, STOP];
}

function symbolize(vals: number[]): number[] {
  return fechar(vals).flatMap((v) => [...(PATTERNS[v] ?? '')].map(Number));
}

/**
 * Larguras (em módulos) de Start C, dados, dígito verificador módulo 103 (MOC 2.1) e Stop, começando por barra.
 * Exige quantidade par de dígitos.
 */
export function code128C(digitos: string): number[] {
  if (!/^(\d\d)+$/.test(digitos)) {
    throw new ErroDa('codigo_barras_invalido', 'CODE-128C exige quantidade par de dígitos', {
      detalhes: { comprimento: digitos.length },
    });
  }
  const vals = [START_C];
  for (let i = 0; i < digitos.length; i += 2) vals.push(Number(digitos.slice(i, i + 2)));
  return symbolize(vals);
}

/**
 * Código de barras da chave de acesso, numérica ou com CNPJ alfanumérico (NT 2025.001 v1.00, seção 6): começa em
 * Start C e codifica pares de dígitos; num caractere que não forma par de dígitos, troca para o subconjunto A (código
 * 101) e segue caractere a caractere; volta ao C (código 99) quando o que resta até a próxima letra é um número par de
 * dígitos, de 4 ou mais, ou o par final. Chave só com dígitos, em quantidade par, sai idêntica ao `code128C`. Aceita dígitos e letras maiúsculas.
 */
export function code128Chave(chave: string): number[] {
  return symbolize(valoresChave(chave).slice(0, -2));
}

/** Valores dos símbolos da chave (start, dados, trocas de subconjunto, DV e stop), para conferir contra a NT. */
export function valoresChave(chave: string): number[] {
  if (!/^[0-9A-Z]+$/.test(chave)) {
    throw new ErroDa('codigo_barras_invalido', 'chave com caractere fora de 0-9 e A-Z', {
      detalhes: { comprimento: chave.length },
    });
  }
  const digit = (i: number): boolean => i < chave.length && chave.charCodeAt(i) >= 48 && chave.charCodeAt(i) <= 57;
  const run = (i: number): number => {
    let j = i;
    while (digit(j)) j++;
    return j - i;
  };
  const vals = [START_C];
  let setC = true;
  let i = 0;
  while (i < chave.length) {
    if (setC) {
      if (digit(i) && digit(i + 1)) {
        vals.push(Number(chave.slice(i, i + 2)));
        i += 2;
        continue;
      }
      vals.push(CODE_A);
      setC = false;
    }
    // Voltar ao C custa um símbolo: só compensa com 4 ou mais dígitos, ou com o par que fecha a chave, como no exemplo
    // da NT (ISO/IEC 15417, anexo E). Assim a pior chave alfanumérica fica em 32 símbolos (365 módulos, 73 mm no
    // módulo mínimo).
    const r = run(i);
    if (r % 2 === 0 && (r >= 4 || (r === 2 && i + r === chave.length))) {
      vals.push(CODE_C);
      setC = true;
      continue;
    }
    // Subconjunto A: valor = ASCII - 32 para os caracteres imprimíveis (dígitos e letras maiúsculas).
    vals.push(chave.charCodeAt(i) - 32);
    i++;
  }
  return fechar(vals);
}

/** Total de módulos de uma sequência de larguras. */
export function modules(widths: readonly number[]): number {
  let n = 0;
  for (const w of widths) n += w;
  return n;
}
