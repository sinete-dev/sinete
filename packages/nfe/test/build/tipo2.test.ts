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
import { CNPJ_EMIT, CPF, DEST_CONTRIBUINTE, IE_SP, item, nota, opcoes } from '../helpers/nota.ts';
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

/** A ocorrência que cita a rejeição, ou `undefined`. */
const rejeicao = (o: readonly Ocorrencia[], cStat: string): Ocorrencia | undefined =>
  o.find((i) => new RegExp(`rejeição ${cStat}\\)`).test(i.mensagem));

describe('NF-e Tipo 2 sob as regras da NFC-e que a NT 2026.002 v1.11 estende', () => {
  const RJ = { xLgr: 'RUA X', nro: '1', xBairro: 'CENTRO', cMun: '3304557', xMun: 'RIO DE JANEIRO', UF: 'RJ' as const };
  const consumidorRj = { CPF, xNome: 'CONSUMIDOR', indIEDest: '9' as const, endereco: RJ };
  const casos: [string, Partial<DadosNfe>, string, string][] = [
    ['dhSaiEnt', { dhSaiEnt: new Date('2026-09-26T10:00:00-03:00') }, 'dhSaiEnt', '705'],
    ['tpNF', { tpNF: '0' }, 'tpNF', '706'],
    ['idDest', { idDest: '2', destinatario: consumidorRj }, 'idDest', '707'],
    ['finNFe', { finNFe: '4' }, 'finNFe', '715'],
    ['indFinal', { indFinal: '0', destinatario: DEST_CONTRIBUINTE }, 'indFinal', '716'],
    ['indPres', { indPres: '2' }, 'indPres', '717'],
    ['IEST', { emitente: { ...nota().emitente, IEST: IE_SP } }, 'emitente.IEST', '718'],
    [
      'ipi',
      { itens: [item({ impostos: { ...item().impostos, ipi: { cEnq: '999', CST: '53' } } as never })] },
      'itens[0].impostos.ipi',
      '742',
    ],
    ['modFrete', { transporte: { modFrete: '0' } }, 'transporte.modFrete', '753'],
    ['cobranca', { cobranca: { fatura: { nFat: '1', vOrig: '15.00', vLiq: '15.00' } } }, 'cobranca', '760'],
    [
      'retirada',
      {
        retirada: {
          CNPJ: CNPJ_EMIT,
          xLgr: 'RUA',
          nro: '1',
          xBairro: 'CENTRO',
          cMun: '3550308',
          xMun: 'SAO PAULO',
          UF: 'SP',
        },
      },
      'retirada',
      '669',
    ],
    [
      'indTot',
      { itens: [item(), item({ produto: { ...item().produto, indTot: '0' } })] },
      'itens[1].produto.indTot',
      '774',
    ],
  ];
  for (const [nome, extra, caminho, cStat] of casos) {
    test(`${nome}: ${cStat} no caminho da entrada, só no Tipo 2`, async () => {
      const o = falha(await montarNfe(tipo2(extra), opcoes()));
      expect(rejeicao(o, cStat)).toMatchObject({ caminho, origem: 'entrada' });
      expect(rejeicao(o, cStat)?.mensagem).toStartWith('NF-e com DANFE Simplificado Tipo 2 ');
      const r = await montarNfe(nota({ ...extra, ...(nome === 'indFinal' ? { indFinal: '0' } : {}) }), opcoes());
      if (!r.ok) expect(rejeicao(r.ocorrencias, cStat)).toBeUndefined();
    });
  }

  test('referenciar outra nota é 708; várias violações voltam juntas', async () => {
    const outra = ok(await montarNfe(tipo2({ nNF: 9 }), opcoes())).chave;
    expect(
      rejeicao(falha(await montarNfe(tipo2({ referenciadas: [{ refNFe: outra }] }), opcoes())), '708')?.caminho,
    ).toBe('referenciadas');
    const o = falha(
      await montarNfe(
        tipo2({
          dhSaiEnt: new Date('2026-09-26T10:00:00-03:00'),
          emitente: { ...nota().emitente, IEST: IE_SP },
          cobranca: { fatura: { nFat: '1', vOrig: '15.00', vLiq: '15.00' } },
        }),
        opcoes(),
      ),
    );
    expect(o.map((i) => i.caminho)).toEqual(expect.arrayContaining(['dhSaiEnt', 'emitente.IEST', 'cobranca']));
  });

  test('regras só da NFC-e não valem: pagamento, destinatário contribuinte, transportador na entrega, exportação', async () => {
    const exporta = { UFSaidaPais: 'SP' as const, xLocExporta: 'PORTO DE SANTOS' };
    const casos: Partial<DadosNfe>[] = [{}, { destinatario: DEST_CONTRIBUINTE }, { indPres: '4' }, { exporta }];
    for (const extra of casos) {
      const n = ok(await montarNfe(tipo2(extra), opcoes()));
      expect(n.xml).toContain('<mod>55</mod>');
      expect(n.xml).toContain('<tpImp>6</tpImp>');
    }
  });

  test('padrões do Tipo 2: indPres 1 e idDest 1 mesmo com o consumidor em outra UF', async () => {
    const { indPres: _, ...semIndPres } = tipo2();
    const a = ok(await montarNfe(semIndPres as DadosNfe, opcoes()));
    expect(a.xml).toContain('<indPres>1</indPres>');
    const b = ok(await montarNfe(tipo2({ destinatario: consumidorRj }), opcoes()));
    expect(b.xml).toContain('<idDest>1</idDest>');
    const c = ok(await montarNfe(nota({ destinatario: consumidorRj }), opcoes()));
    expect(c.xml).toContain('<idDest>2</idDest>');
  });

  test('local de entrega segue aceito (G01-10 é implementação futura na NT)', async () => {
    const entrega = {
      CPF,
      xLgr: 'RUA LOCAL',
      nro: '10',
      xBairro: 'CENTRO',
      cMun: '3550308',
      xMun: 'SAO PAULO',
      UF: 'SP' as const,
    };
    expect(ok(await montarNfe(tipo2({ entrega }), opcoes())).xml).toContain('<entrega>');
  });

  test('entrega a domicílio identifica o destinatário (E01-20, 787)', async () => {
    const { destinatario: _, ...sem } = tipo2({ indPres: '4' });
    expect(rejeicao(falha(await montarNfe(sem as DadosNfe, opcoes())), '787')?.caminho).toBe('destinatario');
  });

  test('em homologação, a descrição do primeiro item é a literal da I04-10; em produção, a informada', async () => {
    expect(ok(await montarNfe(tipo2(), opcoes())).xml).toContain(
      '<xProd>NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xProd>',
    );
    expect(ok(await montarNfe(tipo2(), opcoes({ ambiente: 'producao' }))).xml).toContain(
      '<xProd>PARAFUSO SINTETICO</xProd>',
    );
    expect(ok(await montarNfe(nota(), opcoes())).xml).toContain('<xProd>PARAFUSO SINTETICO</xProd>');
    // A descrição informada não vai ao XML de teste, então o tipo dela não é conferido em homologação.
    const longa = tipo2({ itens: [item({ produto: { ...item().produto, xProd: 'X'.repeat(130) } })] });
    expect(ok(await montarNfe(longa, opcoes())).xml).toContain('HOMOLOGACAO - SEM VALOR FISCAL</xProd>');
  });
});
