import { describe, expect, test } from 'bun:test';
import { ehTagDeRelease, lerLsRemote, planejarPush } from './tags.ts';

const mapa = (pares: Record<string, string>): Map<string, string> => new Map(Object.entries(pares));

describe('planejarPush', () => {
  const locais = mapa({
    '@sinete/core@0.3.0': 'a1',
    '@sinete/nfe@0.5.0': 'a2',
    '@sinete/mdfe@0.4.0': 'a3',
    '@sinete/nfse@0.4.0': 'a4',
    'sinete@0.5.0': 'a5',
    'v1-experimento': 'a6',
  });

  test('pacotes juntos e o guarda-chuva sozinho, só tags de release', () => {
    expect(planejarPush(locais, new Map())).toEqual({
      juntas: ['@sinete/core@0.3.0', '@sinete/mdfe@0.4.0', '@sinete/nfe@0.5.0', '@sinete/nfse@0.4.0'],
      sozinha: 'sinete@0.5.0',
    });
  });

  test('retomada depois de um push parcial: só o que falta', () => {
    const remotas = mapa({ '@sinete/core@0.3.0': 'a1', '@sinete/nfe@0.5.0': 'a2', '@sinete/mdfe@0.4.0': 'a3' });
    expect(planejarPush(locais, remotas)).toEqual({ juntas: ['@sinete/nfse@0.4.0'], sozinha: 'sinete@0.5.0' });
    const todasMenosGuardaChuva = mapa({ ...Object.fromEntries(locais), 'sinete@0.5.0': 'x' });
    todasMenosGuardaChuva.delete('sinete@0.5.0');
    expect(planejarPush(locais, todasMenosGuardaChuva)).toEqual({ juntas: [], sozinha: 'sinete@0.5.0' });
  });

  test('nada a empurrar', () => {
    expect(planejarPush(locais, locais)).toEqual({ juntas: [], sozinha: undefined });
  });

  test('sem o guarda-chuva pendente, a última tag vai sozinha', () => {
    const semGuardaChuva = mapa({ '@sinete/core@0.3.1': 'b1', '@sinete/da@0.3.1': 'b2' });
    expect(planejarPush(semGuardaChuva, new Map())).toEqual({
      juntas: ['@sinete/core@0.3.1'],
      sozinha: '@sinete/da@0.3.1',
    });
  });

  test('tag do remoto com outro objeto é erro, nunca force-push', () => {
    expect(() => planejarPush(locais, mapa({ 'sinete@0.5.0': 'zz' }))).toThrow(
      'sinete@0.5.0: o remoto tem outro objeto',
    );
  });
});

test('ehTagDeRelease', () => {
  expect(ehTagDeRelease('@sinete/ibs-cbs-dados@2026.10.0')).toBe(true);
  expect(ehTagDeRelease('sinete@1.0.0-next.1')).toBe(true);
  expect(ehTagDeRelease('outro@1.0.0')).toBe(false);
  expect(ehTagDeRelease('sinete@latest')).toBe(false);
});

test('lerLsRemote: objeto da tag, sem as linhas ^{}', () => {
  const saida = 'a5\trefs/tags/sinete@0.5.0\nc5\trefs/tags/sinete@0.5.0^{}\nd1\trefs/heads/main\n';
  expect(lerLsRemote(saida)).toEqual(new Map([['sinete@0.5.0', 'a5']]));
});
