import { describe, expect, test } from 'bun:test';
import { carregarDataset } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO } from '@sinete/ibs-cbs-dados/embarcado';
import {
  avaliar,
  conferirExpressao,
  dec,
  ErroExpressao,
  ESCALA_INTERNA,
  VARIAVEIS_DAS_EXPRESSOES,
} from '../../src/calcular/index.ts';

describe('avaliador de expressões', () => {
  test('variável sozinha devolve o valor sem arredondar', () => {
    const v = dec('0.123456789012');
    expect(avaliar('aliquota', { aliquota: v })).toBe(v);
    expect(avaliar(' tributoCalculado ', { tributoCalculado: v })).toBe(v);
    expect(avaliar('baseCalculo', {}).toString()).toBe('0');
  });

  test('o resto sai com 8 casas HALF_EVEN', () => {
    expect(ESCALA_INTERNA).toBe(8);
    expect(avaliar('0', {}).toString()).toBe('0.00000000');
    expect(avaliar('1.00', {}).toString()).toBe('1.00000000');
    expect(avaliar('2.08/100', {}).toString()).toBe('0.02080000');
    expect(
      avaliar('baseCalculo*aliquotaEfetiva', {
        baseCalculo: dec('0.125'),
        aliquotaEfetiva: dec('0.0000001'),
      }).toString(),
    ).toBe('0.00000001');
    // 0.000000125 -> empate na 8a casa: fica no par (0.00000012); 0.000000135 sobe (0.00000014)
    expect(
      avaliar('baseCalculo*aliquotaEfetiva', {
        baseCalculo: dec('0.125'),
        aliquotaEfetiva: dec('0.000001'),
      }).toString(),
    ).toBe('0.00000012');
    expect(
      avaliar('baseCalculo*aliquotaEfetiva', {
        baseCalculo: dec('0.135'),
        aliquotaEfetiva: dec('0.000001'),
      }).toString(),
    ).toBe('0.00000014');
  });

  test('precedência, parênteses e menos unário', () => {
    const vars = { aliquota: dec('0.009'), percentualReducao: dec('0.6'), pRedutorCompraGov: dec('0') };
    expect(avaliar('aliquota*(1-percentualReducao)*(1-pRedutorCompraGov/100)', vars).toString()).toBe('0.00360000');
    expect(avaliar('1+2*3', {}).toString()).toBe('7.00000000');
    expect(avaliar('(1+2)*3', {}).toString()).toBe('9.00000000');
    expect(avaliar('-aliquota+1', vars).toString()).toBe('0.99100000');
    expect(avaliar('+aliquota', vars).toString()).toBe('0.00900000');
    expect(avaliar('10-2-3', {}).toString()).toBe('5.00000000');
    expect(avaliar('100/8/5', {}).toString()).toBe('2.50000000');
    expect(
      avaliar('(baseCalculoInformada-impostoSeletivoInformado+impostoSeletivoCalculado)*(1-100/100)', {
        baseCalculoInformada: dec('10'),
      }).toString(),
    ).toBe('0.00000000');
  });

  test('identificador desconhecido e sintaxe inválida são erro, nunca zero', () => {
    expect(() => avaliar('aliquota*desconto', { aliquota: dec('1') })).toThrow(ErroExpressao);
    expect(() => avaliar('aliquota*', {})).toThrow(ErroExpressao);
    expect(() => avaliar('(aliquota', {})).toThrow(ErroExpressao);
    expect(() => avaliar('aliquota)', {})).toThrow(ErroExpressao);
    expect(() => avaliar('aliquota % 2', {})).toThrow(ErroExpressao);
    expect(() => avaliar('*2', {})).toThrow(ErroExpressao);
    expect(() => avaliar('1/0', {})).toThrow(ErroExpressao);
    try {
      avaliar('x+1', {});
    } catch (e) {
      expect((e as ErroExpressao).code).toBe('ibscbs_expressao_invalida');
      expect((e as ErroExpressao).expressao).toBe('x+1');
    }
  });

  test('conferirExpressao lista as variáveis e valida', () => {
    expect(conferirExpressao('baseCalculo*aliquotaEfetiva')).toEqual(['baseCalculo', 'aliquotaEfetiva']);
    expect(conferirExpressao('0')).toEqual([]);
    expect(() => conferirExpressao('foo*2')).toThrow(ErroExpressao);
    expect(VARIAVEIS_DAS_EXPRESSOES).toContain('pRedutorCompraGov');
  });

  test('todas as expressões do dataset embarcado estão na gramática', () => {
    const ds = carregarDataset(DATASET_EMBARCADO);
    let count = 0;
    for (const t of ds.tabelas.tratamentos) {
      for (const e of Object.values(t.expressao)) {
        if (e === null) continue;
        conferirExpressao(e);
        count++;
      }
    }
    expect(count).toBeGreaterThan(100);
  });
});
