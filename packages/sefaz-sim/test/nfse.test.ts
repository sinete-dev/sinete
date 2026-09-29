/**
 * NFS-e simulada: recepção, assinatura, regras de negócio, eventos, consultas, parametrização e falhas, com
 * pedidos crus ao `handle` (o `@sinete/nfse` não entra aqui: ele depende deste pacote). Os documentos de resposta são
 * conferidos contra o schema oficial.
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import type { ManualClock } from '@sinete/core';
import { ConfigError, manualClock } from '@sinete/core';
import { base64Decode, base64Encode, parseXml, signXml } from '@sinete/core/xml';
import { validateRoot } from '@sinete/schemas';
import * as nfse from '@sinete/schemas/nfse/1.01-20260727';
import type { Transport, TransportRequest, TransportResponse } from '@sinete/transport';
import { nfseEndpoint } from '@sinete/transport';
import type {
  MunicipioSim,
  NfseSim,
  NfseSimFullOptions,
  SimRequest,
  SimResult,
  SyntheticCertificate,
} from '../src/index.ts';
import { createNfseSim, dvChave, NFSE_REGRAS_PADRAO, redirectNfseToSim } from '../src/index.ts';
import type { Certs } from './helpers.ts';
import { CPF, certs, DESTINATARIO, EMITENTE, INICIO, TERCEIRO } from './helpers.ts';

const SAO_PAULO = '3550308';
const CAMPINAS = '3509502';
const RIO = '3304557';
const DECL = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = 'http://www.sped.fazenda.gov.br/nfse';

const MUNICIPIOS: readonly MunicipioSim[] = [
  {
    cMun: SAO_PAULO,
    nome: 'São Paulo',
    prazoCancelamentoDias: 30,
    servicos: [
      {
        codigo: '01.01.01',
        descricao: 'Análise de sistemas.',
        aliquotas: [{ aliquota: '2.00', inicio: '2026-01-01' }],
      },
      { codigo: '010102', aliquotas: [] },
      { codigo: '17.01.01.000', aliquotas: [{ aliquota: '5.00', inicio: '2025-03-17', fim: '2025-03-17' }] },
    ],
    regimesEspeciais: { '01.01.01.000/2026-09-26': { regimesEspeciais: [{ codigo: 1 }] } },
    retencoes: { '2026-09-26': { retencoes: [] } },
    beneficios: { '12345678901234/2026-09-26': { beneficio: { tipo: 1 } } },
  },
  { cMun: CAMPINAS, nome: 'Campinas', convenio: { aderenteEmissorNacional: 0 } },
  { cMun: RIO, nome: 'Rio de Janeiro', convenioDesde: '2026-10-01', servicos: [] },
];

interface DpsParams {
  readonly tpAmb?: string;
  readonly cLocEmi?: string;
  readonly serie?: string;
  readonly nDPS?: string;
  readonly dCompet?: string;
  readonly cTribNac?: string;
  readonly subst?: string;
  readonly ibsCbs?: boolean;
  readonly tribISSQN?: string;
  readonly tpRetISSQN?: string;
  readonly pAliq?: string;
  readonly opSimpNac?: string;
  /** `2`: o tomador emite (e assina). */
  readonly tpEmit?: '1' | '2';
  readonly cpf?: boolean;
  readonly desconto?: boolean;
  readonly exterior?: boolean;
}

/** Total de tributos que o Anexo I aceita para cada regime (indTotTrib só no MEI). */
const totTrib = (opSimpNac: string): string =>
  opSimpNac === '2'
    ? '<indTotTrib>0</indTotTrib>'
    : opSimpNac === '3'
      ? '<pTotTribSN>6.00</pTotTribSN>'
      : '<pTotTrib><pTotTribFed>1.00</pTotTribFed><pTotTribEst>0.00</pTotTribEst><pTotTribMun>2.00</pTotTribMun></pTotTrib>';

