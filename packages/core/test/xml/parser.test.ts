import { describe, expect, test } from 'bun:test';
import { isSineteError } from '../../src/index.ts';
import {
  attributeOf,
  childElements,
  descendants,
  firstChild,
  inScopeNamespaces,
  parseXml,
  textOf,
  XML_NS,
  XmlError,
} from '../../src/xml/index.ts';

const NFE = 'http://www.portalfiscal.inf.br/nfe';

function parseError(xml: string): XmlError {
  try {
    parseXml(xml);
  } catch (e) {
    if (e instanceof XmlError) return e;
    throw e;
  }
  throw new Error(`deveria recusar: ${xml}`);
}

describe('parseXml: estrutura e offsets', () => {
  test('guarda offsets de abertura, conteúdo e fechamento', () => {
    const src = `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><a>x</a><b/></infNFe></NFe>`;
    const doc = parseXml(src);
    expect(doc.source).toBe(src);
    const inf = firstChild(doc.root, 'infNFe', NFE);
    if (!inf) throw new Error('sem infNFe');
    expect(src.slice(inf.start, inf.openEnd)).toBe('<infNFe Id="NFe1" versao="4.00">');
    expect(src.slice(inf.contentEnd, inf.end)).toBe('</infNFe>');
    const b = firstChild(inf, 'b');
    expect(b?.selfClosing).toBe(true);
    expect(b && src.slice(b.start, b.end)).toBe('<b/>');
    expect(b?.contentEnd).toBe(b?.end);
    expect(doc.ids.get('NFe1')).toEqual([inf]);
    expect(inf.ns).toBe(NFE);
    expect(attributeOf(inf, 'versao')).toBe('4.00');
    expect(attributeOf(inf, 'inexistente')).toBeUndefined();
    const a = firstChild(inf, 'a');
    const t = a?.children[0];
    expect(t?.type === 'text' && src.slice(t.start, t.end)).toBe('x');
  });

  test('BOM, prólogo com comentário e PI, epílogo com whitespace', () => {
    const doc = parseXml('﻿<?xml version="1.0"?>\n<!-- c --><?proc x?>\n<r/>\n<!-- fim -->\n');
    expect(doc.root.name).toBe('r');
    expect(doc.root.children).toEqual([]);
  });

  test('fim de linha e normalização de atributo (XML 1.0 2.11 e 3.3.3)', () => {
    const doc = parseXml('<r a="x\ty\r\nz&#9;w&#10;">l1\r\nl2\rl3&#13;</r>');
    expect(attributeOf(doc.root, 'a')).toBe('x y z\tw\n');
    expect(textOf(doc.root)).toBe('l1\nl2\nl3\r');
  });

  test('par de surrogates (emoji) é caractere válido', () => {
    expect(textOf(parseXml('<a>\u{1F600}</a>').root)).toBe('\u{1F600}');
  });

  test('profundidade: 256 níveis passam, 257 são XmlError (limite do libxml2)', () => {
    const nest = (n: number): string => '<r>'.repeat(n) + '</r>'.repeat(n);
    expect(descendants(parseXml(nest(256)).root).next().value?.local).toBe('r');
    expect(() => parseXml(nest(257))).toThrow(XmlError);
    expect(() => parseXml(nest(12000))).toThrow(XmlError);
  });

  test('nome com caractere do plano suplementar (NameStartChar #x10000-#xEFFFF)', () => {
    const doc = parseXml('<p:\u{10400}x xmlns:p="urn:p" \u{10400}a="1"/>');
    expect(doc.root.local).toBe('\u{10400}x');
    expect(doc.root.attributes[0]?.local).toBe('\u{10400}a');
  });

  test('entidades predefinidas, referências e CDATA unidos num texto só', () => {
    const doc = parseXml('<r>&lt;&gt;&amp;&quot;&apos;&#x41;&#66;<![CDATA[<&]]>fim</r>');
    expect(doc.root.children.length).toBe(1);
    expect(textOf(doc.root)).toBe('<>&"\'AB<&fim');
  });

  test('namespaces: prefixo, default, desdeclaração e xml:', () => {
    const doc = parseXml(`<a xmlns="${NFE}" xmlns:ds="urn:ds" xml:lang="pt"><ds:b ds:x="1"/><c xmlns=""><d/></c></a>`);
    const [b, c] = childElements(doc.root);
    expect(b?.ns).toBe('urn:ds');
    expect(b?.attributes[0]?.ns).toBe('urn:ds');
    expect(c?.ns).toBe('');
    expect(c && firstChild(c, 'd')?.ns).toBe('');
    expect(doc.root.attributes[0]?.ns).toBe(XML_NS);
    expect(inScopeNamespaces(b ?? doc.root)).toEqual(
      new Map([
        ['', NFE],
        ['ds', 'urn:ds'],
      ]),
    );
    expect([...descendants(doc.root)].map((e) => e.local)).toEqual(['a', 'b', 'c', 'd']);
  });

  test('PI dentro da raiz vira nó; comentário some', () => {
    const doc = parseXml('<r><!-- x --><?alvo dado  final?><?vazio?></r>');
    expect(doc.root.children).toMatchObject([
      { type: 'pi', target: 'alvo', data: 'dado  final' },
      { type: 'pi', target: 'vazio', data: '' },
    ]);
  });

  test('Id duplicado fica registrado para o verificador recusar', () => {
    const doc = parseXml('<r><a Id="x"/><b Id="x"/></r>');
    expect(doc.ids.get('x')?.length).toBe(2);
  });

  test('erro é XmlError com code e offset', () => {
    const e = parseError('<r>a & b</r>');
    expect(e.code).toBe('xml_malformado');
    expect(e.offset).toBe(5);
    expect(isSineteError(e, 'xml_malformado')).toBe(true);
    expect(e.details).toEqual({ offset: 5 });
  });
});

