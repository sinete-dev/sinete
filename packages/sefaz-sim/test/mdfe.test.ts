/**
 * Serviços do MDF-e 3.00 no simulador (SVRS): recepção síncrona compactada, consulta, não encerrados, status e
 * eventos, com as regras do MOC do MDF-e. Toda resposta é conferida contra o schema oficial do retorno.
 */
import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao } from '@sinete/core';
import { mdfeEndpoint } from '@sinete/transport';
import { montarChaveAcesso } from '@sinete/validators';
import type { CertificadoSintetico } from '../src/index.ts';
import { redirecionarParaSim, rotaDe, SERVICOS_MDFE, transporteSim, URL_BASE_SIM } from '../src/index.ts';
import { CPF, cnpj, EMITENTE, harness, TERCEIRO, tag, tags } from './helpers.ts';
import {
  comprimirGzipBase64,
  consNaoEnc,
  consSit,
  consStat,
  detMdfe,
  eventoMdfe,
  mdfe,
  sendMdfe,
} from './mdfe-helpers.ts';

const HORA = 3_600_000;

describe('rotas e envelope', () => {
  test('caminhos na UF simulada e nomes dos WSDL do MDF-e', () => {
    expect(rotaDe('/uf/ws/MDFeRecepcaoSinc')?.definicao).toBe(SERVICOS_MDFE.MDFeRecepcaoSinc);
    expect(rotaDe('/svc/ws/MDFeConsulta')).toBeUndefined();
  });

  test('redirecionarParaSim atende o MDF-e dos dados do transporte e recusa a distribuição', async () => {
    const h = await harness();
    const t = redirecionarParaSim(transporteSim(h.sim, { certificadoDoCliente: h.c.ecpf.der }), URL_BASE_SIM);
    const ep = mdfeEndpoint({ ambiente: 'homologacao', servico: 'MDFeDistribuicaoDFe' });
    await expect(t.enviar({ url: ep.url, endpoint: ep, corpo: '' })).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });

  test('área de dados que não é GZip (244) e XML com espaço entre as tags (599)', async () => {
    const h = await harness();
    const r = await sendMdfe(h, 'MDFeRecepcaoSinc', 'isto-nao-e-gzip', h.c.ecpf, true);
    expect(tag(r, 'cStat')).toBe('244');
    const m = await mdfe(h.c.ecpf);
    const espacado = m.xml.replace('<ide>', '<ide> ');
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoSinc', espacado), 'cStat')).toBe('599');
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoSinc', m.xml.replace('<modal>1', '<modal>9')), 'cStat')).toBe('215');
  });

  test('214 medido durante a descompactação: GZip pequeno que abre em muito mais que o limite', async () => {
    const h = await harness({ tamanhoMaximoMdfe: 4096 });
    const bomba = await comprimirGzipBase64(`<MDFe>${'A'.repeat(4 * 1024 * 1024)}</MDFe>`);
    expect(bomba.length).toBeLessThan(16 * 1024);
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoSinc', bomba, h.c.ecpf, true), 'cStat')).toBe('214');
  });

  test('status: 107, 252 e paralisação 108 só do MDF-e', async () => {
    const h = await harness();
    expect(tag(await sendMdfe(h, 'MDFeStatusServico', consStat()), 'cStat')).toBe('107');
    expect(tag(await sendMdfe(h, 'MDFeStatusServico', consStat('1')), 'cStat')).toBe('252');
    h.sim.definirParalisacaoMdfe('109');
    expect(tag(await sendMdfe(h, 'MDFeStatusServico', consStat()), 'cStat')).toBe('109');
  });
});

