/** A calculadora padrão sobre o motor: pedido da porta para a operação do motor, grupo do motor para o leiaute, erros e regras como ocorrências. */
import { describe, expect, test } from 'bun:test';
import { relogioFixo } from '@sinete/core';
import type { ProvedorDeAliquotas } from '@sinete/ibs-cbs/aliquotas';
import { aliquotasOficiais } from '@sinete/ibs-cbs/aliquotas';
import { calcularEm } from '@sinete/ibs-cbs/calcular';
import type { Regra } from '@sinete/ibs-cbs/validar';
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';
import type { Item, PedidoIbsCbsItem, PedidoIbsCbsNota } from '../../src/index.ts';
import { calculadoraIbsCbs, carregarDatasetEmbarcado, Decimal, localDaOperacao, montarNfe } from '../../src/index.ts';
import { LOCAIS, notaRtc, opcoesRtc } from './helpers.ts';

const dataset = datasetEmbarcado();
const rates = aliquotasOficiais();
const QUANDO = relogioFixo('2026-10-10T12:00:00-03:00').agora();

function nota(extra: Partial<PedidoIbsCbsNota> = {}): PedidoIbsCbsNota {
  return {
    fatoGerador: QUANDO,
    emissao: QUANDO,
    ambiente: 'homologacao',
    mod: '55',
    tpNF: '1',
    finNFe: '1',
    indFinal: '1',
    indPres: '1',
    emitente: { UF: 'SP', cMun: '3550308', CRT: '3' },
    ...extra,
  };
}

const zero = Decimal.of('0');

function item(extra: Partial<PedidoIbsCbsItem> = {}): PedidoIbsCbsItem {
  return {
    nItem: 1,
    CST: '000',
    cClassTrib: '000001',
    vBC: Decimal.of('1000.00'),
    NCM: '73181500',
    CFOP: '5102',
    uTrib: 'UN',
    qTrib: Decimal.of('1'),
    vProd: Decimal.of('1000.00'),
    vDesc: zero,
    vFrete: zero,
    vSeg: zero,
    vOutro: zero,
    vICMS: zero,
    vICMSST: zero,
    vFCP: zero,
    vFCPST: zero,
    vIPI: zero,
    vPIS: zero,
    vCOFINS: zero,
    vII: zero,
    vISSQN: zero,
    vICMSUFDest: zero,
    vFCPUFDest: zero,
    ...extra,
  };
}