function dps(p: DpsParams = {}): { readonly id: string; readonly xml: string } {
  const cLocEmi = p.cLocEmi ?? SAO_PAULO;
  const serie = p.serie ?? '1';
  const nDPS = p.nDPS ?? '1';
  const insc = p.tpEmit === '2' ? DESTINATARIO : p.cpf ? `000${CPF}` : EMITENTE;
  const id = `DPS${cLocEmi}${p.cpf ? '1' : '2'}${insc}${serie.padStart(5, '0')}${nDPS.padStart(15, '0')}`;
  const prest = p.cpf ? `<CPF>${CPF}</CPF>` : `<CNPJ>${EMITENTE}</CNPJ>`;
  const xml =
    `<DPS xmlns="${NS}" versao="1.01"><infDPS Id="${id}"><tpAmb>${p.tpAmb ?? '2'}</tpAmb>` +
    `<dhEmi>2026-09-26T10:00:00-03:00</dhEmi><verAplic>teste</verAplic><serie>${serie}</serie><nDPS>${nDPS}</nDPS>` +
    `<dCompet>${p.dCompet ?? '2026-09-26'}</dCompet><tpEmit>${p.tpEmit ?? '1'}</tpEmit><cLocEmi>${cLocEmi}</cLocEmi>` +
    (p.subst === undefined
      ? ''
      : `<subst><chSubstda>${p.subst}</chSubstda><cMotivo>99</cMotivo><xMotivo>Outros motivos de teste</xMotivo></subst>`) +
    `<prest>${prest}<regTrib><opSimpNac>${p.opSimpNac ?? '3'}</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>` +
    `<toma><CNPJ>${DESTINATARIO}</CNPJ><xNome>TOMADOR SINTETICO LTDA</xNome></toma>` +
    `<serv><locPrest>${p.exterior ? '<cPaisPrestacao>US</cPaisPrestacao>' : `<cLocPrestacao>${cLocEmi}</cLocPrestacao>`}</locPrest>` +
    `<cServ><cTribNac>${p.cTribNac ?? '010101'}</cTribNac><xDescServ>Desenvolvimento de software (teste sintético)</xDescServ><cNBS>115021000</cNBS></cServ></serv>` +
    `<valores><vServPrest><vServ>1500.00</vServ></vServPrest>` +
    (p.desconto
      ? '<vDescCondIncond><vDescIncond>100.00</vDescIncond><vDescCond>10.00</vDescCond></vDescCondIncond>'
      : '') +
    `<trib><tribMun><tribISSQN>${p.tribISSQN ?? '1'}</tribISSQN>` +
    (p.exterior ? '<cPaisResult>US</cPaisResult>' : '') +
    `<tpRetISSQN>${p.tpRetISSQN ?? '1'}</tpRetISSQN>` +
    (p.pAliq === undefined ? '' : `<pAliq>${p.pAliq}</pAliq>`) +
    `</tribMun><totTrib>${totTrib(p.opSimpNac ?? '3')}</totTrib></trib></valores>` +
    (p.ibsCbs
      ? '<IBSCBS><finNFSe>0</finNFSe><cIndOp>100301</cIndOp><indDest>0</indDest><valores><trib><gIBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib></gIBSCBS></trib></valores></IBSCBS>'
      : '') +
    `</infDPS></DPS>`;
  return { id, xml };
}

function pedido(
  chave: string,
  o: {
    readonly tp?: string;
    readonly tpAmb?: string;
    readonly cpfAutor?: string;
    readonly cnpjAutor?: string;
    readonly raiz?: string;
  } = {},
): { readonly id: string; readonly xml: string } {
  const tp = o.tp ?? '101101';
  const id = `PRE${chave}${tp}`;
  const autor =
    o.cpfAutor === undefined
      ? `<CNPJAutor>${o.cnpjAutor ?? EMITENTE}</CNPJAutor>`
      : `<CPFAutor>${o.cpfAutor}</CPFAutor>`;
  const desc = tp === '101101' ? 'Cancelamento de NFS-e' : 'Solicitação de Análise Fiscal para Cancelamento de NFS-e';
  return {
    id,
    xml:
      `<pedRegEvento xmlns="${NS}" versao="1.01"><infPedReg Id="${id}"><tpAmb>${o.tpAmb ?? '2'}</tpAmb><verAplic>teste</verAplic>` +
      `<dhEvento>2026-09-26T10:00:00-03:00</dhEvento>${autor}<chNFSe>${chave}</chNFSe>` +
      `<e${tp}><xDesc>${desc}</xDesc><cMotivo>1</cMotivo><xMotivo>Motivo com mais de 15</xMotivo></e${tp}></infPedReg></pedRegEvento>`,
  };
}

type StreamCtor = new (format: 'gzip') => TransformStream<Uint8Array, Uint8Array>;
const streams = globalThis as unknown as Record<'CompressionStream' | 'DecompressionStream', StreamCtor>;

async function gzip(bytes: Uint8Array): Promise<string> {
  const out = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new streams.CompressionStream('gzip'));
  return base64Encode(new Uint8Array(await new Response(out).arrayBuffer()));
}

async function gunzip(b64: string): Promise<string> {
  const out = new Blob([base64Decode(b64)]).stream().pipeThrough(new streams.DecompressionStream('gzip'));
  return new TextDecoder().decode(await new Response(out).arrayBuffer());
}

const gz = (xml: string): Promise<string> => gzip(new TextEncoder().encode(xml));

async function assinar(d: { readonly id: string; readonly xml: string }, cert: SyntheticCertificate): Promise<string> {
  return DECL + (await signXml(d.xml, { id: d.id }, cert.signer));
}

let c: Certs;
beforeAll(async () => {
  c = await certs();
}, 60_000);

