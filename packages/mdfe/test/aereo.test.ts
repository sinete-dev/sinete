/**
 * MDF-e do modal aéreo (MOC 3.00b, Anexo I, 3.2): montagem, regras que dependem do modal (F23, F34, e as do rodoviário
 * que deixam de valer) e o `@sinete/sefaz-sim` em processo.
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
  Aereo,
  DadosMdfe,
  DadosMdfeAereo,
  DadosMdfeRodoviario,
  MdfeMontado,
  ResultadoMontagemMdfe,
} from '../src/index.ts';
import { assinarMdfe, CODIGOS_OCORRENCIA_MDFE, criarClienteMdfe, montarMdfe, rotuloDoCaminho } from '../src/index.ts';
import { CNPJ_EMIT, CPF_CONDUTOR, CPF_EMIT, cargaPropria, EMISSAO, opcoes, prestador } from './helpers/mdfe.ts';

const VOO: Aereo = { nac: 'PR', matr: 'GUOAB', nVoo: 'G31234', cAerEmb: 'CGB', cAerDes: 'GYN', dVoo: '2026-09-26' };

function aereo(base: DadosMdfeRodoviario, extra: Partial<DadosMdfeAereo> = {}): DadosMdfeAereo {
  const { rodoviario: _, ...comuns } = base;
  return { ...comuns, aereo: VOO, ...extra };
}

function ok(r: ResultadoMontagemMdfe): MdfeMontado {
  if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho} ${i.code}: ${i.mensagem}`).join('\n'));
  return r.valor;
}

function rejeicoes(r: ResultadoMontagemMdfe): string[] {
  return r.ok ? [] : r.ocorrencias.flatMap((i) => /rejeição (\d{3,4})\)$/.exec(i.mensagem)?.[1] ?? []);
}

/** O CT-e de `prestador()` com entrega parcial. */
function comEntregaParcial<T extends DadosMdfe>(d: T): T {
  const [m] = d.descarregamentos;
  if (m === undefined) throw new Error('sem descarregamento');
  const cte = (m.cte ?? []).map((c) => ({ ...c, entregaParcial: { qtdTotal: '10', qtdParcial: '4' } }));
  return { ...d, descarregamentos: [{ ...m, cte }, ...d.descarregamentos.slice(1)] };
}

describe('montarMdfe: modal aéreo', () => {
  test('monta modal 2 com o grupo aereo na ordem do leiaute', async () => {
    const m = ok(await montarMdfe(aereo(prestador()), opcoes()));
    expect(m.infMDFe.ide.modal).toBe('2');
    expect(m.xml).toContain(
      '<infModal versaoModal="3.00"><aereo><nac>PR</nac><matr>GUOAB</matr><nVoo>G31234</nVoo>' +
        '<cAerEmb>CGB</cAerEmb><cAerDes>GYN</cAerDes><dVoo>2026-09-26</dVoo></aereo></infModal>',
    );
    expect(m.xml).not.toContain('<rodo>');
  });

  test('percurso, seguro e produto predominante são regras do rodoviário (F90, F91, F54)', async () => {
    const { seguros: _s, produtoPredominante: _p, percurso: _c, ...semRodo } = aereo(prestador());
    const d: DadosMdfeAereo = {
      ...semRodo,
      ufFim: 'RR',
      descarregamentos: [{ ...semRodo.descarregamentos[0], cMun: '1400100', xMun: 'BOA VISTA' } as never],
    };
    expect(rejeicoes(await montarMdfe(d, opcoes()))).toEqual([]);
    const r = await montarMdfe({ ...prestador(), ufFim: 'RR', descarregamentos: d.descarregamentos }, opcoes());
    expect(rejeicoes(r)).toContain('663');
  });

  test('carregamento posterior só no rodoviário (F23, 705)', async () => {
    const base = cargaPropria({
      ufFim: 'MT',
      percurso: [],
      indCarregaPosterior: true,
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA' }],
    });
    expect(rejeicoes(await montarMdfe(aereo(base), opcoes()))).toEqual(['705']);
    expect(rejeicoes(await montarMdfe(base, opcoes()))).toEqual([]);
  });

  test('entrega parcial do CT-e só no aéreo (F34, 702), com quatro casas', async () => {
    const m = ok(await montarMdfe(comEntregaParcial(aereo(prestador())), opcoes()));
    expect(m.xml).toContain('<infEntregaParcial><qtdTotal>10.0000</qtdTotal><qtdParcial>4.0000</qtdParcial>');
    const r = await montarMdfe(comEntregaParcial(prestador()), opcoes());
    expect(rejeicoes(r)).toEqual(['702']);
    expect(r.ok ? [] : r.ocorrencias.map((o) => o.caminho)).toEqual(['descarregamentos[0].cte[0].entregaParcial']);
  });

  test('campo do aéreo fora do leiaute vira ocorrência com rótulo do aéreo', async () => {
    const r = await montarMdfe(aereo(prestador(), { aereo: { ...VOO, cAerEmb: 'CGBXX', nVoo: 'G31' } }), opcoes());
    if (r.ok) throw new Error('esperava ocorrências');
    const campos = r.ocorrencias.map((o) => o.caminho.split(/[./]/).pop());
    expect(campos).toContain('cAerEmb');
    expect(campos).toContain('nVoo');
    for (const o of r.ocorrencias) expect(rotuloDoCaminho(o.caminho)).toStartWith('Transporte aéreo');
  });

  test('sem grupo de modal, ou com dois, é ocorrência, não exceção', async () => {
    const { rodoviario: _, ...sem } = prestador();
    const r = await montarMdfe(sem as DadosMdfe, opcoes());
    if (r.ok) throw new Error('esperava ocorrências');
    expect(r.ocorrencias).toContainEqual(
      expect.objectContaining({
        caminho: 'rodoviario',
        code: 'campo_obrigatorio',
        mensagem: expect.stringContaining('modal'),
      }),
    );
    expect(CODIGOS_OCORRENCIA_MDFE).toContain(r.ocorrencias[0]?.code as never);
    const dois = await montarMdfe({ ...prestador(), aereo: VOO } as unknown as DadosMdfe, opcoes());
    if (dois.ok) throw new Error('esperava ocorrências');
    expect(dois.ocorrencias).toContainEqual(expect.objectContaining({ caminho: 'aereo', code: 'combinacao_invalida' }));
  });

  test('rótulos dos caminhos do aéreo', () => {
    expect(rotuloDoCaminho('/infMDFe/infModal/aereo/nVoo')).toBe('Transporte aéreo, Número do voo');
    expect(rotuloDoCaminho('infMDFe.infModal.aereo.cAerEmb')).toBe('Transporte aéreo, Aeródromo de embarque');
    expect(rotuloDoCaminho('aereo.nVoo')).toBe('Transporte aéreo, Número do voo');
    expect(rotuloDoCaminho('rodoviario.tracao.placa')).toBe('Veículo de tração, Placa');
  });
});

