/**
 * NFC-e (modelo 65): padrões, regras do modelo e o `infNFeSupl`. Os hashes do QR Code versão 2 conferem com os exemplos
 * do Manual de Padrões Técnicos do DANFE NFC-e e QR Code 6.0 (4.3.6); o CSC dos testes é o do exemplo do manual ou um
 * inventado, nunca um CSC real.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import {
  conferirAssinatura,
  decodificarBase64,
  lerXml,
  PREFIXO_DIGEST_INFO_SHA1,
  primeiroFilho,
} from '@sinete/core/xml';
import { validar } from '@sinete/schemas';
import { TNFe_infNFeSupl } from '@sinete/schemas/nfe/PL_010f';
import { assinarParametros, hashQrCodeV2, hexDoDigestValue } from '../../src/build/nfce.ts';
import type { DadosNfe, MontarNfeOpcoes, NfeMontada, ResultadoMontagemNfe } from '../../src/index.ts';
import {
  assinarNfe,
  assinaturaQrCode,
  comQrCode,
  montarNfe,
  NFE_NS,
  rotuloDoCaminho,
  urlsNfce,
  XPROD_HOMOLOGACAO_NFCE,
} from '../../src/index.ts';
import { CNPJ_DEST, CPF, item, nota, opcoes } from '../helpers/nota.ts';
import { generateTestKeys } from '../helpers/test-keys.ts';

/** A chave pública do par de teste, a partir da privada (o JWK privado traz o módulo e o expoente). */
async function chavePublica(pkcs8: Uint8Array): Promise<CryptoKey> {
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' };
  const priv = await globalThis.crypto.subtle.importKey('pkcs8', pkcs8 as Uint8Array<ArrayBuffer>, alg, true, ['sign']);
  const { n, e, kty } = (await globalThis.crypto.subtle.exportKey('jwk' as 'pkcs8', priv)) as unknown as JsonWebKey;
  return globalThis.crypto.subtle.importKey('jwk' as 'spki', { kty, n, e } as never, alg, false, ['verify']);
}

/** CSC inventado para os testes: não existe em nenhuma SEFAZ. */
const CSC_TESTE = 'CSC-INVENTADO-SINETE-TESTE-0001';

function ok(r: ResultadoMontagemNfe): NfeMontada {
  if (!r.ok) throw new Error(JSON.stringify(r.ocorrencias, null, 1));
  return r.valor;
}

function falha(r: ResultadoMontagemNfe): readonly Ocorrencia[] {
  if (r.ok) throw new Error('esperava ocorrências');
  return r.ocorrencias;
}

const achar = (r: ResultadoMontagemNfe, path: string): Ocorrencia | undefined =>
  falha(r).find((i) => i.caminho === path);

/** NFC-e mínima: sem destinatário, pagamento em dinheiro acima do total (troco), um item de R$ 15,00. */
function nfce(extra: Partial<DadosNfe> = {}): DadosNfe {
  const { destinatario: _d, ...base } = nota();
  return { ...base, modelo: '65', pagamento: { detPag: [{ tPag: '01', vPag: '20' }] }, ...extra };
}

const xProdDo = (n: NfeMontada): string | undefined => (n.infNFe.det[0]?.prod as { xProd?: string } | undefined)?.xProd;
const ide = (n: NfeMontada): Record<string, unknown> => n.infNFe.ide as unknown as Record<string, unknown>;

function supl(xml: string): { qrCode: string; urlChave: string; el: ReturnType<typeof primeiroFilho> } {
  const doc = lerXml(xml);
  const el = primeiroFilho(doc.raiz, 'infNFeSupl', NFE_NS);
  if (el === undefined) throw new Error('sem infNFeSupl');
  const t = (n: string): string => {
    const c = primeiroFilho(el, n, NFE_NS);
    return c?.filhos.map((x) => (x.tipo === 'texto' ? x.valor : '')).join('') ?? '';
  };
  return { qrCode: t('qrCode'), urlChave: t('urlChave'), el };
}

