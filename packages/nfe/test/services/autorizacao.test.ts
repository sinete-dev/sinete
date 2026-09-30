import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao, ErroDeValidacao, ErroRespostaInvalida, relogioFixo } from '@sinete/core';
import { conferirAssinatura } from '@sinete/core/xml';
import { nfceEndpoint, nfeEndpoint } from '@sinete/transport';
import {
  autorizadorContingencia,
  chaveDaDuplicidade,
  createNfeClient,
  documentoAssinado,
  nfeAssinadaDoProc,
  recuperarEventoRegistrado,
  resolverEnvioSemResposta,
} from '../../src/services/index.ts';
import {
  CLOCK_ISO,
  CNPJ_EMIT,
  chave,
  client,
  digestOf,
  fakeTransport,
  mensagem,
  NFE_NS,
  nfeAssinada,
  protNFe,
  retConsReciNFe,
  retConsSitNFe,
  retEnvEvento,
  retEnviNFe,
  soap,
  testSigner,
} from './helpers.ts';

describe('statusServico', () => {
  test('107 autoriza e lê tMed, dhRetorno e xObs; manda cUF da UF e tpAmb', async () => {
    const t = fakeTransport(
      soap(
        `<retConsStatServ xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>107</cStat><xMotivo>Serviço em Operação</xMotivo><cUF>35</cUF><dhRecbto>2026-09-10T09:00:00-03:00</dhRecbto><tMed>1</tMed><dhRetorno>2026-09-10T10:00:00-03:00</dhRetorno><xObs>ok</xObs></retConsStatServ>`,
        'NFeStatusServico4',
      ),
    );
    const { c } = await client(t, { timeoutMs: 5000 });
    const r = await c.statusServico();
    expect(r.tipo).toBe('autorizado');
    if (r.tipo !== 'autorizado') return;
    expect(r.valor).toEqual({
      cUF: '35',
      verAplic: 'SP_NFE_PL009_V4',
      dhRecbto: '2026-09-10T09:00:00-03:00',
      tMed: '1',
      dhRetorno: '2026-09-10T10:00:00-03:00',
      xObs: 'ok',
    });
    const req = t.requests[0];
    expect(req?.url).toBe(nfeEndpoint({ ambiente: 'homologacao', servico: 'NfeStatusServico', uf: 'SP' }).url);
    expect(req?.timeoutMs).toBe(5000);
    expect(req?.headers['content-type']).toContain(
      'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
    );
    expect(req?.body).toContain('<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">');
    expect(mensagem(req as never)).toBe(
      `<consStatServ xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb><cUF>35</cUF><xServ>STATUS</xServ></consStatServ>`,
    );
  });

  test('108 vira rejeição; sem campos opcionais', async () => {
    const t = fakeTransport(
      soap(
        `<retConsStatServ xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb><verAplic>X</verAplic><cStat>108</cStat><xMotivo>Serviço Paralisado Momentaneamente</xMotivo><cUF>35</cUF><dhRecbto>2026-09-10T09:00:00-03:00</dhRecbto></retConsStatServ>`,
      ),
    );
    const { c } = await client(t);
    const r = await c.statusServico();
    expect(r.tipo).toBe('recusado');
    expect(r.cStat).toBe('108');
  });

  test('UF inválida é ErroDeConfiguracao', async () => {
    await expect(client(fakeTransport(), { uf: 'XX' as never })).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });
});

