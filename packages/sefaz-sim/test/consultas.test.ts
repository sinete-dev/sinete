/** NFeConsultaProtocolo4, CadConsultaCadastro4, NFeInutilizacao4 e NFeDistribuicaoDFe. */
import { describe, expect, test } from 'bun:test';
import { validateRoot } from '@sinete/schemas';
import * as dist from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import * as canc from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import * as PL_010f from '@sinete/schemas/nfe/PL_010f';
import { soap12ContentType, soap12Envelope } from '@sinete/transport';
import { montarChaveAcesso } from '@sinete/validators';
import { SIM_BASE_URL, simTransport } from '../src/index.ts';
import type { Harness } from './helpers.ts';
import {
  CPF,
  cnpj,
  consCad,
  consChNFe,
  consNSU,
  consSitNFe,
  DESTINATARIO,
  det,
  distDFe,
  distNSU,
  docZips,
  EMITENTE,
  envEvento,
  enviNFe,
  evento,
  harness,
  IE_EMITENTE,
  inutNFe,
  nfe,
  TERCEIRO,
  TRANSPORTADOR,
  tag,
  tags,
} from './helpers.ts';

async function autoriza(h: Harness, params: Parameters<typeof nfe>[0] = {}): Promise<{ chave: string; nProt: string }> {
  const x = await nfe(params);
  const r = await h.send('NFeAutorizacao', enviNFe([x.xml]));
  expect(tags(r, 'cStat')[1]).toBe('100');
  return { chave: x.chave, nProt: tag(r, 'nProt') as string };
}

