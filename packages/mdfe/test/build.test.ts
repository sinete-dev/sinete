import { describe, expect, test } from 'bun:test';
import { fixedClock, formatarVerProc, timeContext } from '@sinete/core';
import { parseXml, verifySignature } from '@sinete/core/xml';
import { validateRoot } from '@sinete/schemas';
import { MDFeElement } from '@sinete/schemas/mdfe/3.00b';
import { syntheticCertificate } from '@sinete/sefaz-sim';
import { buildChaveAcesso, parseChaveAcesso } from '@sinete/validators';
import type { BuildMdfeResult, MdfeInput, PagamentoFrete } from '../src/index.ts';
import { buildMdfe, comQrCode, prazoContingencia, qrCodeMdfe, signMdfe } from '../src/index.ts';
import { VERSAO_PACOTE } from '../src/versao-gerada.ts';
import {
  CNPJ_EMIT,
  CNPJ_TERCEIRO,
  CPF_CONDUTOR,
  CPF_EMIT,
  cargaPropria,
  chaveDoc,
  EMISSAO,
  opcoes,
  prestador,
} from './helpers/mdfe.ts';

function ok(r: BuildMdfeResult): Extract<BuildMdfeResult, { ok: true }>['value'] {
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join('\n'));
  return r.value;
}

/** As rejeições do MOC que as ocorrências citam (`rejeição 663`). */
function rejeicoes(r: BuildMdfeResult): string[] {
  if (r.ok) return [];
  return r.issues.flatMap((i) => /rejeição (\d{3,4})\)$/.exec(i.message)?.[1] ?? []);
}

function codigos(r: BuildMdfeResult): string[] {
  return r.ok ? [] : r.issues.map((i) => i.code);
}

/** Cópia sem as chaves pedidas (com `exactOptionalPropertyTypes`, campo opcional não aceita `undefined`). */
function sem<T extends object, K extends keyof T>(o: T, ...chaves: K[]): T {
  const c = { ...o };
  for (const k of chaves) delete c[k];
  return c;
}

const rodo = (i: MdfeInput, extra: Partial<MdfeInput['rodoviario']>): MdfeInput => ({
  ...i,
  rodoviario: { ...i.rodoviario, ...extra },
});

const pagamento = (extra: Partial<PagamentoFrete> = {}): PagamentoFrete =>
  ({ ...(prestador().rodoviario.pagamentos?.[0] as PagamentoFrete), ...extra }) as PagamentoFrete;

