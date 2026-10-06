import { describe, expect, test } from 'bun:test';
import { dacce } from '../src/cce.ts';
import { gerarHtml, gerarPdf } from '../src/index.ts';
import { vista } from '../src/input/xml.ts';
import { dvModulo11 } from '../src/layout/contingencia.ts';
import { damdfe } from '../src/mdfe.ts';
import type { Documento } from '../src/model.ts';
import { danfe } from '../src/nfe.ts';
import { chaveDe, eventoXml, MDFE_FIXTURES, mdfeXml, NFE_FIXTURES, nfeXml } from './fixtures.ts';
import { encodePng, fakeJpeg } from './helpers/png.ts';

const fx = (name: string): (typeof NFE_FIXTURES)[number] => {
  const f = NFE_FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(name);
  return f;
};
const texts = (doc: Documento, page?: number): string =>
  doc.paginas
    .filter((_, i) => page === undefined || i === page)
    .flatMap((p) => p.ops.flatMap((o) => (o.t === 'texto' ? [o.s] : [])))
    .join(' ');
const LOGO = encodePng({
  width: 40,
  height: 20,
  colorType: 6,
  depth: 8,
  sample: (x, y, c) => (c === 3 ? 200 : x * 6 + y),
});

describe('DANFE A4', () => {
  test('120 duplicatas: grade limitada na folha 1, o resto nas informações complementares, nada fora do papel', () => {
    for (const formato of ['retrato', 'paisagem'] as const) {
      const doc = danfe(nfeXml({ name: 'd', items: 1, dups: 120, fat: true }), { formato });
      const t = texts(doc);
      const porLinha = formato === 'paisagem' ? 8 : 6;
      expect(t).toContain(`+ ${120 - (3 * porLinha - 1)} DUPLICATAS`);
      expect(t).toContain('DEMAIS DUPLICATAS: Nº 0');
      expect(t).toContain('Nº 120 VENC.');
      for (const p of doc.paginas) {
        for (const o of p.ops) {
          if (o.t === 'retangulo') {
            expect(o.h).toBeGreaterThanOrEqual(0);
            expect(o.y + o.h).toBeLessThanOrEqual(p.h);
          }
          if (o.t === 'texto') expect(o.y).toBeLessThanOrEqual(p.h);
        }
      }
      expect(doc.estatisticas.cortados).toBe(0);
    }
  });
  test('folha 1 cheia (locais, IBS/CBS, ISSQN, 40 duplicatas): grade encolhe e nenhum quadro sai negativo', () => {
    const cheia = { name: 'x', items: 3, dups: 40, fat: true, locais: true, ibscbs: true, issqn: true } as const;
    for (const canhoto of [true, false]) {
      const doc = danfe(nfeXml(cheia), { canhoto, fonteItens: 9 });
      for (const p of doc.paginas) {
        for (const o of p.ops) {
          if (o.t === 'retangulo') expect(o.h).toBeGreaterThanOrEqual(0);
          if (o.t === 'retangulo') expect(o.y + o.h).toBeLessThanOrEqual(p.h);
        }
      }
      const t = texts(doc);
      expect(t).toContain('DUPLICATAS: Nº ');
      expect(t).toContain('PRODUTO DE TESTE 3');
    }
  });
  test('CNPJ alfanumérico (NT 2025.001): chave no híbrido C/A em todos os formatos, sem sair da área', () => {
    // Letra e dígito alternados: o pior caso de tamanho do híbrido.
    const alfa = { cnpj: 'A1B2C3D4E5F667', destCnpj: 'AB1CD2EF3GH413' } as const;
    const docs = [
      danfe(nfeXml({ name: 'a', items: 2, ...alfa })),
      danfe(nfeXml({ name: 'a', items: 2, ...alfa }), { formato: 'paisagem' }),
      danfe(nfeXml({ name: 'a', items: 2, tpEmis: '5', semProt: true, ...alfa })),
      danfe(nfeXml({ name: 'a', items: 2, ...alfa }), { formato: 'simplificado', largura: 55 }),
      danfe(nfeXml({ name: 'a', items: 2, ...alfa }), { formato: 'etiqueta' }),
      dacce(eventoXml({ tpEvento: '110110', chave: chaveDe('55', '1', 1234, alfa.cnpj) })),
      damdfe(mdfeXml({ name: 'm', cnpj: alfa.cnpj })),
    ];
    for (const doc of docs) {
      const p = doc.paginas[0];
      const bars = (p?.ops ?? []).filter((o) => o.t === 'barras');
      expect(bars.length).toBeGreaterThan(0);
      for (const o of bars) {
        if (o.t !== 'barras') continue;
        const len = o.larguras.reduce((a, w) => a + w, 0) * o.modulo;
        expect(o.modulo).toBeGreaterThanOrEqual(0.2);
        // Largura mínima total de 6 cm, zonas de silêncio incluídas (MOC 7.0, Anexo II, cap. 2).
        expect(len + 20 * o.modulo).toBeGreaterThanOrEqual(60 - 1e-9);
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.vertical ? o.y + len : o.x + len).toBeLessThanOrEqual(o.vertical ? (p?.h ?? 0) : (p?.w ?? 0));
        if (o.vertical) continue;
        // Zona de silêncio de 10 módulos até a borda do quadro mais justo que contém as barras.
        const quadros = (p?.ops ?? []).filter(
          (r) => r.t === 'retangulo' && r.x <= o.x && r.x + r.w >= o.x + len && r.y <= o.y && r.y + r.h >= o.y + o.h,
        );
        const justo = quadros.sort((a, b) => (a.t === 'retangulo' && b.t === 'retangulo' ? a.w - b.w : 0))[0];
        if (justo?.t === 'retangulo') {
          expect(o.x - justo.x).toBeGreaterThanOrEqual(10 * o.modulo - 0.001);
          expect(justo.x + justo.w - (o.x + len)).toBeGreaterThanOrEqual(10 * o.modulo - 0.001);
        }
      }
    }
    expect(texts(docs[0] as Documento)).toContain('A1.B2C.3D4/E5F6-67');
  });
  test('FS-DA com destinatário de CNPJ alfanumérico: letras mantidas e DV pela regra ASCII - 48', () => {
    const t = texts(danfe(nfeXml({ name: 'f', items: 1, tpEmis: '5', semProt: true, destCnpj: 'AB1CD2EF3GH413' })));
    expect(t.replace(/ /g, '')).toContain('AB1CD2EF3GH413');
    // B = 18 e A = 17: 18 x 2 + 17 x 3 = 87, resto 10, DV 1; dígitos seguem como antes (3x2 + 2x3 + 1x4 = 16, DV 6).
    expect(dvModulo11('AB')).toBe('1');
    expect(dvModulo11('123')).toBe('6');
  });
  test('chave numérica: 6 cm com as zonas de silêncio em todos os formatos, papel estreito incluído', () => {
    const docs = [
      danfe(nfeXml(fx('basica'))),
      danfe(nfeXml(fx('simplificado')), { largura: 55 }),
      danfe(nfeXml(fx('simplificado')), { formato: 'etiqueta', largura: 55 }),
      danfe(nfeXml(fx('simplificado')), { largura: 70 }),
      damdfe(mdfeXml({ name: 'm' })),
    ];
    for (const doc of docs) {
      const bars = (doc.paginas[0]?.ops ?? []).filter((o) => o.t === 'barras');
      expect(bars.length).toBeGreaterThan(0);
      for (const o of bars) {
        if (o.t !== 'barras') continue;
        const len = o.larguras.reduce((a, w) => a + w, 0) * o.modulo;
        expect(len + 20 * o.modulo).toBeGreaterThanOrEqual(60 - 1e-9);
      }
    }
  });
  test('só fatura, sem duplicatas: nenhum retângulo invade o cálculo do imposto', () => {
    const doc = danfe(nfeXml({ name: 'f', items: 1, fat: true }));
    const ops = doc.paginas[0]?.ops ?? [];
    const titulo = ops.find((o) => o.t === 'texto' && o.s === 'CÁLCULO DO IMPOSTO');
    const fatura = ops.find((o) => o.t === 'texto' && o.s.startsWith('FATURA Nº'));
    if (titulo?.t !== 'texto' || fatura?.t !== 'texto') throw new Error('sem quadros');
    const entre = ops.filter((o) => o.t === 'retangulo' && o.y > fatura.y && o.y < titulo.y);
    expect(entre).toHaveLength(0);
  });
  test('fonteItens fora da faixa vale o limite (6 a 12 pt) e a paginação termina', () => {
    const doc = danfe(nfeXml({ name: 'g', items: 20 }), { fonteItens: 600 });
    const item = doc.paginas.flatMap((p) => p.ops).find((o) => o.t === 'texto' && o.s === 'PRD00001');
    expect(item?.t === 'texto' ? item.tamanho : 0).toBeLessThanOrEqual(12);
    expect(doc.paginas.length).toBeLessThan(20);
  });
  test('célula de item reduzida para caber numa linha sai no tamanho reduzido', () => {
    const xml = nfeXml({ name: 'c', items: 1 }).replace('<cProd>PRD00001</cProd>', '<cProd>123456789012</cProd>');
    const op = danfe(xml).paginas[0]?.ops.find((o) => o.t === 'texto' && o.s === '123456789012');
    expect(op?.t === 'texto' && op.tamanho < 6.5).toBe(true);
    const grande = danfe(xml, { fonteItens: 9 }).paginas[0]?.ops.find((o) => o.t === 'texto' && o.s === '123456789012');
    expect(grande?.t === 'texto' && grande.tamanho < 9).toBe(true);
  });
  test('básica: campos do MOC, protocolo, chave em blocos, folha 1/1', () => {
    const doc = danfe(nfeXml(fx('basica')));
    const t = texts(doc);
    expect(doc.paginas).toHaveLength(1);
    expect(doc.paginas[0]).toMatchObject({ w: 210, h: 297 });
    for (const s of [
      'DANFE',
      'FOLHA 1/1',
      'Nº 000.001.234',
      'SÉRIE 001',
      '3526 0911 2223 3300 0181 5500 1000 0012 3411 2345 6787',
      '135260000000001 - 01/09/2026 10:21:00',
      'PROTOCOLO DE AUTORIZAÇÃO DE USO',
      '44.555.666/0001-77',
      'FATURA Nº 1234',
      'VENC. 15/01/2026',
      '0-REMETENTE',
      'RECEBEMOS DE',
      'CÁLCULO DO IMPOSTO',
      '1.050,00',
    ]) {
      expect(t).toContain(s);
    }
    expect(doc.paginas[0]?.ops.some((o) => o.t === 'barras')).toBe(true);
    expect(doc.titulo).toBe(`DANFE ${chaveDe('55')}`);
  });
  test('64 itens em duas folhas com cabeçalho repetido e continuação', () => {
    const doc = danfe(nfeXml(fx('muitos-itens')));
    expect(doc.paginas).toHaveLength(2);
    expect(texts(doc, 1)).toContain('FOLHA 2/2');
    expect(texts(doc, 0)).toContain('CONTINUA NA PRÓXIMA FOLHA');
    expect(texts(doc, 1)).toContain('PRD00064');
    expect(texts(doc, 1)).not.toContain('RECEBEMOS DE');
  });
  test('informações complementares longas continuam nas folhas seguintes', () => {
    const doc = danfe(nfeXml(fx('textos-longos')));
    expect(doc.paginas.length).toBeGreaterThanOrEqual(3);
    expect(texts(doc)).toContain('DADOS ADICIONAIS (CONTINUAÇÃO)');
    expect(doc.estatisticas.cortados).toBe(0);
  });
  test('item mais alto que uma folha inteira é dividido, sem travar', () => {
    const doc = danfe(nfeXml({ name: 'gigante', items: 1, infAdProdLen: 20000 }));
    expect(doc.paginas.length).toBeGreaterThan(1);
  });
  test('homologação, IBS/CBS, ST, unidade tributável e valor unitário longo', () => {
    const doc = danfe(nfeXml(fx('ibscbs-st')));
    const t = texts(doc);
    expect(t).toContain('TOTAL DO IBS/CBS/IS');
    expect(t).toContain('CÓDIGO DO REGIME TRIBUTÁRIO 3 - REGIME NORMAL');
    expect(t).toContain('cClassTrib\u00a0000001');
    expect(t).toContain('B.CÁLC. ICMS ST');
    expect(t).toContain('TRIB.: 0,50 CX X');
    expect(doc.estatisticas.quebrados).toBeGreaterThan(0);
    const sem = texts(danfe(nfeXml(fx('ibscbs-st')), { ibsCbs: false, colunasSt: false }));
    expect(sem).not.toContain('TOTAL DO IBS');
    expect(sem).not.toContain('B.CÁLC. ICMS ST');
    const h = texts(danfe(nfeXml(fx('homologacao'))));
    expect(h).toContain('SEM VALOR FISCAL');
    expect(h).toContain('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL.');
  });
  test('ISSQN, locais de retirada e entrega', () => {
    const t = texts(danfe(nfeXml(fx('issqn-locais'))));
    expect(t).toContain('CÁLCULO DO ISSQN');
    expect(t).toContain('12345');
    expect(t).toContain('INFORMAÇÕES DO LOCAL DE RETIRADA');
    expect(t).toContain('INFORMAÇÕES DO LOCAL DE ENTREGA');
  });
  test('FS-DA: segundo código de barras com os dados da NF-e (MOC 3.9.2) e marca de contingência', () => {
    const doc = danfe(nfeXml(fx('fsda')));
    const t = texts(doc);
    expect(doc.paginas[0]?.ops.filter((o) => o.t === 'barras')).toHaveLength(2);
    // cUF 33 (RJ), tpEmis 5, CNPJ, vNF 105000, ICMS próprio 1, sem ST 2, dia 01, DV
    const dados = `33544555666000177000000001050001201`;
    expect(t).toContain((dados + dvModulo11(dados)).replace(/(.{4})(?=.)/g, '$1 '));
    expect(t).toContain('DANFE EMITIDO EM CONTINGÊNCIA FS-DA.');
    expect(t).toContain('CONTINGÊNCIA');
    expect(t).toContain('DADOS DA NF-e');
  });
  test('EPEC: protocolo do EPEC no campo 2 (MOC 3.9.3)', () => {
    const t = texts(
      danfe(nfeXml(fx('epec')), { epec: { nProt: '891260000000001', dhRegEvento: '2026-09-01T10:30:00-03:00' } }),
    );
    expect(t).toContain('PROTOCOLO DE AUTORIZAÇÃO DO EPEC');
    expect(t).toContain('891260000000001 - 01/09/2026 10:30:00');
    expect(t).toContain('www.nfe.fazenda.gov.br/portal');
    expect(texts(danfe(nfeXml(fx('epec'))))).toContain('PROTOCOLO DE AUTORIZAÇÃO DO EPEC');
  });
  test('paisagem pelo tpImp 2, com canhoto lateral e faixas de título', () => {
    const doc = danfe(nfeXml(fx('paisagem')));
    expect(doc.paginas[0]).toMatchObject({ w: 297, h: 210 });
    const t = texts(doc);
    expect(t).toContain('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR');
    expect(doc.paginas[0]?.ops.some((o) => o.t === 'texto' && o.rotacao === 90)).toBe(true);
    expect(danfe(nfeXml(fx('basica')), { formato: 'paisagem', canhoto: false }).paginas[0]?.w).toBe(297);
    const locais = texts(danfe(nfeXml(fx('issqn-locais')), { formato: 'paisagem' }));
    expect(locais).toContain('ISSQN');
  });
  test('sem canhoto, com logotipo PNG e JPEG', () => {
    const doc = danfe(nfeXml(fx('basica')), { canhoto: false, logo: LOGO });
    expect(texts(doc)).not.toContain('RECEBEMOS DE');
    expect(doc.imagens.logo?.formato).toBe('png');
    expect(doc.paginas[0]?.ops.some((o) => o.t === 'imagem')).toBe(true);
    expect(danfe(nfeXml(fx('basica')), { logo: fakeJpeg(30, 30, 3) }).imagens.logo?.formato).toBe('jpeg');
    expect(() => danfe(nfeXml(fx('basica')), { logo: new Uint8Array([1, 2]) })).toThrow(
      expect.objectContaining({ code: 'imagem_invalida' }),
    );
  });
  test('caracteres fora do WinAnsi não quebram', () => {
    const t = texts(danfe(nfeXml(fx('caracteres'))));
    expect(t).toContain('AÇÚCAR');
    expect(t).toContain('? ?? ?');
  });
  test('texto que nem quebrando cabe é cortado e contado', () => {
    const xml = nfeXml(fx('basica')).replace('EMPRESA FICTICIA DE TESTES DO SINETE LTDA', 'NOME '.repeat(300));
    expect(danfe(xml).estatisticas.cortados).toBeGreaterThan(0);
    expect(danfe(xml, { formato: 'paisagem' }).estatisticas.cortados).toBeGreaterThan(0);
  });
  test('NF-e sem destinatário e sem transporte ainda sai', () => {
    const t = texts(danfe(nfeXml({ name: 'x', items: 1, semDest: true })));
    expect(t).toContain('DESTINATÁRIO/REMETENTE');
  });
});

