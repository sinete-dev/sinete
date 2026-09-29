// Verificações do @sinete/schemas compartilhadas por Node, Bun, Deno e Chromium: a entrada principal e todos os
// subpaths gerados são importados e exercitados. Só dado sintético. Devolve a lista de falhas (vazia = ok).
import { fixedClock, isSineteError, ValidationError } from '@sinete/core';
import {
  assertValid,
  checkSimple,
  compareDecimal,
  compileXsdRegex,
  decode,
  decodeRoot,
  decodeXml,
  isComplexType,
  isElementParticle,
  isWildcard,
  maxOccurs,
  minOccurs,
  selecionarPl,
  SerializeError,
  serialize,
  serializeRoot,
  validate,
  validateRoot,
  VIGENCIAS,
  VIGENCIAS_ATUALIZADAS_EM,
  VigenciaError,
  XsdRegexError,
  xsdRegexToJs,
} from '@sinete/schemas';
import * as mdfe from '@sinete/schemas/mdfe/3.00b';
import * as cadastro from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import * as protocolo from '@sinete/schemas/nfe/consulta-protocolo/PL_010d';
import * as dist from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import * as canc from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import * as cancSubst from '@sinete/schemas/nfe/evento-cancelamento-substituicao/PL_010d';
import * as cce from '@sinete/schemas/nfe/evento-cce/PL_010d';
import * as ciencia from '@sinete/schemas/nfe/evento-ciencia-operacao/PL_010d';
import * as confirmacao from '@sinete/schemas/nfe/evento-confirmacao-operacao/PL_010d';
import * as desconhecimento from '@sinete/schemas/nfe/evento-desconhecimento-operacao/PL_010d';
import * as naoRealizada from '@sinete/schemas/nfe/evento-operacao-nao-realizada/PL_010d';
import * as inut from '@sinete/schemas/nfe/inutilizacao/PL_010d';
import * as nfe010e from '@sinete/schemas/nfe/PL_010e';
import * as nfe010f from '@sinete/schemas/nfe/PL_010f';
import * as status from '@sinete/schemas/nfe/status-servico/PL_009q';
import * as nfse0209 from '@sinete/schemas/nfse/1.01-20260209';
import * as nfse0727 from '@sinete/schemas/nfse/1.01-20260727';
import { parseXml } from '@sinete/core/xml';

const NFE = 'http://www.portalfiscal.inf.br/nfe';
const NFE_XML = '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe35260900000000000000550010000000011000000011" versao="4.00"><ide><cUF>35</cUF><cNF>00000001</cNF><natOp>VENDA DE MERCADORIA SINTETICA</natOp><mod>55</mod><serie>1</serie><nNF>1</nNF><dhEmi>2026-09-25T10:00:00-03:00</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>3550308</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>1</cDV><tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>sinete-teste</verProc></ide><emit><CNPJ>00000000000000</CNPJ><xNome>EMPRESA SINTETICA DE TESTE LTDA</xNome><enderEmit><xLgr>RUA DE TESTE</xLgr><nro>100</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01001000</CEP></enderEmit><IE>111111111111</IE><CRT>1</CRT></emit><dest><CPF>00000000000</CPF><xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome><indIEDest>9</indIEDest></dest><det nItem="1"><prod><cProd>SKU1</cProd><cEAN>SEM GTIN</cEAN><xProd>PRODUTO SINTETICO</xProd><NCM>84713012</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>10.00</vUnCom><vProd>10.00</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>UN</uTrib><qTrib>1.0000</qTrib><vUnTrib>10.00</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS><PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det><total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>10.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>10.00</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><tPag>01</tPag><vPag>10.00</vPag></detPag></pag><infAdic><infCpl>DOCUMENTO SINTETICO &amp; DE TESTE</infCpl></infAdic></infNFe></NFe>';

