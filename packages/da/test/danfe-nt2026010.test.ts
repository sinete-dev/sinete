/**
 * DANFE A4 no leiaute da NT 2026.010 v1.00: bloco "Total do IBS/CBS/IS" (4.1), CRT e Tipo de Regime de Apuração no
 * quadro do emitente (4.2), campos do IBS/CBS/IS por item (4.3) e nada inventado quando o XML não traz o grupo (4.4).
 */
import { describe, expect, test } from 'bun:test';
import type { Documento } from '../src/model.ts';
import { danfe } from '../src/nfe.ts';
import { NFE_FIXTURES, nfeXml } from './fixtures.ts';

const fx = (name: string) => {
  const f = NFE_FIXTURES.find((x) => x.name === name);
  if (f === undefined) throw new Error(name);
  return f;
};

const ops = (doc: Documento) =>
  doc.paginas.flatMap((p, pagina) => p.ops.flatMap((o) => (o.t === 'texto' ? [{ ...o, pagina }] : [])));
const texts = (doc: Documento): string =>
  ops(doc)
    .map((o) => o.s)
    .join(' ');

/** Texto das ops da linha do item, do código dele até o código do item seguinte. */
function linhaDoItem(doc: Documento, codigo: string): string {
  const todas = ops(doc);
  const i = todas.findIndex((o) => o.s === codigo);
  if (i < 0) throw new Error(`sem ${codigo}`);
  const fim = todas.findIndex((o, j) => j > i && /^PRD\d{5}$/.test(o.s));
  return todas
    .slice(i, fim < 0 ? undefined : fim)
    .map((o) => o.s)
    .join(' ');
}

const NB = ' ';

const IBSCBS_ITEM_1 =
  '<IS><CSTIS>000</CSTIS><cClassTribIS>000001</cClassTribIS><vBCIS>987.65</vBCIS><pIS>2.5000</pIS><vIS>24.69</vIS></IS>' +
  '<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>1234.56</vBC>' +
  '<gIBSUF><pIBSUF>0.1000</pIBSUF>RED_UF<vIBSUF>VUF</vIBSUF></gIBSUF>' +
  '<gIBSMun><pIBSMun>0.0500</pIBSMun>RED_MUN<vIBSMun>VMUN</vIBSMun></gIBSMun><vIBS>1.85</vIBS>' +
  '<gCBS><pCBS>0.9000</pCBS>RED_CBS<vCBS>VCBS</vCBS></gCBS></gIBSCBS></IBSCBS>';

const red = (p: string) => `<gRed><pRedAliq>60.0000</pRedAliq><pAliqEfet>${p}</pAliqEfet></gRed>`;

/** ibscbs-st com o item 1 trocado; `reducao` liga o gRed em cada tributo. */
function comItem1(reducao: { uf?: boolean; mun?: boolean; cbs?: boolean } = {}, item2SemIbs = false): string {
  const xml = nfeXml(fx('ibscbs-st'));
  const grupo = IBSCBS_ITEM_1.replace('RED_UF', reducao.uf ? red('0.0400') : '')
    .replace('VUF', reducao.uf ? '0.49' : '1.23')
    .replace('RED_MUN', reducao.mun ? red('0.0200') : '')
    .replace('VMUN', reducao.mun ? '0.25' : '0.62')
    .replace('RED_CBS', reducao.cbs ? red('0.3600') : '')
    .replace('VCBS', reducao.cbs ? '4.44' : '11.11');
  const dets = xml.split('<det ');
  dets[1] = (dets[1] as string).replace(/<IBSCBS>.*?<\/IBSCBS>/, grupo);
  if (item2SemIbs) dets[2] = (dets[2] as string).replace(/<IBSCBS>.*?<\/IBSCBS>/, '');
  return dets.join('<det ');
}

const MONO =
  '<gMono><vIBSMono>1.11</vIBSMono><vCBSMono>2.22</vCBSMono><vIBSMonoReten>3.33</vIBSMonoReten>' +
  '<vCBSMonoReten>4.44</vCBSMonoReten><vIBSMonoRet>0.00</vIBSMonoRet><vCBSMonoRet>0.00</vCBSMonoRet></gMono>';