describe('cancelamento', () => {
  test('carimbo com o protocolo do evento 110111', () => {
    const t = texts(
      danfe(nfeXml(fx('basica')), { cancelamento: eventoXml({ tpEvento: '110111', chave: chaveDe('55') }) }),
    );
    expect(t).toContain('CANCELADA');
    expect(t).toContain('PROTOCOLO 135260000000099 02/09/2026 09:00:05');
  });
  test('carimbo sem evento e na NFC-e por substituição (110112)', () => {
    expect(texts(danfe(nfeXml(fx('basica')), { cancelamento: true }))).toContain('CANCELADA');
    const t = texts(
      danfe(nfeXml(fx('nfce')), { cancelamento: eventoXml({ tpEvento: '110112', chave: chaveDe('65') }) }),
    );
    expect(t).toContain('CANCELADA');
  });
  test('evento de outra nota, não registrado ou de outro tipo é recusado', () => {
    const outra = eventoXml({ tpEvento: '110111', chave: chaveDe('55', '1', 999) });
    expect(() => danfe(nfeXml(fx('basica')), { cancelamento: outra })).toThrow(
      expect.objectContaining({ code: 'evento_incompativel' }),
    );
    const rejeitado = eventoXml({ tpEvento: '110111', chave: chaveDe('55'), cStat: '573' });
    expect(() => danfe(nfeXml(fx('basica')), { cancelamento: rejeitado })).toThrow(
      expect.objectContaining({ code: 'evento_incompativel' }),
    );
    const cce = eventoXml({ tpEvento: '110110', chave: chaveDe('55') });
    expect(() => danfe(nfeXml(fx('basica')), { cancelamento: cce })).toThrow(
      expect.objectContaining({ code: 'evento_incompativel' }),
    );
  });
});

