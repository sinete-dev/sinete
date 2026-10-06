import { describe, expect, test } from 'bun:test';
import { relogioFixo } from '@sinete/core';
import {
  CNPJ_ALFANUMERICO_VIGENCIA,
  CODIGOS_OCORRENCIA,
  caepfValido,
  calcularDvCaepf,
  calcularDvChaveAcesso,
  calcularDvCnpj,
  calcularDvCpf,
  chaveAcessoValida,
  cnpjAlfanumerico,
  cnpjValido,
  cpfValido,
  formatarCaepf,
  formatarChaveAcesso,
  formatarCnpj,
  formatarCpf,
  lerCaepf,
  lerChaveAcesso,
  lerCnpj,
  lerCpf,
  montarChaveAcesso,
} from '../src/index.ts';
import { expectValidationError } from './helpers.ts';

const codeOf = (r: { ok: true } | { ok: false; erro: { code: string } }): string | undefined =>
  r.ok ? undefined : r.erro.code;

/** Implementação independente do módulo 11 "resto com pesos crescentes", equivalente ao complemento. */
function mod11Remainder(text: string): number {
  let sum = 0;
  let w = 9;
  for (let i = text.length - 1; i >= 0; i--) {
    sum += (text.charCodeAt(i) - 48) * w;
    w = w === 2 ? 9 : w - 1;
  }
  const r = sum % 11;
  return r === 10 ? 0 : r;
}

describe('CPF', () => {
  test('válidos, máscara e DV', () => {
    expect(calcularDvCpf('123456789')).toBe('09');
    expect(cpfValido('123.456.789-09')).toBe(true);
    expect(lerCpf(' 12345678909 ')).toEqual({ ok: true, valor: '12345678909' });
    expect(formatarCpf('12345678909')).toBe('123.456.789-09');
  });

  test('ocorrências', () => {
    expect(codeOf(lerCpf('123.456.789-00'))).toBe('cpf_dv_invalido');
    expect(codeOf(lerCpf('111.111.111-11'))).toBe('cpf_digitos_repetidos');
    expect(codeOf(lerCpf('1234567890'))).toBe('cpf_tamanho_invalido');
    expect(codeOf(lerCpf('1234567890a'))).toBe('cpf_caractere_invalido');
    const r = lerCpf('x', { caminho: 'dest.CPF' });
    expect(!r.ok && r.erro.caminho).toBe('dest.CPF');
    expectValidationError(() => calcularDvCpf('1'), 'cpf_base_invalida');
  });
});

