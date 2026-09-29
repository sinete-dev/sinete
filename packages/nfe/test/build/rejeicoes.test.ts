/**
 * Regras da SEFAZ conferidas antes de assinar (ADR 0012): cada uma recusa o que a regra do MOC recusa e deixa passar o
 * que as exceções liberam, porque recusar localmente uma nota que a SEFAZ aceitaria é pior que a rejeição.
 */
import { describe, expect, test } from 'bun:test';
import type { ValidationIssue } from '@sinete/core';
import { fixedClock, timeContext } from '@sinete/core';
import type { BuildNfeResult, NfeInput } from '../../src/index.ts';
import { buildNfe, conferirEmitenteDoCertificado } from '../../src/index.ts';
import { CNPJ_DEST, CNPJ_EMIT, CPF, item, nota, opcoes } from '../helpers/nota.ts';

function ocorrencias(r: BuildNfeResult): readonly ValidationIssue[] {
  return r.ok ? [] : r.issues;
}

const com = (r: BuildNfeResult, code: string): readonly ValidationIssue[] =>
  ocorrencias(r).filter((i) => i.code === code);

const isento = (UF: 'SP' | 'RJ'): NonNullable<NfeInput['destinatario']> => ({
  CNPJ: CNPJ_DEST,
  xNome: 'DESTINATARIO ISENTO LTDA',
  indIEDest: '2',
  endereco:
    UF === 'SP'
      ? { xLgr: 'AVENIDA FICTICIA', nro: '1', xBairro: 'BAIRRO', cMun: '3550308', xMun: 'SAO PAULO', UF }
      : { xLgr: 'AVENIDA FICTICIA', nro: '1', xBairro: 'BAIRRO', cMun: '3304557', xMun: 'RIO DE JANEIRO', UF },
});

describe('série do emitente CNPJ (RV C02-30 e B26-10, rejeições 503 e 244)', () => {
  test('0 a 889 passam; 890 a 999 são recusadas no campo da entrada', async () => {
    for (const serie of [0, 1, 889]) {
      expect(com(await buildNfe(nota({ serie }), opcoes()), 'serie_invalida')).toEqual([]);
    }
    for (const serie of [890, 909, 910, 920, 969, 980, 999]) {
      const [o] = com(await buildNfe(nota({ serie }), opcoes()), 'serie_invalida');
      expect(o).toMatchObject({ path: 'serie', origem: 'entrada' });
      expect(o?.message).toContain('0 a 889');
    }
  });
});

describe('CST com destinatário contribuinte isento (RV N12-80, rejeição 529)', () => {
  const nf = (
    icms: NonNullable<NfeInput['itens'][number]['impostos']['icms']>,
    CFOP = '6102',
    UF: 'SP' | 'RJ' = 'RJ',
  ) =>
    nota({
      destinatario: isento(UF),
      itens: [item({ produto: { ...item().produto, CFOP } }, icms)],
    });

  test('CST 50 e 51 são recusados, com o caminho do CST do item', async () => {
    for (const icms of [
      { CST: '50', orig: '0' },
      { CST: '51', orig: '0' },
    ] as const) {
      const [o] = com(await buildNfe(nf(icms), opcoes()), 'combinacao_invalida');
      expect(o).toMatchObject({ path: 'itens[0].impostos.icms.CST', origem: 'entrada' });
      expect(o?.message).toContain('529');
    }
  });

  test('exceções: CST 50 em conserto ou demonstração; CST 51 interno com destinatário CNPJ ou CPF; outros CST', async () => {
    expect(com(await buildNfe(nf({ CST: '50', orig: '0' }, '6915'), opcoes()), 'combinacao_invalida')).toEqual([]);
    expect(com(await buildNfe(nf({ CST: '50', orig: '0' }, '5912', 'SP'), opcoes()), 'combinacao_invalida')).toEqual(
      [],
    );
    expect(com(await buildNfe(nf({ CST: '51', orig: '0' }, '5102', 'SP'), opcoes()), 'combinacao_invalida')).toEqual(
      [],
    );
    expect(com(await buildNfe(nf({ CST: '40', orig: '0' }), opcoes()), 'combinacao_invalida')).toEqual([]);
    // Uma UF autorizou em produção CST 51 interno com destinatário CPF isento: a exceção 3 é critério da UF.
    const { CNPJ: _, ...semCnpj } = isento('SP') as { CNPJ: string } & NonNullable<NfeInput['destinatario']>;
    const cpfIsento = nota({
      destinatario: { ...semCnpj, CPF, xNome: 'DESTINATARIO ISENTO' } as NonNullable<NfeInput['destinatario']>,
      itens: [item({ produto: { ...item().produto, CFOP: '5102' } }, { CST: '51', orig: '0' })],
    });
    expect(com(await buildNfe(cpfIsento, opcoes()), 'combinacao_invalida')).toEqual([]);
  });

  test('destinatário que não é isento não entra na regra', async () => {
    const n = nota({ itens: [item({}, { CST: '50', orig: '0' })] });
    expect(com(await buildNfe(n, opcoes()), 'combinacao_invalida')).toEqual([]);
  });
});

