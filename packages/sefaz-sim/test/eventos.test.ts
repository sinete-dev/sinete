/** NFeRecepcaoEvento4: cancelamento, cancelamento por substituição, CC-e na UF e manifestação no AN (cOrgao 91). */
import { describe, expect, test } from 'bun:test';
import { validateRoot } from '@sinete/schemas';
import * as canc from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import type { Harness } from './helpers.ts';
import {
  DESTINATARIO,
  det,
  EMITENTE,
  envEvento,
  enviNFe,
  evento,
  harness,
  nfe,
  TERCEIRO,
  tag,
  tags,
} from './helpers.ts';

async function autorizada(
  h: Harness,
  n = 1,
  extra: Parameters<typeof nfe>[0] = {},
): Promise<{ chave: string; nProt: string }> {
  const x = await nfe({ nNF: n, ...extra });
  const r = await h.send('NFeAutorizacao', enviNFe([x.xml]));
  expect(tags(r, 'cStat')[1]).toBe('100');
  return { chave: x.chave, nProt: tag(r, 'nProt') as string };
}

/** cStat de cada evento do retEnvEvento (o primeiro é o do lote). */
async function eventoStat(h: Harness, xml: string, autorizador?: 'uf' | 'an'): Promise<string> {
  const r = await h.send('RecepcaoEvento', envEvento([xml]), autorizador === undefined ? {} : { autorizador });
  expect(tags(r, 'cStat')[0]).toBe('128');
  return tags(r, 'cStat')[1] as string;
}

