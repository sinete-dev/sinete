import { beforeAll, describe, expect, test } from 'bun:test';
import type { AssinadorDeDados } from '../../src/index.ts';
import { ehErroSinete } from '../../src/index.ts';
import {
  ALGORITMOS_XMLDSIG,
  assinarPreparada,
  assinarXml,
  codificarBase64,
  conferirAssinatura,
  digestInfoDoSignedInfo,
  ErroAssinaturaXml,
  encontrarAssinaturas,
  extrairSpki,
  lerXml,
  montarAssinatura,
  PREFIXO_DIGEST_INFO_SHA1,
  prepararAssinatura,
} from '../../src/xml/index.ts';
import type { TestKeys } from './helpers/test-keys.ts';
import { generateTestKeys, toPem } from './helpers/test-keys.ts';

const NFE = 'http://www.portalfiscal.inf.br/nfe';
const ID = 'NFe35260900000000000000550010000000011000000010';
const DOC = `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="${NFE}"><infNFe Id="${ID}" versao="4.00"><ide><cUF>35</cUF><xNat>VENDA DE TESTE</xNat></ide><emit><xNome>EMPRESA SINTETICA LTDA</xNome></emit></infNFe></NFe>`;

let keys: TestKeys;
let other: TestKeys;
let signed: string;

beforeAll(async () => {
  keys = await generateTestKeys();
  other = await generateTestKeys('outra chave sintetica');
  signed = await assinarXml(DOC, { id: ID }, keys.dataSigner);
});

function withoutSignature(xml: string): string {
  const doc = lerXml(xml);
  const sig = encontrarAssinaturas(doc)[0];
  if (!sig) throw new Error('sem assinatura');
  return xml.slice(0, sig.inicio) + xml.slice(sig.fim);
}

