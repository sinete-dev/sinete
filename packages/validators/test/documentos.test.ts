import { describe, expect, test } from 'bun:test';
import { fixedClock } from '@sinete/core';
import {
  buildChaveAcesso,
  CNPJ_ALFANUMERICO_VIGENCIA,
  caepfCheckDigits,
  chaveAcessoCheckDigit,
  cnpjCheckDigits,
  cpfCheckDigits,
  formatCaepf,
  formatChaveAcesso,
  formatCnpj,
  formatCpf,
  isAlphanumericCnpj,
  isValidCaepf,
  isValidChaveAcesso,
  isValidCnpj,
  isValidCpf,
  parseCaepf,
  parseChaveAcesso,
  parseCnpj,
  parseCpf,
  VALIDATION_ISSUE_CODES,
} from '../src/index.ts';
import { expectValidationError } from './helpers.ts';

const codeOf = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);

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
    expect(cpfCheckDigits('123456789')).toBe('09');
    expect(isValidCpf('123.456.789-09')).toBe(true);
    expect(parseCpf(' 12345678909 ')).toEqual({ ok: true, value: '12345678909' });
    expect(formatCpf('12345678909')).toBe('123.456.789-09');
  });

  test('ocorrências', () => {
    expect(codeOf(parseCpf('123.456.789-00'))).toBe('cpf_dv_invalido');
    expect(codeOf(parseCpf('111.111.111-11'))).toBe('cpf_digitos_repetidos');
    expect(codeOf(parseCpf('1234567890'))).toBe('cpf_tamanho_invalido');
    expect(codeOf(parseCpf('1234567890a'))).toBe('cpf_caractere_invalido');
    const r = parseCpf('x', { path: 'dest.CPF' });
    expect(!r.ok && r.error.path).toBe('dest.CPF');
    expectValidationError(() => cpfCheckDigits('1'), 'cpf_base_invalida');
  });
});

describe('CNPJ', () => {
  test('numérico e alfanumérico (NT Conjunta 2025.001)', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    // exemplo de CNPJ alfanumérico divulgado pela RFB
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true);
    expect(isValidCnpj('12abc34501de35')).toBe(true);
    // CNPJ alfanumérico de teste da SVRS para homologação
    expect(isValidCnpj('PC3D315K000193')).toBe(true);
    expect(cnpjCheckDigits('PC3D315K0001')).toBe('93');
    expect(isAlphanumericCnpj('PC.3D3.15K/0001-93')).toBe(true);
    expect(isAlphanumericCnpj('11222333000181')).toBe(false);
    expect(formatCnpj('pc3d315k000193')).toBe('PC.3D3.15K/0001-93');
  });

  test('valor de cada letra é o código ASCII menos 48 (A=17)', () => {
    // Trocar um algarismo de valor 17 não existe; confere o peso via duas bases que só diferem por A e 1.
    const a = Number(cnpjCheckDigits('A00000000001')[0]);
    const expected = (() => {
      const r = (17 * 5 + 1 * 2) % 11;
      return r < 2 ? 0 : 11 - r;
    })();
    expect(a).toBe(expected);
  });

  test('ocorrências', () => {
    expect(codeOf(parseCnpj('11222333000180'))).toBe('cnpj_dv_invalido');
    expect(codeOf(parseCnpj('12ABC34501DE3A'))).toBe('cnpj_formato_invalido');
    expect(codeOf(parseCnpj('AAAAAAAAAAAAAA'))).toBe('cnpj_formato_invalido');
    expect(codeOf(parseCnpj('00000000000000'))).toBe('cnpj_digitos_repetidos');
    expect(codeOf(parseCnpj('1122233300018'))).toBe('cnpj_tamanho_invalido');
    expect(codeOf(parseCnpj('11!222333000181'))).toBe('cnpj_caractere_invalido');
    expectValidationError(() => cnpjCheckDigits('abc'), 'cnpj_base_invalida');
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
      const cnpj = base + cnpjCheckDigits(base);
      expect(cnpj.slice(12)).toBe(`${d1}${d2}`);
      if (/^(.)\1+$/.test(cnpj)) continue;
      expect(isValidCnpj(cnpj)).toBe(true);
      const pos = next() % 14;
      const pool = pos >= 12 ? '0123456789' : chars;
      let c = pool[next() % pool.length] ?? '0';
      if (c === cnpj[pos]) c = pool[(pool.indexOf(c) + 1) % pool.length] ?? '0';
      const mutated = cnpj.slice(0, pos) + c + cnpj.slice(pos + 1);
      // Módulo 11 com dois DV não detecta toda troca de letra (valores até 42), mas detecta toda troca de algarismo.
      if (/\d/.test(c) && /\d/.test(cnpj[pos] ?? '')) expect(isValidCnpj(mutated), mutated).toBe(false);
    }
  });
});