describe('formatos em bobina e simplificados', () => {
  test('DANFE NFC-e: divisões da NT 2026.003 / manual da NFC-e', () => {
    const doc = danfe(nfeXml(fx('nfce')));
    const t = texts(doc);
    expect(doc.paginas[0]?.w).toBe(80);
    for (const s of [
      'Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica',
      'Consulte pela Chave de Acesso em',
      'CONSUMIDOR CPF: 111.444.777-35',
      'Protocolo de autorização: 135260000000001',
      '(+) CBS R$',
      '(+) IBS R$',
      'Valor a Pagar R$',
      'Troco R$',
      'Pagamento Instantâneo (PIX) Dinâmico',
      'Tributos Totais Incidentes (Lei Federal 12.741/2012): R$ 4,00',
    ]) {
      expect(t).toContain(s);
    }
    expect(doc.paginas[0]?.ops.some((o) => o.t === 'qr')).toBe(true);
    // Figura 4 da NT 2026.003: o valor a pagar soma CBS, IBS e IS (vNFTot), não é o vNF.
    expect(t).toContain('Valor a Pagar R$ 1.059,00');
    expect(t).not.toContain('Valor a Pagar R$ 1.049,00');
  });
  test('NFC-e: valor a pagar aparece quando difere do total dos itens, mesmo sem acréscimo nem desconto', () => {
    expect(texts(danfe(nfeXml({ name: 'n', items: 1, mod: '65' })))).toContain('Valor a Pagar R$ 1.050,00');
  });
  test('NFC-e em papel de 56 mm: valores numéricos em colunas próprias, sem sobrepor', () => {
    const xml = (vu: string): string =>
      nfeXml({ name: 'n', items: 1, mod: '65' }).replace(/<vUnCom>[^<]*<\/vUnCom>/, `<vUnCom>${vu}</vUnCom>`);
    for (const vu of ['10.00', '12.3456789012', '123456789.1234567891']) {
      const ops = (danfe(xml(vu), { largura: 56 }).paginas[0]?.ops ?? []).filter((o) => o.t === 'texto');
      const linhas = new Map<number, { x: number; e: number }[]>();
      for (const o of ops) {
        if (o.t !== 'texto') continue;
        const k = Math.round(o.y * 100);
        linhas.set(k, [...(linhas.get(k) ?? []), { x: o.x, e: o.x + o.w }]);
      }
      for (const l of linhas.values()) {
        const ord = l.sort((a, b) => a.x - b.x);
        for (let i = 1; i < ord.length; i++) expect(ord[i]?.x ?? 0).toBeGreaterThanOrEqual((ord[i - 1]?.e ?? 0) - 0.01);
      }
    }
    expect(texts(danfe(xml('123456789.1234567891'), { largura: 56 }))).toContain('1 UN x 123.456.789,1234567891 =');
  });
  test('bobina e simplificado: infCpl longo inteiro, sem corte; valores longos do simplificado quebram dentro do papel', () => {
    for (const largura of [56, 80]) {
      const doc = danfe(nfeXml({ ...fx('nfce'), infCplLen: 5000 }), { largura });
      expect(doc.estatisticas.cortados).toBe(0);
    }
    const longo = nfeXml({ name: 's', items: 1, tpImp: '3', infCplLen: 3000 })
      .replace(/<qCom>[^<]*<\/qCom>/, '<qCom>12345678901.1234</qCom>')
      .replace(/<vUnCom>[^<]*<\/vUnCom>/, '<vUnCom>12345678901.1234567891</vUnCom>')
      .replace(/<vProd>[^<]*<\/vProd>/, '<vProd>1234567890123.12</vProd>');
    const doc = danfe(longo, { largura: 55 });
    expect(doc.estatisticas.cortados).toBe(0);
    for (const o of doc.paginas[0]?.ops ?? []) if (o.t === 'texto') expect(o.x).toBeGreaterThanOrEqual(0);
  });
  test('NFC-e em 56 mm: descrição longa do pagamento quebra em vez de cortar', () => {
    const xml = nfeXml({ name: 'n', items: 1, mod: '65' }).replace(
      '<tPag>01</tPag>',
      '<tPag>99</tPag><xPag>VALE PRESENTE DA CAMPANHA DE ANIVERSARIO DA LOJA TESTE</xPag>',
    );
    const doc = danfe(xml, { largura: 56 });
    expect(doc.estatisticas.cortados).toBe(0);
    expect(texts(doc)).toContain('ANIVERSARIO DA LOJA TESTE');
  });
  test('logotipo estreito encosta à esquerda e o texto do cabeçalho começa depois dele', () => {
    const estreito = encodePng({ width: 4, height: 40, colorType: 0, depth: 8, sample: () => 0 });
    for (const doc of [
      danfe(nfeXml(fx('nfce')), { logo: estreito }),
      dacce(eventoXml({ tpEvento: '110110', chave: chaveDe('55') }), { logo: estreito }),
    ]) {
      const ops = doc.paginas[0]?.ops ?? [];
      const img = ops.find((o) => o.t === 'imagem');
      if (img?.t !== 'imagem') throw new Error('sem logo');
      const junto = ops.filter((o) => o.t === 'texto' && o.y > img.y && o.y < img.y + img.h && o.x < img.x + img.w);
      expect(junto.filter((o) => o.t === 'texto' && o.x + o.w > img.x)).toHaveLength(0);
    }
  });
  test('NFC-e em contingência, consumidor não identificado, via do estabelecimento e QR centralizado', () => {
    const doc = danfe(nfeXml(fx('nfce-contingencia')), { via: 'estabelecimento', largura: 58, logo: LOGO });
    const t = texts(doc);
    expect(doc.paginas[0]?.w).toBe(58);
    expect(t).toContain('EMITIDA EM CONTINGÊNCIA');
    expect(t).toContain('Pendente de autorização');
    expect(t).toContain('CONSUMIDOR NÃO IDENTIFICADO');
    expect(t).toContain('Via Estabelecimento');
    expect(t).toContain('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL');
    expect(t).not.toContain('Protocolo de autorização');
  });
  test('DANFE Simplificado Tipo 2 pelo tpImp 6, com entrega e consumidor estrangeiro', () => {
    const t = texts(danfe(nfeXml(fx('tipo2'))));
    expect(t).toContain('DANFE Simplificado - Tipo 2');
    expect(t).toContain('NF-e nº 000001234');
    expect(t).toContain('Entrega: AVENIDA DA ENTREGA, 2');
    const est = nfeXml(fx('tipo2')).replace('<CPF>11144477735</CPF>', '<idEstrangeiro>AB123</idEstrangeiro>');
    expect(texts(danfe(est, { qrLateral: false }))).toContain('CONSUMIDOR Id. Estrangeiro: AB123');
  });
  test('Tipo 2 e NFC-e sem QR Code são recusados', () => {
    const sem = nfeXml(fx('nfce')).replace(/<infNFeSupl>.*<\/infNFeSupl>/, '');
    expect(() => danfe(sem)).toThrow(expect.objectContaining({ code: 'campo_ausente' }));
  });
  test('DANFE Simplificado (tpImp 3) e Etiqueta, com barras na vertical em papel estreito', () => {
    const s = danfe(nfeXml(fx('simplificado')), { logo: LOGO });
    expect(texts(s)).toContain('DANFE SIMPLIFICADO');
    expect(texts(s)).toContain('VALOR TOTAL DA NF-e: R$ 1.050,00');
    expect(s.paginas[0]?.ops.some((o) => o.t === 'barras' && !o.vertical)).toBe(true);
    const e = danfe(nfeXml(fx('simplificado')), { formato: 'etiqueta', largura: 58 });
    expect(texts(e)).toContain('DANFE SIMPLIFICADO - ETIQUETA');
    expect(texts(e)).toContain('IE: 12345678');
    expect(texts(e)).not.toContain('DESCRIÇÃO / UN');
    expect(e.paginas[0]?.ops.some((o) => o.t === 'barras' && o.vertical)).toBe(true);
    const epec = danfe(nfeXml(fx('epec')), {
      formato: 'etiqueta',
      epec: { nProt: '891260000000001', dhRegEvento: '2026-09-01T10:30:00-03:00' },
    });
    expect(texts(epec)).toContain('PROTOCOLO DE AUTORIZAÇÃO DO EPEC');
    expect(texts(danfe(nfeXml(fx('homologacao')), { formato: 'simplificado' }))).toContain('SEM VALOR FISCAL');
    expect(texts(danfe(nfeXml({ name: 'e', items: 1, semDest: true, tpImp: '3' })))).toContain(
      'DESTINATÁRIO/REMETENTE',
    );
  });
  test('formato incompatível com o modelo', () => {
    expect(() => danfe(nfeXml(fx('nfce')), { formato: 'retrato' })).toThrow(
      expect.objectContaining({ code: 'formato_incompativel' }),
    );
    expect(() => danfe(nfeXml(fx('basica')), { formato: 'nfce' })).toThrow(
      expect.objectContaining({ code: 'formato_incompativel' }),
    );
  });
});

