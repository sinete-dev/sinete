/** `@sinete/da/nfce`: o `danfce` é o DANFE NFC-e do `danfe`, sem os layouts da NF-e (ADR 0008). */
import { describe, expect, test } from 'bun:test';
import { danfce } from '../src/nfce.ts';
import { danfe } from '../src/nfe.ts';
import { toHtml } from '../src/render/html.ts';
import { toPdf } from '../src/render/pdf.ts';
import { chaveDe, eventoXml, NFE_FIXTURES, nfeXml } from './fixtures.ts';

const fx = (name: string): (typeof NFE_FIXTURES)[number] => {
  const f = NFE_FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(name);
  return f;
};

describe('danfce', () => {
  test('mesmos bytes do danfe no modelo 65, com opções e cancelamento', () => {
    for (const name of ['nfce', 'nfce-contingencia', 'previa-nfce', 'denegada-nfce']) {
      const xml = nfeXml(fx(name));
      expect(toPdf(danfce(xml, { largura: 58 }))).toEqual(toPdf(danfe(xml, { largura: 58 })));
    }
    const cancel = eventoXml({ tpEvento: '110112', chave: chaveDe('65') });
    const xml = nfeXml(fx('nfce'));
    expect(toPdf(danfce(xml, { cancelamento: cancel }))).toEqual(toPdf(danfe(xml, { cancelamento: cancel })));
  });
  test('emitente pessoa física: o cabeçalho diz CPF (Manual do DANFE NFC-e 6.0, 3.1.1)', () => {
    const xml = nfeXml(fx('nfce')).replace(/<emit><CNPJ>\d{14}<\/CNPJ>/, '<emit><CPF>11144477735</CPF>');
    const html = toHtml(danfce(xml));
    expect(html).toContain('CPF: 111.444.777-35');
    expect(html).not.toContain('CNPJ: 111.444.777-35');
    expect(toHtml(danfce(nfeXml(fx('nfce'))))).toContain('CNPJ: 11.222.333/0001-81');
  });
  test('NF-e modelo 55 é formato_incompativel', () => {
    expect(() => danfce(nfeXml(fx('basica')))).toThrow(expect.objectContaining({ code: 'formato_incompativel' }));
  });
});
