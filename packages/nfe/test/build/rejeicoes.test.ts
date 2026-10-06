/**
 * Regras da SEFAZ conferidas antes de assinar (ADR 0012): cada uma recusa o que a regra do MOC recusa e deixa passar o
 * que as exceções liberam, porque recusar localmente uma nota que a SEFAZ aceitaria é pior que a rejeição.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import { montarChaveAcesso } from '@sinete/validators';
import type { DadosNfe, ResultadoMontagemNfe } from '../../src/index.ts';
import { conferirEmitenteDoCertificado, montarNfe } from '../../src/index.ts';
import {
  CNPJ_DEST,
  CNPJ_EMIT,
  CPF,
  calculadoraFixa,
  DEST_CONTRIBUINTE,
  IE_SP,
  item,
  nota,
  opcoes,
} from '../helpers/nota.ts';

function ocorrencias(r: ResultadoMontagemNfe): readonly Ocorrencia[] {
  return r.ok ? [] : r.ocorrencias;
}

const com = (r: ResultadoMontagemNfe, code: string): readonly Ocorrencia[] =>
  ocorrencias(r).filter((i) => i.code === code);

const isento = (UF: 'SP' | 'RJ'): NonNullable<DadosNfe['destinatario']> => ({
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
      expect(com(await montarNfe(nota({ serie }), opcoes()), 'serie_invalida')).toEqual([]);
    }
    for (const serie of [890, 909, 910, 920, 969, 980, 999]) {
      const [o] = com(await montarNfe(nota({ serie }), opcoes()), 'serie_invalida');
      expect(o).toMatchObject({ caminho: 'serie', origem: 'entrada' });
      expect(o?.mensagem).toContain('0 a 889');
    }
  });
});

describe('CST com destinatário contribuinte isento (RV N12-80, rejeição 529)', () => {
  const nf = (
    icms: NonNullable<DadosNfe['itens'][number]['impostos']['icms']>,
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
      const [o] = com(await montarNfe(nf(icms), opcoes()), 'combinacao_invalida');
      expect(o).toMatchObject({ caminho: 'itens[0].impostos.icms.CST', origem: 'entrada' });
      expect(o?.mensagem).toContain('529');
    }
  });

  test('exceções: CST 50 em conserto ou demonstração; CST 51 interno com destinatário CNPJ ou CPF; outros CST', async () => {
    expect(com(await montarNfe(nf({ CST: '50', orig: '0' }, '6915'), opcoes()), 'combinacao_invalida')).toEqual([]);
    expect(com(await montarNfe(nf({ CST: '50', orig: '0' }, '5912', 'SP'), opcoes()), 'combinacao_invalida')).toEqual(
      [],
    );
    expect(com(await montarNfe(nf({ CST: '51', orig: '0' }, '5102', 'SP'), opcoes()), 'combinacao_invalida')).toEqual(
      [],
    );
    expect(com(await montarNfe(nf({ CST: '40', orig: '0' }), opcoes()), 'combinacao_invalida')).toEqual([]);
    // Uma UF autorizou em produção CST 51 interno com destinatário CPF isento: a exceção 3 é critério da UF.
    const { CNPJ: _, ...semCnpj } = isento('SP') as { CNPJ: string } & NonNullable<DadosNfe['destinatario']>;
    const cpfIsento = nota({
      destinatario: { ...semCnpj, CPF, xNome: 'DESTINATARIO ISENTO' } as NonNullable<DadosNfe['destinatario']>,
      itens: [item({ produto: { ...item().produto, CFOP: '5102' } }, { CST: '51', orig: '0' })],
    });
    expect(com(await montarNfe(cpfIsento, opcoes()), 'combinacao_invalida')).toEqual([]);
  });

  test('destinatário que não é isento não entra na regra', async () => {
    const n = nota({ itens: [item({}, { CST: '50', orig: '0' })], destinatario: DEST_CONTRIBUINTE });
    expect(com(await montarNfe(n, opcoes()), 'combinacao_invalida')).toEqual([]);
  });
});

describe('vencimento das duplicatas (RV Y09-40, rejeição 853; Y09-20 e Y09-30 ficam para a SEFAZ)', () => {
  const dups = (...dVenc: (string | undefined)[]): DadosNfe =>
    nota({
      cobranca: {
        duplicatas: dVenc.map((d, n) => ({
          ...(d === undefined ? {} : { dVenc: d }),
          vDup: n === 0 ? '15.00' : '0.01',
        })),
      },
    });
  const paths = async (n: DadosNfe, emissao?: string): Promise<string[]> =>
    ocorrencias(
      await montarNfe(
        n,
        emissao === undefined ? opcoes() : { ...opcoes(), tempo: contextoDeTempo({ emissao: relogioFixo(emissao) }) },
      ),
    )
      .filter((i) => i.caminho.startsWith('cobranca.duplicatas'))
      .map((i) => `${i.caminho} ${i.mensagem.match(/rejeição (\d+)/)?.[1]}`);

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
    const r = await montarNfe(dups('2026-09-27'), {
      ...opcoes(),
      deslocamentoMin: -120,
      tempo: contextoDeTempo({ emissao: relogioFixo('2026-09-28T00:30:00-02:00') }),
    });
    expect(ocorrencias(r).filter((i) => i.caminho.startsWith('cobranca.duplicatas'))).toEqual([]);
  });
});

describe('conferirEmitenteDoCertificado (RV F03 e F03A, rejeições 213 e 227)', () => {
  test('mesmo CNPJ-base passa (filial); outro CNPJ-base é recusado no CNPJ do emitente', () => {
    expect(conferirEmitenteDoCertificado(nota(), { cnpj: CNPJ_EMIT, cpf: undefined })).toEqual([]);
    expect(conferirEmitenteDoCertificado(nota(), { cnpj: `${CNPJ_EMIT.slice(0, 8)}000262` })).toEqual([]);
    const [o] = conferirEmitenteDoCertificado(nota(), { cnpj: CNPJ_DEST });
    expect(o).toMatchObject({ caminho: 'emitente.CNPJ', code: 'emitente_difere_do_certificado', origem: 'entrada' });
    expect(o?.mensagem).toContain('213');
  });

  test('e-CPF: CPF diferente é recusado; tipos diferentes ficam para a SEFAZ', () => {
    const base = nota();
    const { CNPJ: _c, ...resto } = base.emitente as { CNPJ: string } & Omit<DadosNfe['emitente'], 'CNPJ'>;
    const produtor = { ...base, serie: 920, emitente: { ...resto, CPF } as DadosNfe['emitente'] };
    expect(conferirEmitenteDoCertificado(produtor, { cpf: CPF })).toEqual([]);
    expect(conferirEmitenteDoCertificado(produtor, { cpf: '52998224725' })[0]?.mensagem).toContain('227');
    expect(conferirEmitenteDoCertificado(produtor, { cnpj: CNPJ_EMIT })).toEqual([]);
  });
});

describe('contribuinte exclusivo do IBS/CBS, nota sem IE (NT 2026.007 v1.10)', () => {
  type Item = DadosNfe['itens'][number];
  const citam = (r: ResultadoMontagemNfe, rej: string): readonly Ocorrencia[] =>
    ocorrencias(r).filter((i) => i.mensagem.includes(`rejeição ${rej})`));
  const ICMS = { CST: '00', orig: '0', pICMS: '18' } as const;
  const PIS = item().impostos.pis;
  const COFINS = item().impostos.cofins;
  const CLASSIFICADO = { classificacao: { CST: '000', cClassTrib: '000001' } } as const;
  /** Item com os impostos dados; o padrão é o conforme: sem ICMS e com o grupo IBS/CBS pela calculadora. */
  const it = (impostos: Partial<Item['impostos']> = { ibsCbs: CLASSIFICADO }): Item =>
    ({ ...item(), impostos: { pis: PIS, cofins: COFINS, ...impostos } }) as Item;
  const comIcms = (): Item => it({ icms: ICMS, ibsCbs: CLASSIFICADO });
  const semIe = (extra: Partial<DadosNfe> = {}, emit: { cpf?: boolean; IEST?: string } = {}): DadosNfe => {
    const n = nota({ itens: [it()], ...extra });
    const { IE: _, CNPJ: cnpj, ...resto } = n.emitente;
    const doc = emit.cpf ? { CPF } : { CNPJ: cnpj };
    return { ...n, emitente: { ...resto, ...doc, ...(emit.IEST ? { IEST: emit.IEST } : {}) } as DadosNfe['emitente'] };
  };
  const o = (at?: string) => opcoes({ ibsCbs: calculadoraFixa }, at);
  const chaveRef = montarChaveAcesso({
    cUF: '35',
    aamm: '2608',
    emitente: CNPJ_EMIT,
    mod: '55',
    serie: '1',
    nNF: '99',
    tpEmis: '1',
    cNF: '31415926',
  });

  test('nota sem IE em conformidade monta, e a nota comum com IE também', async () => {
    expect(ocorrencias(await montarNfe(semIe(), o()))).toEqual([]);
    expect((await montarNfe(nota(), o())).ok).toBe(true);
  });

  test('NFC-e sem IE é recusada até 2032 (156), e a partir de 2033 não', async () => {
    const nfce = (ie?: string): DadosNfe => {
      const { destinatario: _, ...n } = semIe({ modelo: '65', pagamento: { detPag: [{ tPag: '01', vPag: '15.00' }] } });
      return ie === undefined ? n : { ...n, emitente: { ...n.emitente, IE: ie } };
    };
    for (const at of ['2026-10-06T10:00:00-03:00', '2032-12-31T10:00:00-03:00']) {
      const r = await montarNfe(nfce(), o(at));
      expect(citam(r, '156')).toEqual([expect.objectContaining({ caminho: 'emitente.IE', origem: 'entrada' })]);
      expect(citam(await montarNfe(nfce(IE_SP), o(at)), '156')).toEqual([]);
    }
    // Um instante em que alguma leitura (UTC) já é 2033 não recusa.
    expect(citam(await montarNfe(nfce(), o('2032-12-31T22:00:00-03:00')), '156')).toEqual([]);
    expect(citam(await montarNfe(nfce(), o('2033-01-03T10:00:00-03:00')), '156')).toEqual([]);
  });

  test('emitente CPF sem IE (157) e IEST sem IE (158)', async () => {
    const cpf = await montarNfe(semIe({ serie: 920 }, { cpf: true }), o());
    expect(citam(cpf, '157')).toEqual([expect.objectContaining({ caminho: 'emitente.CNPJ', origem: 'entrada' })]);
    const iest = await montarNfe(semIe({}, { IEST: IE_SP }), o());
    expect(citam(iest, '158')).toEqual([expect.objectContaining({ caminho: 'emitente.IEST', origem: 'entrada' })]);
    const comIe = await montarNfe(nota({ emitente: { ...nota().emitente, IEST: IE_SP } }), o());
    expect(citam(comIe, '158')).toEqual([]);
  });

  test('ICMS e ICMS interestadual no item da nota sem IE (161), por item', async () => {
    const r = await montarNfe(semIe({ itens: [comIcms(), it()] }), o());
    expect(citam(r, '161').map((i) => i.caminho)).toEqual(['itens[0].impostos.icms']);
    const difal = it({
      ibsCbs: CLASSIFICADO,
      icmsUfDest: {
        vBCUFDest: '15.00',
        pFCPUFDest: '0',
        pICMSUFDest: '18',
        pICMSInter: '12.00',
        vICMSUFDest: '0.90',
        vFCPUFDest: '0.00',
      },
    });
    const r2 = await montarNfe(semIe({ itens: [it(), difal] }), o());
    expect(citam(r2, '161').map((i) => i.caminho)).toEqual(['itens[1].impostos.icmsUfDest']);
  });

  test('devolução e nota de crédito de retorno (tpNFCredito 03) passam com ICMS; outro tpNFCredito não', async () => {
    const dev = await montarNfe(semIe({ finNFe: '4', referenciadas: [{ refNFe: chaveRef }], itens: [comIcms()] }), o());
    expect(citam(dev, '161')).toEqual([]);
    const credito = (tp: '01' | '03') =>
      semIe({ finNFe: '5', tpNFCredito: tp, referenciadas: [{ refNFe: chaveRef }], itens: [comIcms()] });
    expect(citam(await montarNfe(credito('03'), o()), '161')).toEqual([]);
    expect(citam(await montarNfe(credito('01'), o()), '161').map((i) => i.caminho)).toEqual(['itens[0].impostos.icms']);
  });

  test('item sem o grupo IBS/CBS na nota sem IE (162), só nele', async () => {
    const r = await montarNfe(semIe({ itens: [it(), it({})] }), o());
    expect(citam(r, '162')).toEqual([
      expect.objectContaining({ caminho: 'itens[1].impostos.ibsCbs', origem: 'entrada' }),
    ]);
    // Sem ICMS e sem ISSQN é a exceção 2 da B25-90 na NF-e sem IE: a única ocorrência do item é a 162.
    expect(ocorrencias(r).filter((i) => i.caminho.startsWith('itens[1]'))).toHaveLength(1);
  });

  test('item classificado cujo cálculo falhou fica só com a ocorrência da calculadora, sem a 162', async () => {
    const recusa = {
      calcular: () => ({
        itens: [],
        ocorrencias: [{ caminho: 'itens[0]', code: 'ibscbs_calculo', mensagem: 'falhou', origem: 'montagem' as const }],
      }),
    };
    const r = await montarNfe(semIe(), opcoes({ ibsCbs: recusa as never }));
    expect(citam(r, '162')).toEqual([]);
    expect(ocorrencias(r)).toContainEqual(expect.objectContaining({ code: 'ibscbs_calculo', origem: 'montagem' }));
  });

  test('a exceção 2 da B25-90 é só do modelo 55: a NFC-e sem ICMS continua com a ocorrência do ICMS', async () => {
    const { destinatario: _, ...n } = semIe({
      modelo: '65',
      itens: [it({})],
      pagamento: { detPag: [{ tPag: '01', vPag: '15.00' }] },
    });
    const r = await montarNfe(n, o('2033-01-03T10:00:00-03:00'));
    expect(ocorrencias(r)).toContainEqual(
      expect.objectContaining({ caminho: 'itens[0].impostos.icms', code: 'campo_obrigatorio' }),
    );
  });

  test('todas as violações voltam juntas; as regras de tabela, cadastro e roteamento ficam para a SEFAZ', async () => {
    const r = await montarNfe(semIe({ serie: 920, itens: [comIcms(), it({})] }, { cpf: true, IEST: IE_SP }), o());
    for (const rej of ['157', '158', '161', '162']) expect(citam(r, rej)).not.toHaveLength(0);
    for (const rej of ['159', '163', '164', '166', '178', '187', '188']) expect(citam(r, rej)).toEqual([]);
  });
});

