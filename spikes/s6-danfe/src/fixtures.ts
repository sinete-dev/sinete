// Fixtures sintéticas (sem dado pessoal): NF-e autorizadas fictícias com casos de borda de layout.
// Podem ir para o repo junto com as imagens golden.
const LOREM = "LOREM IPSUM DOLOR SIT AMET CONSECTETUR ADIPISCING ELIT SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE MAGNA ALIQUA ";
const rep = (s: string, n: number) => s.repeat(Math.ceil(n / s.length)).slice(0, n).trim();
function dv(ch43: string) { let s = 0, w = 2; for (let i = 42; i >= 0; i--) { s += Number(ch43[i]) * w; w = w === 9 ? 2 : w + 1; } const r = s % 11; return r < 2 ? 0 : 11 - r; }
export interface Fx { name: string; items: number; xProdLen?: number; infAdProdLen?: number; infCplLen?: number; dups?: number; tpAmb?: "1" | "2"; text?: string; transp?: boolean }
export function nfeXml(fx: Fx): string {
  const cnpj = "11222333000181";
  const c43 = `352609${cnpj}55001${String(1234).padStart(9, "0")}1${"12345678"}`;
  const chave = c43 + dv(c43);
  const det = Array.from({ length: fx.items }, (_, i) => {
    const q = (i % 7) + 1, vu = (10 + i * 1.37).toFixed(2), vp = (q * Number(vu)).toFixed(2);
    return `<det nItem="${i + 1}"><prod><cProd>PRD${String(i + 1).padStart(5, "0")}</cProd><cEAN>SEM GTIN</cEAN><xProd>${fx.text && i === 0 ? fx.text : `PRODUTO DE TESTE ${i + 1} ${rep(LOREM, Math.max(0, (fx.xProdLen ?? 20) - 20))}`.slice(0, fx.xProdLen ?? 40)}</xProd><NCM>84719012</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>${q}.0000</qCom><vUnCom>${vu}</vUnCom><vProd>${vp}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>UN</uTrib><qTrib>${q}.0000</qTrib><vUnTrib>${vu}</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>${vp}</vBC><pICMS>18.00</pICMS><vICMS>${(Number(vp) * 0.18).toFixed(2)}</vICMS></ICMS00></ICMS><IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>${vp}</vBC><pIPI>5.00</pIPI><vIPI>${(Number(vp) * 0.05).toFixed(2)}</vIPI></IPITrib></IPI></imposto>${fx.infAdProdLen ? `<infAdProd>${rep(LOREM, fx.infAdProdLen)}</infAdProd>` : ""}</det>`;
  }).join("");
  const dups = Array.from({ length: fx.dups ?? 0 }, (_, i) => `<dup><nDup>${String(i + 1).padStart(3, "0")}</nDup><dVenc>2026-${String((i % 12) + 1).padStart(2, "0")}-15</dVenc><vDup>100.00</vDup></dup>`).join("");
  const transp = fx.transp ? `<transporta><CNPJ>99888777000166</CNPJ><xNome>TRANSPORTADORA FICTICIA LTDA</xNome><IE>123456789</IE><xEnder>RUA DOS TESTES 100</xEnder><xMun>SAO PAULO</xMun><UF>SP</UF></transporta><veicTransp><placa>ABC1D23</placa><UF>SP</UF></veicTransp><vol><qVol>3</qVol><esp>CAIXA</esp><marca>TESTE</marca><pesoL>12.500</pesoL><pesoB>13.250</pesoB></vol>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${chave}" versao="4.00"><ide><cUF>35</cUF><cNF>12345678</cNF><natOp>VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS</natOp><mod>55</mod><serie>1</serie><nNF>1234</nNF><dhEmi>2026-09-01T10:20:30-03:00</dhEmi><dhSaiEnt>2026-09-01T11:00:00-03:00</dhSaiEnt><tpNF>1</tpNF><idDest>1</idDest><cMunFG>3550308</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${chave[43]}</cDV><tpAmb>${fx.tpAmb ?? "1"}</tpAmb><finNFe>1</finNFe><indFinal>0</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>sinete-fixture</verProc></ide><emit><CNPJ>${cnpj}</CNPJ><xNome>EMPRESA FICTICIA DE TESTES DO SINETE LTDA</xNome><xFant>SINETE TESTES</xFant><enderEmit><xLgr>AVENIDA DAS FIXTURES</xLgr><nro>1000</nro><xCpl>SALA 42</xCpl><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01001000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais><fone>1133334444</fone></enderEmit><IE>111222333444</IE><CRT>3</CRT></emit><dest><CNPJ>44555666000177</CNPJ><xNome>CLIENTE FICTICIO COMERCIO DE PRODUTOS DE TESTE LTDA</xNome><enderDest><xLgr>RUA DO DESTINATARIO FICTICIO</xLgr><nro>200</nro><xBairro>JARDIM DAS AMOSTRAS</xBairro><cMun>3304557</cMun><xMun>RIO DE JANEIRO</xMun><UF>RJ</UF><CEP>20000000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais><fone>21999998888</fone></enderDest><indIEDest>1</indIEDest><IE>12345678</IE></dest>${det}<total><ICMSTot><vBC>1000.00</vBC><vICMS>180.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>1000.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>50.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>1050.00</vNF></ICMSTot></total><transp><modFrete>${fx.transp ? "0" : "9"}</modFrete>${transp}</transp>${dups ? `<cobr><fat><nFat>1234</nFat><vOrig>${(fx.dups ?? 0) * 100}.00</vOrig><vLiq>${(fx.dups ?? 0) * 100}.00</vLiq></fat>${dups}</cobr>` : ""}<pag><detPag><tPag>01</tPag><vPag>1050.00</vPag></detPag></pag><infAdic><infCpl>${fx.infCplLen ? rep("INFORMACAO COMPLEMENTAR DE TESTE. " + LOREM, fx.infCplLen) : "DOCUMENTO EMITIDO PARA TESTES DE LEIAUTE."}</infCpl></infAdic></infNFe></NFe><protNFe versao="4.00"><infProt><tpAmb>${fx.tpAmb ?? "1"}</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><chNFe>${chave}</chNFe><dhRecbto>2026-09-01T10:21:00-03:00</dhRecbto><nProt>135260000000001</nProt><digVal>AAAAAAAAAAAAAAAAAAAAAAAAAAA=</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;
}
export const FIXTURES: Fx[] = [
  { name: "basica", items: 3, transp: true },
  { name: "muitos-itens", items: 64, dups: 3 },
  { name: "textos-longos", items: 5, xProdLen: 120, infAdProdLen: 500, infCplLen: 5000 },
  { name: "duplicatas-40", items: 2, dups: 40 },
  { name: "homologacao", items: 1, tpAmb: "2" },
  { name: "caracteres", items: 2, text: "AÇÚCAR ÉÀÕÜ ç ñ – “aspas” € • … Ő ✓ 日本 😀 &amp; &lt;tag&gt;" },
];
if (import.meta.main) {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("fixtures", { recursive: true });
  for (const fx of FIXTURES) writeFileSync(`fixtures/${fx.name}.xml`, nfeXml(fx));
  console.log(FIXTURES.length, "fixtures");
}
