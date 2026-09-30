import { describe, expect, test } from 'bun:test';
import { c14n, escaparAtributoC14n, escaparTextoC14n, lerXml, primeiroFilho } from '../../src/xml/index.ts';

const NFE = 'http://www.portalfiscal.inf.br/nfe';

function canon(xml: string, local?: string): string {
  const doc = lerXml(xml);
  if (!local) return c14n(doc.raiz);
  for (const list of doc.ids.values()) {
    for (const e of list) if (e.local === local) return c14n(e);
  }
  throw new Error(`sem ${local}`);
}

describe('c14n', () => {
  test('ordena atributos por namespace e nome, tags abertas e fechadas, aspas duplas', () => {
    const out = canon(`<r xmlns:b="urn:b" xmlns:a="urn:a" z="1" b:y="2" a:y="3" a='4'><e/></r>`);
    expect(out).toBe('<r xmlns:a="urn:a" xmlns:b="urn:b" a="4" z="1" a:y="3" b:y="2"><e></e></r>');
  });

  test('escapes de texto e atributo', () => {
    const out = canon('<r a="&lt;&amp;&gt;&quot;\'&#9;&#10;&#13;">&lt;&amp;&gt;"\'&#13;</r>');
    expect(out).toBe('<r a="&lt;&amp;>&quot;\'&#x9;&#xA;&#xD;">&lt;&amp;&gt;"\'&#xD;</r>');
    expect(escaparTextoC14n('sem nada')).toBe('sem nada');
    expect(escaparAtributoC14n('sem nada')).toBe('sem nada');
  });

  test('o ápice herda namespaces e xml:* dos ancestrais', () => {
    const xml = `<nfeProc xmlns="${NFE}" xmlns:xsi="urn:xsi" xml:lang="pt"><NFe><infNFe Id="N1"><a/></infNFe></NFe></nfeProc>`;
    expect(canon(xml, 'infNFe')).toBe(
      `<infNFe xmlns="${NFE}" xmlns:xsi="urn:xsi" Id="N1" xml:lang="pt"><a></a></infNFe>`,
    );
  });

  test('xml:* do próprio ápice vence o herdado', () => {
    const xml = '<a xml:lang="pt"><b Id="x" xml:lang="en"/></a>';
    expect(canon(xml, 'b')).toBe('<b Id="x" xml:lang="en"></b>');
  });

  test('declaração redundante some e xmlns="" só aparece desfazendo um default emitido', () => {
    const xml = `<r xmlns="${NFE}"><a xmlns="${NFE}"><b xmlns=""><c xmlns=""/></b></a><d xmlns=""/></r>`;
    expect(canon(xml)).toBe(`<r xmlns="${NFE}"><a><b xmlns=""><c></c></b></a><d xmlns=""></d></r>`);
    expect(canon('<r xmlns=""><a/></r>')).toBe('<r><a></a></r>');
  });

  test('PI dentro do ápice é mantida, comentário não', () => {
    expect(canon('<r><!--x--><?p  dado?><?q?></r>')).toBe('<r><?p dado?><?q?></r>');
  });

  test('exclude omite a subárvore (enveloped-signature)', () => {
    const doc = lerXml('<r><a/><Signature><x/></Signature><b/></r>');
    const sig = primeiroFilho(doc.raiz, 'Signature');
    if (!sig) throw new Error('sem Signature');
    expect(c14n(doc.raiz, { excluir: new Set([sig]) })).toBe('<r><a></a><b></b></r>');
  });

  test('whitespace entre tags é preservado', () => {
    expect(canon('<r>\n  <a> x </a>\n</r>')).toBe('<r>\n  <a> x </a>\n</r>');
  });
});