describe('buildMdfe: carga própria do produtor rural (CPF)', () => {
  test('monta a chave, o ide e os totais', () => {
    const v = ok(buildMdfe(cargaPropria(), opcoes()));
    const c = parseChaveAcesso(v.chave);
    expect(c.ok && c.value.mod).toBe('58');
    expect(v.chave.slice(0, 6)).toBe('512609');
    expect(v.chave.slice(6, 20)).toBe(`000${CPF_EMIT}`);
    expect(v.chave.slice(22, 25)).toBe('920');
    expect(v.id).toBe(`MDFe${v.chave}`);
    expect(v.dhEmi).toBe(EMISSAO);
    const inf = v.infMDFe;
    expect(inf.ide.tpEmit).toBe('2');
    expect(inf.ide.tpTransp).toBeUndefined();
    expect(inf.ide.infPercurso).toEqual([{ UFPer: 'MS' }]);
    expect(inf.emit.CPF).toBe(CPF_EMIT);
    expect(inf.emit.enderEmit.CEP).toBe('78000000');
    expect(inf.tot).toEqual({ qNFe: '2', vCarga: '150000.00', cUnid: '01', qCarga: '30000.0000' });
    expect(inf.infModal.rodo?.infANTT).toBeUndefined();
    expect(v.xml.startsWith('<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe"><infMDFe')).toBe(true);
    expect(v.xml.endsWith('</infMDFe></MDFe>')).toBe(true);
  });

  test('dhIniViagem sai no fuso do emitente', () => {
    const v = ok(buildMdfe(cargaPropria({ dhIniViagem: fixedClock('2026-09-26T15:00:00Z').now() }), opcoes()));
    expect(v.infMDFe.ide.dhIniViagem).toBe('2026-09-26T11:00:00-04:00');
  });

  test('verProc padrão é "sinete <versão do pacote>"; override explícito prevalece', () => {
    const padrao = ok(buildMdfe(cargaPropria(), opcoes()));
    expect(padrao.infMDFe.ide.verProc).toBe(formatarVerProc('sinete', VERSAO_PACOTE));
    expect(padrao.infMDFe.ide.verProc.length).toBeLessThanOrEqual(20);

    const override = ok(buildMdfe(cargaPropria(), opcoes({ verProc: 'meu-erp 9.9.9' })));
    expect(override.infMDFe.ide.verProc).toBe('meu-erp 9.9.9');
  });

  test('série, número, cMDF e dhIniViagem fora da forma voltam como ocorrência, não como exceção', () => {
    const casos: [Partial<MdfeInput>, string][] = [
      [{ serie: 1000 }, 'serie'],
      [{ nMDF: -1 }, 'nMDF'],
      [{ nMDF: 1_000_000_000 }, 'nMDF'],
      [{ nMDF: 1.5 }, 'nMDF'],
      [{ cMDF: 'abcdefgh' }, 'cMDF'],
      [{ dhIniViagem: { getTime: () => Number.NaN } as never }, 'dhIniViagem'],
    ];
    for (const [extra, path] of casos) {
      const r = buildMdfe(cargaPropria(extra), opcoes());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.map((i) => i.path)).toContain(path);
    }
  });

  test('NT 2024.001: cavalo mecânico sem reboque (523) e chaves anteriores a 6 meses da emissão (518, 519)', () => {
    const tracao = cargaPropria().rodoviario.tracao;
    const cavalo = cargaPropria({ rodoviario: { tracao: { ...tracao, tpRod: '03' } } });
    expect(rejeicoes(buildMdfe(cavalo, opcoes()))).toEqual(['523']);
    const chave = (aamm: string, mod: '55' | '57'): string =>
      buildChaveAcesso({ cUF: '51', aamm, emitente: CNPJ_EMIT, mod, serie: 1, nNF: 3, tpEmis: '1', cNF: '10000003' });
    // Emissão em 09/2026: 03/2026 ainda passa, 02/2026 não.
    const comNfe = (aamm: string): MdfeInput =>
      cargaPropria({ descarregamentos: [{ cMun: '3550308', xMun: 'SAO PAULO', nfe: [{ chave: chave(aamm, '55') }] }] });
    expect(rejeicoes(buildMdfe(comNfe('2603'), opcoes()))).toEqual([]);
    expect(rejeicoes(buildMdfe(comNfe('2602'), opcoes()))).toEqual(['519']);
    // Virada de ano: emissão em 01/2027 aceita 07/2026 e recusa 06/2026.
    expect(rejeicoes(buildMdfe(comNfe('2607'), opcoes({}, '2027-01-10T10:00:00-04:00')))).toEqual([]);
    expect(rejeicoes(buildMdfe(comNfe('2606'), opcoes({}, '2027-01-10T10:00:00-04:00')))).toEqual(['519']);
    const i = prestador();
    const cte = rodo(
      { ...i, descarregamentos: [{ cMun: '5208707', xMun: 'GOIANIA', cte: [{ chave: chave('2512', '57') }] }] },
      {},
    );
    expect(rejeicoes(buildMdfe(cte, opcoes()))).toEqual(['518']);
  });

  test('chave de NF-e com CNPJ alfanumérico em minúsculas sai como o validador leu', () => {
    const minuscula = '51260912abc34501de35550010000000011123456785';
    const v = ok(
      buildMdfe(
        cargaPropria({ descarregamentos: [{ cMun: '3550308', xMun: 'SAO PAULO', nfe: [{ chave: minuscula }] }] }),
        opcoes(),
      ),
    );
    expect(v.xml).toContain(`<chNFe>${minuscula.toUpperCase()}</chNFe>`);
  });

  test('série, tipo e IE do emitente pessoa física (F70, F71, F72, F73, F77)', () => {
    expect(rejeicoes(buildMdfe(cargaPropria({ serie: 1 }), opcoes()))).toContain('233');
    expect(rejeicoes(buildMdfe(cargaPropria({ tpEmit: '1' }), opcoes()))).toContain('234');
    const e = cargaPropria().emitente;
    expect(rejeicoes(buildMdfe(cargaPropria({ emitente: { ...e, IE: '' } }), opcoes()))).toContain('229');
    expect(rejeicoes(buildMdfe(cargaPropria({ emitente: { ...e, IE: '00130000010' } }), opcoes()))).toContain('209');
    const outraUf = { ...e, endereco: { ...e.endereco, cMun: '3550308' } };
    expect(rejeicoes(buildMdfe(cargaPropria({ emitente: outraUf }), opcoes()))).toContain('407');
  });

  test('CNPJ não usa as séries do CPF (F69)', () => {
    expect(rejeicoes(buildMdfe(prestador({ serie: 930 }), opcoes()))).toContain('232');
  });

  test('municípios de carregamento e descarregamento (F08, F10, F11, F13)', () => {
    const r1 = buildMdfe(
      cargaPropria({
        carregamento: [
          { cMun: '5103403', xMun: 'CUIABA' },
          { cMun: '5103403', xMun: 'CUIABA' },
          { cMun: '3550308', xMun: 'SAO PAULO' },
        ],
      }),
      opcoes(),
    );
    expect(rejeicoes(r1)).toEqual(expect.arrayContaining(['685', '456']));
    const d = cargaPropria().descarregamentos[0] as MdfeInput['descarregamentos'][number];
    const r2 = buildMdfe(
      cargaPropria({ descarregamentos: [d, { ...d, nfe: [{ chave: chaveDoc(3) }] }, { ...d, cMun: '5103403' }] }),
      opcoes(),
    );
    expect(rejeicoes(r2)).toEqual(expect.arrayContaining(['680', '612']));
  });

  test('percurso por divisas (F90), com sugestão', () => {
    const r = buildMdfe(cargaPropria({ percurso: [] }), opcoes());
    expect(rejeicoes(r)).toEqual(['663']);
    expect(!r.ok && r.issues[0]?.message).toContain('um percurso possível é MS');
    expect(rejeicoes(buildMdfe(cargaPropria({ percurso: ['GO'] }), opcoes()))).toEqual(['663']);
    ok(buildMdfe(cargaPropria({ percurso: ['GO', 'MG'] }), opcoes()));
  });

  test('tipo do emitente contra os documentos (F14 a F17)', () => {
    const cte = [{ cMun: '3550308', xMun: 'SAO PAULO', cte: [{ chave: chaveDoc(5, '57') }] }];
    expect(rejeicoes(buildMdfe(cargaPropria({ descarregamentos: cte }), opcoes()))).toContain('639');
    const nfe = cargaPropria().descarregamentos;
    const r1 = buildMdfe(prestador({ descarregamentos: nfe, ufFim: 'SP', percurso: ['MS'] }), opcoes());
    expect(rejeicoes(r1)).toContain('638');
    const r3 = buildMdfe(prestador({ tpEmit: '3' }), opcoes());
    expect(rejeicoes(r3)).toEqual(expect.arrayContaining(['540', '541']));
  });

  test('carregamento posterior (F21 a F27)', () => {
    const base = cargaPropria({
      indCarregaPosterior: true,
      ufFim: 'MT',
      percurso: [],
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA' }],
    });
    const v = ok(buildMdfe(base, opcoes()));
    expect(v.infMDFe.ide.indCarregaPosterior).toBe('1');
    expect(v.infMDFe.tot.qNFe).toBeUndefined();
    expect(
      rejeicoes(buildMdfe({ ...base, descarregamentos: [{ cMun: '5108402', xMun: 'VARZEA GRANDE' }] }, opcoes())),
    ).toContain('703');
    expect(rejeicoes(buildMdfe({ ...base, ufFim: 'GO', percurso: [] }, opcoes()))).toEqual(['612', '704']);
    expect(
      rejeicoes(buildMdfe({ ...base, tpEmit: '1', emitente: prestador().emitente, serie: 1 }, opcoes())),
    ).toContain('707');
    const comDoc = { ...base, descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA', nfe: [{ chave: chaveDoc(1) }] }] };
    expect(rejeicoes(buildMdfe(comDoc, opcoes()))).toContain('706');
  });

  test('município sem documento (F26)', () => {
    const d = [
      ...cargaPropria().descarregamentos,
      { cMun: '3509502', xMun: 'CAMPINAS' },
    ] as MdfeInput['descarregamentos'];
    expect(rejeicoes(buildMdfe(cargaPropria({ descarregamentos: d }), opcoes()))).toEqual(['616']);
  });

  test('chaves das NF-e: validade, modelo, duplicidade e segundo código de barras (F29, F37, F41, F42)', () => {
    const r = buildMdfe(
      cargaPropria({
        descarregamentos: [
          {
            cMun: '3550308',
            xMun: 'SAO PAULO',
            nfe: [
              { chave: chaveDoc(1) },
              { chave: chaveDoc(1) },
              { chave: `${chaveDoc(2).slice(0, 43)}0` },
              { chave: chaveDoc(3, '57') },
              { chave: chaveDoc(4, '55', '5') },
              { chave: chaveDoc(6), segCodBarra: '1'.repeat(36) },
            ],
          },
        ],
      }),
      opcoes(),
    );
    expect(rejeicoes(r)).toEqual(expect.arrayContaining(['669', '604', '606', '607']));
    expect(rejeicoes(r).filter((c) => c === '604').length).toBe(2);
    const fsda = buildMdfe(
      cargaPropria({
        descarregamentos: [
          { cMun: '3550308', xMun: 'SAO PAULO', nfe: [{ chave: chaveDoc(4, '55', '5'), segCodBarra: '1'.repeat(36) }] },
        ],
      }),
      opcoes(),
    );
    expect(ok(fsda).infMDFe.infDoc.infMunDescarga[0]?.infNFe?.[0]?.SegCodBarra).toBe('1'.repeat(36));
  });

  test('duplicidade de chave: no MDF-e inteiro na operação interestadual, por município na interna', () => {
    const doisMunicipios = (ufFim: 'SP' | 'MT'): MdfeInput['descarregamentos'] => {
      const [a, b] = ufFim === 'SP' ? ['3550308', '3509502'] : ['5103403', '5108402'];
      return [
        { cMun: a, xMun: 'AAA', nfe: [{ chave: chaveDoc(1) }] },
        { cMun: b, xMun: 'BBB', nfe: [{ chave: chaveDoc(1) }] },
      ];
    };
    expect(rejeicoes(buildMdfe(cargaPropria({ descarregamentos: doisMunicipios('SP') }), opcoes()))).toEqual(['669']);
    ok(buildMdfe(cargaPropria({ ufFim: 'MT', percurso: [], descarregamentos: doisMunicipios('MT') }), opcoes()));
  });

  test('placa no formato nacional (F89), menos com o exterior', () => {
    const i = cargaPropria();
    const tracao = { ...i.rodoviario.tracao, placa: 'AB-12345' };
    expect(rejeicoes(buildMdfe(rodo(i, { tracao }), opcoes()))).toContain('646');
    const v = ok(buildMdfe(rodo(i, { tracao: { ...i.rodoviario.tracao, placa: 'abc-1d23' } }), opcoes()));
    expect(v.infMDFe.infModal.rodo?.veicTracao.placa).toBe('ABC1D23');
  });

  test('condutores (F99, F100)', () => {
    const i = cargaPropria();
    const c = { xNome: 'CONDUTOR SINTETICO', CPF: CPF_CONDUTOR };
    const dup = { ...i.rodoviario.tracao, condutores: [c, c] };
    expect(rejeicoes(buildMdfe(rodo(i, { tracao: dup }), opcoes()))).toEqual(['577']);
    const inval = { ...i.rodoviario.tracao, condutores: [{ ...c, CPF: '12345678900' }] };
    expect(rejeicoes(buildMdfe(rodo(i, { tracao: inval }), opcoes()))).toEqual(['645']);
  });

  test('valores com casas a mais são recusados, nunca arredondados', () => {
    const r = buildMdfe(cargaPropria({ totais: { vCarga: '10.001', cUnid: '01', qCarga: '1.00001' } }), opcoes());
    expect(codigos(r)).toEqual(['decimal_invalido', 'decimal_invalido']);
  });

  test('texto que o XML não representa e texto fora do schema', () => {
    const e = cargaPropria().emitente;
    expect(codigos(buildMdfe(cargaPropria({ emitente: { ...e, xNome: 'A\u0001B' } }), opcoes()))).toEqual([
      'campo_invalido',
    ]);
    expect(codigos(buildMdfe(cargaPropria({ emitente: { ...e, xNome: 'X'.repeat(61) } }), opcoes()))).toEqual([
      'schema',
    ]);
  });

  test('autorizados ao XML (F105 a F107) e responsável técnico (F121)', () => {
    const r = buildMdfe(
      cargaPropria({ autXML: [{ CNPJ: CNPJ_TERCEIRO }, { CNPJ: CNPJ_TERCEIRO }, { CPF: '1' }] }),
      opcoes(),
    );
    expect(rejeicoes(r)).toEqual(expect.arrayContaining(['459', '661']));
    const rt = { CNPJ: CNPJ_TERCEIRO, xContato: 'SUPORTE', email: 'suporte@exemplo.invalid', fone: '(65) 3000-0000' };
    const v = ok(buildMdfe(cargaPropria(), opcoes({ respTec: rt })));
    expect(v.infMDFe.infRespTec?.fone).toBe('6530000000');
    expect(rejeicoes(buildMdfe(cargaPropria({ respTec: { ...rt, CNPJ: '11111111111111' } }), opcoes()))).toContain(
      '713',
    );
  });
});