/** Pedido cru; `clientCertificate: undefined` tira o certificado padrão do canal. */
type Pedido = Omit<Partial<SimRequest>, 'clientCertificate'> & {
  readonly path: string;
  readonly clientCertificate?: Uint8Array | undefined;
};

interface Ctx {
  readonly clock: ManualClock;
  readonly sim: NfseSim;
  /** Pedido cru, com o certificado do emitente no canal por padrão. */
  req(r: Pedido): Promise<SimResult>;
  emitir(xml: string, canal?: SyntheticCertificate | null): Promise<SimResult>;
  evento(chave: string, xml: string, canal?: SyntheticCertificate | null): Promise<SimResult>;
}

function ctx(o: Partial<NfseSimFullOptions> = {}): Ctx {
  const clock = manualClock(INICIO);
  const sim = createNfseSim({ clock, signer: c.servidor.signer, municipios: MUNICIPIOS, ...o });
  const req = (r: Pedido): Promise<SimResult> => {
    const { clientCertificate, ...resto } = { clientCertificate: c.emitente.der, ...r };
    return sim.handle(clientCertificate === undefined ? resto : { ...resto, clientCertificate });
  };
  const comCanal = (canal: SyntheticCertificate | null | undefined): Omit<Pedido, 'path'> =>
    canal === null ? { clientCertificate: undefined } : canal === undefined ? {} : { clientCertificate: canal.der };
  return {
    clock,
    sim,
    req,
    async emitir(xml, canal): Promise<SimResult> {
      return req({
        method: 'POST',
        path: '/sefin/nfse',
        body: JSON.stringify({ dpsXmlGZipB64: await gz(xml) }),
        ...comCanal(canal),
      });
    },
    async evento(chave, xml, canal): Promise<SimResult> {
      return req({
        method: 'POST',
        path: `/sefin/nfse/${chave}/eventos`,
        body: JSON.stringify({ pedidoRegistroEventoXmlGZipB64: await gz(xml) }),
        ...comCanal(canal),
      });
    },
  };
}

const corpo = (r: SimResult): Record<string, unknown> => JSON.parse(String(r.body)) as Record<string, unknown>;
const codigo = (r: SimResult): string | undefined => (corpo(r).erros as { Codigo: string }[] | undefined)?.[0]?.Codigo;

async function nfseDe(r: SimResult): Promise<{ readonly chave: string; readonly xml: string }> {
  expect(r.status).toBe(201);
  const b = corpo(r);
  const xml = await gunzip(b.nfseXmlGZipB64 as string);
  expect(validateRoot(nfse.NFSeElement, parseXml(xml))).toEqual([]);
  return { chave: b.chaveAcesso as string, xml };
}