describe('assinatura em três fases', () => {
  test('a saída é a entrada com uma única inserção, como último filho do pai do elemento assinado', () => {
    expect(withoutSignature(signed)).toBe(DOC);
    const at = DOC.indexOf('</infNFe>') + '</infNFe>'.length;
    expect(signed.slice(at).startsWith('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">')).toBe(true);
    expect(signed.endsWith('</Signature></NFe>')).toBe(true);
  });

  test('NFC-e: a Signature entra depois do infNFeSupl, na ordem do schema', async () => {
    const supl =
      '<infNFeSupl><qrCode><![CDATA[https://exemplo.invalid/qr?p=1]]></qrCode><urlChave>x</urlChave></infNFeSupl>';
    const nfce = DOC.replace('</infNFe></NFe>', `</infNFe>${supl}\n</NFe>`);
    const s = await assinarXml(nfce, { id: ID }, keys.dataSigner);
    expect(withoutSignature(s)).toBe(nfce);
    expect(s.endsWith('</infNFeSupl>\n<Signature', s.indexOf('<Signature') + '<Signature'.length)).toBe(true);
    expect(s.endsWith('</Signature></NFe>')).toBe(true);
    expect((await conferirAssinatura(s, { id: ID, elemento: 'infNFe' })).ok).toBe(true);
    const tpl = await prepararAssinatura(nfce, { id: ID, certificadoDer: keys.certificateDer });
    expect(tpl.inseridaEm).toBe(nfce.lastIndexOf('</NFe>'));
  });

  test('verifica com o verificador próprio e devolve o elemento e o certificado', async () => {
    const r = await conferirAssinatura(signed, { id: ID, elemento: 'infNFe' });
    if (!r.ok) throw new Error(r.detalhe);
    expect(r.elemento.local).toBe('infNFe');
    expect(r.certificadoDer).toEqual(keys.certificateDer);
    expect(r.algoritmoDeAssinatura).toBe('rsa-sha1');
    expect(r.algoritmoDeDigest).toBe('sha1');
    expect(extrairSpki(r.certificadoDer).length).toBeGreaterThan(200);
  });

  test('o certificado sintético sai em PEM para os oráculos locais', () => {
    const pem = toPem('CERTIFICATE', keys.certificateDer);
    expect(pem.startsWith('-----BEGIN CERTIFICATE-----\n')).toBe(true);
    expect(pem.trimEnd().endsWith('-----END CERTIFICATE-----')).toBe(true);
  });

  test('determinística: mesma chave e mesmo documento produzem os mesmos bytes', async () => {
    expect(await assinarXml(DOC, { id: ID }, keys.dataSigner)).toBe(signed);
  });

  test('modo digest (DigestInfo SHA-1 + RSA cru) gera saída idêntica ao modo data', async () => {
    expect(await assinarXml(DOC, { id: ID }, keys.digestSigner)).toBe(signed);
  });

  test('o DigestInfo tem 35 bytes com o prefixo SHA-1', async () => {
    const p = await prepararAssinatura(DOC, { id: ID, certificadoDer: keys.certificateDer });
    const di = await digestInfoDoSignedInfo(p);
    expect(di.length).toBe(35);
    expect(di.subarray(0, 15)).toEqual(PREFIXO_DIGEST_INFO_SHA1);
  });

  test('prepare, sign e assemble separados dão o mesmo resultado de signXml', async () => {
    const p = await prepararAssinatura(DOC, { id: ID, certificadoDer: keys.certificateDer });
    expect(p.modelo.includes(p.marcador)).toBe(true);
    expect(p.inseridaEm).toBe(DOC.indexOf('</infNFe>') + 9);
    const sv = await assinarPreparada(p, keys.dataSigner);
    expect(montarAssinatura(p, sv)).toBe(signed);
    const digestValue = /<DigestValue>([^<]+)</.exec(signed)?.[1];
    expect(p.digestValue).toBe(digestValue ?? '');
  });

  test('o SignedInfo é canonicalizado no contexto final (namespace herdado do envelope)', async () => {
    const proc = `<nfeProc xmlns="${NFE}" versao="4.00">${DOC.replace(/^<\?xml[^>]*\?>/, '')}</nfeProc>`;
    const s = await assinarXml(proc, { id: ID }, keys.dataSigner);
    expect((await conferirAssinatura(s, { id: ID })).ok).toBe(true);
  });

  test('NFe assinada embrulhada por splice num nfeProc continua válida', async () => {
    const body = signed.replace(/^<\?xml[^>]*\?>/, '');
    const proc = `<nfeProc xmlns="${NFE}" versao="4.00">${body}<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb></infProt></protNFe></nfeProc>`;
    expect((await conferirAssinatura(proc, { id: ID, elemento: 'infNFe' })).ok).toBe(true);
  });

  test('xmlns:xsi acrescentado no envelope depois da assinatura quebra o digest e o SignedInfo (C14N inclusivo)', async () => {
    const body = signed.replace(/^<\?xml[^>]*\?>/, '');
    const proc = `<nfeProc xmlns="${NFE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${body}</nfeProc>`;
    // O SignedInfo também é um document subset e herda o xmlns:xsi do envelope, então nem ele confere mais.
    expect(await conferirAssinatura(proc, { id: ID })).toMatchObject({
      ok: false,
      motivo: 'digest-diverge',
      signedInfoValido: false,
    });
  });
});