describe('autorizar síncrono', () => {
  test('100: nfeProc com a NF-e assinada byte a byte, protNFe da resposta e assinatura válida', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch, digVal: digestOf(nfe) }) })));
    const { c, logger } = await client(t);
    const r = await c.autorizar(nfe);
    expect(r.tipo).toBe('autorizado');
    if (r.tipo !== 'autorizado') return;
    expect(r.cStat).toBe('100');
    expect(r.valor.nProt).toBe('135260000000001');
    const proc = r.valor.nfeProc as string;
    expect(proc.startsWith(`<nfeProc xmlns="${NFE_NS}" versao="4.00">${nfe}<protNFe`)).toBe(true);
    // Dentro do nfeProc o protNFe herda o default; avulso, leva o próprio xmlns.
    expect(proc).toContain(`${nfe}<protNFe versao="4.00"><infProt`);
    expect(proc.endsWith('</protNFe></nfeProc>')).toBe(true);
    expect(r.valor.protNFe.startsWith(`<protNFe xmlns="${NFE_NS}" versao="4.00">`)).toBe(true);
    const v = await conferirAssinatura(proc, { id: `NFe${ch}`, elemento: 'infNFe' });
    expect(v.ok).toBe(true);
    const msg = mensagem(t.requests[0] as never);
    expect(msg).toBe(
      `<enviNFe xmlns="${NFE_NS}" versao="4.00"><idLote>42</idLote><indSinc>1</indSinc>${nfe}</enviNFe>`,
    );
    expect(t.requests[0]?.url).toBe(nfeEndpoint({ ambiente: 'homologacao', servico: 'NFeAutorizacao', uf: 'SP' }).url);
    expect(JSON.stringify(logger.entradas)).not.toContain('<NFe');
  });

  test('declaração XML e BOM antes da NF-e são descartados; o resto segue intacto', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch, digVal: digestOf(nfe) }) })));
    const { c } = await client(t);
    const r = await c.autorizar(`﻿<?xml version="1.0" encoding="UTF-8"?>\n${nfe}`);
    expect(r.tipo).toBe('autorizado');
    expect(mensagem(t.requests[0] as never)).toContain(`<indSinc>1</indSinc>${nfe}</enviNFe>`);
  });

  test('302 denegada devolve denegado com nfeProc', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(
        retEnviNFe({
          cStat: '104',
          inner: protNFe({ chNFe: ch, cStat: '302', xMotivo: 'Uso Denegado', digVal: digestOf(nfe) }),
        }),
      ),
    );
    const { c } = await client(t);
    const r = await c.autorizar(nfe);
    expect(r.tipo).toBe('denegado');
    if (r.tipo === 'denegado') expect(r.valor.nfeProc).toContain(nfe);
  });

  test('rejeição no protNFe e no lote, com dica do @sinete/rejeicoes quando houver', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(
        retEnviNFe({
          cStat: '104',
          inner: protNFe({ chNFe: ch, cStat: '225', xMotivo: 'Rejeição: Falha no Schema XML', nProt: '' }),
        }),
      ),
      soap(retEnviNFe({ cStat: '656', xMotivo: 'Rejeição: Consumo Indevido' })),
    );
    const { c } = await client(t);
    const r1 = await c.autorizar(nfe);
    expect(r1.tipo).toBe('recusado');
    expect(r1.cStat).toBe('225');
    const r2 = await c.autorizar(nfe);
    expect(r2.tipo).toBe('recusado');
    if (r2.tipo === 'recusado') expect(r2.dica?.comoCorrigir).toBeDefined();
  });

  test('digVal diferente do DigestValue enviado é ErroRespostaInvalida', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch, digVal: 'AAAA' }) })));
    const { c } = await client(t);
    await expect(c.autorizar(nfe)).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });

  test('protocolo de outra chave é ErroRespostaInvalida', async () => {
    const nfe = await nfeAssinada(chave());
    const outra = chave({ nNF: 999 });
    const t = fakeTransport(
      soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: outra, digVal: digestOf(nfe) }) })),
    );
    const { c } = await client(t);
    await expect(c.autorizar(nfe)).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });

  test('protNFe sem digVal: autorizada, mas sem nfeProc (nada prova que o protocolo é deste conteúdo)', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch }) })));
    const { c } = await client(t);
    const r = await c.autorizar(nfe);
    expect(r.tipo).toBe('autorizado');
    expect(r.tipo === 'autorizado' && r.valor.nfeProc).toBeUndefined();
  });

  test('denegação sem digVal: denegado com o protNFe, sem nfeProc', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch, cStat: '302', xMotivo: 'Uso Denegado' }) })),
    );
    const { c } = await client(t);
    const r = await c.autorizar(nfe);
    expect(r.tipo).toBe('denegado');
    if (r.tipo !== 'denegado') return;
    expect(r.valor.nfeProc).toBeUndefined();
    expect(r.valor.digVal).toBeUndefined();
    expect(r.valor.protNFe).toContain('<cStat>302</cStat>');
  });

  test('entrada sem assinatura, sem Id ou fora do namespace é ErroDeConfiguracao', async () => {
    const { c } = await client(fakeTransport());
    await expect(c.autorizar(`<NFe xmlns="${NFE_NS}"><infNFe Id="NFe1"/></NFe>`)).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
    await expect(c.autorizar('<NFe><infNFe Id="NFe1"/></NFe>')).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(c.autorizar(`<NFe xmlns="${NFE_NS}"><infNFe/></NFe>`)).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(c.autorizar(`<nfeProc xmlns="${NFE_NS}"/>`)).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });

  test('idLote padrão vem do relógio; idLote inválido é ErroDeConfiguracao', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch }) })));
    const { c } = await client(t, { idLote: undefined as never });
    await c.autorizar(nfe);
    expect(mensagem(t.requests[0] as never)).toContain(`<idLote>${Date.parse('2026-09-10T12:00:00Z')}</idLote>`);
    const { c: c2 } = await client(fakeTransport(), { idLote: () => 'abc' });
    await expect(c2.autorizar(nfe)).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });
});