describe('consulta protocolo', () => {
  test('100 com protNFe, 101 com o procEventoNFe do cancelamento e da CC-e, 110 denegada', async () => {
    const h = await harness();
    const { chave, nProt } = await autoriza(h);
    const r = await h.send('NfeConsultaProtocolo', consSitNFe(chave));
    expect(tags(r, 'cStat')).toEqual(['100', '100']);
    expect(tag(r, 'nProt')).toBe(nProt);
    await h.send('RecepcaoEvento', envEvento([await evento({ chave, tpEvento: '110110', det: det.cce() })]));
    await h.send(
      'RecepcaoEvento',
      envEvento([await evento({ chave, tpEvento: '110111', det: det.cancelamento(nProt) })]),
    );
    // Manifestação do destinatário não entra na consulta (item 5.4.3).
    await h.send('RecepcaoEvento', envEvento([await evento({ chave, tpEvento: '210210', det: det.ciencia() })]), {
      autorizador: 'an',
    });
    const c = await h.send('NfeConsultaProtocolo', consSitNFe(chave));
    expect(tag(c, 'xMotivo')).toBe('Cancelamento de NF-e homologado');
    expect(tags(c, 'tpEvento')).toEqual(['110110', '110110', '110111', '110111']);
    const h2 = await harness({
      cadastro: [{ UF: 'SP', IE: IE_EMITENTE, CNPJ: EMITENTE, xNome: 'X', situacao: 'irregular' }],
    });
    const den = await nfe();
    await h2.send('NFeAutorizacao', enviNFe([den.xml]));
    expect(tag(await h2.send('NfeConsultaProtocolo', consSitNFe(den.chave)), 'cStat')).toBe('110');
  });

  test('protocolo sem digVal: só na denegação ou em todos, na autorização, na consulta ou nas duas', async () => {
    const h = await harness({
      cadastro: [{ UF: 'SP', IE: IE_EMITENTE, CNPJ: EMITENTE, xNome: 'X', situacao: 'irregular' }],
    });
    const temDigVal = (xml: string): boolean => tag(xml, 'digVal') !== undefined;
    const den = await nfe();
    h.sim.setProtocoloSemDigVal('denegacao', 'autorizacao');
    const r = await h.send('NFeAutorizacao', enviNFe([den.xml]));
    expect([tags(r, 'cStat')[1], temDigVal(r)]).toEqual(['301', false]);
    // O estado guarda o digVal; só a consulta configurada o omite.
    expect(h.sim.inspect.nfe(den.chave)?.prot.infProt.digVal).toBeDefined();
    expect(temDigVal(await h.send('NfeConsultaProtocolo', consSitNFe(den.chave)))).toBe(true);
    h.sim.setProtocoloSemDigVal('denegacao', 'consulta');
    expect(temDigVal(await h.send('NfeConsultaProtocolo', consSitNFe(den.chave)))).toBe(false);
    h.sim.setProtocoloSemDigVal(undefined);
    expect(temDigVal(await h.send('NfeConsultaProtocolo', consSitNFe(den.chave)))).toBe(true);

    const h2 = await harness();
    h2.sim.setProtocoloSemDigVal('denegacao');
    const { chave } = await autoriza(h2);
    expect(temDigVal(await h2.send('NfeConsultaProtocolo', consSitNFe(chave)))).toBe(true);
    h2.sim.setProtocoloSemDigVal('todos');
    const sem = await h2.send('NFeAutorizacao', enviNFe([(await nfe({ nNF: 2 })).xml]));
    expect([tags(sem, 'cStat')[1], temDigVal(sem)]).toEqual(['100', false]);
    expect(temDigVal(await h2.send('NfeConsultaProtocolo', consSitNFe(chave)))).toBe(false);
  });

  test('217, 562 (cNF), 561 (mês), 613 (outra posição), 226, 236, 615, 252 e 215', async () => {
    const h = await harness({ ufsAtendidas: ['MG'] });
    const { chave } = await autoriza(h);
    const cStat = async (payload: string): Promise<string | undefined> =>
      tag(await h.send('NfeConsultaProtocolo', payload), 'cStat');
    expect(await cStat(consSitNFe((await nfe({ nNF: 70 })).chave))).toBe('217');
    const r562 = await h.send('NfeConsultaProtocolo', consSitNFe((await nfe({ cNF: '99999999' })).chave));
    expect(tag(r562, 'xMotivo')).toContain(`[chNFe:${chave}]`);
    expect(await cStat(consSitNFe((await nfe({ dhEmi: '2026-08-26T10:00:00-03:00' })).chave))).toBe('561');
    expect(await cStat(consSitNFe((await nfe({ tpEmis: '9' })).chave))).toBe('613');
    expect(await cStat(consSitNFe((await nfe({ cUF: '41' })).chave))).toBe('226');
    expect(await cStat(consSitNFe(`${chave.slice(0, 43)}${(Number(chave[43]) + 1) % 10}`))).toBe('236');
    expect(await cStat(consSitNFe((await nfe({ dhEmi: '2027-01-10T10:00:00-03:00' })).chave))).toBe('615');
    // Chave válida de outro DF-e (CT-e, modelo 57): 618, e não 217.
    const cte = montarChaveAcesso({
      cUF: '35',
      aamm: '2609',
      emitente: EMITENTE,
      mod: '57',
      serie: 1,
      nNF: 1,
      tpEmis: '1',
      cNF: '12345678',
    });
    expect(await cStat(consSitNFe(cte))).toBe('618');
    const dist = await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, consChNFe(cte)), { canal: h.c.destinatario });
    expect(tag(dist, 'cStat')).toBe('618');
    expect(await cStat(consSitNFe(chave, '1'))).toBe('252');
    expect(await cStat(consSitNFe('123'))).toBe('215');
  });
});

describe('consulta cadastro', () => {
  const cadastro = [
    { UF: 'SP', IE: IE_EMITENTE, CNPJ: EMITENTE, xNome: 'EMITENTE SINTETICO' },
    { UF: 'SP', IE: '222222220220', CNPJ: EMITENTE, xNome: 'FILIAL SINTETICA', situacao: 'nao-habilitado' as const },
    { UF: 'SP', IE: '333333330330', CPF, xNome: 'PRODUTOR SINTETICO' },
  ];

  test('111 e 112 com infCad, 259, 261, 264, 258, 260, 263, 265', async () => {
    const h = await harness({ cadastro });
    const r = await h.send('NfeConsultaCadastro', consCad('IE', IE_EMITENTE));
    expect(tag(r, 'cStat')).toBe('111');
    expect(tag(r, 'xNome')).toBe('EMITENTE SINTETICO');
    const dois = await h.send('NfeConsultaCadastro', consCad('CNPJ', EMITENTE));
    expect(tag(dois, 'cStat')).toBe('112');
    expect(tags(dois, 'cSit')).toEqual(['1', '0']);
    expect(tag(await h.send('NfeConsultaCadastro', consCad('CPF', CPF)), 'cStat')).toBe('111');
    const casos: [string, string][] = [
      [consCad('CNPJ', DESTINATARIO), '259'],
      [consCad('IE', '444444440440'), '261'],
      [consCad('CPF', '52998224725'), '264'],
      [consCad('CNPJ', `${EMITENTE.slice(0, 12)}00`), '258'],
      [consCad('IE', '111111111110'), '260'],
      [consCad('CPF', '11111111112'), '263'],
      [consCad('CNPJ', EMITENTE, 'MG'), '265'],
      [consCad('CNPJ', EMITENTE, 'XX'), '215'],
    ];
    for (const [payload, esperado] of casos) {
      expect([esperado, tag(await h.send('NfeConsultaCadastro', payload), 'cStat')]).toEqual([esperado, esperado]);
    }
  });
});

