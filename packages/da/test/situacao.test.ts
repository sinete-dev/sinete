// Marcas de documento sem valor fiscal (ADR 0006, decisão 14): prévia sem protocolo, denegada, contingência e DAMDFE;
// cancelada pelo cStat do protocolo (decisão 15).
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Rejeicao } from '../../rejeicoes/src/index.ts';
import { MARCAS, SITUACAO_MDFE, SITUACAO_NFE } from '../src/data/leiaute.ts';
import { REGISTRADO_MDFE } from '../src/input/cancelamento-mdfe.ts';
import { damdfe } from '../src/mdfe.ts';
import type { Doc } from '../src/model.ts';
import type { FormatoDanfe } from '../src/nfe.ts';
import { danfe } from '../src/nfe.ts';
import { EPEC } from './cases.ts';
import type { NfeFx } from './fixtures.ts';
import { chaveDe, eventoXml, mdfeXml, nfeXml } from './fixtures.ts';

const texts = (doc: Doc): string =>
  doc.pages.flatMap((p) => p.ops.flatMap((o) => (o.t === 'text' ? [o.s] : []))).join(' ');
/** Textos da marca d'água (girados) de cada página. */
const marca = (doc: Doc): string[] =>
  doc.pages.map((p) =>
    p.ops.flatMap((o) => (o.t === 'text' && o.rot !== undefined && o.rot > 0 && o.rot < 90 ? [o.s] : [])).join(' | '),
  );

/** Um caso por formato: bobinas e Tipo 2 exigem `infNFeSupl`, que a fixture gera pelo modelo e pelo `tpImp`. */
const FORMATOS: readonly { formato: FormatoDanfe; fx: Partial<NfeFx> }[] = [
  { formato: 'retrato', fx: {} },
  { formato: 'paisagem', fx: {} },
  { formato: 'simplificado', fx: {} },
  { formato: 'etiqueta', fx: {} },
  { formato: 'simplificado-tipo2', fx: { tpImp: '6' } },
  { formato: 'nfce', fx: { mod: '65' } },
];
const render = (fx: Partial<NfeFx>, formato: FormatoDanfe, opts: Parameters<typeof danfe>[1] = {}): Doc => {
  const base = FORMATOS.find((f) => f.formato === formato)?.fx ?? {};
  return danfe(nfeXml({ name: 'x', items: 2, ...base, ...fx }), { formato, ...opts });
};

describe('sem protocolo de autorização na emissão normal', () => {
  for (const { formato } of FORMATOS) {
    test(`${formato}: "SEM VALOR FISCAL" na marca e no corpo, sem protocolo`, () => {
      const doc = render({ semProt: true }, formato);
      const t = texts(doc);
      for (const m of marca(doc)) {
        expect(m).toContain(MARCAS.semValor);
        expect(m).toContain(MARCAS.semProtocolo);
      }
      expect(t).toContain('SEM PROTOCOLO DE AUTORIZAÇÃO DE USO - SEM VALOR FISCAL');
      expect(t).not.toContain('EMITIDA EM CONTINGÊNCIA');
      expect(t).not.toContain('135260000000001');
    });
  }
  test('marca em todas as folhas do DANFE A4', () => {
    const doc = danfe(nfeXml({ name: 'x', items: 5, xProdLen: 120, infCplLen: 5000, semProt: true }));
    expect(doc.pages.length).toBeGreaterThan(1);
    for (const m of marca(doc)) expect(m).toContain(MARCAS.semValor);
  });
  test('protocolo com cStat que não é de autorização nem de denegação não vale', () => {
    const doc = danfe(nfeXml({ name: 'x', items: 1, cStat: '204' }));
    expect(marca(doc)[0]).toContain(MARCAS.semValor);
    expect(texts(doc)).not.toContain('135260000000001');
  });
  test('SVC e SCAN sem protocolo não são contingência off-line: sem valor fiscal', () => {
    for (const tpEmis of ['3', '6', '7']) {
      const doc = danfe(nfeXml({ name: 'x', items: 1, tpEmis, semProt: true }));
      expect(marca(doc)[0]).toContain(MARCAS.semValor);
      expect(texts(doc)).toContain('DANFE EMITIDO EM CONTINGÊNCIA');
    }
    const autorizada = danfe(nfeXml({ name: 'x', items: 1, tpEmis: '6' }));
    expect(marca(autorizada)[0]).toBe('');
  });
  test('cStat de autorização sem nProt não comprova a autorização', () => {
    for (const cStat of SITUACAO_NFE.autorizada) {
      for (const { formato } of FORMATOS) {
        const doc = render({ cStat, semNProt: true }, formato);
        expect(marca(doc)[0]).toContain(MARCAS.semValor);
      }
    }
    const mdfe = damdfe(mdfeXml({ name: 'x', semNProt: true }));
    expect(marca(mdfe)[0]).toContain(MARCAS.semValor);
    expect(texts(mdfe)).toContain('SEM PROTOCOLO DE AUTORIZAÇÃO DE USO - SEM VALOR FISCAL');
  });
  test('autorizada (100 e 150) em produção: sem marca', () => {
    for (const cStat of SITUACAO_NFE.autorizada) {
      for (const { formato } of FORMATOS) {
        const doc = render({ cStat }, formato);
        expect(marca(doc).join('')).toBe('');
        expect(texts(doc)).not.toContain(MARCAS.semValor);
      }
    }
  });
  test('em homologação, a marca soma o ambiente', () => {
    const doc = danfe(nfeXml({ name: 'x', items: 1, tpAmb: '2', semProt: true }));
    expect(marca(doc)[0]).toBe(`${MARCAS.semValor} | ${MARCAS.semProtocolo} | ${MARCAS.homologacao}`);
    const aut = danfe(nfeXml({ name: 'x', items: 1, tpAmb: '2' }));
    expect(marca(aut)[0]).toBe(`${MARCAS.semValor} | ${MARCAS.homologacao}`);
  });
});

