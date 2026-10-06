/**
 * NFC-e (modelo 65) na autorização: regras da identificação (MOC 7.0 Anexo I; NT 2025.002 B25b-20), do QR Code
 * versão 3 (NT 2025.001 v1.03, ZX02-222 a ZX02-338), o lote de uma nota só (NT 2023.002, GAP03a-4) e o fim da
 * denegação na NFC-e (NT 2023.002, item 6).
 */
import { describe, expect, test } from 'bun:test';
import { EMITENTE, enviNFe, harness, IE_EMITENTE, nfe, tags } from './helpers.ts';

const cStat = (xml: string): string[] => tags(xml, 'cStat');

describe('NFC-e', () => {
  test('QR Code versão 3 on-line e off-line com a assinatura do certificado da nota: autorizadas', async () => {
    const h = await harness();
    const online = await nfe({ nNF: 1, mod: '65' });
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([online.xml])))).toEqual(['104', '100']);
    const offline = await nfe({ nNF: 2, mod: '65', tpEmis: '9' });
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([offline.xml])))).toEqual(['104', '100']);
  });

  test('QR Code: 394 sem ele, 397 com chave ou ambiente de outra nota, 583 com a assinatura de outro conteúdo', async () => {
    const h = await harness();
    const com = async (p: Parameters<typeof nfe>[0]): Promise<string | undefined> =>
      cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe(p)).xml])))[1];
    expect(await com({ nNF: 1, mod: '65', qrCode: null })).toBe('394');
    const outra = (await nfe({ nNF: 99, mod: '65' })).chave;
    const url = 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=';
    expect(await com({ nNF: 2, mod: '65', qrCode: `${url}${outra}|3|2` })).toBe('397');
    const propria = (await nfe({ nNF: 3, mod: '65' })).chave;
    expect(await com({ nNF: 3, mod: '65', qrCode: `${url}${propria}|3|1` })).toBe('397');
    // Off-line: a nota de teste tem o destinatário CNPJ e vNF 10.00, emitida no dia 26.
    const off = (await nfe({ nNF: 4, mod: '65', tpEmis: '9' })).xml;
    const qr = /<qrCode>([^<]+)<\/qrCode>/.exec(off)?.[1] ?? '';
    const semAssinatura = qr.slice(0, qr.lastIndexOf('|') + 1);
    const chave4 = qr.slice(url.length, url.length + 44);
    expect(semAssinatura.startsWith(`${url}${chave4}|3|2|26|10.00|1|`)).toBe(true);
    expect(await com({ nNF: 4, mod: '65', tpEmis: '9', qrCode: `${semAssinatura}QUJD` })).toBe('583');
  });

  test('identificação: 709 tpImp, 706 entrada, 717 não presencial; 710 NF-e com tpImp 4; 711 NF-e off-line', async () => {
    const h = await harness();
    const com = async (p: Parameters<typeof nfe>[0]): Promise<string | undefined> =>
      cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe(p)).xml])))[1];
    expect(await com({ nNF: 1, mod: '65', trocas: [['<tpImp>4</tpImp>', '<tpImp>1</tpImp>']] })).toBe('709');
    expect(await com({ nNF: 2, mod: '65', trocas: [['<tpNF>1</tpNF>', '<tpNF>0</tpNF>']] })).toBe('706');
    expect(await com({ nNF: 3, mod: '65', trocas: [['<indPres>1</indPres>', '<indPres>2</indPres>']] })).toBe('717');
    expect(await com({ nNF: 4, trocas: [['<tpImp>1</tpImp>', '<tpImp>4</tpImp>']] })).toBe('710');
    expect(await com({ nNF: 5, tpEmis: '9' })).toBe('711');
  });

  test('NF-e com DANFE Simplificado Tipo 2 (NT 2026.002 v1.11): QR Code obrigatório, versão 3, off-line aceita', async () => {
    const h = await harness();
    const com = async (p: Parameters<typeof nfe>[0]): Promise<string | undefined> =>
      cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe(p)).xml])))[1];
    // A ZX01-10 (393) saiu do texto: o infNFeSupl na NF-e Tipo 2 é autorizado, on-line e off-line.
    expect(await com({ nNF: 1, tipo2: true })).toBe('100');
    expect(await com({ nNF: 2, tipo2: true, tpEmis: '9' })).toBe('100');
    expect(await com({ nNF: 3, tipo2: true, qrCode: null })).toBe('394');
    const url = 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=';
    const chave4 = (await nfe({ nNF: 4, tipo2: true })).chave;
    expect(await com({ nNF: 4, tipo2: true, qrCode: `${url}${chave4}|2|2|1|${'A'.repeat(40)}` })).toBe('672');
    // Off-line na NF-e só com tpImp 6 (B22-10); a NF-e sem tpImp 6 continua sem QR Code obrigatório.
    expect(await com({ nNF: 5, tpEmis: '9' })).toBe('711');
    expect(await com({ nNF: 6 })).toBe('100');
  });

  test('NF-e Tipo 2 sob as regras B11 e B25 da NFC-e (NT 2026.002 v1.11); a NF-e com tpImp 1 não', async () => {
    const h = await harness();
    const com = async (p: Parameters<typeof nfe>[0]): Promise<string | undefined> =>
      cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe(p)).xml])))[1];
    const trocas: [string, string, string][] = [
      ['<tpNF>1</tpNF>', '<tpNF>0</tpNF>', '706'],
      ['<idDest>1</idDest>', '<idDest>2</idDest>', '707'],
      ['<finNFe>1</finNFe>', '<finNFe>4</finNFe>', '715'],
      ['<indFinal>1</indFinal>', '<indFinal>0</indFinal>', '716'],
      ['<indPres>1</indPres>', '<indPres>2</indPres>', '717'],
      ['<indPres>1</indPres>', '<indPres>9</indPres>', '717'],
    ];
    let n = 1;
    for (const [de, para, esperado] of trocas) {
      expect(await com({ nNF: n++, tipo2: true, trocas: [[de, para]] })).toBe(esperado);
      expect(await com({ nNF: n++, trocas: [[de, para]] })).toBe('100');
    }
    for (const indPres of ['4', '5']) {
      const troca: [string, string] = ['<indPres>1</indPres>', `<indPres>${indPres}</indPres>`];
      expect(await com({ nNF: n++, tipo2: true, trocas: [troca] })).toBe('100');
    }
  });

  test('lote com mais de uma NFC-e: 126', async () => {
    const h = await harness();
    const a = await nfe({ nNF: 1, mod: '65' });
    const b = await nfe({ nNF: 2, mod: '65' });
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([a.xml, b.xml], '0')))).toEqual(['126']);
  });

  test('emitente irregular: a NFC-e é rejeitada com 781, sem denegação', async () => {
    const h = await harness({
      cadastro: [{ UF: 'SP', IE: IE_EMITENTE, CNPJ: EMITENTE, xNome: 'EMITENTE', situacao: 'irregular' }],
    });
    const n = await nfe({ mod: '65' });
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([n.xml])))).toEqual(['104', '781']);
    expect(h.sim.inspecao.nfe(n.chave)).toBeUndefined();
  });
});