describe('autorizar assíncrono e recibo', () => {
  test('103 devolve pendente com o recibo e aguardarMs do tMed', async () => {
    const nfe = await nfeAssinada();
    const t = fakeTransport(
      soap(
        retEnviNFe({
          cStat: '103',
          xMotivo: 'Lote recebido com sucesso',
          inner: '<infRec><nRec>351000000000001</nRec><tMed>3</tMed></infRec>',
        }),
      ),
    );
    const { c } = await client(t);
    const r = await c.autorizar(nfe, { sincrono: false });
    expect(r).toMatchObject({ tipo: 'pendente', referencia: '351000000000001', aguardarMs: 3000 });
    expect(mensagem(t.requests[0] as never)).toContain('<indSinc>0</indSinc>');
  });

  test('103 sem infRec é ErroRespostaInvalida', async () => {
    const t = fakeTransport(soap(retEnviNFe({ cStat: '103' })));
    const { c } = await client(t);
    await expect(c.autorizar(await nfeAssinada(), { sincrono: false })).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });

  test('consultarRecibo: 105 pendente, 104 com o protNFe da chave, 106 rejeitado', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const outra = chave({ nNF: 5 });
    const t = fakeTransport(
      soap(retConsReciNFe({ cStat: '105', xMotivo: 'Lote em processamento' }), 'NFeRetAutorizacao4'),
      soap(
        retConsReciNFe({
          cStat: '104',
          inner: protNFe({ chNFe: outra }) + protNFe({ chNFe: ch, digVal: digestOf(nfe) }),
        }),
        'NFeRetAutorizacao4',
      ),
      soap(retConsReciNFe({ cStat: '106', xMotivo: 'Lote não localizado' }), 'NFeRetAutorizacao4'),
    );
    const { c } = await client(t);
    expect((await c.consultarRecibo('351000000000001')).tipo).toBe('pendente');
    const r = await c.consultarRecibo('351000000000001', nfe);
    expect(r.tipo === 'autorizado' && r.valor.chNFe).toBe(ch);
    expect(
      r.tipo === 'autorizado' && r.valor.nfeProc?.startsWith(`<nfeProc xmlns="${NFE_NS}" versao="4.00">${nfe}`),
    ).toBe(true);
    const r3 = await c.consultarRecibo('351000000000001');
    expect(r3.tipo).toBe('recusado');
    expect(mensagem(t.requests[0] as never)).toBe(
      `<consReciNFe xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb><nRec>351000000000001</nRec></consReciNFe>`,
    );
    expect(t.requests[0]?.url).toBe(
      nfeEndpoint({ ambiente: 'homologacao', servico: 'NFeRetAutorizacao', uf: 'SP' }).url,
    );
  });

  test('consultarRecibo: 104 sem o protNFe da chave é ErroRespostaInvalida; recibo inválido é ErroDeConfiguracao', async () => {
    const nfe = await nfeAssinada();
    const t = fakeTransport(
      soap(
        retConsReciNFe({
          cStat: '104',
          inner: protNFe({ chNFe: chave({ nNF: 5 }) }) + protNFe({ chNFe: chave({ nNF: 6 }) }),
        }),
      ),
    );
    const { c } = await client(t);
    await expect(c.consultarRecibo('351000000000001', nfe)).rejects.toBeInstanceOf(ErroRespostaInvalida);
    await expect(c.consultarRecibo('123')).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });

  test('aguardarRecibo: espera crescente com teto, respeita retryAfter e para ao sair de pendente', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const pend = soap(retConsReciNFe({ cStat: '105' }));
    const t = fakeTransport(
      pend,
      pend,
      pend,
      pend,
      soap(retConsReciNFe({ cStat: '104', inner: protNFe({ chNFe: ch }) })),
    );
    const { c, sleeps } = await client(t);
    const r = await c.aguardarRecibo('351000000000001', nfe, {
      esperaMinimaMs: 1000,
      multiplicador: 2,
      esperaMaximaMs: 5000,
    });
    expect(r.tipo).toBe('autorizado');
    expect(sleeps).toEqual([1000, 2000, 4000, 5000, 5000]);
    expect(t.requests).toHaveLength(5);
  });

  test('aguardarRecibo: esgota as tentativas e devolve o último pendente; padrões', async () => {
    const pend = soap(retConsReciNFe({ cStat: '105' }));
    const t = fakeTransport(...Array.from({ length: 10 }, () => pend));
    const { c, sleeps } = await client(t);
    const r = await c.aguardarRecibo('351000000000001');
    expect(r.tipo).toBe('pendente');
    expect(sleeps).toEqual([2000, 3000, 4500, 6750, 10125, 15188, 22782, 30000, 30000, 30000]);
  });

  test('aguardarRecibo: política inválida é ErroDeConfiguracao; sinal abortado interrompe a espera padrão', async () => {
    const { c } = await client(fakeTransport());
    await expect(c.aguardarRecibo('351000000000001', undefined, { maxTentativas: 0 })).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
    await expect(c.aguardarRecibo('351000000000001', undefined, { multiplicador: 0.5 })).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
    const { c: real } = await client(fakeTransport(), { sleep: undefined as never });
    const ac = new AbortController();
    ac.abort(new Error('parou'));
    await expect(real.aguardarRecibo('351000000000001', undefined, { signal: ac.signal })).rejects.toThrow('parou');
    const ac2 = new AbortController();
    const p = real.aguardarRecibo('351000000000001', undefined, {
      signal: ac2.signal,
      esperaMinimaMs: 60_000,
      esperaMaximaMs: 60_000,
    });
    ac2.abort(new Error('depois'));
    await expect(p).rejects.toThrow('depois');
  });

  test('aguardarRecibo: o signal da política chega à requisição do recibo', async () => {
    const base = fakeTransport(soap(retConsReciNFe({ cStat: '105' })));
    const vistos: (AbortSignal | undefined)[] = [];
    const t: typeof base = {
      ...base,
      enviar: (req) => {
        vistos.push(req.signal);
        return base.enviar(req);
      },
    };
    const { c } = await client(t);
    const ac = new AbortController();
    await c.aguardarRecibo('351000000000001', undefined, { maxTentativas: 1, signal: ac.signal });
    expect(vistos).toEqual([ac.signal]);
  });

  test('retorno de outro recibo é ErroRespostaInvalida', async () => {
    const t = fakeTransport(soap(retConsReciNFe({ cStat: '105', nRec: '351000000000009' })));
    const { c } = await client(t);
    await expect(c.consultarRecibo('351000000000001')).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });

  test('sleep padrão resolve depois do prazo', async () => {
    const t = fakeTransport(soap(retConsReciNFe({ cStat: '106' })));
    const { c } = await client(t, { sleep: undefined as never });
    const r = await c.aguardarRecibo('351000000000001', undefined, { esperaMinimaMs: 1, esperaMaximaMs: 1 });
    expect(r.tipo).toBe('recusado');
  });

  test('sleep padrão remove o listener de abort quando o prazo vence', async () => {
    const pend = soap(retConsReciNFe({ cStat: '105' }));
    const t = fakeTransport(pend, pend, pend);
    const { c } = await client(t, { sleep: undefined as never });
    const ac = new AbortController();
    let ativos = 0;
    const add = ac.signal.addEventListener.bind(ac.signal);
    const remove = ac.signal.removeEventListener.bind(ac.signal);
    ac.signal.addEventListener = ((...a: Parameters<typeof add>) => {
      if (a[0] === 'abort') ativos++;
      add(...a);
    }) as typeof add;
    ac.signal.removeEventListener = ((...a: Parameters<typeof remove>) => {
      if (a[0] === 'abort') ativos--;
      remove(...a);
    }) as typeof remove;
    await c.aguardarRecibo('351000000000001', undefined, {
      maxTentativas: 3,
      esperaMinimaMs: 1,
      esperaMaximaMs: 1,
      signal: ac.signal,
    });
    expect(ativos).toBe(0);
  });
});

