import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import type { Icms, NfeMontada } from '../../src/index.ts';
import { MotivoDesoneracaoIcms, montarNfe } from '../../src/index.ts';
import { DEST_CONTRIBUINTE, item, nota, opcoes } from '../helpers/nota.ts';

type Grupo = Record<string, Record<string, string>>;

async function comIcms(icms: Icms, crt: '1' | '3' = '3'): Promise<NfeMontada> {
  const base = nota({ itens: [item({}, icms)], destinatario: DEST_CONTRIBUINTE });
  const r = await montarNfe({ ...base, emitente: { ...base.emitente, CRT: crt } }, opcoes());
  if (!r.ok) throw new Error(JSON.stringify(r.ocorrencias, null, 1));
  return r.valor;
}

async function issuesDe(icms: Icms): Promise<readonly Ocorrencia[]> {
  const r = await montarNfe(nota({ itens: [item({}, icms)] }), opcoes());
  if (r.ok) throw new Error('esperava ocorrências');
  return r.ocorrencias;
}

function icmsDe(n: NfeMontada): Grupo {
  return (n.infNFe.det[0] as unknown as { imposto: { ICMS: Grupo } }).imposto.ICMS;
}

function totais(n: NfeMontada): Record<string, string> {
  return n.infNFe.total.ICMSTot as unknown as Record<string, string>;
}

