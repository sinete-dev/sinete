// Fixtures sintéticas da NFS-e Nacional (sem dado pessoal): o `NFSe` autorizado com a DPS dentro, nos dois pacotes de
// esquemas do leiaute 1.01, e os eventos registrados de cancelamento e de substituição. CNPJs e CPFs de exemplo;
// nomes e endereços inventados. São a base das goldens do DANFSe.
import { dv } from './fixtures.ts';

const LOREM =
  'LOREM IPSUM DOLOR SIT AMET CONSECTETUR ADIPISCING ELIT SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE MAGNA ALIQUA ';
export const rep = (s: string, n: number): string =>
  s
    .repeat(Math.ceil(n / s.length))
    .slice(0, n)
    .trim();

export const PREST_CNPJ = '11222333000181';
export const PREST_CNPJ_ALFA = '12ABC34501DE35';

export interface NfseFx {
  readonly name: string;
  /** Pacote de esquemas pela data da DPS: 20260209 (maio de 2026) ou 20260727 (setembro de 2026). */
  readonly leiaute: '20260209' | '20260727';
  readonly tpAmb?: '1' | '2';
  readonly cnpj?: string;
  /** Tomador por CNPJ, por CPF, no exterior (NIF) ou ausente. */
  readonly toma?: 'cnpj' | 'cpf' | 'nif';
  readonly interm?: boolean;
  /** Grupo IBSCBS: destinatário próprio tomador (`proprio`), outro destinatário (`outro`) ou sem destinatário. */
  readonly ibscbs?: 'proprio' | 'outro' | 'sem-dest';
  readonly tribISSQN?: string;
  readonly descLen?: number;
  readonly infLen?: number;
  readonly outInfLen?: number;
  /** Totais aproximados: valores, percentuais, percentual do Simples Nacional ou não informados. */
  readonly totTrib?: 'valores' | 'percentuais' | 'sn' | 'nao';
  readonly dCompet?: string;
  readonly subst?: boolean;
  readonly retPisCofins?: string;
  readonly regimeEspecial?: boolean;
}

/** Chave de acesso da NFS-e (50 posições): município, ambiente, tipo de inscrição, inscrição, número, AAMM e código. */
export function chaveNfse(cnpj: string = PREST_CNPJ, n = 1234): string {
  const c49 = `3550308${'2'}${'2'}${cnpj}${String(n).padStart(13, '0')}2609${'123456789'}`;
  return c49 + dv(c49.replace(/[A-Z]/g, '0'));
}

const end = (xLgr: string, nro: string, bairro: string, cMun: string, cep: string): string =>
  `<end><endNac><cMun>${cMun}</cMun><CEP>${cep}</CEP></endNac><xLgr>${xLgr}</xLgr><nro>${nro}</nro><xCpl>SALA 12</xCpl><xBairro>${bairro}</xBairro></end>`;

function toma(t: NfseFx['toma']): string {
  if (t === 'nif') {
    return '<toma><NIF>A1B2C3D4E5</NIF><xNome>FOREIGN SAMPLE CUSTOMER INC</xNome><end><endExt><cPais>US</cPais><cEndPost>10001</cEndPost><xCidade>NEW YORK</xCidade><xEstProvReg>NY</xEstProvReg></endExt><xLgr>FIFTH AVENUE</xLgr><nro>100</nro><xBairro>MANHATTAN</xBairro></end><email>customer@example.com</email></toma>';
  }
  const doc = t === 'cpf' ? '<CPF>12345678909</CPF>' : '<CNPJ>44555666000177</CNPJ><IM>987654</IM>';
  return `<toma>${doc}<xNome>CLIENTE FICTICIO DE SERVICOS DE TESTE LTDA</xNome>${end('RUA DO TOMADOR FICTICIO', '200', 'JARDIM DAS AMOSTRAS', '3304557', '20000000')}<fone>21999998888</fone><email>tomador@example.com</email></toma>`;
}

