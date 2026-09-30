/**
 * Provedores de alíquota. `officialRates` responde pela tabela versionada (fonte e vigência em cada linha);
 * `withOverrides` sobrepõe alíquotas informadas pelo usuário, que saem com estado `user-provided` e o motivo.
 * `requireRate` é a fronteira: devolve o valor ou lança `RateUnknownError`, nunca um default.
 */
import { ErroDeConfiguracao } from '@sinete/core';
import table from './data/rates.json' with { type: 'json' };
import { RatesDataError, RateUnknownError } from './errors.ts';
import type {
  IsoDate,
  NominalRates,
  Place,
  Rate,
  RateOverride,
  RateProvider,
  RatesTable,
  RateTributo,
  ReferenceRateRecord,
  StandardRateRecord,
  Validity,
} from './types.ts';
import { RATE_TRIBUTOS } from './types.ts';

/** Formato de tabela que este código lê. */
export const RATES_SCHEMA_VERSION = 1;

/** A tabela embarcada nesta versão do pacote. */
export const RATES_TABLE: RatesTable = table as unknown as RatesTable;

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DECIMAL = /^\d{1,3}(\.\d{1,4})?$/;

function checkDate(date: IsoDate): IsoDate {
  if (typeof date !== 'string' || !ISO_DATE.test(date)) {
    throw new ErroDeConfiguracao(`data inválida: ${JSON.stringify(date)}; use AAAA-MM-DD`, { detalhes: { date } });
  }
  return date;
}

const inForce = (v: Validity, d: IsoDate): boolean => v.from <= d && (v.to === null || v.to >= d);
const overlaps = (a: Validity, b: Validity): boolean =>
  a.from <= (b.to ?? '9999-12-31') && b.from <= (a.to ?? '9999-12-31');

function checkPercent(value: unknown, where: string): void {
  if (typeof value !== 'string' || !DECIMAL.test(value) || Number(value) > 100) {
    throw new RatesDataError(`${where}: alíquota fora do formato (percentual de 0 a 100, até 4 casas): ${value}`);
  }
}

function validateTable(t: RatesTable): void {
  if (t.schemaVersion !== RATES_SCHEMA_VERSION) {
    throw new RatesDataError(`schemaVersion ${t.schemaVersion} não suportado; este código lê ${RATES_SCHEMA_VERSION}`);
  }
  const ids = new Set(t.sources.map((s) => s.id));
  const check = (r: ReferenceRateRecord | StandardRateRecord, where: string): void => {
    if (!ISO_DATE.test(r.validity.from) || (r.validity.to !== null && !ISO_DATE.test(r.validity.to))) {
      throw new RatesDataError(`${where}: vigência inválida`);
    }
    for (const s of r.sources) if (!ids.has(s)) throw new RatesDataError(`${where}: fonte ${s} inexistente`);
  };
  t.reference.forEach((r, i) => {
    const where = `reference[${i}] ${r.tributo} ${r.validity.from}`;
    check(r, where);
    if (r.status === 'official') checkPercent(r.rate, where);
    else if (r.rate !== null) throw new RatesDataError(`${where}: alíquota desconhecida com valor`);
    const clash = t.reference.find((o, j) => j !== i && o.tributo === r.tributo && overlaps(o.validity, r.validity));
    if (clash) throw new RatesDataError(`${where}: vigência sobreposta a ${clash.tributo} ${clash.validity.from}`);
  });
  t.standard.forEach((r, i) => {
    const where = `standard[${i}] ${r.tributo} ${r.ente} ${r.validity.from}`;
    check(r, where);
    checkPercent(r.rate, where);
    const clash = t.standard.find(
      (o, j) => j !== i && o.tributo === r.tributo && o.ente === r.ente && overlaps(o.validity, r.validity),
    );
    if (clash) throw new RatesDataError(`${where}: vigência sobreposta`);
  });
}

function unknownRate(tributo: RateTributo, note: string): Rate {
  return { tributo, status: 'unknown', value: null, sources: [], note };
}

function fromReference(r: ReferenceRateRecord): Rate {
  return {
    tributo: r.tributo,
    status: r.status,
    value: r.rate,
    legal: r.legal,
    sources: r.sources,
    validity: r.validity,
    ...(r.note === undefined ? {} : { note: r.note }),
  };
}

