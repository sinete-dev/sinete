import { describe, expect, test } from 'bun:test';
import type { ResultadoSefaz } from '../src/index.ts';
import {
  autorizado,
  criarAutorizado,
  criarDenegado,
  criarPendente,
  criarRecusado,
  denegado,
  ErroSefaz,
  ehCStat,
  ehErroSinete,
  exigirAutorizado,
  falha,
  ok,
  pendente,
  recusado,
  tratarResultado,
} from '../src/index.ts';

type Prot = { nProt: string };
const AUT = criarAutorizado<Prot>({ cStat: '100', xMotivo: 'Autorizado o uso da NF-e' }, { nProt: '135260000000001' });
const REJ = criarRecusado(
  { cStat: '539', xMotivo: 'Rejeição: Duplicidade de NF-e' },
  { causaProvavel: 'nota já enviada', comoCorrigir: 'consulte pela chave', fonte: 'MOC 7.0' },
);
const DEN = criarDenegado<Prot>({ cStat: '302', xMotivo: 'Uso Denegado' }, { nProt: '135260000000002' });
const PEN = criarPendente(
  { cStat: '105', xMotivo: 'Lote em processamento' },
  { referencia: '351000000000001', aguardarMs: 1000 },
);
const ALL: ResultadoSefaz<Prot>[] = [AUT, REJ, DEN, PEN];

describe('construtores', () => {
  test('montam o discriminante e copiam cStat e xMotivo', () => {
    expect(AUT).toEqual({
      tipo: 'autorizado',
      cStat: '100',
      xMotivo: 'Autorizado o uso da NF-e',
      valor: { nProt: '135260000000001' },
    });
    expect(REJ.tipo).toBe('recusado');
    expect(REJ.dica?.fonte).toBe('MOC 7.0');
    expect(DEN).toMatchObject({ tipo: 'denegado', cStat: '302' });
    expect(PEN).toEqual({
      tipo: 'pendente',
      cStat: '105',
      xMotivo: 'Lote em processamento',
      referencia: '351000000000001',
      aguardarMs: 1000,
    });
  });

  test('campos opcionais ausentes não viram undefined explícito', () => {
    const r = criarRecusado({ cStat: '215', xMotivo: 'Falha no schema XML' });
    expect('hint' in r).toBe(false);
    const p = criarPendente({ cStat: '105', xMotivo: 'Lote em processamento' });
    expect(Object.keys(p).sort()).toEqual(['cStat', 'status', 'xMotivo']);
  });

  test('não copiam campos extras do status de entrada', () => {
    const raw = { cStat: '100', xMotivo: 'ok', tpAmb: '2' };
    expect(Object.keys(criarAutorizado(raw, 1)).sort()).toEqual(['cStat', 'status', 'value', 'xMotivo']);
  });

  test('cStat fora do formato lexical vira ProtocolError', () => {
    for (const cStat of ['1', '10000', 'abc', '', ' 100']) {
      let caught: unknown;
      try {
        criarRecusado({ cStat, xMotivo: 'x' });
      } catch (e) {
        caught = e;
      }
      expect(ehErroSinete(caught, 'resposta_invalida')).toBe(true);
    }
    expect(() => criarAutorizado({ cStat: '10', xMotivo: '' }, null)).toThrow('cStat inválido');
    expect(() => criarDenegado({ cStat: 'x', xMotivo: '' }, null)).toThrow();
    expect(() => criarPendente({ cStat: 'x', xMotivo: '' })).toThrow();
  });

  test('isCStat', () => {
    expect(ehCStat('100')).toBe(true);
    expect(ehCStat(100)).toBe(false);
    expect(ehCStat('1001')).toBe(true);
    expect(ehCStat('10')).toBe(false);
    expect(ehCStat('10001')).toBe(false);
    expect(ehCStat('E0312')).toBe(true);
    expect(ehCStat('E312')).toBe(false);
    expect(ehCStat('A0312')).toBe(false);
  });

  test('rejeição com cStat de 4 dígitos (faixa da reforma tributária) vira desfecho, não erro', () => {
    const r = criarRecusado({ cStat: '1001', xMotivo: 'Rejeição de teste' });
    expect(r.tipo).toBe('recusado');
  });
});

describe('guardas e match', () => {
  test('cada guarda aceita só o próprio desfecho', () => {
    expect(ALL.map(autorizado)).toEqual([true, false, false, false]);
    expect(ALL.map(recusado)).toEqual([false, true, false, false]);
    expect(ALL.map(denegado)).toEqual([false, false, true, false]);
    expect(ALL.map(pendente)).toEqual([false, false, false, true]);
  });

  test('matchOutcome chama o tratador certo', () => {
    const labels = ALL.map((o) =>
      tratarResultado(o, {
        autorizado: (a) => `ok ${a.valor.nProt}`,
        recusado: (r) => `rej ${r.cStat}`,
        denegado: (d) => `den ${d.valor.nProt}`,
        pendente: (p) => `pen ${p.referencia}`,
      }),
    );
    expect(labels).toEqual(['ok 135260000000001', 'rej 539', 'den 135260000000002', 'pen 351000000000001']);
  });
});

describe('unwrapAuthorized', () => {
  test('devolve o valor autorizado', () => {
    expect(exigirAutorizado(AUT)).toEqual({ nProt: '135260000000001' });
  });

  test('lança SefazError com o código de cada desfecho', () => {
    const codes = [REJ, DEN, PEN].map((o) => {
      try {
        exigirAutorizado(o);
        return 'não lançou';
      } catch (e) {
        expect(e).toBeInstanceOf(ErroSefaz);
        const s = e as ErroSefaz;
        expect(s.cStat).toBe(o.cStat);
        expect(s.xMotivo).toBe(o.xMotivo);
        expect(s.detalhes).toEqual({ status: o.tipo });
        return s.code;
      }
    });
    expect(codes).toEqual(['sefaz_rejeitou', 'sefaz_denegou', 'sefaz_pendente']);
  });
});

describe('Result genérico', () => {
  test('ok e err', () => {
    expect(ok(1)).toEqual({ ok: true, valor: 1 });
    const e = new Error('x');
    expect(falha(e)).toEqual({ ok: false, erro: e });
  });
});