export function nfseXml(fx: NfseFx): string {
  const cnpj = fx.cnpj ?? (fx.leiaute === '20260727' ? PREST_CNPJ_ALFA : PREST_CNPJ);
  const chave = chaveNfse(cnpj);
  const tpAmb = fx.tpAmb ?? '1';
  const dh = fx.leiaute === '20260727' ? '2026-09-15T10:20:30-03:00' : '2026-05-10T10:20:30-03:00';
  const dCompet = fx.dCompet ?? dh.slice(0, 10);
  const tribISSQN = fx.tribISSQN ?? '1';
  const desc = fx.descLen ? rep(LOREM, fx.descLen) : 'DESENVOLVIMENTO DE SOFTWARE SOB ENCOMENDA PARA TESTES DE LEIAUTE';
  const inf = fx.infLen ? rep(LOREM, fx.infLen) : 'CONTRATO FICTICIO 123/2026';
  const outInf = fx.outInfLen ? `<xOutInf>${rep(LOREM, fx.outInfLen)}</xOutInf>` : '';
  const ibs = fx.ibscbs;
  const totTrib =
    fx.totTrib === 'percentuais'
      ? '<pTotTrib><pTotTribFed>4.65</pTotTribFed><pTotTribEst>0.00</pTotTribEst><pTotTribMun>5.00</pTotTribMun></pTotTrib>'
      : fx.totTrib === 'sn'
        ? '<pTotTribSN>6.00</pTotTribSN>'
        : fx.totTrib === 'nao'
          ? '<indTotTrib>0</indTotTrib>'
          : '<vTotTrib><vTotTribFed>46.50</vTotTribFed><vTotTribEst>0.00</vTotTribEst><vTotTribMun>50.00</vTotTribMun></vTotTrib>';
  const tribMun =
    tribISSQN === '4'
      ? '<tribMun><tribISSQN>4</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun>'
      : `<tribMun><tribISSQN>${tribISSQN}</tribISSQN>${fx.regimeEspecial ? '<exigSusp><tpSusp>1</tpSusp><nProcesso>0001234-56.2026.8.26.0100</nProcesso></exigSusp><BM><nBM>35503080100001</nBM><vRedBCBM>100.00</vRedBCBM></BM>' : ''}<tpRetISSQN>2</tpRetISSQN><pAliq>5.00</pAliq></tribMun>`;
  const dest =
    ibs === 'outro'
      ? `<dest><CNPJ>77888999000155</CNPJ><xNome>DESTINATARIO FICTICIO DA OPERACAO LTDA</xNome>${end('AVENIDA DO DESTINATARIO', '300', 'VILA TESTE', '4106902', '80000000')}<fone>41988887777</fone><email>destino@example.com</email></dest>`
      : '';
  const dpsIbs = ibs
    ? `<IBSCBS><finNFSe>0</finNFSe><indFinal>0</indFinal><cIndOp>100301</cIndOp><indDest>${ibs === 'proprio' ? '0' : '1'}</indDest>${dest}<imovel><inscImobFisc>000.111.222-3</inscImobFisc><cCIB>12345678</cCIB></imovel><valores><trib><gIBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib></gIBSCBS></trib></valores></IBSCBS>`
    : '';
  const nfseIbs = ibs
    ? '<IBSCBS><cLocalidadeIncid>3550308</cLocalidadeIncid><xLocalidadeIncid>São Paulo</xLocalidadeIncid><valores><vBC>850.00</vBC><vCalcReeRepRes>0.00</vCalcReeRepRes><uf><pIBSUF>0.10</pIBSUF><pAliqEfetUF>0.10</pAliqEfetUF></uf><mun><pIBSMun>0.00</pIBSMun><pAliqEfetMun>0.00</pAliqEfetMun></mun><fed><pCBS>0.90</pCBS><pRedAliqCBS>0.00</pRedAliqCBS><pAliqEfetCBS>0.90</pAliqEfetCBS></fed></valores><totCIBS><vTotNF>940.00</vTotNF><gIBS><vIBSTot>0.85</vIBSTot><gIBSUFTot><vIBSUF>0.85</vIBSUF></gIBSUFTot><gIBSMunTot><vIBSMun>0.00</vIBSMun></gIBSMunTot></gIBS><gCBS><vCBS>7.65</vCBS></gCBS></totCIBS></IBSCBS>'
    : '';
  const interm = fx.interm
    ? `<interm><CNPJ>22333444000166</CNPJ><IM>55555</IM><xNome>INTERMEDIARIO FICTICIO DE NEGOCIOS LTDA</xNome>${end('RUA DO INTERMEDIARIO', '50', 'CENTRO', '3106200', '30000000')}<fone>3133334444</fone></interm>`
    : '';
  const subst = fx.subst
    ? `<subst><chSubstda>${chaveNfse(cnpj, 1000)}</chSubstda><cMotivo>99</cMotivo><xMotivo>SUBSTITUICAO FICTICIA PARA TESTE</xMotivo></subst>`
    : '';
  const retPisCofins = fx.retPisCofins ?? '2';
  const infDps = `<infDPS Id="DPS355030820000000000000000000100000000000${String(1234).padStart(4, '0')}"><tpAmb>${tpAmb}</tpAmb><dhEmi>${dh}</dhEmi><verAplic>sinete-fixture</verAplic><serie>1</serie><nDPS>1234</nDPS><dCompet>${dCompet}</dCompet><tpEmit>1</tpEmit><cLocEmi>3550308</cLocEmi>${subst}<prest><CNPJ>${cnpj}</CNPJ><fone>1133334444</fone><regTrib><opSimpNac>1</opSimpNac><regEspTrib>${fx.regimeEspecial ? '6' : '0'}</regEspTrib></regTrib></prest>${fx.toma ? toma(fx.toma) : ''}${interm}<serv><locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest><cServ><cTribNac>010101</cTribNac><cTribMun>001</cTribMun><xDescServ>${desc}</xDescServ><cNBS>115021000</cNBS></cServ><obra><cObra>OBRA-0001</cObra></obra><infoCompl><docRef>PEDIDO-REF-01</docRef><xPed>PED-9</xPed><gItemPed><xItemPed>1</xItemPed><xItemPed>2</xItemPed></gItemPed><xInfComp>${inf}</xInfComp></infoCompl></serv><valores><vServPrest><vServ>1000.00</vServ></vServPrest><vDescCondIncond><vDescIncond>100.00</vDescIncond><vDescCond>10.00</vDescCond></vDescCondIncond><vDedRed><vDR>50.00</vDR></vDedRed><trib>${tribMun}<tribFed><piscofins><CST>01</CST><vBCPisCofins>850.00</vBCPisCofins><pAliqPis>0.65</pAliqPis><pAliqCofins>3.00</pAliqCofins><vPis>5.53</vPis><vCofins>25.50</vCofins><tpRetPisCofins>${retPisCofins}</tpRetPisCofins></piscofins><vRetCP>11.00</vRetCP><vRetIRRF>15.00</vRetIRRF><vRetCSLL>8.50</vRetCSLL></tribFed><totTrib>${totTrib}</totTrib></trib></valores>${dpsIbs}</infDPS>`;
  const vISSQN = tribISSQN === '4' ? '' : '<vBC>850.00</vBC><pAliqAplic>5.00</pAliqAplic><vISSQN>42.50</vISSQN>';
  return `<?xml version="1.0" encoding="UTF-8"?><NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><xLocEmi>São Paulo</xLocEmi><xLocPrestacao>São Paulo</xLocPrestacao><nNFSe>1234</nNFSe><cLocIncid>3550308</cLocIncid><xLocIncid>São Paulo</xLocIncid><xTribNac>Análise e desenvolvimento de sistemas.</xTribNac><xTribMun>Desenvolvimento de programas de computador sob encomenda (descrição municipal fictícia).</xTribMun><xNBS>Serviços de projeto e desenvolvimento de software.</xNBS><verAplic>SefinNacional_1.6.0</verAplic><ambGer>2</ambGer><tpEmis>1</tpEmis><procEmi>1</procEmi><cStat>100</cStat><dhProc>${dh.replace('10:20:30', '10:20:45')}</dhProc><nDFSe>987654</nDFSe><emit><CNPJ>${cnpj}</CNPJ><IM>1234567</IM><xNome>EMPRESA FICTICIA DE SERVICOS DO SINETE LTDA</xNome><enderNac><xLgr>AVENIDA DAS FIXTURES</xLgr><nro>1000</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><UF>SP</UF><CEP>01001000</CEP></enderNac><fone>1133334444</fone><email>contato@example.com</email></emit><valores><vCalcDR>50.00</vCalcDR>${fx.regimeEspecial ? '<tpBM>3</tpBM><vCalcBM>100.00</vCalcBM>' : ''}${vISSQN}<vTotalRet>${tribISSQN === '4' ? '34.50' : '77.00'}</vTotalRet><vLiq>${tribISSQN === '4' ? '855.50' : '813.00'}</vLiq></valores>${outInf}${nfseIbs}<DPS versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">${infDps}</DPS></infNFSe></NFSe>`;
}