describe('SEFAZ simulada: modal aéreo', () => {
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
    const xml = await s.assinar(aereo(prestador()));
    const chave = /Id="MDFe(\d{44})"/.exec(xml)?.[1] ?? '';
    const r = await s.client.autorizar(xml);
    if (r.tipo !== 'autorizado') throw new Error(JSON.stringify(r));
    expect(r.cStat).toBe('100');
    expect(r.valor.mdfeProc).toContain(xml);
    const c = await s.client.consultar(chave);
    expect(c.tipo).toBe('autorizado');
    const segundo = await s.client.autorizar(await s.assinar(aereo(prestador({ nMDF: 11 }))));
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

  test('705 para o carregamento posterior fora do rodoviário; 702 para a entrega parcial fora do aéreo', async () => {
    const p = cenario(produtor, { CPF: CPF_EMIT });
    const posterior = cargaPropria({
      ufFim: 'MT',
      percurso: [],
      indCarregaPosterior: true,
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA' }],
    });
    const comoAereo = (x: string): string =>
      x
        .replace('<modal>1</modal>', '<modal>2</modal>')
        .replace(
          /<infModal versaoModal="3.00"><rodo>.*<\/rodo><\/infModal>/,
          '<infModal versaoModal="3.00"><aereo><nac>PR</nac><matr>GUOAB</matr><nVoo>G31234</nVoo>' +
            '<cAerEmb>CGB</cAerEmb><cAerDes>CGB</cAerDes><dVoo>2026-09-26</dVoo></aereo></infModal>',
        );
    const i = await p.client.autorizar(await p.assinar(posterior, comoAereo));
    expect(i.tipo === 'recusado' && i.cStat).toBe('705');

    const t = cenario(transportadora, { CNPJ: CNPJ_EMIT });
    const parcial = (x: string): string =>
      x.replace(
        '</chCTe>',
        '</chCTe><infEntregaParcial><qtdTotal>10.0000</qtdTotal><qtdParcial>4.0000</qtdParcial></infEntregaParcial>',
      );
    const rodo = await t.assinar(prestador(), parcial);
    expect(rodo).toContain('<infEntregaParcial>');
    const ii = await t.client.autorizar(rodo);
    expect(ii.tipo === 'recusado' && ii.cStat).toBe('702');
    const iii = await t.client.autorizar(await t.assinar(comEntregaParcial(aereo(prestador({ nMDF: 12 })))));
    expect(iii.tipo === 'autorizado' && iii.cStat).toBe('100');
  });
});
