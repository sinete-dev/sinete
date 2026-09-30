import { describe, expect, test } from 'bun:test';
import {
  ErroDeConfiguracao,
  ErroDeTempoEsgotado,
  ErroDeValidacao,
  ErroNaoSuportado,
  ErroRespostaInvalida,
  ErroSefaz,
  ErroSinete,
  ehErroSinete,
} from '../src/index.ts';

describe('ErroSinete', () => {
  test('carrega code, mensagem, detalhes e cause', () => {
    const cause = new TypeError('socket fechado');
    const e = new ErroSinete('algo_falhou', 'falhou', { cause, detalhes: { host: 'x' } });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ErroSinete');
    expect(e.code).toBe('algo_falhou');
    expect(e.message).toBe('falhou');
    expect(e.cause).toBe(cause);
    expect(e.detalhes).toEqual({ host: 'x' });
    expect(e.stack).toContain('falhou');
    expect(e.pagina).toBe('erros/algo_falhou.md');
    expect(Object.keys(e)).toContain('pagina');
  });

  test('sem cause não define a propriedade', () => {
    const e = new ErroSinete('x', 'y');
    expect('cause' in e).toBe(false);
    expect(e.detalhes).toBeUndefined();
  });

  test('cause explicitamente undefined é preservada como propriedade', () => {
    const e = new ErroSinete('x', 'y', { cause: undefined });
    expect('cause' in e).toBe(true);
  });

  test('toJSON serializa cause de ErroSinete, Error e valor qualquer', () => {
    const inner = new ErroDeConfiguracao('opção ausente', { detalhes: { opcao: 'uf' } });
    expect(new ErroSinete('a', 'b', { cause: inner }).toJSON()).toEqual({
      name: 'ErroSinete',
      code: 'a',
      message: 'b',
      pagina: 'erros/a.md',
      cause: {
        name: 'ErroDeConfiguracao',
        code: 'config_invalida',
        message: 'opção ausente',
        pagina: 'erros/config_invalida.md',
        detalhes: { opcao: 'uf' },
      },
    });
    expect(new ErroSinete('a', 'b', { cause: new RangeError('r') }).toJSON().cause).toEqual({
      name: 'RangeError',
      message: 'r',
    });
    expect(new ErroSinete('a', 'b', { cause: 42 }).toJSON().cause).toBe('42');
    expect(JSON.parse(JSON.stringify(new ErroSinete('a', 'b')))).toEqual({
      name: 'ErroSinete',
      code: 'a',
      message: 'b',
      pagina: 'erros/a.md',
    });
  });
});

describe('subclasses com código estável', () => {
  const cases: [ErroSinete, string, string][] = [
    [new ErroDeConfiguracao('m'), 'ErroDeConfiguracao', 'config_invalida'],
    [new ErroDeValidacao('m', []), 'ErroDeValidacao', 'validacao_falhou'],
    [new ErroNaoSuportado('m'), 'ErroNaoSuportado', 'nao_suportado'],
    [new ErroDeTempoEsgotado('m', 1000), 'ErroDeTempoEsgotado', 'tempo_esgotado'],
    [new ErroRespostaInvalida('m'), 'ErroRespostaInvalida', 'resposta_invalida'],
    [new ErroSefaz('sefaz_rejeitou', '539', 'Duplicidade'), 'ErroSefaz', 'sefaz_rejeitou'],
  ];
  for (const [e, name, code] of cases) {
    test(`${name} -> ${code}`, () => {
      expect(e).toBeInstanceOf(ErroSinete);
      expect(e.name).toBe(name);
      expect(e.code).toBe(code);
      expect(ehErroSinete(e, code)).toBe(true);
    });
  }

  test('ErroDeValidacao guarda todas as ocorrências e as serializa', () => {
    const ocorrencias = [
      { caminho: 'emit.CNPJ', code: 'cnpj_invalido', mensagem: 'dígito verificador' },
      { caminho: 'dest.IE', code: 'ie_invalida', mensagem: 'formato' },
    ];
    const e = new ErroDeValidacao('2 ocorrências', ocorrencias, { detalhes: { doc: 'nfe' } });
    expect(e.ocorrencias).toEqual(ocorrencias);
    expect(e.toJSON().detalhes).toEqual({ doc: 'nfe', ocorrencias });
  });

  test('ErroDeTempoEsgotado guarda o prazo', () => {
    expect(new ErroDeTempoEsgotado('m', 30_000).timeoutMs).toBe(30_000);
  });

  test('ErroSefaz monta a mensagem com cStat oficial e serializa cStat e xMotivo', () => {
    const e = new ErroSefaz('sefaz_denegou', '302', 'Uso Denegado');
    expect(e.message).toBe('SEFAZ 302: Uso Denegado');
    expect(e.cStat).toBe('302');
    expect(e.toJSON().detalhes).toEqual({ cStat: '302', xMotivo: 'Uso Denegado' });
  });
});

describe('ehErroSinete', () => {
  test('recusa o que não é erro do sinete', () => {
    expect(ehErroSinete(new Error('x'))).toBe(false);
    expect(ehErroSinete(null)).toBe(false);
    expect(ehErroSinete('config_invalida')).toBe(false);
    expect(ehErroSinete({ code: 'config_invalida' })).toBe(false);
  });

  test('reconhece erro de outra cópia do pacote pela marca global', () => {
    const foreign = { [Symbol.for('sinete.error')]: true, code: 'nao_suportado', message: 'x' };
    expect(ehErroSinete(foreign)).toBe(true);
    expect(ehErroSinete(foreign, 'nao_suportado')).toBe(true);
    expect(ehErroSinete(foreign, 'config_invalida')).toBe(false);
  });
});