describe('CNPJ', () => {
  test('numérico e alfanumérico (NT Conjunta 2025.001)', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    // exemplo de CNPJ alfanumérico divulgado pela RFB
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
    expect(cnpjValido('12abc34501de35')).toBe(true);
    // CNPJ alfanumérico de teste da SVRS para homologação
    expect(cnpjValido('PC3D315K000193')).toBe(true);
    expect(calcularDvCnpj('PC3D315K0001')).toBe('93');
    expect(cnpjAlfanumerico('PC.3D3.15K/0001-93')).toBe(true);
    expect(cnpjAlfanumerico('11222333000181')).toBe(false);
    expect(formatarCnpj('pc3d315k000193')).toBe('PC.3D3.15K/0001-93');
  });

  test('valor de cada letra é o código ASCII menos 48 (A=17)', () => {
    // Trocar um algarismo de valor 17 não existe; confere o peso via duas bases que só diferem por A e 1.
    const a = Number(calcularDvCnpj('A00000000001')[0]);
    const expected = (() => {
      const r = (17 * 5 + 1 * 2) % 11;
      return r < 2 ? 0 : 11 - r;
    })();
    expect(a).toBe(expected);
  });

  test('ocorrências', () => {
    expect(codeOf(lerCnpj('11222333000180'))).toBe('cnpj_dv_invalido');
    expect(codeOf(lerCnpj('12ABC34501DE3A'))).toBe('cnpj_formato_invalido');
    expect(codeOf(lerCnpj('AAAAAAAAAAAAAA'))).toBe('cnpj_formato_invalido');
    expect(codeOf(lerCnpj('00000000000000'))).toBe('cnpj_digitos_repetidos');
    expect(codeOf(lerCnpj('1122233300018'))).toBe('cnpj_tamanho_invalido');
    expect(codeOf(lerCnpj('11!222333000181'))).toBe('cnpj_caractere_invalido');
    expectValidationError(() => calcularDvCnpj('abc'), 'cnpj_base_invalida');
  });

  test('propriedade: bate com a implementação independente e detecta troca de um caractere', () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let seed = 42;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let i = 0; i < 500; i++) {
      let base = '';
      for (let j = 0; j < 12; j++) base += chars[next() % chars.length];
      const d1 = mod11Remainder(base);
      const d2 = mod11Remainder(base + d1);
      const cnpj = base + calcularDvCnpj(base);
      expect(cnpj.slice(12)).toBe(`${d1}${d2}`);
      if (/^(.)\1+$/.test(cnpj)) continue;
      expect(cnpjValido(cnpj)).toBe(true);
      const pos = next() % 14;
      const pool = pos >= 12 ? '0123456789' : chars;
      let c = pool[next() % pool.length] ?? '0';
      if (c === cnpj[pos]) c = pool[(pool.indexOf(c) + 1) % pool.length] ?? '0';
      const mutated = cnpj.slice(0, pos) + c + cnpj.slice(pos + 1);
      // Módulo 11 com dois DV não detecta toda troca de letra (valores até 42), mas detecta toda troca de algarismo.
      if (/\d/.test(c) && /\d/.test(cnpj[pos] ?? '')) expect(cnpjValido(mutated), mutated).toBe(false);
    }
  });
});

describe('CAEPF', () => {
  test('controle = DV do CNPJ + 12, módulo 100', () => {
    for (const base of ['123456789001', '987654321002', '000000001001', '555444333999']) {
      const dv = calcularDvCnpj(base);
      expect(calcularDvCaepf(base)).toBe(String((Number(dv) + 12) % 100).padStart(2, '0'));
      expect(caepfValido(base + calcularDvCaepf(base))).toBe(true);
    }
    const v = `123456789001${calcularDvCaepf('123456789001')}`;
    expect(formatarCaepf(v)).toBe(`123.456.789/001-${v.slice(12)}`);
    expectValidationError(() => calcularDvCaepf('1'), 'caepf_base_invalida');
  });

  test('ocorrências', () => {
    const v = `123456789001${calcularDvCaepf('123456789001')}`;
    const bad = v.slice(0, 13) + String((Number(v[13]) + 1) % 10);
    expect(codeOf(lerCaepf(bad))).toBe('caepf_dv_invalido');
    expect(codeOf(lerCaepf('11111111111111'))).toBe('caepf_digitos_repetidos');
    expect(codeOf(lerCaepf('123'))).toBe('caepf_tamanho_invalido');
    expect(codeOf(lerCaepf('12345678900A12'))).toBe('caepf_caractere_invalido');
    // CNPJ válido não é CAEPF válido (os 12 de diferença)
    expect(caepfValido('11222333000181')).toBe(false);
  });
});