describe('contingência com protocolo por vir (MOC 7.0, Anexo II, 3 e 3.9.2 a 3.9.3)', () => {
  test('FS-IA e FS-DA: "EMITIDA EM CONTINGÊNCIA", sem "SEM VALOR FISCAL"', () => {
    for (const tpEmis of ['2', '5']) {
      const doc = danfe(nfeXml({ name: 'x', items: 1, tpEmis, semProt: true }));
      expect(marca(doc)[0]).toBe(MARCAS.contingencia.join(' | '));
      expect(texts(doc)).not.toContain(MARCAS.semValor);
    }
  });
  test('EPEC: só com o protocolo do evento; sem ele, sem valor fiscal', () => {
    const fx: NfeFx = { name: 'x', items: 1, tpEmis: '4', semProt: true };
    const com = danfe(nfeXml(fx), { epec: EPEC });
    expect(marca(com)[0]).toBe(MARCAS.contingencia.join(' | '));
    expect(texts(com)).not.toContain(MARCAS.semValor);
    const vazio = danfe(nfeXml(fx), { epec: { nProt: '', dhRegEvento: '' } });
    expect(marca(vazio)[0]).toContain(MARCAS.semValor);
    const sem = danfe(nfeXml(fx));
    expect(marca(sem)[0]).toContain(MARCAS.semValor);
    expect(texts(sem)).toContain('SEM PROTOCOLO DE AUTORIZAÇÃO DE USO - SEM VALOR FISCAL');
  });
  test('off-line (tpEmis 9) na NFC-e e no Tipo 2: aviso no corpo, sem marca d\'água nem "SEM VALOR FISCAL"', () => {
    for (const formato of ['nfce', 'simplificado-tipo2'] as const) {
      const doc = render({ tpEmis: '9', semProt: true }, formato);
      const t = texts(doc);
      expect(t).toContain('EMITIDA EM CONTINGÊNCIA');
      expect(t).toContain('Pendente de autorização');
      expect(t).not.toContain(MARCAS.semValor);
      expect(marca(doc).join('')).toBe('');
    }
  });
  test('contingência com protocolo que não é de autorização nem de denegação: sem valor fiscal', () => {
    for (const tpEmis of ['2', '5', '9']) {
      const formato = tpEmis === '9' ? 'nfce' : 'retrato';
      const doc = render({ tpEmis, cStat: '204' }, formato);
      expect(marca(doc)[0]).toContain(MARCAS.semValor);
      expect(texts(doc)).not.toContain('EMITIDA EM CONTINGÊNCIA');
    }
    const epec = danfe(nfeXml({ name: 'x', items: 1, tpEmis: '4', cStat: '204' }), { epec: EPEC });
    expect(marca(epec)[0]).toContain(MARCAS.semValor);
    // Retorno de rejeição sem nProt: o cStat basta.
    for (const tpEmis of ['2', '5']) {
      const doc = danfe(nfeXml({ name: 'x', items: 1, tpEmis, cStat: '204', semNProt: true }));
      expect(marca(doc)[0]).toContain(MARCAS.semValor);
      expect(texts(doc)).not.toContain('135260000000001');
    }
  });
  test('contingência depois de autorizada: sem marca', () => {
    expect(marca(danfe(nfeXml({ name: 'x', items: 1, tpEmis: '5' })))[0]).toBe('');
  });
});

