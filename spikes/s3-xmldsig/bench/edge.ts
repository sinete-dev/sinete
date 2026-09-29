// Casos sintéticos de borda do C14N: assina com o signer próprio e grava em .local/edge/ para
// o xmlsec1 verificar (oráculo independente, libxml2). Se o xmlsec1 aceitar, o C14N próprio
// produziu os mesmos bytes que o libxml2 para o elemento referenciado e para o SignedInfo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { signXml, verifyDocument, webCryptoSigner } from '../src/dsig.ts';

const certDer = new Uint8Array(readFileSync('.local/cert.der'));
const signer = await webCryptoSigner(new Uint8Array(readFileSync('.local/key.pk8.der')), certDer);
const NFE = 'http://www.portalfiscal.inf.br/nfe';
const cases: Record<string, string> = {
  crlf_e_cr_literal: `<NFe xmlns="${NFE}">\r\n<infNFe Id="NFe1" versao="4.00">\r\n  <a>linha1\r\nlinha2\rfim</a>\r\n</infNFe>\r\n</NFe>`,
  charref_cr_tab_nl: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><a>x&#13;y&#xD;&#9;z</a><b at="t&#9;a&#10;b&#13;c"/></infNFe></NFe>`,
  attr_whitespace_literal: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><b at="a\tb\nc\r\nd"/></infNFe></NFe>`,
  entidades_e_acentos: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><xNome>M&amp;M Açúcar &lt;Ltda&gt; "aspas" 'apos' &quot;q&quot; &apos;a&apos; ção €</xNome><b v="&lt;&amp;&gt;&quot;'"/></infNFe></NFe>`,
  cdata_e_comentario: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><!-- comentario --><a><![CDATA[<x> & ]]]></a><?pi dado?></infNFe></NFe>`,
  ordem_atributos_prefixados: `<NFe xmlns="${NFE}" xmlns:z="urn:z" xmlns:a="urn:a"><infNFe z:k="1" versao="4.00" a:k="2" Id="NFe1" b="3"><a z:x="1" a:y="2"/></infNFe></NFe>`,
  ns_herdado_do_nfeProc_xsi: `<nfeProc xmlns="${NFE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versao="4.00"><NFe><infNFe Id="NFe1" versao="4.00"><a xsi:nil="true"/></infNFe></NFe></nfeProc>`,
  xmlns_vazio_desdeclarado: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><a xmlns=""><b/></a><c xmlns="${NFE}"/></infNFe></NFe>`,
  xml_lang_herdado: `<NFe xmlns="${NFE}" xml:lang="pt-BR"><infNFe Id="NFe1" versao="4.00"><a/></infNFe></NFe>`,
  aspas_simples_e_espacos_na_tag: `<NFe xmlns='${NFE}' ><infNFe   versao = '4.00'  Id='NFe1' ><a   /></infNFe ></NFe>`,
  vazio_selfclosing_e_texto_ws: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00">\n\t<a/>\n\t<b></b>\n</infNFe></NFe>`,
  evento_sem_xmlns_no_inf: `<envEvento xmlns="${NFE}" versao="1.00"><evento versao="1.00"><infEvento Id="ID1101111"><x>1</x></infEvento></evento></envEvento>`,
};
mkdirSync('.local/edge', { recursive: true });
for (const [name, xml] of Object.entries(cases)) {
  const id = /Id=['"]([^'"]+)/.exec(xml)![1];
  const signed = await signXml(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, id, signer);
  writeFileSync(`.local/edge/${name}.xml`, signed);
  const own = (await verifyDocument(signed)).map((r) => r.ok);
  console.log(name, 'proprio:', own.join(','));
}