describe('verificação recusa com motivo', () => {
  test('conteúdo alterado depois de assinado', async () => {
    const r = await conferirAssinatura(signed.replace('VENDA DE TESTE', 'VENDA DE TESTX'), { id: ID });
    expect(r).toMatchObject({ ok: false, motivo: 'digest-diverge', signedInfoValido: true });
  });

  test('assinatura forjada: digest refeito sem a chave', async () => {
    const tampered = DOC.replace('VENDA DE TESTE', 'OUTRA VENDA');
    const p = await prepararAssinatura(tampered, { id: ID, certificadoDer: keys.certificateDer });
    const forged = montarAssinatura(p, await assinarPreparada(p, other.dataSigner));
    expect(await conferirAssinatura(forged, { id: ID })).toMatchObject({ ok: false, motivo: 'assinatura-invalida' });
  });

  test('SignatureValue e digest adulterados: SignedInfo também não confere', async () => {
    const r = await conferirAssinatura(
      signed.replace('VENDA DE TESTE', 'X').replace(/<DigestValue>[^<]+</, '<DigestValue>AAAA<'),
      { id: ID },
    );
    expect(r).toMatchObject({ ok: false, motivo: 'digest-diverge', signedInfoValido: false });
  });

  test('sem assinatura', async () => {
    expect(await conferirAssinatura(DOC, { id: ID })).toMatchObject({ ok: false, motivo: 'sem-assinatura' });
  });

  test('XML malformado', async () => {
    const r = await conferirAssinatura(signed.replace('VENDA DE TESTE', 'M&M'), { id: ID });
    expect(r).toMatchObject({ ok: false, motivo: 'leitura' });
  });

  test('assinatura de outro Id (o chamador esperava outro elemento)', async () => {
    expect(await conferirAssinatura(signed, { id: 'NFe999' })).toMatchObject({
      ok: false,
      motivo: 'referencia-inesperada',
    });
  });

  test('nome do elemento diferente do esperado', async () => {
    expect(await conferirAssinatura(signed, { id: ID, elemento: 'infEvento' })).toMatchObject({
      ok: false,
      motivo: 'referencia-nao-encontrada',
    });
  });

  test('Reference aponta para Id que não existe', async () => {
    const r = await conferirAssinatura(signed.replace(`Id="${ID}"`, 'Id="outro"'), { id: ID });
    expect(r).toMatchObject({ ok: false, motivo: 'referencia-nao-encontrada' });
  });

  test('signature wrapping: segundo elemento com o mesmo Id', async () => {
    const wrapped = signed.replace('</NFe>', `<infNFe Id="${ID}" versao="4.00"><ide/></infNFe></NFe>`);
    expect(await conferirAssinatura(wrapped, { id: ID })).toMatchObject({ ok: false, motivo: 'id-duplicado' });
  });

  test('duas assinaturas para o mesmo Id', async () => {
    const sig = signed.slice(signed.indexOf('<Signature'), signed.indexOf('</Signature>') + 12);
    const twice = signed.replace('</NFe>', `${sig}</NFe>`);
    expect(await conferirAssinatura(twice, { id: ID })).toMatchObject({ ok: false, motivo: 'id-duplicado' });
  });

  test('algoritmos fora do perfil', async () => {
    const A = ALGORITMOS_XMLDSIG;
    const variants: [string, string][] = [
      [A.c14n, 'http://www.w3.org/2001/10/xml-exc-c14n#'],
      [A.rsaSha1, 'http://www.w3.org/2000/09/xmldsig#dsa-sha1'],
      [A.sha1, 'http://www.w3.org/2001/04/xmldsig-more#md5'],
      [A.envelopedSignature, 'http://www.w3.org/TR/1999/REC-xpath-19991116'],
    ];
    for (const [from, to] of variants) {
      const r = await conferirAssinatura(signed.replace(`"${from}"`, `"${to}"`), { id: ID });
      expect(r).toMatchObject({ ok: false, motivo: 'algoritmo-nao-suportado' });
    }
    const two = signed.replace('</SignedInfo>', '<Reference URI="#x"/></SignedInfo>');
    expect(await conferirAssinatura(two, { id: ID })).toMatchObject({ ok: false, motivo: 'algoritmo-nao-suportado' });
  });

  test('documento aninhado demais volta como falha, sem estourar a pilha', async () => {
    const deep = '<r>'.repeat(12000) + '</r>'.repeat(12000);
    expect(await conferirAssinatura(deep, { id: ID })).toMatchObject({ ok: false, motivo: 'leitura' });
  });

  test('estrutura incompleta', async () => {
    const noSv = signed.replace(/<SignatureValue>[^<]+<\/SignatureValue>/, '');
    expect(await conferirAssinatura(noSv, { id: ID })).toMatchObject({ ok: false, motivo: 'estrutura' });
    const badB64 = signed.replace(/<DigestValue>[^<]+</, '<DigestValue>***<');
    expect(await conferirAssinatura(badB64, { id: ID })).toMatchObject({ ok: false, motivo: 'estrutura' });
    const noSi = signed.replace(/<SignedInfo>.*<\/SignedInfo>/, '');
    expect(
      await conferirAssinatura(
        noSi.replace('<SignatureValue>', `<SignedInfo><Reference URI="#${ID}"/></SignedInfo><SignatureValue>`),
        { id: ID },
      ),
    ).toMatchObject({ ok: false, motivo: 'algoritmo-nao-suportado' });
  });

  test('certificado ausente ou ilegível', async () => {
    const noCert = signed.replace(/<KeyInfo>.*<\/KeyInfo>/, '');
    expect(await conferirAssinatura(noCert, { id: ID })).toMatchObject({ ok: false, motivo: 'certificado' });
    const badCert = signed.replace(/<X509Certificate>[^<]+</, '<X509Certificate>AAAA<');
    expect(await conferirAssinatura(badCert, { id: ID })).toMatchObject({ ok: false, motivo: 'certificado' });
  });

  test('aceita documento já parseado', async () => {
    expect((await conferirAssinatura(lerXml(signed), { id: ID })).ok).toBe(true);
  });

  test('aceita SHA-256 na verificação', async () => {
    const A = ALGORITMOS_XMLDSIG;
    const doc = DOC;
    const p = await prepararAssinatura(doc, { id: ID, certificadoDer: keys.certificateDer });
    // Monta à mão um SignedInfo RSA-SHA256 + digest SHA-256 a partir do template.
    const digest256 = codificarBase64(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(
            `<infNFe xmlns="${NFE}" Id="${ID}" versao="4.00"><ide><cUF>35</cUF><xNat>VENDA DE TESTE</xNat></ide><emit><xNome>EMPRESA SINTETICA LTDA</xNome></emit></infNFe>`,
          ),
        ),
      ),
    );
    const template = p.modelo
      .replace(A.rsaSha1, A.rsaSha256)
      .replace(A.sha1, A.sha256)
      .replace(p.digestValue, digest256);
    const si = /<SignedInfo>.*<\/SignedInfo>/.exec(template)?.[0] ?? '';
    const siC14n = si
      .replace('<SignedInfo>', '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">')
      .replace(/<(CanonicalizationMethod|SignatureMethod|Transform|DigestMethod)( [^>]*)\/>/g, '<$1$2></$1>');
    const key = await crypto.subtle.importKey(
      'pkcs8',
      keys.pkcs8 as Uint8Array<ArrayBuffer>,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sv = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(siC14n)));
    const out = template.replace(p.marcador, codificarBase64(sv));
    const r = await conferirAssinatura(out, { id: ID });
    expect(r).toMatchObject({ ok: true, algoritmoDeAssinatura: 'rsa-sha256', algoritmoDeDigest: 'sha256' });
  });
});