describe('DANFE A4 na NT 2026.010', () => {
  for (const formato of ['retrato', 'paisagem'] as const) {
    test(`${formato}: bloco Total do IBS/CBS/IS com monofasia, logo após o ICMS/IPI`, () => {
      const xml = nfeXml(fx('ibscbs-st'))
        .replace('</gCBS></IBSCBSTot>', `</gCBS>${MONO}</IBSCBSTot>`)
        .replace('<IBSCBSTot>', '<ISTot><vIS>30.86</vIS></ISTot><IBSCBSTot>');
      const t = texts(danfe(xml, { formato }));
      const titulo = formato === 'retrato' ? 'TOTAL DO IBS/CBS/IS' : 'IBS CBS IS';
      const bloco = t.slice(t.indexOf(titulo), t.indexOf('TRANSPORTADOR'));
      expect(t.indexOf('VALOR TOTAL DA NOTA')).toBeLessThan(t.indexOf(titulo));
      expect(bloco).toContain('VALOR DA CBS 9,00 VALOR DO IBS UF 1,00 VALOR DO IBS MUNICÍPIO 0,00');
      expect(bloco).toContain('VALOR DO IMPOSTO SELETIVO 30,86');
      expect(bloco).toContain('VALOR DO IBS MONOFÁSICO 1,11 VALOR DA CBS MONOFÁSICA 2,22');
      expect(bloco).toContain('VALOR DO IBS MONOFÁSICO POR RETENÇÃO 3,33 VALOR DA CBS MONOFÁSICA POR RETENÇÃO 4,44');
    });

    test(`${formato}: sem gMono, as células da monofasia ficam em branco`, () => {
      const t = texts(danfe(nfeXml(fx('ibscbs-st')), { formato }));
      const bloco = t.slice(t.indexOf('VALOR DO IBS MONOFÁSICO'), t.indexOf('TRANSPORTADOR'));
      expect(bloco).not.toMatch(/\d/);
    });

    test(`${formato}: CRT do XML e área vazia do regime de apuração acima do destinatário`, () => {
      for (const crt of ['1', '2', '3', '4']) {
        const xml = nfeXml(fx('basica')).replace('<CRT>3</CRT>', `<CRT>${crt}</CRT>`);
        const t = texts(danfe(xml, { formato }));
        expect(t).toMatch(
          new RegExp(
            `CÓDIGO DO REGIME TRIBUTÁRIO ${crt} - [^0-9]*? TIPO DE REGIME DE APURAÇÃO DO IBS E DA CBS DESTINATÁRIO`,
          ),
        );
      }
    });

    test(`${formato}: item com IBS/CBS e IS sem redução mostra a alíquota vigente`, () => {
      const doc = danfe(comItem1(), { formato });
      const l = linhaDoItem(doc, 'PRD00001');
      expect(l).toContain(`cClassTrib${NB}000001`);
      expect(l).toContain(`BC${NB}IBS/CBS${NB}1.234,56`);
      expect(l).toContain(`IBS${NB}UF${NB}0,10%${NB}1,23`);
      expect(l).toContain(`IBS${NB}MUN${NB}0,05%${NB}0,62`);
      expect(l).toContain(`CBS${NB}0,90%${NB}11,11`);
      expect(l).toContain(`IS${NB}BC${NB}987,65${NB}2,50%${NB}24,69`);
      expect(l).toContain('12,35');
      expect(doc.estatisticas.cortados).toBe(0);
    });

    test(`${formato}: com gRed nos três tributos, a alíquota é a efetiva`, () => {
      const l = linhaDoItem(danfe(comItem1({ uf: true, mun: true, cbs: true }), { formato }), 'PRD00001');
      expect(l).toContain(`IBS${NB}UF${NB}0,04%${NB}0,49`);
      expect(l).toContain(`IBS${NB}MUN${NB}0,02%${NB}0,25`);
      expect(l).toContain(`CBS${NB}0,36%${NB}4,44`);
      expect(l).toContain(`IS${NB}BC${NB}987,65${NB}2,50%`);
      expect(l).not.toContain('0,90%');
    });

    test(`${formato}: item sem IBSCBS não ganha linha de tributos`, () => {
      const doc = danfe(comItem1({}, true), { formato });
      const l = linhaDoItem(doc, 'PRD00002');
      expect(l).not.toContain('cClassTrib');
      expect(l).not.toMatch(/IBS|CBS/);
      expect(l).toContain('22,74');
      expect(linhaDoItem(doc, 'PRD00001')).toContain(`CBS${NB}0,90%${NB}11,11`);
    });
  }

  test('gRed só na CBS: IBS com a alíquota vigente, CBS com a efetiva', () => {
    const l = linhaDoItem(danfe(comItem1({ cbs: true })), 'PRD00001');
    expect(l).toContain(`IBS${NB}UF${NB}0,10%${NB}1,23`);
    expect(l).toContain(`IBS${NB}MUN${NB}0,05%${NB}0,62`);
    expect(l).toContain(`CBS${NB}0,36%${NB}4,44`);
  });

  test('IBSCBS só com CST e cClassTrib mostra a classificação e nenhum número', () => {
    const xml = comItem1().replace(
      /<IS>.*?<\/IS><IBSCBS>.*?<\/IBSCBS>/,
      '<IBSCBS><CST>410</CST><cClassTrib>410999</cClassTrib></IBSCBS>',
    );
    const l = linhaDoItem(danfe(xml), 'PRD00001');
    expect(l).toContain(`cClassTrib${NB}410999`);
    expect(l).not.toMatch(/IBS|CBS|IS /);
  });

  test('nota sem IBS/CBS não ganha bloco, linha de item nem folha', () => {
    const doc = danfe(nfeXml(fx('muitos-itens')));
    const t = texts(doc);
    expect(doc.paginas.length).toBe(2);
    expect(t).not.toContain('TOTAL DO IBS');
    expect(t).not.toContain('cClassTrib');
    expect(t).toContain('PRD00064');
    expect(doc.estatisticas.cortados).toBe(0);
  });
  test('folha 1 mais cheia: nenhum quadro invade o seguinte, e fatura e duplicatas que não cabem vão para o texto', () => {
    for (const dups of [0, 1, 6, 40]) {
      const doc = danfe(
        nfeXml({ name: 'cheia', items: 4, ibscbs: true, issqn: true, locais: true, fat: dups > 0, dups, transp: true }),
      );
      const y = (s: string): number => {
        const o = ops(doc).find((x) => x.pagina === 0 && x.s === s);
        if (o === undefined) throw new Error(s);
        return o.y;
      };
      // Do rótulo PESO LÍQUIDO ao fim do quadro do transportador cabe uma linha; daí até o ISSQN, o quadro de produtos.
      expect(y('DADOS DOS PRODUTOS/SERVIÇOS')).toBeGreaterThan(y('PESO LÍQUIDO') + 4);
      expect(y('CÁLCULO DO ISSQN') - y('DADOS DOS PRODUTOS/SERVIÇOS')).toBeGreaterThanOrEqual(10);
      const t = texts(doc);
      if (dups > 0) {
        expect(t).toContain('FATURA Nº 1234');
        for (let n = 1; n <= dups; n++) expect(t).toContain(`Nº ${String(n).padStart(3, '0')}`);
      }
    }
  });
});