describe('CFOP de devolução fora da devolução (RV I08-144, rejeição 328)', () => {
  const citam = (r: ResultadoMontagemNfe, rej: string): readonly Ocorrencia[] =>
    ocorrencias(r).filter((i) => i.mensagem.includes(`rejeição ${rej})`));
  const cfop = (CFOP: string) => {
    const b = item();
    return { ...b, produto: { ...b.produto, CFOP } };
  };
  const rj = (extra: Partial<DadosNfe>): DadosNfe =>
    nota({
      destinatario: {
        CNPJ: CNPJ_DEST,
        xNome: 'DESTINATARIO CONTRIBUINTE LTDA',
        indIEDest: '1',
        IE: '81924287',
        endereco: {
          xLgr: 'AVENIDA FICTICIA',
          nro: '1',
          xBairro: 'BAIRRO',
          cMun: '3304557',
          xMun: 'RIO DE JANEIRO',
          UF: 'RJ',
        },
      },
      ...extra,
    });

  test('CFOP de devolução na NF-e normal: uma ocorrência por item, no CFOP', async () => {
    const um = await montarNfe(rj({ itens: [cfop('6202')] }), opcoes());
    expect(citam(um, '328')).toEqual([
      expect.objectContaining({ caminho: 'itens[0].produto.CFOP', code: 'combinacao_invalida', origem: 'entrada' }),
    ]);
    const quatro = await montarNfe(rj({ itens: [cfop('6102'), cfop('6202'), cfop('6102'), cfop('6202')] }), opcoes());
    expect(citam(quatro, '328').map((i) => i.caminho)).toEqual(['itens[1].produto.CFOP', 'itens[3].produto.CFOP']);
    expect((await montarNfe(rj({ itens: [cfop('6102')] }), opcoes())).ok).toBe(true);
  });

  test('devolução, complementar e nota de crédito 03, 04 e 06 aceitam; ajuste e crédito 01 não', async () => {
    for (const extra of [
      { finNFe: '4' },
      { finNFe: '2' },
      { finNFe: '5', tpNFCredito: '03' },
      { finNFe: '5', tpNFCredito: '04' },
      { finNFe: '5', tpNFCredito: '06' },
    ] as const) {
      expect(
        citam(await montarNfe(rj({ ...extra, itens: [cfop('6202')] }), opcoes()), '328'),
        JSON.stringify(extra),
      ).toEqual([]);
    }
    for (const extra of [{ finNFe: '5', tpNFCredito: '01' }, { finNFe: '3' }] as const) {
      expect(citam(await montarNfe(rj({ ...extra, itens: [cfop('6202')] }), opcoes()), '328')).toEqual([
        expect.objectContaining({ caminho: 'itens[0].produto.CFOP', origem: 'entrada' }),
      ]);
    }
  });

  test('CFOP fora da tabela não é recusado como devolução', async () => {
    expect(citam(await montarNfe(rj({ itens: [cfop('6998')] }), opcoes()), '328')).toEqual([]);
    // Com espaço ou ponto, o CFOP serializado é o mesmo: a conferência também.
    expect(citam(await montarNfe(rj({ itens: [cfop('6 202')] }), opcoes()), '328')).toHaveLength(1);
    expect(citam(await montarNfe(rj({ itens: [cfop('6.202')] }), opcoes()), '328')).toHaveLength(1);
    const r = await montarNfe(rj({ itens: [cfop('constructor')] }), opcoes());
    expect(r.ok).toBe(false);
  });
});

