// Fixtures sintéticas (sem dado pessoal): NF-e, NFC-e, eventos e MDF-e fictícios com os casos de borda de layout.
// CNPJs e CPFs de exemplo com dígito válido; nomes e endereços inventados. São a base das goldens do teste visual.

const LOREM =
  'LOREM IPSUM DOLOR SIT AMET CONSECTETUR ADIPISCING ELIT SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE MAGNA ALIQUA ';
const rep = (s: string, n: number): string =>
  s
    .repeat(Math.ceil(n / s.length))
    .slice(0, n)
    .trim();

export function dv(ch43: string): number {
  let s = 0;
  let w = 2;
  for (let i = ch43.length - 1; i >= 0; i--) {
    s += (ch43.charCodeAt(i) - 48) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = s % 11;
  return r < 2 ? 0 : 11 - r;
}

export const EMIT_CNPJ = '11222333000181';

export function chaveDe(mod: string, tpEmis = '1', n = 1234, cnpj: string = EMIT_CNPJ, cUF = '35'): string {
  const c43 = `${cUF}2609${cnpj}${mod}001${String(n).padStart(9, '0')}${tpEmis}12345678`;
  return c43 + dv(c43);
}

export interface NfeFx {
  readonly name: string;
  readonly items: number;
  readonly mod?: '55' | '65';
  readonly tpImp?: string;
  readonly tpEmis?: string;
  readonly tpAmb?: '1' | '2';
  readonly xProdLen?: number;
  readonly infAdProdLen?: number;
  readonly infCplLen?: number;
  readonly dups?: number;
  readonly fat?: boolean;
  readonly transp?: boolean;
  readonly text?: string;
  readonly ibscbs?: boolean;
  readonly issqn?: boolean;
  readonly st?: boolean;
  readonly locais?: boolean;
  readonly semProt?: boolean;
  /** cStat do `protNFe` (padrão 100); 110 e 301 a 303 são denegação; 101, 151 e 155, cancelamento. */
  readonly cStat?: string;
  /** `protNFe` sem `nProt`, como no retorno de uma rejeição. */
  readonly semNProt?: boolean;
  /** O caso de regressão passa o protocolo do EPEC (`EPEC`) nas opções. */
  readonly epec?: boolean;
  readonly destCpf?: boolean;
  readonly semDest?: boolean;
  readonly desconto?: boolean;
  readonly vUnComLongo?: boolean;
  readonly uTrib?: boolean;
  /** CNPJ do emitente (padrão `EMIT_CNPJ`); alfanumérico para a NT 2025.001. */
  readonly cnpj?: string;
  /** CNPJ do destinatário no lugar do padrão. */
  readonly destCnpj?: string;
}

export function nfeXml(fx: NfeFx): string {
  const mod = fx.mod ?? '55';
  const tpEmis = fx.tpEmis ?? '1';
  const cnpj = fx.cnpj ?? EMIT_CNPJ;
  const chave = chaveDe(mod, tpEmis, 1234, cnpj);
  const det = Array.from({ length: fx.items }, (_, i) => {
    const q = (i % 7) + 1;
    const vu = fx.vUnComLongo && i === 0 ? '12.3456789012' : (10 + i * 1.37).toFixed(2);
    const vp = (q * Number(vu)).toFixed(2);
    const xProd =
      fx.text && i === 0
        ? fx.text
        : `PRODUTO DE TESTE ${i + 1} ${rep(LOREM, Math.max(0, (fx.xProdLen ?? 20) - 20))}`.slice(0, fx.xProdLen ?? 40);
    const icms = fx.st
      ? `<ICMS10><orig>0</orig><CST>10</CST><modBC>3</modBC><vBC>${vp}</vBC><pICMS>18.00</pICMS><vICMS>${(Number(vp) * 0.18).toFixed(2)}</vICMS><modBCST>4</modBCST><vBCST>${(Number(vp) * 1.4).toFixed(2)}</vBCST><pICMSST>18.00</pICMSST><vICMSST>${(Number(vp) * 0.072).toFixed(2)}</vICMSST></ICMS10>`
      : mod === '65'
        ? '<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>'
        : `<ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>${vp}</vBC><pICMS>18.00</pICMS><vICMS>${(Number(vp) * 0.18).toFixed(2)}</vICMS></ICMS00>`;
    const ipi =
      mod === '55' && !fx.issqn
        ? `<IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>${vp}</vBC><pIPI>5.00</pIPI><vIPI>${(Number(vp) * 0.05).toFixed(2)}</vIPI></IPITrib></IPI>`
        : '';
    const imposto = fx.issqn
      ? `<vTotTrib>1.00</vTotTrib><ISSQN><vBC>${vp}</vBC><vAliq>5.00</vAliq><vISSQN>${(Number(vp) * 0.05).toFixed(2)}</vISSQN><cMunFG>3550308</cMunFG><cListServ>01.01</cListServ><indISS>1</indISS><indIncentivo>2</indIncentivo></ISSQN>`
      : `<vTotTrib>1.00</vTotTrib><ICMS>${icms}</ICMS>${ipi}`;
    const ibs = fx.ibscbs
      ? `<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>${vp}</vBC><gIBSUF><pIBSUF>0.10</pIBSUF><vIBSUF>${(Number(vp) * 0.001).toFixed(2)}</vIBSUF></gIBSUF><gIBSMun><pIBSMun>0.00</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>${(Number(vp) * 0.001).toFixed(2)}</vIBS><gCBS><pCBS>0.90</pCBS><vCBS>${(Number(vp) * 0.009).toFixed(2)}</vCBS></gCBS></gIBSCBS></IBSCBS>`
      : '';
    const uTrib = fx.uTrib && i === 0 ? 'CX' : 'UN';
    const qTrib = fx.uTrib && i === 0 ? '0.5000' : `${q}.0000`;
    const vUnTrib = fx.uTrib && i === 0 ? (Number(vp) / 0.5).toFixed(2) : vu;
    return `<det nItem="${i + 1}"><prod><cProd>PRD${String(i + 1).padStart(5, '0')}</cProd><cEAN>SEM GTIN</cEAN><xProd>${xProd}</xProd><NCM>84719012</NCM><CFOP>${mod === '65' ? '5102' : '5102'}</CFOP><uCom>UN</uCom><qCom>${q}.0000</qCom><vUnCom>${vu}</vUnCom><vProd>${vp}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>${uTrib}</uTrib><qTrib>${qTrib}</qTrib><vUnTrib>${vUnTrib}</vUnTrib>${fx.desconto && i === 0 ? '<vDesc>1.00</vDesc>' : ''}<indTot>1</indTot></prod><imposto>${imposto}${ibs}</imposto>${fx.infAdProdLen ? `<infAdProd>${rep(LOREM, fx.infAdProdLen)}</infAdProd>` : ''}</det>`;
  }).join('');
  const dups = Array.from(
    { length: fx.dups ?? 0 },
    (_, i) =>
      `<dup><nDup>${String(i + 1).padStart(3, '0')}</nDup><dVenc>2026-${String((i % 12) + 1).padStart(2, '0')}-15</dVenc><vDup>100.00</vDup></dup>`,
  ).join('');
  const fat = fx.fat
    ? `<fat><nFat>1234</nFat><vOrig>${(fx.dups ?? 0) * 100}.00</vOrig><vDesc>0.00</vDesc><vLiq>${(fx.dups ?? 0) * 100}.00</vLiq></fat>`
    : '';
  const transp = fx.transp
    ? '<transporta><CNPJ>99888777000166</CNPJ><xNome>TRANSPORTADORA FICTICIA LTDA</xNome><IE>123456789</IE><xEnder>RUA DOS TESTES 100</xEnder><xMun>SAO PAULO</xMun><UF>SP</UF></transporta><veicTransp><placa>ABC1D23</placa><UF>SP</UF><RNTC>12345678</RNTC></veicTransp><vol><qVol>3</qVol><esp>CAIXA</esp><marca>TESTE</marca><nVol>1-3</nVol><pesoL>12.500</pesoL><pesoB>13.250</pesoB></vol>'
    : '';
  const dest = fx.semDest
    ? ''
    : fx.destCpf
      ? '<dest><CPF>11144477735</CPF><xNome>CONSUMIDOR FICTICIO DE TESTE</xNome><enderDest><xLgr>RUA DAS AMOSTRAS</xLgr><nro>10</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01001000</CEP></enderDest><indIEDest>9</indIEDest></dest>'
      : `<dest><CNPJ>${fx.destCnpj ?? '44555666000177'}</CNPJ><xNome>CLIENTE FICTICIO COMERCIO DE PRODUTOS DE TESTE LTDA</xNome><enderDest><xLgr>RUA DO DESTINATARIO FICTICIO</xLgr><nro>200</nro><xBairro>JARDIM DAS AMOSTRAS</xBairro><cMun>3304557</cMun><xMun>RIO DE JANEIRO</xMun><UF>RJ</UF><CEP>20000000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais><fone>21999998888</fone></enderDest><indIEDest>1</indIEDest><IE>12345678</IE></dest>`;
  const locais = fx.locais
    ? '<retirada><CNPJ>99888777000166</CNPJ><xNome>DEPOSITO FICTICIO</xNome><xLgr>RUA DA RETIRADA</xLgr><nro>1</nro><xBairro>INDUSTRIAL</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>02002000</CEP></retirada><entrega><CNPJ>44555666000177</CNPJ><xNome>FILIAL FICTICIA</xNome><xLgr>AVENIDA DA ENTREGA</xLgr><nro>2</nro><xBairro>PORTO</xBairro><cMun>3304557</cMun><xMun>RIO DE JANEIRO</xMun><UF>RJ</UF><CEP>20000001</CEP></entrega>'
    : '';
  const tpAmb = fx.tpAmb ?? '1';
  const vNF = fx.desconto ? '1049.00' : '1050.00';
  const issqnTot = fx.issqn
    ? '<ISSQNtot><vServ>1000.00</vServ><vBC>1000.00</vBC><vISS>50.00</vISS><dCompet>2026-09-01</dCompet></ISSQNtot>'
    : '';
  const ibsTot = fx.ibscbs
    ? `<IBSCBSTot><vBCIBSCBS>1000.00</vBCIBSCBS><gIBS><gIBSUF><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSUF>1.00</vIBSUF></gIBSUF><gIBSMun><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>1.00</vIBS><vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gIBS><gCBS><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vCBS>9.00</vCBS><vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gCBS></IBSCBSTot><vNFTot>${fx.desconto ? '1059.00' : '1060.00'}</vNFTot>`
    : '';
  const supl =
    mod === '65' || fx.tpImp === '6'
      ? `<infNFeSupl><qrCode>https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=${chave}|3|${tpAmb}</qrCode><urlChave>https://www.nfce.fazenda.sp.gov.br/consulta</urlChave></infNFeSupl>`
      : '';
  const nfe = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${chave}" versao="4.00"><ide><cUF>35</cUF><cNF>12345678</cNF><natOp>VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS</natOp><mod>${mod}</mod><serie>1</serie><nNF>1234</nNF><dhEmi>2026-09-01T10:20:30-03:00</dhEmi>${mod === '55' ? '<dhSaiEnt>2026-09-01T11:00:00-03:00</dhSaiEnt>' : ''}<tpNF>1</tpNF><idDest>1</idDest><cMunFG>3550308</cMunFG><tpImp>${fx.tpImp ?? (mod === '65' ? '4' : '1')}</tpImp><tpEmis>${tpEmis}</tpEmis><cDV>${chave[43]}</cDV><tpAmb>${tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>${mod === '65' ? '1' : '0'}</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>sinete-fixture</verProc></ide><emit><CNPJ>${cnpj}</CNPJ><xNome>EMPRESA FICTICIA DE TESTES DO SINETE LTDA</xNome><xFant>SINETE TESTES</xFant><enderEmit><xLgr>AVENIDA DAS FIXTURES</xLgr><nro>1000</nro><xCpl>SALA 42</xCpl><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01001000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais><fone>1133334444</fone></enderEmit><IE>111222333444</IE>${fx.issqn ? '<IM>12345</IM><CNAE>6201501</CNAE>' : ''}<CRT>3</CRT></emit>${dest}${locais}${det}<total><ICMSTot><vBC>1000.00</vBC><vICMS>180.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>${fx.st ? '1400.00' : '0.00'}</vBCST><vST>${fx.st ? '72.00' : '0.00'}</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>1000.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>${fx.desconto ? '1.00' : '0.00'}</vDesc><vII>0.00</vII><vIPI>50.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${vNF}</vNF><vTotTrib>${fx.items}.00</vTotTrib></ICMSTot>${issqnTot}${ibsTot}</total><transp><modFrete>${fx.transp ? '0' : '9'}</modFrete>${transp}</transp>${dups || fat ? `<cobr>${fat}${dups}</cobr>` : ''}<pag><detPag><tPag>01</tPag><vPag>1000.00</vPag></detPag><detPag><tPag>17</tPag><vPag>${fx.desconto ? '59.00' : '60.00'}</vPag></detPag><vTroco>10.00</vTroco></pag><infAdic><infAdFisco>INFORMACAO DE INTERESSE DO FISCO DE TESTE.</infAdFisco><infCpl>${fx.infCplLen ? rep(`INFORMACAO COMPLEMENTAR DE TESTE. ${LOREM}`, fx.infCplLen) : 'DOCUMENTO EMITIDO PARA TESTES DE LEIAUTE.'}</infCpl></infAdic></infNFe>${supl}</NFe>`;
  if (fx.semProt) return `<?xml version="1.0" encoding="UTF-8"?>${nfe}`;
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfe}<protNFe versao="4.00"><infProt><tpAmb>${tpAmb}</tpAmb><verAplic>SP_NFE_PL_010</verAplic><chNFe>${chave}</chNFe><dhRecbto>2026-09-01T10:21:00-03:00</dhRecbto>${fx.semNProt ? '' : '<nProt>135260000000001</nProt>'}<digVal>AAAAAAAAAAAAAAAAAAAAAAAAAAA=</digVal><cStat>${fx.cStat ?? '100'}</cStat><xMotivo>${fx.cStat ? 'Uso Denegado' : 'Autorizado o uso da NF-e'}</xMotivo></infProt></protNFe></nfeProc>`;
}

export function eventoXml(o: {
  tpEvento: '110110' | '110111' | '110112';
  chave: string;
  correcao?: string;
  tpAmb?: string;
  cStat?: string;
}): string {
  const tpAmb = o.tpAmb ?? '1';
  const det =
    o.tpEvento === '110110'
      ? `<detEvento versao="1.00"><descEvento>Carta de Correcao</descEvento><xCorrecao>${o.correcao ?? 'CORRECAO DO ENDERECO DE ENTREGA PARA RUA DAS FIXTURES, 100.'}</xCorrecao><xCondUso>A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.</xCondUso></detEvento>`
      : o.tpEvento === '110111'
        ? '<detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>135260000000001</nProt><xJust>CANCELAMENTO DE TESTE POR ERRO DE DIGITACAO</xJust></detEvento>'
        : `<detEvento versao="1.00"><descEvento>Cancelamento por substituicao</descEvento><cOrgaoAutor>35</cOrgaoAutor><tpAutor>1</tpAutor><verAplic>1.0</verAplic><nProt>135260000000001</nProt><xJust>CANCELAMENTO DE TESTE POR SUBSTITUICAO</xJust><chNFeRef>${chaveDe('65', '1', 1235)}</chNFeRef></detEvento>`;
  const id = `ID${o.tpEvento}${o.chave}01`;
  return `<?xml version="1.0" encoding="UTF-8"?><procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><evento versao="1.00"><infEvento Id="${id}"><cOrgao>35</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${EMIT_CNPJ}</CNPJ><chNFe>${o.chave}</chNFe><dhEvento>2026-09-02T09:00:00-03:00</dhEvento><tpEvento>${o.tpEvento}</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento>${det}</infEvento></evento><retEvento versao="1.00"><infEvento><tpAmb>${tpAmb}</tpAmb><verAplic>SP_EVENTOS</verAplic><cOrgao>35</cOrgao><cStat>${o.cStat ?? '135'}</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><chNFe>${o.chave}</chNFe><tpEvento>${o.tpEvento}</tpEvento><nSeqEvento>1</nSeqEvento><dhRegEvento>2026-09-02T09:00:05-03:00</dhRegEvento><nProt>135260000000099</nProt></infEvento></retEvento></procEventoNFe>`;
}

export interface MdfeFx {
  readonly name: string;
  readonly modal?: '1' | '2' | '3' | '4';
  readonly tpEmis?: '1' | '2';
  readonly tpAmb?: '1' | '2';
  readonly docs?: number;
  readonly semProt?: boolean;
  /** cStat do `protMDFe` (padrão 100); 101 é cancelamento e 132 encerramento. */
  readonly cStat?: string;
  /** `protMDFe` sem `nProt`, como no retorno de uma rejeição. */
  readonly semNProt?: boolean;
  /** CNPJ do emitente (padrão `EMIT_CNPJ`). */
  readonly cnpj?: string;
}

export function mdfeXml(fx: MdfeFx): string {
  const modal = fx.modal ?? '1';
  const tpEmis = fx.tpEmis ?? '1';
  const c43 = `352609${fx.cnpj ?? EMIT_CNPJ}58001${String(888).padStart(9, '0')}${tpEmis}12345678`;
  const chave = c43 + dv(c43);
  const tpAmb = fx.tpAmb ?? '1';
  const nDocs = fx.docs ?? 4;
  const docs = Array.from({ length: nDocs }, (_, i) => {
    const c = `${chaveDe('57', '1', 5000 + i).slice(0, 43)}`;
    return `<infCTe><chCTe>${c}${dv(c)}</chCTe><infUnidTransp><tpUnidTransp>1</tpUnidTransp><idUnidTransp>ABC1D23</idUnidTransp><infUnidCarga><tpUnidCarga>1</tpUnidCarga><idUnidCarga>CONT0001</idUnidCarga></infUnidCarga></infUnidTransp></infCTe>`;
  }).join('');
  const infModal =
    modal === '1'
      ? '<rodo><infANTT><RNTRC>12345678</RNTRC><valePed><disp><CNPJForn>99888777000166</CNPJForn><CNPJPg>11222333000181</CNPJPg><nCompra>123456789012</nCompra><vValePed>45.00</vValePed></disp></valePed></infANTT><veicTracao><placa>ABC1D23</placa><tara>8000</tara><capKG>20000</capKG><condutor><xNome>MOTORISTA FICTICIO UM</xNome><CPF>11144477735</CPF></condutor><condutor><xNome>MOTORISTA FICTICIO DOIS</xNome><CPF>22255588846</CPF></condutor><tpRod>03</tpRod><tpCar>02</tpCar><UF>SP</UF></veicTracao><veicReboque><placa>XYZ9A87</placa><tara>5000</tara><capKG>30000</capKG><tpCar>02</tpCar><UF>SP</UF></veicReboque></rodo>'
      : modal === '2'
        ? '<aereo><nac>PR</nac><matr>ABCD</matr><nVoo>AB1234</nVoo><cAerEmb>SBSP</cAerEmb><cAerDes>SBRJ</cAerDes><dVoo>2026-09-01</dVoo></aereo>'
        : modal === '3'
          ? '<aquav><irin>ABCD1234</irin><tpEmb>01</tpEmb><cEmbar>EMB01</cEmbar><xEmbar>EMBARCACAO FICTICIA</xEmbar><nViag>123</nViag><cPrtEmb>BRSSZ</cPrtEmb><cPrtDest>BRRIO</cPrtDest></aquav>'
          : '<ferrov><trem><xPref>PREF1</xPref><dhTrem>2026-09-01T08:00:00-03:00</dhTrem><xOri>ORIGEM</xOri><xDest>DESTINO</xDest><qVag>1</qVag></trem><vag><pesoBC>10.000</pesoBC><pesoR>10.000</pesoR><serie>ABC</serie><nVag>12345678</nVag><TU>10.000</TU></vag></ferrov>';
  const mdfe = `<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe"><infMDFe versao="3.00" Id="MDFe${chave}"><ide><cUF>35</cUF><tpAmb>${tpAmb}</tpAmb><tpEmit>1</tpEmit><mod>58</mod><serie>1</serie><nMDF>888</nMDF><cMDF>12345678</cMDF><cDV>${chave[43]}</cDV><modal>${modal}</modal><dhEmi>2026-09-01T10:55:26-03:00</dhEmi><tpEmis>${tpEmis}</tpEmis><procEmi>0</procEmi><verProc>sinete-fixture</verProc><UFIni>SP</UFIni><UFFim>RJ</UFFim><infMunCarrega><cMunCarrega>3550308</cMunCarrega><xMunCarrega>SAO PAULO</xMunCarrega></infMunCarrega></ide><emit><CNPJ>${fx.cnpj ?? EMIT_CNPJ}</CNPJ><IE>111222333444</IE><xNome>EMPRESA FICTICIA DE TESTES DO SINETE LTDA</xNome><enderEmit><xLgr>AVENIDA DAS FIXTURES</xLgr><nro>1000</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><CEP>01001000</CEP><UF>SP</UF></enderEmit></emit><infModal versaoModal="3.00">${infModal}</infModal><infDoc><infMunDescarga><cMunDescarga>3304557</cMunDescarga><xMunDescarga>RIO DE JANEIRO</xMunDescarga>${docs}</infMunDescarga></infDoc><tot><qCTe>${nDocs}</qCTe><vCarga>15000.00</vCarga><cUnid>01</cUnid><qCarga>2890.0000</qCarga></tot><infAdic><infCpl>MANIFESTO SINTETICO PARA TESTES DE LEIAUTE.</infCpl></infAdic></infMDFe><infMDFeSupl><qrCodMDFe>https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${chave}&amp;tpAmb=${tpAmb}</qrCodMDFe></infMDFeSupl></MDFe>`;
  if (fx.semProt) return `<?xml version="1.0" encoding="UTF-8"?>${mdfe}`;
  return `<?xml version="1.0" encoding="UTF-8"?><mdfeProc xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">${mdfe}<protMDFe versao="3.00"><infProt><tpAmb>${tpAmb}</tpAmb><verAplic>RS20260901</verAplic><chMDFe>${chave}</chMDFe><dhRecbto>2026-09-01T10:56:03-03:00</dhRecbto>${fx.semNProt ? '' : '<nProt>935260000000001</nProt>'}<digVal>AAAAAAAAAAAAAAAAAAAAAAAAAAA=</digVal><cStat>${fx.cStat ?? '100'}</cStat><xMotivo>${fx.cStat ? 'Rejeicao' : 'Autorizado o uso do MDF-e'}</xMotivo></infProt></protMDFe></mdfeProc>`;
}

