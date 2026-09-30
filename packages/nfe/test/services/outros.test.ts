import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao, ErroDeValidacao, ErroNaoSuportado, ErroRespostaInvalida } from '@sinete/core';
import { assinarXml, conferirAssinatura, lerXml } from '@sinete/core/xml';
import { nfceEndpoint, nfeEndpoint } from '@sinete/transport';
import { documentoAssinado, gunzipBase64, sliceElement } from '../../src/services/index.ts';
import {
  CNPJ_DEST,
  CNPJ_EMIT,
  CPF_EMIT,
  chave,
  client,
  fakeTransport,
  gzipBase64,
  mensagem,
  NFE_NS,
  nfeAssinada,
  SOAP12,
  soap,
  testSigner,
} from './helpers.ts';

function retInut(
  cStat: string,
  xMotivo = 'Inutilização de número homologado',
  f: { CNPJ?: string; mod?: string; serie?: string; ini?: string; fin?: string } = {},
): string {
  return (
    `<retInutNFe xmlns="${NFE_NS}" versao="4.00"><infInut Id="ID351000000000003"><tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic>` +
    `<cStat>${cStat}</cStat><xMotivo>${xMotivo}</xMotivo><cUF>35</cUF><ano>26</ano><CNPJ>${f.CNPJ ?? CNPJ_EMIT}</CNPJ><mod>${f.mod ?? '55'}</mod>` +
    `<serie>${f.serie ?? '1'}</serie><nNFIni>${f.ini ?? '10'}</nNFIni><nNFFin>${f.fin ?? '12'}</nNFFin><dhRecbto>2026-09-10T09:00:00-03:00</dhRecbto>` +
    `${cStat === '102' ? '<nProt>135260000000003</nProt>' : ''}</infInut></retInutNFe>`
  );
}