describe('NFC-e: montagem', () => {
  test('padrões do modelo 65, troco calculado e descrição de homologação no primeiro item', async () => {
    const n = ok(await montarNfe(nfce(), opcoes()));
    expect(n.mod).toBe('65');
    expect(n.chave.slice(20, 22)).toBe('65');
    expect(ide(n)).toMatchObject({ mod: '65', tpImp: '4', indFinal: '1', indPres: '1', idDest: '1', tpEmis: '1' });
    expect(n.infNFe.dest).toBeUndefined();
    expect(n.infNFe.pag).toEqual({ detPag: [{ tPag: '01', vPag: '20.00' }], vTroco: '5.00' });
    expect(xProdDo(n)).toBe(XPROD_HOMOLOGACAO_NFCE);
    // Consumidor com endereço em outra UF: a venda no balcão continua interna (B11a-10).
    const deFora = ok(
      await montarNfe(
        nfce({
          destinatario: {
            CPF,
            indIEDest: '9',
            endereco: {
              xLgr: 'RUA FICTICIA',
              nro: '1',
              xBairro: 'CENTRO',
              cMun: '3304557',
              xMun: 'RIO DE JANEIRO',
              UF: 'RJ',
            },
          },
        }),
        opcoes(),
      ),
    );
    expect(ide(deFora)).toMatchObject({ idDest: '1' });
    expect(n.nfce).toEqual({
      versao: '3',
      urlChave: 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta',
      base: 'https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=',
      parametros: `${n.chave}|3|2`,
      assinar: false,
    });
    // Em produção, a descrição informada fica.
    const p = ok(await montarNfe(nfce(), opcoes({ ambiente: 'producao' })));
    expect(xProdDo(p)).toBe('PARAFUSO SINTETICO');
    expect(p.nfce?.parametros).toBe(`${p.chave}|3|1`);
  });

  test('assinada: infNFeSupl antes da Signature, válido no schema, assinatura íntegra', async () => {
    const keys = await generateTestKeys();
    const n = ok(await montarNfe(nfce(), opcoes()));
    const xml = await assinarNfe(n, keys.dataSigner);
    expect(xml.indexOf('<infNFeSupl>')).toBeGreaterThan(xml.indexOf('</infNFe>'));
    expect(xml.indexOf('<infNFeSupl>')).toBeLessThan(xml.indexOf('<Signature'));
    const s = supl(xml);
    expect(s.qrCode).toBe(`${n.nfce?.base}${n.chave}|3|2`);
    expect(validar(TNFe_infNFeSupl, s.el as never)).toEqual([]);
    expect((await conferirAssinatura(xml, { id: n.id, elemento: 'infNFe' })).ok).toBe(true);
  });

  test('versão 2 on-line: hash com o CSC, idCSC sem zeros à esquerda', async () => {
    const n = ok(await montarNfe(nfce(), opcoes({ qrCode: { versao: '2', idCSC: '000001', CSC: CSC_TESTE } })));
    const antes = `${n.chave}|2|2|1`;
    expect(n.nfce?.parametros).toBe(`${antes}|${await hashQrCodeV2(antes, CSC_TESTE)}`);
    const keys = await generateTestKeys();
    const s = supl(await assinarNfe(n, keys.dataSigner));
    expect(s.qrCode).not.toContain(CSC_TESTE);
    expect(validar(TNFe_infNFeSupl, s.el as never)).toEqual([]);
  });

  test('versão 2: exemplos do manual (4.3.6.1 e 4.3.6.2)', async () => {
    // O manual lista o CSC como CODIGO-CSC-CONTRIBUINTE-36-CARACTERES, mas os hashes publicados saem do texto do
    // passo 2 (SEU-CODIGO-...); o exemplo é o do manual, não um CSC real.
    const csc = 'SEU-CODIGO-CSC-CONTRIBUINTE-36-CARACTERES';
    expect(await hashQrCodeV2('28170800156225000131650110000151341562040824|2|1|1', csc)).toBe(
      'DC6AE2C2B9A992BE59679AC365E29922DE6B7511',
    );
    const digVal = hexDoDigestValue('yzGYhUx1/XYYzksWB+fPR3Qc50c=');
    expect(digVal).toBe('797a4759685578312f5859597a6b7357422b6650523351633530633d');
    expect(await hashQrCodeV2(`28170800156225000131650110000151349562040824|2|1|02|60.90|${digVal}|1`, csc)).toBe(
      '4615A93BB0D7C4E780F8D30EE77EDD5BA55C7D66',
    );
  });

  test('versão 2 off-line: digVal é o DigestValue da assinatura, em hexadecimal', async () => {
    const keys = await generateTestKeys();
    const n = ok(
      await montarNfe(
        nfce({
          contingencia: {
            tpEmis: '9',
            dhCont: new Date('2026-09-26T09:50:00-03:00'),
            xJust: 'SEFAZ FORA DO AR NO MOMENTO',
          },
        }),
        opcoes({ qrCode: { versao: '2', idCSC: '2', CSC: CSC_TESTE } }),
      ),
    );
    const xml = await assinarNfe(n, keys.dataSigner);
    const digest = /<DigestValue>([^<]+)<\/DigestValue>/.exec(xml)?.[1] ?? '';
    const partes = supl(xml).qrCode.split('?p=')[1]?.split('|') ?? [];
    expect(partes.slice(1, 5)).toEqual(['2', '2', '26', '15.00']);
    expect(partes[5]).toBe(hexDoDigestValue(digest));
    expect(partes[6]).toBe('2');
    expect(validar(TNFe_infNFeSupl, supl(xml).el as never)).toEqual([]);
  });

  test('versão 3 off-line: parâmetros do destinatário e assinatura RSA-SHA1 com o certificado da nota', async () => {
    const keys = await generateTestKeys();
    const cont = {
      tpEmis: '9' as const,
      dhCont: new Date('2026-09-26T09:50:00-03:00'),
      xJust: 'SEFAZ FORA DO AR NO MOMENTO',
    };
    const sem = ok(await montarNfe(nfce({ contingencia: cont }), opcoes()));
    expect(sem.tpEmis).toBe('9');
    expect(sem.chave.slice(34, 35)).toBe('9');
    expect(sem.nfce).toMatchObject({ assinar: true, parametros: `${sem.chave}|3|2|26|15.00||` });
    const comCpf = ok(await montarNfe(nfce({ contingencia: cont, destinatario: { CPF, indIEDest: '9' } }), opcoes()));
    expect(comCpf.nfce?.parametros).toBe(`${comCpf.chave}|3|2|26|15.00|2|${CPF}`);
    const comCnpj = ok(
      await montarNfe(nfce({ contingencia: cont, destinatario: { CNPJ: CNPJ_DEST, indIEDest: '9' } }), opcoes()),
    );
    expect(comCnpj.nfce?.parametros).toBe(`${comCnpj.chave}|3|2|26|15.00|1|${CNPJ_DEST}`);
    const est = ok(
      await montarNfe(
        nfce({ contingencia: cont, destinatario: { idEstrangeiro: 'AB123456', indIEDest: '9' } }),
        opcoes(),
      ),
    );
    expect(est.nfce?.parametros).toBe(`${est.chave}|3|2|26|15.00|3|`);

    const xml = await assinarNfe(comCpf, keys.dataSigner);
    const s = supl(xml);
    expect(validar(TNFe_infNFeSupl, s.el as never)).toEqual([]);
    const assinatura = s.qrCode.split('|').at(-1) ?? '';
    const ok1 = await globalThis.crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      await chavePublica(keys.pkcs8),
      decodificarBase64(assinatura) as Uint8Array<ArrayBuffer>,
      new TextEncoder().encode(comCpf.nfce?.parametros ?? ''),
    );
    expect(ok1).toBe(true);
    expect((await conferirAssinatura(xml, { id: comCpf.id, elemento: 'infNFe' })).ok).toBe(true);
    // Em três fases: sem a assinatura, comQrCode recusa; com ela, o texto é o mesmo que o assinarNfe assina.
    expect(() => comQrCode(comCpf)).toThrow(expect.objectContaining({ code: 'config_invalida' }));
    const a = await assinaturaQrCode(comCpf, keys.dataSigner);
    expect(comQrCode(comCpf, a)).toContain(`|${a}</qrCode>`);

    // A montagem confere o tamanho com uma assinatura de chave de 2048 bits; com uma maior, o comQrCode recusa.
    const url = `https://exemplo.invalid/${'a'.repeat(480)}?`;
    const longo = ok(await montarNfe(nfce({ contingencia: cont }), opcoes({ urlQrCode: url })));
    expect(() => comQrCode(longo, 'A'.repeat(684))).toThrow(expect.objectContaining({ code: 'validacao_falhou' }));
    const demais = await montarNfe(nfce({ contingencia: cont }), opcoes({ urlQrCode: `${url}${'a'.repeat(200)}` }));
    expect(falha(demais)[0]).toMatchObject({ code: 'schema', origem: 'montagem' });
  });

  test('NF-e não leva infNFeSupl nem assinatura de QR Code', async () => {
    const keys = await generateTestKeys();
    const n = ok(await montarNfe(nota(), opcoes()));
    expect(n.nfce).toBeUndefined();
    expect(await assinaturaQrCode(n, keys.dataSigner)).toBeUndefined();
    expect(comQrCode(n)).toBe(n.xml);
    expect(await assinarNfe(n, keys.dataSigner)).not.toContain('infNFeSupl');
  });

  test('emitente pessoa física na série 920: QR Code versão 3, e versão 2 é recusada (ZX02-222)', async () => {
    const base = nfce();
    const emitente = { ...base.emitente, CNPJ: undefined, CPF } as DadosNfe['emitente'];
    const n = ok(await montarNfe({ ...base, emitente, serie: 920 }, opcoes()));
    expect(n.chave.slice(6, 20)).toBe(`000${CPF}`);
    const r = await montarNfe(
      { ...base, emitente, serie: 920 },
      opcoes({ qrCode: { versao: '2', idCSC: '1', CSC: CSC_TESTE } }),
    );
    expect(achar(r, 'qrCode.versao')).toMatchObject({ code: 'qrcode_invalido', origem: 'montagem' });
  });

  test('CSC e idCSC fora da forma são da montagem', async () => {
    const r = await montarNfe(nfce(), opcoes({ qrCode: { versao: '2', idCSC: '1234567', CSC: 'CURTO' } }));
    expect(achar(r, 'qrCode.idCSC')).toMatchObject({ code: 'qrcode_invalido', origem: 'montagem' });
    expect(achar(r, 'qrCode.CSC')).toMatchObject({ code: 'qrcode_invalido', origem: 'montagem' });
  });

  test('UF sem endereço completo na tabela pede urlQrCode; a opção sobrepõe a tabela', async () => {
    const base = nfce();
    const am = {
      ...base,
      emitente: {
        ...base.emitente,
        endereco: { ...base.emitente.endereco, UF: 'AM' as const, cMun: '1302603', xMun: 'MANAUS' },
      },
    } as DadosNfe;
    delete (am.emitente as { IE?: string }).IE;
    const r = await montarNfe(am, opcoes());
    expect(achar(r, 'urlQrCode')).toMatchObject({ code: 'qrcode_invalido', origem: 'montagem' });
    const n = ok(await montarNfe(am, opcoes({ urlQrCode: 'https://exemplo.invalid/nfce/qrcode?' })));
    expect(n.nfce?.base).toBe('https://exemplo.invalid/nfce/qrcode?p=');
    expect(n.nfce?.urlChave).toBe('www.sefaz.am.gov.br/nfce/consulta');
    // O infNFeSupl passa pelo schema antes de assinar: um endereço longo demais estoura o qrCode (até 1000).
    const longo = await montarNfe(am, opcoes({ urlQrCode: `https://exemplo.invalid/${'a'.repeat(1000)}` }));
    expect(falha(longo)[0]).toMatchObject({ code: 'schema', origem: 'montagem' });
    expect(falha(longo)[0]?.caminho).toContain('infNFeSupl');
  });

  test('tabela de endereços por vigência', () => {
    expect(urlsNfce('RN', 'producao', '2026-05-24').qrCode).toBe('http://nfce.set.rn.gov.br/consultarNFCe.aspx');
    expect(urlsNfce('RN', 'producao', '2026-05-25').qrCode).toBe('https://nfce.sefaz.rn.gov.br/consultarNFCe.aspx');
    expect(urlsNfce('MA', 'homologacao', '2026-09-26').qrCode).toBeUndefined();
    expect(urlsNfce('MG', 'homologacao', '2026-09-26').urlChave).toBe(
      'https://hportalsped.fazenda.mg.gov.br/portalnfce',
    );
  });
});