describe('buildMdfe: transportador prestando serviço (CNPJ)', () => {
  test('monta ANTT, pagamento, seguro e lotação no lugar certo', () => {
    const v = ok(buildMdfe(prestador(), opcoes()));
    const antt = v.infMDFe.infModal.rodo?.infANTT;
    expect(antt?.RNTRC).toBe('12345678');
    expect(antt?.infCIOT).toEqual([{ CIOT: '123456789012', CNPJ: CNPJ_EMIT }]);
    const pag = antt?.infPag?.[0];
    expect(pag?.vContrato).toBe('4250.50');
    expect(pag?.infPrazo?.map((p) => p.nParcela)).toEqual(['001', '002']);
    expect(v.infMDFe.prodPred?.infLotacao?.infLocalCarrega).toEqual({ CEP: '78000000' });
    expect(v.infMDFe.tot.qCTe).toBe('1');
    expect(v.infMDFe.tot.qCarga).toBe('25000.5000');
    expect(v.infMDFe.seg?.[0]?.nAver).toEqual(['AVERBACAO-1']);
  });

  test('tipo do transportador contra o proprietário (F18 a F20) e o contratante (F64, F65)', () => {
    const i = prestador();
    const prop = { CPF: CPF_CONDUTOR, RNTRC: '87654321', xNome: 'TAC SINTETICO', tpProp: '0' as const };
    const comProp = rodo(i, { tracao: { ...i.rodoviario.tracao, proprietario: prop } });
    expect(rejeicoes(buildMdfe({ ...comProp, tpTransp: '1' }, opcoes()))).toEqual(
      expect.arrayContaining(['743', '741']),
    );
    const certo = rodo({ ...comProp, tpTransp: '2' }, { contratantes: [{ CNPJ: CNPJ_EMIT }] });
    ok(buildMdfe(certo, opcoes()));
    const propCnpj = rodo(i, {
      tracao: { ...i.rodoviario.tracao, proprietario: { ...prop, CPF: undefined, CNPJ: CNPJ_TERCEIRO } as never },
    });
    expect(rejeicoes(buildMdfe(propCnpj, opcoes()))).toContain('744');
    expect(rejeicoes(buildMdfe({ ...i, tpTransp: '1' }, opcoes()))).toEqual(['745']);
    const propEmit = rodo(i, {
      tracao: { ...i.rodoviario.tracao, proprietario: { ...prop, CPF: undefined, CNPJ: CNPJ_EMIT } as never },
    });
    expect(rejeicoes(buildMdfe({ ...propEmit, tpTransp: '1' }, opcoes()))).toContain('740');
  });

  test('contratante repetido (F66)', () => {
    const i = prestador();
    const c = { CNPJ: CNPJ_TERCEIRO };
    expect(rejeicoes(buildMdfe(rodo(i, { contratantes: [c, c] }), opcoes()))).toEqual(['742']);
  });

  test('regras do pagamento do frete (F52, F53, F56 a F63)', () => {
    const r = (p: PagamentoFrete): string[] => rejeicoes(buildMdfe(rodo(prestador(), { pagamentos: [p] }), opcoes()));
    expect(r(pagamento({ vContrato: '4000.00' }))).toContain('746');
    expect(r(pagamento({ vContrato: '4250.51' }))).toEqual([]);
    expect(r(pagamento({ parcelas: [] }))).toContain('724');
    expect(r(sem(pagamento({ indPag: '0' }), 'vAdiant'))).toEqual(['729']);
    expect(r(pagamento({ indPag: '0', parcelas: [] }))).toEqual(['739']);
    expect(r(pagamento({ parcelas: [{ dVenc: '2026-09-25', vParcela: '3250.50' }] }))).toEqual(['736']);
    expect(
      r(
        pagamento({
          parcelas: [
            { dVenc: '2026-11-10', vParcela: '1625.25' },
            { dVenc: '2026-10-10', vParcela: '1625.25' },
          ],
        }),
      ),
    ).toEqual(['737']);
    expect(r(pagamento({ vAdiant: '999.00' }))).toEqual(['738']);
    expect(r(pagamento({ banco: { CNPJIPEF: '11222333000100' } }))).toEqual(['728']);
    expect(r({ ...pagamento(), CNPJ: '11222333000100' } as PagamentoFrete)).toEqual(['727']);
  });

  test('prestação exige contratante ou responsável, CIOT e produto predominante (F94, NT 2026.001, F54 a F55b)', () => {
    const i = prestador();
    expect(rejeicoes(buildMdfe(rodo(i, { ciot: [], contratantes: [] }), opcoes()))).toEqual(
      expect.arrayContaining(['578', '684']),
    );
    expect(rejeicoes(buildMdfe(sem(i, 'produtoPredominante'), opcoes()))).toEqual(['725']);
    const pp = i.produtoPredominante as NonNullable<MdfeInput['produtoPredominante']>;
    expect(rejeicoes(buildMdfe({ ...i, produtoPredominante: sem(pp, 'lotacao') }, opcoes()))).toEqual(['726']);
    expect(rejeicoes(buildMdfe({ ...i, produtoPredominante: sem(pp, 'NCM') }, opcoes()))).toEqual(['301']);
    expect(rejeicoes(buildMdfe(rodo(i, { pagamentos: [] }), opcoes()))).toEqual(['302']);
    // Com dois DF-e não é carga lotação: sem infLotacao, NCM e pagamento obrigatórios.
    const dois = [
      { cMun: '5208707', xMun: 'GOIANIA', cte: [{ chave: chaveDoc(7, '57') }, { chave: chaveDoc(8, '57') }] },
    ];
    ok(
      buildMdfe(
        rodo({ ...i, descarregamentos: dois, produtoPredominante: sem(pp, 'lotacao') }, { pagamentos: [] }),
        opcoes(),
      ),
    );
  });

  test('CIOT só a partir da vigência da NT 2026.001, por ambiente', () => {
    // Pagamento à vista, para que as datas das parcelas não pesem na comparação entre datas de emissão.
    const semCiot = rodo(prestador(), {
      ciot: [],
      pagamentos: [sem(pagamento({ indPag: '0', parcelas: [] }), 'vAdiant')],
    });
    expect(rejeicoes(buildMdfe(semCiot, opcoes({}, '2026-09-20T10:00:00-04:00')))).toEqual([]);
    expect(rejeicoes(buildMdfe(semCiot, opcoes({}, '2026-09-21T10:00:00-04:00')))).toEqual(['684']);
    const prod = (at: string): BuildMdfeResult => buildMdfe(semCiot, { ...opcoes({}, at), ambiente: 'producao' });
    expect(rejeicoes(prod('2026-11-22T10:00:00-04:00'))).toEqual([]);
    expect(rejeicoes(prod('2026-11-23T10:00:00-04:00'))).toEqual(['684']);
  });

  test('carga própria com transportador contratado (tpEmit 2 com tpTransp) também é prestação', () => {
    const i = cargaPropria();
    const prop = { CPF: CPF_CONDUTOR, RNTRC: '87654321', xNome: 'TAC SINTETICO', tpProp: '1' as const };
    const r = buildMdfe(
      rodo({ ...i, tpTransp: '2' }, { tracao: { ...i.rodoviario.tracao, proprietario: prop } }),
      opcoes(),
    );
    expect(rejeicoes(r)).toEqual(expect.arrayContaining(['684', '741']));
  });

  test('seguro obrigatório para o prestador (F91 a F93)', () => {
    const i = prestador();
    expect(rejeicoes(buildMdfe({ ...i, seguros: [] }, opcoes()))).toEqual(['698']);
    expect(rejeicoes(buildMdfe({ ...i, seguros: [{ responsavel: { respSeg: '2' } }] }, opcoes()))).toEqual([
      '699',
      '542',
    ]);
  });

  test('vale-pedágio (F95, F96, F98) e RNTRC (F108)', () => {
    const i = prestador();
    const disp = { CNPJForn: '11222333000100', responsavel: { CPF: '1' }, vValePed: '10' };
    const r = buildMdfe(rodo(i, { valePedagio: { dispositivos: [disp] } }), opcoes());
    expect(rejeicoes(r)).toEqual(expect.arrayContaining(['731', '732', '734']));
    const v = ok(
      buildMdfe(
        rodo(i, {
          valePedagio: {
            dispositivos: [
              { CNPJForn: CNPJ_TERCEIRO, responsavel: { CNPJ: CNPJ_EMIT }, vValePed: '10', tpValePed: '01' },
            ],
            categCombVeic: '07',
          },
        }),
        opcoes(),
      ),
    );
    expect(v.infMDFe.infModal.rodo?.infANTT?.valePed?.disp[0]).toEqual({
      CNPJForn: CNPJ_TERCEIRO,
      CNPJPg: CNPJ_EMIT,
      vValePed: '10.00',
      tpValePed: '01',
    });
    expect(rejeicoes(buildMdfe({ ...i, rodoviario: sem(i.rodoviario, 'RNTRC') }, opcoes()))).toEqual(['688']);
  });
});