// Item base: 10 × 1,50 = 15,00 (valor da operação).
describe('grupos do ICMS', () => {
  test('00 com FCP: vBC é o valor da operação', async () => {
    const n = await comIcms({ CST: '00', orig: '0', pICMS: '18', pFCP: '2' });
    expect(icmsDe(n).ICMS00).toEqual({
      orig: '0',
      CST: '00',
      modBC: '3',
      vBC: '15.00',
      pICMS: '18.00',
      vICMS: '2.70',
      pFCP: '2.00',
      vFCP: '0.30',
    });
    expect(totais(n)).toMatchObject({ vBC: '15.00', vICMS: '2.70', vFCP: '0.30', vNF: '15.00' });
  });

  test('02 monofásico próprio: quantidade × ad rem, totais monofásicos presentes', async () => {
    const n = await comIcms({ CST: '02', orig: '0', qBCMono: '100', adRemICMS: '1.2' });
    expect(icmsDe(n).ICMS02).toEqual({
      orig: '0',
      CST: '02',
      qBCMono: '100',
      adRemICMS: '1.20',
      vICMSMono: '120.00',
    });
    expect(totais(n)).toMatchObject({ qBCMono: '100.00', vICMSMono: '120.00', vICMSMonoReten: '0.00' });
  });

  test('sem monofásico, os totais monofásicos não vão para o XML', async () => {
    const n = await comIcms({ CST: '00', orig: '0', pICMS: '18' });
    expect(totais(n).vICMSMono).toBeUndefined();
    expect(totais(n).vFCPUFDest).toBeUndefined();
  });

  test('10 com ST por MVA: base (vOp + vIPI) × (1 + MVA), abatido o ICMS próprio e o FCP', async () => {
    const n = await comIcms({
      CST: '10',
      orig: '0',
      pICMS: '12',
      pFCP: '1',
      st: { modBCST: '4', pMVAST: '40', pICMSST: '18', pFCPST: '2' },
    });
    // vICMS 1,80; vFCP 0,15; vBCST 21,00; vICMSST 3,78 - 1,80 = 1,98; vFCPST 0,42 - 0,15 = 0,27 (RV N23d-10)
    expect(icmsDe(n).ICMS10).toMatchObject({
      vBC: '15.00',
      vICMS: '1.80',
      vBCFCP: '15.00',
      vFCP: '0.15',
      modBCST: '4',
      pMVAST: '40.00',
      vBCST: '21.00',
      vICMSST: '1.98',
      vBCFCPST: '21.00',
      vFCPST: '0.27',
    });
    // vNF = 15,00 + vST 1,98 + vFCPST 0,27 (W16-10)
    expect(totais(n)).toMatchObject({ vBCST: '21.00', vST: '1.98', vFCPST: '0.27', vNF: '17.25' });
  });

  test('10 com IPI: o IPI entra na base do ST por MVA', async () => {
    const base = item({}, { CST: '10', orig: '0', pICMS: '12', st: { modBCST: '4', pMVAST: '40', pICMSST: '18' } });
    const it = { ...base, impostos: { ...base.impostos, ipi: { cEnq: '999', CST: '50' as const, pIPI: '10' } } };
    const r = await montarNfe(nota({ itens: [it] }), opcoes());
    if (!r.ok) throw new Error(JSON.stringify(r.ocorrencias));
    // (15 + 1,50) × 1,4 = 23,10; 23,10 × 18% = 4,158 → 4,16 - 1,80 = 2,36
    expect(icmsDe(r.valor).ICMS10).toMatchObject({ vBCST: '23.10', vICMSST: '2.36' });
    expect(totais(r.valor)).toMatchObject({ vIPI: '1.50', vNF: '18.86' });
  });

  test('15 monofásico com retenção', async () => {
    const n = await comIcms({
      CST: '15',
      orig: '0',
      qBCMono: '10',
      adRemICMS: '1',
      qBCMonoReten: '5',
      adRemICMSReten: '2',
      pRedAdRem: '10',
      motRedAdRem: '1',
      vICMSMono: '10',
      vICMSMonoReten: '10',
    });
    expect(icmsDe(n).ICMS15).toMatchObject({ vICMSMono: '10.00', vICMSMonoReten: '10.00', pRedAdRem: '10.00' });
    // o retido compõe o valor da nota (W16-10)
    expect(totais(n)).toMatchObject({ vICMSMonoReten: '10.00', qBCMonoReten: '5.00', vNF: '25.00' });
  });

  test('15 com pRedAdRem exige os valores informados (a conta com redução não é derivada)', async () => {
    const issues = await issuesDe({
      CST: '15',
      orig: '0',
      qBCMono: '1',
      adRemICMS: '1',
      adRemICMSReten: '1',
      pRedAdRem: '10',
      motRedAdRem: '1',
    });
    expect(issues.map((i) => i.caminho)).toEqual([
      'itens[0].impostos.icms.vICMSMono',
      'itens[0].impostos.icms.vICMSMonoReten',
    ]);
  });

  test('20 com redução e desoneração', async () => {
    const n = await comIcms({
      CST: '20',
      orig: '0',
      pRedBC: '33.33',
      pICMS: '18',
      desoneracao: { vICMSDeson: '0.90', motDesICMS: MotivoDesoneracaoIcms.OUTROS },
    });
    expect(icmsDe(n).ICMS20).toEqual({
      orig: '0',
      CST: '20',
      modBC: '3',
      pRedBC: '33.33',
      vBC: '10.00',
      pICMS: '18.00',
      vICMS: '1.80',
      vICMSDeson: '0.90',
      motDesICMS: '9',
    });
    expect(totais(n)).toMatchObject({ vICMSDeson: '0.90', vNF: '15.00' });
  });

  test('30 com ST e dedução informada do ICMS próprio', async () => {
    const n = await comIcms({
      CST: '30',
      orig: '0',
      st: { modBCST: '0', vBCST: '20', pICMSST: '18', vICMSDeducaoST: '2.70' },
    });
    expect(icmsDe(n).ICMS30).toMatchObject({ vBCST: '20.00', vICMSST: '0.90' });
  });

  test('40 com desoneração que deduz do total (indDeduzDeson)', async () => {
    const n = await comIcms({
      CST: '40',
      orig: '0',
      desoneracao: { vICMSDeson: '1.00', motDesICMS: MotivoDesoneracaoIcms.SUFRAMA, indDeduzDeson: '1' },
    });
    expect(icmsDe(n).ICMS40).toEqual({
      orig: '0',
      CST: '40',
      vICMSDeson: '1.00',
      motDesICMS: '7',
      indDeduzDeson: '1',
    });
    expect(totais(n)).toMatchObject({ vICMSDeson: '1.00', vNF: '14.00' });
  });

  test('41 e 50 usam o grupo ICMS40', async () => {
    expect(icmsDe(await comIcms({ CST: '41', orig: '1' })).ICMS40).toEqual({ orig: '1', CST: '41' });
    expect(icmsDe(await comIcms({ CST: '50', orig: '2' })).ICMS40).toEqual({ orig: '2', CST: '50' });
  });

  test('51 com diferimento total e FCP diferido', async () => {
    const n = await comIcms({ CST: '51', orig: '0', pICMS: '18', pDif: '100', pFCP: '2', pFCPDif: '100' });
    expect(icmsDe(n).ICMS51).toEqual({
      orig: '0',
      CST: '51',
      modBC: '3',
      vBC: '15.00',
      pICMS: '18.00',
      vICMSOp: '2.70',
      pDif: '100.00',
      vICMSDif: '2.70',
      vICMS: '0.00',
      vBCFCP: '15.00',
      pFCP: '2.00',
      vFCP: '0.30',
      pFCPDif: '100.00',
      vFCPDif: '0.30',
      vFCPEfet: '0.00',
    });
    expect(totais(n)).toMatchObject({ vICMS: '0.00', vFCP: '0.30', vBC: '15.00' });
  });

  test('51 sem alíquota: só o que veio', async () => {
    expect(icmsDe(await comIcms({ CST: '51', orig: '0' })).ICMS51).toEqual({ orig: '0', CST: '51' });
    const n = await comIcms({ CST: '51', orig: '0', vBC: '15', vICMS: '1' });
    expect(icmsDe(n).ICMS51).toMatchObject({ vBC: '15.00', vICMS: '1.00' });
    expect(totais(n)).toMatchObject({ vBC: '15.00', vICMS: '1.00' });
  });

  test('53 monofásico diferido', async () => {
    const n = await comIcms({ CST: '53', orig: '0', qBCMono: '10', adRemICMS: '1', pDif: '50' });
    expect(icmsDe(n).ICMS53).toMatchObject({ vICMSMonoOp: '10.00', vICMSMonoDif: '5.00', vICMSMono: '5.00' });
    expect(icmsDe(await comIcms({ CST: '53', orig: '0' })).ICMS53).toEqual({ orig: '0', CST: '53' });
  });

  test('60 retido anteriormente: só o FCP retido entra no total', async () => {
    const n = await comIcms({
      CST: '60',
      orig: '0',
      vBCSTRet: '10',
      pST: '18',
      vICMSSubstituto: '1',
      vICMSSTRet: '1.8',
      vBCFCPSTRet: '10',
      pFCPSTRet: '2',
      vFCPSTRet: '0.2',
      pRedBCEfet: '10',
      vBCEfet: '15',
      pICMSEfet: '18',
      vICMSEfet: '2.7',
    });
    expect(icmsDe(n).ICMS60).toMatchObject({ vICMSSTRet: '1.80', vFCPSTRet: '0.20', vICMSEfet: '2.70' });
    expect(icmsDe(n).ICMS60?.pRedBCEfet).toBe('10.00');
    expect(totais(n)).toMatchObject({ vFCPSTRet: '0.20', vNF: '15.00' });
  });

  test('61 monofásico cobrado anteriormente', async () => {
    const n = await comIcms({ CST: '61', orig: '0', qBCMonoRet: '10', adRemICMSRet: '1.5' });
    expect(icmsDe(n).ICMS61).toMatchObject({ vICMSMonoRet: '15.00' });
    expect(totais(n)).toMatchObject({ vICMSMonoRet: '15.00', qBCMonoRet: '10.00' });
  });

  test('70 com redução, ST com redução e desonerações', async () => {
    const n = await comIcms({
      CST: '70',
      orig: '0',
      pRedBC: '10',
      pICMS: '12',
      st: { modBCST: '4', pMVAST: '30', pRedBCST: '10', pICMSST: '18' },
      desoneracao: { vICMSDeson: '0.50', motDesICMS: '3' },
      desoneracaoSt: { vICMSSTDeson: '0.10', motDesICMSST: '3' },
    });
    // vBC 13,50; vICMS 1,62; vBCST 15 × 1,3 × 0,9 = 17,55; 17,55 × 18% = 3,159 → 3,16 - 1,62 = 1,54
    expect(icmsDe(n).ICMS70).toMatchObject({
      vBC: '13.50',
      vICMS: '1.62',
      vBCST: '17.55',
      vICMSST: '1.54',
      vICMSDeson: '0.50',
      vICMSSTDeson: '0.10',
      motDesICMSST: '3',
    });
  });

  test('90 com ICMS próprio e ST', async () => {
    const n = await comIcms({
      CST: '90',
      orig: '0',
      pICMS: '12',
      pRedBC: '0',
      st: { modBCST: '0', vBCST: '20', pICMSST: '18' },
    });
    expect(icmsDe(n).ICMS90).toMatchObject({ vBC: '15.00', vICMS: '1.80', vBCST: '20.00', vICMSST: '1.80' });
    expect(icmsDe(await comIcms({ CST: '90', orig: '0' })).ICMS90).toEqual({ orig: '0', CST: '90' });
  });

  test('90 com FCP efetivo abatido do FCP-ST', async () => {
    const n = await comIcms({
      CST: '90',
      orig: '0',
      pICMS: '12',
      pFCP: '2',
      pFCPDif: '50',
      st: { modBCST: '0', vBCST: '20', pICMSST: '18', pFCPST: '2' },
    });
    // vFCP 0,30; diferido 0,15; efetivo 0,15; vFCPST 0,40 - vFCP 0,30 = 0,10 (RV N23d-10); total soma o vFCP (W04b-10)
    expect(icmsDe(n).ICMS90).toMatchObject({ vFCPEfet: '0.15', vFCPST: '0.10' });
    expect(totais(n)).toMatchObject({ vFCP: '0.30' });
  });

  test('90 com diferimento ou valores do ICMS próprio sem pICMS é ocorrência, não descarte', async () => {
    const issues = await issuesDe({ CST: '90', orig: '0', vICMSOp: '10', pDif: '100', vICMSDif: '10' });
    expect(issues).toEqual([
      expect.objectContaining({ code: 'campo_obrigatorio', caminho: 'itens[0].impostos.icms.pICMS' }),
    ]);
  });

  test('valor informado sem o campo de que o grupo depende é ocorrência, nunca descarte', async () => {
    const casos: [Icms, string][] = [
      [{ CSOSN: '900', vCredICMSSN: '20.00' }, 'pCredSN'],
      [{ CST: '00', orig: '0', pICMS: '18', vBCFCP: '15' } as Icms, 'pFCP'],
      [
        { CST: '10', orig: '0', pICMS: '12', st: { modBCST: '0', vBCST: '20', pICMSST: '18', vBCFCPST: '20' } },
        'st.pFCPST',
      ],
      [{ CST: '51', orig: '0', pICMS: '18', vFCPEfet: '0.30' }, 'pFCP'],
      [{ CST: '51', orig: '0', pICMS: '18', pFCP: '2', vFCPEfet: '0.30' }, 'pFCPDif'],
    ];
    for (const [icms, campo] of casos) {
      const issues = await issuesDe(icms);
      expect(issues).toContainEqual(
        expect.objectContaining({ code: 'campo_obrigatorio', caminho: `itens[0].impostos.icms.${campo}` }),
      );
    }
  });

  test('partilha (ICMSPart)', async () => {
    const n = await comIcms({
      grupo: 'Part',
      orig: '0',
      CST: '10',
      modBC: '3',
      pICMS: '12',
      st: { modBCST: '0', vBCST: '20', pICMSST: '18' },
      pBCOp: '100',
      UFST: 'RJ',
    });
    expect(icmsDe(n).ICMSPart).toMatchObject({
      CST: '10',
      vICMS: '1.80',
      vICMSST: '1.80',
      pBCOp: '100.00',
      UFST: 'RJ',
    });
  });

  test('repasse de ST (ICMSST)', async () => {
    const n = await comIcms({
      grupo: 'ST',
      orig: '0',
      CST: '41',
      vBCSTRet: '10',
      vICMSSTRet: '1.8',
      vBCSTDest: '10',
      vICMSSTDest: '2',
    });
    expect(icmsDe(n).ICMSST).toMatchObject({ vBCSTRet: '10.00', vICMSSTRet: '1.80', vICMSSTDest: '2.00' });
  });
});

