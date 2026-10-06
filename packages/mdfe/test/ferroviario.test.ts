/**
 * MDF-e do modal ferroviário (MOC 3.00b, Anexo I, 3.3): montagem, limites do leiaute, regras que dependem do modal e o
 * `@sinete/sefaz-sim` em processo.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import { contextoDeTempo, relogioManual } from '@sinete/core';
import type { CertificadoSintetico } from '@sinete/sefaz-sim';
import {
  certificadoSintetico,
  criarSefazSim,
  redirecionarParaSim,
  transporteSim,
  URL_BASE_SIM,
} from '@sinete/sefaz-sim';
import type {
  DadosMdfe,
  DadosMdfeFerroviario,
  DadosMdfeRodoviario,
  Ferroviario,
  MdfeMontado,
  ResultadoMontagemMdfe,
  Vagao,
} from '../src/index.ts';
import { assinarMdfe, criarClienteMdfe, montarMdfe, rotuloDoCaminho } from '../src/index.ts';
import { CNPJ_EMIT, CPF_CONDUTOR, CPF_EMIT, cargaPropria, EMISSAO, opcoes, prestador } from './helpers/mdfe.ts';

const VAGAO: Vagao = {
  pesoBC: '60.5',
  pesoR: '62.125',
  tpVag: 'HFE',
  serie: 'ABC',
  nVag: '1234567',
  nSeq: '1',
  TU: '55.25',
};
const TREM: Ferroviario = {
  trem: { xPref: 'ABC1234', dhTrem: new Date('2026-09-26T08:00:00-04:00'), xOri: 'CGB', xDest: 'SAN' },
  vagoes: [VAGAO],
};

function ferroviario(base: DadosMdfeRodoviario, ferrov: Ferroviario = TREM): DadosMdfeFerroviario {
  const { rodoviario: _, ...comuns } = base;
  return { ...comuns, ferroviario: ferrov };
}

function ok(r: ResultadoMontagemMdfe): MdfeMontado {
  if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho} ${i.code}: ${i.mensagem}`).join('\n'));
  return r.valor;
}

function rejeicoes(r: ResultadoMontagemMdfe): string[] {
  return r.ok ? [] : r.ocorrencias.flatMap((i) => /rejeição (\d{3,4})\)$/.exec(i.mensagem)?.[1] ?? []);
}

describe('montarMdfe: modal ferroviário', () => {
  test('monta modal 4 com trem e vagões, pesos em três casas e qVag pela contagem', async () => {
    const m = ok(await montarMdfe(ferroviario(prestador()), opcoes()));
    expect(m.infMDFe.ide.modal).toBe('4');
    expect(m.xml).toContain(
      '<infModal versaoModal="3.00"><ferrov><trem><xPref>ABC1234</xPref><dhTrem>2026-09-26T08:00:00-04:00</dhTrem>' +
        '<xOri>CGB</xOri><xDest>SAN</xDest><qVag>1</qVag></trem><vag><pesoBC>60.500</pesoBC><pesoR>62.125</pesoR>' +
        '<tpVag>HFE</tpVag><serie>ABC</serie><nVag>1234567</nVag><nSeq>1</nSeq><TU>55.250</TU></vag></ferrov></infModal>',
    );
    expect(m.xml).not.toContain('<rodo>');
    const dois = ok(await montarMdfe(ferroviario(prestador(), { ...TREM, vagoes: [VAGAO, VAGAO] }), opcoes()));
    expect(dois.xml).toContain('<qVag>2</qVag>');
  });

  test('peso abaixo de uma tonelada sai no padrão do TDec_0303: 0, duas casas, e três casas só a partir de 1', async () => {
    const xml = async (pesoBC: string, pesoR: string) =>
      ok(await montarMdfe(ferroviario(prestador(), { ...TREM, vagoes: [{ ...VAGAO, pesoBC, pesoR }] }), opcoes())).xml;
    expect(await xml('0', '0.5')).toContain('<pesoBC>0</pesoBC><pesoR>0.50</pesoR>');
    expect(await xml('0.000', '1')).toContain('<pesoBC>0</pesoBC><pesoR>1.000</pesoR>');
    expect(await xml('0.25', '999.999')).toContain('<pesoBC>0.25</pesoBC><pesoR>999.999</pesoR>');
    const r = await montarMdfe(ferroviario(prestador(), { ...TREM, vagoes: [{ ...VAGAO, pesoR: '0.505' }] }), opcoes());
    if (r.ok) throw new Error('esperava ocorrência');
    expect(r.ocorrencias).toContainEqual(
      expect.objectContaining({ caminho: 'ferroviario.vagoes[0].pesoR', code: 'decimal_invalido' }),
    );
  });

  test('sem vagão, peso fora do leiaute e número de vagão zero são ocorrências com rótulo do ferroviário', async () => {
    const casos: [Ferroviario, string][] = [
      [{ ...TREM, vagoes: [] }, 'ferroviario.vagoes'],
      [{ ...TREM, vagoes: [{ ...VAGAO, pesoBC: '1000' }] }, 'pesoBC'],
      [{ ...TREM, vagoes: [{ ...VAGAO, nVag: '0' }] }, 'nVag'],
    ];
    for (const [f, campo] of casos) {
      const r = await montarMdfe(ferroviario(prestador(), f), opcoes());
      if (r.ok) throw new Error(`esperava ocorrência em ${campo}`);
      const o = r.ocorrencias.find((x) => x.caminho.endsWith(campo));
      expect(o).toBeDefined();
      expect(rotuloDoCaminho(o?.caminho ?? '')).toMatch(/^Vag/);
    }
  });

  test('percurso, seguro e produto predominante são regras do rodoviário (F90, F91, F54)', async () => {
    const { seguros: _s, produtoPredominante: _p, percurso: _c, ...semRodo } = ferroviario(prestador());
    const d: DadosMdfeFerroviario = {
      ...semRodo,
      ufFim: 'SP',
      descarregamentos: [{ ...semRodo.descarregamentos[0], cMun: '3548500', xMun: 'SANTOS' } as never],
    };
    const r = await montarMdfe(d, opcoes());
    expect(rejeicoes(r)).toEqual([]);
    expect(ok(r).infMDFe.ide.modal).toBe('4');
  });

  test('carregamento posterior só no rodoviário (F23, 705)', async () => {
    const base = cargaPropria({
      ufFim: 'MT',
      percurso: [],
      indCarregaPosterior: true,
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA' }],
    });
    expect(rejeicoes(await montarMdfe(ferroviario(base), opcoes()))).toEqual(['705']);
  });

  test('dois grupos de modal são recusados', async () => {
    const r = await montarMdfe({ ...prestador(), ferroviario: TREM } as unknown as DadosMdfe, opcoes());
    if (r.ok) throw new Error('esperava ocorrências');
    expect(r.ocorrencias).toContainEqual(
      expect.objectContaining({ caminho: 'ferroviario', code: 'combinacao_invalida' }),
    );
  });

  test('rótulos dos caminhos do ferroviário', () => {
    expect(rotuloDoCaminho('/infMDFe/infModal/ferrov/vag[2]/nVag')).toBe('Vagão 2, Número do vagão');
    expect(rotuloDoCaminho('ferroviario.vagoes[1].pesoBC')).toBe('Vagão 2, Peso base de cálculo (t)');
    expect(rotuloDoCaminho('infMDFe.infModal.ferrov.trem.xPref')).toBe('Trem, Prefixo do trem');
    expect(rotuloDoCaminho('rodoviario.tracao.placa')).toBe('Veículo de tração, Placa');
  });
});

describe('SEFAZ simulada: modal ferroviário', () => {
  let transportadora: CertificadoSintetico;
  let produtor: CertificadoSintetico;
  beforeAll(async () => {
    const clock = relogioManual(EMISSAO);
    const ac = await certificadoSintetico({ relogio: clock, papel: 'ac', diasDeValidade: 3650 });
    [transportadora, produtor] = await Promise.all([
      certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: CNPJ_EMIT, emissor: ac }),
      certificadoSintetico({ relogio: clock, papel: 'titular', cpf: CPF_EMIT, emissor: ac }),
    ]);
  }, 60_000);

  function cenario(cert: CertificadoSintetico, autor: { CNPJ: string } | { CPF: string }) {
    const clock = relogioManual(EMISSAO);
    const sim = criarSefazSim({ relogio: clock, uf: 'MT' });
    const client = criarClienteMdfe({
      transporte: redirecionarParaSim(transporteSim(sim, { certificadoDoCliente: cert.der }), URL_BASE_SIM),
      assinador: cert.assinador,
      ambiente: 'homologacao',
      relogio: clock,
      autor,
    });
    const assinar = async (d: DadosMdfe, mexer: (xml: string) => string = (x) => x): Promise<string> => {
      const m = ok(await montarMdfe(d, { ...opcoes(), tempo: contextoDeTempo({ emissao: clock }) }));
      return assinarMdfe({ ...m, xml: mexer(m.xml) }, cert.assinador);
    };
    return { client, assinar };
  }

  test('autoriza, consulta e encerra; inclusão de condutor é 644', async () => {
    const s = cenario(transportadora, { CNPJ: CNPJ_EMIT });
    const xml = await s.assinar(ferroviario(prestador()));
    const chave = /Id="MDFe(\d{44})"/.exec(xml)?.[1] ?? '';
    const r = await s.client.autorizar(xml);
    if (r.tipo !== 'autorizado') throw new Error(JSON.stringify(r));
    expect(r.cStat).toBe('100');
    expect(r.valor.mdfeProc).toContain(xml);
    expect((await s.client.consultar(chave)).tipo).toBe('autorizado');
    const segundo = await s.client.autorizar(await s.assinar(ferroviario(prestador({ nMDF: 11 }))));
    expect(segundo.tipo === 'autorizado' && segundo.cStat).toBe('100');
    const cond = await s.client.incluirCondutor({
      chave,
      nSeqEvento: 1,
      condutor: { xNome: 'CONDUTOR SINTETICO', CPF: CPF_CONDUTOR },
    });
    expect(cond.tipo === 'recusado' && cond.cStat).toBe('644');
    const enc = await s.client.encerrar({ chave, nProt: r.valor.nProt ?? '', uf: 'GO', cMun: '5208707' });
    expect(enc.tipo === 'autorizado' && enc.cStat).toBe('135');
  });

  test('705 para o carregamento posterior no ferroviário; o rodoviário equivalente passa', async () => {
    const p = cenario(produtor, { CPF: CPF_EMIT });
    const posterior = cargaPropria({
      ufFim: 'MT',
      percurso: [],
      indCarregaPosterior: true,
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA' }],
    });
    const comoFerroviario = (x: string): string =>
      x
        .replace('<modal>1</modal>', '<modal>4</modal>')
        .replace(
          /<infModal versaoModal="3.00"><rodo>.*<\/rodo><\/infModal>/,
          '<infModal versaoModal="3.00"><ferrov><trem><xPref>ABC1234</xPref><xOri>CGB</xOri><xDest>CGB</xDest>' +
            '<qVag>1</qVag></trem><vag><pesoBC>60.500</pesoBC><pesoR>62.125</pesoR><serie>ABC</serie>' +
            '<nVag>1234567</nVag><TU>55.25</TU></vag></ferrov></infModal>',
        );
    const f = await p.client.autorizar(await p.assinar(posterior, comoFerroviario));
    expect(f.tipo === 'recusado' && f.cStat).toBe('705');
    const r = await p.client.autorizar(await p.assinar({ ...posterior, nMDF: 2 }));
    expect(r.tipo === 'autorizado' && r.cStat).toBe('100');
  });
});
