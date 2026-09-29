/** NFeAutorizacao4 e NFeRetAutorizacao4: grupos A, B, D, E, F e as regras de negócio padrão, na ordem do MOC. */
import { describe, expect, test } from 'bun:test';
import type { AutorizacaoContext, SimRejection, SimRule } from '../src/index.ts';
import { DEFAULT_RULES, NFE_NS } from '../src/index.ts';
import {
  consReciNFe,
  consStatServ,
  EMITENTE,
  enviNFe,
  harness,
  IE_EMITENTE,
  inutNFe,
  nfe,
  tag,
  tags,
} from './helpers.ts';

const cStat = (xml: string): string[] => tags(xml, 'cStat');

describe('autorização síncrona', () => {
  test('autoriza com protocolo determinístico, digVal da assinatura e dhRecbto no fuso do autorizador', async () => {
    const h = await harness();
    const n = await nfe();
    const r = await h.send('NFeAutorizacao', enviNFe([n.xml]));
    expect(cStat(r)).toEqual(['104', '100']);
    expect(tag(r, 'xMotivo')).toBe('Lote processado');
    expect(tag(r, 'nProt')).toBe('135260000000001');
    expect(tag(r, 'dhRecbto')).toBe('2026-09-26T10:00:00-03:00');
    expect(tag(r, 'digVal')).toBe(tag(n.xml, 'DigestValue'));
    const rec = h.sim.inspect.nfe(n.chave);
    expect(rec?.situacao).toBe('autorizada');
    // A NF-e guardada é a string recebida, sem reserializar.
    expect(rec?.xml).toBe(n.xml);
    expect(h.sim.inspect.nfes()).toHaveLength(1);
  });

  test('reenvio da mesma NF-e: 204 com o recibo; outra chave com o mesmo número: 539 com a chave e o recibo', async () => {
    const h = await harness();
    const n = await nfe();
    await h.send('NFeAutorizacao', enviNFe([n.xml]));
    const again = await h.send('NFeAutorizacao', enviNFe([n.xml]));
    expect(cStat(again)).toEqual(['104', '204']);
    expect(tags(again, 'xMotivo')[1]).toBe('Rejeição: Duplicidade de NF-e [nRec:351000000000001]');
    const outra = await nfe({ cNF: '87654321' });
    const r = await h.send('NFeAutorizacao', enviNFe([outra.xml]));
    expect(cStat(r)).toEqual(['104', '539']);
    expect(tags(r, 'xMotivo')[1]).toContain(`[chNFe:${n.chave}][nRec:351000000000001]`);
  });

  test('assinatura: 297 alterada, 298 fora do padrão, 290 de AC, 291 vencido, 292 sem CNPJ, 213 outro CNPJ, 227 CPF', async () => {
    const h = await harness();
    const c = h.c;
    const alterada = (await nfe({ nNF: 2 })).xml.replace('PRODUTO SINTETICO', 'PRODUTO ALTERADO');
    const foraDoPadrao = (await nfe({ nNF: 3 })).xml.replace(/URI="#NFe/, 'URI="#Outro');
    const casos: [string, string][] = [
      [alterada, '297'],
      [foraDoPadrao, '298'],
      [(await nfe({ nNF: 4, signer: c.ac })).xml, '290'],
      [(await nfe({ nNF: 5, signer: c.vencido })).xml, '291'],
      [(await nfe({ nNF: 6, signer: c.semDocumento })).xml, '292'],
      [(await nfe({ nNF: 7, signer: c.terceiro })).xml, '213'],
      [(await nfe({ nNF: 8, signer: c.ecpf })).xml, '227'],
    ];
    for (const [xml, esperado] of casos) {
      const r = await h.send('NFeAutorizacao', enviNFe([xml]));
      expect([esperado, cStat(r)[1]]).toEqual([esperado, esperado]);
    }
    expect(h.sim.inspect.nfes()).toHaveLength(0);
  });

  test('regras de identificação: 502, 410, 252, 570', async () => {
    const h = await harness();
    const casos: [string, string][] = [
      [(await nfe({ idErrado: true })).xml, '502'],
      [(await nfe({ tpAmb: '1', nNF: 2 })).xml, '252'],
      [(await nfe({ tpEmis: '6', nNF: 3 })).xml, '570'],
    ];
    for (const [xml, esperado] of casos)
      expect(cStat(await h.send('NFeAutorizacao', enviNFe([xml])))[1]).toBe(esperado);
    // B05: cUF que o web service não atende rejeita o lote inteiro.
    const mg = await nfe({ cUF: '31' });
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([mg.xml])))).toEqual(['410']);
  });

  test('regras plugáveis: uma regra acrescentada roda depois das padrão, com a mensagem oficial do código', async () => {
    const h0 = await harness();
    const serie9: SimRule<AutorizacaoContext> = {
      id: 'teste-serie-9',
      source: 'regra de teste',
      check: ({ nfe: f }: AutorizacaoContext): SimRejection | undefined =>
        f.serie === '9' ? { cStat: '503' } : undefined,
    };
    const h = await harness({ rules: { ...DEFAULT_RULES, autorizacao: [...DEFAULT_RULES.autorizacao, serie9] } });
    expect(h0.sim.config.rules).toBe(DEFAULT_RULES);
    const r = await h.send('NFeAutorizacao', enviNFe([(await nfe({ serie: 9 })).xml]));
    expect(tags(r, 'xMotivo')[1]).toBe('Rejeição: CNPJ do emitente com Série incompatível');
  });

  test('IE do emitente: 229 ausente ou zerada, 209 inválida para a UF, 554 ISENTO fora da avulsa', async () => {
    const h = await harness();
    const com = async (p: Parameters<typeof nfe>[0]): Promise<string | undefined> =>
      cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe(p)).xml])))[1];
    expect(await com({ ie: '000000000000' })).toBe('229');
    expect(await com({ nNF: 2, ie: '123456789012' })).toBe('209');
    expect(await com({ nNF: 3, ie: 'ISENTO' })).toBe('554');
    expect(await com({ nNF: 4, ie: 'ISENTO', serie: 890 })).toBe('100');
  });

  test('cadastro: 230, 231, 203 e denegação 301 com protocolo; reenvio da denegada dá 205', async () => {
    const outro = EMITENTE.replace(/^1/, '9');
    const h = await harness({
      cadastro: [
        { UF: 'SP', IE: IE_EMITENTE, CNPJ: EMITENTE, xNome: 'EMITENTE', situacao: 'irregular' },
        { UF: 'SP', IE: '222222220220', CNPJ: outro, xNome: 'OUTRO' },
        { UF: 'SP', IE: '333333330330', CNPJ: EMITENTE, xNome: 'SUSPENSO', situacao: 'nao-habilitado' },
      ],
    });
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe({ ie: '444444440440' })).xml])))[1]).toBe('230');
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe({ ie: '222222220220' })).xml])))[1]).toBe('231');
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe({ ie: '333333330330' })).xml])))[1]).toBe('203');
    const n = await nfe();
    const den = await h.send('NFeAutorizacao', enviNFe([n.xml]));
    expect(cStat(den)).toEqual(['104', '301']);
    expect(tags(den, 'xMotivo')[1]).toBe('Uso Denegado: Irregularidade fiscal do emitente');
    expect(tag(den, 'nProt')).toMatch(/^13526\d{10}$/);
    expect(h.sim.inspect.nfe(n.chave)?.situacao).toBe('denegada');
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([n.xml])))[1]).toBe('205');
  });

  test('206 para número inutilizado e 218 para NF-e cancelada', async () => {
    const h = await harness();
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 5, fin: 6 })), 'cStat')).toBe('102');
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe({ nNF: 5 })).xml])))[1]).toBe('206');
    const n = await nfe();
    await h.send('NFeAutorizacao', enviNFe([n.xml]));
    (h.sim.inspect.nfe(n.chave) as { situacao: string }).situacao = 'cancelada';
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([n.xml])))[1]).toBe('218');
  });

  test('lote: 764 síncrono com duas NF-e, 765 NF-e com NFC-e, 776 quando a UF não atende síncrono', async () => {
    const h = await harness();
    const a = await nfe();
    const b = await nfe({ nNF: 2 });
    const nfce = await nfe({ nNF: 3, mod: '65' });
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([a.xml, b.xml])))).toEqual(['764']);
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([a.xml, nfce.xml], '0')))).toEqual(['765']);
    const recusa = await harness({ respostaSincrona: 'recusa' });
    expect(cStat(await recusa.send('NFeAutorizacao', enviNFe([a.xml])))).toEqual(['776']);
  });
});