describe('QR Code, assinatura e contingência', () => {
  const certs = (async () => {
    const clock = fixedClock(EMISSAO);
    const ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
    return syntheticCertificate({ clock, role: 'titular', cpf: CPF_EMIT, issuer: ac });
  })();

  test('qrCodeMdfe segue o item 9.2 da Visão Geral', () => {
    expect(qrCodeMdfe('5'.repeat(44), '2')).toBe(
      `https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${'5'.repeat(44)}&tpAmb=2`,
    );
    expect(qrCodeMdfe('5'.repeat(44), '1', 'abc=')).toEndWith('&tpAmb=1&sign=abc=');
  });

  test('signMdfe: infMDFeSupl antes da Signature, string final válida no schema e assinatura conferível', async () => {
    const cert = await certs;
    const v = ok(buildMdfe(cargaPropria(), opcoes()));
    const xml = await signMdfe(v, cert.signer);
    expect(xml.startsWith(v.xml.slice(0, -'</MDFe>'.length))).toBe(true);
    expect(xml).toContain(
      `<infMDFeSupl><qrCodMDFe>https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${v.chave}&amp;tpAmb=2</qrCodMDFe></infMDFeSupl><Signature`,
    );
    expect(validateRoot(MDFeElement, parseXml(xml))).toEqual([]);
    expect((await verifySignature(xml, { id: v.id, element: 'infMDFe' })).ok).toBe(true);
  });

  test('contingência off-line: tpEmis 2 na chave, mesmo cMDF, sign no QR Code e prazo de 168 horas', async () => {
    const cert = await certs;
    const normal = ok(buildMdfe(cargaPropria(), opcoes()));
    const cont = ok(buildMdfe(cargaPropria({ cMDF: normal.cMDF }), opcoes({ tpEmis: '2' })));
    expect(cont.chave.slice(0, 34)).toBe(normal.chave.slice(0, 34));
    expect(cont.chave.slice(34, 35)).toBe('2');
    expect(cont.chave.slice(35, 43)).toBe(normal.cMDF);
    expect(() => comQrCode(cont)).toThrow('F117');
    expect(() => comQrCode(normal, 'x')).toThrow('F118');
    const xml = await signMdfe(cont, cert.signer);
    expect(xml).toMatch(/&amp;tpAmb=2&amp;sign=[A-Za-z0-9+/=]+<\/qrCodMDFe>/);
    expect(validateRoot(MDFeElement, parseXml(xml))).toEqual([]);
    const limite = prazoContingencia(timeContext({ emissao: fixedClock(EMISSAO) }).emissao.now());
    expect(limite.getTime() - fixedClock(EMISSAO).now().getTime()).toBe(168 * 3_600_000);
  });

  test('tpEmis fora de 1 e 2 é recusado', () => {
    const r = buildMdfe(cargaPropria(), opcoes({ tpEmis: '3' as never }));
    expect(codigos(r)).toEqual(['contingencia_invalida']);
  });
});