describe('inutilização', () => {
  test('102 com protocolo e a faixa; 563 com o protocolo anterior; 256, 241, 224, 201, 266, 453, 454, 502, 213', async () => {
    const h = await harness();
    const r = await h.send('NfeInutilizacao', await inutNFe({ ini: 10, fin: 12 }));
    expect(tag(r, 'cStat')).toBe('102');
    expect(tag(r, 'xMotivo')).toBe('Inutilização de número homologado');
    const nProt = tag(r, 'nProt') as string;
    expect(nProt).toBe('135260000000001');
    const dup = await h.send('NfeInutilizacao', await inutNFe({ ini: 10, fin: 12 }));
    expect([tag(dup, 'cStat'), tag(dup, 'nProt')]).toEqual(['563', nProt]);
    await autoriza(h, { nNF: 20 });
    const casos: [Parameters<typeof inutNFe>[0], string][] = [
      [{ ini: 11, fin: 15 }, '256'],
      [{ ini: 19, fin: 21 }, '241'],
      [{ ini: 30, fin: 29 }, '224'],
      [{ ini: 1, fin: 10_001, serie: 2 }, '201'],
      // Série de emitente CPF (NT 2018.001, I02a): a inutilização não se aplica a pessoa física.
      [{ ini: 40, fin: 41, serie: 920 }, '266'],
      [{ ini: 40, fin: 41, serie: 910 }, '266'],
      [{ ini: 40, fin: 41, ano: '27' }, '453'],
      [{ ini: 40, fin: 41, ano: '05' }, '454'],
      [{ ini: 40, fin: 41, idErrado: true }, '502'],
      [{ ini: 40, fin: 41, signer: h.c.terceiro }, '213'],
    ];
    for (const [p, esperado] of casos) {
      expect([esperado, tag(await h.send('NfeInutilizacao', await inutNFe(p)), 'cStat')]).toEqual([esperado, esperado]);
    }
    expect(h.sim.inspect.inutilizacoes()).toHaveLength(1);
  });

  test('cadastro: 203 não habilitado e 240 irregular', async () => {
    const irregular = cnpj('565656560001');
    const h = await harness({
      cadastro: [
        { UF: 'SP', IE: IE_EMITENTE, CNPJ: EMITENTE, xNome: 'X', situacao: 'nao-habilitado' },
        { UF: 'SP', IE: '222222220220', CNPJ: irregular, xNome: 'Y', situacao: 'irregular' },
      ],
    });
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 1, fin: 1 })), 'cStat')).toBe('203');
    const c = h.c;
    // O certificado do emitente não é do CNPJ irregular: a regra de cadastro vem depois da assinatura (213).
    expect(
      tag(
        await h.send('NfeInutilizacao', await inutNFe({ ini: 1, fin: 1, cnpj: irregular, signer: c.emitente })),
        'cStat',
      ),
    ).toBe('213');
  });
});