describe('cancelamento', () => {
  test('135 com protocolo, CNPJDest e a NF-e cancelada; de novo: 573 (mesmo tipo e sequência)', async () => {
    const h = await harness();
    const { chave, nProt } = await autorizada(h);
    const ev = await evento({ chave, tpEvento: '110111', det: det.cancelamento(nProt) });
    const r = await h.send('RecepcaoEvento', envEvento([ev]));
    expect(tags(r, 'cStat')).toEqual(['128', '135']);
    expect(tag(r, 'xEvento')).toBe('Cancelamento homologado');
    expect(tag(r, 'CNPJDest')).toBe(DESTINATARIO);
    expect(tag(r, 'nProt')).toBe('135260000000002');
    expect(tag(r, 'cOrgao')).toBe('35');
    expect(h.sim.inspect.nfe(chave)?.situacao).toBe('cancelada');
    expect(h.sim.inspect.eventos(chave)[0]?.xml).toBe(ev);
    expect(h.sim.inspect.eventos()).toHaveLength(1);
    expect(await eventoStat(h, ev)).toBe('573');
  });

  test('prazo de 24 horas (501), protocolo divergente (222), NF-e inexistente (494), data do evento (577, 578, 579)', async () => {
    const h = await harness();
    const { chave, nProt } = await autorizada(h);
    expect(
      await eventoStat(h, await evento({ chave, tpEvento: '110111', det: det.cancelamento('135260000000999') })),
    ).toBe('222');
    const inexistente = (await nfe({ nNF: 50 })).chave;
    expect(
      await eventoStat(h, await evento({ chave: inexistente, tpEvento: '110111', det: det.cancelamento(nProt) })),
    ).toBe('494');
    const antes = '2026-09-25T10:00:00-03:00';
    expect(
      await eventoStat(h, await evento({ chave, tpEvento: '110111', dhEvento: antes, det: det.cancelamento(nProt) })),
    ).toBe('577');
    const depois = '2026-09-27T10:00:00-03:00';
    expect(
      await eventoStat(h, await evento({ chave, tpEvento: '110111', dhEvento: depois, det: det.cancelamento(nProt) })),
    ).toBe('578');
    // Emitida às 09:00, autorizada às 10:00: evento às 09:30 é antes da autorização (579, tolerância de 5 minutos).
    h.clock.avancar(3_600_000);
    const tarde = await autorizada(h, 2, { dhEmi: '2026-09-26T10:30:00-03:00' });
    const cedo = '2026-09-26T10:40:00-03:00';
    expect(
      await eventoStat(
        h,
        await evento({ chave: tarde.chave, tpEvento: '110111', dhEvento: cedo, det: det.cancelamento(tarde.nProt) }),
      ),
    ).toBe('579');
    h.clock.avancar(25 * 3_600_000);
    const ev = await evento({
      chave,
      tpEvento: '110111',
      dhEvento: '2026-09-27T11:00:00-03:00',
      det: det.cancelamento(nProt),
    });
    expect(await eventoStat(h, ev)).toBe('501');
  });

  test('221 depois da confirmação da operação; liberado se o destinatário manifestar operação não realizada depois', async () => {
    const h = await harness();
    const { chave, nProt } = await autorizada(h);
    expect(await eventoStat(h, await evento({ chave, tpEvento: '210200', det: det.confirmacao() }), 'an')).toBe('135');
    const canc1 = await evento({ chave, tpEvento: '110111', det: det.cancelamento(nProt) });
    expect(await eventoStat(h, canc1)).toBe('221');
    expect(await eventoStat(h, await evento({ chave, tpEvento: '210240', det: det.naoRealizada() }), 'an')).toBe('135');
    expect(await eventoStat(h, canc1)).toBe('135');
  });

  test('regras gerais: 572 Id, 250 órgão, 252 ambiente, 489 CNPJ, 236 chave, 574 autor, 213 certificado, 491, 492', async () => {
    const h = await harness();
    const { chave, nProt } = await autorizada(h);
    const d = det.cancelamento(nProt);
    expect(await eventoStat(h, await evento({ chave, tpEvento: '110111', det: d, id: `ID110111${chave}02` }))).toBe(
      '572',
    );
    expect(await eventoStat(h, await evento({ chave, tpEvento: '110111', det: d, cOrgao: '91' }))).toBe('250');
    expect(await eventoStat(h, await evento({ chave, tpEvento: '110111', det: d, tpAmb: '1' }))).toBe('252');
    // Mesma raiz do certificado (passa no F03) com DV errado: P10-10.
    const dvInvalido = `${EMITENTE.slice(0, 12)}00`;
    expect(await eventoStat(h, await evento({ chave, tpEvento: '110111', det: d, autor: dvInvalido }))).toBe('489');
    const dvErrado = `${chave.slice(0, 43)}${(Number(chave[43]) + 1) % 10}`;
    expect(await eventoStat(h, await evento({ chave: dvErrado, tpEvento: '110111', det: d }))).toBe('236');
    expect(
      await eventoStat(h, await evento({ chave, tpEvento: '110111', det: d, autor: TERCEIRO, signer: h.c.terceiro })),
    ).toBe('574');
    expect(await eventoStat(h, await evento({ chave, tpEvento: '110111', det: d, signer: h.c.terceiro }))).toBe('213');
    // Tipo desconhecido e versão fora da tabela, a partir de um evento válido com o XML ajustado antes de assinar.
    const cce = await evento({ chave, tpEvento: '110110', det: det.cce() });
    expect(await eventoStat(h, cce.replaceAll('110110', '110130'))).toBe('491');
    const lote = envEvento([cce.replace('<verEvento>1.00</verEvento>', '<verEvento>2.00</verEvento>')]);
    const r = await h.send('RecepcaoEvento', lote);
    expect(tags(r, 'cStat')).toEqual(['128', '492']);
  });

  test('493 para detEvento fora do schema do tipo, com o lote aceito; 215 para o envelope', async () => {
    const h = await harness();
    const { chave } = await autorizada(h);
    const ruim = await evento({ chave, tpEvento: '110111', det: det.cce() });
    expect(await eventoStat(h, ruim)).toBe('493');
    const r = await h.send('RecepcaoEvento', envEvento([ruim], 'X'));
    expect(tags(r, 'cStat')).toEqual(['215']);
    expect(tag(r, 'idLote')).toBe('0');
  });
});