describe('emissão', () => {
  test('DPS válida vira NFS-e assinada, com a DPS embutida byte a byte e a chave com DV', async () => {
    const s = ctx({ contribuintes: [{ CNPJ: EMITENTE, xNome: 'PRESTADOR CADASTRADO' }] });
    const assinada = await assinar(dps(), c.emitente);
    const n = await nfseDe(await s.emitir(assinada));
    expect(n.xml).toContain(assinada.slice(DECL.length));
    expect(n.chave).toHaveLength(50);
    expect(n.chave.slice(-1)).toBe(dvChave(n.chave.slice(0, 49)));
    expect(n.xml).toContain('<xNome>PRESTADOR CADASTRADO</xNome>');
    expect(n.xml).toContain('<vISSQN>30.00</vISSQN>');
    expect(s.sim.inspect.nfse(n.chave)).toMatchObject({ situacao: 'normal', serie: '1' });
    expect(s.sim.inspect.nfses()).toHaveLength(1);
  });

  test('IBS/CBS, retenção, descontos, prestador CPF e serviço no exterior', async () => {
    const s = ctx({ aliquotasIbsCbs: { pCBS: '1.00', pIBSUF: '0.50', pIBSMun: '0.10' } });
    const a = await nfseDe(
      await s.emitir(await assinar(dps({ ibsCbs: true, tpRetISSQN: '2', desconto: true }), c.emitente)),
    );
    expect(a.xml).toContain('<vCBS>14.00</vCBS>');
    expect(a.xml).toContain('<vTotalRet>');
    const b = await nfseDe(await s.emitir(await assinar(dps({ cpf: true }), c.ecpf), c.ecpf));
    expect(b.chave.slice(7, 9)).toBe('21');
    const x = await nfseDe(
      await s.emitir(await assinar(dps({ nDPS: '2', exterior: true, tribISSQN: '3' }), c.emitente)),
    );
    expect(x.xml).toContain('<xLocPrestacao>EXTERIOR US</xLocPrestacao>');
    expect(x.xml).not.toContain('<vISSQN>');
  });

  test('tomador emitente: chave, emit e cadastro vêm do tomador, não do prestador', async () => {
    const s = ctx({ contribuintes: [{ CNPJ: DESTINATARIO, xNome: 'TOMADOR CADASTRADO' }] });
    const n = await nfseDe(await s.emitir(await assinar(dps({ tpEmit: '2' }), c.destinatario), c.destinatario));
    expect(n.chave.slice(9, 23)).toBe(DESTINATARIO);
    expect(n.xml).toMatch(new RegExp(`<emit><CNPJ>${DESTINATARIO}</CNPJ><xNome>TOMADOR CADASTRADO</xNome>`));
  });

  test('recepção: corpo, base64, gzip, UTF-8, declaração, XML, prefixo, raiz e schema', async () => {
    const s = ctx();
    const post = (body: string): Promise<SimResult> => s.req({ method: 'POST', path: '/sefin/nfse', body });
    const ok = await assinar(dps(), c.emitente);
    expect(codigo(await post('não é json'))).toBe('E1225');
    expect(codigo(await post(JSON.stringify({ outro: 1 })))).toBe('E1225');
    expect(codigo(await post(JSON.stringify({ dpsXmlGZipB64: '%%%' })))).toBe('E1225');
    expect(codigo(await post(JSON.stringify({ dpsXmlGZipB64: base64Encode(new Uint8Array([1, 2, 3])) })))).toBe(
      'E1226',
    );
    const latin1 = await gzip(new Uint8Array([...new TextEncoder().encode(`${DECL}<DPS>`), 0xe7, 0xe3]));
    expect(codigo(await post(JSON.stringify({ dpsXmlGZipB64: latin1 })))).toBe('E1229');
    expect(codigo(await s.emitir(ok.slice(DECL.length)))).toBe('E1229');
    expect(codigo(await s.emitir(`${DECL}<DPS`))).toBe('E1226');
    expect(codigo(await s.emitir(`${DECL}<n:DPS xmlns:n="${NS}"/>`))).toBe('E1228');
    expect(codigo(await s.emitir(`${DECL}<NFSe xmlns="${NS}"/>`))).toBe('E1242');
    const invalido = await s.emitir(`${DECL}<DPS xmlns="${NS}" versao="1.01"/>`);
    expect(codigo(invalido)).toBe('E1235');
    expect(corpo(invalido).erros).toEqual([expect.objectContaining({ Complemento: expect.any(String) })]);
    expect(await s.req({ method: 'POST', path: '/sefin/nfse', body: new TextEncoder().encode('x') })).toMatchObject({
      status: 400,
    });
  });

  test('certificado do canal: ausente (403), vencido, sem documento; sem exigência passa', async () => {
    const s = ctx();
    const xml = await assinar(dps(), c.emitente);
    expect(await s.emitir(xml, null)).toMatchObject({ status: 403 });
    expect(codigo(await s.emitir(xml, c.vencido))).toBe('E1203');
    expect(codigo(await s.emitir(xml, c.semDocumento))).toBe('E1209');
    expect(codigo(await s.req({ method: 'POST', path: '/sefin/nfse', clientCertificate: new Uint8Array([1]) }))).toBe(
      'E1200',
    );
    expect((await ctx({ exigirCertificado: false }).emitir(xml, null)).status).toBe(201);
    // Canal de outro contribuinte, válido, com a DPS assinada pelo emitente: sem transmissor terceiro na NFS-e.
    expect(await s.emitir(xml, c.terceiro)).toMatchObject({ status: 403 });
  });

  test('assinatura da DPS: ausente, de outro titular, adulterada, certificado vencido e fora do padrão', async () => {
    const s = ctx();
    const d = dps();
    expect(codigo(await s.emitir(DECL + d.xml))).toBe('E0717');
    expect(codigo(await s.emitir(await assinar(d, c.terceiro)))).toBe('E0718');
    expect(codigo(await s.emitir((await assinar(d, c.emitente)).replace('1500.00', '1600.00')))).toBe('E0714');
    expect(codigo(await s.emitir(await assinar(d, c.vencido)))).toBe('E0715');
    expect(codigo(await s.emitir(await assinar(d, c.semDocumento)))).toBe('E0716');
  });

  test('regras de negócio na ordem, com o Id da DPS na rejeição', async () => {
    const s = ctx();
    const rej = async (p: DpsParams): Promise<string | undefined> => {
      const d = dps(p);
      const r = await s.emitir(await assinar(d, c.emitente));
      expect(corpo(r).idDPS).toBe(d.id);
      return codigo(r);
    };
    expect(await rej({ tpAmb: '1' })).toBe('E0006');
    expect(await rej({ dCompet: '2026-09-27' })).toBe('E0015');
    expect(await rej({ cLocEmi: '3106200' })).toBe('E0037');
    expect(await rej({ cLocEmi: CAMPINAS })).toBe('E0038');
    // Indicador booleano no convênio vale como aderente, como o ADN e o cliente leem.
    const booleano = ctx({
      municipios: [{ ...MUNICIPIOS[0], convenio: { aderenteEmissorNacional: true } } as MunicipioSim],
    });
    expect((await booleano.emitir(await assinar(dps(), c.emitente))).status).toBe(201);
    expect(await rej({ cLocEmi: RIO })).toBe('E1270');
    // MEI: a exceção do Anexo I vale para E0037 e E0038, não para a E1270.
    expect(await rej({ cLocEmi: RIO, opSimpNac: '2', nDPS: '7' })).toBe('E1270');
    expect(
      (await s.emitir(await assinar(dps({ cLocEmi: CAMPINAS, opSimpNac: '2', tribISSQN: '2' }), c.emitente))).status,
    ).toBe(201);
    expect(
      (await s.emitir(await assinar(dps({ cLocEmi: '3106200', opSimpNac: '2', tribISSQN: '2' }), c.emitente))).status,
    ).toBe(201);
    expect(await rej({ cTribNac: '170101' })).toBe('E0312');
    expect(await rej({ cTribNac: '010102' })).toBe('E0312');
    // MEI também escapa da E0312 (Anexo I, linha 317).
    expect(
      (await s.emitir(await assinar(dps({ cTribNac: '170101', opSimpNac: '2', nDPS: '8' }), c.emitente))).status,
    ).toBe(201);
    expect(await rej({ pAliq: '2.00', opSimpNac: '1' })).toBe('E0617');
    expect(await rej({ subst: '1'.repeat(50) })).toBe('E0042');
    await nfseDe(await s.emitir(await assinar(dps(), c.emitente)));
    expect(await rej({})).toBe('E0014');
    expect(NFSE_REGRAS_PADRAO.dps.every((r) => r.fonte.includes('linha'))).toBe(true);
  });

  test('regras trocáveis: lista vazia aceita o que a padrão rejeitaria', async () => {
    const s = ctx({ regras: { dps: [], evento: [] } });
    expect((await s.emitir(await assinar(dps({ tpAmb: '1' }), c.emitente))).status).toBe(201);
  });

  test('substituição: a substituta registra o e105102 na substituída, que não aceita outra substituição', async () => {
    const s = ctx();
    const a = await nfseDe(await s.emitir(await assinar(dps(), c.emitente)));
    const b = await nfseDe(await s.emitir(await assinar(dps({ nDPS: '2', subst: a.chave }), c.emitente)));
    expect(s.sim.inspect.nfse(a.chave)?.situacao).toBe('substituida');
    const [ev] = s.sim.inspect.eventos(a.chave);
    expect(ev).toMatchObject({ tpEvento: '105102', nSeqEvento: 1 });
    expect(ev?.xml).toContain(`<chSubstituta>${b.chave}</chSubstituta>`);
    expect(validateRoot(nfse.eventoElement, parseXml(ev?.xml ?? ''))).toEqual([]);
    const r = await s.emitir(await assinar(dps({ nDPS: '3', subst: a.chave }), c.emitente));
    expect(codigo(r)).toBe('E0046');
    expect(codigo(await s.evento(a.chave, await assinar(pedido(a.chave), c.emitente)))).toBe('E0840');
  });
});

