/**
 * NF-e com DANFE Simplificado Tipo 2 (modelo 55, tpImp 6; NT 2026.002 v1.11): o QR Code é obrigatório (ZX02-10,
 * rejeição 394), só na versão 3 (ZX02-220, 672), com a URL da NFC-e da UF (ZX02-20, observação 3), e a contingência
 * off-line (tpEmis 9) passa a valer para ela (B22-10).
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import { conferirAssinatura, lerXml, primeiroFilho } from '@sinete/core/xml';
import { validar } from '@sinete/schemas';
import { TNFe_infNFeSupl } from '@sinete/schemas/nfe/PL_010f';
import type { DadosNfe, NfeMontada, ResultadoMontagemNfe } from '../../src/index.ts';
import { assinarNfe, assinaturaQrCode, comQrCode, montarNfe, NFE_NS, urlsNfce } from '../../src/index.ts';
import { CPF, nota, opcoes } from '../helpers/nota.ts';
import { generateTestKeys } from '../helpers/test-keys.ts';

function ok(r: ResultadoMontagemNfe): NfeMontada {
  if (!r.ok) throw new Error(JSON.stringify(r.ocorrencias, null, 1));
  return r.valor;
}

function falha(r: ResultadoMontagemNfe): readonly Ocorrencia[] {
  if (r.ok) throw new Error('esperava ocorrências');
  return r.ocorrencias;
}

function supl(xml: string): { qrCode: string; urlChave: string; el: ReturnType<typeof primeiroFilho> } {
  const el = primeiroFilho(lerXml(xml).raiz, 'infNFeSupl', NFE_NS);
  if (el === undefined) throw new Error('sem infNFeSupl');
  const t = (n: string): string =>
    primeiroFilho(el, n, NFE_NS)
      ?.filhos.map((x) => (x.tipo === 'texto' ? x.valor : ''))
      .join('') ?? '';
  return { qrCode: t('qrCode'), urlChave: t('urlChave'), el };
}

/** NF-e Tipo 2: consumidor final, presencial, destinatário CPF. */
const tipo2 = (extra: Partial<DadosNfe> = {}): DadosNfe => nota({ tpImp: '6', indFinal: '1', indPres: '1', ...extra });

const OFFLINE = {
  tpEmis: '9' as const,
  dhCont: new Date('2026-09-26T09:59:00-03:00'),
  xJust: 'SEM CONEXAO COM A SEFAZ AUTORIZADORA',
};

