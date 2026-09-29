/**
 * IBS/CBS (grupo UB, NT 2025.002): chama a calculadora injetada para os itens classificados e totaliza o grupo
 * `IBSCBSTot` (W34 a W59g) somando exatamente os valores dos itens.
 */

import { firstChild, parseXml } from '@sinete/core/xml';
import type { ComplexType } from '@sinete/schemas';
import { serialize, validate } from '@sinete/schemas';
import type { TIBSCBSMonoTot, TTribNFe } from '@sinete/schemas/nfe/PL_010f';
import { Decimal } from '../decimal.ts';
import type { Issues } from '../issues.ts';

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

/**
 * Valida contra o schema um grupo repassado (IBSCBS pronto ou da calculadora, IS) antes de qualquer soma: grupo
 * incompleto vira ocorrência `schema` com o caminho do item, nunca exceção no meio dos totais.
 */
export function grupoInvalido(ct: ComplexType, nome: string, value: unknown, path: string, issues: Issues): boolean {
  if (value === undefined) return false;
  try {
    const doc = parseXml(`<w xmlns="${NFE_NS}">${serialize(ct, nome, value as never, NFE_NS)}</w>`);
    const el = firstChild(doc.root, nome, NFE_NS);
    const erros =
      el === undefined ? [{ path: '', code: 'modelo_de_conteudo', message: 'grupo vazio' }] : validate(ct, el);
    for (const e of erros)
      issues.add(`${path}${e.path.replace(/^\/[^/]+/, '').replace(/\//g, '.')}`, 'schema', `${e.code}: ${e.message}`);
    return erros.length > 0;
  } catch (e) {
    issues.add(path, 'schema', `grupo malformado: ${(e as Error).message}`);
    return true;
  }
}

/** Campos numéricos dos grupos do leiaute: valores, percentuais, quantidades e ad rem (`vBC`, `pIBSUF`, `qBCMono`...). */
const NUMERICO = /^(v|p|q|adRem)[A-Z]/;

/** Aponta cada campo numérico que não é um decimal válido, em qualquer profundidade de um grupo repassado. */
export function decimaisInvalidos(value: unknown, path: string, issues: Issues): void {
  if (typeof value !== 'object' || value === null) return;
  for (const [k, v] of Object.entries(value)) {
    const p = `${path}.${k}`;
    if (typeof v === 'string' && NUMERICO.test(k) && Decimal.tryOf(v) === undefined) {
      issues.add(p, 'decimal_invalido', 'número decimal inválido');
    } else if (typeof v === 'object') decimaisInvalidos(v, p, issues);
  }
}

/** Soma todos os campos `name` em qualquer profundidade do objeto (valores lexicais do leiaute). */
export function somaCampo(value: unknown, name: string): Decimal {
  if (typeof value !== 'object' || value === null) return Decimal.ZERO;
  let acc = Decimal.ZERO;
  for (const [k, v] of Object.entries(value)) {
    if (k === name && typeof v === 'string') acc = acc.plus(Decimal.of(v));
    else if (typeof v === 'object') acc = acc.plus(somaCampo(v, name));
  }
  return acc;
}

/** Valores do grupo do item que entram no vItem (VB01-10): vIBS, vCBS e os totais monofásicos. */
export function ibsCbsDoItem(g: TTribNFe): {
  vIBS: Decimal;
  vCBS: Decimal;
  vTotIBSMonoItem: Decimal;
  vTotCBSMonoItem: Decimal;
} {
  const s = (x: string | undefined): Decimal => (x === undefined ? Decimal.ZERO : Decimal.of(x));
  return {
    vIBS: s(g.gIBSCBS?.vIBS),
    vCBS: s(g.gIBSCBS?.gCBS.vCBS),
    vTotIBSMonoItem: s(g.gIBSCBSMono?.vTotIBSMonoItem),
    vTotCBSMonoItem: s(g.gIBSCBSMono?.vTotCBSMonoItem),
  };
}