/** Provedor da tabela oficial (a embarcada, por padrão). */
export function officialRates(t: RatesTable = RATES_TABLE): RateProvider {
  validateTable(t);
  const reference = (tributo: RateTributo, d: IsoDate): Rate => {
    const r = t.reference.find((x) => x.tributo === tributo && inForce(x.validity, d));
    return r
      ? fromReference(r)
      : unknownRate(tributo, `sem alíquota de ${tributo} na tabela para ${d} (antes de 2026 não há IBS/CBS)`);
  };
  const standard = (tributo: RateTributo, d: IsoDate, place: Place | undefined): Rate => {
    if (place && tributo !== 'CBS') {
      const ente = tributo === 'IBSUF' ? place.uf : place.cMun;
      const s = t.standard.find((x) => x.tributo === tributo && x.ente === ente && inForce(x.validity, d));
      if (s)
        return { tributo, status: 'official', value: s.rate, legal: s.legal, sources: s.sources, validity: s.validity };
    }
    // Sem lei própria do ente, vale a alíquota de referência (LC 214/2025, art. 18).
    return reference(tributo, d);
  };
  const all = (f: (t: RateTributo) => Rate): NominalRates => ({
    CBS: f('CBS'),
    IBSUF: f('IBSUF'),
    IBSMun: f('IBSMun'),
  });
  return {
    id: `oficial ${t.dataVersion}`,
    nominal: (date: IsoDate, place?: Place): NominalRates => {
      const d = checkDate(date);
      return all((tr) => standard(tr, d, place));
    },
    reference: (date: IsoDate): NominalRates => {
      const d = checkDate(date);
      return all((tr) => reference(tr, d));
    },
  };
}

function validateOverride(o: RateOverride, i: number): void {
  const where = `override[${i}]`;
  if (!RATE_TRIBUTOS.includes(o.tributo))
    throw new ErroDeConfiguracao(`${where}: tributo inválido: ${String(o.tributo)}`);
  if (typeof o.value !== 'string' || !DECIMAL.test(o.value) || Number(o.value) > 100) {
    throw new ErroDeConfiguracao(
      `${where}: alíquota inválida (percentual de 0 a 100, até 4 casas): ${String(o.value)}`,
    );
  }
  if (typeof o.reason !== 'string' || o.reason.trim() === '') {
    throw new ErroDeConfiguracao(`${where}: informe o motivo da alíquota informada (reason)`);
  }
  if (o.validity) {
    checkDate(o.validity.from);
    if (o.validity.to !== null) checkDate(o.validity.to);
  }
}

/**
 * Sobrepõe alíquotas informadas pelo usuário. A primeira sobreposição que casar (tributo, vigência, local, tipo)
 * vence; as demais alíquotas continuam vindo de `base`. O resultado sai `user-provided`, com o motivo.
 */
export function withOverrides(base: RateProvider, overrides: readonly RateOverride[]): RateProvider {
  overrides.forEach(validateOverride);
  const apply = (rates: NominalRates, d: IsoDate, kind: 'nominal' | 'reference', place?: Place): NominalRates => {
    const pick = (tributo: RateTributo): Rate => {
      const o = overrides.find(
        (x) =>
          x.tributo === tributo &&
          (x.applies ?? 'both') !== (kind === 'nominal' ? 'reference' : 'nominal') &&
          (!x.validity || inForce(x.validity, d)) &&
          (!x.place ||
            (place !== undefined &&
              (x.place.uf === undefined || x.place.uf === place.uf) &&
              (x.place.cMun === undefined || x.place.cMun === place.cMun))),
      );
      if (!o) return rates[tributo];
      return {
        tributo,
        status: 'user-provided',
        value: o.value,
        sources: o.source ? ['user', o.source] : ['user'],
        reason: o.reason,
        ...(o.validity ? { validity: o.validity } : {}),
      };
    };
    return { CBS: pick('CBS'), IBSUF: pick('IBSUF'), IBSMun: pick('IBSMun') };
  };
  return {
    id: `${base.id} + ${overrides.length} informada(s)`,
    nominal: (date: IsoDate, place?: Place): NominalRates =>
      apply(base.nominal(date, place), checkDate(date), 'nominal', place),
    reference: (date: IsoDate): NominalRates => apply(base.reference(date), checkDate(date), 'reference'),
  };
}

/** Valor da alíquota, ou `RateUnknownError` quando ela ainda não existe. */
export function requireRate(rate: Rate, date: IsoDate): string {
  if (rate.value === null || rate.status === 'unknown') {
    throw new RateUnknownError(
      rate.tributo,
      date,
      `alíquota de ${rate.tributo} desconhecida em ${date}${rate.note ? `: ${rate.note}` : ''}; informe-a com withOverrides para simular`,
      { detalhes: { tributo: rate.tributo, date, legal: rate.legal } },
    );
  }
  return rate.value;
}

/** Alguma das alíquotas não é oficial: o cálculo feito com elas é simulação. */
export function isSimulated(rates: NominalRates): boolean {
  return RATE_TRIBUTOS.some((t) => rates[t].status !== 'official');
}