describe('recepção (Anexo I, grupo F)', () => {
  test('autoriza com o protocolo 9 + cUF + ano e o digVal da assinatura', async () => {
    const h = await harness();
    const m = await mdfe(h.c.ecpf);
    const r = await sendMdfe(h, 'MDFeRecepcaoSinc', m.xml);
    expect(tags(r, 'cStat')).toEqual(['100', '100']);
    expect(tag(r, 'nProt')).toMatch(/^95126\d{10}$/);
    expect(tag(r, 'xMotivo')).toBe('Autorizado o uso do MDF-e');
    expect(h.sim.inspecao.mdfe(m.chave)?.xml).toBe(m.xml);
  });

  test('regras de forma: ambiente, DV, série e tipo do emitente, datas e QR Code', async () => {
    const h = await harness();
    const e = h.c.ecpf;
    const cStat = async (x: Promise<{ xml: string }>): Promise<string | undefined> =>
      tag(await sendMdfe(h, 'MDFeRecepcaoSinc', (await x).xml), 'cStat');
    expect(await cStat(mdfe(e, { tpAmb: '1', qr: false }))).toBe('252');
    expect(await cStat(mdfe(e, { cDV: '0', nMDF: 2 }))).toBe('253');
    expect(await cStat(mdfe(e, { serie: 1 }))).toBe('233');
    expect(await cStat(mdfe(e, { tpEmit: '1' }))).toBe('234');
    expect(await cStat(mdfe(h.c.emitente, { emitente: { CNPJ: EMITENTE }, serie: 920 }))).toBe('232');
    expect(await cStat(mdfe(e, { dhEmi: '2026-09-26T12:00:00-04:00' }))).toBe('212');
    expect(await cStat(mdfe(e, { dhEmi: '2026-09-25T08:00:00-04:00' }))).toBe('228');
    expect(await cStat(mdfe(e, { qr: false }))).toBe('480');
    expect(await cStat(mdfe(e, { qr: `https://outro.invalid/mdfe/qrCode?chMDFe=${'1'.repeat(44)}&tpAmb=2` }))).toBe(
      '479',
    );
    expect(
      await cStat(
        mdfe(e, { tpEmis: '2', qr: `https://dfe-portal.svrs.rs.gov.br/MDFE/QRCODE?chMDFe=${'1'.repeat(44)}&tpAmb=2` }),
      ),
    ).toBe('481');
    expect(
      await cStat(
        mdfe(e, { tpEmis: '2', nMDF: 3 }).then(async (m) => ({
          xml: m.xml.replace('&amp;sign=QUJD', ''),
        })),
      ),
    ).toBe('482');
    // Assinado por outro titular: E03 (213) contra o CPF do emitente.
    expect(await cStat(mdfe(h.c.emitente))).toBe('213');
  });

  test('duplicidade: 204 com o mesmo cMDF, 539 com outro, com os marcadores preenchidos', async () => {
    const h = await harness();
    const a = await mdfe(h.c.ecpf);
    await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    const nProt = h.sim.inspecao.mdfe(a.chave)?.nProt as string;
    const dup = await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    expect(tag(dup, 'cStat')).toBe('204');
    expect(tag(dup, 'xMotivo')).toContain(`[nProt:${nProt}]`);
    const b = await mdfe(h.c.ecpf, { cMDF: '87654321' });
    const r = await sendMdfe(h, 'MDFeRecepcaoSinc', b.xml);
    expect(tag(r, 'cStat')).toBe('539');
    expect(tag(r, 'xMotivo')).toContain(`[chMDFe:${a.chave}]`);
  });

  test('não encerrados: 611 mesma placa e UF de fim, 662 sentido oposto, 462 mais de 5 dias, 686 mais de 30 dias', async () => {
    const h = await harness();
    await sendMdfe(h, 'MDFeRecepcaoSinc', (await mdfe(h.c.ecpf)).xml);
    const cStat = async (p: Parameters<typeof mdfe>[1]): Promise<string | undefined> =>
      tag(await sendMdfe(h, 'MDFeRecepcaoSinc', (await mdfe(h.c.ecpf, p)).xml), 'cStat');
    expect(await cStat({ nMDF: 2 })).toBe('611');
    expect(await cStat({ nMDF: 3, ufIni: 'SP', ufFim: 'MT', cMunCarrega: '3550308', cMunDescarga: '5103403' })).toBe(
      '662',
    );
    h.clock.avancar(6 * 24 * HORA);
    const dia = (d: string): string => `2026-10-${d}T09:00:00-04:00`;
    expect(await cStat({ nMDF: 4, ufFim: 'GO', cMunDescarga: '5208707', dhEmi: dia('02') })).toBe('462');
    h.clock.avancar(25 * 24 * HORA);
    expect(await cStat({ nMDF: 5, placa: 'XYZ9A87', ufFim: 'GO', cMunDescarga: '5208707', dhEmi: dia('27') })).toBe(
      '686',
    );
  });

  test('686 é pelo CNPJ completo: outra filial da mesma raiz com outro veículo passa', async () => {
    const h = await harness();
    const matriz = { CNPJ: EMITENTE };
    await sendMdfe(h, 'MDFeRecepcaoSinc', (await mdfe(h.c.emitente, { emitente: matriz })).xml, h.c.emitente);
    h.clock.avancar(31 * 24 * HORA);
    const depois = { ufFim: 'GO', cMunDescarga: '5208707', dhEmi: '2026-10-27T09:00:00-04:00' };
    const cStat = async (p: Parameters<typeof mdfe>[1]): Promise<string | undefined> =>
      tag(await sendMdfe(h, 'MDFeRecepcaoSinc', (await mdfe(h.c.emitente, p)).xml, h.c.emitente), 'cStat');
    const filial = { CNPJ: cnpj('112223330002') };
    expect(await cStat({ ...depois, emitente: filial, nMDF: 2, placa: 'XYZ9A87' })).toBe('100');
    expect(await cStat({ ...depois, emitente: matriz, nMDF: 3, placa: 'QWE4R56' })).toBe('686');
  });
});