describe('Simples Nacional', () => {
  test('101: crédito sobre o valor da operação, arredondado', async () => {
    const n = await comIcms({ CSOSN: '101', orig: '0', pCredSN: '2.5' }, '1');
    // 15 × 2,5% = 0,375 → 0,38 (HALF_UP)
    expect(icmsDe(n).ICMSSN101).toEqual({ orig: '0', CSOSN: '101', pCredSN: '2.50', vCredICMSSN: '0.38' });
  });

  test('102, 103, 300, 400', async () => {
    for (const CSOSN of ['102', '103', '300', '400'] as const) {
      expect(icmsDe(await comIcms({ CSOSN, orig: '0' }, '1')).ICMSSN102).toEqual({ orig: '0', CSOSN });
    }
  });

  test('201, 202 e 203 com ST sem ICMS próprio a abater', async () => {
    const st = { modBCST: '4' as const, pMVAST: '40', pICMSST: '18' };
    const a = await comIcms({ CSOSN: '201', orig: '0', st, pCredSN: '1' }, '1');
    expect(icmsDe(a).ICMSSN201).toMatchObject({ vBCST: '21.00', vICMSST: '3.78', vCredICMSSN: '0.15' });
    const b = await comIcms({ CSOSN: '203', orig: '0', st: { ...st, vICMSDeducaoST: '1.80' } }, '1');
    expect(icmsDe(b).ICMSSN202).toMatchObject({ CSOSN: '203', vICMSST: '1.98' });
  });

  test('500 e 900', async () => {
    const a = await comIcms({ CSOSN: '500', orig: '0', vBCSTRet: '10', pST: '18', vICMSSTRet: '1.8' }, '1');
    expect(icmsDe(a).ICMSSN500).toMatchObject({ vICMSSTRet: '1.80' });
    const b = await comIcms(
      {
        CSOSN: '900',
        orig: '0',
        pICMS: '18',
        pRedBC: '10',
        pCredSN: '1',
        st: { modBCST: '0', vBCST: '20', pICMSST: '18' },
      },
      '1',
    );
    expect(icmsDe(b).ICMSSN900).toMatchObject({ vBC: '13.50', pRedBC: '10.00', vICMS: '2.43', vCredICMSSN: '0.15' });
    // ST abate o ICMS próprio destacado: 20 × 18% = 3,60 - 2,43 = 1,17
    expect(icmsDe(b).ICMSSN900).toMatchObject({ vBCST: '20.00', vICMSST: '1.17' });
    expect(icmsDe(await comIcms({ CSOSN: '900' }, '1')).ICMSSN900).toEqual({ CSOSN: '900' });
  });
});