describe('autorização assíncrona', () => {
  test('recibo, 105 enquanto processa, 104 depois do atraso no relógio injetado; 106 e 248', async () => {
    const h = await harness({ atrasoProcessamentoMs: 2000 });
    const a = await nfe();
    const b = await nfe({ nNF: 2 });
    const rec = await h.send('NFeAutorizacao', enviNFe([a.xml, b.xml], '0'));
    expect(cStat(rec)).toEqual(['103']);
    expect(tag(rec, 'tMed')).toBe('2');
    const nRec = tag(rec, 'nRec') as string;
    expect(nRec).toBe('351000000000001');
    expect(cStat(await h.send('NFeRetAutorizacao', consReciNFe(nRec)))).toEqual(['105']);
    // Mesmo número em processamento: 635 para quem tenta o síncrono.
    const r635 = await h.send('NFeAutorizacao', enviNFe([(await nfe({ cNF: '11111111' })).xml]));
    expect(cStat(r635)[1]).toBe('635');
    h.clock.advance(2000);
    const done = await h.send('NFeRetAutorizacao', consReciNFe(nRec));
    expect(cStat(done)).toEqual(['104', '100', '100']);
    expect(tags(done, 'chNFe')).toEqual([a.chave, b.chave]);
    expect(h.sim.inspect.lote(nRec)?.processedAt).toBe('2026-09-26T10:00:02-03:00');
    expect(cStat(await h.send('NFeRetAutorizacao', consReciNFe('351000000000999')))).toEqual(['106']);
    expect(cStat(await h.send('NFeRetAutorizacao', consReciNFe('311000000000001')))).toEqual(['248']);
    expect(cStat(await h.send('NFeRetAutorizacao', consReciNFe(nRec, '1')))).toEqual(['252']);
  });

  test('settle() processa sem pedido; 223 para outro transmissor; indSinc=1 vira recibo com respostaSincrona assíncrona', async () => {
    const h = await harness({ respostaSincrona: 'assincrona' });
    const rec = await h.send('NFeAutorizacao', enviNFe([(await nfe()).xml], '1'));
    const nRec = tag(rec, 'nRec') as string;
    expect(cStat(rec)).toEqual(['103']);
    await h.sim.settle();
    expect(h.sim.inspect.lote(nRec)?.protNFe).toHaveLength(1);
    const outro = await h.send('NFeRetAutorizacao', consReciNFe(nRec), { canal: h.c.destinatario });
    expect(cStat(outro)).toEqual(['223']);
  });

  test('lote posterior não invalida o anterior; consulta concorrente com o processamento vê o lote inteiro', async () => {
    const h = await harness({ atrasoProcessamentoMs: 1000 });
    const a = await nfe();
    const b = await nfe({ nNF: 2 });
    const primeiro = tag(await h.send('NFeAutorizacao', enviNFe([a.xml, b.xml], '0')), 'nRec') as string;
    const segundo = tag(await h.send('NFeAutorizacao', enviNFe([a.xml], '0')), 'nRec') as string;
    h.clock.advance(1000);
    const settle = h.sim.settle();
    const [r1, r2] = await Promise.all([
      h.send('NFeRetAutorizacao', consReciNFe(primeiro)),
      h.send('NFeRetAutorizacao', consReciNFe(segundo)),
      settle,
    ]);
    expect(cStat(r1)).toEqual(['104', '100', '100']);
    expect(cStat(r2)[1]).toBe('204');
    expect(tags(r2, 'xMotivo')[1]).toContain(`[nRec:${primeiro}]`);
  });
});