describe('eventos', () => {
  async function emitida(s: Ctx): Promise<string> {
    return (await nfseDe(await s.emitir(await assinar(dps(), c.emitente)))).chave;
  }

  test('cancelamento registrado, repetido (E0840 com o nome do evento) e análise fiscal depois', async () => {
    const s = ctx();
    const chave = await emitida(s);
    const r = await s.evento(chave, await assinar(pedido(chave), c.emitente));
    expect(r.status).toBe(201);
    const ev = await gunzip(corpo(r).eventoXmlGZipB64 as string);
    expect(validateRoot(nfse.eventoElement, parseXml(ev))).toEqual([]);
    expect(s.sim.inspect.nfse(chave)?.situacao).toBe('cancelada');
    const dup = await s.evento(chave, await assinar(pedido(chave), c.emitente));
    expect(codigo(dup)).toBe('E0840');
    expect(JSON.stringify(corpo(dup))).toContain('Cancelamento de NFS-e');
    expect((await s.evento(chave, await assinar(pedido(chave, { tp: '101103' }), c.emitente))).status).toBe(201);
    expect(s.sim.inspect.eventos()).toHaveLength(2);
  });

  test('regras e recepção do pedido', async () => {
    const s = ctx();
    const chave = await emitida(s);
    const outra = `${chave.slice(0, -1)}${chave.endsWith('0') ? '1' : '0'}`;
    expect(codigo(await s.evento(chave, await assinar(pedido(chave, { tpAmb: '1' }), c.emitente)))).toBe('E1845');
    expect(codigo(await s.evento(outra, await assinar(pedido(outra), c.emitente)))).toBe('E1831');
    expect(codigo(await s.evento(outra, await assinar(pedido(chave), c.emitente)))).toBe('E1831');
    expect(codigo(await s.evento(chave, DECL + pedido(chave).xml))).toBe('E1989');
    expect(codigo(await s.evento(chave, await assinar(pedido(chave), c.terceiro)))).toBe('E0812');
    expect(codigo(await s.evento(chave, await assinar(pedido(chave, { cpfAutor: '52998224725' }), c.ecpf)))).toBe(
      'E0815',
    );
    expect(codigo(await s.evento(chave, await assinar(pedido(chave), c.vencido)))).toBe('E1983');
    expect(codigo(await s.evento(chave, await assinar(pedido(chave), c.semDocumento)))).toBe('E1986');
    expect(
      codigo(await s.evento(chave, (await assinar(pedido(chave), c.emitente)).replace('Motivo com', 'Motivo sem'))),
    ).toBe('E1980');
    expect(codigo(await s.evento(chave, `${DECL}<DPS xmlns="${NS}"/>`))).toBe('E1242');
    expect(codigo(await s.evento(chave, `${DECL}<pedRegEvento xmlns="${NS}" versao="1.01"/>`))).toBe('E1235');
    expect(codigo(await s.evento(chave, 'x'))).toBe('E1229');
    expect(await s.evento(chave, 'x', null)).toMatchObject({ status: 403 });
  });

  test('autor do cancelamento tem de ser o emitente (E0813, E0816) e o canal, do próprio autor (403)', async () => {
    const s = ctx();
    const chave = await emitida(s);
    const alheio = await assinar(pedido(chave, { cnpjAutor: TERCEIRO }), c.terceiro);
    expect(codigo(await s.evento(chave, alheio, c.terceiro))).toBe('E0813');
    const cpf = await assinar(pedido(chave, { cpfAutor: CPF }), c.ecpf);
    expect(codigo(await s.evento(chave, cpf, c.ecpf))).toBe('E0816');
    expect(await s.evento(chave, await assinar(pedido(chave), c.emitente), c.terceiro)).toMatchObject({ status: 403 });
    expect(s.sim.inspect.nfse(chave)?.situacao).toBe('normal');
    // O e105102 é da Sefin: pedido do contribuinte, mesmo do emitente, é E0813 e não registra nada.
    const id = `PRE${chave}105102`;
    const e105102 = {
      id,
      xml:
        `<pedRegEvento xmlns="${NS}" versao="1.01"><infPedReg Id="${id}"><tpAmb>2</tpAmb><verAplic>teste</verAplic>` +
        `<dhEvento>2026-09-26T10:00:00-03:00</dhEvento><CNPJAutor>${EMITENTE}</CNPJAutor><chNFSe>${chave}</chNFSe>` +
        `<e105102><xDesc>Cancelamento de NFS-e por Substituição</xDesc><cMotivo>99</cMotivo><xMotivo>Outros motivos de teste</xMotivo>` +
        `<chSubstituta>${chave}</chSubstituta></e105102></infPedReg></pedRegEvento>`,
    };
    expect(codigo(await s.evento(chave, await assinar(e105102, c.emitente)))).toBe('E0813');
    expect(s.sim.inspect.eventos(chave)).toHaveLength(0);
    expect((await s.evento(chave, await assinar(pedido(chave), c.emitente))).status).toBe(201);
  });

  test('prazo de cancelamento do município (E0822)', async () => {
    const s = ctx();
    const chave = await emitida(s);
    s.clock.advance(31 * 86_400_000);
    expect(codigo(await s.evento(chave, await assinar(pedido(chave), c.emitente)))).toBe('E0822');
  });
});