describe('denegada (MOC 7.0, Anexo I, 4.4.3)', () => {
  for (const [cStat, motivo] of Object.entries(SITUACAO_NFE.denegada)) {
    test(`cStat ${cStat}: "DENEGADA", motivo e protocolo de denegação em todos os formatos`, () => {
      for (const { formato } of FORMATOS) {
        const doc = render({ cStat }, formato);
        const t = texts(doc);
        const m = marca(doc)[0] ?? '';
        expect(m.startsWith(`${MARCAS.denegada} | ${motivo.toUpperCase()} | PROTOCOLO 135260000000001`)).toBe(true);
        expect(t).toContain(`DENEGADA - ${motivo.toUpperCase()}`);
        if (formato === 'nfce' || formato === 'simplificado-tipo2') {
          expect(t).toContain('Protocolo de denegação: 135260000000001');
          expect(t).not.toContain('Protocolo de autorização');
        } else {
          expect(t).toContain('PROTOCOLO DE DENEGAÇÃO DE USO');
        }
        expect(t).not.toContain(MARCAS.semProtocolo);
      }
    });
  }
  test('emitida em EPEC e denegada: o protocolo da denegação tem precedência sobre o do EPEC', () => {
    for (const formato of ['retrato', 'paisagem', 'simplificado', 'etiqueta'] as const) {
      for (const opts of [{}, { epec: EPEC }]) {
        const t = texts(render({ tpEmis: '4', cStat: '301' }, formato, opts));
        expect(t).toContain('PROTOCOLO DE DENEGAÇÃO DE USO');
        expect(t).toContain('135260000000001');
        expect(t).not.toContain('PROTOCOLO DE AUTORIZAÇÃO DO EPEC');
        expect(t).not.toContain(EPEC.nProt);
      }
    }
  });
  test('FS-IA e FS-DA denegadas: campo 2 com o protocolo da denegação', () => {
    for (const tpEmis of ['2', '5']) {
      for (const formato of ['retrato', 'paisagem'] as const) {
        const doc = render({ tpEmis, cStat: '302' }, formato);
        const t = texts(doc);
        expect(t).toContain('PROTOCOLO DE DENEGAÇÃO DE USO');
        expect(t).toContain('135260000000001 - 01/09/2026 10:21:00');
        expect(t).not.toContain('DADOS DA NF-e');
      }
    }
  });
  test('em homologação, a marca soma "SEM VALOR FISCAL"', () => {
    const doc = danfe(nfeXml({ name: 'x', items: 1, cStat: '302', tpAmb: '2' }));
    expect(marca(doc)[0]?.endsWith(`| ${MARCAS.semValor}`)).toBe(true);
  });
  test('cancelamento passado pelo chamador fica com o carimbo', () => {
    const doc = danfe(nfeXml({ name: 'x', items: 1, cStat: '301' }), { cancelamento: true });
    expect(marca(doc)[0]).toBe('CANCELADA');
  });
});