describe('consultas', () => {
  test('consulta: 236, 217, 216 e as situações 100, 101 e 132 com os envelopes do leiaute', async () => {
    const h = await harness();
    const a = await mdfe(h.c.ecpf);
    expect(tag(await sendMdfe(h, 'MDFeConsulta', consSit('1'.repeat(44))), 'cStat')).toBe('236');
    expect(tag(await sendMdfe(h, 'MDFeConsulta', consSit(a.chave)), 'cStat')).toBe('217');
    await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    const outra = await mdfe(h.c.ecpf, { cMDF: '87654321' });
    expect(tag(await sendMdfe(h, 'MDFeConsulta', consSit(outra.chave)), 'cStat')).toBe('216');
    const r = await sendMdfe(h, 'MDFeConsulta', consSit(a.chave));
    expect(tag(r, 'cStat')).toBe('100');
    // protMDFe da consulta: envelope com versao e, dentro, o protMDFe do MDF-e.
    expect(r).toMatch(
      /<protMDFe versao="3.00"><protMDFe xmlns="http:\/\/www.portalfiscal.inf.br\/mdfe" versao="3.00"><infProt/,
    );
    const nProt = h.sim.inspecao.mdfe(a.chave)?.nProt as string;
    h.clock.avancar(HORA);
    const enc = await sendMdfe(
      h,
      'MDFeRecepcaoEvento',
      await eventoMdfe(h.c.ecpf, { chave: a.chave, tpEvento: '110112', det: detMdfe.enc(nProt) }),
    );
    expect(tag(enc, 'cStat')).toBe('135');
    const r2 = await sendMdfe(h, 'MDFeConsulta', consSit(a.chave));
    expect(tag(r2, 'cStat')).toBe('132');
    expect(r2).toMatch(/<procEventoMDFe versao="3.00"><procEventoMDFe xmlns="[^"]+" versao="3.00"><eventoMDFe/);
  });

  test('não encerrados: 111 com a lista, 112 sem, 210 CPF inválido e 202 pelo canal de outro CPF', async () => {
    const h = await harness();
    const a = await mdfe(h.c.ecpf);
    expect(tag(await sendMdfe(h, 'MDFeConsNaoEnc', consNaoEnc('11144477735')), 'cStat')).toBe('112');
    await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    const r = await sendMdfe(h, 'MDFeConsNaoEnc', consNaoEnc('11144477735'));
    expect(tag(r, 'cStat')).toBe('111');
    expect(tag(r, 'chMDFe')).toBe(a.chave);
    expect(tag(await sendMdfe(h, 'MDFeConsNaoEnc', consNaoEnc('11144477700')), 'cStat')).toBe('210');
    expect(
      tag(await sendMdfe(h, 'MDFeConsNaoEnc', consNaoEnc(cnpj('998877660001'), 'CNPJ'), h.c.emitente), 'cStat'),
    ).toBe('213');
  });
});