describe('entrada', () => {
  test('grupo obrigatório ausente vira campo_ausente, nunca TypeError', () => {
    const semTransp = nfeXml(fx('basica')).replace(/<transp>.*<\/transp>/, '');
    expect(texts(danfe(semTransp))).toContain('TRANSPORTADOR/VOLUMES TRANSPORTADOS');
    const semUf = nfeXml(fx('ibscbs-st')).replace(/<gIBSUF>.*?<\/gIBSUF>/, '');
    expect(texts(danfe(semUf))).toContain('VALOR TOTAL DA NOTA');
    const semProd = nfeXml(fx('basica')).replace(/<prod>.*?<\/prod>/, '');
    expect(texts(danfe(semProd))).toContain('DADOS DOS PRODUTOS');
    const semEnder = nfeXml(fx('basica')).replace(/<enderEmit>.*<\/enderEmit>/, '');
    expect(() => danfe(semEnder)).not.toThrow();
  });
  test('vista: TypeError vira campo_ausente; outro erro passa', () => {
    expect(() =>
      vista('NF-e', () => {
        throw new TypeError('x');
      }),
    ).toThrow(expect.objectContaining({ code: 'campo_ausente' }));
    expect(() =>
      vista('NF-e', () => {
        throw new RangeError('y');
      }),
    ).toThrow(RangeError);
  });
  test('XML malformado, raiz inesperada e NF-e incompleta', () => {
    expect(() => danfe('<nfeProc')).toThrow(expect.objectContaining({ code: 'xml_invalido' }));
    expect(() => danfe(mdfeXml({ name: 'm' }))).toThrow(expect.objectContaining({ code: 'documento_inesperado' }));
    expect(() => danfe('<NFe xmlns="http://www.portalfiscal.inf.br/nfe"/>')).toThrow(
      expect.objectContaining({ code: 'campo_ausente' }),
    );
    expect(() => damdfe(nfeXml(fx('basica')))).toThrow(expect.objectContaining({ code: 'documento_inesperado' }));
    expect(() => damdfe('<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe"/>')).toThrow(
      expect.objectContaining({ code: 'campo_ausente' }),
    );
    expect(() => dacce(nfeXml(fx('basica')))).toThrow(expect.objectContaining({ code: 'documento_inesperado' }));
  });
});