describe('vencimento das duplicatas (RV Y09-40, rejeição 853; Y09-20 e Y09-30 ficam para a SEFAZ)', () => {
  const dups = (...dVenc: (string | undefined)[]): NfeInput =>
    nota({
      cobranca: {
        duplicatas: dVenc.map((d, n) => ({
          ...(d === undefined ? {} : { dVenc: d }),
          vDup: n === 0 ? '15.00' : '0.01',
        })),
      },
    });
  const paths = async (n: NfeInput, emissao?: string): Promise<string[]> =>
    ocorrencias(
      await buildNfe(
        n,
        emissao === undefined ? opcoes() : { ...opcoes(), time: timeContext({ emissao: fixedClock(emissao) }) },
      ),
    )
      .filter((i) => i.path.startsWith('cobranca.duplicatas'))
      .map((i) => `${i.path} ${i.message.match(/rejeição (\d+)/)?.[1]}`);

  test('sem vencimento, antes da emissão ou antes da parcela anterior: não recusa (a UF decide a Y09-20 e a Y09-30)', async () => {
    expect(await paths(dups(undefined))).toEqual([]);
    expect(await paths(dups('2026-07-26'))).toEqual([]);
    expect(await paths(dups('2026-10-26', '2026-10-20'))).toEqual([]);
  });

  test('parcela única vencendo na emissão: 853; com mais parcelas ou outra data, passa', async () => {
    expect(await paths(dups('2026-09-26'))).toEqual(['cobranca.duplicatas 853']);
    expect(await paths(dups('2026-09-26', '2026-10-26'))).toEqual([]);
    expect(await paths(dups('2026-09-27'))).toEqual([]);
  });

  test('na virada do dia em UTC a data da emissão é ambígua: não recusa 853 pela data de Brasília', async () => {
    // 22h em São Paulo já é o dia seguinte em UTC: a SEFAZ pode comparar com qualquer das duas.
    expect(await paths(dups('2026-09-26'), '2026-09-26T22:00:00-03:00')).toEqual([]);
  });

  test('fuso à frente de Brasília (UTC-2): o vencimento no dia de Brasília não é "antes da emissão"', async () => {
    const r = await buildNfe(dups('2026-09-27'), {
      ...opcoes(),
      offsetMinutes: -120,
      time: timeContext({ emissao: fixedClock('2026-09-28T00:30:00-02:00') }),
    });
    expect(ocorrencias(r).filter((i) => i.path.startsWith('cobranca.duplicatas'))).toEqual([]);
  });
});

describe('conferirEmitenteDoCertificado (RV F03 e F03A, rejeições 213 e 227)', () => {
  test('mesmo CNPJ-base passa (filial); outro CNPJ-base é recusado no CNPJ do emitente', () => {
    expect(conferirEmitenteDoCertificado(nota(), { cnpj: CNPJ_EMIT, cpf: undefined })).toEqual([]);
    expect(conferirEmitenteDoCertificado(nota(), { cnpj: `${CNPJ_EMIT.slice(0, 8)}000262` })).toEqual([]);
    const [o] = conferirEmitenteDoCertificado(nota(), { cnpj: CNPJ_DEST });
    expect(o).toMatchObject({ path: 'emitente.CNPJ', code: 'emitente_difere_do_certificado', origem: 'entrada' });
    expect(o?.message).toContain('213');
  });

  test('e-CPF: CPF diferente é recusado; tipos diferentes ficam para a SEFAZ', () => {
    const base = nota();
    const { CNPJ: _c, ...resto } = base.emitente as { CNPJ: string } & Omit<NfeInput['emitente'], 'CNPJ'>;
    const produtor = { ...base, serie: 920, emitente: { ...resto, CPF } as NfeInput['emitente'] };
    expect(conferirEmitenteDoCertificado(produtor, { cpf: CPF })).toEqual([]);
    expect(conferirEmitenteDoCertificado(produtor, { cpf: '52998224725' })[0]?.message).toContain('227');
    expect(conferirEmitenteDoCertificado(produtor, { cnpj: CNPJ_EMIT })).toEqual([]);
  });
});