describe('cancelamento por substituição (110112)', () => {
  test('cancela a NFC-e substituída pela de contingência; 455, 493, 910, 911, 912, 913', async () => {
    const h = await harness();
    const cancelada = await autorizada(h, 1, { mod: '65' });
    const substituta = await autorizada(h, 2, { mod: '65', tpEmis: '9' });
    const base = { chave: cancelada.chave, tpEvento: '110112' };
    const d = (ref: string, cOrgao?: string, tpAutor?: string): string =>
      det.substituicao(cancelada.nProt, ref, cOrgao, tpAutor);
    expect(await eventoStat(h, await evento({ ...base, det: d(substituta.chave, '31') }))).toBe('455');
    // O e110112_v1.00.xsd só aceita tpAutor 1: outro autor para no schema específico (493) antes da regra P21 (466).
    expect(await eventoStat(h, await evento({ ...base, det: d(substituta.chave, '35', '2') }))).toBe('493');
    const dvErrado = `${substituta.chave.slice(0, 43)}${(Number(substituta.chave[43]) + 1) % 10}`;
    expect(await eventoStat(h, await evento({ ...base, det: d(dvErrado) }))).toBe('910');
    expect(await eventoStat(h, await evento({ ...base, det: d(cancelada.chave) }))).toBe('911');
    const deOutro = (await nfe({ nNF: 3, mod: '65', emitente: TERCEIRO })).chave;
    expect(await eventoStat(h, await evento({ ...base, det: d(deOutro) }))).toBe('911');
    const naoEmitida = (await nfe({ nNF: 4, mod: '65' })).chave;
    expect(await eventoStat(h, await evento({ ...base, det: d(naoEmitida) }))).toBe('912');
    const r = await h.send('RecepcaoEvento', envEvento([await evento({ ...base, det: d(substituta.chave) })]));
    expect(tags(r, 'cStat')).toEqual(['128', '135']);
    expect(tag(r, 'cOrgaoAutor')).toBe('35');
    expect(h.sim.inspect.nfe(cancelada.chave)?.situacao).toBe('cancelada');
    // A substituta cancelada não serve para outra substituição (913).
    const terceira = await autorizada(h, 5, { mod: '65' });
    const ev913 = await evento({
      chave: terceira.chave,
      tpEvento: '110112',
      det: det.substituicao(terceira.nProt, cancelada.chave),
    });
    expect(await eventoStat(h, ev913)).toBe('913');
  });
});

describe('carta de correção (110110)', () => {
  test('sequência 1 e 2 aceitas, 573 ao repetir, 594 acima de 20, 580 depois do cancelamento, 784 na NFC-e', async () => {
    const h = await harness();
    const { chave, nProt } = await autorizada(h);
    const r1 = await h.send(
      'RecepcaoEvento',
      envEvento([await evento({ chave, tpEvento: '110110', nSeq: 1, det: det.cce() })]),
    );
    expect(tags(r1, 'cStat')).toEqual(['128', '135']);
    expect(tag(r1, 'xEvento')).toBe('Carta de Correção registrada');
    const seq2 = await evento({ chave, tpEvento: '110110', nSeq: 2, det: det.cce('SEGUNDA CORRECAO DO ENDERECO') });
    expect(await eventoStat(h, seq2)).toBe('135');
    expect(await eventoStat(h, seq2)).toBe('573');
    expect(await eventoStat(h, await evento({ chave, tpEvento: '110110', nSeq: 21, det: det.cce() }))).toBe('594');
    expect(h.sim.inspect.eventos(chave).map((e) => e.nSeqEvento)).toEqual([1, 2]);
    expect(await eventoStat(h, await evento({ chave, tpEvento: '110111', det: det.cancelamento(nProt) }))).toBe('135');
    expect(await eventoStat(h, await evento({ chave, tpEvento: '110110', nSeq: 3, det: det.cce() }))).toBe('580');
    const nfce = await autorizada(h, 2, { mod: '65' });
    expect(await eventoStat(h, await evento({ chave: nfce.chave, tpEvento: '110110', det: det.cce() }))).toBe('784');
  });

  test('lote com dois eventos devolve um retEvento por evento, na ordem', async () => {
    const h = await harness();
    const { chave } = await autorizada(h);
    const a = await evento({ chave, tpEvento: '110110', nSeq: 1, det: det.cce() });
    const b = await evento({ chave, tpEvento: '110110', nSeq: 2, det: det.cce('OUTRA CORRECAO SINTETICA') });
    const r = await h.send('RecepcaoEvento', envEvento([a, b], '77'));
    expect(tags(r, 'cStat')).toEqual(['128', '135', '135']);
    expect(tags(r, 'nSeqEvento')).toEqual(['1', '2']);
    expect(tag(r, 'idLote')).toBe('77');
  });
});

