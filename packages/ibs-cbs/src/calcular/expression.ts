/**
 * Avaliador das expressões de cálculo do dataset (`TRATAMENTO_TRIBUTARIO` da Calculadora, `treatments` do `@sinete/ibs-cbs-dados`).
 *
 * As regras de cálculo são dados: `aliquota*(1-percentualReducao)*(1-pRedutorCompraGov/100)`,
 * `baseCalculo*aliquotaEfetiva`, `tributoCalculado*1.00`. Este módulo só aceita a gramática que as tabelas usam
 * (números, variáveis conhecidas, `+ - * /`, parênteses e menos unário) e reproduz a semântica do avaliador oficial
 * (`AvaliadorExpressaoAritmetica`, JEXL com `BigDecimal`):
 *
 * - expressão que é só o nome de uma variável devolve o valor da variável sem arredondar;
 * - qualquer outra é avaliada exatamente (divisão com 34 dígitos significativos) e arredondada para 8 casas HALF_EVEN;
 * - variável ausente vale zero (o mapa oficial troca `null` por `ZERO`);
 * - identificador fora da lista é erro, nunca zero: expressão desconhecida é mudança de dado que precisa de revisão.
 */
import { Decimal } from './decimal.ts';
import { ExpressionError } from './errors.ts';

/** Variáveis que as expressões oficiais podem citar (`VariavelExpressao` da Calculadora). */
export const EXPRESSION_VARIABLES: readonly string[] = [
  'aliquota',
  'aliquotaEfetiva',
  'baseCalculo',
  'baseCalculoInformada',
  'impostoSeletivoInformado',
  'impostoSeletivoCalculado',
  'percentualReducao',
  'pRedutorCompraGov',
  'quantidade',
  'tributoCalculado',
  'percentualDiferimento',
  'aliquotaPadraoOuReferencia',
  'aliquotaReferencia',
  'aliquotaAdValorem',
  'aliquotaAdRem',
  'ajuste',
  'redutor',
  'aliquotaAdRemPrincipal',
  'aliquotaAdRemSecundaria',
  'variacaoPontoPercentual',
  'pBio',
];

/** Escala interna de todo resultado de expressão (`ArredondamentoUtils.PRECISAO_INTERNA`). */
export const INTERNAL_SCALE = 8;

export type Variables = Readonly<Record<string, Decimal | undefined>>;

type Token = { kind: 'num'; value: string } | { kind: 'id'; value: string } | { kind: 'op'; value: string };

function tokenize(expr: string): Token[] {
  const out: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([()+\-*/]))/y;
  let pos = 0;
  while (pos < expr.length) {
    if (/^\s*$/.test(expr.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(expr);
    if (!m) throw new ExpressionError(expr, `caractere inesperado na posição ${pos}`);
    pos = re.lastIndex;
    if (m[1] !== undefined) out.push({ kind: 'num', value: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'id', value: m[2] });
    else out.push({ kind: 'op', value: m[3] ?? '' });
  }
  return out;
}

/** Confere que a expressão só usa a gramática e as variáveis conhecidas; devolve as variáveis citadas. */
export function checkExpression(expr: string): readonly string[] {
  const toks = tokenize(expr);
  const ids = toks.filter((t) => t.kind === 'id').map((t) => t.value);
  for (const id of ids) {
    if (!EXPRESSION_VARIABLES.includes(id)) throw new ExpressionError(expr, `variável desconhecida: ${id}`);
  }
  // Uma avaliação valida a sintaxe; cada variável recebe um valor distinto, para `x/(1-y)` não virar divisão por zero.
  evaluate(expr, Object.fromEntries(ids.map((id, i) => [id, Decimal.of(BigInt(113 + 7 * i), 3)])));
  return [...new Set(ids)];
}

export function evaluate(expr: string, vars: Variables): Decimal {
  const trimmed = expr.trim();
  if (EXPRESSION_VARIABLES.includes(trimmed)) return vars[trimmed] ?? Decimal.ZERO;
  const toks = tokenize(trimmed);
  let i = 0;
  const peek = (): Token | undefined => toks[i];
  const next = (): Token => {
    const t = toks[i++];
    if (!t) throw new ExpressionError(expr, 'fim inesperado');
    return t;
  };
  const primary = (): Decimal => {
    const t = next();
    if (t.kind === 'num') return Decimal.parse(t.value);
    if (t.kind === 'id') {
      if (!EXPRESSION_VARIABLES.includes(t.value)) throw new ExpressionError(expr, `variável desconhecida: ${t.value}`);
      return vars[t.value] ?? Decimal.ZERO;
    }
    if (t.value === '(') {
      const v = additive();
      const close = next();
      if (close.value !== ')') throw new ExpressionError(expr, 'parêntese sem fechar');
      return v;
    }
    if (t.value === '-') return primary().neg();
    if (t.value === '+') return primary();
    throw new ExpressionError(expr, `operador inesperado: ${t.value}`);
  };
  const multiplicative = (): Decimal => {
    let v = primary();
    for (let t = peek(); t?.kind === 'op' && (t.value === '*' || t.value === '/'); t = peek()) {
      next();
      const r = primary();
      if (t.value === '*') v = v.mul(r);
      else if (r.isZero()) throw new ExpressionError(expr, 'divisão por zero');
      else v = v.div(r);
    }
    return v;
  };
  const additive = (): Decimal => {
    let v = multiplicative();
    for (let t = peek(); t?.kind === 'op' && (t.value === '+' || t.value === '-'); t = peek()) {
      next();
      const r = multiplicative();
      v = t.value === '+' ? v.add(r) : v.sub(r);
    }
    return v;
  };
  const result = additive();
  if (i !== toks.length) throw new ExpressionError(expr, `sobra na posição do token ${i}`);
  return result.setScale(INTERNAL_SCALE, 'HALF_EVEN');
}