describe('calculadoraIbsCbs', () => {
  test('tributação integral: o grupo do leiaute é o do motor, na data do fato gerador', async () => {
    const r = await calculadoraIbsCbs({ dataset, aliquotas: rates }).calcular({ nota: nota(), itens: [item()] });
    expect(r.ocorrencias).toBeUndefined();
    const motor = calcularEm(
      {
        modelo: 55,
        local: { uf: 'SP', cMun: '3550308' },
        itens: [{ n: 1, cst: '000', cClassTrib: '000001', base: '1000.00' }],
      },
      { dataset, aliquotas: rates, data: '2026-10-10' },
    );
    expect(r.itens).toEqual([{ nItem: 1, IBSCBS: motor.itens[0]?.IBSCBS as never }]);
    expect(r.itens[0]?.IBSCBS.gIBSCBS).toMatchObject({
      gIBSUF: { pIBSUF: '0.10', vIBSUF: '1.00' },
      gCBS: { vCBS: '9.00' },
    });
  });

  test('indDoacao passa para o grupo; compra governamental chega ao motor', async () => {
    const calc = calculadoraIbsCbs({ dataset, aliquotas: rates });
    const r = await calc.calcular({
      nota: nota({ compraGov: { tpEnteGov: '1', pRedutor: Decimal.of('0'), tpOperGov: '1' } }),
      itens: [item({ indDoacao: '1' })],
    });
    expect(r.ocorrencias).toBeUndefined();
    expect(r.itens[0]?.IBSCBS.indDoacao).toBe('1');
    expect(r.itens[0]?.IBSCBS.gIBSCBS?.gTribCompraGov).toBeDefined();
  });

  test('compra governamental com pRedutor diferente do vigente: ocorrência, sem valores inconsistentes', async () => {
    const calc = calculadoraIbsCbs({ dataset, aliquotas: rates });
    const r = await calc.calcular({
      nota: nota({ compraGov: { tpEnteGov: '1', pRedutor: Decimal.of('50.00'), tpOperGov: '1' } }),
      itens: [item()],
    });
    expect(r.ocorrencias?.map((i) => [i.caminho, i.code])).toEqual([
      ['gCompraGov.pRedutor', 'ibscbs_redutor_divergente'],
    ]);
    const igual = await calc.calcular({
      nota: nota({ compraGov: { tpEnteGov: '1', pRedutor: Decimal.of('0.0000'), tpOperGov: '1' } }),
      itens: [item()],
    });
    expect(igual.ocorrencias).toBeUndefined();
  });

  test('base: vBC do item, senão a função das opções; sem as duas, ocorrência em vez de base presumida', async () => {
    const semVbc = item({ nItem: 2 });
    const { vBC: _, ...sem } = semVbc;
    const semBase = await calculadoraIbsCbs({ dataset, aliquotas: rates }).calcular({ nota: nota(), itens: [sem] });
    expect(semBase.ocorrencias).toEqual([
      expect.objectContaining({ caminho: 'itens[1].impostos.ibsCbs.classificacao.vBC', code: 'ibscbs_base_ausente' }),
    ]);
    const vistos: number[] = [];
    const comFuncao = await calculadoraIbsCbs({
      dataset,
      aliquotas: rates,
      base: (it) => {
        vistos.push(it.nItem);
        return it.vProd.minus(it.vDesc).toFixed(2);
      },
    }).calcular({ nota: nota(), itens: [sem] });
    expect(vistos).toEqual([2]);
    expect(comFuncao.itens[0]?.IBSCBS.gIBSCBS?.vBC).toBe('1000.00');
    const invalida = await calculadoraIbsCbs({ dataset, aliquotas: rates, base: () => '1,5' }).calcular({
      nota: nota(),
      itens: [sem],
    });
    expect(invalida.ocorrencias?.map((i) => [i.code, i.origem])).toEqual([['decimal_invalido', 'montagem']]);
    // vBC do próprio item fora da forma é da entrada (ADR 0011).
    const negativa = await calculadoraIbsCbs({ dataset, aliquotas: rates }).calcular({
      nota: nota(),
      itens: [item({ vBC: Decimal.of('-1') })],
    });
    expect(negativa.ocorrencias?.map((i) => [i.code, i.origem])).toEqual([['decimal_invalido', 'entrada']]);
  });

  test('gTribRegular da classificação chega ao motor; o cClassTrib que o exige, sem ele, vira ocorrência', async () => {
    const calc = calculadoraIbsCbs({ dataset, aliquotas: rates });
    const exportacao = item({ CST: '550', cClassTrib: '550001', CFOP: '7101' });
    const sem = await calc.calcular({ nota: nota(), itens: [exportacao] });
    expect(sem.ocorrencias?.map((i) => [i.caminho, i.code])).toEqual([
      ['itens[0].impostos.ibsCbs', 'ibscbs_classificacao_invalida'],
    ]);
    const com = await calc.calcular({
      nota: nota(),
      itens: [{ ...exportacao, gTribRegular: { CSTReg: '000', cClassTribReg: '000001' } }],
    });
    expect(com.ocorrencias).toBeUndefined();
    expect(com.itens[0]?.IBSCBS.gIBSCBS?.gTribRegular).toMatchObject({
      CSTReg: '000',
      cClassTribReg: '000001',
      vTribRegIBSUF: '1.00',
      vTribRegCBS: '9.00',
    });
  });

  test('no montarNfe: ICMS e FCP de partilha chegam à base; gTribRegular vai da entrada ao XML', async () => {
    const clock = relogioFixo('2026-10-10T12:00:00-03:00');
    const entrada = notaRtc(LOCAIS.SP, [
      { CST: '000', cClassTrib: '000001', base: '1000.00' },
      { CST: '550', cClassTrib: '550001', base: '100.00' },
    ]);
    const [difal, exportacao] = entrada.itens as [Item, Item];
    const itens: Item[] = [
      {
        ...difal,
        impostos: {
          ...difal.impostos,
          ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001' } },
          icmsUfDest: {
            vBCUFDest: '1000',
            pFCPUFDest: '2',
            pICMSUFDest: '18',
            pICMSInter: '12.00',
            vFCPUFDest: '20.00',
            vICMSUFDest: '60.00',
          },
        },
      },
      {
        ...exportacao,
        impostos: {
          ...exportacao.impostos,
          ibsCbs: {
            classificacao: {
              CST: '550',
              cClassTrib: '550001',
              gTribRegular: { CSTReg: '000', cClassTribReg: '000001' },
            },
          },
        },
      },
    ];
    const vistos: [number, string, string][] = [];
    const calc = calculadoraIbsCbs({
      dataset,
      aliquotas: rates,
      regras: false,
      // A base de quem emite: valor do item menos o ICMS próprio e o de partilha.
      base: (it) => {
        vistos.push([it.nItem, it.vICMSUFDest.toFixed(2), it.vFCPUFDest.toFixed(2)]);
        return it.vProd.minus(it.vICMS).minus(it.vICMSUFDest).minus(it.vFCPUFDest).toFixed(2);
      },
    });
    const r = await montarNfe({ ...entrada, itens }, opcoesRtc(clock, calc));
    if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
    expect(vistos).toEqual([
      [1, '60.00', '20.00'],
      [2, '0.00', '0.00'],
    ]);
    // 1000 - 180 de ICMS - 60 - 20 de partilha.
    expect(r.valor.xml).toContain('<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>740.00</vBC>');
    expect(r.valor.xml).toContain('<gTribRegular><CSTReg>000</CSTReg><cClassTribReg>000001</cClassTribReg>');
  });

  test('crédito presumido sem os percentuais: ocorrência de não suportado', async () => {
    const r = await calculadoraIbsCbs({ dataset, aliquotas: rates }).calcular({
      nota: nota(),
      itens: [item({ cCredPres: '01' })],
    });
    expect(r.ocorrencias?.map((i) => [i.caminho, i.code])).toEqual([
      ['itens[0].impostos.ibsCbs', 'ibscbs_nao_suportado'],
    ]);
  });

  test('erros do motor e das alíquotas viram ocorrências; outro erro propaga', async () => {
    const calc = calculadoraIbsCbs({ dataset, aliquotas: rates });
    const inexistente = await calc.calcular({ nota: nota(), itens: [item({ nItem: 3, cClassTrib: '000999' })] });
    expect(inexistente.ocorrencias).toEqual([
      expect.objectContaining({ caminho: 'itens[2].impostos.ibsCbs', code: 'ibscbs_classificacao_invalida' }),
    ]);
    // Monofasia (CST 620): o motor recusa em vez de zerar.
    const mono = await calc.calcular({ nota: nota(), itens: [item({ CST: '620', cClassTrib: '620001' })] });
    expect(mono.ocorrencias?.map((i) => i.code)).toEqual([expect.stringMatching(/^ibscbs_/)]);
    // 2027: a CBS ainda não foi fixada pelo Senado.
    const em2027 = relogioFixo('2027-03-10T12:00:00-03:00').agora();
    const futuro = await calc.calcular({ nota: nota({ fatoGerador: em2027, emissao: em2027 }), itens: [item()] });
    expect(futuro.ocorrencias?.map((i) => [i.caminho, i.code])).toEqual([
      ['impostos.ibsCbs', 'ibscbs_aliquota_desconhecida'],
    ]);
    const quebrado: ProvedorDeAliquotas = {
      id: 'quebrado',
      nominal: () => {
        throw new Error('provedor quebrado');
      },
      referencia: () => {
        throw new Error('provedor quebrado');
      },
    };
    expect(() =>
      calculadoraIbsCbs({ dataset, aliquotas: quebrado }).calcular({ nota: nota(), itens: [item()] }),
    ).toThrow('provedor quebrado');
  });

  test('regras da NT: violação vira ocorrência com a regra, a rejeição e a fonte; `false` desliga', async () => {
    const sempre: Regra = {
      id: 'TESTE-10',
      cStat: '9999',
      titulo: 'regra de teste',
      modelos: [55],
      ativacao: [{ homologacao: '2020-01-01', producao: '2020-01-01' }],
      fonte: 'teste',
      conferir: (_ctx, report) => {
        report(1, 'item reprovado');
        report(undefined, 'total reprovado');
      },
    };
    const r = await calculadoraIbsCbs({ dataset, aliquotas: rates, regras: { regras: [sempre] } }).calcular({
      nota: nota(),
      itens: [item()],
    });
    expect(r.ocorrencias).toEqual([
      {
        caminho: 'itens[0].impostos.ibsCbs',
        code: 'ibscbs_regra_nt',
        mensagem: 'TESTE-10 (rejeição 9999): item reprovado [teste]',
        origem: 'montagem',
      },
      {
        caminho: 'total.IBSCBSTot',
        code: 'ibscbs_regra_nt',
        mensagem: 'TESTE-10 (rejeição 9999): total reprovado [teste]',
        origem: 'montagem',
      },
    ]);
    const desligadas = await calculadoraIbsCbs({ dataset, aliquotas: rates, regras: false }).calcular({
      nota: nota(),
      itens: [item()],
    });
    expect(desligadas.ocorrencias).toBeUndefined();
    const todas = await calculadoraIbsCbs({
      dataset,
      aliquotas: rates,
      regras: { ignorarAtivacao: true },
      deslocamentoMin: -180,
    }).calcular({
      nota: nota({ destino: { UF: 'SP', cMun: '3550308' }, tpNFDebito: '01' }),
      itens: [item()],
    });
    expect(todas.itens).toHaveLength(1);
  });

  test('sem opções: dataset embarcado importado sob demanda e alíquotas oficiais, mesmo resultado', async () => {
    const semOpcoes = calculadoraIbsCbs().calcular({ nota: nota(), itens: [item()] });
    expect(semOpcoes).toBeInstanceOf(Promise);
    expect(await semOpcoes).toEqual(
      await calculadoraIbsCbs({ dataset, aliquotas: rates }).calcular({ nota: nota(), itens: [item()] }),
    );
    // O import dinâmico e o estático chegam à mesma instância, carregada uma vez por processo.
    expect(await carregarDatasetEmbarcado()).toBe(dataset);
    expect(carregarDatasetEmbarcado()).toBe(carregarDatasetEmbarcado());
  });

  test('local da operação: cMunFGIBS, depois o destino, depois o emitente (destino no exterior cai nele)', () => {
    expect(localDaOperacao(nota({ cMunFGIBS: '4314902', destino: { UF: 'AM', cMun: '1302603' } }))).toEqual({
      uf: 'RS',
      cMun: '4314902',
    });
    expect(localDaOperacao(nota({ destino: { UF: 'AM', cMun: '1302603' } }))).toEqual({ uf: 'AM', cMun: '1302603' });
    expect(localDaOperacao(nota({ destino: { UF: 'EX', cMun: '9999999' } }))).toEqual({ uf: 'SP', cMun: '3550308' });
    expect(localDaOperacao(nota({ cMunFGIBS: '0000000' }))).toEqual({ uf: 'SP', cMun: '3550308' });
  });

  test('no montarNfe: grupos do motor no XML e IBSCBSTot somado pelo builder', async () => {
    const clock = relogioFixo('2026-10-10T12:00:00-03:00');
    const r = await montarNfe(
      notaRtc(LOCAIS.SP, [
        { CST: '000', cClassTrib: '000001', base: '1000.00' },
        { CST: '200', cClassTrib: '200036', base: '7.56' },
      ]),
      opcoesRtc(clock, calculadoraIbsCbs({ dataset, aliquotas: rates })),
    );
    if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
    expect(r.valor.xml).toContain('<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>1000.00</vBC>');
    expect(r.valor.infNFe.total.IBSCBSTot).toMatchObject({ vBCIBSCBS: '1007.56', gCBS: { vCBS: '9.03' } });
  });
});