export function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const modules = {
    'nfe/PL_010f': [nfe010f, ['NFeElement', 'nfeProcElement', 'enviNFeElement', 'retEnviNFeElement', 'consReciNFeElement', 'retConsReciNFeElement']],
    'nfe/PL_010e': [nfe010e, ['NFeElement', 'nfeProcElement']],
    'mdfe/3.00b': [mdfe, ['mdfeProcElement', 'MDFeElement']],
    'nfe/evento-cancelamento/PL_010d': [canc, ['envEventoElement', 'retEnvEventoElement', 'procEventoNFeElement']],
    'nfe/evento-cce/PL_010d': [cce, ['envEventoElement', 'procEventoNFeElement']],
    'nfe/evento-cancelamento-substituicao/PL_010d': [cancSubst, ['envEventoElement', 'procEventoNFeElement']],
    'nfe/evento-confirmacao-operacao/PL_010d': [confirmacao, ['envEventoElement']],
    'nfe/evento-ciencia-operacao/PL_010d': [ciencia, ['envEventoElement']],
    'nfe/evento-desconhecimento-operacao/PL_010d': [desconhecimento, ['envEventoElement']],
    'nfe/evento-operacao-nao-realizada/PL_010d': [naoRealizada, ['envEventoElement']],
    'nfe/inutilizacao/PL_010d': [inut, ['inutNFeElement', 'retInutNFeElement', 'ProcInutNFeElement']],
    'nfe/consulta-protocolo/PL_010d': [protocolo, ['consSitNFeElement', 'retConsSitNFeElement']],
    'nfe/consulta-cadastro/PL_010d': [cadastro, ['ConsCadElement', 'retConsCadElement']],
    'nfe/status-servico/PL_009q': [status, ['consStatServElement', 'retConsStatServElement']],
    'nfe/dist-dfe/PL_NFeDistDFe_104': [dist, ['distDFeIntElement', 'retDistDFeIntElement', 'resNFeElement', 'resEventoElement']],
    'nfse/1.01-20260209': [nfse0209, ['DPSElement', 'NFSeElement', 'pedRegEventoElement', 'eventoElement']],
    'nfse/1.01-20260727': [nfse0727, ['DPSElement', 'NFSeElement', 'pedRegEventoElement', 'eventoElement']],
  };
  for (const [subpath, [m, roots]] of Object.entries(modules)) {
    expect(`${subpath}: schema`, m.schema.subpath === subpath && m.schema.fontes.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
    for (const r of roots) expect(`${subpath}: ${r}`, isComplexType(m[r]?.type) && typeof m[r].name === 'string');
    // Um documento vazio na raiz de cada módulo: o validador aponta o que falta sem lançar.
    const root = m[roots[0]];
    const empty = `<${root.name} xmlns="${root.ns}"/>`;
    expect(`${subpath}: validate vazio`, validateRoot(root, empty).length > 0);
    expect(`${subpath}: decode vazio`, decodeXml(root, empty).issues.length === 0);
  }

  // NFS-e: a correção documentada do TSSerieDPS (âncoras ^ e $ literais no XSD de 09/02/2026) vem no módulo.
  expect('patch do TSSerieDPS', nfse0209.schema.patches?.[0]?.tipo === 'TSSerieDPS' && nfse0727.schema.patches === undefined);

  // NF-e sintética: sem Signature, só o modelo de conteúdo do NFe falha; decode e serialize voltam ao mesmo texto.
  const nfeIssues = validateRoot(nfe010f.NFeElement, NFE_XML);
  expect('NF-e sem Signature', nfeIssues.length === 1 && nfeIssues[0].path === '/NFe' && nfeIssues[0].code === 'modelo_de_conteudo');
  const d = decodeXml(nfe010f.NFeElement, NFE_XML);
  expect('decode NF-e', d.issues.length === 0 && d.value.infNFe.emit.enderEmit.UF === 'SP');
  expect('serialize NF-e', serializeRoot(nfe010f.NFeElement, d.value) === NFE_XML);
  const inf = parseXml(NFE_XML).root.children[0];
  expect('decode elemento', decode(nfe010f.TNFe_infNFe, inf).value.ide.mod === '55');
  expect('serialize elemento', serialize(nfe010f.TNFe_infNFe, 'infNFe', d.value.infNFe, NFE).startsWith('<infNFe Id='));
  expect('validate elemento', validate(nfe010f.TNFe_infNFe, inf).length === 0);
  expect('decodeRoot', decodeRoot(nfe010e.NFeElement, parseXml(NFE_XML)).issues.length === 0);
  let verr;
  try {
    assertValid(nfe010f.NFeElement, NFE_XML);
  } catch (e) {
    verr = e;
  }
  expect('assertValid', verr instanceof ValidationError && verr.issues.length === 1);

  const st = serializeRoot(status.consStatServElement, { versao: '4.00', tpAmb: '2', cUF: '35', xServ: 'STATUS' });
  expect('status do serviço', validateRoot(status.consStatServElement, st).length === 0);
  const cons = serializeRoot(cadastro.ConsCadElement, { versao: '2.00', infCons: { xServ: 'CONS-CAD', UF: 'SP', CNPJ: '00000000000000' } });
  expect('consulta cadastro', validateRoot(cadastro.ConsCadElement, cons).length === 0);
  const rodo = { name: 'rodo', ns: 'http://www.portalfiscal.inf.br/mdfe', type: mdfe.rodo };
  expect('MDF-e rodo', validateRoot(rodo, '<rodo xmlns="http://www.portalfiscal.inf.br/mdfe"><veicTracao><placa>ZZZZZZZZZ</placa></veicTracao></rodo>').some((i) => i.code === 'padrao'));

  let serr;
  try {
    serialize(nfe010f.TNFe_infNFe, 'infNFe', { ...d.value.infNFe, ide: { ...d.value.infNFe.ide, cUF: 35 } });
  } catch (e) {
    serr = e;
  }
  expect('SerializeError', serr instanceof SerializeError && serr.path === '/infNFe/ide/cUF');

  expect('selecionarPl', selecionarPl('nfe', 'producao', fixedClock('2026-09-25T12:00:00-03:00')).modulo === 'nfe/PL_010e');
  expect('VIGENCIAS', Object.keys(VIGENCIAS).length === 17 && VIGENCIAS.nfse?.length === 2 && /^\d{4}-/.test(VIGENCIAS_ATUALIZADAS_EM));
  let vErr;
  try {
    selecionarPl('nfe', 'producao', fixedClock('2020-01-01T00:00:00Z'));
  } catch (e) {
    vErr = e;
  }
  expect('VigenciaError', vErr instanceof VigenciaError && isSineteError(vErr, 'pl_sem_vigencia'));

  expect('regex', compileXsdRegex('\\d{2}').test('12') && xsdRegexToJs('a') === '^(?:a)$');
  let rErr;
  try {
    xsdRegexToJs('\\i');
  } catch (e) {
    rErr = e;
  }
  expect('XsdRegexError', rErr instanceof XsdRegexError);
  const out = [];
  checkSimple({ b: 'decimal', fd: 2 }, '1.234', '/x', out);
  expect('checkSimple', out.length === 1 && out[0].code === 'digitos_fracionarios');
  expect('compareDecimal', compareDecimal('0.10', '.1') === 0);
  expect('particulas', isWildcard({ w: 1 }) && isElementParticle({ e: 'a', t: { b: 'string' } }) && minOccurs({ w: 1 }) === 1 && maxOccurs({ w: 1, x: -1 }) === Infinity);
  return failures;
}
