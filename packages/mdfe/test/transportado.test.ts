/**
 * MDF-e transportado (`infMDFeTransp`) no modal aquaviário: entrada `descarregamentos[].mdfe`, `qMDFe` derivado e as
 * regras F43, F44, F45 e F45a do Anexo I no montador.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import { montarChaveAcesso } from '@sinete/validators';
import type {
  Aquaviario,
  DadosMdfe,
  DadosMdfeAquaviario,
  DadosMdfeFerroviario,
  DadosMdfeRodoviario,
  MdfeTransportado,
  ResultadoMontagemMdfe,
} from '../src/index.ts';
import { CODIGOS_OCORRENCIA_MDFE, montarMdfe, rotuloDoCaminho } from '../src/index.ts';
import { CNPJ_EMIT, chaveDoc, opcoes, prestador } from './helpers/mdfe.ts';

const NAVIO: Aquaviario = {
  irin: 'PPXX123',
  tpEmb: '01',
  cEmbar: 'EMB01',
  xEmbar: 'NAVIO SINTETICO',
  nViag: '123',
  cPrtEmb: 'MAO',
  cPrtDest: 'MCP',
  tpNav: '0',
};

const ref = (nNF: number, aamm = '2609'): string =>
  montarChaveAcesso({
    cUF: '13',
    aamm,
    emitente: CNPJ_EMIT,
    mod: '58',
    serie: 1,
    nNF,
    tpEmis: '1',
    cNF: String(10_000_000 + nNF),
  });
const REF = ref(99);

/** Aquaviário de AM para AP, com um CT-e e os MDF-e transportados no único descarregamento. */
function amap(mdfe: readonly MdfeTransportado[], extra: Partial<DadosMdfeAquaviario> = {}): DadosMdfeAquaviario {
  const { rodoviario: _, ...comuns } = prestador();
  return {
    ...comuns,
    aquaviario: NAVIO,
    ufIni: 'AM',
    ufFim: 'AP',
    carregamento: [{ cMun: '1302603', xMun: 'MANAUS' }],
    descarregamentos: [{ cMun: '1600303', xMun: 'MACAPA', cte: [{ chave: chaveDoc(7, '57') }], mdfe }],
    ...extra,
  };
}