describe('consultar', () => {
  const evento = `<procEventoNFe versao="1.00"><evento versao="1.00"><infEvento Id="ID110111x"/></evento><retEvento versao="1.00"><infEvento><cStat>135</cStat></infEvento></retEvento></procEventoNFe>`;

  test('protocolo de outra chave na resposta da consulta é ErroRespostaInvalida, mesmo com o digVal certo', async () => {
    const ch = chave();
    const outra = chave({ nNF: 99 });
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(retConsSitNFe({ cStat: '100', chNFe: ch, inner: protNFe({ chNFe: outra, digVal: digestOf(nfe) }) })),
    );
    const { c } = await client(t);
    await expect(c.consultar(ch, nfe)).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });

  test('autorizada com a NF-e: digVal confere, nfeProc montado, rota pela UF da chave', async () => {
    const ch = chave({ cUF: '41' });
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(
        retConsSitNFe({ cStat: '100', chNFe: ch, inner: protNFe({ chNFe: ch, digVal: digestOf(nfe) }) }),
        'NFeConsultaProtocolo4',
      ),
    );
    const { c } = await client(t);
    const r = await c.consultar(ch, nfe);
    expect(r.tipo).toBe('autorizado');
    if (r.tipo !== 'autorizado') return;
    expect(r.valor.situacao).toBe('autorizada');
    expect(r.valor.digValConfere).toBe(true);
    expect(r.valor.protocolo?.nfeProc).toContain(nfe);
    expect(t.requests[0]?.url).toBe(
      nfeEndpoint({ ambiente: 'homologacao', servico: 'NfeConsultaProtocolo', uf: 'PR' }).url,
    );
    expect(mensagem(t.requests[0] as never)).toBe(
      `<consSitNFe xmlns="${NFE_NS}" versao="4.00"><tpAmb>2</tpAmb><xServ>CONSULTAR</xServ><chNFe>${ch}</chNFe></consSitNFe>`,
    );
  });

  test('cancelada traz eventos como fatias com o namespace; digVal diferente não monta nfeProc', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(
        retConsSitNFe({
          cStat: '101',
          xMotivo: 'Cancelamento de NF-e homologado',
          chNFe: ch,
          inner: protNFe({ chNFe: ch, digVal: 'outro' }) + evento,
        }),
      ),
    );
    const { c } = await client(t);
    const r = await c.consultar(ch, nfe);
    if (r.tipo !== 'autorizado') throw new Error(r.tipo);
    expect(r.valor.situacao).toBe('cancelada');
    expect(r.valor.digValConfere).toBe(false);
    expect(r.valor.protocolo?.nfeProc).toBeUndefined();
    expect(r.valor.eventos).toEqual([evento.replace('<procEventoNFe ', `<procEventoNFe xmlns="${NFE_NS}" `)]);
  });

  test('denegada, sem protNFe e sem a NF-e', async () => {
    const ch = chave();
    const t = fakeTransport(soap(retConsSitNFe({ cStat: '110', xMotivo: 'Uso Denegado', chNFe: ch })));
    const { c } = await client(t);
    const r = await c.consultar(ch);
    expect(r.tipo).toBe('denegado');
    if (r.tipo === 'denegado') {
      expect(r.valor.protocolo).toBeUndefined();
      expect(r.valor.digValConfere).toBeUndefined();
    }
  });

  test('217 é rejeição com dica própria; chave inválida é ErroDeValidacao; NF-e de outra chave é ErroDeConfiguracao', async () => {
    const ch = chave();
    const t = fakeTransport(
      soap(retConsSitNFe({ cStat: '217', xMotivo: 'Rejeição: NF-e não consta na base de dados da SEFAZ', chNFe: ch })),
    );
    const { c } = await client(t);
    const r = await c.consultar(ch);
    expect(r.tipo).toBe('recusado');
    if (r.tipo === 'recusado') expect(r.dica?.fonte).toBeDefined();
    const dvErrado = ch.slice(0, 43) + String((Number(ch[43]) + 1) % 10);
    await expect(c.consultar(dvErrado)).rejects.toBeInstanceOf(ErroDeValidacao);
    await expect(c.consultar(ch, await nfeAssinada(chave({ nNF: 7 })))).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });
});