describe('CST com destinatário não contribuinte (RV N12-70, rejeição 508)', () => {
  const citam = (r: ResultadoMontagemNfe): readonly Ocorrencia[] =>
    ocorrencias(r).filter((i) => i.mensagem.includes('rejeição 508)'));
  type Icms = NonNullable<DadosNfe['itens'][number]['impostos']['icms']>;
  const it = (CFOP: string, icms: Icms, extra: Partial<DadosNfe['itens'][number]['produto']> = {}) => {
    const b = item({}, icms);
    return { ...b, produto: { ...b.produto, CFOP, ...extra } };
  };
  const cpfRj = {
    CPF,
    xNome: 'CONSUMIDOR SINTETICO',
    indIEDest: '9' as const,
    endereco: { xLgr: 'RUA', nro: '1', xBairro: 'BAIRRO', cMun: '3304557', xMun: 'RIO DE JANEIRO', UF: 'RJ' as const },
  };
  const ST = { modBCST: '4', pMVAST: '40', pICMSST: '18' } as const;

  test('CST fora da lista vira ocorrência no CST do item', async () => {
    const casos: [DadosNfe, string][] = [
      [nota({ itens: [it('5102', { CST: '90', orig: '0' })] }), 'SP 90'],
      [nota({ itens: [it('5102', { CST: '70', orig: '0', pICMS: '18', pRedBC: '10', st: ST })] }), 'SP 70'],
      [nota({ destinatario: cpfRj, itens: [it('6108', { CST: '10', orig: '0', pICMS: '12', st: ST })] }), 'RJ 10'],
      [nota({ destinatario: cpfRj, itens: [it('6108', { CST: '30', orig: '0', st: ST })] }), 'RJ 30'],
      [nota({ destinatario: cpfRj, itens: [it('6108', { CST: '51', orig: '0' })] }), 'RJ 51'],
    ];
    for (const [n, nome] of casos) {
      expect(citam(await montarNfe(n, opcoes())), nome).toEqual([
        expect.objectContaining({
          caminho: 'itens[0].impostos.icms.CST',
          code: 'combinacao_invalida',
          origem: 'entrada',
        }),
      ]);
    }
  });

  test('CST da lista e CSOSN passam', async () => {
    expect((await montarNfe(nota(), opcoes())).ok).toBe(true);
    for (const icms of [
      { CST: '20', orig: '0', pICMS: '18', pRedBC: '10' },
      { CST: '40', orig: '0' },
      { CST: '41', orig: '0' },
      { CST: '60', orig: '0' },
    ] as const) {
      expect(citam(await montarNfe(nota({ itens: [it('5102', icms)] }), opcoes())), icms.CST).toEqual([]);
    }
    const sn = nota({ itens: [it('5102', { CSOSN: '900', orig: '0' } as Icms)] });
    expect(citam(await montarNfe({ ...sn, emitente: { ...sn.emitente, CRT: '1' } }, opcoes()))).toEqual([]);
  });

  test('exceções do documento: entrada, devolução, veículo novo, combustível e energia interestaduais', async () => {
    const entrada = nota({ tpNF: '0', itens: [it('1102', { CST: '90', orig: '0' })] });
    expect(citam(await montarNfe(entrada, opcoes()))).toEqual([]);
    for (const cst of ['50', '51'] as const) {
      const dev = nota({ finNFe: '4', destinatario: cpfRj, itens: [it('6202', { CST: cst, orig: '0' })] });
      expect(citam(await montarNfe(dev, opcoes())), cst).toEqual([]);
    }
    const veic = nota({
      itens: [
        it('5102', { CST: '90', orig: '0' }, { especifico: { veicProd: {} as never } }),
        it('5102', { CST: '90', orig: '0' }),
      ],
    });
    expect(citam(await montarNfe(veic, opcoes()))).toEqual([]);
    const comb = nota({
      destinatario: cpfRj,
      itens: [
        it('6656', { CST: '30', orig: '0', st: ST }, { especifico: { comb: { cProdANP: '320102001' } as never } }),
      ],
    });
    expect(citam(await montarNfe(comb, opcoes()))).toEqual([]);
    const energia = nota({
      destinatario: cpfRj,
      itens: [it('6252', { CST: '30', orig: '0', st: ST }, { NCM: '27160000' })],
    });
    expect(citam(await montarNfe(energia, opcoes()))).toEqual([]);
  });

  test('exceções por CFOP e a critério da UF', async () => {
    const casos: [string, Icms, typeof cpfRj | undefined][] = [
      ['6949', { CST: '50', orig: '0' }, cpfRj],
      ['5949', { CST: '50', orig: '0' }, undefined],
      ['6915', { CST: '50', orig: '0' }, cpfRj],
      ['6916', { CST: '50', orig: '0' }, cpfRj],
      ['6998', { CST: '50', orig: '0' }, cpfRj],
      ['6123', { CST: '51', orig: '0' }, cpfRj],
      ['6922', { CST: '51', orig: '0' }, cpfRj],
      ['5906', { CST: '51', orig: '0' }, undefined],
      ['5102', { CST: '51', orig: '0' }, undefined],
      ['5403', { CST: '10', orig: '0', pICMS: '18', st: ST }, undefined],
    ];
    for (const [c, icms, dest] of casos) {
      const n = nota({ ...(dest ? { destinatario: dest } : {}), itens: [it(c, icms)] });
      expect(citam(await montarNfe(n, opcoes())), `${c} ${JSON.stringify(icms)}`).toEqual([]);
    }
    // CST 50 com CFOP comum de venda, sem retorno nem remessa, é recusado.
    expect(
      citam(await montarNfe(nota({ destinatario: cpfRj, itens: [it('6108', { CST: '50', orig: '0' })] }), opcoes())),
    ).toHaveLength(1);
  });

  test('CST 90 com 5403 ou 5405 passa só no CE', async () => {
    const ce = nota({
      emitente: {
        ...nota().emitente,
        IE: '060000015',
        endereco: { ...nota().emitente.endereco, UF: 'CE', cMun: '2304400', xMun: 'FORTALEZA' },
      },
      destinatario: {
        CPF,
        xNome: 'CONSUMIDOR SINTETICO',
        indIEDest: '9',
        endereco: { xLgr: 'RUA', nro: '1', xBairro: 'BAIRRO', cMun: '2304400', xMun: 'FORTALEZA', UF: 'CE' },
      },
      itens: [it('5405', { CST: '90', orig: '0' })],
    });
    expect(citam(await montarNfe(ce, opcoes()))).toEqual([]);
    expect(citam(await montarNfe(nota({ itens: [it('5405', { CST: '90', orig: '0' })] }), opcoes()))).toHaveLength(1);
  });

  test('328 e 508 não se aplicam à NFC-e', async () => {
    const { destinatario: _, ...base } = nota({ itens: [it('5102', { CST: '90', orig: '0' })] });
    const nfce: DadosNfe = {
      ...base,
      modelo: '65',
      destinatario: { CPF, indIEDest: '9' },
      pagamento: { detPag: [{ tPag: '01', vPag: '20' }] },
    };
    const r = await montarNfe(nfce, opcoes());
    expect(ocorrencias(r).filter((i) => /rejeição (328|508)\)/.test(i.mensagem))).toEqual([]);
  });
});