describe('manifestação do destinatário no AN', () => {
  test('cOrgao 91, protocolo 891..., autor destinatário (575), 494, 594, 655, 650, 651, 250 na UF', async () => {
    const h = await harness();
    const { chave, nProt } = await autorizada(h);
    const ciencia = await evento({ chave, tpEvento: '210210', det: det.ciencia() });
    const r = await h.send('RecepcaoEvento', envEvento([ciencia]), { autorizador: 'an' });
    expect(tags(r, 'cStat')).toEqual(['128', '135']);
    expect(tag(r, 'cOrgao')).toBe('91');
    expect(tag(r, 'nProt')).toMatch(/^89126\d{10}$/);
    expect(tag(r, 'xEvento')).toBe('Ciencia da Operacao registrada');
    expect(await eventoStat(h, ciencia, 'uf')).toBe('250');
    const outroAutor = await evento({
      chave,
      tpEvento: '210200',
      det: det.confirmacao(),
      autor: TERCEIRO,
      signer: h.c.terceiro,
    });
    expect(await eventoStat(h, outroAutor, 'an')).toBe('575');
    const naoExiste = (await nfe({ nNF: 9 })).chave;
    expect(
      await eventoStat(h, await evento({ chave: naoExiste, tpEvento: '210200', det: det.confirmacao() }), 'an'),
    ).toBe('494');
    expect(
      await eventoStat(h, await evento({ chave, tpEvento: '210200', nSeq: 2, det: det.confirmacao() }), 'an'),
    ).toBe('594');
    expect(await eventoStat(h, await evento({ chave, tpEvento: '210220', det: det.desconhecimento() }), 'an')).toBe(
      '135',
    );
    const ciencia2 = await evento({
      chave,
      tpEvento: '210210',
      dhEvento: '2026-09-26T10:01:00-03:00',
      det: det.ciencia(),
    });
    // A ciência já foi registrada com nSeq 1: duplicidade antes da regra 655.
    expect(await eventoStat(h, ciencia2, 'an')).toBe('573');
    const outra = await autorizada(h, 2);
    expect(
      await eventoStat(h, await evento({ chave: outra.chave, tpEvento: '210200', det: det.confirmacao() }), 'an'),
    ).toBe('135');
    expect(
      await eventoStat(h, await evento({ chave: outra.chave, tpEvento: '210210', det: det.ciencia() }), 'an'),
    ).toBe('655');
    // NF-e cancelada: ciência (650) e desconhecimento (651).
    const terceira = await autorizada(h, 3);
    expect(
      await eventoStat(
        h,
        await evento({ chave: terceira.chave, tpEvento: '110111', det: det.cancelamento(terceira.nProt) }),
      ),
    ).toBe('135');
    expect(
      await eventoStat(h, await evento({ chave: terceira.chave, tpEvento: '210210', det: det.ciencia() }), 'an'),
    ).toBe('650');
    expect(
      await eventoStat(
        h,
        await evento({ chave: terceira.chave, tpEvento: '210220', det: det.desconhecimento() }),
        'an',
      ),
    ).toBe('651');
    expect(nProt).toMatch(/^135/);
    expect(EMITENTE).not.toBe(DESTINATARIO);
  });

  test('o registro do evento guardado valida no procEventoNFe oficial', async () => {
    const h = await harness();
    const { chave, nProt } = await autorizada(h);
    await h.send(
      'RecepcaoEvento',
      envEvento([await evento({ chave, tpEvento: '110111', det: det.cancelamento(nProt) })]),
    );
    const e = h.sim.inspect.eventos(chave)[0];
    const proc = `<procEventoNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">${e?.xml}${e?.retEvento}</procEventoNFe>`;
    expect(validateRoot(canc.procEventoNFeElement, proc)).toEqual([]);
  });
});