describe('resolverEnvioSemResposta', () => {
  test('217: reenviar os mesmos bytes', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(soap(retConsSitNFe({ cStat: '217', xMotivo: 'NF-e não consta', chNFe: ch })));
    const { c } = await client(t);
    const r = await resolverEnvioSemResposta(c, nfe);
    expect(r).toEqual({ acao: 'reenviar', nfeAssinada: nfe });
  });

  test('204 seguido de consulta autorizada: concluída com nfeProc do XML gravado', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(retEnviNFe({ cStat: '204', xMotivo: 'Rejeição: Duplicidade de NF-e [nRec:351000000000001]' })),
      soap(retConsSitNFe({ cStat: '100', chNFe: ch, inner: protNFe({ chNFe: ch, digVal: digestOf(nfe) }) })),
    );
    const { c } = await client(t);
    const envio = await c.autorizar(nfe);
    expect(envio.tipo).toBe('recusado');
    const r = await resolverEnvioSemResposta(c, nfe, envio);
    expect(r.acao).toBe('concluida');
    if (r.acao !== 'concluida') return;
    expect(r.situacao).toBe('autorizada');
    expect(r.outcome.tipo).toBe('autorizado');
    expect(r.outcome.cStat).toBe('100');
    if (r.outcome.tipo === 'autorizado') {
      expect(r.outcome.valor.nfeProc).toBe(
        `<nfeProc xmlns="${NFE_NS}" versao="4.00">${nfe}${r.outcome.valor.protNFe.replace(` xmlns="${NFE_NS}"`, '')}</nfeProc>`,
      );
    }
  });

  test('denegada com o mesmo conteúdo: concluída como denegado', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(
        retConsSitNFe({
          cStat: '301',
          chNFe: ch,
          inner: protNFe({ chNFe: ch, cStat: '301', digVal: digestOf(nfe) }),
        }),
      ),
    );
    const { c } = await client(t);
    const r = await resolverEnvioSemResposta(c, nfe);
    expect(r.acao === 'concluida' && r.outcome.tipo).toBe('denegado');
    expect(r.acao === 'concluida' && r.conteudo).toBe('confere');
    expect(r.acao === 'concluida' && r.outcome.tipo === 'denegado' && r.outcome.valor.nfeProc).toContain(nfe);
  });

  test('denegada sem digVal ou com outro digVal: concluída como denegado, sem nfeProc, com o conteúdo dito', async () => {
    // A denegação é da chave (MOC 7.0 Anexo I, tabela 4.4.3): o número está denegado com qualquer conteúdo.
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const denegada = (digVal?: string): string =>
      soap(
        retConsSitNFe({
          cStat: '302',
          chNFe: ch,
          inner: protNFe({
            chNFe: ch,
            cStat: '302',
            xMotivo: 'Uso Denegado',
            ...(digVal === undefined ? {} : { digVal }),
          }),
        }),
      );
    const t = fakeTransport(denegada(), denegada('outro'), soap(retConsSitNFe({ cStat: '302', chNFe: ch })));
    const { c } = await client(t);
    for (const conteudo of ['sem-digval', 'difere'] as const) {
      const r = await resolverEnvioSemResposta(c, nfe);
      expect(r).toMatchObject({ acao: 'concluida', situacao: 'denegada', conteudo });
      if (r.acao !== 'concluida' || r.outcome.tipo !== 'denegado') throw new Error('esperado denegado');
      expect(r.outcome.cStat).toBe('302');
      expect(r.outcome.valor.nfeProc).toBeUndefined();
      expect(r.outcome.valor.protNFe).toContain('<cStat>302</cStat>');
    }
    // Sem o protocolo não há o que guardar: a consulta não decidiu.
    expect((await resolverEnvioSemResposta(c, nfe)).acao).toBe('indefinida');
  });

  test('autorizada ou cancelada sem digVal: sem prova do conteúdo, nunca concluída nem descartada', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(retConsSitNFe({ cStat: '100', chNFe: ch, inner: protNFe({ chNFe: ch }) })),
      soap(retConsSitNFe({ cStat: '101', chNFe: ch, inner: protNFe({ chNFe: ch }) })),
    );
    const { c } = await client(t);
    const r = await resolverEnvioSemResposta(c, nfe);
    expect(r).toMatchObject({ acao: 'sem-prova', situacao: 'autorizada' });
    expect(r.acao === 'sem-prova' && r.consulta.tipo).toBe('autorizado');
    expect(await resolverEnvioSemResposta(c, nfe)).toMatchObject({ acao: 'sem-prova', situacao: 'cancelada' });
  });

  test('539: divergente com a chave extraída do xMotivo, sem consultar', async () => {
    const nfe = await nfeAssinada();
    const outra = chave({ cNF: '87654321' });
    const t = fakeTransport(
      soap(
        retEnviNFe({
          cStat: '539',
          xMotivo: `Rejeição: Duplicidade de NF-e com diferença na Chave de Acesso [chNFe: ${outra}][nRec:351000000000001]`,
        }),
      ),
      soap(retEnviNFe({ cStat: '539', xMotivo: 'Rejeição: Duplicidade de NF-e com diferença na Chave de Acesso' })),
    );
    const { c } = await client(t);
    const r = await resolverEnvioSemResposta(c, nfe, await c.autorizar(nfe));
    expect(r).toMatchObject({ acao: 'divergente', chNFe: outra });
    const r2 = await resolverEnvioSemResposta(c, nfe, await c.autorizar(nfe));
    expect(r2.acao).toBe('divergente');
    expect(r2.acao === 'divergente' && r2.chNFe).toBeUndefined();
    expect(t.requests).toHaveLength(2);
  });

  test('mesma chave com outro conteúdo: divergente; consulta indecisa: indefinida', async () => {
    const ch = chave();
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(retConsSitNFe({ cStat: '100', chNFe: ch, inner: protNFe({ chNFe: ch, digVal: 'outro' }) })),
      soap(retConsSitNFe({ cStat: '656', xMotivo: 'Consumo Indevido', chNFe: ch })),
      soap(retConsSitNFe({ cStat: '100', chNFe: ch, inner: protNFe({ chNFe: ch }) })),
      soap(retConsSitNFe({ cStat: '100', chNFe: ch })),
    );
    const { c } = await client(t);
    expect((await resolverEnvioSemResposta(c, nfe)).acao).toBe('divergente');
    expect((await resolverEnvioSemResposta(c, nfe)).acao).toBe('indefinida');
    // sem digVal não há prova de outro conteúdo nem deste: sem-prova, nunca descartar a nota local
    expect((await resolverEnvioSemResposta(c, nfe)).acao).toBe('sem-prova');
    // sem protocolo, a consulta não decidiu
    expect((await resolverEnvioSemResposta(c, nfe)).acao).toBe('indefinida');
  });

  test('561, 562 e 613 na consulta: divergente, com a chave registrada quando o xMotivo traz', async () => {
    const ch = chave();
    const outra = `${ch.slice(0, 35)}99999999${ch.slice(43)}`;
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(
      soap(
        retConsSitNFe({
          cStat: '562',
          xMotivo: `Rejeição: Código Numérico informado na Chave de Acesso difere do Código Numérico da NF-e [chNFe:${outra}]`,
          chNFe: ch,
        }),
      ),
      soap(
        retConsSitNFe({
          cStat: '561',
          xMotivo: 'Rejeição: Mês de Emissão informado na Chave de Acesso difere',
          chNFe: ch,
        }),
      ),
      soap(retConsSitNFe({ cStat: '613', xMotivo: 'Rejeição: Chave de Acesso difere da existente em BD', chNFe: ch })),
    );
    const { c } = await client(t);
    expect(await resolverEnvioSemResposta(c, nfe)).toMatchObject({ acao: 'divergente', chNFe: outra });
    for (const _ of [561, 613]) {
      const r = await resolverEnvioSemResposta(c, nfe);
      expect(r.acao).toBe('divergente');
      expect(r.acao === 'divergente' && r.chNFe).toBeUndefined();
    }
  });
});