describe('CAEPF', () => {
  test('controle = DV do CNPJ + 12, módulo 100', () => {
    for (const base of ['123456789001', '987654321002', '000000001001', '555444333999']) {
      const dv = cnpjCheckDigits(base);
      expect(caepfCheckDigits(base)).toBe(String((Number(dv) + 12) % 100).padStart(2, '0'));
      expect(isValidCaepf(base + caepfCheckDigits(base))).toBe(true);
    }
    const v = `123456789001${caepfCheckDigits('123456789001')}`;
    expect(formatCaepf(v)).toBe(`123.456.789/001-${v.slice(12)}`);
    expectValidationError(() => caepfCheckDigits('1'), 'caepf_base_invalida');
  });

  test('ocorrências', () => {
    const v = `123456789001${caepfCheckDigits('123456789001')}`;
    const bad = v.slice(0, 13) + String((Number(v[13]) + 1) % 10);
    expect(codeOf(parseCaepf(bad))).toBe('caepf_dv_invalido');
    expect(codeOf(parseCaepf('11111111111111'))).toBe('caepf_digitos_repetidos');
    expect(codeOf(parseCaepf('123'))).toBe('caepf_tamanho_invalido');
    expect(codeOf(parseCaepf('12345678900A12'))).toBe('caepf_caractere_invalido');
    // CNPJ válido não é CAEPF válido (os 12 de diferença)
    expect(isValidCaepf('11222333000181')).toBe(false);
  });
});

