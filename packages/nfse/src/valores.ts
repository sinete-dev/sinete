/**
 * Valores monetários e percentuais na forma lexical do leiaute (`TSDec15V2`, `TSDec3V2`, `TSDec1V2`: ponto decimal e
 * exatamente 2 casas). A DPS só leva o que o emitente declara; o ISSQN, o IBS e a CBS são calculados pela Sefin
 * Nacional, então não há conta aqui, só conversão sem perda: texto com mais casas do que o campo aceita, número que
 * não cabe em 2 casas sem arredondar, negativo e não finito viram ocorrência, nunca arredondamento silencioso.
 */

import type { Ocorrencia } from '@sinete/core';

/** Valor aceito na entrada. Prefira texto (`'1500.00'`): número binário pode não representar a casa decimal exata. */
export type Valor = string | number;

const TEXTO = /^\d+(?:\.(\d+))?$/;

/**
 * Converte para texto com `casas` casas decimais. Devolve `undefined` e acrescenta a ocorrência em `issues` quando o
 * valor não tem representação exata.
 */
export function formatValor(valor: Valor, path: string, issues: Ocorrencia[], casas: number = 2): string | undefined {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) {
      issues.push({
        caminho: path,
        code: 'valor_invalido',
        mensagem: 'valor precisa ser um número finito não negativo',
      });
      return undefined;
    }
    const fixo = valor.toFixed(casas);
    // Tolerância só para o ruído binário (0.1 + 0.2), nunca para uma casa a mais de verdade (1.005).
    if (Math.abs(Number(fixo) - valor) > 1e-9) {
      issues.push({ caminho: path, code: 'valor_casas', mensagem: `valor com mais de ${casas} casas decimais` });
      return undefined;
    }
    return fixo;
  }
  const texto = valor.trim();
  const m = TEXTO.exec(texto);
  if (m === null) {
    issues.push({
      caminho: path,
      code: 'valor_invalido',
      mensagem: 'valor precisa ser decimal com ponto (ex.: 1500.00)',
    });
    return undefined;
  }
  const frac = m[1] ?? '';
  const extra = frac.slice(casas);
  if (/[1-9]/.test(extra)) {
    issues.push({ caminho: path, code: 'valor_casas', mensagem: `valor com mais de ${casas} casas decimais` });
    return undefined;
  }
  const inteiro = texto.split('.')[0]?.replace(/^0+(?=\d)/, '') ?? '0';
  return `${inteiro}.${frac.slice(0, casas).padEnd(casas, '0')}`;
}