/** `evento` registrado pela Sefin de um tipo (`e101101`, `e105102`...) para a chave. */
export function eventoNfseXml(tipo: string, chave: string, registrado = true): string {
  const det =
    tipo === 'e105102'
      ? `<e105102><xDesc>Cancelamento de NFS-e por Substituição</xDesc><cMotivo>99</cMotivo><xMotivo>SUBSTITUICAO FICTICIA PARA TESTE</xMotivo><chSubstituta>${chaveNfse(PREST_CNPJ, 1235)}</chSubstituta></e105102>`
      : tipo === 'e202201'
        ? '<e202201><xDesc>Confirmação do Prestador</xDesc></e202201>'
        : `<${tipo}><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>1</cMotivo><xMotivo>ERRO NA EMISSAO FICTICIO</xMotivo></${tipo}>`;
  const ped = `<pedRegEvento versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infPedReg Id="PRE${chave}${tipo.slice(1)}"><tpAmb>2</tpAmb><verAplic>sinete-fixture</verAplic><dhEvento>2026-09-16T09:00:00-03:00</dhEvento><CNPJAutor>${PREST_CNPJ}</CNPJAutor><chNFSe>${chave}</chNFSe>${det}</infPedReg></pedRegEvento>`;
  if (!registrado) return `<?xml version="1.0" encoding="UTF-8"?>${ped}`;
  return `<?xml version="1.0" encoding="UTF-8"?><evento versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infEvento Id="EVT${chave}${tipo.slice(1)}001"><verAplic>SefinNacional_1.6.0</verAplic><ambGer>2</ambGer><nSeqEvento>1</nSeqEvento><dhProc>2026-09-16T09:00:05-03:00</dhProc><nDFSe>0</nDFSe>${ped}</infEvento></evento>`;
}