/** `IBSCBSTot` a partir dos grupos dos itens (NT 2025.002, W35-10 a W59g-10). */
export function totalIbsCbs(grupos: readonly TTribNFe[]): TIBSCBSMonoTot {
  const f = (d: Decimal): string => d.toFixed(2);
  const sum = (pick: (g: TTribNFe) => unknown, name: string): Decimal =>
    grupos.reduce((acc, g) => acc.plus(somaCampo(pick(g), name)), Decimal.ZERO);
  // gIBS e gCBS entram quando há tributação regular ou crédito presumido em algum item: o crédito pode vir sem o
  // gIBSCBS e não pode sumir do total.
  const regulares = grupos.filter((g) => g.gIBSCBS !== undefined || g.gCredPresOper !== undefined);
  const total: Record<string, unknown> = {
    vBCIBSCBS: f(sum((g) => g.gIBSCBS && { vBC: g.gIBSCBS.vBC }, 'vBC')),
  };
  if (regulares.length > 0) {
    const credIbs = (g: TTribNFe): unknown => g.gCredPresOper?.gIBSCredPres;
    const credCbs = (g: TTribNFe): unknown => g.gCredPresOper?.gCBSCredPres;
    total.gIBS = {
      gIBSUF: {
        vDif: f(sum((g) => g.gIBSCBS?.gIBSUF.gDif, 'vDif')),
        vDevTrib: f(sum((g) => g.gIBSCBS?.gIBSUF.gDevTrib, 'vDevTrib')),
        vIBSUF: f(sum((g) => g.gIBSCBS && { v: g.gIBSCBS.gIBSUF.vIBSUF }, 'v')),
      },
      gIBSMun: {
        vDif: f(sum((g) => g.gIBSCBS?.gIBSMun.gDif, 'vDif')),
        vDevTrib: f(sum((g) => g.gIBSCBS?.gIBSMun.gDevTrib, 'vDevTrib')),
        vIBSMun: f(sum((g) => g.gIBSCBS && { v: g.gIBSCBS.gIBSMun.vIBSMun }, 'v')),
      },
      vIBS: f(sum((g) => g.gIBSCBS && { v: g.gIBSCBS.vIBS }, 'v')),
      vCredPres: f(sum(credIbs, 'vCredPres')),
      vCredPresCondSus: f(sum(credIbs, 'vCredPresCondSus')),
    };
    total.gCBS = {
      vDif: f(sum((g) => g.gIBSCBS?.gCBS.gDif, 'vDif')),
      vDevTrib: f(sum((g) => g.gIBSCBS?.gCBS.gDevTrib, 'vDevTrib')),
      vCBS: f(sum((g) => g.gIBSCBS && { v: g.gIBSCBS.gCBS.vCBS }, 'v')),
      vCredPres: f(sum(credCbs, 'vCredPres')),
      vCredPresCondSus: f(sum(credCbs, 'vCredPresCondSus')),
    };
  }
  if (grupos.some((g) => g.gIBSCBSMono !== undefined)) {
    const mono = (n: string): string => f(sum((g) => g.gIBSCBSMono, n));
    total.gMono = {
      vIBSMono: mono('vIBSMono'),
      vCBSMono: mono('vCBSMono'),
      vIBSMonoReten: mono('vIBSMonoReten'),
      vCBSMonoReten: mono('vCBSMonoReten'),
      vIBSMonoRet: mono('vIBSMonoRet'),
      vCBSMonoRet: mono('vCBSMonoRet'),
    };
  }
  if (grupos.some((g) => g.gEstornoCred !== undefined)) {
    total.gEstornoCred = {
      vIBSEstCred: f(sum((g) => g.gEstornoCred, 'vIBSEstCred')),
      vCBSEstCred: f(sum((g) => g.gEstornoCred, 'vCBSEstCred')),
    };
  }
  return total as TIBSCBSMonoTot;
}