describe('erros de preparo', () => {
  const certificateDer = new Uint8Array([1]);
  const reasons = async (xml: string, id: string): Promise<string> => {
    try {
      await prepararAssinatura(xml, { id, certificadoDer: certificateDer });
    } catch (e) {
      if (e instanceof ErroAssinaturaXml) {
        expect(ehErroSinete(e, 'xmldsig_falhou')).toBe(true);
        return e.motivo;
      }
      throw e;
    }
    return 'sem erro';
  };

  test('Id ausente, duplicado, na raiz e placeholder já presente', async () => {
    expect(await reasons(DOC, 'nada')).toBe('id-ausente');
    expect(await reasons('<r><a Id="x"/><b Id="x"/></r>', 'x')).toBe('id-duplicado');
    expect(await reasons('<r Id="x"/>', 'x')).toBe('referencia-na-raiz');
    expect(await reasons('<r><a Id="x">@@SINETE_SIGNATURE_VALUE@@</a></r>', 'x')).toBe('placeholder-no-documento');
  });

  test('assemble exige exatamente um placeholder e assinatura não vazia', async () => {
    const p = await prepararAssinatura(DOC, { id: ID, certificadoDer: certificateDer });
    expect(() => montarAssinatura(p, new Uint8Array())).toThrow(ErroAssinaturaXml);
    expect(() => montarAssinatura({ ...p, modelo: DOC }, new Uint8Array([1]))).toThrow(ErroAssinaturaXml);
    const empty: AssinadorDeDados = {
      tipo: 'dados',
      certificadoDer: async () => certificateDer,
      assinar: async () => new Uint8Array(),
    };
    await expect(assinarPreparada(p, empty)).rejects.toThrow(ErroAssinaturaXml);
  });
});