export const NFSE_FIXTURES: readonly NfseFx[] = [
  // Pacote 20260209, produção, todos os blocos: tomador, intermediário, destinatário diferente e IBS/CBS.
  {
    name: 'danfse-completa',
    leiaute: '20260209',
    toma: 'cnpj',
    interm: true,
    ibscbs: 'outro',
    regimeEspecial: true,
    outInfLen: 120,
  },
  // Pacote 20260727 com CNPJ alfanumérico, produção restrita: "NFS-e SEM VALIDADE JURÍDICA" no cabeçalho, tomador
  // por CPF, destinatário é o próprio tomador e totais em percentual.
  {
    name: 'danfse-alfanumerico-homologacao',
    leiaute: '20260727',
    tpAmb: '2',
    toma: 'cpf',
    ibscbs: 'proprio',
    totTrib: 'percentuais',
    retPisCofins: '1',
  },
  // Sem tomador, intermediário nem IBS/CBS, operação não sujeita ao ISSQN, Simples Nacional e competência de 2027
  // (sem a linha de PIS e COFINS).
  {
    name: 'danfse-minima',
    leiaute: '20260727',
    tribISSQN: '4',
    totTrib: 'sn',
    dCompet: '2027-01-10',
  },
  // Tomador no exterior e textos no limite do leiaute: descrição de 2.000 caracteres, informações complementares e
  // do município de 2.000; tudo numa página, com reticências e a linha dos tributos intacta.
  {
    name: 'danfse-textos-longos',
    leiaute: '20260209',
    toma: 'nif',
    interm: true,
    ibscbs: 'outro',
    regimeEspecial: true,
    descLen: 2000,
    infLen: 2000,
    outInfLen: 2000,
    subst: true,
    totTrib: 'nao',
  },
];