describe('NFC-e: regras do modelo 65', () => {
  const opc = (extra: Partial<MontarNfeOpcoes> = {}): MontarNfeOpcoes => opcoes(extra);

  test('grupos que a NFC-e não tem', async () => {
    const it = item();
    const r = await montarNfe(
      nfce({
        dhSaiEnt: new Date('2026-09-26T10:00:00-03:00'),
        referenciadas: [{ refNFe: '35260911222333000181550010000001231000000010' }],
        cobranca: { fatura: { nFat: '1', vOrig: '15', vLiq: '15' } },
        emitente: { ...nota().emitente, IEST: '110042490114' },
        itens: [{ ...it, impostos: { ...it.impostos, ipi: { cEnq: '999', CST: '53' } as never } }],
      }),
      opc(),
    );
    const vedados = falha(r)
      .filter((i) => i.code === 'grupo_vedado')
      .map((i) => i.caminho);
    expect(vedados).toEqual(
      expect.arrayContaining(['dhSaiEnt', 'referenciadas', 'cobranca', 'emitente.IEST', 'itens[0].impostos.ipi']),
    );
    expect(falha(r).every((i) => i.origem === 'entrada')).toBe(true);
  });

  test('identificação: saída, operação interna, presencial, consumidor final, finalidade normal, DANFC-e', async () => {
    const r = await montarNfe(
      nfce({ tpNF: '0', idDest: '2', indPres: '2', indFinal: '0', finNFe: '4', tpImp: '1' }),
      opc(),
    );
    const paths = falha(r).map((i) => i.caminho);
    expect(paths).toEqual(expect.arrayContaining(['tpNF', 'idDest', 'indPres', 'indFinal', 'finNFe', 'tpImp']));
  });

  test('pagamento: obrigatório, meios vedados, abaixo do total, troco divergente, cartão', async () => {
    const { pagamento: _p, ...sem } = nfce();
    expect(achar(await montarNfe(sem, opc()), 'pagamento')?.code).toBe('campo_obrigatorio');
    const vedados = await montarNfe(
      nfce({
        pagamento: {
          detPag: [
            { tPag: '90', vPag: '0' },
            { tPag: '14' as '01', vPag: '5' },
            { tPag: '99', vPag: '10' },
          ],
        },
      }),
      opc(),
    );
    expect(
      falha(vedados)
        .filter((i) => i.code === 'pagamento_invalido')
        .map((i) => i.caminho),
    ).toEqual(['pagamento.detPag[0].tPag', 'pagamento.detPag[1].tPag', 'pagamento.detPag[2].tPag']);
    const abaixo = await montarNfe(nfce({ pagamento: { detPag: [{ tPag: '01', vPag: '10' }] } }), opc());
    expect(achar(abaixo, 'pagamento.detPag')?.code).toBe('pagamento_invalido');
    const troco = await montarNfe(nfce({ pagamento: { detPag: [{ tPag: '01', vPag: '20' }], vTroco: '4' } }), opc());
    expect(achar(troco, 'pagamento.vTroco')?.code).toBe('valor_divergente');
    const exato = ok(await montarNfe(nfce({ pagamento: { detPag: [{ tPag: '01', vPag: '15' }] } }), opc()));
    expect(exato.infNFe.pag).toEqual({ detPag: [{ tPag: '01', vPag: '15.00' }] });
    const cartao = await montarNfe(nfce({ pagamento: { detPag: [{ tPag: '03', vPag: '15' }] } }), opc());
    expect(achar(cartao, 'pagamento.detPag[0].card')?.code).toBe('campo_obrigatorio');
    const integrado = await montarNfe(
      nfce({ pagamento: { detPag: [{ tPag: '17', vPag: '15', card: { tpIntegra: '1' } }] } }),
      opc(),
    );
    expect(achar(integrado, 'pagamento.detPag[0].card')?.code).toBe('campo_obrigatorio');
    const pix = ok(
      await montarNfe(nfce({ pagamento: { detPag: [{ tPag: '17', vPag: '15', card: { tpIntegra: '2' } }] } }), opc()),
    );
    expect(pix.infNFe.pag.detPag[0]?.card).toEqual({ tpIntegra: '2' });
    // Pagamento posterior (tPag 91, NT 2025.001 v1.03): valor zero, e a soma pode ficar abaixo do total.
    const posterior = ok(
      await montarNfe(
        nfce({
          pagamento: {
            detPag: [
              { tPag: '01', vPag: '5' },
              { tPag: '91', vPag: '0' },
            ],
          },
        }),
        opc(),
      ),
    );
    expect(posterior.infNFe.pag.vTroco).toBeUndefined();
    const posteriorComValor = await montarNfe(nfce({ pagamento: { detPag: [{ tPag: '91', vPag: '15' }] } }), opc());
    expect(achar(posteriorComValor, 'pagamento.detPag[0].vPag')?.code).toBe('pagamento_invalido');
    // O troco informado é conferido também com o pagamento posterior (YA09-10).
    const trocoComPosterior = await montarNfe(
      nfce({ pagamento: { detPag: [{ tPag: '91', vPag: '0' }], vTroco: '99' } }),
      opc(),
    );
    expect(achar(trocoComPosterior, 'pagamento.vTroco')?.code).toBe('valor_divergente');
  });

  test('entrega a domicílio: destinatário, endereço e transportador; frete só nela', async () => {
    const r = await montarNfe(nfce({ indPres: '4' }), opc());
    expect(achar(r, 'destinatario')?.code).toBe('campo_obrigatorio');
    expect(achar(r, 'transporte.transportador')?.code).toBe('campo_obrigatorio');
    const semEndereco = await montarNfe(nfce({ indPres: '4', destinatario: { CPF, indIEDest: '9' } }), opc());
    expect(achar(semEndereco, 'destinatario.endereco')?.code).toBe('campo_obrigatorio');
    const frete = await montarNfe(nfce({ transporte: { modFrete: '0' } }), opc());
    expect(achar(frete, 'transporte.modFrete')?.code).toBe('campo_invalido');
  });

  test('destinatário: não contribuinte, sem Suframa, diferente do emitente; acima de R$ 10.000,00, identificado', async () => {
    const r = await montarNfe(
      nfce({ destinatario: { CNPJ: nota().emitente.CNPJ as string, indIEDest: '1', IE: '110042490114', ISUF: '123' } }),
      opc(),
    );
    expect(falha(r).map((i) => i.caminho)).toEqual(
      expect.arrayContaining(['destinatario.CNPJ', 'destinatario.indIEDest', 'destinatario.ISUF']),
    );
    const caro = nfce({
      itens: [item({ produto: { ...item().produto, qCom: '1', vUnCom: '10000.01' } })],
      pagamento: { detPag: [{ tPag: '01', vPag: '10000.01' }] },
    });
    expect(achar(await montarNfe(caro, opc()), 'destinatario')?.code).toBe('campo_obrigatorio');
    ok(await montarNfe({ ...caro, destinatario: { CPF, indIEDest: '9' } }, opc()));
  });

  test('CFOP 5.933 e ISSQN andam juntos', async () => {
    const r = await montarNfe(nfce({ itens: [item({ produto: { ...item().produto, CFOP: '5933' } })] }), opc());
    expect(achar(r, 'itens[0].impostos.issqn')?.code).toBe('combinacao_invalida');
  });

  test('contingência: off-line só na NFC-e, SVC nunca', async () => {
    const dhCont = new Date('2026-09-26T09:50:00-03:00');
    const xJust = 'SEFAZ FORA DO AR NO MOMENTO';
    const svc = await montarNfe(nfce({ contingencia: { tpEmis: '6', dhCont, xJust } }), opc());
    expect(achar(svc, 'contingencia.tpEmis')?.code).toBe('contingencia_invalida');
    const nfeOffline = await montarNfe(nota({ contingencia: { tpEmis: '9', dhCont, xJust } }), opc());
    expect(achar(nfeOffline, 'contingencia.tpEmis')?.code).toBe('contingencia_invalida');
    const tpImp = await montarNfe(nota({ tpImp: '4' }), opc());
    expect(achar(tpImp, 'tpImp')?.code).toBe('campo_invalido');
  });

  test('assinatura do QR Code com signer de DigestInfo (A3, HSM): prefixo SHA-1 e o hash dos parâmetros', async () => {
    const recebido: Uint8Array[] = [];
    const signer = {
      tipo: 'digest' as const,
      certificadoDer: async (): Promise<Uint8Array> => new Uint8Array(),
      assinarDigestInfo: async (di: Uint8Array): Promise<Uint8Array> => {
        recebido.push(di);
        return di;
      },
    };
    const parametros = '35260911222333000181650010000000011000000019|3|2|26|15.00||';
    const b64 = await assinarParametros(parametros, signer);
    const hash = new Uint8Array(
      await globalThis.crypto.subtle.digest('SHA-1', new TextEncoder().encode(parametros) as Uint8Array<ArrayBuffer>),
    );
    expect([...(recebido[0] ?? [])]).toEqual([...PREFIXO_DIGEST_INFO_SHA1, ...hash]);
    expect([...decodificarBase64(b64)]).toEqual([...(recebido[0] ?? [])]);
  });

  test('mais grupos e combinações recusados na NFC-e', async () => {
    const it = item();
    const r = await montarNfe(
      nfce({
        dPrevEntrega: '2026-09-30',
        cMunFGIBS: '3550308',
        transporte: { modFrete: '9', transportador: { CNPJ: CNPJ_DEST, xNome: 'TRANSPORTADORA' } },
        itens: [
          { ...it, produto: { ...it.produto, tpCredPresIBSZFM: '1' } as never },
          {
            ...it,
            impostos: {
              ...it.impostos,
              icms: {
                grupo: 'Part',
                orig: '0',
                CST: '10',
                modBC: '3',
                pICMS: '12',
                st: { modBCST: '0', vBCST: '20', pICMSST: '18' },
                pBCOp: '100',
                UFST: 'RJ',
              } as never,
            },
          },
          {
            ...it,
            impostos: {
              ...it.impostos,
              icms: {
                grupo: 'ST',
                orig: '0',
                CST: '41',
                vBCSTRet: '10',
                vICMSSTRet: '1.8',
                vBCSTDest: '10',
                vICMSSTDest: '2',
              } as never,
            },
          },
          {
            ...it,
            impostos: {
              ...it.impostos,
              issqn: { vBC: '1', vAliq: '1', cMunFG: '3550308', cListServ: '14.01', indISS: '1', indIncentivo: '2' },
            } as never,
          },
        ],
      }),
      opc(),
    );
    const paths = falha(r).map((i) => i.caminho);
    expect(paths).toEqual(
      expect.arrayContaining([
        'dPrevEntrega',
        'cMunFGIBS',
        'transporte.transportador',
        'itens[0].produto.tpCredPresIBSZFM',
        'itens[1].impostos.icms',
        'itens[2].impostos.icms',
        'itens[3].produto.CFOP',
      ]),
    );
    const cartao = await montarNfe(
      nfce({ pagamento: { detPag: [{ tPag: '03', vPag: '15', card: { tpIntegra: '2', CNPJ: '11111111111111' } }] } }),
      opc(),
    );
    expect(falha(cartao).some((i) => i.caminho.startsWith('pagamento.detPag[0].card.CNPJ'))).toBe(true);
    const foraSemMunicipio = await montarNfe(nfce({ indPres: '5' }), opc());
    expect(achar(foraSemMunicipio, 'cMunFGIBS')?.code).toBe('campo_obrigatorio');
  });

  test('rótulos dos caminhos novos', () => {
    expect(rotuloDoCaminho('pagamento.vTroco')).toBe('Pagamento, Troco');
    expect(rotuloDoCaminho('qrCode.CSC')).toBe('QR Code da NFC-e, CSC');
    expect(rotuloDoCaminho('urlQrCode')).toBe('QR Code da NFC-e');
    expect(rotuloDoCaminho('pagamento.detPag[0].card')).toBe('Pagamento, Cartão');
    expect(rotuloDoCaminho('/NFe/infNFeSupl/qrCode')).toBe('QR Code da NFC-e');
  });

  test('relógio de emissão fixo: a mesma entrada dá o mesmo QR Code', async () => {
    const o = (): MontarNfeOpcoes =>
      opcoes({ tempo: contextoDeTempo({ emissao: relogioFixo('2026-09-26T10:00:00-03:00') }) });
    const a = ok(await montarNfe(nfce(), o()));
    const b = ok(await montarNfe(nfce(), o()));
    expect(a.nfce).toEqual(b.nfce);
  });
});