describe('chave de acesso', () => {
  // Exemplo do MOC 7.0 Visão Geral, item 2.2.6.2 (DV = 5)
  const MOC = '52060433009911002506550120000007800267301615';

  test('exemplo do MOC e decomposição', () => {
    expect(calcularDvChaveAcesso(MOC.slice(0, 43))).toBe('5');
    // chave de 2006 no leiaute 1.10: só com a escolha explícita do leiaute
    expect(codeOf(lerChaveAcesso(MOC))).toBe('chave_tpemis_invalido');
    const r = lerChaveAcesso(formatarChaveAcesso(MOC), { leiaute: '1.10' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor).toMatchObject({
      cUF: '52',
      uf: 'GO',
      aamm: '0604',
      ano: 2006,
      mes: 4,
      cnpj: '33009911002506',
      mod: '55',
      serie: '012',
      nNF: '000000780',
      // chave de 2006, leiaute 1.10: sem tpEmis e com cNF de 9 posições (MOC Visão Geral, Tabela 2-2)
      leiaute: '1.10',
      cNF: '026730161',
      documento: 'NF-e',
      cDV: '5',
    });
    expect(r.valor.cpf).toBeUndefined();
    expect(r.valor.tpEmis).toBeUndefined();
    expect(formatarChaveAcesso(MOC)).toBe('5206 0433 0099 1100 2506 5501 2000 0007 8002 6730 1615');
  });

  test('emitente ambíguo (000 + CPF que também é CNPJ válido): a série decide', () => {
    // CPF sintético achado por busca, para não fixar no repositório um número que pode ser de alguém.
    const dv = (s: string, pesos: number[]): number => {
      const r = [...s].reduce((t, c, i) => t + Number(c) * (pesos[i] ?? 0), 0) % 11;
      return r < 2 ? 0 : 11 - r;
    };
    let cpf = '';
    for (let b = 1; !cpf; b++) {
      const base = String(b * 7919).padStart(9, '0');
      const d1 = dv(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
      const c = `${base}${d1}${dv(`${base}${d1}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])}`;
      if (cpfValido(c) && cnpjValido(`000${c}`)) cpf = c;
    }
    const chave = (serie: number): string =>
      montarChaveAcesso({
        cUF: '41',
        aamm: '2609',
        emitente: `000${cpf}`,
        mod: '55',
        serie,
        nNF: 81,
        tpEmis: 1,
        cNF: 26306376,
      });
    const pf = lerChaveAcesso(chave(920));
    expect(pf.ok && pf.valor.cpf).toBe(cpf);
    expect(pf.ok && pf.valor.cnpj).toBeUndefined();
    const pj = lerChaveAcesso(chave(1));
    expect(pj.ok && pj.valor.cnpj).toBe(`000${cpf}`);
    expect(pj.ok && pj.valor.cpf).toBeUndefined();
  });

  test('CNPJ alfanumérico só a partir da vigência', () => {
    const ch = montarChaveAcesso({
      cUF: '43',
      aamm: '2607',
      emitente: 'PC3D315K000193',
      mod: '55',
      serie: 1,
      nNF: 123,
      tpEmis: 1,
      cNF: 12345678,
    });
    expect(ch).toHaveLength(44);
    const r = lerChaveAcesso(ch);
    expect(r.ok && r.valor.cnpj).toBe('PC3D315K000193');
    const antes = montarChaveAcesso({
      cUF: '43',
      aamm: '2606',
      emitente: 'PC3D315K000193',
      mod: '55',
      serie: 1,
      nNF: 123,
      tpEmis: 1,
      cNF: 12345678,
    });
    expect(codeOf(lerChaveAcesso(antes))).toBe('chave_cnpj_alfanumerico_fora_da_vigencia');
    expect(chaveAcessoValida(antes, { conferirEmitente: false })).toBe(true);
    expect(CNPJ_ALFANUMERICO_VIGENCIA.aamm).toBe('2607');
  });

  test('emitente pessoa física (CPF com zeros à esquerda)', () => {
    const ch = montarChaveAcesso({
      cUF: '51',
      aamm: '2609',
      emitente: '12345678909',
      mod: '55',
      serie: 920,
      nNF: 1,
      tpEmis: 1,
      cNF: 1,
    });
    const r = lerChaveAcesso(ch);
    expect(r.ok && r.valor.cpf).toBe('12345678909');
    expect(r.ok && r.valor.uf).toBe('MT');
  });

  test('ocorrências', () => {
    const bump = (s: string, i: number): string => s.slice(0, i) + String((Number(s[i]) + 1) % 10) + s.slice(i + 1);
    expect(codeOf(lerChaveAcesso(bump(MOC, 43)))).toBe('chave_dv_invalido');
    expect(codeOf(lerChaveAcesso(MOC.slice(1)))).toBe('chave_tamanho_invalido');
    expect(codeOf(lerChaveAcesso(`${MOC.slice(0, 43)}!`))).toBe('chave_caractere_invalido');
    expect(codeOf(lerChaveAcesso(`A${MOC.slice(1)}`))).toBe('chave_formato_invalido');
    const withUf = (uf: string): string => {
      const base = uf + MOC.slice(2, 43);
      return base + calcularDvChaveAcesso(base);
    };
    expect(codeOf(lerChaveAcesso(withUf('99')))).toBe('chave_uf_invalida');
    const mes13 = `${MOC.slice(0, 4)}13${MOC.slice(6, 43)}`;
    expect(codeOf(lerChaveAcesso(mes13 + calcularDvChaveAcesso(mes13)))).toBe('chave_mes_invalido');
    const emit = `${MOC.slice(0, 6)}11111111111111${MOC.slice(20, 43)}`;
    expect(codeOf(lerChaveAcesso(emit + calcularDvChaveAcesso(emit), { leiaute: '1.10' }))).toBe(
      'chave_emitente_invalido',
    );
    expectValidationError(() => calcularDvChaveAcesso('1'), 'chave_base_invalida');
    expectValidationError(
      () =>
        montarChaveAcesso({ cUF: '35', aamm: '2609', emitente: '!', mod: '55', serie: 1, nNF: 1, tpEmis: 1, cNF: 1 }),
      'chave_base_invalida',
    );
    // Todo algarismo trocado muda o DV (pesos 2 a 9 são primos com 11).
    expect(chaveAcessoValida(MOC, { conferirEmitente: false, leiaute: '1.10' })).toBe(true);
    for (let i = 0; i < 43; i++) {
      expect(chaveAcessoValida(bump(MOC, i), { conferirEmitente: false, leiaute: '1.10' })).toBe(false);
    }
  });
});

test('todo código de ocorrência é snake_case sem acento e único', () => {
  expect(new Set(CODIGOS_OCORRENCIA).size).toBe(CODIGOS_OCORRENCIA.length);
  for (const c of CODIGOS_OCORRENCIA) expect(c).toMatch(/^[a-z]+(_[a-z0-9]+)+$/);
});

describe('entradas só com zeros ou um só caractere repetido (regressão)', () => {
  test('CPF, CNPJ e CAEPF recusam qualquer caractere repetido em todo o tamanho', () => {
    for (const d of '0123456789') {
      expect(codeOf(lerCpf(d.repeat(11)))).toBe('cpf_digitos_repetidos');
      expect(codeOf(lerCnpj(d.repeat(14)))).toBe('cnpj_digitos_repetidos');
      expect(codeOf(lerCaepf(d.repeat(14)))).toBe('caepf_digitos_repetidos');
    }
    for (const n of [0, 1, 10, 12, 13, 15]) {
      expect(cpfValido('0'.repeat(n))).toBe(false);
      expect(cnpjValido('0'.repeat(n))).toBe(false);
      expect(caepfValido('0'.repeat(n))).toBe(false);
    }
    // base zerada com DV calculado: o DV fecha, mas o documento continua inválido
    expect(cpfValido(`000000000${calcularDvCpf('000000000')}`)).toBe(false);
    expect(cnpjValido(`000000000000${calcularDvCnpj('000000000000')}`)).toBe(false);
  });

  test('chave de acesso zerada ou com emitente zerado é recusada', () => {
    const zeros = '0'.repeat(44);
    expect(calcularDvChaveAcesso(zeros.slice(0, 43))).toBe('0');
    expect(chaveAcessoValida(zeros)).toBe(false);
    expect(chaveAcessoValida(zeros, { conferirEmitente: false })).toBe(false);
    for (const d of '123456789') expect(chaveAcessoValida(d.repeat(44))).toBe(false);
    const emitZero = `352609${'0'.repeat(14)}550010000000011000000011`.slice(0, 43);
    expect(codeOf(lerChaveAcesso(emitZero + calcularDvChaveAcesso(emitZero)))).toBe('chave_emitente_invalido');
  });
});

describe('chave de acesso: domínio de cada componente', () => {
  type Parts = Parameters<typeof montarChaveAcesso>[0];
  const base: Parts = {
    cUF: '51',
    aamm: '2609',
    emitente: '11222333000181',
    mod: '55',
    serie: 1,
    nNF: 123,
    tpEmis: 1,
    cNF: 48151623,
  };
  const make = (p: Partial<Parts>): string => montarChaveAcesso({ ...base, ...p });
  /** Troca posições de uma chave válida e recalcula o DV. */
  const patch = (at: number, text: string): string => {
    const b = make({}).slice(0, 43);
    const nb = b.slice(0, at) + text + b.slice(at + text.length);
    return nb + calcularDvChaveAcesso(nb);
  };

  test('chave de referência válida no modo emissão, com tpEmis e cNF de 8', () => {
    const r = lerChaveAcesso(make({}), { emissao: true });
    expect(r.ok && r.valor).toMatchObject({
      leiaute: '2.00',
      tpEmis: '1',
      cNF: '48151623',
      documento: 'NF-e',
      uf: 'MT',
    });
  });

  test('cUF fora da tabela do IBGE (BA02-14)', () => {
    for (const c of ['00', '10', '18', '20', '30', '34', '40', '44', '54', '99']) {
      expect(codeOf(lerChaveAcesso(patch(0, c))), c).toBe('chave_uf_invalida');
    }
  });

  test('AAMM: mês 01 a 12 (BA02-24) e ano a partir de 06 (BA02-20), ano corrente com relógio', () => {
    expect(codeOf(lerChaveAcesso(patch(2, '2600')))).toBe('chave_mes_invalido');
    expect(codeOf(lerChaveAcesso(patch(2, '2613')))).toBe('chave_mes_invalido');
    expect(codeOf(lerChaveAcesso(patch(2, '0512')))).toBe('chave_ano_invalido');
    expect(lerChaveAcesso(patch(2, '0601')).ok).toBe(true);
    const clock = relogioFixo('2026-09-25T12:00:00-03:00');
    expect(lerChaveAcesso(patch(2, '2612'), { relogio: clock }).ok).toBe(true);
    expect(codeOf(lerChaveAcesso(patch(2, '2701'), { relogio: clock }))).toBe('chave_ano_invalido');
  });

  test('modelo no conjunto documentado (B06, BA02-34)', () => {
    for (const m of ['55', '65', '57', '67', '58', '62', '63', '66']) {
      expect(lerChaveAcesso(patch(20, m)).ok, m).toBe(true);
    }
    for (const m of ['00', '01', '04', '56', '60', '64', '99']) {
      expect(codeOf(lerChaveAcesso(patch(20, m))), m).toBe('chave_modelo_invalido');
    }
    // CF-e SAT tem outra composição de chave: fora do escopo, com código próprio
    expect(codeOf(lerChaveAcesso(patch(20, '59')))).toBe('chave_modelo_nao_suportado');
    const r = lerChaveAcesso(patch(20, '58'));
    expect(r.ok && r.valor.documento).toBe('MDF-e');
  });

  test('nNF de 1 a 999999999, nunca zerado (TNF, BA02-40)', () => {
    expect(codeOf(lerChaveAcesso(make({ nNF: 0 })))).toBe('chave_numero_invalido');
    expect(lerChaveAcesso(make({ nNF: 1 })).ok).toBe(true);
    expect(lerChaveAcesso(make({ nNF: 999999999 })).ok).toBe(true);
  });

  test('tpEmis no domínio do B22 (1 a 7 e 9) a partir do leiaute 2.00', () => {
    for (const t of ['1', '2', '3', '4', '5', '6', '7', '9'])
      expect(lerChaveAcesso(make({ tpEmis: t })).ok, t).toBe(true);
    for (const t of ['0', '8']) expect(codeOf(lerChaveAcesso(make({ tpEmis: t }))), t).toBe('chave_tpemis_invalido');
    // sem detecção automática: dígito fora do domínio é erro mesmo em chave antiga
    expect(codeOf(lerChaveAcesso(make({ aamm: '1012', tpEmis: 0 })))).toBe('chave_tpemis_invalido');
  });

  test('leiaute 1.10 só por opção explícita, sem tpEmis e com cNF de 9', () => {
    const k = make({ aamm: '1012', tpEmis: 0, cNF: 12345678 });
    const r = lerChaveAcesso(k, { leiaute: '1.10' });
    expect(r.ok && r.valor).toMatchObject({ leiaute: '1.10', cNF: '012345678' });
    expect(r.ok && 'tpEmis' in r.valor).toBe(false);
    // com dígito que também é tpEmis válido, o padrão lê como 2.00 e o 1.10 só quando pedido
    const ambigua = make({ aamm: '1012', tpEmis: 1, cNF: 12345678 });
    const a = lerChaveAcesso(ambigua);
    const b = lerChaveAcesso(ambigua, { leiaute: '1.10' });
    expect(a.ok && a.valor.leiaute).toBe('2.00');
    expect(b.ok && b.valor.cNF).toBe('112345678');
  });

  test('emitente conforme a série nos modelos 55 e 65 (BA02-30)', () => {
    // série 0 a 909: CNPJ
    expect(codeOf(lerChaveAcesso(make({ emitente: '12345678909', serie: 1 })))).toBe('chave_emitente_invalido');
    expect(lerChaveAcesso(make({ serie: 909 })).ok).toBe(true);
    // série 910 a 969: CPF com 000 à esquerda
    expect(lerChaveAcesso(make({ emitente: '12345678909', serie: 920 })).ok).toBe(true);
    expect(codeOf(lerChaveAcesso(make({ serie: 910 })))).toBe('chave_emitente_invalido');
    expect(codeOf(lerChaveAcesso(make({ emitente: '00000000000', serie: 920 })))).toBe('chave_emitente_invalido');
    // série 970 a 999 não tem faixa: aceita CNPJ ou CPF; em outros modelos também
    expect(lerChaveAcesso(make({ serie: 980 })).ok).toBe(true);
    expect(lerChaveAcesso(make({ mod: '57', emitente: '12345678909', serie: 1 })).ok).toBe(true);
  });

  test('modo emissão: série até 969 e NFC-e de pessoa física na série 920 a 969 (B07, NT 2023.002)', () => {
    expect(codeOf(lerChaveAcesso(make({ serie: 980 }), { emissao: true }))).toBe('chave_serie_invalida');
    expect(
      lerChaveAcesso(make({ mod: '65', emitente: '12345678909', serie: 920, tpEmis: 1 }), { emissao: true }).ok,
    ).toBe(true);
    expect(
      codeOf(lerChaveAcesso(make({ mod: '65', emitente: '12345678909', serie: 915, tpEmis: 1 }), { emissao: true })),
    ).toBe('chave_serie_invalida');
  });

  test('modo emissão: tpEmis por modelo (B22-10, B22-34)', () => {
    // NT 2026.002 v1.11: a NF-e Tipo 2 (tpImp 6) admite a off-line; o tpImp não está na chave.
    expect(lerChaveAcesso(make({ tpEmis: 9 }), { emissao: true }).ok).toBe(true);
    expect(codeOf(lerChaveAcesso(make({ tpEmis: 3 }), { emissao: true }))).toBe('chave_tpemis_invalido');
    expect(lerChaveAcesso(make({ mod: '65', tpEmis: 9 }), { emissao: true }).ok).toBe(true);
    expect(codeOf(lerChaveAcesso(make({ mod: '65', tpEmis: 5 }), { emissao: true }))).toBe('chave_tpemis_invalido');
    expect(codeOf(lerChaveAcesso(make({ aamm: '1012', tpEmis: 0 }), { emissao: true }))).toBe('chave_tpemis_invalido');
  });

  test('modo emissão: cNF fora da lista proibida e diferente de nNF (B03-10)', () => {
    for (const c of ['00000000', '11111111', '12345678', '01234567', '90123456']) {
      expect(codeOf(lerChaveAcesso(make({ cNF: c }), { emissao: true })), c).toBe('chave_cnf_invalido');
      expect(lerChaveAcesso(make({ cNF: c })).ok, c).toBe(true);
    }
    expect(codeOf(lerChaveAcesso(make({ nNF: 123, cNF: 123 }), { emissao: true }))).toBe('chave_cnf_invalido');
  });
});