describe('grupos gerais', () => {
  test('B01 214, D01 225/565/568, D01e 588, D02 404', async () => {
    const h = await harness({ tamanhoMaximo: 20_000 });
    const n = await nfe();
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([n.xml, n.xml, n.xml, n.xml, n.xml], '0')))).toEqual(['214']);
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([n.xml], '1', 'LOTE')))).toEqual(['225']);
    expect(cStat(await h.send('NFeAutorizacao', consStatServ()))).toEqual(['565']);
    const semVersao = enviNFe([n.xml]).replace('<enviNFe versao="4.00"', '<enviNFe');
    expect(cStat(await h.send('NFeAutorizacao', semVersao))).toEqual(['568']);
    const comQuebra = enviNFe([n.xml]).replace('<idLote>', '\n<idLote>');
    expect(cStat(await h.send('NFeAutorizacao', comQuebra))).toEqual(['588']);
    const prefixado = enviNFe([n.xml])
      .replace(`<enviNFe versao="4.00" xmlns="${NFE_NS}">`, `<p:enviNFe versao="4.00" xmlns:p="${NFE_NS}">`)
      .replace(/<\/enviNFe>$/, '</p:enviNFe>')
      .replace(/<(\/?)(idLote|indSinc)>/g, '<$1p:$2>');
    expect(cStat(await h.send('NFeAutorizacao', prefixado))).toEqual(['404']);
  });

  test('B02 243: área de dados que depende de um prefixo declarado no envelope', async () => {
    const h = await harness();
    const def = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4';
    const body =
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:x="urn:x"><soap12:Body>` +
      `<nfeDadosMsg xmlns="${def}"><consStatServ x:a="1" versao="4.00" xmlns="${NFE_NS}"><tpAmb>2</tpAmb></consStatServ>` +
      '</nfeDadosMsg></soap12:Body></soap12:Envelope>';
    const r = await h.raw({
      path: '/uf/ws/NFeStatusServico4',
      headers: { 'content-type': 'application/soap+xml; charset=utf-8' },
      body,
    });
    expect(tag(r.body, 'cStat')).toBe('243');
  });

  test('grupo A: 403 sem certificado, 280 de AC, 281 vencido, 282 sem documento; exigirCertificado desligado', async () => {
    const h = await harness();
    await expect(h.send('NfeStatusServico', consStatServ(), { canal: null })).rejects.toMatchObject({
      code: 'certificado_ausente_ou_recusado',
    });
    expect(tag(await h.send('NfeStatusServico', consStatServ(), { canal: h.c.ac }), 'cStat')).toBe('280');
    expect(tag(await h.send('NfeStatusServico', consStatServ(), { canal: h.c.vencido }), 'cStat')).toBe('281');
    expect(tag(await h.send('NfeStatusServico', consStatServ(), { canal: h.c.semDocumento }), 'cStat')).toBe('282');
    const livre = await harness({ exigirCertificado: false });
    expect(tag(await livre.send('NfeStatusServico', consStatServ(), { canal: null }), 'cStat')).toBe('107');
  });

  test('paralisação 108/109 e contingência pela SVC-AN (570 na UF, 713 e 783 na SVC, 114 com a SVC desligada)', async () => {
    const h = await harness();
    h.sim.setParalisacao('109');
    expect(tag(await h.send('NfeStatusServico', consStatServ()), 'xMotivo')).toBe('Serviço Paralisado sem Previsão');
    const n = await nfe();
    expect(tag(await h.send('NFeAutorizacao', enviNFe([n.xml])), 'xMotivo')).toBe(
      'Rejeição: Serviço Paralisado sem Previsão',
    );
    h.sim.setParalisacao(undefined);
    expect(tag(await h.send('NfeStatusServico', consStatServ()), 'cStat')).toBe('107');

    // Sem ativação pela SEFAZ de origem, a SVC responde 114 na consulta status (NT 2013.007 v1.03, K05.1).
    const off = await h.send('NfeStatusServico', consStatServ(), { autorizador: 'svc' });
    expect([tag(off, 'cStat'), tag(off, 'xMotivo')]).toEqual([
      '114',
      'Rejeição: SVC-AN desabilitada pela SEFAZ de Origem',
    ]);
    h.sim.setContingencia('SVC-AN');
    expect(tag(await h.send('NfeStatusServico', consStatServ()), 'cStat')).toBe('108');
    expect(tag(await h.send('NfeStatusServico', consStatServ(), { autorizador: 'svc' }), 'verAplic')).toBe(
      'SVC-AN_SINETE_SIM',
    );
    const svc = await nfe({ tpEmis: '6' });
    const ok = await h.send('NFeAutorizacao', enviNFe([svc.xml]), { autorizador: 'svc' });
    expect(cStat(ok)).toEqual(['104', '100']);
    expect(tag(ok, 'nProt')).toMatch(/^435/);
    expect(
      cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe({ nNF: 2 })).xml]), { autorizador: 'svc' }))[1],
    ).toBe('713');
    const nfce = await nfe({ nNF: 3, mod: '65', tpEmis: '6', qrCode: null });
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([nfce.xml]), { autorizador: 'svc' }))[1]).toBe('783');
    h.sim.setContingencia('SVC-RS');
    const rs = await nfe({ nNF: 4, tpEmis: '7' });
    const okRs = await h.send('NFeAutorizacao', enviNFe([rs.xml], '0'), { autorizador: 'svc' });
    const nRec = tag(okRs, 'nRec') as string;
    expect(nRec).toMatch(/^353/);
    // A UF está paralisada durante a contingência; o recibo da SVC só existe na SVC.
    expect(cStat(await h.send('NFeRetAutorizacao', consReciNFe(nRec)))).toEqual(['108']);
    expect(cStat(await h.send('NFeRetAutorizacao', consReciNFe(nRec), { autorizador: 'svc' }))).toEqual(['104', '100']);
    h.sim.setContingencia(undefined);
    expect(tag(await h.send('NfeStatusServico', consStatServ()), 'cStat')).toBe('107');
    expect(cStat(await h.send('NFeRetAutorizacao', consReciNFe(nRec)))).toEqual(['106']);
  });

  test('ativação da SVC por UF: 107, 113 até a hora, 114 depois dela e na recepção, sem mexer na UF', async () => {
    const h = await harness({ ufsAtendidas: ['MG'] });
    const svc = { autorizador: 'svc' } as const;
    const statusSvc = async (cUF = '35'): Promise<[string | undefined, string | undefined]> => {
      const r = await h.send('NfeStatusServico', consStatServ(cUF), svc);
      return [tag(r, 'cStat'), tag(r, 'xMotivo')];
    };
    // Ativada só para SP: a UF segue em operação, a SVC atende SP e recusa MG.
    h.sim.setAtivacaoSvc({ situacao: 'ativa' });
    expect(tag(await h.send('NfeStatusServico', consStatServ()), 'cStat')).toBe('107');
    expect(await statusSvc()).toEqual(['107', 'Serviço em Operação']);
    expect((await statusSvc('31'))[0]).toBe('114');
    const ok = await h.send('NFeAutorizacao', enviNFe([(await nfe({ tpEmis: '6' })).xml]), svc);
    expect(cStat(ok)).toEqual(['104', '100']);

    // Em desativação: 113 com a data e a hora no fuso do autorizador, e a recepção ainda aceita até a hora.
    h.sim.setAtivacaoSvc({ situacao: 'desativando', ate: new Date('2026-09-26T10:15:00-03:00') });
    expect(await statusSvc()).toEqual([
      '113',
      'SVC em processo de desativação. SVC será desabilitada para a SEFAZ-SP em 26/09/26 às 10:15 horas',
    ]);
    const antes = await h.send('NFeAutorizacao', enviNFe([(await nfe({ tpEmis: '6', nNF: 2 })).xml]), svc);
    expect(cStat(antes)).toEqual(['104', '100']);
    h.clock.advance(15 * 60_000);
    expect((await statusSvc())[0]).toBe('114');
    const depois = await h.send('NFeAutorizacao', enviNFe([(await nfe({ tpEmis: '6', nNF: 3 })).xml]), svc);
    expect([cStat(depois), tag(depois, 'xMotivo')]).toEqual([
      ['114'],
      'Rejeição: SVC não ativada para a SEFAZ do Emitente',
    ]);

    // Desligada: 114 no status e na recepção; o retorno e a consulta da SVC continuam atendendo.
    h.sim.setAtivacaoSvc({ situacao: 'inativa' });
    expect((await statusSvc())[0]).toBe('114');
    expect(cStat(await h.send('NFeAutorizacao', enviNFe([(await nfe({ tpEmis: '6', nNF: 4 })).xml]), svc))).toEqual([
      '114',
    ]);
    expect(h.sim.inspect.nfes()).toHaveLength(2);

    // setContingencia desfaz o ajuste por UF: ligada, a SVC fica ativa para as UFs atendidas.
    h.sim.setContingencia('SVC-AN');
    expect((await statusSvc('31'))[0]).toBe('107');
    h.sim.setContingencia(undefined);
    expect((await statusSvc())[0]).toBe('114');
  });

  test('113: a hora sai no horário de Brasília, o da SVC, mesmo com outro fuso na UF simulada', async () => {
    const h = await harness({ offsetMinutes: -240 });
    h.sim.setAtivacaoSvc({ situacao: 'desativando', ate: new Date('2026-09-26T10:15:00-03:00') });
    const r = await h.send('NfeStatusServico', consStatServ(), { autorizador: 'svc' });
    expect(tag(r, 'xMotivo')).toContain('em 26/09/26 às 10:15 horas');
  });

  test('status: 410 para UF não atendida e 252 para ambiente divergente', async () => {
    const h = await harness();
    expect(tag(await h.send('NfeStatusServico', consStatServ('31')), 'cStat')).toBe('410');
    expect(tag(await h.send('NfeStatusServico', consStatServ('35', '1')), 'cStat')).toBe('252');
  });
});