describe('DACCE', () => {
  test('com a NF-e: emitente, correção, condições de uso', () => {
    const doc = dacce(eventoXml({ tpEvento: '110110', chave: chaveDe('55') }), {
      nfe: nfeXml(fx('basica')),
      logo: LOGO,
    });
    const t = texts(doc);
    expect(t).toContain('CARTA DE CORREÇÃO ELETRÔNICA');
    expect(t).toContain('EMPRESA FICTICIA DE TESTES DO SINETE LTDA');
    expect(t).toContain('CORRECAO DO ENDERECO DE ENTREGA');
    expect(t).toContain('135 - Evento registrado e vinculado a NF-e');
    expect(t).toContain('000.001.234');
  });
  test('sem a NF-e, correção longa em duas folhas e homologação', () => {
    const doc = dacce(
      eventoXml({ tpEvento: '110110', chave: chaveDe('55'), correcao: 'TEXTO LONGO '.repeat(900), tpAmb: '2' }),
    );
    expect(texts(doc)).toContain('CNPJ/CPF DO AUTOR: 11.222.333/0001-81');
    expect(doc.paginas.length).toBeGreaterThan(1);
    expect(texts(doc)).toContain('CORREÇÃO (CONTINUAÇÃO)');
    expect(texts(doc)).toContain('SEM VALOR FISCAL');
  });
  test('NF-e de outra chave e evento de outro tipo', () => {
    const ev = eventoXml({ tpEvento: '110110', chave: chaveDe('55', '1', 7) });
    expect(() => dacce(ev, { nfe: nfeXml(fx('basica')) })).toThrow(
      expect.objectContaining({ code: 'evento_incompativel' }),
    );
    expect(() => dacce(eventoXml({ tpEvento: '110111', chave: chaveDe('55') }))).toThrow(
      expect.objectContaining({ code: 'evento_incompativel' }),
    );
  });
});

