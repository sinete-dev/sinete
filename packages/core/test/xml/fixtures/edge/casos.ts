/**
 * Casos de borda sintéticos do C14N (spike S3, ADR 0003). Só dado sintético: nenhum CNPJ, nome ou valor real.
 * `gerar.ts` assina cada um e grava `<name>.xml`; `edge.test.ts` verifica os arquivos commitados.
 */
const NFE = 'http://www.portalfiscal.inf.br/nfe';

export interface EdgeCase {
  readonly name: string;
  readonly id: string;
  readonly element: string;
  readonly xml: string;
}

export const EDGE_CASES: readonly EdgeCase[] = [
  {
    name: 'crlf_e_cr_literal',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}">\r\n<infNFe Id="NFe1" versao="4.00">\r\n  <a>linha1\r\nlinha2\rfim</a>\r\n</infNFe>\r\n</NFe>`,
  },
  {
    name: 'charref_cr_tab_nl',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><a>x&#13;y&#xD;&#9;z</a><b at="t&#9;a&#10;b&#13;c"/></infNFe></NFe>`,
  },
  {
    name: 'attr_whitespace_literal',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><b at="a\tb\nc\r\nd"/></infNFe></NFe>`,
  },
  {
    name: 'entidades_e_acentos',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><xNome>M&amp;M Açúcar &lt;Ltda&gt; "aspas" 'apos' &quot;q&quot; &apos;a&apos; ção €</xNome><b v="&lt;&amp;&gt;&quot;'"/></infNFe></NFe>`,
  },
  {
    name: 'cdata_e_comentario',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><!-- comentario --><a><![CDATA[<x> & ]]]></a><?pi dado?></infNFe></NFe>`,
  },
  {
    name: 'ordem_atributos_prefixados',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}" xmlns:z="urn:z" xmlns:a="urn:a"><infNFe z:k="1" versao="4.00" a:k="2" Id="NFe1" b="3"><a z:x="1" a:y="2"/></infNFe></NFe>`,
  },
  {
    name: 'ns_herdado_do_nfeProc_xsi',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<nfeProc xmlns="${NFE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versao="4.00"><NFe><infNFe Id="NFe1" versao="4.00"><a xsi:nil="true"/></infNFe></NFe></nfeProc>`,
  },
  {
    name: 'xmlns_vazio_desdeclarado',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><a xmlns=""><b/></a><c xmlns="${NFE}"/></infNFe></NFe>`,
  },
  {
    name: 'xml_lang_herdado',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}" xml:lang="pt-BR"><infNFe Id="NFe1" versao="4.00"><a/></infNFe></NFe>`,
  },
  {
    name: 'aspas_simples_e_espacos_na_tag',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns='${NFE}' ><infNFe   versao = '4.00'  Id='NFe1' ><a   /></infNFe ></NFe>`,
  },
  {
    name: 'vazio_selfclosing_e_texto_ws',
    id: 'NFe1',
    element: 'infNFe',
    xml: `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00">\n\t<a/>\n\t<b></b>\n</infNFe></NFe>`,
  },
  {
    name: 'evento_sem_xmlns_no_inf',
    id: 'ID1101111',
    element: 'infEvento',
    xml: `<envEvento xmlns="${NFE}" versao="1.00"><evento versao="1.00"><infEvento Id="ID1101111"><x>1</x></infEvento></evento></envEvento>`,
  },
];