describe('chave de acesso', () => {
  // Exemplo do MOC 7.0 Visão Geral, item 2.2.6.2 (DV = 5)
  const MOC = '52060433009911002506550120000007800267301615';

  test('exemplo do MOC e decomposição', () => {
    expect(chaveAcessoCheckDigit(MOC.slice(0, 43))).toBe('5');
    // chave de 2006 no leiaute 1.10: só com a escolha explícita do leiaute
    expect(codeOf(parseChaveAcesso(MOC))).toBe('chave_tpemis_invalido');
    const r = parseChaveAcesso(formatChaveAcesso(MOC), { layout: '1.10' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
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
      layout: '1.10',
      cNF: '026730161',
      documento: 'NF-e',
      cDV: '5',
    });
    expect(r.value.cpf).toBeUndefined();
    expect(r.value.tpEmis).toBeUndefined();
    expect(formatChaveAcesso(MOC)).toBe('5206 0433 0099 1100 2506 5501 2000 0007 8002 6730 1615');
  });

  test('CNPJ alfanumérico só a partir da vigência', () => {
    const ch = buildChaveAcesso({
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
    const r = parseChaveAcesso(ch);
    expect(r.ok && r.value.cnpj).toBe('PC3D315K000193');
    const antes = buildChaveAcesso({
      cUF: '43',
      aamm: '2606',
      emitente: 'PC3D315K000193',
      mod: '55',
      serie: 1,
      nNF: 123,
      tpEmis: 1,
      cNF: 12345678,
    });
    expect(codeOf(parseChaveAcesso(antes))).toBe('chave_cnpj_alfanumerico_fora_da_vigencia');
    expect(isValidChaveAcesso(antes, { checkEmitente: false })).toBe(true);
    expect(CNPJ_ALFANUMERICO_VIGENCIA.aamm).toBe('2607');
  });

  test('emitente pessoa física (CPF com zeros à esquerda)', () => {
    const ch = buildChaveAcesso({
      cUF: '51',
      aamm: '2609',
      emitente: '12345678909',
      mod: '55',
      serie: 920,
      nNF: 1,
      tpEmis: 1,
      cNF: 1,
    });
    const r = parseChaveAcesso(ch);
    expect(r.ok && r.value.cpf).toBe('12345678909');
    expect(r.ok && r.value.uf).toBe('MT');
  });

  test('ocorrências', () => {
    const bump = (s: string, i: number): string => s.slice(0, i) + String((Number(s[i]) + 1) % 10) + s.slice(i + 1);
    expect(codeOf(parseChaveAcesso(bump(MOC, 43)))).toBe('chave_dv_invalido');
    expect(codeOf(parseChaveAcesso(MOC.slice(1)))).toBe('chave_tamanho_invalido');
    expect(codeOf(parseChaveAcesso(`${MOC.slice(0, 43)}!`))).toBe('chave_caractere_invalido');
    expect(codeOf(parseChaveAcesso(`A${MOC.slice(1)}`))).toBe('chave_formato_invalido');
    const withUf = (uf: string): string => {
      const base = uf + MOC.slice(2, 43);
      return base + chaveAcessoCheckDigit(base);
    };
    expect(codeOf(parseChaveAcesso(withUf('99')))).toBe('chave_uf_invalida');
    const mes13 = `${MOC.slice(0, 4)}13${MOC.slice(6, 43)}`;
    expect(codeOf(parseChaveAcesso(mes13 + chaveAcessoCheckDigit(mes13)))).toBe('chave_mes_invalido');
    const emit = `${MOC.slice(0, 6)}11111111111111${MOC.slice(20, 43)}`;
    expect(codeOf(parseChaveAcesso(emit + chaveAcessoCheckDigit(emit), { layout: '1.10' }))).toBe(
      'chave_emitente_invalido',
    );
    expectValidationError(() => chaveAcessoCheckDigit('1'), 'chave_base_invalida');
    expectValidationError(
      () =>
        buildChaveAcesso({ cUF: '35', aamm: '2609', emitente: '!', mod: '55', serie: 1, nNF: 1, tpEmis: 1, cNF: 1 }),
      'chave_base_invalida',
    );
    // Todo algarismo trocado muda o DV (pesos 2 a 9 são primos com 11).
    expect(isValidChaveAcesso(MOC, { checkEmitente: false, layout: '1.10' })).toBe(true);
    for (let i = 0; i < 43; i++) {
      expect(isValidChaveAcesso(bump(MOC, i), { checkEmitente: false, layout: '1.10' })).toBe(false);
    }
  });
});

test('todo código de ocorrência é snake_case sem acento e único', () => {
  expect(new Set(VALIDATION_ISSUE_CODES).size).toBe(VALIDATION_ISSUE_CODES.length);
  for (const c of VALIDATION_ISSUE_CODES) expect(c).toMatch(/^[a-z]+(_[a-z0-9]+)+$/);
});

describe('entradas só com zeros ou um só caractere repetido (regressão)', () => {
  test('CPF, CNPJ e CAEPF recusam qualquer caractere repetido em todo o tamanho', () => {
    for (const d of '0123456789') {
      expect(codeOf(parseCpf(d.repeat(11)))).toBe('cpf_digitos_repetidos');
      expect(codeOf(parseCnpj(d.repeat(14)))).toBe('cnpj_digitos_repetidos');
      expect(codeOf(parseCaepf(d.repeat(14)))).toBe('caepf_digitos_repetidos');
    }
    for (const n of [0, 1, 10, 12, 13, 15]) {
      expect(isValidCpf('0'.repeat(n))).toBe(false);
      expect(isValidCnpj('0'.repeat(n))).toBe(false);
      expect(isValidCaepf('0'.repeat(n))).toBe(false);
    }
    // base zerada com DV calculado: o DV fecha, mas o documento continua inválido
    expect(isValidCpf(`000000000${cpfCheckDigits('000000000')}`)).toBe(false);
    expect(isValidCnpj(`000000000000${cnpjCheckDigits('000000000000')}`)).toBe(false);
  });

  test('chave de acesso zerada ou com emitente zerado é recusada', () => {
    const zeros = '0'.repeat(44);
    expect(chaveAcessoCheckDigit(zeros.slice(0, 43))).toBe('0');
    expect(isValidChaveAcesso(zeros)).toBe(false);
    expect(isValidChaveAcesso(zeros, { checkEmitente: false })).toBe(false);
    for (const d of '123456789') expect(isValidChaveAcesso(d.repeat(44))).toBe(false);
    const emitZero = `352609${'0'.repeat(14)}550010000000011000000011`.slice(0, 43);
    expect(codeOf(parseChaveAcesso(emitZero + chaveAcessoCheckDigit(emitZero)))).toBe('chave_emitente_invalido');
  });
});

describe('chave de acesso: domínio de cada componente', () => {
  type Parts = Parameters<typeof buildChaveAcesso>[0];
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
  const make = (p: Partial<Parts>): string => buildChaveAcesso({ ...base, ...p });
  /** Troca posições de uma chave válida e recalcula o DV. */
  const patch = (at: number, text: string): string => {
    const b = make({}).slice(0, 43);
    const nb = b.slice(0, at) + text + b.slice(at + text.length);
    return nb + chaveAcessoCheckDigit(nb);
  };

  test('chave de referência válida no modo emissão, com tpEmis e cNF de 8', () => {
    const r = parseChaveAcesso(make({}), { emissao: true });
    expect(r.ok && r.value).toMatchObject({
      layout: '2.00',
      tpEmis: '1',
      cNF: '48151623',
      documento: 'NF-e',
      uf: 'MT',
    });
  });

  test('cUF fora da tabela do IBGE (BA02-14)', () => {
    for (const c of ['00', '10', '18', '20', '30', '34', '40', '44', '54', '99']) {
      expect(codeOf(parseChaveAcesso(patch(0, c))), c).toBe('chave_uf_invalida');
    }
  });

  test('AAMM: mês 01 a 12 (BA02-24) e ano a partir de 06 (BA02-20), ano corrente com relógio', () => {
    expect(codeOf(parseChaveAcesso(patch(2, '2600')))).toBe('chave_mes_invalido');
    expect(codeOf(parseChaveAcesso(patch(2, '2613')))).toBe('chave_mes_invalido');
    expect(codeOf(parseChaveAcesso(patch(2, '0512')))).toBe('chave_ano_invalido');
    expect(parseChaveAcesso(patch(2, '0601')).ok).toBe(true);
    const clock = fixedClock('2026-09-25T12:00:00-03:00');
    expect(parseChaveAcesso(patch(2, '2612'), { clock }).ok).toBe(true);
    expect(codeOf(parseChaveAcesso(patch(2, '2701'), { clock }))).toBe('chave_ano_invalido');
  });

  test('modelo no conjunto documentado (B06, BA02-34)', () => {
    for (const m of ['55', '65', '57', '67', '58', '62', '63', '66']) {
      expect(parseChaveAcesso(patch(20, m)).ok, m).toBe(true);
    }
    for (const m of ['00', '01', '04', '56', '60', '64', '99']) {
      expect(codeOf(parseChaveAcesso(patch(20, m))), m).toBe('chave_modelo_invalido');
    }
    // CF-e SAT tem outra composição de chave: fora do escopo, com código próprio
    expect(codeOf(parseChaveAcesso(patch(20, '59')))).toBe('chave_modelo_nao_suportado');
    const r = parseChaveAcesso(patch(20, '58'));
    expect(r.ok && r.value.documento).toBe('MDF-e');
  });

  test('nNF de 1 a 999999999, nunca zerado (TNF, BA02-40)', () => {
    expect(codeOf(parseChaveAcesso(make({ nNF: 0 })))).toBe('chave_numero_invalido');
    expect(parseChaveAcesso(make({ nNF: 1 })).ok).toBe(true);
    expect(parseChaveAcesso(make({ nNF: 999999999 })).ok).toBe(true);
  });

  test('tpEmis no domínio do B22 (1 a 7 e 9) a partir do leiaute 2.00', () => {
    for (const t of ['1', '2', '3', '4', '5', '6', '7', '9'])
      expect(parseChaveAcesso(make({ tpEmis: t })).ok, t).toBe(true);
    for (const t of ['0', '8']) expect(codeOf(parseChaveAcesso(make({ tpEmis: t }))), t).toBe('chave_tpemis_invalido');
    // sem detecção automática: dígito fora do domínio é erro mesmo em chave antiga
    expect(codeOf(parseChaveAcesso(make({ aamm: '1012', tpEmis: 0 })))).toBe('chave_tpemis_invalido');
  });

  test('leiaute 1.10 só por opção explícita, sem tpEmis e com cNF de 9', () => {
    const k = make({ aamm: '1012', tpEmis: 0, cNF: 12345678 });
    const r = parseChaveAcesso(k, { layout: '1.10' });
    expect(r.ok && r.value).toMatchObject({ layout: '1.10', cNF: '012345678' });
    expect(r.ok && 'tpEmis' in r.value).toBe(false);
    // com dígito que também é tpEmis válido, o padrão lê como 2.00 e o 1.10 só quando pedido
    const ambigua = make({ aamm: '1012', tpEmis: 1, cNF: 12345678 });
    const a = parseChaveAcesso(ambigua);
    const b = parseChaveAcesso(ambigua, { layout: '1.10' });
    expect(a.ok && a.value.layout).toBe('2.00');
    expect(b.ok && b.value.cNF).toBe('112345678');
  });

  test('emitente conforme a série nos modelos 55 e 65 (BA02-30)', () => {
    // série 0 a 909: CNPJ
    expect(codeOf(parseChaveAcesso(make({ emitente: '12345678909', serie: 1 })))).toBe('chave_emitente_invalido');
    expect(parseChaveAcesso(make({ serie: 909 })).ok).toBe(true);
    // série 910 a 969: CPF com 000 à esquerda
    expect(parseChaveAcesso(make({ emitente: '12345678909', serie: 920 })).ok).toBe(true);
    expect(codeOf(parseChaveAcesso(make({ serie: 910 })))).toBe('chave_emitente_invalido');
    expect(codeOf(parseChaveAcesso(make({ emitente: '00000000000', serie: 920 })))).toBe('chave_emitente_invalido');
    // série 970 a 999 não tem faixa: aceita CNPJ ou CPF; em outros modelos também
    expect(parseChaveAcesso(make({ serie: 980 })).ok).toBe(true);
    expect(parseChaveAcesso(make({ mod: '57', emitente: '12345678909', serie: 1 })).ok).toBe(true);
  });

  test('modo emissão: série até 969 e NFC-e de pessoa física na série 920 a 969 (B07, NT 2023.002)', () => {
    expect(codeOf(parseChaveAcesso(make({ serie: 980 }), { emissao: true }))).toBe('chave_serie_invalida');
    expect(
      parseChaveAcesso(make({ mod: '65', emitente: '12345678909', serie: 920, tpEmis: 1 }), { emissao: true }).ok,
    ).toBe(true);
    expect(
      codeOf(parseChaveAcesso(make({ mod: '65', emitente: '12345678909', serie: 915, tpEmis: 1 }), { emissao: true })),
    ).toBe('chave_serie_invalida');
  });

  test('modo emissão: tpEmis por modelo (B22-10, B22-34)', () => {
    expect(codeOf(parseChaveAcesso(make({ tpEmis: 9 }), { emissao: true }))).toBe('chave_tpemis_invalido');
    expect(codeOf(parseChaveAcesso(make({ tpEmis: 3 }), { emissao: true }))).toBe('chave_tpemis_invalido');
    expect(parseChaveAcesso(make({ mod: '65', tpEmis: 9 }), { emissao: true }).ok).toBe(true);
    expect(codeOf(parseChaveAcesso(make({ mod: '65', tpEmis: 5 }), { emissao: true }))).toBe('chave_tpemis_invalido');
    expect(codeOf(parseChaveAcesso(make({ aamm: '1012', tpEmis: 0 }), { emissao: true }))).toBe(
      'chave_tpemis_invalido',
    );
  });

  test('modo emissão: cNF fora da lista proibida e diferente de nNF (B03-10)', () => {
    for (const c of ['00000000', '11111111', '12345678', '01234567', '90123456']) {
      expect(codeOf(parseChaveAcesso(make({ cNF: c }), { emissao: true })), c).toBe('chave_cnf_invalido');
      expect(parseChaveAcesso(make({ cNF: c })).ok, c).toBe(true);
    }
    expect(codeOf(parseChaveAcesso(make({ nNF: 123, cNF: 123 }), { emissao: true }))).toBe('chave_cnf_invalido');
  });
});