describe('consultas e parametrização', () => {
  test('NFS-e, DPS e eventos com filtro', async () => {
    const s = ctx();
    const d = dps();
    const { chave } = await nfseDe(await s.emitir(await assinar(d, c.emitente)));
    const get = (path: string): Promise<SimResult> => s.req({ path });
    const n = await get(`/sefin/nfse/${chave}`);
    expect(n.status).toBe(200);
    expect(await gunzip(corpo(n).nfseXmlGZipB64 as string)).toContain(`NFS${chave}`);
    expect((await get(`/sefin/nfse/${'9'.repeat(50)}`)).status).toBe(404);
    expect(corpo(await get(`/sefin/dps/${d.id}`))).toMatchObject({ idDps: d.id, chaveAcesso: chave });
    expect((await get('/sefin/dps/DPS0')).status).toBe(404);
    await s.evento(chave, await assinar(pedido(chave), c.emitente));
    // Como a Sefin da produção restrita em 28/09/2026: 405 sem o tipo, 404 HTML do IIS sem a sequência.
    const semTipo = await get(`/sefin/nfse/${chave}/eventos`);
    expect([semTipo.status, semTipo.headers['content-type']]).toEqual([405, 'text/html']);
    const semSeq = await get(`/sefin/nfse/${chave}/eventos/101101`);
    expect([semSeq.status, semSeq.headers['content-type']]).toEqual([404, 'text/html']);
    expect(String(semSeq.body)).toStartWith('<!DOCTYPE html>');
    const r = await get(`/sefin/nfse/${chave}/eventos/101101/1?x=1`);
    expect(r.status).toBe(200);
    expect(Object.keys(corpo(r)).sort()).toEqual([
      'dataHoraProcessamento',
      'eventos',
      'tipoAmbiente',
      'versaoAplicativo',
    ]);
    const lista = corpo(r).eventos as Record<string, unknown>[];
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ chaveAcesso: chave, tipoEvento: '101101', numeroPedidoRegistroEvento: '1' });
    expect(Object.keys(lista[0] ?? {}).sort()).toEqual([
      'arquivoXml',
      'chaveAcesso',
      'dataHoraRecebimento',
      'numeroPedidoRegistroEvento',
      'tipoEvento',
    ]);
    expect(lista[0]?.dataHoraRecebimento).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/);
    const arquivo = lista[0]?.arquivoXml as string;
    expect(arquivo).toStartWith('SDRzSUFBQUFB');
    const interno = new TextDecoder().decode(base64Decode(arquivo));
    expect(interno).toStartWith('H4sI');
    expect(await gunzip(interno)).toBe(s.sim.inspect.eventos(chave)[0]?.xml as string);
    const semEvento = await get(`/sefin/nfse/${chave}/eventos/101101/2`);
    expect([semEvento.status, corpo(semEvento)]).toEqual([404, {}]);
    expect((await get(`/sefin/nfse/${chave}/eventos/105102/1`)).status).toBe(404);
    expect((await get(`/sefin/nfse/${'9'.repeat(50)}/eventos/101101/1`)).status).toBe(404);
    // O DANFSe do ADN não é simulado: a API de geração foi suspensa (NT SE/CGNFS-e 008/2026).
    expect((await get(`/danfse/${chave}`)).status).toBe(404);
  });

  test('rotas desconhecidas', async () => {
    const s = ctx();
    for (const r of [
      { path: '/sefin/outra' },
      { path: '/sefin/nfse', method: 'GET' },
      { path: '/adn/qualquer' },
      { path: '/parametrizacao/x', method: 'POST' },
      { path: `/parametrizacao/${SAO_PAULO}/qualquer` },
    ]) {
      expect((await s.req(r)).status).toBe(404);
    }
  });

  test('parametrização: convênio, alíquotas, histórico, regimes especiais, retenções e benefício', async () => {
    const s = ctx();
    const get = async (path: string): Promise<[number, Record<string, unknown>]> => {
      const r = await s.req({ path: `/parametrizacao${path}` });
      return [r.status, corpo(r)];
    };
    expect(await get(`/${SAO_PAULO}/convenio`)).toEqual([
      200,
      expect.objectContaining({ parametrosConvenio: expect.objectContaining({ aderenteEmissorNacional: 1 }) }),
    ]);
    expect((await get(`/${CAMPINAS}/convenio`))[1].parametrosConvenio).toMatchObject({ aderenteEmissorNacional: 0 });
    expect((await get('/3106200/convenio'))[0]).toBe(404);
    const [st, al] = await get(`/${SAO_PAULO}/01.01.01.000/2026-09-26/aliquota`);
    expect(st).toBe(200);
    expect(al.aliquotas).toEqual({
      '01.01.01.000': [{ Incidencia: 'SIM', Aliq: 2, DtIni: '2026-01-01T00:00:00', DtFim: null }],
    });
    expect((await get(`/${SAO_PAULO}/010101/2026-09-26/aliquota`))[0]).toBe(400);
    expect((await get(`/${SAO_PAULO}/17.01.01.000/2026-09-26/aliquota`))[0]).toBe(404);
    const [, hist] = await get(`/${SAO_PAULO}/17.01.01.000/historicoaliquotas`);
    expect(hist.aliquotas).toMatchObject({ '17.01.01.000': [{ DtFim: '2025-03-17T00:00:00' }] });
    expect((await get(`/${SAO_PAULO}/010101/historicoaliquotas`))[0]).toBe(400);
    expect((await get(`/${SAO_PAULO}/01.01.02.000/historicoaliquotas`))[0]).toBe(404);
    expect((await get(`/${SAO_PAULO}/99.01.01.000/historicoaliquotas`))[0]).toBe(404);
    expect((await get(`/${SAO_PAULO}/01.01.01.000/2026-09-26/regimes_especiais`))[1]).toMatchObject({
      regimesEspeciais: [{ codigo: 1 }],
    });
    expect((await get(`/${SAO_PAULO}/01.01.01.000/2026-09-25/regimes_especiais`))[0]).toBe(404);
    expect((await get(`/${SAO_PAULO}/2026-09-26/retencoes`))[0]).toBe(200);
    expect((await get(`/${CAMPINAS}/2026-09-26/retencoes`))[0]).toBe(404);
    expect((await get(`/${SAO_PAULO}/12345678901234/2026-09-26/beneficio`))[1]).toMatchObject({
      beneficio: { tipo: 1 },
    });
  });

  test('configuração inválida é ConfigError', () => {
    const base = { clock: manualClock(INICIO), signer: c.servidor.signer };
    expect(() => createNfseSim({ ...base, municipios: [{ cMun: '355', nome: 'x' }] })).toThrow(ConfigError);
    expect(() =>
      createNfseSim({
        ...base,
        municipios: [{ cMun: SAO_PAULO, nome: 'x', servicos: [{ codigo: '1', aliquotas: [] }] }],
      }),
    ).toThrow(ConfigError);
  });

  test('município com UF inválida no cadastro simulado é ConfigError na geração', async () => {
    const s = ctx({ municipios: [{ cMun: '9900000', nome: 'x', servicos: [] }] });
    const d = dps({ cLocEmi: '9900000', tribISSQN: '2' });
    await expect(s.emitir(await assinar(d, c.emitente))).rejects.toThrow(ConfigError);
  });
});