describe('inutilizar', () => {
  test('Id com cUF, ano de 2 dígitos, CNPJ, modelo, série e números preenchidos; assinado; procInutNFe', async () => {
    const t = fakeTransport(soap(retInut('102'), 'NFeInutilizacao4'));
    const { c } = await client(t, { autor: { CNPJ: CNPJ_EMIT } });
    const r = await c.inutilizar({
      ano: 2026,
      serie: 1,
      nNFIni: 10,
      nNFFin: 12,
      xJust: 'Quebra de sequência na emissão',
    });
    expect(r.tipo).toBe('autorizado');
    if (r.tipo !== 'autorizado') return;
    const id = `ID3526${CNPJ_EMIT}55001000000010000000012`;
    expect(id).toHaveLength(43);
    const msg = mensagem(t.requests[0] as never);
    expect(
      msg.startsWith(
        `<inutNFe xmlns="${NFE_NS}" versao="4.00"><infInut Id="${id}"><tpAmb>2</tpAmb><xServ>INUTILIZAR</xServ><cUF>35</cUF><ano>26</ano><CNPJ>${CNPJ_EMIT}</CNPJ><mod>55</mod><serie>1</serie><nNFIni>10</nNFIni><nNFFin>12</nNFFin>`,
      ),
    ).toBe(true);
    expect((await conferirAssinatura(msg, { id, elemento: 'infInut' })).ok).toBe(true);
    expect(t.requests[0]?.url).toBe(nfeEndpoint({ ambiente: 'homologacao', servico: 'NfeInutilizacao', uf: 'SP' }).url);
    expect(r.valor.nProt).toBe('135260000000003');
    expect(r.valor.procInutNFe).toBe(
      // O retInutNFe declara o próprio xmlns na resposta: a fatia o mantém, como veio.
      `<ProcInutNFe xmlns="${NFE_NS}" versao="4.00">${msg}${r.valor.retInutNFe}</ProcInutNFe>`,
    );
    expect(r.valor.retInutNFe.startsWith(`<retInutNFe xmlns="${NFE_NS}" versao="4.00">`)).toBe(true);
  });

  test('NFC-e (modelo 65): vai ao endpoint da NFC-e dado nas opções; sem ele, à tabela da NFC-e', async () => {
    const pedido = {
      ano: 2026,
      serie: 1,
      nNFIni: 1,
      nNFFin: 1,
      mod: '65' as const,
      xJust: 'Quebra de sequência na emissão',
    };
    const padrao = fakeTransport(
      soap(retInut('102', undefined, { mod: '65', ini: '1', fin: '1' }), 'NFeInutilizacao4'),
    );
    const { c: sem } = await client(padrao, { autor: { CNPJ: CNPJ_EMIT } });
    await sem.inutilizar(pedido);
    expect(padrao.requests[0]?.url).toBe(
      nfceEndpoint({ ambiente: 'homologacao', servico: 'NfeInutilizacao', uf: 'SP' }).url,
    );
    const t = fakeTransport(soap(retInut('102', undefined, { mod: '65', ini: '1', fin: '1' }), 'NFeInutilizacao4'));
    const nfce = {
      ...nfeEndpoint({ ambiente: 'homologacao', servico: 'NfeInutilizacao', uf: 'SP' }),
      url: 'https://nfce.exemplo.invalid/ws/NFeInutilizacao4.asmx',
    };
    const { c } = await client(t, { autor: { CNPJ: CNPJ_EMIT }, nfceEndpoint: () => nfce });
    await c.inutilizar(pedido);
    expect(t.requests[0]?.url).toBe(nfce.url);
  });

  test('homologação de outra faixa é ErroRespostaInvalida', async () => {
    const t = fakeTransport(soap(retInut('102', undefined, { fin: '13' }), 'NFeInutilizacao4'));
    const { c } = await client(t, { autor: { CNPJ: CNPJ_EMIT } });
    await expect(
      c.inutilizar({ ano: 2026, serie: 1, nNFIni: 10, nNFFin: 12, xJust: 'Quebra de sequência na emissão' }),
    ).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });

  test('cliente em contingência SVC (MT, SVC-RS) inutiliza no autorizador normal da UF', async () => {
    const t = fakeTransport(soap(retInut('102', undefined, { ini: '1', fin: '1' }), 'NFeInutilizacao4'));
    const { c } = await client(t, { autor: { CNPJ: CNPJ_EMIT }, uf: 'MT', contingencia: 'svc' });
    await c.inutilizar({ ano: 2026, serie: 1, nNFIni: 1, nNFFin: 1, xJust: 'Quebra de sequência na emissão' });
    expect(t.requests[0]?.url).toBe(nfeEndpoint({ ambiente: 'homologacao', servico: 'NfeInutilizacao', uf: 'MT' }).url);
  });

  test('emitente CPF e série 910 a 969 são ErroDeValidacao sem enviar (NT 2018.001, itens 6.1 e 6.2)', async () => {
    const t = fakeTransport();
    const { c } = await client(t);
    const pedido = { ano: '26', nNFIni: '1', nNFFin: '1', xJust: 'Quebra de sequência na emissão' };
    const cpf = await c.inutilizar({ ...pedido, serie: '920', autor: { CPF: CPF_EMIT } }).catch((e: unknown) => e);
    expect(cpf).toBeInstanceOf(ErroDeValidacao);
    expect((cpf as ErroDeValidacao).ocorrencias.map((i) => i.code)).toEqual(['inutilizacao_emitente_cpf']);
    for (const serie of ['910', '969']) {
      const e = await c.inutilizar({ ...pedido, serie, autor: { CNPJ: CNPJ_EMIT } }).catch((x: unknown) => x);
      expect((e as ErroDeValidacao).ocorrencias.map((i) => i.code)).toEqual(['inutilizacao_serie_cpf']);
    }
    expect(t.requests).toHaveLength(0);
  });

  test('rejeição e validações locais', async () => {
    const t = fakeTransport(soap(retInut('241', 'Rejeição: Um número da faixa já foi utilizado')));
    const { c } = await client(t, { autor: { CNPJ: CNPJ_EMIT } });
    const ok = { ano: 26, serie: 1, nNFIni: 10, nNFFin: 12, xJust: 'Quebra de sequência na emissão' };
    expect((await c.inutilizar(ok)).cStat).toBe('241');
    for (const bad of [{ ano: 202 }, { serie: 1000 }, { nNFIni: 0 }, { nNFFin: '1234567890' }, { nNFIni: 20 }]) {
      await expect(c.inutilizar({ ...ok, ...bad })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    }
    await expect(c.inutilizar({ ...ok, xJust: 'curta' })).rejects.toBeInstanceOf(ErroDeValidacao);
    const { c: semAutor } = await client(fakeTransport());
    await expect(semAutor.inutilizar(ok)).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });
});

describe('consultarCadastro', () => {
  const ret = (cStat: string, infCad = '') =>
    soap(
      `<retConsCad xmlns="${NFE_NS}" versao="2.00"><infCons><verAplic>MT</verAplic><cStat>${cStat}</cStat><xMotivo>Consulta cadastro com uma ocorrência</xMotivo><UF>MT</UF><CNPJ>${CNPJ_DEST}</CNPJ><dhCons>2026-09-10T08:00:00-04:00</dhCons><cUF>51</cUF>${infCad}</infCons></retConsCad>`,
      'CadConsultaCadastro4',
    );
  const infCad = `<infCad><IE>123456789</IE><CNPJ>${CNPJ_DEST}</CNPJ><UF>MT</UF><cSit>1</cSit><indCredNFe>1</indCredNFe><indCredCTe>4</indCredCTe><xNome>EMPRESA SINTETICA LTDA</xNome></infCad>`;

  test('111 por CNPJ, na UF pedida e sem contingência', async () => {
    const t = fakeTransport(ret('111', infCad));
    const { c } = await client(t, { contingencia: 'svc' });
    const r = await c.consultarCadastro({ uf: 'MT', CNPJ: CNPJ_DEST });
    expect(r.tipo).toBe('autorizado');
    if (r.tipo !== 'autorizado') return;
    expect(r.valor.UF).toBe('MT');
    expect(r.valor.infCad[0]?.xNome).toBe('EMPRESA SINTETICA LTDA');
    expect(t.requests[0]?.url).toBe(
      nfeEndpoint({ ambiente: 'homologacao', servico: 'NfeConsultaCadastro', uf: 'MT' }).url,
    );
    expect(mensagem(t.requests[0] as never)).toBe(
      `<ConsCad xmlns="${NFE_NS}" versao="2.00"><infCons><xServ>CONS-CAD</xServ><UF>MT</UF><CNPJ>${CNPJ_DEST}</CNPJ></infCons></ConsCad>`,
    );
  });

  test('no MT a mensagem vai dentro do elemento da operação; nas outras UFs, só em nfeDadosMsg', async () => {
    const t = fakeTransport(ret('111', infCad), ret('111', infCad));
    const { c } = await client(t);
    await c.consultarCadastro({ uf: 'MT', CNPJ: CNPJ_DEST });
    await c.consultarCadastro({ uf: 'SP', CNPJ: CNPJ_DEST });
    const corpo = (i: number) => String((t.requests[i] as { body: unknown }).body);
    expect(corpo(0)).toContain(
      '<consultaCadastro xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4"><nfeDadosMsg><ConsCad',
    );
    expect(corpo(1)).toContain(
      '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4"><ConsCad',
    );
    expect(corpo(1)).not.toContain('<consultaCadastro');
  });

  test('retConsCad sem o namespace da NF-e e com os filhos nele (forma da SEFAZ-MG) é aceito', async () => {
    const mg = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://www.w3.org/2003/05/soap-envelope"><S:Body><consultaCadastro4Result xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4"><retConsCad xmlns:ns2="${NFE_NS}" versao="2.00"><infCons xmlns="${NFE_NS}"><verAplic>MG</verAplic><cStat>111</cStat><xMotivo>Consulta cadastro com uma ocorrência</xMotivo><UF>MG</UF><CNPJ>${CNPJ_DEST}</CNPJ><dhCons>2026-09-28T15:55:17-03:00</dhCons><cUF>31</cUF><infCad><IE>123456789</IE><CNPJ>${CNPJ_DEST}</CNPJ><UF>MG</UF><cSit>1</cSit><indCredNFe>1</indCredNFe><indCredCTe>4</indCredCTe><xNome>EMPRESA SINTETICA LTDA</xNome></infCad></infCons></retConsCad></consultaCadastro4Result></S:Body></S:Envelope>`;
    const { c } = await client(fakeTransport(mg));
    const r = await c.consultarCadastro({ uf: 'MG', CNPJ: CNPJ_DEST });
    expect(r.tipo).toBe('autorizado');
    expect(r.tipo === 'autorizado' && r.valor.infCad[0]?.xNome).toBe('EMPRESA SINTETICA LTDA');
  });

  test('retConsCad fora do namespace com filhos também fora continua recusado', async () => {
    const torto = soap(
      `<retConsCad versao="2.00"><infCons><cStat>111</cStat></infCons></retConsCad>`,
      'CadConsultaCadastro4',
    ).replace(/<nfeResultMsg xmlns="[^"]*">/, '<nfeResultMsg>');
    const { c } = await client(fakeTransport(torto));
    await expect(c.consultarCadastro({ uf: 'MG', CNPJ: CNPJ_DEST })).rejects.toMatchObject({
      code: 'resposta_invalida',
    });
  });

  test('por CPF e por IE (máscara removida); 259 rejeitado; sem infCad vira lista vazia', async () => {
    const t = fakeTransport(ret('112'), ret('259'));
    const { c } = await client(t);
    const r = await c.consultarCadastro({ uf: 'MT', CPF: CPF_EMIT });
    expect(r.tipo === 'autorizado' && r.valor.infCad).toEqual([]);
    expect(mensagem(t.requests[0] as never)).toContain(`<CPF>${CPF_EMIT}</CPF>`);
    expect((await c.consultarCadastro({ uf: 'MT', IE: '12.345.678-9' })).tipo).toBe('recusado');
    expect(mensagem(t.requests[1] as never)).toContain('<IE>123456789</IE>');
  });
});

describe('distribuicaoDFe', () => {
  const ret = (cStat: string, lote = '', xMotivo = 'Documento localizado') =>
    soap(
      `<retDistDFeInt xmlns="${NFE_NS}" versao="1.01"><tpAmb>2</tpAmb><verAplic>1.7.0</verAplic><cStat>${cStat}</cStat><xMotivo>${xMotivo}</xMotivo><dhResp>2026-09-10T09:00:00-03:00</dhResp><ultNSU>000000000000012</ultNSU><maxNSU>000000000000020</maxNSU>${lote}</retDistDFeInt>`,
      'NFeDistribuicaoDFe',
    );

  test('138: descompacta, classifica e decodifica os resumos; envelope do AN', async () => {
    const ch = chave({ emitente: CNPJ_DEST });
    const resNFe = `<resNFe xmlns="${NFE_NS}" versao="1.01"><chNFe>${ch}</chNFe><CNPJ>${CNPJ_DEST}</CNPJ><xNome>FORNECEDOR SINTETICO</xNome><IE>123456789</IE><dhEmi>2026-09-01T10:00:00-03:00</dhEmi><tpNF>1</tpNF><vNF>150.00</vNF><dhRecbto>2026-09-01T10:00:05-03:00</dhRecbto><nProt>135260000000009</nProt><cSitNFe>1</cSitNFe></resNFe>`;
    const resEvento = `<resEvento xmlns="${NFE_NS}" versao="1.01"><cOrgao>35</cOrgao><CNPJ>${CNPJ_DEST}</CNPJ><chNFe>${ch}</chNFe><dhEvento>2026-09-02T10:00:00-03:00</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><xEvento>Cancelamento</xEvento><dhRecbto>2026-09-02T10:00:01-03:00</dhRecbto><nProt>135260000000010</nProt></resEvento>`;
    const procNFe = `<nfeProc xmlns="${NFE_NS}" versao="4.00"><NFe/></nfeProc>`;
    const procEv = `<procEventoNFe xmlns="${NFE_NS}" versao="1.00"/>`;
    const docs = [
      ['000000000000009', 'resNFe_v1.01.xsd', resNFe],
      ['000000000000010', 'resEvento_v1.01.xsd', resEvento],
      ['000000000000011', 'procNFe_v4.00.xsd', procNFe],
      ['000000000000012', 'procEventoNFe_v1.00.xsd', procEv],
      ['000000000000013', 'resCTe_v1.00.xsd', '<x/>'],
    ] as const;
    let lote = '<loteDistDFeInt>';
    for (const [nsu, schema, xml] of docs)
      lote += `<docZip NSU="${nsu}" schema="${schema}">${await gzipBase64(xml)}</docZip>`;
    lote += '</loteDistDFeInt>';
    const t = fakeTransport(ret('138', lote));
    const { c } = await client(t, { autor: { CNPJ: CNPJ_DEST } });
    const r = await c.distribuicaoDFe({ ultNSU: 8 });
    expect(r.tipo).toBe('autorizado');
    if (r.tipo !== 'autorizado') return;
    expect(r.valor.ultNSU).toBe('000000000000012');
    expect(r.valor.maxNSU).toBe('000000000000020');
    expect(r.valor.documentos.map((d) => d.tipo)).toEqual(['resNFe', 'resEvento', 'procNFe', 'procEventoNFe', 'outro']);
    expect(r.valor.documentos.map((d) => d.xml)).toEqual(docs.map((d) => d[2]));
    expect(r.valor.documentos[0]?.resNFe?.vNF).toBe('150.00');
    expect(r.valor.documentos[1]?.resEvento?.tpEvento).toBe('110111');
    const req = t.requests[0];
    expect(req?.url).toBe(nfeEndpoint({ ambiente: 'homologacao', servico: 'NFeDistribuicaoDFe' }).url);
    expect(req?.headers['content-type']).toContain(
      'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    );
    expect(req?.body).toContain(
      `<soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg><distDFeInt xmlns="${NFE_NS}" versao="1.01"><tpAmb>2</tpAmb><cUFAutor>35</cUFAutor><CNPJ>${CNPJ_DEST}</CNPJ><distNSU><ultNSU>000000000000008</ultNSU></distNSU></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse>`,
    );
  });

  test('137 sem documentos; consNSU e consChNFe; cUFAutor explícito', async () => {
    const ch = chave();
    const t = fakeTransport(ret('137', '', 'Nenhum documento localizado'), ret('137'));
    const { c } = await client(t);
    const r = await c.distribuicaoDFe({ NSU: '5' }, { autor: { CPF: CPF_EMIT }, cUFAutor: '51' });
    expect(r.tipo === 'autorizado' && r.valor.documentos).toEqual([]);
    expect(mensagem(t.requests[0] as never)).toContain(
      `<cUFAutor>51</cUFAutor><CPF>${CPF_EMIT}</CPF><consNSU><NSU>000000000000005</NSU></consNSU>`,
    );
    await c.distribuicaoDFe({ chNFe: ch }, { autor: { CNPJ: CNPJ_DEST } });
    expect(mensagem(t.requests[1] as never)).toContain(`<consChNFe><chNFe>${ch}</chNFe></consChNFe>`);
  });

  test('656 rejeitado com dica de espera; entradas inválidas', async () => {
    const t = fakeTransport(ret('656', '', 'Rejeição: Consumo Indevido'));
    const { c } = await client(t, { autor: { CNPJ: CNPJ_DEST } });
    const r = await c.distribuicaoDFe({ ultNSU: '0' });
    expect(r.tipo).toBe('recusado');
    if (r.tipo === 'recusado') expect(`${r.dica?.comoCorrigir}`).toMatch(/hora/);
    await expect(c.distribuicaoDFe({ ultNSU: 'x' })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(c.distribuicaoDFe({ ultNSU: 1 }, { cUFAutor: '99' })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(c.distribuicaoDFe({ chNFe: '1' })).rejects.toBeInstanceOf(ErroDeValidacao);
  });
});

describe('gunzipBase64', () => {
  test('ida e volta com CompressionStream; base64 inválido e gzip inválido são ErroRespostaInvalida', async () => {
    const texto = '<resNFe>ação ✓</resNFe>';
    expect(await gunzipBase64(await gzipBase64(texto))).toBe(texto);
    await expect(gunzipBase64('***')).rejects.toBeInstanceOf(ErroRespostaInvalida);
    await expect(gunzipBase64(btoa('nao e gzip'))).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });

  test('sem DecompressionStream é ErroNaoSuportado', async () => {
    const original = globalThis.DecompressionStream;
    try {
      // @ts-expect-error simulando runtime sem a API
      globalThis.DecompressionStream = undefined;
      await expect(gunzipBase64('AAAA')).rejects.toBeInstanceOf(ErroNaoSuportado);
    } finally {
      globalThis.DecompressionStream = original;
    }
  });
});

describe('respostas SOAP defeituosas', () => {
  test('fault SOAP 1.2 vira ErroRespostaInvalida com código e motivo', async () => {
    const fault = `<soap:Envelope xmlns:soap="${SOAP12}"><soap:Body><soap:Fault><soap:Code><soap:Value>soap:Receiver</soap:Value></soap:Code><soap:Reason><soap:Text xml:lang="pt">Erro interno</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>`;
    const { c } = await client(fakeTransport({ status: 500, body: fault }));
    const e = await c.statusServico().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroRespostaInvalida);
    expect((e as ErroRespostaInvalida).detalhes).toMatchObject({
      status: 500,
      code: 'soap:Receiver',
      reason: 'Erro interno',
    });
  });

  test('HTML, retorno ausente e retorno sem cStat', async () => {
    const { c } = await client(
      fakeTransport(
        { status: 403, body: '<html><body>Forbidden' },
        soap(`<outro xmlns="${NFE_NS}"/>`),
        soap(`<retConsStatServ xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb></retConsStatServ>`),
      ),
    );
    for (let i = 0; i < 3; i++) await expect(c.statusServico()).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });
});

describe('proc: fatias e documento assinado', () => {
  test('sliceElement injeta os prefixos usados que vêm de ancestrais e o default quando difere', () => {
    const src = `<a:raiz xmlns:a="urn:a" xmlns:b="urn:b" xmlns="urn:d"><a:x b:attr="1"><y/><c:z xmlns:c="urn:c"/></a:x><w/></a:raiz>`;
    const doc = lerXml(src);
    const x = doc.raiz.filhos.find((n) => n.tipo === 'elemento' && n.local === 'x');
    const w = doc.raiz.filhos.find((n) => n.tipo === 'elemento' && n.local === 'w');
    if (x?.tipo !== 'elemento' || w?.tipo !== 'elemento') throw new Error('árvore');
    expect(sliceElement(doc, x)).toBe(
      '<a:x xmlns="urn:d" xmlns:a="urn:a" xmlns:b="urn:b" b:attr="1"><y/><c:z xmlns:c="urn:c"/></a:x>',
    );
    // o <y/> sem prefixo herda urn:d: no envelope cujo default já é urn:d, nada entra
    expect(sliceElement(doc, x, 'urn:d')).toBe(
      '<a:x xmlns:a="urn:a" xmlns:b="urn:b" b:attr="1"><y/><c:z xmlns:c="urn:c"/></a:x>',
    );
    const cobertos = lerXml('<r xmlns="urn:d"><n:p xmlns:n="urn:n"><q xmlns="urn:q"/></n:p></r>');
    const pp = cobertos.raiz.filhos[0];
    if (pp?.tipo !== 'elemento') throw new Error('árvore');
    expect(sliceElement(cobertos, pp, '')).toBe('<n:p xmlns:n="urn:n"><q xmlns="urn:q"/></n:p>');
    // Prefixo declarado num ancestral e redeclarado dentro do recorte: nada entra na raiz da fatia.
    const redeclarado = lerXml('<r xmlns:p="urn:p"><x><p:y xmlns:p="urn:p"/></x></r>');
    const rx = redeclarado.raiz.filhos[0];
    if (rx?.tipo !== 'elemento') throw new Error('árvore');
    expect(sliceElement(redeclarado, rx, '')).toBe('<x><p:y xmlns:p="urn:p"/></x>');
    expect(sliceElement(doc, w)).toBe('<w xmlns="urn:d"/>');
    expect(sliceElement(doc, w, 'urn:d')).toBe('<w/>');
  });

  test('documentoAssinado lê Id e DigestValue e preserva os bytes', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const a = documentoAssinado(nfe, 'NFe', 'infNFe');
    expect(a.id).toBe(`NFe${ch}`);
    expect(a.xml).toBe(nfe);
    expect(a.digestValue).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(() => documentoAssinado('<NFe', 'NFe', 'infNFe')).toThrow(ErroDeConfiguracao);
  });

  test('raiz assinada com prefixo e sem o default da NF-e é recusada: o envelope mudaria o C14N', async () => {
    const ch = chave();
    const xml = `<n:NFe xmlns:n="${NFE_NS}"><n:infNFe Id="NFe${ch}" versao="4.00"><n:ide/></n:infNFe></n:NFe>`;
    const assinado = await assinarXml(xml, { id: `NFe${ch}` }, await testSigner());
    expect((await conferirAssinatura(assinado, { id: `NFe${ch}` })).ok).toBe(true);
    expect(() => documentoAssinado(assinado, 'NFe', 'infNFe')).toThrow(/xmlns=/);
  });
});
