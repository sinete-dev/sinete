import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao } from '@sinete/core';
import pkg from '../package.json' with { type: 'json' };
import { DATASET_EMBARCADO, datasetEmbarcado } from '../src/bundled.ts';
import type { BundleDoDataset, NomeDaTabela, RegistroAplicabilidade } from '../src/index.ts';
import {
  aplicabilidade,
  carregarDataset,
  conferirDataset,
  DESLOCAMENTO_BRASILIA_MIN,
  dataCivil,
  ErroDadosIbsCbs,
  ehDataIso,
  exigirDataIso,
  jsonCanonico,
  NOMES_DAS_TABELAS,
  tabelaCanonica,
  VERSAO_DO_FORMATO_DOS_DADOS,
  versaoDoConteudo,
  vigente,
} from '../src/index.ts';

const ds = datasetEmbarcado();

function clone(b: BundleDoDataset): BundleDoDataset {
  return JSON.parse(JSON.stringify(b)) as BundleDoDataset;
}

describe('pacote e manifest', () => {
  test('versão do pacote segue AAAA.M.patch do mês dos dados', () => {
    const [y, m] = ds.manifesto.versaoDosDados.split('.').map(Number);
    const [py, pm] = pkg.version.split('.').map(Number);
    expect([py, pm]).toEqual([y, m]);
  });

  test('manifest cita as fontes oficiais fixadas por hash', () => {
    const m = ds.manifesto;
    expect(m.versaoDoFormato).toBe(VERSAO_DO_FORMATO_DOS_DADOS);
    expect(m.fontes.map((s) => s.tipo)).toContain('CALCULADORA_OFFLINE');
    for (const s of m.fontes) {
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(s.url).toMatch(/^https:\/\//);
    }
    expect(m.tabelas.map((t) => t.nome)).toEqual([...NOMES_DAS_TABELAS]);
    expect(m.conhecidoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ds.versaoDoConteudo).toBe(versaoDoConteudo(m));
    expect(ds.versaoDoConteudo).toMatch(/^2026\.09\+V0057\+v1\.60\+v1\.60#[0-9a-f]{12}$/);
  });

  test('datasetEmbarcado carrega uma vez', () => {
    expect(datasetEmbarcado()).toBe(ds);
  });

  test('conferirDataset confere tabelas e hash total', async () => {
    await conferirDataset(DATASET_EMBARCADO);
    const bad = clone(DATASET_EMBARCADO);
    (bad.tabelas.cst[0] as { descricao: string }).descricao = 'adulterado';
    await expect(conferirDataset(bad)).rejects.toThrow(ErroDadosIbsCbs);
    const badTotal = clone(DATASET_EMBARCADO);
    (badTotal.manifesto as { sha256DoDataset: string }).sha256DoDataset = '0'.repeat(64);
    await expect(conferirDataset(badTotal)).rejects.toThrow(/sha256DoDataset/);
    const missing = clone(DATASET_EMBARCADO);
    (missing.manifesto.tabelas as unknown as { nome: string }[]).push({ nome: 'inexistente' });
    await expect(conferirDataset(missing)).rejects.toThrow(/exatamente uma vez/);
    // Tabela fora do manifest não escapa da conferência, mesmo com o hash total recalculado.
    const uncovered = clone(DATASET_EMBARCADO);
    (uncovered.manifesto as unknown as { tabelas: unknown[] }).tabelas = uncovered.manifesto.tabelas.filter(
      (t) => t.nome !== 'redutorCompraGov',
    );
    await expect(conferirDataset(uncovered)).rejects.toThrow(/exatamente uma vez/);
    const duplicated = clone(DATASET_EMBARCADO);
    (duplicated.manifesto as unknown as { tabelas: unknown[] }).tabelas = [
      ...duplicated.manifesto.tabelas,
      duplicated.manifesto.tabelas[0],
    ];
    await expect(conferirDataset(duplicated)).rejects.toThrow(/exatamente uma vez/);
  });

  test('carregarDataset recusa bundle inválido ou de outro formato', () => {
    const err = (b: unknown): ErroDadosIbsCbs => {
      try {
        carregarDataset(b as BundleDoDataset);
      } catch (e) {
        return e as ErroDadosIbsCbs;
      }
      throw new Error('não lançou');
    };
    expect(err(null).code).toBe('ibscbs_dados_invalidos');
    expect(err({ manifesto: {}, tabelas: {} }).message).toMatch(/versaoDoFormato/);
    const future = clone(DATASET_EMBARCADO);
    (future.manifesto as { versaoDoFormato: number }).versaoDoFormato = 99;
    expect(err(future).code).toBe('ibscbs_dados_versao_incompativel');
    const noTable = clone(DATASET_EMBARCADO);
    delete (noTable.tabelas as Partial<Record<NomeDaTabela, unknown>>).cst;
    expect(err(noTable).message).toMatch(/tabela cst/);
    const dangling = clone(DATASET_EMBARCADO);
    (dangling.tabelas.aplicabilidadeNcm[0] as { chaveClassTrib: string }).chaveClassTrib = 'CBS_IBS:000000:2026-01-01';
    expect(err(dangling).message).toMatch(/inexistente/);
  });
});

describe('visão por data de fato gerador', () => {
  const c = ds.em('2026-09-25');

  test('CST, cClassTrib e tratamento vigentes', () => {
    expect(c.dataDeReferencia).toBe('2026-09-25');
    expect(ds.em('2026-09-25')).toBe(c);
    expect(c.dataset).toBe(ds);
    const ct = c.classTrib('200034');
    expect(ct?.cst).toBe('200');
    expect(c.cstDe(ct as NonNullable<typeof ct>)?.grupos.gRed).toBe('obrigatorio');
    expect(c.cst('000')?.grupos.gIBSCBS).toBe('obrigatorio');
    expect(c.cst('000', 'IS')).toBeUndefined();
    expect(c.classTrib('999999')).toBeUndefined();
    expect(c.tratamento(ct as NonNullable<typeof ct>)?.expressao.tributoCalculado).toBe('baseCalculo*aliquotaEfetiva');
    expect(c.reducao(ct as NonNullable<typeof ct>, 'CBS')).toBe('60');
    expect(c.aliquotaFixa(ct as NonNullable<typeof ct>, 'CBS')).toBeUndefined();
    expect(c.permitidoEm(ct as NonNullable<typeof ct>, 55)).toBe(true);
    // 220001 só vigorou em 01/01/2026
    expect(ds.em('2026-01-01').classTrib('220001')).toBeDefined();
    expect(c.classTrib('220001')).toBeUndefined();
  });

  test('filtros de classTribs', () => {
    const all = c.classTribs();
    expect(all.length).toBeGreaterThan(150);
    expect(c.classTribs({ cst: '410' }).every((x) => x.cst === '410')).toBe(true);
    expect(c.classTribs({ modelo: 65 }).every((x) => c.permitidoEm(x, 65))).toBe(true);
    expect(c.classTribs({ familia: 'IS' }).every((x) => x.familia === 'IS')).toBe(true);
  });

  test('crédito presumido, atores, NFS-e, anexos, DF-e e compras governamentais', () => {
    expect(c.credPres(1)).toMatchObject({ cbs: false, ibs: false });
    expect(ds.em('2027-01-01').credPres(1)).toMatchObject({ cbs: true, ibs: true });
    expect(ds.em('2027-01-01').credPres(3)).toMatchObject({ cbs: true, ibs: false });
    expect(c.credPres(99)).toBeUndefined();
    expect(c.ator(1)?.descricao).toBe('Praça de Pedágio');
    expect(c.ator(9999)).toBeUndefined();
    const nbs = ds.tabelas.nfseNbs[0];
    if (!nbs) throw new Error('sem nfseNbs');
    expect(c.nfseNbs(nbs.nbs).length).toBeGreaterThan(0);
    expect(c.nfseNbs('000000000')).toEqual([]);
    const annex = ds.tabelas.anexos.find((a) => a.item !== null);
    if (!annex) throw new Error('sem anexo');
    expect(c.anexo(`${annex.anexo}/${annex.item}`)?.anexo).toBe(annex.anexo);
    expect(c.anexo('ZZ/99')).toBeUndefined();
    expect(c.tipoDfe(55)?.sigla).toBe('NF-e');
    expect(c.tipoDfe(1)).toBeUndefined();
    expect(c.redutorCompraGov()).toBe('0');
    expect(c.percentualTransferenciaCbs()).toBe('0');
    expect(ds.em('2033-06-01').percentualTransferenciaCbs()).toBe('100');
  });

  test('porAtores: código sem vínculo de ator admite qualquer ator', () => {
    const everyone = c.porAtores({});
    expect(everyone.length).toBe(c.classTribs().length);
    const nfe = c.porAtores({ modelo: 55 });
    expect(nfe.length).toBe(c.classTribs({ modelo: 55 }).length);
    const narrowed = c.porAtores({ fornecedor: 14, adquirente: 22, modelo: 55 });
    expect(narrowed.length).toBeLessThan(nfe.length);
    expect(narrowed).toContain('410014');
  });

  test('data inválida é ErroDeConfiguracao', () => {
    expect(() => ds.em('2026-02-30')).toThrow(ErroDeConfiguracao);
  });
});

describe('aplicabilidade de NCM e NBS', () => {
  const v = { inicio: '2026-01-01', fim: null };
  const link = (prefix: string, exceptions: RegistroAplicabilidade['excecoes'] = []): RegistroAplicabilidade => ({
    chave: prefix,
    chaveClassTrib: 'CBS_IBS:200003:2026-01-01',
    familia: 'CBS_IBS',
    cClassTrib: '200003',
    prefixo: prefix,
    itemDoAnexo: 'I/1',
    vigencia: v,
    excecoes: exceptions,
  });

  test('tabela-verdade da Calculadora', () => {
    expect(aplicabilidade([], '10063021', '2026-05-01', 8).resultado).toBe('sem-restricao');
    expect(aplicabilidade([link('1006')], '1006', '2026-05-01', 8).resultado).toBe('incompleta');
    expect(aplicabilidade([link('1006')], '10063O21', '2026-05-01', 8).resultado).toBe('incompleta');
    expect(aplicabilidade([link('1006')], '12019000', '2026-05-01', 8).resultado).toBe('nao');
    const yes = aplicabilidade([link('1006')], '10063021', '2026-05-01', 8);
    expect(yes.resultado).toBe('sim');
    expect(yes.casou.map((m) => m.prefixo)).toEqual(['1006']);
    const excl = aplicabilidade([link('1006', [{ prefixo: '100630', vigencia: v }])], '10063021', '2026-05-01', 8);
    expect(excl).toMatchObject({ resultado: 'nao', excluidoPor: ['100630'] });
    // exceção fora de vigência não exclui
    const old = { inicio: '2026-01-01', fim: '2026-03-31' };
    expect(
      aplicabilidade([link('1006', [{ prefixo: '100630', vigencia: old }])], '10063021', '2026-05-01', 8).resultado,
    ).toBe('sim');
    // vínculo "limpo" duplicado (LEFT JOIN): a exceção de um vínculo não derruba o outro
    expect(
      aplicabilidade([link('1006', [{ prefixo: '100630', vigencia: v }]), link('1006')], '10063021', '2026-05-01', 8)
        .resultado,
    ).toBe('sim');
    // vínculo fora de vigência na data
    expect(aplicabilidade([{ ...link('1006'), vigencia: old }], '10063021', '2026-05-01', 8).resultado).toBe(
      'sem-restricao',
    );
  });

  test('pela visão do dataset', () => {
    const c = ds.em('2026-09-25');
    const arroz = c.classTrib('200003');
    const livre = c.classTrib('000001');
    if (!arroz || !livre) throw new Error('dataset incompleto');
    expect(c.ncmAplicavel(arroz, '10063021').resultado).toBe('sim');
    expect(c.ncmAplicavel(arroz, '12019000').resultado).toBe('nao');
    expect(c.ncmAplicavel(livre, '84713012').resultado).toBe('sem-restricao');
    expect(c.nbsAplicavel(livre, '123012100').resultado).toBe('sem-restricao');
  });
});

describe('datas e serialização canônica', () => {
  test('datas civis', () => {
    expect(ehDataIso('2028-02-29')).toBe(true);
    expect(ehDataIso('2027-02-29')).toBe(false);
    expect(ehDataIso('2100-02-29')).toBe(false);
    expect(ehDataIso('2000-02-29')).toBe(true);
    expect(ehDataIso('2026-13-01')).toBe(false);
    expect(ehDataIso('2026-1-01')).toBe(false);
    expect(ehDataIso(20260101)).toBe(false);
    expect(exigirDataIso('2026-01-01')).toBe('2026-01-01');
    expect(() => exigirDataIso('x', 'data de teste')).toThrow(/data de teste/);
    expect(vigente({ inicio: '2026-01-01', fim: '2026-12-31' }, '2026-12-31')).toBe(true);
    expect(vigente({ inicio: '2026-01-01', fim: '2026-12-31' }, '2027-01-01')).toBe(false);
    expect(vigente({ inicio: '2026-01-01', fim: null }, '2099-01-01')).toBe(true);
  });

  test('data civil do instante no fuso do local', () => {
    const instant = new globalThis.Date('2027-01-01T02:30:00Z');
    expect(DESLOCAMENTO_BRASILIA_MIN).toBe(-180);
    expect(dataCivil(instant)).toBe('2026-12-31');
    expect(dataCivil(instant, 0)).toBe('2027-01-01');
    expect(dataCivil(instant, -300)).toBe('2026-12-31');
  });

  test('JSON canônico com chaves ordenadas', () => {
    expect(tabelaCanonica([])).toBe('[]\n');
    expect(tabelaCanonica([{ b: 1, a: { d: 2, c: undefined } }])).toBe('[\n{"a":{"d":2},"b":1}\n]\n');
    expect(jsonCanonico({ b: [2, 1], a: 'x' })).toBe('{\n  "a": "x",\n  "b": [\n    2,\n    1\n  ]\n}\n');
  });
});