describe('cancelada pelo cStat do protocolo (MOC 7.0, Anexo I, 4.4.1; Visão Geral, 5.4.2 e 5.9.4)', () => {
  for (const cStat of SITUACAO_NFE.cancelada) {
    test(`cStat ${cStat}: "CANCELADA", protocolo de autorização e nenhum "SEM VALOR FISCAL" em todos os formatos`, () => {
      for (const { formato } of FORMATOS) {
        const doc = render({ cStat }, formato);
        const t = texts(doc);
        for (const m of marca(doc)) expect(m).toBe('CANCELADA');
        expect(t).not.toContain(MARCAS.semValor);
        expect(t).not.toContain(MARCAS.semProtocolo);
        expect(t).not.toContain(MARCAS.denegada);
        if (formato === 'nfce' || formato === 'simplificado-tipo2') {
          expect(t).toContain('Protocolo de autorização: 135260000000001');
        } else {
          expect(t).toContain('PROTOCOLO DE AUTORIZAÇÃO DE USO');
          expect(t).toContain('135260000000001');
        }
      }
    });
  }
  test('marca em todas as folhas do DANFE A4', () => {
    const doc = danfe(nfeXml({ name: 'x', items: 5, xProdLen: 120, infCplLen: 5000, cStat: '101' }));
    expect(doc.pages.length).toBeGreaterThan(1);
    for (const m of marca(doc)) expect(m).toBe('CANCELADA');
  });
  test('sem nProt: o cStat basta para o carimbo, e o campo do protocolo fica vazio', () => {
    for (const { formato } of FORMATOS) {
      const doc = render({ cStat: '151', semNProt: true }, formato);
      expect(marca(doc)[0]).toBe('CANCELADA');
      expect(texts(doc)).not.toContain(MARCAS.semValor);
      expect(texts(doc)).not.toContain('Protocolo de autorização:');
    }
  });
  test('com o evento de cancelamento também: o evento prevalece no carimbo, com o protocolo dele', () => {
    const evento = eventoXml({ tpEvento: '110111', chave: chaveDe('55') });
    for (const formato of ['retrato', 'paisagem', 'simplificado', 'etiqueta'] as const) {
      const doc = render({ cStat: '101' }, formato, { cancelamento: evento });
      expect(marca(doc)[0]).toBe('CANCELADA | PROTOCOLO 135260000000099 02/09/2026 09:00:05');
      expect(texts(doc)).toContain('135260000000001');
      expect(texts(doc)).not.toContain(MARCAS.semValor);
    }
    const nfce = render({ cStat: '101' }, 'nfce', {
      cancelamento: eventoXml({ tpEvento: '110112', chave: chaveDe('65') }),
    });
    expect(marca(nfce)[0]).toBe('CANCELADA | PROTOCOLO 135260000000099 02/09/2026 09:00:05');
    expect(texts(nfce)).toContain('Protocolo de autorização: 135260000000001');
  });
  test('em homologação, soma "SEM VALOR FISCAL", como o carimbo do evento', () => {
    const doc = danfe(nfeXml({ name: 'x', items: 1, cStat: '101', tpAmb: '2' }));
    expect(marca(doc)[0]).toBe(`CANCELADA | ${MARCAS.semValor}`);
  });
  test('em contingência: cancelada, não pendente de autorização', () => {
    for (const tpEmis of ['2', '5', '9']) {
      const doc = render({ tpEmis, cStat: '101' }, tpEmis === '9' ? 'nfce' : 'retrato');
      expect(marca(doc)[0]).toBe('CANCELADA');
      expect(texts(doc)).not.toContain('EMITIDA EM CONTINGÊNCIA');
      expect(texts(doc)).not.toContain('Pendente de autorização');
    }
  });
});

