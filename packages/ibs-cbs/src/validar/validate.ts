/**
 * Validação de um documento pelas regras da NT 2025.002, com os dois relógios do `@sinete/core`: o de emissão decide
 * quais regras estão implantadas no ambiente e as regras que a NT amarra ao ano de emissão (alíquotas, crédito
 * presumido em condição suspensiva, competência da ZFM); o de fato gerador decide as tabelas (CST, cClassTrib,
 * cCredPres, reduções) do `@sinete/ibs-cbs-dados`.
 */
import type { TimeContext } from '@sinete/core';
import { ConfigError } from '@sinete/core';
import type { IbsCbsDataset } from '@sinete/ibs-cbs-dados';
import { BRASILIA_OFFSET_MINUTES, civilDate } from '@sinete/ibs-cbs-dados';
import type { RateProvider } from '../aliquotas/index.ts';
import type { Roc } from '../calcular/index.ts';
import type { Rule, RuleContext } from './rules.ts';
import { RULES } from './rules.ts';
import type { Ambiente, RuleMeta, RulesDocument, ValidationReport, Violation } from './types.ts';

export interface ValidateOptions {
  readonly dataset: IbsCbsDataset;
  readonly time: TimeContext;
  readonly ambiente: Ambiente;
  /** Deslocamento do fuso do emitente em minutos (padrão: Brasília). */
  readonly utcOffsetMinutes?: number;
  /** Alíquotas vigentes, para a UB56-20 (a partir de 2027). */
  readonly rates?: RateProvider;
  /** Avalia todas as regras, inclusive as ainda não implantadas na data de emissão (para se antecipar). */
  readonly ignoreActivation?: boolean;
  /** Regras avaliadas; padrão: `RULES`. */
  readonly rules?: readonly Rule[];
}

/** A regra está implantada para o documento na data de emissão e no ambiente. */
export function isActive(rule: RuleMeta, doc: RulesDocument, ambiente: Ambiente, emission: string): boolean {
  if (!rule.modelos.includes(doc.modelo)) return false;
  const window = rule.activation.find((a) => a.crt === undefined || a.crt.includes(doc.crt));
  return window !== undefined && window[ambiente] <= emission;
}

export function validate(doc: RulesDocument, options: ValidateOptions): ValidationReport {
  if (!doc || !Array.isArray(doc.items)) throw new ConfigError('documento sem itens');
  if (options.ambiente !== 'producao' && options.ambiente !== 'homologacao') {
    throw new ConfigError(`ambiente inválido: ${String(options.ambiente)}`);
  }
  const offset = options.utcOffsetMinutes ?? BRASILIA_OFFSET_MINUTES;
  const emission = civilDate(options.time.emissao.now(), offset);
  const factDate = civilDate(options.time.fatoGerador.now(), offset);
  const ctx: RuleContext = {
    doc,
    content: options.dataset.at(factDate),
    emission,
    ...(options.rates ? { rates: options.rates } : {}),
  };
  const violations: Violation[] = [];
  const evaluated: string[] = [];
  const inactive: string[] = [];
  for (const rule of options.rules ?? RULES) {
    const active = options.ignoreActivation
      ? rule.modelos.includes(doc.modelo)
      : isActive(rule, doc, options.ambiente, emission);
    if (!active) {
      inactive.push(rule.id);
      continue;
    }
    evaluated.push(rule.id);
    rule.check(ctx, (item, message) =>
      violations.push({
        rule: rule.id,
        cStat: rule.cStat,
        ...(item === undefined ? {} : { item }),
        message,
        source: rule.source,
      }),
    );
  }
  return { violations, evaluated, inactive, emissionDate: emission, factDate };
}

/** Documento para `validate` a partir do `Roc` do motor, com os campos de identificação que o `Roc` não tem. */
export function documentFromRoc(
  roc: Roc,
  ident: Omit<RulesDocument, 'items' | 'IBSCBSTot' | 'gCompraGov'> & {
    readonly items?: readonly Omit<RulesDocument['items'][number], 'IBSCBS'>[];
  },
): RulesDocument {
  const { items: extra, ...rest } = ident;
  return {
    ...rest,
    ...(roc.oper ? { gCompraGov: roc.oper.gCompraGov } : {}),
    items: roc.items.map((it) => ({ ...extra?.find((x) => x.nItem === it.nItem), nItem: it.nItem, IBSCBS: it.IBSCBS })),
    IBSCBSTot: roc.total.IBSCBSTot,
  };
}
