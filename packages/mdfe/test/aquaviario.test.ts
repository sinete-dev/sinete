/**
 * MDF-e do modal aquaviário (MOC 3.00b, Anexo I, 3.4, com o MMSI da NT 2025.001): montagem, limites do leiaute, regras
 * que dependem do modal e o `@sinete/sefaz-sim` em processo.
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
  Aquaviario,
  DadosMdfe,
  DadosMdfeAquaviario,
  DadosMdfeRodoviario,
  MdfeMontado,
  ResultadoMontagemMdfe,
} from '../src/index.ts';
import { assinarMdfe, criarClienteMdfe, montarMdfe, rotuloDoCaminho } from '../src/index.ts';
import { CNPJ_EMIT, CPF_CONDUTOR, CPF_EMIT, cargaPropria, EMISSAO, opcoes, prestador } from './helpers/mdfe.ts';

const NAVIO: Aquaviario = {
  irin: 'PPXX123',
  tpEmb: '01',
  cEmbar: 'EMB01',
  xEmbar: 'NAVIO SINTETICO',
  nViag: '123',
  cPrtEmb: 'MAO',
  cPrtDest: 'MCP',
  tpNav: '0',
  terminaisCarregamento: [{ cTermCarreg: 'T001', xTermCarreg: 'TERMINAL A' }],
  terminaisDescarregamento: [{ cTermDescarreg: 'T002', xTermDescarreg: 'TERMINAL B' }],
  comboio: [{ cEmbComb: 'BALSA01', xBalsa: 'BALSA SINTETICA' }],
};

function aquaviario(base: DadosMdfeRodoviario, navio: Aquaviario = NAVIO): DadosMdfeAquaviario {
  const { rodoviario: _, ...comuns } = base;
  return { ...comuns, aquaviario: navio };
}

function ok(r: ResultadoMontagemMdfe): MdfeMontado {
  if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho} ${i.code}: ${i.mensagem}`).join('\n'));
  return r.valor;
}

function rejeicoes(r: ResultadoMontagemMdfe): string[] {
  return r.ok ? [] : r.ocorrencias.flatMap((i) => /rejeição (\d{3,4})\)$/.exec(i.mensagem)?.[1] ?? []);
}

const terminal = (n: number) => ({ cTermCarreg: `T${n}`, xTermCarreg: `TERMINAL ${n}` });

describe('montarMdfe: modal aquaviário', () => {
  test('monta modal 3 com o grupo aquav na ordem do leiaute', async () => {
    const m = ok(await montarMdfe(aquaviario(prestador()), opcoes()));
    expect(m.infMDFe.ide.modal).toBe('3');
    expect(m.xml).toContain(
      '<infModal versaoModal="3.00"><aquav><irin>PPXX123</irin><tpEmb>01</tpEmb><cEmbar>EMB01</cEmbar>' +
        '<xEmbar>NAVIO SINTETICO</xEmbar><nViag>123</nViag><cPrtEmb>MAO</cPrtEmb><cPrtDest>MCP</cPrtDest>' +
        '<tpNav>0</tpNav><infTermCarreg><cTermCarreg>T001</cTermCarreg><xTermCarreg>TERMINAL A</xTermCarreg>' +
        '</infTermCarreg><infTermDescarreg><cTermDescarreg>T002</cTermDescarreg><xTermDescarreg>TERMINAL B' +
        '</xTermDescarreg></infTermDescarreg><infEmbComb><cEmbComb>BALSA01</cEmbComb><xBalsa>BALSA SINTETICA' +
        '</xBalsa></infEmbComb></aquav></infModal>',
    );
    expect(m.xml).not.toContain('<rodo>');
  });

  test('terminais até 5; MMSI de 9 dígitos sai por último', async () => {
    const cinco = ok(
      await montarMdfe(
        aquaviario(prestador(), { ...NAVIO, terminaisCarregamento: [1, 2, 3, 4, 5].map(terminal) }),
        opcoes(),
      ),
    );
    expect(cinco.xml.split('<infTermCarreg>')).toHaveLength(6);
    const seis = await montarMdfe(
      aquaviario(prestador(), { ...NAVIO, terminaisCarregamento: [1, 2, 3, 4, 5, 6].map(terminal) }),
      opcoes(),
    );
    if (seis.ok) throw new Error('esperava ocorrência');
    expect(seis.ocorrencias.map((o) => o.caminho)).toContain('aquaviario.terminaisCarregamento');
    const curto = await montarMdfe(aquaviario(prestador(), { ...NAVIO, MMSI: '12345678' }), opcoes());
    if (curto.ok) throw new Error('esperava ocorrência');
    const o = curto.ocorrencias.find((x) => x.caminho.endsWith('MMSI'));
    expect(rotuloDoCaminho(o?.caminho ?? '')).toBe('Transporte aquaviário, MMSI');
    const mmsi = ok(await montarMdfe(aquaviario(prestador(), { ...NAVIO, MMSI: '123456789' }), opcoes()));
    expect(mmsi.xml).toContain('</infEmbComb><MMSI>123456789</MMSI></aquav>');
  });

  test('percurso, seguro e produto predominante são regras do rodoviário (F90, F91, F54)', async () => {
    const { seguros: _s, produtoPredominante: _p, percurso: _c, ...semRodo } = aquaviario(prestador());
    const d: DadosMdfeAquaviario = {
      ...semRodo,
      ufIni: 'AM',
      ufFim: 'AP',
      carregamento: [{ cMun: '1302603', xMun: 'MANAUS' }],
      descarregamentos: [{ ...semRodo.descarregamentos[0], cMun: '1600303', xMun: 'MACAPA' } as never],
    };
    const r = await montarMdfe(d, opcoes());
    expect(rejeicoes(r)).toEqual([]);
    expect(ok(r).infMDFe.ide.modal).toBe('3');
  });

  test('carregamento posterior só no rodoviário (F23, 705)', async () => {
    const base = cargaPropria({
      ufFim: 'MT',
      percurso: [],
      indCarregaPosterior: true,
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA' }],
    });
    expect(rejeicoes(await montarMdfe(aquaviario(base), opcoes()))).toEqual(['705']);
  });

  test('dois grupos de modal são recusados', async () => {
    const r = await montarMdfe({ ...prestador(), aquaviario: NAVIO } as unknown as DadosMdfe, opcoes());
    if (r.ok) throw new Error('esperava ocorrências');
    expect(r.ocorrencias).toContainEqual(
      expect.objectContaining({ caminho: 'aquaviario', code: 'combinacao_invalida' }),
    );
  });

  test('rótulos dos caminhos do aquaviário', () => {
    expect(rotuloDoCaminho('/infMDFe/infModal/aquav/infTermCarreg[1]/cTermCarreg')).toBe(
      'Terminal de carregamento 1, Código do terminal',
    );
    expect(rotuloDoCaminho('aquaviario.irin')).toBe('Transporte aquaviário, IRIN do navio');
    expect(rotuloDoCaminho('aquaviario.comboio[2].xBalsa')).toBe('Embarcação do comboio 3, Balsa');
    expect(rotuloDoCaminho('rodoviario.tracao.placa')).toBe('Veículo de tração, Placa');
  });
});

describe('SEFAZ simulada: modal aquaviário', () => {
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
    const xml = await s.assinar(aquaviario(prestador()));
    const chave = /Id="MDFe(\d{44})"/.exec(xml)?.[1] ?? '';
    const r = await s.client.autorizar(xml);
    if (r.tipo !== 'autorizado') throw new Error(JSON.stringify(r));
    expect(r.cStat).toBe('100');
    expect(r.valor.mdfeProc).toContain(xml);
    expect((await s.client.consultar(chave)).tipo).toBe('autorizado');
    const segundo = await s.client.autorizar(await s.assinar(aquaviario(prestador({ nMDF: 11 }))));
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

  test('705 para o carregamento posterior no aquaviário', async () => {
    const p = cenario(produtor, { CPF: CPF_EMIT });
    const posterior = cargaPropria({
      ufFim: 'MT',
      percurso: [],
      indCarregaPosterior: true,
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA' }],
    });
    const comoAquaviario = (x: string): string =>
      x
        .replace('<modal>1</modal>', '<modal>3</modal>')
        .replace(
          /<infModal versaoModal="3.00"><rodo>.*<\/rodo><\/infModal>/,
          '<infModal versaoModal="3.00"><aquav><irin>PPXX123</irin><tpEmb>01</tpEmb><cEmbar>EMB01</cEmbar>' +
            '<xEmbar>NAVIO SINTETICO</xEmbar><nViag>123</nViag><cPrtEmb>MAO</cPrtEmb><cPrtDest>MCP</cPrtDest>' +
            '</aquav></infModal>',
        );
    const a = await p.client.autorizar(await p.assinar(posterior, comoAquaviario));
    expect(a.tipo === 'recusado' && a.cStat).toBe('705');
  });
});