describe('contingência SVC', () => {
  test('autorizadorContingencia: SP vai ao SVC-AN (tpEmis 6), AM ao SVC-RS (tpEmis 7)', () => {
    expect(autorizadorContingencia('SP', 'homologacao')).toEqual({ autorizador: 'SVC-AN', tpEmis: '6' });
    expect(autorizadorContingencia('AM', 'producao')).toEqual({ autorizador: 'SVC-RS', tpEmis: '7' });
  });

  test('com contingencia svc a autorização vai ao SVC-AN; a manifestação continua no AN', async () => {
    const ch = chave({ tpEmis: '6' });
    const nfe = await nfeAssinada(ch);
    const t = fakeTransport(soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch }) })));
    const { c } = await client(t, { contingencia: 'svc' });
    await c.autorizar(nfe);
    const svc = nfeEndpoint({ ambiente: 'homologacao', servico: 'NFeAutorizacao', uf: 'SP', contingencia: 'svc' });
    expect(t.requests[0]?.url).toBe(svc.url);
    expect(svc.url).toContain('sefazvirtual');
    expect(CNPJ_EMIT).toHaveLength(14);
  });
});

describe('autorizador pelo documento e pela chave', () => {
  const url = (
    servico: 'NFeAutorizacao' | 'NfeConsultaProtocolo' | 'NFeRetAutorizacao' | 'RecepcaoEvento',
    q: object,
  ) => nfeEndpoint({ ambiente: 'homologacao', servico, ...q }).url;

  test('autorizar vai à UF do documento e ao SVC do tpEmis, seja qual for a UF ou a contingência do cliente', async () => {
    const mg = chave({ cUF: '31' });
    const svcAn = chave({ tpEmis: '6', nNF: 2 });
    const svcRs = chave({ cUF: '13', tpEmis: '7', nNF: 3 });
    const normal = chave({ nNF: 4 });
    const t = fakeTransport(
      ...[mg, svcAn, svcRs, normal].map((ch) => soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch }) }))),
    );
    // Cliente de SP em contingência: nada disso decide o autorizador de um documento.
    const { c } = await client(t, { contingencia: 'svc' });
    for (const ch of [mg, svcAn, svcRs, normal]) await c.autorizar(await nfeAssinada(ch));
    expect(t.requests.map((r) => r.url)).toEqual([
      url('NFeAutorizacao', { uf: 'MG' }),
      url('NFeAutorizacao', { autorizador: 'SVC-AN' }),
      url('NFeAutorizacao', { autorizador: 'SVC-RS' }),
      url('NFeAutorizacao', { uf: 'SP' }),
    ]);
  });

  test('consultar, cancelar e o recibo com a nota seguem o tpEmis da chave; a CC-e vai sempre à UF', async () => {
    const ch = chave({ tpEmis: '7', nNF: 9 });
    const nfe = await nfeAssinada(ch);
    const prot = protNFe({ chNFe: ch, digVal: digestOf(nfe) });
    const t = fakeTransport(
      soap(retConsSitNFe({ cStat: '100', chNFe: ch, inner: prot })),
      soap(retConsReciNFe({ cStat: '104', nRec: '351000000000001', inner: prot })),
      soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110111', chNFe: ch } })),
      soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110110', chNFe: ch } })),
    );
    const { c } = await client(t, { autor: { CNPJ: CNPJ_EMIT } });
    expect((await c.consultar(ch, nfe)).tipo).toBe('autorizado');
    expect((await c.consultarRecibo('351000000000001', nfe)).tipo).toBe('autorizado');
    expect((await c.cancelar({ chave: ch, nProt: '135260000000001', xJust: 'CANCELAMENTO DE TESTE' })).tipo).toBe(
      'autorizado',
    );
    expect((await c.cartaCorrecao({ chave: ch, xCorrecao: 'CORRECAO DE TESTE', nSeqEvento: 1 })).tipo).toBe(
      'autorizado',
    );
    expect(t.requests.map((r) => r.url)).toEqual([
      url('NfeConsultaProtocolo', { autorizador: 'SVC-RS' }),
      url('NFeRetAutorizacao', { autorizador: 'SVC-RS' }),
      url('RecepcaoEvento', { autorizador: 'SVC-RS' }),
      url('RecepcaoEvento', { uf: 'SP' }),
    ]);
  });

  test('recibo sem a nota e status vão pela UF e pela contingência das opções', async () => {
    const t = fakeTransport(soap(retConsReciNFe({ cStat: '105' })));
    const { c } = await client(t, { uf: 'SP', contingencia: 'svc' });
    await c.consultarRecibo('351000000000001');
    expect(t.requests[0]?.url).toBe(url('NFeRetAutorizacao', { uf: 'SP', contingencia: 'svc' }));
  });

  test('sem uf nas opções: os serviços do documento funcionam; os sem documento pedem a UF', async () => {
    const ch = chave({ cUF: '41' });
    const t = fakeTransport(soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch }) })));
    const c = createNfeClient({
      transport: t,
      signer: await testSigner(),
      ambiente: 'homologacao',
      clock: relogioFixo(CLOCK_ISO),
      autor: { CNPJ: CNPJ_EMIT },
    });
    expect((await c.autorizar(await nfeAssinada(ch))).tipo).toBe('autorizado');
    expect(t.requests[0]?.url).toBe(url('NFeAutorizacao', { uf: 'PR' }));
    await expect(c.statusServico()).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(c.consultarRecibo('351000000000001')).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(
      c.inutilizar({ ano: 26, serie: 1, nNFIni: 1, nNFFin: 1, xJust: 'INUTILIZACAO DE TESTE' }),
    ).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(c.distribuicaoDFe({ ultNSU: 0 })).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });

  test('Id da NF-e que não é chave de acesso é ErroDeConfiguracao antes do envio', async () => {
    const t = fakeTransport();
    const { c } = await client(t);
    const ruim = (await nfeAssinada()).replace(/Id="NFe(\d{43})\d"/, (_m, base: string) => `Id="NFe${base}X"`);
    await expect(c.autorizar(ruim)).rejects.toBeInstanceOf(ErroDeConfiguracao);
    expect(t.requests).toHaveLength(0);
  });
});