describe('falhas injetadas', () => {
  test('HTTP, queda antes e depois, espera e escopo por rota', async () => {
    const s = ctx();
    const xml = await assinar(dps(), c.emitente);
    s.sim.injectFault({ kind: 'http', status: 503 }, { rota: 'emitir' });
    expect((await s.req({ path: '/danfse/1' })).status).toBe(404);
    expect(await s.emitir(xml)).toMatchObject({ status: 503 });
    s.sim.injectFault({ kind: 'drop', phase: 'before' });
    expect(await s.emitir(xml)).toMatchObject({ effect: 'drop' });
    expect(s.sim.inspect.nfses()).toHaveLength(0);
    s.sim.injectFault({ kind: 'hang', phase: 'after' }, { rota: 'emitir' });
    expect(await s.emitir(xml)).toMatchObject({ effect: 'hang', status: 201 });
    expect(s.sim.inspect.nfses()).toHaveLength(1);
    s.sim.injectFault({ kind: 'delay', ms: 5 }, { rota: 'parametrizacao', times: 2 });
    expect(await s.req({ path: `/parametrizacao/${SAO_PAULO}/convenio` })).toMatchObject({ delayMs: 5 });
    s.sim.clearFaults();
    expect(await s.req({ path: `/parametrizacao/${SAO_PAULO}/convenio` })).toMatchObject({ delayMs: 0 });
  });
});

