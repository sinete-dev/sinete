import { describe, expect, test } from 'bun:test';
import { lerMotivoDaSefaz } from '../src/index.ts';

describe('lerMotivoDaSefaz', () => {
  test('cStat e xMotivo em qualquer prefixo e namespace', () => {
    expect(
      lerMotivoDaSefaz(
        '<a:ret xmlns:a="urn:x"><a:cStat>656</a:cStat><a:xMotivo> Rejeicao:  Consumo Indevido </a:xMotivo></a:ret>',
      ),
    ).toEqual({
      cStat: '656',
      xMotivo: 'Rejeicao: Consumo Indevido',
    });
  });

  test('vale para corpo que não é XML bem formado', () => {
    expect(lerMotivoDaSefaz('<html><body><cStat>999</cStat><xMotivo>Erro nao catalogado</xMotivo>')).toEqual({
      cStat: '999',
      xMotivo: 'Erro nao catalogado',
    });
  });

  test('sem cStat, ou com cStat vazio, não há motivo', () => {
    expect(lerMotivoDaSefaz('<html><body>Service Unavailable</body></html>')).toBeUndefined();
    expect(lerMotivoDaSefaz('<ret><cStat></cStat><xMotivo>x</xMotivo></ret>')).toBeUndefined();
  });

  test('cStat sem xMotivo', () => {
    expect(lerMotivoDaSefaz('<ret><cStat>108</cStat></ret>')).toEqual({ cStat: '108' });
  });

  test('CDATA e entidades decodificadas', () => {
    expect(
      lerMotivoDaSefaz(
        '<ret><cStat><![CDATA[225]]></cStat><xMotivo><![CDATA[Rejeicao: Falha no Schema <x>]]></xMotivo></ret>',
      ),
    ).toEqual({
      cStat: '225',
      xMotivo: 'Rejeicao: Falha no Schema <x>',
    });
    expect(
      lerMotivoDaSefaz('<ret><cStat>225</cStat><xMotivo>Falha &lt;x&gt; &amp; &#233;&#xE7;</xMotivo></ret>'),
    ).toEqual({
      cStat: '225',
      xMotivo: 'Falha <x> & éç',
    });
  });

  test('o motivo é só o do mesmo grupo do cStat, nunca de outro', () => {
    expect(
      lerMotivoDaSefaz(
        '<ret><xMotivo>Lote processado</xMotivo><prot><cStat>302</cStat><xMotivo>Uso denegado</xMotivo></prot></ret>',
      ),
    ).toEqual({ cStat: '302', xMotivo: 'Uso denegado' });
    expect(lerMotivoDaSefaz('<ret><cStat>302</cStat><outro>x</outro><xMotivo>Uso denegado</xMotivo></ret>')).toEqual({
      cStat: '302',
    });
  });

  test('CDATA com espaços em volta, misturada com texto, e referência inválida nunca lançam', () => {
    expect(
      lerMotivoDaSefaz(
        '<ret><cStat>\n  <![CDATA[225]]>\n</cStat>\n<xMotivo>\n<![CDATA[Rejeicao: Falha no Schema]]>\n</xMotivo></ret>',
      ),
    ).toEqual({
      cStat: '225',
      xMotivo: 'Rejeicao: Falha no Schema',
    });
    expect(lerMotivoDaSefaz('<ret><cStat>225</cStat><xMotivo>Falha <![CDATA[<x>]]> &amp; fim</xMotivo></ret>')).toEqual(
      {
        cStat: '225',
        xMotivo: 'Falha <x> & fim',
      },
    );
    expect(
      lerMotivoDaSefaz(
        '<ret><cStat>225</cStat><xMotivo>A &#x110000; B &#0; C &#xD800; D &#99999999999999999999; E</xMotivo></ret>',
      ),
    ).toEqual({
      cStat: '225',
      xMotivo: 'A &#x110000; B &#0; C &#xD800; D &#99999999999999999999; E',
    });
  });
});