describe('NF-e com DANFE Simplificado Tipo 2 (tpImp 6)', () => {
  test('on-line: infNFeSupl com o QR Code versão 3 na URL da NFC-e da UF, sem assinatura', async () => {
    const keys = await generateTestKeys();
    const n = ok(await montarNfe(tipo2(), opcoes()));
    const url = urlsNfce('SP', 'homologacao', '2026-09-26');
    expect(n.nfce).toMatchObject({ versao: '3', parametros: `${n.chave}|3|2`, assinar: false });
    const xml = await assinarNfe(n, keys.dataSigner);
    expect(xml.split('<infNFeSupl>')).toHaveLength(2);
    expect(xml.indexOf('<infNFeSupl>')).toBeGreaterThan(xml.indexOf('</infNFe>'));
    expect(xml.indexOf('<infNFeSupl>')).toBeLessThan(xml.indexOf('<Signature'));
    const s = supl(xml);
    expect(s.qrCode).toBe(`${url.qrCode}?p=${n.chave}|3|2`);
    expect(s.urlChave).toBe(url.urlChave ?? '');
    expect(validar(TNFe_infNFeSupl, s.el as never)).toEqual([]);
    expect((await conferirAssinatura(xml, { id: n.id, elemento: 'infNFe' })).ok).toBe(true);

    const p = ok(await montarNfe(tipo2(), opcoes({ ambiente: 'producao' })));
    expect(p.nfce?.parametros).toBe(`${p.chave}|3|1`);
    expect(p.nfce?.base).toBe(`${urlsNfce('SP', 'producao', '2026-09-26').qrCode}?p=`);
  });

  test('em três fases: assinaturaQrCode é undefined e comQrCode dá o mesmo infNFeSupl do assinarNfe', async () => {
    const keys = await generateTestKeys();
    const n = ok(await montarNfe(tipo2(), opcoes()));
    expect(await assinaturaQrCode(n, keys.dataSigner)).toBeUndefined();
    const fases = comQrCode(n);
    const tudo = await assinarNfe(n, keys.dataSigner);
    expect(/<infNFeSupl>.*<\/infNFeSupl>/.exec(fases)?.[0]).toBe(/<infNFeSupl>.*<\/infNFeSupl>/.exec(tudo)?.[0]);
    expect(() => comQrCode(n, 'QVNTSU5BVFVSQQ==')).toThrow(expect.objectContaining({ code: 'config_invalida' }));
  });

  test('outros tpImp da NF-e continuam sem infNFeSupl', async () => {
    const keys = await generateTestKeys();
    for (const tpImp of ['1', '2', '3'] as const) {
      const n = ok(await montarNfe(nota({ tpImp }), opcoes()));
      expect(n.nfce).toBeUndefined();
      expect(comQrCode(n)).toBe(n.xml);
      expect(await assinarNfe(n, keys.dataSigner)).not.toContain('infNFeSupl');
      expect(() => comQrCode(n, 'QUALQUER')).toThrow(expect.objectContaining({ code: 'config_invalida' }));
    }
  });

  test('a versão 2 do QR Code é recusada na NF-e (ZX02-220, rejeição 672)', async () => {
    const r = await montarNfe(
      tipo2(),
      opcoes({ qrCode: { versao: '2', idCSC: '000001', CSC: '0123456789ABCDEF0123' } }),
    );
    expect(falha(r)).toContainEqual(
      expect.objectContaining({ caminho: 'qrCode.versao', code: 'qrcode_invalido', origem: 'montagem' }),
    );
  });

  test('UF sem endereço completo do QR Code pede urlQrCode', async () => {
    const am = tipo2({
      emitente: {
        ...nota().emitente,
        IE: '040000001',
        endereco: { ...nota().emitente.endereco, UF: 'AM', cMun: '1302603', xMun: 'MANAUS' },
      },
      destinatario: {
        CPF,
        xNome: 'CONSUMIDOR SINTETICO',
        indIEDest: '9',
        endereco: { xLgr: 'AVENIDA FICTICIA', nro: '1', xBairro: 'BAIRRO', cMun: '1302603', xMun: 'MANAUS', UF: 'AM' },
      },
    });
    const sem = await montarNfe(am, opcoes());
    expect(falha(sem)).toContainEqual(expect.objectContaining({ caminho: 'urlQrCode', origem: 'montagem' }));
    const com = ok(
      await montarNfe(
        am,
        opcoes({
          urlQrCode: 'https://exemplo.sefaz.am.gov.br/nfce/qrcode',
          urlChave: 'https://exemplo.sefaz.am.gov.br/nfce/consulta',
        }),
      ),
    );
    expect(supl(comQrCode(com)).qrCode).toBe(`https://exemplo.sefaz.am.gov.br/nfce/qrcode?p=${com.chave}|3|2`);
  });

  test('contingência off-line: oito parâmetros, assinatura do QR Code e infNFeSupl no schema', async () => {
    const keys = await generateTestKeys();
    const n = ok(await montarNfe(tipo2({ contingencia: OFFLINE }), opcoes()));
    expect(n.tpEmis).toBe('9');
    expect(n.nfce).toMatchObject({ assinar: true, parametros: `${n.chave}|3|2|26|15.00|2|${CPF}` });
    const a = await assinaturaQrCode(n, keys.dataSigner);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const xml = await assinarNfe(n, keys.dataSigner);
    expect(supl(xml).qrCode.split('?p=')[1]?.split('|')).toHaveLength(8);
    expect(validar(TNFe_infNFeSupl, supl(xml).el as never)).toEqual([]);
    expect(() => comQrCode(n)).toThrow(expect.objectContaining({ code: 'config_invalida' }));
  });

  test('contingência off-line na NF-e com outro tpImp continua recusada (B22-10, rejeição 711)', async () => {
    for (const tpImp of ['1', '2', '3'] as const) {
      const r = await montarNfe(nota({ tpImp, contingencia: OFFLINE }), opcoes());
      expect(falha(r)).toContainEqual(
        expect.objectContaining({ caminho: 'contingencia.tpEmis', code: 'contingencia_invalida' }),
      );
    }
  });
});