describe('eventos (J01 a J16 e regras de cada tipo)', () => {
  test('regras gerais: Id, tipo, autor, chave desconhecida, datas, sequencial e schema do detalhe', async () => {
    const h = await harness();
    const a = await mdfe(h.c.ecpf);
    await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    const nProt = h.sim.inspecao.mdfe(a.chave)?.nProt as string;
    const cStat = async (p: Parameters<typeof eventoMdfe>[1], signer = h.c.ecpf): Promise<string | undefined> =>
      tag(await sendMdfe(h, 'MDFeRecepcaoEvento', await eventoMdfe(signer, p)), 'cStat');
    const canc = { chave: a.chave, tpEvento: '110111', det: detMdfe.canc(nProt) };
    expect(await cStat({ ...canc, id: `ID110111${a.chave}02` })).toBe('628');
    expect(await cStat({ ...canc, tpEvento: '110999' })).toBe('629');
    expect(await cStat({ ...canc, det: '<evCancMDFe><descEvento>Cancelamento</descEvento></evCancMDFe>' })).toBe('630');
    // Detalhe válido de outro tipo: o schema combinado aceita, a J06 recusa e o MDF-e não muda.
    expect(await cStat({ ...canc, det: detMdfe.enc(nProt) })).toBe('630');
    expect(h.sim.inspecao.mdfe(a.chave)?.situacao).toBe('autorizado');
    expect(await cStat({ ...canc, autor: `<CNPJ>${EMITENTE}</CNPJ>` }, h.c.emitente)).toBe('632');
    const outra = await mdfe(h.c.ecpf, { nMDF: 9 });
    expect(await cStat({ ...canc, chave: outra.chave })).toBe('217');
    expect(await cStat({ ...canc, dhEvento: '2026-09-26T07:00:00-03:00' })).toBe('634');
    expect(await cStat({ ...canc, dhEvento: '2026-09-26T12:00:00-03:00' })).toBe('635');
    expect(await cStat({ ...canc, nSeq: 2 })).toBe('636');
    expect(await cStat({ chave: a.chave, tpEvento: '110114', det: detMdfe.condutor('12345678900') })).toBe('645');
  });

  test('cancelamento: prazo de 24 horas (220) e protocolo diferente (222); encerramento depois do cancelamento (218)', async () => {
    const h = await harness({ prazoCancelamentoMdfeHoras: 2 });
    const a = await mdfe(h.c.ecpf);
    await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    const nProt = h.sim.inspecao.mdfe(a.chave)?.nProt as string;
    const ev = (det: string, tpEvento = '110111', dhEvento = '2026-09-26T13:30:00-03:00'): Promise<string> =>
      eventoMdfe(h.c.ecpf, { chave: a.chave, tpEvento, det, dhEvento });
    h.clock.avancar(3 * HORA + 30 * 60_000);
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoEvento', await ev(detMdfe.canc(nProt))), 'cStat')).toBe('220');
    const h2 = await harness();
    const b = await mdfe(h2.c.ecpf);
    await sendMdfe(h2, 'MDFeRecepcaoSinc', b.xml);
    const nProtB = h2.sim.inspecao.mdfe(b.chave)?.nProt as string;
    const evB = async (det: string, tpEvento = '110111'): Promise<string | undefined> =>
      tag(
        await sendMdfe(h2, 'MDFeRecepcaoEvento', await eventoMdfe(h2.c.ecpf, { chave: b.chave, tpEvento, det })),
        'cStat',
      );
    expect(await evB(detMdfe.canc('951260000009999'))).toBe('222');
    expect(await evB(detMdfe.canc(nProtB))).toBe('135');
    expect(h2.sim.inspecao.mdfe(b.chave)?.situacao).toBe('cancelado');
    expect(await evB(detMdfe.enc(nProtB), '110112')).toBe('218');
  });

  test('encerramento: município (614), exterior (689), data (615); inclusão de condutor depois do encerramento (609)', async () => {
    const h = await harness();
    const a = await mdfe(h.c.ecpf);
    await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    const nProt = h.sim.inspecao.mdfe(a.chave)?.nProt as string;
    const cStat = async (det: string, tpEvento = '110112', nSeq = 1): Promise<string | undefined> =>
      tag(
        await sendMdfe(h, 'MDFeRecepcaoEvento', await eventoMdfe(h.c.ecpf, { chave: a.chave, tpEvento, det, nSeq })),
        'cStat',
      );
    expect(await cStat(detMdfe.enc(nProt, '2026-09-26', '35', '5103403'))).toBe('614');
    expect(await cStat(detMdfe.enc(nProt, '2026-09-26', '99', '3550308'))).toBe('689');
    expect(await cStat(detMdfe.enc(nProt, '2026-09-25'))).toBe('615');
    expect(await cStat(detMdfe.enc(nProt))).toBe('135');
    expect(await cStat(detMdfe.condutor(), '110114')).toBe('609');
  });

  test('carregamento posterior: encerrar sem inclusão de DF-e é 715', async () => {
    const h = await harness();
    const a = await mdfe(h.c.ecpf, { carregaPosterior: true, ufFim: 'MT', cMunDescarga: '5103403' });
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml), 'cStat')).toBe('100');
    const nProt = h.sim.inspecao.mdfe(a.chave)?.nProt as string;
    const enc = await eventoMdfe(h.c.ecpf, {
      chave: a.chave,
      tpEvento: '110112',
      det: detMdfe.enc(nProt, '2026-09-26', '51', '5103403'),
    });
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoEvento', enc), 'cStat')).toBe('715');
  });

  test('inclusão de DF-e: 708 sem carregamento posterior, 456, 612, 709, 711; cancelamento depois dela (710)', async () => {
    const h = await harness();
    const normal = await mdfe(h.c.ecpf, { nMDF: 2 });
    await sendMdfe(h, 'MDFeRecepcaoSinc', normal.xml);
    const a = await mdfe(h.c.ecpf, { carregaPosterior: true, ufFim: 'MT', cMunDescarga: '5103403' });
    await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    const prot = (ch: string): string => h.sim.inspecao.mdfe(ch)?.nProt as string;
    const nfe = (mod = '55'): string =>
      montarChaveAcesso({
        cUF: '51',
        aamm: '2609',
        emitente: EMITENTE,
        mod,
        serie: 1,
        nNF: 1,
        tpEmis: '1',
        cNF: '11111111',
      });
    const inc = (nProt: string, carrega = '5108402', descarga = '5103403', chNFe = nfe()): string =>
      `<evIncDFeMDFe><descEvento>Inclusao DF-e</descEvento><nProt>${nProt}</nProt><cMunCarrega>${carrega}</cMunCarrega>` +
      `<xMunCarrega>ORIGEM</xMunCarrega><infDoc><cMunDescarga>${descarga}</cMunDescarga><xMunDescarga>DESTINO</xMunDescarga>` +
      `<chNFe>${chNFe}</chNFe></infDoc></evIncDFeMDFe>`;
    const cStat = async (chave: string, det: string, nSeq = 1, tpEvento = '110115'): Promise<string | undefined> =>
      tag(await sendMdfe(h, 'MDFeRecepcaoEvento', await eventoMdfe(h.c.ecpf, { chave, tpEvento, det, nSeq })), 'cStat');
    expect(await cStat(normal.chave, inc(prot(normal.chave)))).toBe('708');
    const nProt = prot(a.chave);
    expect(await cStat(a.chave, inc(nProt, '3550308'))).toBe('456');
    expect(await cStat(a.chave, inc(nProt, '5108402', '3550308'))).toBe('612');
    expect(await cStat(a.chave, inc(nProt, '5108402', '5103403', nfe('57')))).toBe('709');
    expect(await cStat(a.chave, inc(nProt))).toBe('135');
    expect(await cStat(a.chave, inc(nProt), 2)).toBe('711');
    // A inclusão carregou em município que não está no MDF-e: o cancelamento é recusado (K08).
    expect(await cStat(a.chave, detMdfe.canc(nProt), 1, '110111')).toBe('710');
    const enc = detMdfe.enc(nProt, '2026-09-26', '51', '5103403');
    expect(await cStat(a.chave, enc, 1, '110112')).toBe('135');
    // Evento repetido: J08 (631) vem antes das regras do tipo.
    expect(await cStat(a.chave, enc, 1, '110112')).toBe('631');
    // Chave de outro modelo: J07 (236).
    const mod57 = `${a.chave.slice(0, 20)}57${a.chave.slice(22)}`;
    expect(await cStat(mod57, detMdfe.canc(nProt), 1, '110111')).toBe('236');
  });

  test('pagamento da operação: K03 a K07 e as regras do grupo infPag (724 a 746)', async () => {
    const h = await harness();
    const semTac = await mdfe(h.c.ecpf, { nMDF: 2, tpProp: '1', placa: 'SEM1T00' });
    await sendMdfe(h, 'MDFeRecepcaoSinc', semTac.xml);
    const a = await mdfe(h.c.ecpf, { tpProp: '0' });
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml), 'cStat')).toBe('100');
    const prot = (ch: string): string => h.sim.inspecao.mdfe(ch)?.nProt as string;
    interface Pag {
      readonly doc?: string;
      readonly comps?: string;
      readonly vContrato?: string;
      readonly indPag?: '0' | '1';
      readonly vAdiant?: string;
      readonly prazo?: readonly (readonly [string, string, string])[];
      readonly banco?: string;
    }
    const parcelas = [
      ['001', '2026-10-10', '600.00'],
      ['002', '2026-11-10', '400.00'],
    ] as const;
    const pag = (nProt: string, p: Pag = {}): string =>
      `<evPagtoOperMDFe><descEvento>Pagamento Operacao MDF-e</descEvento><nProt>${nProt}</nProt>` +
      '<infViagens><qtdViagens>00001</qtdViagens><nroViagem>00001</nroViagem></infViagens>' +
      `<infPag>${p.doc ?? '<CNPJ>11222333000181</CNPJ>'}${p.comps ?? '<Comp><tpComp>01</tpComp><vComp>1000.00</vComp></Comp>'}` +
      `<vContrato>${p.vContrato ?? '1000.00'}</vContrato><indPag>${p.indPag ?? '1'}</indPag>` +
      `${p.vAdiant === undefined ? '' : `<vAdiant>${p.vAdiant}</vAdiant>`}` +
      (p.prazo ?? parcelas)
        .map(
          ([n, d, v]) => `<infPrazo><nParcela>${n}</nParcela><dVenc>${d}</dVenc><vParcela>${v}</vParcela></infPrazo>`,
        )
        .join('') +
      `<infBanc>${p.banco ?? '<PIX>pix-sintetico</PIX>'}</infBanc></infPag></evPagtoOperMDFe>`;
    const cStat = async (chave: string, det: string, tpEvento = '110116'): Promise<string | undefined> =>
      tag(await sendMdfe(h, 'MDFeRecepcaoEvento', await eventoMdfe(h.c.ecpf, { chave, tpEvento, det })), 'cStat');
    expect(await cStat(semTac.chave, pag(prot(semTac.chave)))).toBe('723');
    const nProt = prot(a.chave);
    expect(await cStat(a.chave, pag('951260000009999'))).toBe('222');
    expect(await cStat(a.chave, pag(nProt, { prazo: [] }))).toBe('724');
    expect(await cStat(a.chave, pag(nProt, { indPag: '0' }))).toBe('729');
    expect(await cStat(a.chave, pag(nProt, { doc: '<CNPJ>11222333000100</CNPJ>' }))).toBe('727');
    expect(await cStat(a.chave, pag(nProt, { banco: '<CNPJIPEF>11222333000100</CNPJIPEF>' }))).toBe('728');
    expect(await cStat(a.chave, pag(nProt, { vContrato: '1100.00' }))).toBe('746');
    expect(await cStat(a.chave, pag(nProt, { prazo: [['002', '2026-10-10', '1000.00']] }))).toBe('735');
    expect(await cStat(a.chave, pag(nProt, { prazo: [['001', '2026-09-25', '1000.00']] }))).toBe('736');
    const invertidas = [
      ['001', '2026-11-10', '600.00'],
      ['002', '2026-10-10', '400.00'],
    ] as const;
    expect(await cStat(a.chave, pag(nProt, { prazo: invertidas }))).toBe('737');
    expect(await cStat(a.chave, pag(nProt, { indPag: '0', prazo: [], vAdiant: '10.00' }))).toBe('739');
    expect(await cStat(a.chave, pag(nProt, { vAdiant: '10.00' }))).toBe('738');
    expect(await cStat(a.chave, pag(nProt, { vAdiant: '100.00', prazo: [['001', '2026-10-10', '900.00']] }))).toBe(
      '135',
    );
    // Cada regra desliga só a si: sem a K08, o 729 some e o que vale é o K16 (739) do mesmo grupo.
    const h2 = await harness({ regrasMdfeDesligadas: ['K08'] });
    const c2 = await mdfe(h2.c.ecpf, { tpProp: '0' });
    await sendMdfe(h2, 'MDFeRecepcaoSinc', c2.xml);
    const nProt2 = h2.sim.inspecao.mdfe(c2.chave)?.nProt as string;
    const ev2 = await eventoMdfe(h2.c.ecpf, {
      chave: c2.chave,
      tpEvento: '110116',
      det: pag(nProt2, { indPag: '0', vAdiant: '10.00' }),
    });
    expect(tag(await sendMdfe(h2, 'MDFeRecepcaoEvento', ev2), 'cStat')).toBe('739');
    expect(await cStat(a.chave, detMdfe.canc(nProt), '110111')).toBe('135');
    // Depois do cancelamento, K04 (218) do pagamento vem antes das regras do grupo.
    const b = await mdfe(h.c.ecpf, { nMDF: 3, tpProp: '0', placa: 'OUT1R00' });
    await sendMdfe(h, 'MDFeRecepcaoSinc', b.xml);
    expect(await cStat(b.chave, detMdfe.canc(prot(b.chave)), '110111')).toBe('135');
    expect(await cStat(b.chave, pag(prot(b.chave)))).toBe('218');
  });

  test('encerramento pelo transportador terceiro (NT 2024.001): autor é o proprietário do veículo (J09, K11)', async () => {
    const h = await harness();
    const a = await mdfe(h.c.ecpf, { tpProp: '0', propCnpj: TERCEIRO });
    await sendMdfe(h, 'MDFeRecepcaoSinc', a.xml);
    const nProt = h.sim.inspecao.mdfe(a.chave)?.nProt as string;
    const det = detMdfe.enc(nProt).replace('</evEncMDFe>', '<indEncPorTerceiro>1</indEncPorTerceiro></evEncMDFe>');
    const enviar = async (autor: string, signer: CertificadoSintetico, d = det): Promise<string | undefined> =>
      tag(
        await sendMdfe(
          h,
          'MDFeRecepcaoEvento',
          await eventoMdfe(signer, { chave: a.chave, tpEvento: '110112', det: d, autor }),
          signer,
        ),
        'cStat',
      );
    // Sem o indicador, o terceiro não é o emissor (632); com ele, outro que não o proprietário também é 632.
    expect(await enviar(`<CNPJ>${TERCEIRO}</CNPJ>`, h.c.terceiro, detMdfe.enc(nProt))).toBe('632');
    expect(await enviar(`<CNPJ>${EMITENTE}</CNPJ>`, h.c.emitente)).toBe('632');
    expect(await enviar(`<CNPJ>${TERCEIRO}</CNPJ>`, h.c.terceiro)).toBe('135');
    expect(h.sim.inspecao.mdfe(a.chave)?.situacao).toBe('encerrado');
    // O proprietário é o próprio emitente: o indicador de terceiro não cabe (K11, 524).
    const b = await mdfe(h.c.ecpf, { nMDF: 2, placa: 'OUT1R00', tpProp: '0', propCpf: CPF });
    await sendMdfe(h, 'MDFeRecepcaoSinc', b.xml);
    const nProtB = h.sim.inspecao.mdfe(b.chave)?.nProt as string;
    const detB = detMdfe.enc(nProtB).replace('</evEncMDFe>', '<indEncPorTerceiro>1</indEncPorTerceiro></evEncMDFe>');
    const evB = await eventoMdfe(h.c.ecpf, { chave: b.chave, tpEvento: '110112', det: detB });
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoEvento', evB), 'cStat')).toBe('524');
  });
});