describe('distribuição de DF-e (AN)', () => {
  test('resumo para o destinatário, NF-e completa depois da ciência, eventos, autXML e transportador', async () => {
    const h = await harness({}, (await harness()).c.destinatario);
    const { chave, nProt } = await autoriza(h, { autXML: [TERCEIRO], transportador: TRANSPORTADOR });
    const dist1 = await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(0)));
    expect([tag(dist1, 'cStat'), tag(dist1, 'ultNSU'), tag(dist1, 'maxNSU')]).toEqual([
      '138',
      '000000000000001',
      '000000000000001',
    ]);
    const [res] = await docZips(dist1);
    expect(res?.schema).toBe('resNFe_v1.01.xsd');
    expect(validateRoot(dist.resNFeElement, res?.xml ?? '')).toEqual([]);
    // Antes da manifestação, o cancelamento chega como resumo de evento.
    const cce = await evento({ chave, tpEvento: '110110', det: det.cce() });
    await h.send('RecepcaoEvento', envEvento([cce]), { canal: h.c.emitente });
    const ciencia = await evento({ chave, tpEvento: '210210', det: det.ciencia() });
    await h.send('RecepcaoEvento', envEvento([ciencia]), { autorizador: 'an' });
    await h.send(
      'RecepcaoEvento',
      envEvento([await evento({ chave, tpEvento: '110111', det: det.cancelamento(nProt) })]),
      {
        canal: h.c.emitente,
      },
    );
    const dist2 = await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(1)));
    const docs = await docZips(dist2);
    expect(docs.map((d) => [d.nsu, d.schema])).toEqual([
      ['000000000000002', 'resEvento_v1.01.xsd'],
      ['000000000000003', 'procNFe_v4.00.xsd'],
      ['000000000000004', 'procEventoNFe_v1.00.xsd'],
    ]);
    expect(validateRoot(dist.resEventoElement, docs[0]?.xml ?? '')).toEqual([]);
    expect(validateRoot(PL_010f.nfeProcElement, docs[1]?.xml ?? '')).toEqual([]);
    expect(validateRoot(canc.procEventoNFeElement, docs[2]?.xml ?? '')).toEqual([]);
    // O XML da NF-e distribuída é a string recebida.
    expect(docs[1]?.xml).toContain(h.sim.inspect.nfe(chave)?.xml as string);
    // Emitente recebe a manifestação do destinatário; terceiros recebem NF-e e eventos completos.
    expect(h.sim.inspect.distribuicao(EMITENTE).map((d) => d.schema)).toEqual(['procEventoNFe_v1.00.xsd']);
    expect(h.sim.inspect.distribuicao(TERCEIRO).map((d) => d.schema)).toEqual([
      'procNFe_v4.00.xsd',
      'procEventoNFe_v1.00.xsd',
      'procEventoNFe_v1.00.xsd',
    ]);
    expect(h.sim.inspect.distribuicao(TRANSPORTADOR)).toHaveLength(3);
  });

  test('consNSU, 589, 137 e consumo indevido (656) antes de uma hora', async () => {
    const h = await harness({}, (await harness()).c.destinatario);
    await autoriza(h);
    expect(tag(await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, consNSU(1))), 'cStat')).toBe('138');
    expect(tag(await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, consNSU(2))), 'cStat')).toBe('589');
    expect(tag(await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(5))), 'cStat')).toBe('589');
    expect(tag(await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(1))), 'cStat')).toBe('137');
    const indevido = await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(1)));
    expect(tag(indevido, 'cStat')).toBe('656');
    expect(tag(indevido, 'xMotivo')).toContain('[det:');
    h.clock.avancar(3_600_000);
    expect(tag(await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(1))), 'cStat')).toBe('137');
    const vazia = await harness({}, h.c.destinatario);
    expect(tag(await vazia.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, consNSU(0))), 'cStat')).toBe('137');
  });

  test('consChNFe: resumo sem manifestação, completa para terceiros, 640, 653, 217, 236; 593 e 252', async () => {
    const h = await harness({}, (await harness()).c.destinatario);
    const { chave, nProt } = await autoriza(h, { autXML: [TERCEIRO] });
    const resumo = await docZips(await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, consChNFe(chave))));
    expect(resumo.map((d) => d.schema)).toEqual(['resNFe_v1.01.xsd']);
    const completo = await docZips(
      await h.send('NFeDistribuicaoDFe', distDFe(TERCEIRO, consChNFe(chave)), { canal: h.c.terceiro }),
    );
    expect(completo.map((d) => [d.nsu, d.schema])).toEqual([['000000000000001', 'procNFe_v4.00.xsd']]);
    const cStat = async (
      interessado: string,
      consulta: string,
      canal = h.c.destinatario,
    ): Promise<string | undefined> =>
      tag(await h.send('NFeDistribuicaoDFe', distDFe(interessado, consulta), { canal }), 'cStat');
    expect(await cStat(EMITENTE, consChNFe(chave), h.c.emitente)).toBe('641');
    const semTerceiro = await autoriza(h, { nNF: 78 });
    expect(await cStat(TERCEIRO, consChNFe(semTerceiro.chave), h.c.terceiro)).toBe('640');
    expect(await cStat(DESTINATARIO, consChNFe((await nfe({ nNF: 79, mod: '65' })).chave))).toBe('618');
    const dvErrado = `${DESTINATARIO.slice(0, 13)}${(Number(DESTINATARIO[13]) + 1) % 10}`;
    expect(await cStat(dvErrado, distNSU(0))).toBe('489');
    const cpfErrado = distDFe(DESTINATARIO, distNSU(0)).replace(
      `<CNPJ>${DESTINATARIO}</CNPJ>`,
      '<CPF>11144477736</CPF>',
    );
    expect(tag(await h.send('NFeDistribuicaoDFe', cpfErrado, { canal: h.c.ecpf }), 'cStat')).toBe('490');
    expect(await cStat(DESTINATARIO, consChNFe((await nfe({ nNF: 77 })).chave))).toBe('217');
    expect(await cStat(DESTINATARIO, consChNFe(`${chave.slice(0, 43)}${(Number(chave[43]) + 1) % 10}`))).toBe('236');
    expect(await cStat(EMITENTE, distNSU(0))).toBe('593');
    expect(tag(await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(0), '1')), 'cStat')).toBe('252');
    await h.send(
      'RecepcaoEvento',
      envEvento([await evento({ chave, tpEvento: '110111', det: det.cancelamento(nProt) })]),
      {
        canal: h.c.emitente,
      },
    );
    expect(await cStat(DESTINATARIO, consChNFe(chave))).toBe('653');
  });

  test('CPF interessado: 472 quando o certificado do canal não é do mesmo CPF', async () => {
    const h = await harness({}, (await harness()).c.ecpf);
    const cpfPayload = distDFe(DESTINATARIO, distNSU(0)).replace(
      `<CNPJ>${DESTINATARIO}</CNPJ>`,
      '<CPF>52998224725</CPF>',
    );
    expect(tag(await h.send('NFeDistribuicaoDFe', cpfPayload), 'cStat')).toBe('472');
    const mesmo = cpfPayload.replace('52998224725', CPF);
    expect(tag(await h.send('NFeDistribuicaoDFe', mesmo), 'cStat')).toBe('137');
  });
});