describe('redirectNfseToSim', () => {
  function falso(): Transport & { readonly pedidos: TransportRequest[] } {
    const pedidos: TransportRequest[] = [];
    return {
      pedidos,
      capabilities: {
        runtime: 'custom',
        renegotiation: true,
        tls12Cbc: true,
        tls12Dhe: true,
        sigalgsControl: false,
        clientCertificateCheck: false,
      },
      async send(req: TransportRequest): Promise<TransportResponse> {
        pedidos.push(req);
        return {
          status: 200,
          headers: {},
          body: new Uint8Array(),
          tls: { protocol: undefined, cipher: undefined, resumed: undefined, clientCertificateLoaded: undefined },
          text: (): string => '',
        };
      },
      close: async (): Promise<void> => undefined,
    };
  }

  test('troca a base da API pelo simulador e barra o que não é da NFS-e', async () => {
    expect(() => redirectNfseToSim(falso(), 'http://localhost:1')).toThrow(ConfigError);
    const t = falso();
    const r = redirectNfseToSim(t, 'https://127.0.0.1:8443/');
    const ep = nfseEndpoint({ ambiente: 'homologacao', api: 'parametrizacao' });
    await r.send({ url: `${ep.url}/${SAO_PAULO}/convenio`, endpoint: ep });
    expect(t.pedidos[0]).toMatchObject({
      url: `https://127.0.0.1:8443/parametrizacao/${SAO_PAULO}/convenio`,
      endpoint: { host: '127.0.0.1', tls: undefined },
    });
    await expect(r.send({ url: 'https://exemplo.invalid/x' })).rejects.toThrow(ConfigError);
    await expect(r.send({ url: 'https://exemplo.invalid/x', endpoint: ep })).rejects.toThrow('fora da base');
    await r.close();
  });
});
