/**
 * Ponta a ponta com uma NF-e sintética (PL_010f): objeto tipado, serializer canônico, assinatura por splice,
 * validação estrita, decodificação tolerante e o digest da reserialização. Quando o xmllint existe, ele confere o mesmo
 * documento (diferencial contra o libxml2).
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assinarXml, c14n, conferirAssinatura, elementosFilhos, lerXml, primeiroFilho } from '@sinete/core/xml';
import { $ } from 'bun';
import type { TestKeys } from '../../core/test/xml/helpers/test-keys.ts';
import { generateTestKeys } from '../../core/test/xml/helpers/test-keys.ts';
import {
  decodificar,
  decodificarRaiz,
  decodificarXml,
  ErroSerializacao,
  exigirValido,
  serializar,
  serializarRaiz,
  validar,
  validarRaiz,
} from '../src/index.ts';
import * as protocolo from '../src/nfe/consulta-protocolo/PL_010d.ts';
import * as nfe010e from '../src/nfe/PL_010e.ts';
import type { TNFe, TNFe_infNFe } from '../src/nfe/PL_010f.ts';
import * as nfe from '../src/nfe/PL_010f.ts';

const NFE = 'http://www.portalfiscal.inf.br/nfe';
const ID = 'NFe35260900000000000000550010000000011000000011';
const repo = path.resolve(import.meta.dir, '../../..');
const fixture = await Bun.file(path.join(import.meta.dir, 'fixtures/nfe-sintetica.xml')).text();

let keys: TestKeys;
beforeAll(async () => {
  keys = await generateTestKeys();
});

const infNFe: TNFe_infNFe = {
  Id: ID,
  versao: '4.00',
  ide: {
    cUF: '35',
    cNF: '00000001',
    natOp: 'VENDA DE MERCADORIA SINTETICA',
    mod: '55',
    serie: '1',
    nNF: '1',
    dhEmi: '2026-09-25T10:00:00-03:00',
    tpNF: '1',
    idDest: '1',
    cMunFG: '3550308',
    tpImp: '1',
    tpEmis: '1',
    cDV: '1',
    tpAmb: '2',
    finNFe: '1',
    indFinal: '1',
    indPres: '1',
    procEmi: '0',
    verProc: 'sinete-teste',
  },
  emit: {
    CNPJ: '00000000000000',
    xNome: 'EMPRESA SINTETICA DE TESTE LTDA',
    enderEmit: {
      xLgr: 'RUA DE TESTE',
      nro: '100',
      xBairro: 'CENTRO',
      cMun: '3550308',
      xMun: 'SAO PAULO',
      UF: 'SP',
      CEP: '01001000',
    },
    IE: '111111111111',
    CRT: '1',
  },
  dest: { CPF: '00000000000', xNome: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL', indIEDest: '9' },
  det: [
    {
      nItem: '1',
      prod: {
        cProd: 'SKU1',
        cEAN: 'SEM GTIN',
        xProd: 'PRODUTO SINTETICO',
        NCM: '84713012',
        CFOP: '5102',
        uCom: 'UN',
        qCom: '1.0000',
        vUnCom: '10.00',
        vProd: '10.00',
        cEANTrib: 'SEM GTIN',
        uTrib: 'UN',
        qTrib: '1.0000',
        vUnTrib: '10.00',
        indTot: '1',
      },
      imposto: {
        ICMS: { ICMSSN102: { orig: '0', CSOSN: '102' } },
        PIS: { PISNT: { CST: '07' } },
        COFINS: { COFINSNT: { CST: '07' } },
      },
    },
  ],
  total: {
    ICMSTot: {
      vBC: '0.00',
      vICMS: '0.00',
      vICMSDeson: '0.00',
      vFCP: '0.00',
      vBCST: '0.00',
      vST: '0.00',
      vFCPST: '0.00',
      vFCPSTRet: '0.00',
      vProd: '10.00',
      vFrete: '0.00',
      vSeg: '0.00',
      vDesc: '0.00',
      vII: '0.00',
      vIPI: '0.00',
      vIPIDevol: '0.00',
      vPIS: '0.00',
      vCOFINS: '0.00',
      vOutro: '0.00',
      vNF: '10.00',
    },
  },
  transp: { modFrete: '9' },
  pag: { detPag: [{ tPag: '01', vPag: '10.00' }] },
  infAdic: { infCpl: 'DOCUMENTO SINTETICO & DE TESTE' },
};

describe('NF-e sintética no PL_010f', () => {
  test('o serializer produz exatamente a fixture, que é a forma canônica', () => {
    const nfeObj = { infNFe } as TNFe;
    const xml = serializarRaiz(nfe.NFeElement, nfeObj);
    expect(xml).toBe(fixture.trimEnd());
    const doc = lerXml(xml);
    expect(c14n(doc.raiz)).toBe(xml);
  });

  test('sem Signature, o validador aponta só o modelo de conteúdo do NFe', () => {
    const issues = validarRaiz(nfe.NFeElement, fixture);
    expect(issues.map((i) => [i.code, i.caminho])).toEqual([['modelo_de_conteudo', '/NFe']]);
    expect(() => exigirValido(nfe.NFeElement, fixture)).toThrow();
  });

  test('assinada por splice, valida, verifica, decodifica e reserializa com o mesmo digest', async () => {
    const signed = await assinarXml(fixture.trimEnd(), { id: ID }, keys.dataSigner);
    expect(await assinarXml(fixture.trimEnd(), { id: ID }, keys.digestSigner)).toBe(signed);
    expect(validarRaiz(nfe.NFeElement, signed)).toEqual([]);
    exigirValido(nfe.NFeElement, lerXml(signed));
    const v = await conferirAssinatura(signed, { id: ID, elemento: 'infNFe' });
    expect(v.ok).toBe(true);
    const d = decodificarXml(nfe.NFeElement, signed);
    expect(d.ocorrencias).toEqual([]);
    expect(d.valor.infNFe.emit.xNome).toBe('EMPRESA SINTETICA DE TESTE LTDA');
    expect(d.valor.infNFe.infAdic?.infCpl).toBe('DOCUMENTO SINTETICO & DE TESTE');
    expect(d.valor.Signature.SignedInfo.Reference.URI).toBe(`#${ID}`);
    // Reserializar o infNFe decodificado dá o C14N do original: é o que o DigestValue cobre.
    const inf = primeiroFilho(lerXml(signed).raiz, 'infNFe', NFE);
    if (!inf) throw new Error('sem infNFe');
    expect(serializar(nfe.TNFe_infNFe, 'infNFe', d.valor.infNFe)).toBe(c14n(inf));
    // O NFe inteiro reserializado é o C14N da string assinada (o template da Signature usa tags autofechadas, que o
    // C14N expande; só o infNFe e o SignedInfo entram nos digests).
    expect(serializarRaiz(nfe.NFeElement, d.valor)).toBe(c14n(lerXml(signed).raiz));
  });

  test('com infNFeSupl, a Signature entra depois dele e o documento assinado valida', async () => {
    const supl = `<infNFeSupl><qrCode><![CDATA[https://exemplo.invalid/qrcode?p=${ID.slice(3)}|3|2]]></qrCode><urlChave>https://exemplo.invalid/consulta</urlChave></infNFeSupl>`;
    const comSupl = fixture.trimEnd().replace(/<\/infNFe><\/NFe>$/, `</infNFe>${supl}</NFe>`);
    if (!comSupl.includes('<infNFeSupl>')) throw new Error('fixture sem </infNFe></NFe> no fim');
    const signed = await assinarXml(comSupl, { id: ID }, keys.dataSigner);
    expect(signed.indexOf('</infNFeSupl><Signature ')).toBeGreaterThan(0);
    expect(validarRaiz(nfe.NFeElement, signed)).toEqual([]);
    expect((await conferirAssinatura(signed, { id: ID, elemento: 'infNFe' })).ok).toBe(true);
  });

  test('embrulhada num nfeProc por splice continua válida no PL_010f e no PL_010e', async () => {
    const signed = await assinarXml(fixture.trimEnd(), { id: ID }, keys.dataSigner);
    const proc = `<nfeProc xmlns="${NFE}" versao="4.00">${signed.replace(` xmlns="${NFE}"`, '')}<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><verAplic>SP_NFE_PL_010f</verAplic><chNFe>${ID.slice(3)}</chNFe><dhRecbto>2026-09-25T10:00:05-03:00</dhRecbto><nProt>135260000000001</nProt><digVal>${/<DigestValue>([^<]+)/.exec(signed)?.[1]}</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;
    expect(validarRaiz(nfe.nfeProcElement, proc)).toEqual([]);
    expect(validarRaiz(nfe010e.nfeProcElement, proc)).toEqual([]);
    expect((await conferirAssinatura(proc, { id: ID, elemento: 'infNFe' })).ok).toBe(true);
    const d = decodificarRaiz(nfe.nfeProcElement, lerXml(proc));
    expect(d.valor.protNFe.infProt.cStat).toBe('100');
  });

  test.skipIf(!Bun.which('xmllint'))('o xmllint concorda com o validador na fixture assinada', async () => {
    const work = await mkdtemp(path.join(tmpdir(), 'sinete-xmllint-'));
    try {
      const signed = await assinarXml(fixture.trimEnd(), { id: ID }, keys.dataSigner);
      const leiaute = path.join(repo, 'tools/xsd-codegen/xsd/nfe/PL_010f_v1.04/leiauteNFe_v4.00.xsd');
      const wrapper = path.join(work, 'nfe.xsd');
      await Bun.write(
        wrapper,
        `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns="${NFE}" targetNamespace="${NFE}" elementFormDefault="qualified"><xs:include schemaLocation="${leiaute}"/><xs:element name="NFe" type="TNFe"/></xs:schema>`,
      );
      const file = path.join(work, 'nfe.xml');
      await Bun.write(file, signed);
      expect((await $`xmllint --noout --schema ${wrapper} ${file}`.nothrow().quiet()).exitCode).toBe(0);
      await Bun.write(file, signed.replace('<CFOP>5102</CFOP>', '<CFOP>51020</CFOP>'));
      expect((await $`xmllint --noout --schema ${wrapper} ${file}`.nothrow().quiet()).exitCode).not.toBe(0);
      expect(validarRaiz(nfe.NFeElement, signed.replace('<CFOP>5102</CFOP>', '<CFOP>51020</CFOP>'))).toMatchObject([
        { code: 'padrao', caminho: '/NFe/infNFe/det/prod/CFOP' },
      ]);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });
});

describe('validador: regras', () => {
  const issues = (xml: string): string[] => validarRaiz(nfe.NFeElement, xml).map((i) => `${i.code} ${i.caminho}`);
  const mut = (from: string, to: string): string => {
    if (!fixture.includes(from)) throw new Error(`fixture sem ${from}`);
    return fixture.replace(from, to);
  };
  const withoutSigIssue = (xs: string[]): string[] => xs.filter((x) => x !== 'modelo_de_conteudo /NFe');

  test('enumeração, pattern, tamanho e ordem', () => {
    expect(withoutSigIssue(issues(mut('<tpNF>1</tpNF>', '<tpNF>7</tpNF>')))).toEqual([
      'enumeracao /NFe/infNFe/ide/tpNF',
    ]);
    expect(withoutSigIssue(issues(mut('<xBairro>CENTRO</xBairro>', '<xBairro>C</xBairro>')))).toEqual([
      'tamanho_minimo /NFe/infNFe/emit/enderEmit/xBairro',
    ]);
    expect(withoutSigIssue(issues(mut('<xBairro>CENTRO</xBairro>', '<xBairro> CENTRO</xBairro>')))).toEqual([
      'padrao /NFe/infNFe/emit/enderEmit/xBairro',
    ]);
    const swapped = mut('<cUF>35</cUF><cNF>00000001</cNF>', '<cNF>00000001</cNF><cUF>35</cUF>');
    expect(withoutSigIssue(issues(swapped))).toEqual(['modelo_de_conteudo /NFe/infNFe/ide']);
  });

  test('elemento e atributo desconhecidos, atributo obrigatório, texto solto', () => {
    expect(withoutSigIssue(issues(mut('<transp>', '<transp><extra>1</extra>')))).toEqual([
      'elemento_desconhecido /NFe/infNFe/transp/extra',
    ]);
    expect(withoutSigIssue(issues(mut('<det nItem="1">', '<det nItem="1" x="1">')))).toEqual([
      'atributo_desconhecido /NFe/infNFe/det/@x',
    ]);
    expect(withoutSigIssue(issues(mut(' versao="4.00">', '>')))).toEqual(['atributo_obrigatorio /NFe/infNFe/@versao']);
    expect(withoutSigIssue(issues(mut('<transp>', 'solto<transp>')))).toEqual(['texto_em_elemento /NFe/infNFe']);
    expect(withoutSigIssue(issues(mut('<CFOP>5102</CFOP>', '<CFOP x="1">5102</CFOP>')))).toEqual([
      'atributo_desconhecido /NFe/infNFe/det/prod/CFOP/@x',
    ]);
    expect(withoutSigIssue(issues(mut('<CFOP>5102</CFOP>', '<CFOP><x/>5102</CFOP>')))).toContain(
      'elemento_em_tipo_simples /NFe/infNFe/det/prod/CFOP',
    );
  });

  test('xs:unique de nItem entre os det e índice no caminho de irmãos repetidos', () => {
    const det = /<det nItem="1">.*<\/det>/.exec(fixture)?.[0] ?? '';
    const twice = mut(det, `${det}${det.replace('<CFOP>5102</CFOP>', '<CFOP>9</CFOP>')}`);
    expect(withoutSigIssue(issues(twice))).toEqual([
      'unico /NFe/infNFe/det/@nItem',
      'padrao /NFe/infNFe/det[2]/prod/CFOP',
    ]);
  });

  test('ID duplicado no documento (Reference com o mesmo Id do infNFe)', async () => {
    const signed = await assinarXml(fixture.trimEnd(), { id: ID }, keys.dataSigner);
    const dup = signed.replace(`<Reference URI="#${ID}">`, `<Reference Id="${ID}" URI="#${ID}">`);
    expect(validarRaiz(nfe.NFeElement, dup).map((i) => `${i.code} ${i.caminho}`)).toEqual([
      'id_duplicado /NFe/Signature/SignedInfo/Reference/@Id',
    ]);
    // O ID compara depois do collapse: " Id " repete "Id" (o xmllint recusa).
    const spaced = signed.replace(`<Reference URI="#${ID}">`, `<Reference Id=" ${ID} " URI="#${ID}">`);
    expect(validarRaiz(nfe.NFeElement, spaced).map((i) => `${i.code} ${i.caminho}`)).toEqual([
      'id_duplicado /NFe/Signature/SignedInfo/Reference/@Id',
    ]);
  });

  test('fixed e xs:unique também comparam depois do whiteSpace do tipo', async () => {
    const signed = await assinarXml(fixture.trimEnd(), { id: ID }, keys.dataSigner);
    const c14nAlg = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
    const fixedSpaced = signed.replace(
      `<CanonicalizationMethod Algorithm="${c14nAlg}"/>`,
      `<CanonicalizationMethod Algorithm=" ${c14nAlg} "/>`,
    );
    expect(validarRaiz(nfe.NFeElement, fixedSpaced)).toEqual([]);
    const env = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
    const dupTransform = signed.replace(`<Transform Algorithm="${c14nAlg}"/>`, `<Transform Algorithm=" ${env} "/>`);
    expect(validarRaiz(nfe.NFeElement, dupTransform).map((i) => `${i.code} ${i.caminho}`)).toEqual([
      'unico /NFe/Signature/SignedInfo/Reference/Transforms/Transform/@Algorithm',
    ]);
  });

  test('raiz inesperada', () => {
    expect(validarRaiz(nfe.NFeElement, '<NFe/>')).toMatchObject([{ code: 'raiz_inesperada' }]);
    expect(validar(nfe.TNFe, lerXml(fixture).raiz).map((i) => i.code)).toEqual(['modelo_de_conteudo']);
  });
});

describe('decoder tolerante', () => {
  test('não aborta: registra desconhecido, whitespace, texto, namespace e raiz, e lê o resto', () => {
    const odd = fixture
      .replace('<transp>', '\n  <transp><extra>1</extra>')
      .replace('<det nItem="1">', '<det nItem="1" x="1">')
      .replace('<infAdic>', 'solto<infAdic>')
      .replace('<CFOP>5102</CFOP>', '<CFOP><b/>5102</CFOP>')
      .replace('<cUF>35</cUF>', '<cUF __proto__="x">35</cUF>')
      .replace('<verProc>sinete-teste</verProc>', '<verProc xmlns="urn:outro">sinete-teste</verProc>');
    const d = decodificarXml(nfe.NFeElement, odd);
    expect(d.ocorrencias.map((i) => `${i.code} ${i.caminho}`)).toEqual([
      'atributo_desconhecido /NFe/infNFe/ide/cUF/@__proto__',
      'namespace_divergente /NFe/infNFe/ide/verProc',
      'atributo_desconhecido /NFe/infNFe/det/@x',
      'elemento_em_tipo_simples /NFe/infNFe/det/prod/CFOP/b',
      'whitespace_descartado /NFe/infNFe',
      'elemento_desconhecido /NFe/infNFe/transp/extra',
      'texto_inesperado /NFe/infNFe',
    ]);
    expect(d.valor.infNFe.det[0]?.prod.CFOP).toBe('5102');
    const wrong = decodificarXml(
      nfe.NFeElement,
      fixture
        .trimEnd()
        .replace('<NFe ', '<Nfe ')
        .replace(/<\/NFe>$/, '</Nfe>'),
    );
    expect(wrong.ocorrencias[0]).toMatchObject({ code: 'raiz_inesperada' });
  });

  test('xs:any e anyAttribute: fragmento leva as declarações herdadas que usa, e reserializa bem formado', () => {
    const src =
      `<evento xmlns="${NFE}" xmlns:n="urn:ext" xmlns:o="urn:outro"><detEvento versao="1.00" n:marca="1" xmlns:x="urn:x">` +
      '<descEvento>Cancelamento</descEvento><n:extra o:a="1"><x:y/></n:extra><semNs xmlns=""/></detEvento></evento>';
    const doc = lerXml(src);
    const det = primeiroFilho(doc.raiz, 'detEvento', NFE);
    if (!det) throw new Error('sem detEvento');
    const d = decodificar(protocolo.TEvento_infEvento_detEvento, det, doc.texto);
    expect(d.ocorrencias).toEqual([]);
    expect(d.valor.$any).toEqual([
      '<descEvento>Cancelamento</descEvento>',
      '<n:extra xmlns:n="urn:ext" xmlns:o="urn:outro" xmlns:x="urn:x" o:a="1"><x:y/></n:extra>',
      '<semNs xmlns=""/>',
    ]);
    expect(d.valor.$attrs).toEqual({ versao: '1.00', 'n:marca': '1', 'xmlns:n': 'urn:ext' });
    const out = serializar(protocolo.TEvento_infEvento_detEvento, 'detEvento', d.valor, NFE);
    const back = lerXml(`<evento xmlns="${NFE}">${out}</evento>`).raiz;
    const [desc, extra, semNs] = elementosFilhos(primeiroFilho(back, 'detEvento', NFE) ?? back);
    expect(desc?.ns).toBe(NFE);
    expect(extra?.ns).toBe('urn:ext');
    expect(extra?.atributos[0]?.ns).toBe('urn:outro');
    expect(elementosFilhos(extra ?? back)[0]?.ns).toBe('urn:x');
    expect(semNs?.ns).toBe('');
    // Com prefixo em outro elemento: o default herdado que difere do pai também entra.
    const pref = lerXml(`<p:detEvento xmlns:p="${NFE}" xmlns="urn:default"><a/></p:detEvento>`);
    const prefAny = decodificar(protocolo.TEvento_infEvento_detEvento, pref.raiz, pref.texto).valor.$any;
    expect(prefAny).toEqual(['<a xmlns="urn:default"/>']);
  });

  test('decodificação direta de um elemento e texto de tipo simples misturado com PI', () => {
    const inf = primeiroFilho(lerXml(fixture).raiz, 'infNFe', NFE);
    if (!inf) throw new Error('sem infNFe');
    expect(decodificar(nfe.TNFe_infNFe, inf).valor.ide.cUF).toBe('35');
    const pi = decodificarXml(nfe.NFeElement, fixture.replace('<cUF>35</cUF>', '<cUF>3<?p x?>5</cUF>'));
    expect(pi.valor.infNFe.ide.cUF).toBe('35');
  });
});

describe('serializer', () => {
  test('recusa valor com forma errada, com o caminho', () => {
    const bad = { infNFe: { ...infNFe, ide: { ...infNFe.ide, cUF: 35 } } } as unknown as TNFe;
    expect(() => serializarRaiz(nfe.NFeElement, bad)).toThrow(ErroSerializacao);
    try {
      serializarRaiz(nfe.NFeElement, bad);
    } catch (e) {
      expect((e as ErroSerializacao).caminho).toBe('/NFe/infNFe/ide/cUF');
      expect((e as ErroSerializacao).code).toBe('serializacao_invalida');
    }
    expect(() => serializarRaiz(nfe.NFeElement, { infNFe: 'x' } as unknown as TNFe)).toThrow(ErroSerializacao);
  });

  test('choice com membro compartilhado escolhe o ramo que cobre todos os membros presentes', () => {
    const imposto = infNFe.det[0]?.imposto;
    if (!imposto) throw new Error('fixture sem imposto');
    const { ICMS: _icms, ...semIcms } = imposto as Record<string, unknown>;
    const ipi = { cEnq: '999', IPINT: { CST: '53' } };
    const issqn = {
      vBC: '10.00',
      vAliq: '2.0000',
      vISSQN: '0.20',
      cMunFG: '3550308',
      cListServ: '01.01',
      indISS: '1',
      indIncentivo: '2',
    };
    const servico = { ...semIcms, IPI: ipi, ISSQN: issqn } as unknown as typeof imposto;
    const xml = serializar(nfe.TNFe_infNFe_det_imposto, 'imposto', servico);
    expect(xml).toContain('<IPI><cEnq>999</cEnq><IPINT><CST>53</CST></IPINT></IPI><ISSQN>');
    expect(validar(nfe.TNFe_infNFe_det_imposto, lerXml(xml).raiz)).toEqual([]);
    const mistura = { ...imposto, ISSQN: issqn } as unknown as typeof imposto;
    expect(() => serializar(nfe.TNFe_infNFe_det_imposto, 'imposto', mistura)).toThrow(ErroSerializacao);
  });

  test('choice é exclusivo no tipo', () => {
    const emit: TNFe_infNFe['emit'] = { ...infNFe.emit };
    // @ts-expect-error CNPJ e CPF juntos no emitente não compilam
    const both: TNFe_infNFe['emit'] = { ...infNFe.emit, CPF: '00000000000' };
    // @ts-expect-error enumeração inválida não compila
    const badEnum: TNFe_infNFe['ide']['tpNF'] = '7';
    void [emit, both, badEnum];
  });
});