describe('regras do ICMS', () => {
  test('modBCST 4 exige pMVAST (rejeição 932)', async () => {
    const issues = await issuesDe({ CST: '30', orig: '0', st: { modBCST: '4', pICMSST: '18' } });
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'campo_obrigatorio', caminho: 'itens[0].impostos.icms.st.pMVAST' }),
    );
  });

  test('pMVAST só com modBCST 4 (rejeição 933)', async () => {
    const issues = await issuesDe({
      CST: '30',
      orig: '0',
      st: { modBCST: '0', vBCST: '10', pMVAST: '10', pICMSST: '18' },
    });
    expect(issues.map((i) => i.code)).toContain('combinacao_invalida');
  });

  test('valor informado que diverge do calculado além da tolerância', async () => {
    const issues = await issuesDe({ CST: '00', orig: '0', pICMS: '18', vICMS: '2.72' });
    expect(issues).toEqual([
      expect.objectContaining({ code: 'valor_divergente', caminho: 'itens[0].impostos.icms.vICMS' }),
    ]);
  });

  test('valor informado dentro da tolerância de 0,01 prevalece', async () => {
    const n = await comIcms({ CST: '00', orig: '0', pICMS: '18', vICMS: '2.71' });
    expect(icmsDe(n).ICMS00?.vICMS).toBe('2.71');
    expect(totais(n).vICMS).toBe('2.71');
  });

  test('alíquota com casas demais', async () => {
    const issues = await issuesDe({ CST: '00', orig: '0', pICMS: '18.12345' });
    expect(issues.map((i) => i.code)).toContain('decimal_invalido');
  });
});