describe('parseXml: recusa XML malformado', () => {
  const cases: [string, string][] = [
    ["'&' solto", '<r>M&M</r>'],
    ["'&' solto em atributo", '<r a="M&M"/>'],
    ['entidade desconhecida', '<r>&nbsp;</r>'],
    ['entidade herdada do protótipo', '<r>&toString;</r>'],
    ['entidade herdada do protótipo em atributo', '<r a="&constructor;"/>'],
    ['referência a caractere proibido', '<r>&#1;</r>'],
    ['referência malformada', '<r>&#xZZ;</r>'],
    ['caractere de controle literal', '<r>\u0001</r>'],
    ['DOCTYPE', '<!DOCTYPE r [<!ENTITY x "y">]><r>&x;</r>'],
    ['declaração de marcação', '<r><!ELEMENT x ANY></r>'],
    ['tag trocada', '<a><b></a></b>'],
    ['elemento não fechado', '<a><b></b>'],
    ['fechamento sem abertura', '</a>'],
    ['fechamento malformado', '<a></a x>'],
    ['duas raízes', '<a/><b/>'],
    ['texto fora da raiz', 'x<a/>'],
    ['texto depois da raiz', '<a/>x'],
    ['sem raiz', '<?xml version="1.0"?>'],
    ['atributo duplicado', '<a x="1" x="2"/>'],
    ['atributo duplicado por namespace', '<a xmlns:p="urn:x" xmlns:q="urn:x" p:y="1" q:y="2"/>'],
    ['atributo sem aspas', '<a x=1/>'],
    ['atributo sem igual', '<a x "1"/>'],
    ['atributo sem aspas de fechamento', '<a x="1/>'],
    ['sem espaço entre atributos', '<a x="1"y="2"/>'],
    ["'<' em atributo", '<a x="<"/>'],
    ["']]>' em texto", '<a>]]></a>'],
    ['prefixo não declarado', '<p:a/>'],
    ['prefixo de atributo não declarado', '<a p:x="1"/>'],
    ['nome qualificado inválido', '<a:b:c xmlns:a="urn:a"/>'],
    ['nome local que não é NCName', '<p:1 xmlns:p="urn:p"/>'],
    ['nome local de atributo que não é NCName', '<a xmlns:p="urn:p" p:-x="1"/>'],
    ['prefixo declarado que não é NCName', '<a xmlns:1="urn:p"/>'],
    ['nome local vazio', '<p: xmlns:p="urn:p"/>'],
    ['prefixo xmlns em elemento', '<xmlns:a/>'],
    ['declarar xmlns', '<a xmlns:xmlns="urn:x"/>'],
    ['xml com outro namespace', '<a xmlns:xml="urn:x"/>'],
    ['outro prefixo com o namespace do xml', '<a xmlns:p="http://www.w3.org/XML/1998/namespace"/>'],
    ['default reservado', '<a xmlns="http://www.w3.org/XML/1998/namespace"/>'],
    ['prefixo com namespace vazio', '<a xmlns:p=""/>'],
    ['comentário com --', '<a><!-- a -- b --></a>'],
    ['comentário sem fechamento', '<a><!-- a </a>'],
    ['CDATA sem fechamento', '<a><![CDATA[x</a>'],
    ['CDATA fora da raiz', '<![CDATA[x]]><a/>'],
    ['PI sem fechamento', '<a><?x </a>'],
    ['declaração XML fora do início', '<a><?xml version="1.0"?></a>'],
    ['declaração XML malformada', '<?xml versao="1.0"?><a/>'],
    ['PI malformada', '<a><?x#y?></a>'],
    ['alvo de PI com dois-pontos', '<a><?a:b x?></a>'],
    ['nome inválido', '<1a/>'],
    ['tag de abertura sem >', '<a x="1"'],
    ['barra solta', '<a / >'],
    ['tag de fechamento sem >', '<a></a'],
    ['surrogate alto solto', '<a>\uD800</a>'],
    ['surrogate baixo solto', '<a>\uDC00</a>'],
    ['U+FFFE', '<a>\uFFFE</a>'],
  ];
  for (const [label, xml] of cases) {
    test(label, () => {
      expect(parseError(xml).code).toBe('xml_malformado');
    });
  }
});
