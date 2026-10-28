import { describe, expect, test } from 'bun:test';
import { lerMotivoDaSefaz } from '../src/index.ts';

describe('lerMotivoDaSefaz', () => {
  test('cStat e xMotivo em qualquer prefixo e namespace', () => {
    expect(
      lerMotivoDaSefaz(
        '<a:ret xmlns:a="urn:x"><a:cStat>656</a:cStat><a:xMotivo> Rejeicao:  Consumo Indevido </a:xMotivo></a:ret>',
      ),
    ).toEqual({
      cStat: '656',
      xMotivo: 'Rejeicao: Consumo Indevido',
    });
  });

  test('vale para corpo que não é XML bem formado', () => {
    expect(lerMotivoDaSefaz('<html><body><cStat>999</cStat><xMotivo>Erro nao catalogado</xMotivo>')).toEqual({
      cStat: '999',
      xMotivo: 'Erro nao catalogado',
    });
  });

  test('sem cStat, ou com cStat vazio, não há motivo', () => {
    expect(lerMotivoDaSefaz('<html><body>Service Unavailable</body></html>')).toBeUndefined();
    expect(lerMotivoDaSefaz('<ret><cStat></cStat><xMotivo>x</xMotivo></ret>')).toBeUndefined();
  });

  test('cStat sem xMotivo', () => {
    expect(lerMotivoDaSefaz('<ret><cStat>108</cStat></ret>')).toEqual({ cStat: '108' });
  });
});
