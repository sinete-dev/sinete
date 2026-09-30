import { describe, expect, test } from 'bun:test';
import {
  contentTypeSoap12,
  ErroPolitica,
  envelopeSoap12,
  lerBodySoap,
  lerSoapFault,
  politicaDeHostsPermitidos,
  SOAP12_NS,
  todasAsPoliticas,
} from '../src/index.ts';

describe('SOAP 1.2', () => {
  const signed = '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe1">&amp;</infNFe><Signature/></NFe>';

  test('envelope insere o corpo como texto, sem tocar nele', () => {
    const env = envelopeSoap12(`<nfeDadosMsg>${signed}</nfeDadosMsg>`);
    expect(env).toStartWith('<?xml version="1.0" encoding="utf-8"?>');
    expect(env).toContain(`xmlns:soap12="${SOAP12_NS}"`);
    expect(env).toContain(signed);
    expect(lerBodySoap(env)).toBe(`<nfeDadosMsg>${signed}</nfeDadosMsg>`);
    expect(envelopeSoap12('<b/>', { cabecalho: '<h/>' })).toContain(
      '<soap12:Header><h/></soap12:Header><soap12:Body><b/>',
    );
  });

  test('corpo com declaração XML é recusado', () => {
    expect(() => envelopeSoap12('<?xml version="1.0"?><x/>')).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
    expect(() => envelopeSoap12('<x/>', { cabecalho: ' <?xml version="1.0"?><h/>' })).toThrow(/cabeçalho/);
  });

  test('content-type com action', () => {
    expect(contentTypeSoap12()).toBe('application/soap+xml; charset=utf-8');
    expect(contentTypeSoap12('http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF')).toBe(
      'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
    );
    expect(() => contentTypeSoap12('a"b')).toThrow(expect.objectContaining({ code: 'config_invalida' }));
  });

  test('Body de resposta com outro prefixo e sem prefixo', () => {
    expect(lerBodySoap('<env:Envelope xmlns:env="x"><env:Body attr="1"><r>1</r></env:Body></env:Envelope>')).toBe(
      '<r>1</r>',
    );
    expect(lerBodySoap('<Envelope><Body><r/></Body></Envelope>')).toBe('<r/>');
    expect(() => lerBodySoap('<html>erro</html>')).toThrow(expect.objectContaining({ code: 'resposta_invalida' }));
    expect(() => lerBodySoap('<s:Envelope><s:Body><r/>')).toThrow(
      expect.objectContaining({ code: 'resposta_invalida' }),
    );
  });

  test('Fault 1.2 e 1.1', () => {
    const f12 =
      '<soap:Envelope><soap:Body><soap:Fault><soap:Code><soap:Value>soap:Receiver</soap:Value></soap:Code><soap:Reason><soap:Text xml:lang="pt">Erro   interno</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>';
    expect(lerSoapFault(f12)).toEqual({ code: 'soap:Receiver', reason: 'Erro interno' });
    expect(lerSoapFault('<s:Fault><faultcode>s:Client</faultcode><faultstring>x</faultstring></s:Fault>')).toEqual({
      code: 's:Client',
      reason: 'x',
    });
    expect(lerSoapFault('<ok/>')).toBeUndefined();
  });
});

describe('politicaDeHostsPermitidos', () => {
  const req = (url: string, body?: string, method: 'POST' | 'GET' = 'POST') => ({
    url: new URL(url),
    metodo: method,
    corpo: body,
    endpoint: undefined,
  });
  const p = politicaDeHostsPermitidos({ hosts: ['Hom.Exemplo.invalid'], tpAmb: '2', exigirTpAmbNoCorpo: true });

  test('host, porta e tpAmb', () => {
    expect(() => p.conferir(req('https://hom.exemplo.invalid/ws', '<tpAmb>2</tpAmb>'))).not.toThrow();
    expect(() => p.conferir(req('https://prod.exemplo.invalid/ws', '<tpAmb>2</tpAmb>'))).toThrow(ErroPolitica);
    expect(() => p.conferir(req('https://hom.exemplo.invalid:8443/ws', '<tpAmb>2</tpAmb>'))).toThrow(/porta/);
    expect(() =>
      p.conferir(req('https://hom.exemplo.invalid/ws', '<a><tpAmb>2</tpAmb><b:tpAmb> 1 </b:tpAmb></a>')),
    ).toThrow(/tpAmb diferente de 2/);
    expect(() => p.conferir(req('https://hom.exemplo.invalid/ws', '<x/>'))).toThrow(/sem tpAmb/);
    expect(() => p.conferir(req('https://hom.exemplo.invalid/ws', undefined, 'GET'))).not.toThrow();
    const bytes = new TextEncoder().encode('<tpAmb>1</tpAmb>');
    expect(() => p.conferir({ ...req('https://hom.exemplo.invalid/ws'), corpo: bytes })).toThrow(
      expect.objectContaining({ code: 'politica_recusou' }),
    );
  });

  test('tpAmb com namespace, atributos, vazio, em comentário ou CDATA', () => {
    const url = 'https://hom.exemplo.invalid/ws';
    const bad = [
      '<tpAmb xmlns="http://www.portalfiscal.inf.br/nfe">1</tpAmb>',
      '<nfe:tpAmb a="x" >1</nfe:tpAmb><tpAmb>2</tpAmb>',
      '<tpAmb/>',
      '<tpAmb>2<x/></tpAmb><tpAmb>\n 1 \n</tpAmb>',
    ];
    for (const b of bad)
      expect(() => p.conferir(req(url, b))).toThrow(expect.objectContaining({ code: 'politica_recusou' }));
    // comentário e CDATA não contam como elemento: o corpo abaixo não tem tpAmb de verdade
    expect(() => p.conferir(req(url, '<x><!--<tpAmb>2</tpAmb>--><![CDATA[<tpAmb>2</tpAmb>]]></x>'))).toThrow(
      /sem tpAmb/,
    );
    expect(() => p.conferir(req(url, '<x><!--<tpAmb>1</tpAmb>--><tpAmb xmlns="n">2</tpAmb></x>'))).not.toThrow();
    expect(() => p.conferir(req(url, '<tpAmbiente>1</tpAmbiente><tpAmb>2</tpAmb>'))).not.toThrow();
  });

  test('sem tpAmb configurado, só host e porta', () => {
    const q = politicaDeHostsPermitidos({ hosts: ['a.invalid'], portas: [443, 8443] });
    expect(() => q.conferir(req('https://a.invalid:8443/', '<tpAmb>1</tpAmb>'))).not.toThrow();
  });

  test('todasAsPoliticas exige todas', async () => {
    const both = todasAsPoliticas(
      politicaDeHostsPermitidos({ hosts: ['a.invalid', 'b.invalid'] }),
      politicaDeHostsPermitidos({ hosts: ['a.invalid'] }),
    );
    await expect(both.conferir(req('https://a.invalid/'))).resolves.toBeUndefined();
    await expect(both.conferir(req('https://b.invalid/'))).rejects.toMatchObject({ code: 'politica_recusou' });
  });
});