describe('DAMDFE', () => {
  test('rodoviário: modal, QR, barras, veículos, condutores, vale-pedágio e protocolo', () => {
    const doc = damdfe(mdfeXml(MDFE_FIXTURES[0] as never), { logo: LOGO });
    const t = texts(doc);
    for (const s of [
      'Modelo Rodoviário de Carga',
      'ABC1D23',
      'XYZ9A87',
      'MOTORISTA FICTICIO UM',
      '99.888.777/0001-66',
      '935260000000001 - 01/09/2026 10:56:03',
      'CONTROLE DO FISCO',
      '1/1',
      'Consulte em https://dfe-portal.svrs.rs.gov.br/MDFe/consulta',
    ]) {
      expect(t).toContain(s);
    }
    expect(doc.paginas[0]?.ops.some((o) => o.t === 'qr')).toBe(true);
    expect(t).not.toContain('Composição da Carga');
  });
  test('contingência: aviso, composição da carga em várias folhas com FL x/y', () => {
    const doc = damdfe(mdfeXml(MDFE_FIXTURES[1] as never));
    const t = texts(doc);
    expect(t).toContain('EMISSÃO EM CONTINGÊNCIA');
    expect(t).toContain('Informações da Composição da Carga');
    expect(doc.paginas.length).toBeGreaterThan(1);
    expect(texts(doc, 1)).toContain(`2/${doc.paginas.length}`);
  });
  test('aéreo em homologação, aquaviário, ferroviário e cancelado', () => {
    const a = texts(damdfe(mdfeXml(MDFE_FIXTURES[2] as never)));
    expect(a).toContain('Aeronave');
    expect(a).toContain('EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL');
    expect(texts(damdfe(mdfeXml(MDFE_FIXTURES[3] as never)))).toContain('EMBARCACAO FICTICIA');
    const fe = texts(damdfe(mdfeXml(MDFE_FIXTURES[4] as never), { documentos: true, cancelado: true }));
    expect(fe).toContain('PREF1');
    expect(fe).toContain('CANCELADO');
    expect(fe).toContain('Informações da Composição da Carga');
    const c = texts(
      damdfe(mdfeXml(MDFE_FIXTURES[0] as never), {
        cancelado: { nProt: '9', dhRegEvento: '2026-09-02T10:00:00-03:00' },
      }),
    );
    expect(c).toContain('PROTOCOLO 9 02/09/2026 10:00:00');
  });
});

describe('determinismo', () => {
  test('a mesma entrada gera os mesmos bytes de PDF e HTML', () => {
    for (const f of NFE_FIXTURES) {
      const xml = nfeXml(f);
      expect(gerarPdf(danfe(xml))).toEqual(gerarPdf(danfe(xml)));
      expect(gerarHtml(danfe(xml))).toBe(gerarHtml(danfe(xml)));
    }
  });
});