describe('chaveDaDuplicidade', () => {
  test('extrai chave numérica e com CNPJ alfanumérico do xMotivo da 539', () => {
    const num = '35260911222333000181550010000001231139292165';
    const alfa = '432607PC3D315K000193550010000000011000000011';
    expect(chaveDaDuplicidade(`Rejeição: Duplicidade de NF-e com diferença na Chave de Acesso [chNFe:${num}]`)).toBe(
      num,
    );
    expect(chaveDaDuplicidade(`Rejeicao: Duplicidade [chNFe: ${alfa.toLowerCase()}]`)).toBe(alfa);
    expect(chaveDaDuplicidade('Rejeição: Duplicidade de NF-e')).toBeUndefined();
  });
});

describe('NFC-e (modelo 65)', () => {
  test('sem a opção: tabela da NFC-e do transporte, e o autorizador normal mesmo em contingência SVC', async () => {
    const ch = chave({ mod: '65' });
    const nfe = await nfeAssinada(ch);
    const prot = protNFe({ chNFe: ch, digVal: digestOf(nfe) });
    const t = fakeTransport(
      soap(retEnviNFe({ cStat: '104', inner: prot })),
      soap(retConsSitNFe({ cStat: '100', chNFe: ch, inner: prot })),
      soap(retConsReciNFe({ cStat: '104', nRec: '351000000000001', inner: prot })),
    );
    const { c } = await client(t, { contingencia: 'svc' });
    expect((await c.autorizar(nfe)).tipo).toBe('autorizado');
    expect((await c.consultar(ch)).tipo).toBe('autorizado');
    expect((await c.consultarRecibo('351000000000001', nfe)).tipo).toBe('autorizado');
    const url = (servico: 'NFeAutorizacao' | 'NfeConsultaProtocolo' | 'NFeRetAutorizacao'): string =>
      nfceEndpoint({ ambiente: 'homologacao', servico, uf: 'SP' }).url;
    expect(t.requests.map((r) => r.url)).toEqual([
      url('NFeAutorizacao'),
      url('NfeConsultaProtocolo'),
      url('NFeRetAutorizacao'),
    ]);
    expect(t.requests[0]?.url).toStartWith('https://homologacao.nfce.fazenda.sp.gov.br/');
  });

  test('autorização e consulta vão ao endpoint da NFC-e dado nas opções', async () => {
    const ch = chave({ mod: '65' });
    const nfe = await nfeAssinada(ch);

    const t = fakeTransport(
      soap(retEnviNFe({ cStat: '104', inner: protNFe({ chNFe: ch, digVal: digestOf(nfe) }) })),
      soap(retConsSitNFe({ cStat: '100', chNFe: ch, inner: protNFe({ chNFe: ch, digVal: digestOf(nfe) }) })),
    );
    const vistos: string[] = [];
    const base = nfeEndpoint({ ambiente: 'homologacao', servico: 'NFeAutorizacao', uf: 'SP' });
    const { c } = await client(t, {
      nfceEndpoint: (servico, uf) => {
        vistos.push(`${servico} ${uf}`);
        return { ...base, url: `https://nfce.exemplo.invalid/${servico}` };
      },
    });
    expect((await c.autorizar(nfe)).tipo).toBe('autorizado');
    expect((await c.consultar(ch, nfe)).tipo).toBe('autorizado');
    expect(vistos).toEqual(['NFeAutorizacao SP', 'NfeConsultaProtocolo SP']);
    expect(t.requests.map((r) => r.url)).toEqual([
      'https://nfce.exemplo.invalid/NFeAutorizacao',
      'https://nfce.exemplo.invalid/NfeConsultaProtocolo',
    ]);
  });

  test('recibo de NFC-e sem a nota assinada: mod 65 nas opções escolhe o serviço; mod contra a nota é ErroDeConfiguracao', async () => {
    const pend = soap(retConsReciNFe({ cStat: '105' }));
    const t = fakeTransport(pend, pend);
    const base = nfeEndpoint({ ambiente: 'homologacao', servico: 'NFeRetAutorizacao', uf: 'SP' });
    const { c } = await client(t, {
      nfceEndpoint: (servico) => ({ ...base, url: `https://nfce.exemplo.invalid/${servico}` }),
    });
    await c.consultarRecibo('351000000000001', undefined, { mod: '65' });
    await c.aguardarRecibo('351000000000001', undefined, { mod: '65', maxTentativas: 1 });
    expect(t.requests.map((r) => r.url)).toEqual([
      'https://nfce.exemplo.invalid/NFeRetAutorizacao',
      'https://nfce.exemplo.invalid/NFeRetAutorizacao',
    ]);
    const nfe = await nfeAssinada(chave());
    await expect(c.consultarRecibo('351000000000001', nfe, { mod: '65' })).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });
});