/** Casos do DANFE; cada um vira PDF, PNG golden e hash no teste de regressão. */
export const NFE_FIXTURES: readonly NfeFx[] = [
  { name: 'basica', items: 3, transp: true, dups: 3, fat: true },
  { name: 'muitos-itens', items: 64, dups: 3 },
  { name: 'textos-longos', items: 5, xProdLen: 120, infAdProdLen: 500, infCplLen: 5000 },
  { name: 'duplicatas-40', items: 2, dups: 40, fat: true },
  { name: 'homologacao', items: 1, tpAmb: '2' },
  {
    name: 'caracteres',
    items: 2,
    text: 'AÇÚCAR ÉÀÕÜ ç ñ – “aspas” € • … Ő ✓ 日本 😀 &amp; &lt;tag&gt;',
  },
  { name: 'ibscbs-st', items: 4, ibscbs: true, st: true, vUnComLongo: true, uTrib: true, desconto: true },
  { name: 'issqn-locais', items: 2, issqn: true, locais: true },
  { name: 'fsda', items: 2, tpEmis: '5', semProt: true },
  { name: 'epec', items: 2, tpEmis: '4', semProt: true, epec: true },
  { name: 'paisagem', items: 30, tpImp: '2', transp: true, dups: 10, fat: true, ibscbs: true, infCplLen: 1500 },
  { name: 'simplificado', items: 3, tpImp: '3' },
  { name: 'nfce', items: 4, mod: '65', destCpf: true, ibscbs: true, desconto: true },
  { name: 'nfce-contingencia', items: 2, mod: '65', tpEmis: '9', semProt: true, semDest: true, tpAmb: '2' },
  { name: 'tipo2', items: 3, tpImp: '6', destCpf: true, locais: true },
  // Sem valor fiscal (ADR 0006, decisão 14): prévia sem protocolo e nota denegada em cada formato.
  { name: 'previa', items: 3, semProt: true, transp: true, dups: 3, fat: true },
  { name: 'denegada', items: 3, cStat: '301', transp: true, dups: 3, fat: true },
  { name: 'previa-paisagem', items: 3, tpImp: '2', semProt: true },
  { name: 'denegada-paisagem', items: 3, tpImp: '2', cStat: '302' },
  { name: 'previa-simplificado', items: 2, tpImp: '3', semProt: true },
  { name: 'denegada-simplificado', items: 2, tpImp: '3', cStat: '303' },
  { name: 'previa-nfce', items: 2, mod: '65', semProt: true, destCpf: true },
  { name: 'denegada-nfce', items: 2, mod: '65', cStat: '110', destCpf: true },
  { name: 'previa-tipo2', items: 2, tpImp: '6', semProt: true, destCpf: true },
  { name: 'denegada-tipo2', items: 2, tpImp: '6', cStat: '302', destCpf: true },
  // Cancelada pelo cStat do protocolo, como grava quem importa a nota (ADR 0006, decisão 15).
  { name: 'cancelada-protocolo', items: 3, cStat: '101', transp: true, dups: 3, fat: true },
  { name: 'cancelada-protocolo-nfce', items: 2, mod: '65', cStat: '151', destCpf: true },
];

export const MDFE_FIXTURES: readonly MdfeFx[] = [
  { name: 'damdfe-rodo', modal: '1' },
  { name: 'damdfe-contingencia', modal: '1', tpEmis: '2', semProt: true, docs: 60 },
  { name: 'damdfe-aereo', modal: '2', tpAmb: '2' },
  { name: 'damdfe-aquav', modal: '3' },
  { name: 'damdfe-ferrov', modal: '4' },
  { name: 'damdfe-previa', modal: '1', semProt: true },
  { name: 'damdfe-cancelado', modal: '1', cStat: '101' },
];