describe('DAMDFE (MOC MDF-e 3.00a, Anexo II, 2.4 e 2.5)', () => {
  test('sem protocolo na emissão normal: aviso no lugar do protocolo e marca', () => {
    const doc = damdfe(mdfeXml({ name: 'x', semProt: true }));
    expect(texts(doc)).toContain('SEM PROTOCOLO DE AUTORIZAÇÃO DE USO - SEM VALOR FISCAL');
    expect(marca(doc)[0]).toBe(`${MARCAS.semValor} | ${MARCAS.semProtocolo}`);
  });
  test('o MDF-e não tem denegação: cStat 301 do MDF-e é rejeição e sai como sem protocolo', () => {
    const doc = damdfe(mdfeXml({ name: 'x', cStat: '301' }));
    expect(texts(doc)).not.toContain(MARCAS.denegada);
    expect(texts(doc)).not.toContain('935260000000001');
    expect(marca(doc)[0]).toContain(MARCAS.semValor);
  });
  test('contingência com protocolo rejeitado (cStat 301 do MDF-e): sem valor fiscal, não pendente', () => {
    for (const semNProt of [false, true]) {
      const doc = damdfe(mdfeXml({ name: 'x', tpEmis: '2', cStat: '301', semNProt }));
      expect(marca(doc)[0]).toContain(MARCAS.semValor);
      expect(marca(doc)[0]).not.toContain('PENDENTE');
    }
  });
  test('contingência: "EMISSÃO EM CONTINGÊNCIA" no protocolo e na marca, sem "SEM VALOR FISCAL"', () => {
    const doc = damdfe(mdfeXml({ name: 'x', tpEmis: '2', semProt: true }));
    expect(texts(doc)).toContain('EMISSÃO EM CONTINGÊNCIA');
    for (const m of marca(doc)) expect(m).toBe(MARCAS.contingenciaMdfe.join(' | '));
    expect(texts(doc)).not.toContain(MARCAS.semValor);
  });
  test('autorizado: protocolo e nenhuma marca', () => {
    const doc = damdfe(mdfeXml({ name: 'x' }));
    expect(texts(doc)).toContain('935260000000001');
    expect(marca(doc)[0]).toBe('');
  });
  test('encerrado (cStat 132, Visão Geral 3.00b, 6.2.2): continua autorizado, com protocolo e sem marca', () => {
    const doc = damdfe(mdfeXml({ name: 'x', cStat: '132' }));
    expect(texts(doc)).toContain('935260000000001 - 01/09/2026 10:56:03');
    expect(texts(doc)).not.toContain(MARCAS.semValor);
    expect(marca(doc)[0]).toBe('');
  });
  test('cancelado (cStat 101, Visão Geral 3.00b, 6.1.2): "CANCELADO" com o protocolo, sem "SEM VALOR FISCAL"', () => {
    const doc = damdfe(mdfeXml({ name: 'x', cStat: '101', docs: 60 }), { documentos: true });
    expect(doc.pages.length).toBeGreaterThan(1);
    for (const m of marca(doc)) expect(m).toBe('CANCELADO');
    expect(texts(doc)).toContain('935260000000001 - 01/09/2026 10:56:03');
    expect(texts(doc)).not.toContain(MARCAS.semValor);
    const semNProt = damdfe(mdfeXml({ name: 'x', cStat: '101', semNProt: true }));
    expect(marca(semNProt)[0]).toBe('CANCELADO');
    expect(texts(semNProt)).not.toContain(MARCAS.semValor);
    const contingencia = damdfe(mdfeXml({ name: 'x', tpEmis: '2', cStat: '101' }));
    expect(marca(contingencia)[0]).toBe('CANCELADO');
  });
  test('cancelado pelo chamador e pelo cStat 101: o carimbo do chamador prevalece', () => {
    const doc = damdfe(mdfeXml({ name: 'x', cStat: '101' }), {
      cancelado: { nProt: '935260000000077', dhRegEvento: '2026-09-02T10:00:00-03:00' },
    });
    expect(marca(doc)[0]).toBe('CANCELADO | PROTOCOLO 935260000000077 02/09/2026 10:00:00');
    expect(texts(doc)).toContain('935260000000001');
  });
  const procEventoMdfe = (o: { chave?: string; tpEvento?: string; cStat?: string; chaveRet?: string } = {}): string => {
    const ch = o.chave ?? chaveDe('58', '1', 888);
    const tp = o.tpEvento ?? '110111';
    return (
      `<procEventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><eventoMDFe versao="3.00">` +
      `<infEvento Id="ID${tp}${ch}01"><cOrgao>35</cOrgao><tpAmb>1</tpAmb><CNPJ>${ch.slice(6, 20)}</CNPJ>` +
      `<chMDFe>${ch}</chMDFe><dhEvento>2026-09-02T09:59:00-03:00</dhEvento><tpEvento>${tp}</tpEvento>` +
      '<nSeqEvento>1</nSeqEvento><detEvento versaoEvento="3.00"><evCancMDFe><descEvento>Cancelamento</descEvento>' +
      '<nProt>935260000000001</nProt><xJust>CANCELAMENTO DE TESTE SINTETICO</xJust></evCancMDFe></detEvento>' +
      '</infEvento></eventoMDFe><retEventoMDFe versao="3.00"><infEvento><tpAmb>1</tpAmb><verAplic>SVRS</verAplic>' +
      `<cOrgao>35</cOrgao><cStat>${o.cStat ?? '135'}</cStat><xMotivo>Evento registrado</xMotivo><chMDFe>${o.chaveRet ?? ch}</chMDFe>` +
      `<tpEvento>${tp}</tpEvento><xEvento>Cancelamento</xEvento><nSeqEvento>1</nSeqEvento>` +
      '<dhRegEvento>2026-09-02T10:00:00-03:00</dhRegEvento><nProt>935260000000078</nProt></infEvento></retEventoMDFe>' +
      '</procEventoMDFe>'
    );
  };
  test('cancelado pelo procEventoMDFe: o protocolo e a data do evento no carimbo, igual ao objeto', () => {
    const xml = mdfeXml({ name: 'x' });
    const doc = damdfe(xml, { cancelado: procEventoMdfe() });
    expect(marca(doc)[0]).toBe('CANCELADO | PROTOCOLO 935260000000078 02/09/2026 10:00:00');
    const objeto = damdfe(xml, { cancelado: { nProt: '935260000000078', dhRegEvento: '2026-09-02T10:00:00-03:00' } });
    expect(doc).toEqual(objeto);
  });
  test('procEventoMDFe de outro MDF-e, de outro tipo ou sem retorno registrado: evento_incompativel', () => {
    const xml = mdfeXml({ name: 'x' });
    for (const cancelado of [
      procEventoMdfe({ chave: chaveDe('58', '1', 889) }),
      procEventoMdfe({ tpEvento: '110112' }),
      procEventoMdfe({ cStat: '631' }),
      procEventoMdfe({ chaveRet: chaveDe('58', '1', 889) }),
    ]) {
      expect(() => damdfe(xml, { cancelado })).toThrow(expect.objectContaining({ code: 'evento_incompativel' }));
    }
    expect(() => damdfe(xml, { cancelado: '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"/>' })).toThrow(
      expect.objectContaining({ code: 'documento_inesperado' }),
    );
  });
});

