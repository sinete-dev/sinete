import { describe, expect, test } from 'bun:test';
import {
  allowlistPolicy,
  allPolicies,
  PolicyError,
  SOAP12_NS,
  soap12ContentType,
  soap12Envelope,
  soapBody,
  soapFault,
} from '../src/index.ts';

describe('SOAP 1.2', () => {
  const signed = '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe1">&amp;</infNFe><Signature/></NFe>';

  test('envelope insere o corpo como texto, sem tocar nele', () => {
    const env = soap12Envelope(`<nfeDadosMsg>${signed}</nfeDadosMsg>`);
    expect(env).toStartWith('<?xml version="1.0" encoding="utf-8"?>');
    expect(env).toContain(`xmlns:soap12="${SOAP12_NS}"`);
    expect(env).toContain(signed);
    expect(soapBody(env)).toBe(`<nfeDadosMsg>${signed}</nfeDadosMsg>`);
    expect(soap12Envelope('<b/>', { header: '<h/>' })).toContain(
      '<soap12:Header><h/></soap12:Header><soap12:Body><b/>',
    );
  });

  test('corpo com declaração XML é recusado', () => {
    expect(() => soap12Envelope('<?xml version="1.0"?><x/>')).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
    expect(() => soap12Envelope('<x/>', { header: ' <?xml version="1.0"?><h/>' })).toThrow(/cabeçalho/);
  });

  test('content-type com action', () => {
    expect(soap12ContentType()).toBe('application/soap+xml; charset=utf-8');
    expect(soap12ContentType('http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF')).toBe(
      'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
    );
    expect(() => soap12ContentType('a"b')).toThrow(expect.objectContaining({ code: 'config_invalida' }));
  });

  test('Body de resposta com outro prefixo e sem prefixo', () => {
    expect(soapBody('<env:Envelope xmlns:env="x"><env:Body attr="1"><r>1</r></env:Body></env:Envelope>')).toBe(
      '<r>1</r>',
    );
    expect(soapBody('<Envelope><Body><r/></Body></Envelope>')).toBe('<r/>');
    expect(() => soapBody('<html>erro</html>')).toThrow(expect.objectContaining({ code: 'resposta_invalida' }));
    expect(() => soapBody('<s:Envelope><s:Body><r/>')).toThrow(expect.objectContaining({ code: 'resposta_invalida' }));
  });

  test('Fault 1.2 e 1.1', () => {
    const f12 =
      '<soap:Envelope><soap:Body><soap:Fault><soap:Code><soap:Value>soap:Receiver</soap:Value></soap:Code><soap:Reason><soap:Text xml:lang="pt">Erro   interno</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>';
    expect(soapFault(f12)).toEqual({ code: 'soap:Receiver', reason: 'Erro interno' });
    expect(soapFault('<s:Fault><faultcode>s:Client</faultcode><faultstring>x</faultstring></s:Fault>')).toEqual({
      code: 's:Client',
      reason: 'x',
    });
    expect(soapFault('<ok/>')).toBeUndefined();
  });
});

describe('allowlistPolicy', () => {
  const req = (url: string, body?: string, method: 'POST' | 'GET' = 'POST') => ({
    url: new URL(url),
    method,
    body,
    endpoint: undefined,
  });
  const p = allowlistPolicy({ hosts: ['Hom.Exemplo.invalid'], tpAmb: '2', requireTpAmbInBody: true });

  test('host, porta e tpAmb', () => {
    expect(() => p.check(req('https://hom.exemplo.invalid/ws', '<tpAmb>2</tpAmb>'))).not.toThrow();
    expect(() => p.check(req('https://prod.exemplo.invalid/ws', '<tpAmb>2</tpAmb>'))).toThrow(PolicyError);
    expect(() => p.check(req('https://hom.exemplo.invalid:8443/ws', '<tpAmb>2</tpAmb>'))).toThrow(/porta/);
    expect(() =>
      p.check(req('https://hom.exemplo.invalid/ws', '<a><tpAmb>2</tpAmb><b:tpAmb> 1 </b:tpAmb></a>')),
    ).toThrow(/tpAmb diferente de 2/);
    expect(() => p.check(req('https://hom.exemplo.invalid/ws', '<x/>'))).toThrow(/sem tpAmb/);
    expect(() => p.check(req('https://hom.exemplo.invalid/ws', undefined, 'GET'))).not.toThrow();
    const bytes = new TextEncoder().encode('<tpAmb>1</tpAmb>');
    expect(() => p.check({ ...req('https://hom.exemplo.invalid/ws'), body: bytes })).toThrow(
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
      expect(() => p.check(req(url, b))).toThrow(expect.objectContaining({ code: 'politica_recusou' }));
    // comentário e CDATA não contam como elemento: o corpo abaixo não tem tpAmb de verdade
    expect(() => p.check(req(url, '<x><!--<tpAmb>2</tpAmb>--><![CDATA[<tpAmb>2</tpAmb>]]></x>'))).toThrow(/sem tpAmb/);
    expect(() => p.check(req(url, '<x><!--<tpAmb>1</tpAmb>--><tpAmb xmlns="n">2</tpAmb></x>'))).not.toThrow();
    expect(() => p.check(req(url, '<tpAmbiente>1</tpAmbiente><tpAmb>2</tpAmb>'))).not.toThrow();
  });

  test('sem tpAmb configurado, só host e porta', () => {
    const q = allowlistPolicy({ hosts: ['a.invalid'], ports: [443, 8443] });
    expect(() => q.check(req('https://a.invalid:8443/', '<tpAmb>1</tpAmb>'))).not.toThrow();
  });

  test('allPolicies exige todas', async () => {
    const both = allPolicies(
      allowlistPolicy({ hosts: ['a.invalid', 'b.invalid'] }),
      allowlistPolicy({ hosts: ['a.invalid'] }),
    );
    await expect(both.check(req('https://a.invalid/'))).resolves.toBeUndefined();
    await expect(both.check(req('https://b.invalid/'))).rejects.toMatchObject({ code: 'politica_recusou' });
  });
});