describe('recuperarEventoRegistrado com respostas sintéticas', () => {
  const procEvento = (p: {
    ch: string;
    chPedido?: string;
    cStat?: string;
    tpEvento?: string;
    nSeqRet?: string;
    semChRet?: boolean;
  }): string => {
    const tp = p.tpEvento ?? '110111';
    const chPedido = p.chPedido ?? p.ch;
    return (
      `<procEventoNFe versao="1.00"><evento versao="1.00"><infEvento Id="ID${tp}${chPedido}01">` +
      `<chNFe>${chPedido}</chNFe><tpEvento>${tp}</tpEvento><nSeqEvento>1</nSeqEvento></infEvento></evento>` +
      `<retEvento versao="1.00"><infEvento><cStat>${p.cStat ?? '135'}</cStat>${p.semChRet ? '' : `<chNFe>${p.ch}</chNFe>`}` +
      `<tpEvento>${tp}</tpEvento><nSeqEvento>${p.nSeqRet ?? '1'}</nSeqEvento><dhRegEvento>2026-09-10T10:00:00-03:00</dhRegEvento>` +
      '</infEvento></retEvento></procEventoNFe>'
    );
  };

  test('só vale o evento com retorno registrado, da mesma chave e do mesmo tipo no pedido e no retorno', async () => {
    const ch = chave({ nNF: 50 });
    const ruins =
      protNFe({ chNFe: ch }) +
      procEvento({ ch, cStat: '573' }) +
      procEvento({ ch, chPedido: chave({ nNF: 51 }) }) +
      procEvento({ ch, tpEvento: '110110' }) +
      procEvento({ ch, nSeqRet: '2' }) +
      procEvento({ ch, semChRet: true }) +
      '<procEventoNFe versao="1.00"><evento versao="1.00"/></procEventoNFe>';
    const t = fakeTransport(
      soap(retConsSitNFe({ cStat: '101', chNFe: ch, inner: ruins })),
      soap(retConsSitNFe({ cStat: '101', chNFe: ch, inner: ruins + procEvento({ ch }) })),
    );
    const { c } = await client(t);
    expect((await recuperarEventoRegistrado(c, ch, '110111')).registrado).toBe(false);
    const achado = await recuperarEventoRegistrado(c, ch, '110111');
    if (!achado.registrado) throw new Error('não achou');
    expect([achado.evento.nSeqEvento, achado.evento.nProt, achado.evento.dhRegEvento]).toEqual([
      '1',
      undefined,
      '2026-09-10T10:00:00-03:00',
    ]);
    expect(achado.evento.retEvento).toStartWith(`<retEvento xmlns="${NFE_NS}"`);
  });

  test('consulta que não decide volta registrado false com o desfecho', async () => {
    const ch = chave({ nNF: 52 });
    const t = fakeTransport(soap(retConsSitNFe({ cStat: '656', xMotivo: 'Consumo indevido', chNFe: ch })));
    const { c } = await client(t);
    const r = await recuperarEventoRegistrado(c, ch, '110111');
    expect([r.registrado, r.consulta.tipo, r.consulta.cStat]).toEqual([false, 'recusado', '656']);
  });
});

describe('nfeAssinadaDoProc', () => {
  test('nfeProc do sinete: devolve os bytes assinados como estão; a NF-e avulsa volta sem a declaração XML', async () => {
    const ch = chave({ nNF: 31 });
    const nfe = await nfeAssinada(ch);
    const prot = protNFe({ chNFe: ch, digVal: digestOf(nfe) });
    const proc = `<nfeProc xmlns="${NFE_NS}" versao="4.00">${nfe}${prot}</nfeProc>`;
    expect(nfeAssinadaDoProc(proc)).toBe(nfe);
    expect(nfeAssinadaDoProc(`<?xml version="1.0" encoding="UTF-8"?>${proc}`)).toBe(nfe);
    expect(nfeAssinadaDoProc(`<?xml version="1.0"?>\n${nfe}`)).toBe(nfe);
  });

  test('NF-e que herda o default do envelope: a fatia declara o namespace e a assinatura confere fora do proc', async () => {
    const ch = chave({ nNF: 32 });
    const nfe = await nfeAssinada(ch);
    // Proc montado por outro emissor: o xmlns só no nfeProc, a NFe sem declaração própria.
    const semXmlns = nfe.replace(`<NFe xmlns="${NFE_NS}">`, '<NFe>');
    const proc = `<nfeProc versao="4.00" xmlns="${NFE_NS}">${semXmlns}${protNFe({ chNFe: ch })}</nfeProc>`;
    const recortada = nfeAssinadaDoProc(proc);
    expect(recortada).toBe(nfe);
    expect((await conferirAssinatura(recortada, { id: `NFe${ch}`, elemento: 'infNFe' })).ok).toBe(true);
    // A consulta com os bytes recusa a raiz sem xmlns próprio; a fatia serve direto nela.
    expect(() => documentoAssinado(semXmlns, 'NFe', 'infNFe')).toThrow(ErroDeConfiguracao);
    expect(documentoAssinado(recortada, 'NFe', 'infNFe').id).toBe(`NFe${ch}`);
  });

  test('prefixo herdado do envelope também vai para a raiz da fatia', async () => {
    const ch = chave({ nNF: 33 });
    const nfe = await nfeAssinada(ch);
    const proc = `<p:nfeProc xmlns:p="${NFE_NS}" xmlns:x="urn:extra&amp;y" versao="4.00">${nfe}</p:nfeProc>`;
    expect(nfeAssinadaDoProc(proc)).toBe(
      nfe.replace(`<NFe xmlns="${NFE_NS}">`, `<NFe xmlns:p="${NFE_NS}" xmlns:x="urn:extra&amp;y" xmlns="${NFE_NS}">`),
    );
  });

  test('sem NF-e assinada: ErroDeConfiguracao', () => {
    const semAssinatura = `<nfeProc xmlns="${NFE_NS}" versao="4.00"><NFe xmlns="${NFE_NS}"><infNFe Id="NFe${chave()}"/></NFe></nfeProc>`;
    expect(() => nfeAssinadaDoProc(semAssinatura)).toThrow(ErroDeConfiguracao);
    expect(() => nfeAssinadaDoProc('<mdfeProc xmlns="http://www.portalfiscal.inf.br/mdfe"/>')).toThrow(
      ErroDeConfiguracao,
    );
    expect(() => nfeAssinadaDoProc(`<nfeProc xmlns="${NFE_NS}" versao="4.00"/>`)).toThrow(ErroDeConfiguracao);
    expect(() => nfeAssinadaDoProc('<nfeProc')).toThrow(ErroDeConfiguracao);
  });
});