describe('tabelas de situação conferem com os pacotes do documento', () => {
  const root = path.join(import.meta.dir, '../..');
  const json = (p: string): Record<string, unknown> =>
    JSON.parse(readFileSync(path.join(root, p), 'utf8')) as Record<string, unknown>;
  test('NF-e: autorizada, denegada e cancelada iguais às do @sinete/nfe; motivos iguais aos do @sinete/rejeicoes', () => {
    const cstat = json('nfe/src/data/cstat.json');
    expect([...SITUACAO_NFE.autorizada].sort()).toEqual([...(cstat.autorizada as string[])].sort());
    expect(Object.keys(SITUACAO_NFE.denegada).sort()).toEqual([...(cstat.denegada as string[])].sort());
    expect([...SITUACAO_NFE.cancelada].sort()).toEqual([...(cstat.cancelada as string[])].sort());
    const rej = json('rejeicoes/src/data/rejeicoes.json');
    const lista = rej.rejeicoes as readonly Rejeicao[];
    const denegacoes = lista.filter((r) => r.efeito === 'denegacao');
    expect(denegacoes.length).toBeGreaterThan(0);
    for (const r of denegacoes) expect(SITUACAO_NFE.denegada[r.codigo]).toBe(`Uso Denegado: ${r.mensagem}`);
  });
  test('MDF-e: autorizado, cancelado e encerrado iguais aos do @sinete/mdfe', () => {
    const cstat = json('mdfe/src/data/cstat.json');
    expect([...SITUACAO_MDFE.autorizada]).toEqual(cstat.autorizado as string[]);
    expect([...SITUACAO_MDFE.cancelada]).toEqual(cstat.cancelado as string[]);
    expect([...SITUACAO_MDFE.encerrada]).toEqual(cstat.encerrado as string[]);
    expect([...REGISTRADO_MDFE]).toEqual(cstat.eventoRegistrado as string[]);
  });
});
