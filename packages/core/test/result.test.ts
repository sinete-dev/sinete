import { describe, expect, test } from 'bun:test';
import type { SefazOutcome } from '../src/index.ts';
import {
  authorized,
  denied,
  err,
  isAuthorized,
  isCStat,
  isDenied,
  isPending,
  isRejected,
  isSineteError,
  matchOutcome,
  ok,
  pending,
  rejected,
  SefazError,
  unwrapAuthorized,
} from '../src/index.ts';

type Prot = { nProt: string };
const AUT = authorized<Prot>({ cStat: '100', xMotivo: 'Autorizado o uso da NF-e' }, { nProt: '135260000000001' });
const REJ = rejected(
  { cStat: '539', xMotivo: 'Rejeição: Duplicidade de NF-e' },
  { probableCause: 'nota já enviada', suggestedFix: 'consulte pela chave', source: 'MOC 7.0' },
);
const DEN = denied<Prot>({ cStat: '302', xMotivo: 'Uso Denegado' }, { nProt: '135260000000002' });
const PEN = pending({ cStat: '105', xMotivo: 'Lote em processamento' }, { ref: '351000000000001', retryAfterMs: 1000 });
const ALL: SefazOutcome<Prot>[] = [AUT, REJ, DEN, PEN];

describe('construtores', () => {
  test('montam o discriminante e copiam cStat e xMotivo', () => {
    expect(AUT).toEqual({
      status: 'authorized',
      cStat: '100',
      xMotivo: 'Autorizado o uso da NF-e',
      value: { nProt: '135260000000001' },
    });
    expect(REJ.status).toBe('rejected');
    expect(REJ.hint?.source).toBe('MOC 7.0');
    expect(DEN).toMatchObject({ status: 'denied', cStat: '302' });
    expect(PEN).toEqual({
      status: 'pending',
      cStat: '105',
      xMotivo: 'Lote em processamento',
      ref: '351000000000001',
      retryAfterMs: 1000,
    });
  });

  test('campos opcionais ausentes não viram undefined explícito', () => {
    const r = rejected({ cStat: '215', xMotivo: 'Falha no schema XML' });
    expect('hint' in r).toBe(false);
    const p = pending({ cStat: '105', xMotivo: 'Lote em processamento' });
    expect(Object.keys(p).sort()).toEqual(['cStat', 'status', 'xMotivo']);
  });

  test('não copiam campos extras do status de entrada', () => {
    const raw = { cStat: '100', xMotivo: 'ok', tpAmb: '2' };
    expect(Object.keys(authorized(raw, 1)).sort()).toEqual(['cStat', 'status', 'value', 'xMotivo']);
  });

  test('cStat fora do formato lexical vira ProtocolError', () => {
    for (const cStat of ['1', '10000', 'abc', '', ' 100']) {
      let caught: unknown;
      try {
        rejected({ cStat, xMotivo: 'x' });
      } catch (e) {
        caught = e;
      }
      expect(isSineteError(caught, 'resposta_invalida')).toBe(true);
    }
    expect(() => authorized({ cStat: '10', xMotivo: '' }, null)).toThrow('cStat inválido');
    expect(() => denied({ cStat: 'x', xMotivo: '' }, null)).toThrow();
    expect(() => pending({ cStat: 'x', xMotivo: '' })).toThrow();
  });

  test('isCStat', () => {
    expect(isCStat('100')).toBe(true);
    expect(isCStat(100)).toBe(false);
    expect(isCStat('1001')).toBe(true);
    expect(isCStat('10')).toBe(false);
    expect(isCStat('10001')).toBe(false);
    expect(isCStat('E0312')).toBe(true);
    expect(isCStat('E312')).toBe(false);
    expect(isCStat('A0312')).toBe(false);
  });

  test('rejeição com cStat de 4 dígitos (faixa da reforma tributária) vira desfecho, não erro', () => {
    const r = rejected({ cStat: '1001', xMotivo: 'Rejeição de teste' });
    expect(r.status).toBe('rejected');
  });
});

describe('guardas e match', () => {
  test('cada guarda aceita só o próprio desfecho', () => {
    expect(ALL.map(isAuthorized)).toEqual([true, false, false, false]);
    expect(ALL.map(isRejected)).toEqual([false, true, false, false]);
    expect(ALL.map(isDenied)).toEqual([false, false, true, false]);
    expect(ALL.map(isPending)).toEqual([false, false, false, true]);
  });

  test('matchOutcome chama o tratador certo', () => {
    const labels = ALL.map((o) =>
      matchOutcome(o, {
        authorized: (a) => `ok ${a.value.nProt}`,
        rejected: (r) => `rej ${r.cStat}`,
        denied: (d) => `den ${d.value.nProt}`,
        pending: (p) => `pen ${p.ref}`,
      }),
    );
    expect(labels).toEqual(['ok 135260000000001', 'rej 539', 'den 135260000000002', 'pen 351000000000001']);
  });
});

describe('unwrapAuthorized', () => {
  test('devolve o valor autorizado', () => {
    expect(unwrapAuthorized(AUT)).toEqual({ nProt: '135260000000001' });
  });

  test('lança SefazError com o código de cada desfecho', () => {
    const codes = [REJ, DEN, PEN].map((o) => {
      try {
        unwrapAuthorized(o);
        return 'não lançou';
      } catch (e) {
        expect(e).toBeInstanceOf(SefazError);
        const s = e as SefazError;
        expect(s.cStat).toBe(o.cStat);
        expect(s.xMotivo).toBe(o.xMotivo);
        expect(s.details).toEqual({ status: o.status });
        return s.code;
      }
    });
    expect(codes).toEqual(['sefaz_rejeitou', 'sefaz_denegou', 'sefaz_pendente']);
  });
});

describe('Result genérico', () => {
  test('ok e err', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    const e = new Error('x');
    expect(err(e)).toEqual({ ok: false, error: e });
  });
});