function xml(r: ResultadoMontagemMdfe): string {
  if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho} ${i.code}: ${i.mensagem}`).join('\n'));
  return r.valor.xml;
}

function falha(r: ResultadoMontagemMdfe): readonly Ocorrencia[] {
  if (r.ok) throw new Error('esperava ocorrências');
  return r.ocorrencias;
}

const regra = (o: readonly Ocorrencia[], cStat: string): Ocorrencia | undefined =>
  o.find((i) => i.mensagem.endsWith(`rejeição ${cStat})`));

describe('montarMdfe: MDF-e transportado', () => {
  test('monta infMDFeTransp depois do infCTe, na ordem do leiaute, e qMDFe entre qCTe e vCarga', async () => {
    const x = xml(
      await montarMdfe(
        amap([
          {
            chave: REF,
            indReentrega: true,
            unidadesTransporte: [{ tpUnidTransp: '1', idUnidTransp: 'ABC1D23' }],
            perigosos: [{ nONU: '1203', qTotProd: '100 L' }],
          },
        ]),
        opcoes(),
      ),
    );
    expect(x).toContain(
      `</infCTe><infMDFeTransp><chMDFe>${REF}</chMDFe><indReentrega>1</indReentrega><infUnidTransp><tpUnidTransp>1</tpUnidTransp><idUnidTransp>ABC1D23</idUnidTransp></infUnidTransp><peri><nONU>1203</nONU><qTotProd>100 L</qTotProd></peri></infMDFeTransp>`,
    );
    expect(x).toMatch(/<qCTe>1<\/qCTe><qMDFe>1<\/qMDFe><vCarga>/);
  });

  test('município só com MDF-e transportado não é F26; qMDFe conta todos', async () => {
    const e = amap([{ chave: REF }], {
      descarregamentos: [
        { cMun: '1600303', xMun: 'MACAPA', cte: [{ chave: chaveDoc(7, '57') }], mdfe: [{ chave: REF }] },
        { cMun: '1600600', xMun: 'SANTANA', mdfe: [{ chave: ref(98) }] },
      ],
    });
    const x = xml(await montarMdfe(e, opcoes()));
    expect(x).toContain('<qMDFe>2</qMDFe>');
    expect(x).not.toContain('<qNFe>');
    expect(x).toContain(`<cMunDescarga>1600600</cMunDescarga><xMunDescarga>SANTANA</xMunDescarga><infMDFeTransp>`);
  });

  test('sem MDF-e transportado, nada muda', async () => {
    const x = xml(await montarMdfe(amap([]), opcoes()));
    expect(x).not.toContain('infMDFeTransp');
    expect(x).not.toContain('qMDFe');
  });

  test('F43 (647): fora do aquaviário, mesmo vindo sem tipos', async () => {
    const base = prestador();
    const e = {
      ...base,
      descarregamentos: base.descarregamentos.map((d) => ({ ...d, mdfe: [{ chave: REF }] })),
    } as unknown as DadosMdfe;
    const o = falha(await montarMdfe(e, opcoes()));
    expect(regra(o, '647')?.caminho).toBe('descarregamentos[0].mdfe[0]');
    // Com carregamento posterior, o MDF-e transportado também é documento que não pode vir (F27, 706).
    const d0 = { cMun: '5103403', xMun: 'CUIABA', mdfe: [{ chave: REF }] };
    const posterior = {
      ...base,
      tpEmit: '2',
      ufFim: 'MT',
      indCarregaPosterior: true,
      descarregamentos: [d0],
    } as unknown as DadosMdfe;
    expect(regra(falha(await montarMdfe(posterior, opcoes())), '706')?.caminho).toBe('descarregamentos');
  });

  test('F44 (648): basta uma das pontas em AM ou AP', async () => {
    const mtgo = amap([{ chave: REF }], {
      ufIni: 'MT',
      ufFim: 'GO',
      carregamento: [{ cMun: '5103403', xMun: 'CUIABA' }],
      descarregamentos: [
        { cMun: '5208707', xMun: 'GOIANIA', cte: [{ chave: chaveDoc(7, '57') }], mdfe: [{ chave: REF }] },
      ],
    });
    expect(regra(falha(await montarMdfe(mtgo, opcoes())), '648')?.caminho).toBe('descarregamentos[0].mdfe[0]');
    const mtap = amap([{ chave: REF }], { ufIni: 'MT', carregamento: [{ cMun: '5103403', xMun: 'CUIABA' }] });
    expect(xml(await montarMdfe(mtap, opcoes()))).toContain(`<chMDFe>${REF}</chMDFe>`);
  });

  test('F45 (649): DV errado ou chave de outro modelo; F45a (520): chave antiga', async () => {
    const dv = `${REF.slice(0, 43)}${(Number(REF[43]) + 1) % 10}`;
    const o = falha(await montarMdfe(amap([{ chave: dv }]), opcoes()));
    const r = regra(o, '649');
    expect(r).toMatchObject({ caminho: 'descarregamentos[0].mdfe[0].chave', origem: 'entrada' });
    expect(CODIGOS_OCORRENCIA_MDFE).toContain(r?.code as never);
    const nfe = regra(falha(await montarMdfe(amap([{ chave: chaveDoc(5, '55') }]), opcoes())), '649');
    expect(nfe?.mensagem).toContain('modelo 55 diferente de 58');
    expect(regra(falha(await montarMdfe(amap([{ chave: ref(99, '2601') }]), opcoes())), '520')?.caminho).toBe(
      'descarregamentos[0].mdfe[0].chave',
    );
  });

  test('a mesma chave em dois municípios não é recusada pelo montador', async () => {
    const e = amap([{ chave: REF }], {
      descarregamentos: [
        { cMun: '1600303', xMun: 'MACAPA', mdfe: [{ chave: REF }] },
        { cMun: '1600600', xMun: 'SANTANA', mdfe: [{ chave: REF }] },
      ],
    });
    expect(xml(await montarMdfe(e, opcoes()))).toContain('<qMDFe>2</qMDFe>');
  });

  test('texto do perigoso do MDF-e transportado é conferido na entrada', async () => {
    const o = falha(
      await montarMdfe(amap([{ chave: REF, perigosos: [{ nONU: '1203', qTotProd: ' 100 L' }] }]), opcoes()),
    );
    expect(o).toEqual([
      {
        caminho: 'descarregamentos[0].mdfe[0].perigosos[0].qTotProd',
        code: 'campo_invalido',
        mensagem: 'sem espaço no começo nem no fim',
        origem: 'entrada',
      },
    ]);
  });

  test('só o aquaviário aceita mdfe no tipo', () => {
    const d = { cMun: '1600303', xMun: 'MACAPA', mdfe: [{ chave: REF }] };
    const a: DadosMdfeAquaviario['descarregamentos'] = [d];
    // @ts-expect-error o descarregamento do rodoviário não tem mdfe
    const r: DadosMdfeRodoviario['descarregamentos'] = [{ cMun: '1', xMun: 'X', mdfe: [{ chave: REF }] }];
    // @ts-expect-error o descarregamento do ferroviário não tem mdfe
    const f: DadosMdfeFerroviario['descarregamentos'] = [{ cMun: '1', xMun: 'X', mdfe: [{ chave: REF }] }];
    expect([a, r, f]).toHaveLength(3);
  });

  test('rótulos dos caminhos do MDF-e transportado', () => {
    expect(rotuloDoCaminho('descarregamentos[0].mdfe[0].chave')).toBe(
      'Documento 1 do descarregamento 1, Chave de acesso',
    );
    expect(rotuloDoCaminho('descarregamentos[1].mdfe[2].chave')).toBe(
      'Documento 3 do descarregamento 2, Chave de acesso',
    );
    expect(rotuloDoCaminho('descarregamentos[0].mdfe[0].perigosos[0].nONU')).toBe(
      'Documento 1 do descarregamento 1, Número ONU',
    );
    expect(rotuloDoCaminho('/infMDFe/infDoc/infMunDescarga[1]/infMDFeTransp[2]/chMDFe')).toBe(
      'Documento 2 do descarregamento 1, Chave de acesso',
    );
    expect(rotuloDoCaminho('descarregamentos[0].mdfe[0].unidadesTransporte[0].idUnidTransp')).toBe(
      'Documento 1 do descarregamento 1, Identificação da unidade de transporte',
    );
  });
});
