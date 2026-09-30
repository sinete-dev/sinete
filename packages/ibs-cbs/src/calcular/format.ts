/**
 * Formatação de saída, igual à da Calculadora (`ArredondamentoUtils.formatarMoeda` e `formatarAliquota`), que por sua
 * vez segue os tipos do leiaute: valor em `TDec_1302` (2 casas) e percentual em `TDec_0302_04` (de 2 a 4 casas).
 */
import { Decimal } from './decimal.ts';

/** Valor monetário com 2 casas, HALF_EVEN. */
export function dinheiro(valor: Decimal): string {
  return valor.toFixed(2, 'HALF_EVEN');
}

/** Percentual com 4 casas HALF_EVEN, sem zeros à direita e com no mínimo 2 casas (`'0.90'`, `'0.1234'`, `'60.00'`). */
export function percentual(valor: Decimal): string {
  const stripped = valor.setScale(4, 'HALF_EVEN').stripZeros();
  return (stripped.scale < 2 ? stripped.setScale(2) : stripped).toString();
}

/** Fração (`0.009`) para percentual (`0.9`), sem arredondar (`movePointRight(2)`). */
export function paraPercentual(fracao: Decimal): Decimal {
  return fracao.movePointRight(2);
}

/** Percentual (`'0.9'`) para fração com 8 casas HALF_EVEN, como o `dividirPorCem` da Calculadora. */
export function dePercentual(valor: Decimal): Decimal {
  return Decimal.of(valor.unscaled, valor.scale + 2).setScale(8, 'HALF_EVEN');
}