describe('consulta cadastro no MT', () => {
  const W = 'http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4';
  const cadastro = [{ UF: 'MT' as const, IE: '131313130130', CNPJ: EMITENTE, xNome: 'EMITENTE SINTETICO MT' }];
  const enviar = async (h: Harness, body: string) => {
    const t = simTransport(h.sim, { clientCertificate: h.c.terceiro.der });
    const res = await t.send({
      url: h.sim.url(SIM_BASE_URL, 'NfeConsultaCadastro'),
      headers: { 'content-type': soap12ContentType(`${W}/consultaCadastro`) },
      body: soap12Envelope(body),
    });
    return { status: res.status, texto: res.text() };
  };

  test('o MT exige consultaCadastro por fora do nfeDadosMsg e responde com consultaCadastroResult', async () => {
    const h = await harness({ cadastro, uf: 'MT' });
    const cons = consCad('CNPJ', EMITENTE, 'MT');
    const certo = await enviar(
      h,
      `<consultaCadastro xmlns="${W}"><nfeDadosMsg>${cons}</nfeDadosMsg></consultaCadastro>`,
    );
    expect(certo.status).toBe(200);
    expect(certo.texto).toContain(`<nfeResultMsg xmlns="${W}"><consultaCadastroResult><retConsCad`);
    expect(tag(certo.texto, 'cStat')).toBe('111');
    const semOperacao = await enviar(h, `<nfeDadosMsg xmlns="${W}">${cons}</nfeDadosMsg>`);
    expect(semOperacao.status).toBe(500);
    expect(semOperacao.texto).toContain('Body sem consultaCadastro');
  });

  test('nas outras UFs a consulta segue só com nfeDadosMsg', async () => {
    const h = await harness();
    const r = await enviar(h, `<nfeDadosMsg xmlns="${W}">${consCad('CNPJ', EMITENTE)}</nfeDadosMsg>`);
    expect(r.status).toBe(200);
    expect(r.texto).not.toContain('consultaCadastroResult');
  });
});