describe('NT 2024.001 na recepção', () => {
  test('chave de NF-e anterior a 6 meses (519) e cavalo mecânico sem reboque (523)', async () => {
    const h = await harness();
    const cStat = async (p: Parameters<typeof mdfe>[1]): Promise<string | undefined> =>
      tag(await sendMdfe(h, 'MDFeRecepcaoSinc', (await mdfe(h.c.ecpf, p)).xml), 'cStat');
    expect(await cStat({ aammNFe: '2602' })).toBe('519');
    expect(await cStat({ tpRod: '03' })).toBe('523');
    expect(await cStat({ aammNFe: '2603' })).toBe('100');
  });
});

describe('MDF-e transportado na recepção', () => {
  test('647 fora do aquaviário e 648 sem AM ou AP', async () => {
    const h = await harness();
    const ref = (await mdfe(h.c.ecpf, { nMDF: 50 })).chave;
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoSinc', (await mdfe(h.c.ecpf, { mdfeTransp: [ref] })).xml), 'cStat')).toBe(
      '647',
    );
    const h2 = await harness({ regrasMdfeDesligadas: ['F43'] });
    const x = (await mdfe(h2.c.ecpf, { mdfeTransp: [ref] })).xml;
    expect(tag(await sendMdfe(h2, 'MDFeRecepcaoSinc', x), 'cStat')).toBe('648');
  });

  test('chave inválida (649), antiga (520), ausente (655), cancelada (657); referência autorizada passa', async () => {
    // F43 e F44 desligadas: o helper só monta o rodoviário de MT para SP.
    const h = await harness({ regrasMdfeDesligadas: ['F43', 'F44'] });
    const enviar = async (x: string): Promise<string | undefined> =>
      tag(await sendMdfe(h, 'MDFeRecepcaoSinc', x), 'cStat');
    const autorizado = await mdfe(h.c.ecpf, { nMDF: 1, placa: 'AAA1A11' });
    expect(await enviar(autorizado.xml)).toBe('100');
    const cancelado = await mdfe(h.c.ecpf, { nMDF: 2, placa: 'BBB2B22' });
    expect(await enviar(cancelado.xml)).toBe('100');
    const nProt = h.sim.inspecao.mdfe(cancelado.chave)?.nProt as string;
    const ev = await eventoMdfe(h.c.ecpf, { chave: cancelado.chave, tpEvento: '110111', det: detMdfe.canc(nProt) });
    expect(tag(await sendMdfe(h, 'MDFeRecepcaoEvento', ev), 'cStat')).toBe('135');
    const ch = autorizado.chave;
    const dv = `${ch.slice(0, 43)}${(Number(ch[43]) + 1) % 10}`;
    const nfe = montarChaveAcesso({
      cUF: '51',
      aamm: '2609',
      emitente: EMITENTE,
      mod: '55',
      serie: 1,
      nNF: 1,
      tpEmis: '1',
      cNF: '11111111',
    });
    const antiga = montarChaveAcesso({
      cUF: '51',
      aamm: '2601',
      emitente: CPF,
      mod: '58',
      serie: 920,
      nNF: 9,
      tpEmis: '1',
      cNF: '12345678',
    });
    const ausente = (await mdfe(h.c.ecpf, { nMDF: 9 })).chave;
    const com = async (nMDF: number, chave: string): Promise<string | undefined> =>
      enviar((await mdfe(h.c.ecpf, { nMDF, placa: `CCC${nMDF}C33`, mdfeTransp: [chave] })).xml);
    expect(await com(3, dv)).toBe('649');
    expect(await com(4, nfe)).toBe('649');
    expect(await com(5, antiga)).toBe('520');
    expect(await com(6, ausente)).toBe('655');
    expect(await com(7, cancelado.chave)).toBe('657');
    expect(await com(8, ch)).toBe('100');
  });
});
