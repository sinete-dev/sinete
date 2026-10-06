/**
 * Regras de CFOP e CST na autorização da NF-e: CFOP de devolução fora da devolução (MOC 7.0 Anexo I, RV I08-144,
 * rejeição 328) e CST com destinatário não contribuinte (RV N12-70, rejeição 508), com a Tabela CFOP do Portal.
 */
import { describe, expect, test } from 'bun:test';
import { REGRAS_PADRAO } from '../src/index.ts';
import { enviNFe, harness, nfe, tags } from './helpers.ts';

const ICMS90 = '<ICMS90><orig>0</orig><CST>90</CST></ICMS90>';
const ICMS00 =
  '<ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00>';

describe('CFOP e CST na autorização', () => {
  test('328: CFOP de devolução na NF-e normal, com o nItem; a vizinha sem ele é autorizada', async () => {
    const h = await harness();
    const com = await nfe({ nNF: 1, itens: [{ CFOP: '5102' }, { CFOP: '5202' }] });
    const r = await h.send('NFeAutorizacao', enviNFe([com.xml]));
    expect(tags(r, 'cStat')[1]).toBe('328');
    expect(tags(r, 'xMotivo')[1]).toContain('[nItem:2]');
    const sem = await nfe({ nNF: 2, itens: [{ CFOP: '5102' }, { CFOP: '5102' }] });
    expect(tags(await h.send('NFeAutorizacao', enviNFe([sem.xml])), 'cStat')[1]).toBe('100');
    const devolucao = await nfe({
      nNF: 3,
      itens: [{ CFOP: '5202' }],
      trocas: [['<finNFe>1</finNFe>', '<finNFe>4</finNFe>']],
    });
    expect(tags(await h.send('NFeAutorizacao', enviNFe([devolucao.xml])), 'cStat')[1]).not.toBe('328');
    expect(REGRAS_PADRAO.autorizacao.some((r) => r.fonte.includes('I08-144'))).toBe(true);
  });

  test('508: CST fora da lista com não contribuinte; CST 00 e a nota de entrada passam', async () => {
    const h = await harness();
    const cst90 = await nfe({ nNF: 1, itens: [{ icms: ICMS90 }] });
    const r = await h.send('NFeAutorizacao', enviNFe([cst90.xml]));
    expect(tags(r, 'cStat')[1]).toBe('508');
    expect(tags(r, 'xMotivo')[1]).toContain('[nItem:1]');
    const cst00 = await nfe({ nNF: 2, itens: [{ icms: ICMS00 }] });
    expect(tags(await h.send('NFeAutorizacao', enviNFe([cst00.xml])), 'cStat')[1]).toBe('100');
    const entrada = await nfe({
      nNF: 3,
      itens: [{ CFOP: '1102', icms: ICMS90 }],
      trocas: [['<tpNF>1</tpNF>', '<tpNF>0</tpNF>']],
    });
    expect(tags(await h.send('NFeAutorizacao', enviNFe([entrada.xml])), 'cStat')[1]).not.toBe('508');
    const contribuinte = await nfe({
      nNF: 4,
      itens: [{ icms: ICMS90 }],
      trocas: [['<indIEDest>9</indIEDest>', '<indIEDest>2</indIEDest>']],
    });
    expect(tags(await h.send('NFeAutorizacao', enviNFe([contribuinte.xml])), 'cStat')[1]).not.toBe('508');
    expect(REGRAS_PADRAO.autorizacao.some((r) => r.fonte.includes('N12-70'))).toBe(true);
  });
});
