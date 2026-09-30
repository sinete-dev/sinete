/**
 * Contexto de uma montagem: coleta ocorrências e converte as entradas numéricas conferindo cada uma contra o formato do
 * campo no leiaute. As contas usam o valor já na precisão do XML (uma alíquota com 5 casas é recusada, não
 * arredondada em silêncio), para que o que vai no XML seja exatamente o que entrou na conta.
 */

import type { DecimalInput, RoundingMode } from '../decimal.ts';
import { Decimal } from '../decimal.ts';
import type { FormatoDecimal } from '../format.ts';
import { formatarDecimal, problemaDeFormato } from '../format.ts';
import type { Issues } from '../issues.ts';

/** Famílias de campo com modo de arredondamento próprio (`data/arredondamento.json`). */
export type Familia = 'produto' | 'icms' | 'ipi' | 'pisCofins' | 'issqn' | 'ibsCbs';

/** Tolerância das regras de validação de valor (MOC 7.0 Anexo I, nota (*4); NT 2025.002, observações das RV UB). */
export const TOLERANCIA: Decimal = Decimal.of('0.01');

export class Ctx {
  readonly issues: Issues;
  readonly modes: Readonly<Record<Familia, RoundingMode>>;
  /**
   * Confere o valor informado contra o calculado. Desligado na NF-e complementar e na de ajuste (finNFe 2 e 3), cujos
   * valores complementam outra nota e não seguem a conta do item (MOC 7.0 Anexo I, RV I11: "Se NF-e Normal").
   */
  readonly conferir: boolean;

  constructor(issues: Issues, modes: Readonly<Record<Familia, RoundingMode>>, conferir = true) {
    this.issues = issues;
    this.modes = modes;
    this.conferir = conferir;
  }

  /** Entrada opcional; inválida vira ocorrência e `undefined`. */
  opt(value: DecimalInput | undefined, path: string, format: FormatoDecimal): Decimal | undefined {
    if (value === undefined) return undefined;
    const d = Decimal.tryOf(value);
    if (d === undefined) {
      this.issues.add(path, 'decimal_invalido', 'número decimal inválido (use ponto como separador, sem milhar)');
      return undefined;
    }
    const problem = problemaDeFormato(d, format);
    if (problem !== undefined) {
      this.issues.add(path, 'decimal_invalido', `${problem} (${format.nome})`);
      return undefined;
    }
    return d;
  }

  /** Entrada obrigatória; ausente ou inválida vira ocorrência e zero, para que a montagem siga e junte tudo. */
  req(value: DecimalInput | undefined, path: string, format: FormatoDecimal): Decimal {
    if (value === undefined) {
      this.issues.add(path, 'campo_obrigatorio', 'campo obrigatório');
      return Decimal.ZERO;
    }
    return this.opt(value, path, format) ?? Decimal.ZERO;
  }

  /** Arredonda um valor calculado no formato do campo pelo modo da família. */
  round(value: Decimal, format: FormatoDecimal, familia: Familia): Decimal {
    return value.round(format.max, this.modes[familia]);
  }

  /**
   * Valor derivado: sem valor informado, o calculado (arredondado); com valor informado, o informado, conferido
   * contra o calculado com a tolerância das regras de validação.
   */
  /**
   * Base de cálculo: a informada prevalece sem conferência (a base legal varia por operação, UF e regime); o padrão
   * só vale quando nada veio.
   */
  base(
    given: DecimalInput | undefined,
    padrao: Decimal,
    path: string,
    format: FormatoDecimal,
    familia: Familia,
  ): Decimal {
    return this.opt(given, path, format) ?? this.round(padrao, format, familia);
  }

  calc(
    given: DecimalInput | undefined,
    computed: Decimal,
    path: string,
    format: FormatoDecimal,
    familia: Familia,
  ): Decimal {
    const r = this.round(computed, format, familia);
    if (given === undefined) return r;
    const g = this.opt(given, path, format);
    if (g === undefined) return r;
    if (this.conferir && g.minus(r).abs().gt(TOLERANCIA)) {
      this.issues.add(
        path,
        'valor_divergente',
        `valor informado difere do calculado (${r.toFixed(format.max)}) em mais de ${TOLERANCIA.toString()}`,
      );
    }
    return g;
  }

  /** Texto no formato do campo. */
  s(value: Decimal, format: FormatoDecimal): string {
    return formatarDecimal(value, format);
  }

  /** Texto opcional: ausente fica ausente, e zero some nos formatos que não aceitam zero. */
  so(value: Decimal | undefined, format: FormatoDecimal): string | undefined {
    if (value === undefined) return undefined;
    if (format.naoNulo && value.isZero()) return undefined;
    return formatarDecimal(value, format);
  }
}

/** Remove as chaves com `undefined` (o serializer ignora, mas o objeto devolvido fica limpo e comparável). */
export function clean<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

/** Só dígitos (tira máscara de CEP, CNPJ numérico, telefone). */
export function digits(s: string): string {
  return s.replace(/\D/g, '');
}
