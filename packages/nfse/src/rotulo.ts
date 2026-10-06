/**
 * Rótulo em português do caminho de uma ocorrência da DPS (ADR 0011), para mostrar a quem preencheu a nota: `Tomador,
 * CNPJ` em vez de `tomador.CNPJ`. Aceita os caminhos da entrada (`DadosDps`) e os do documento montado, tanto com pontos
 * (`infDPS.toma.xNome`) quanto os do validador de XSD, com barras, a raiz `DPS` e índice a partir de um
 * (`/DPS/infDPS/valores/vDedRed/documentos/docDedRed[2]/vDedutivelRedutivel`).
 */

import type { GrupoDeCaminho } from '@sinete/core';
import { criarRotuloDoCaminho } from '@sinete/core';

const numerado =
  (prefixo: string) =>
  (n: number): string =>
    `${prefixo} ${n}`;

/** Prefixo do documento montado: com ou sem a raiz `DPS` (o validador de XSD a inclui). */
const INF = '^(?:DPS\\.)?infDPS\\.';
const inf = (resto: string): RegExp => new RegExp(INF + resto);

/** Do mais específico ao mais geral. Os índices chegam somados de um. */
const GRUPOS: readonly GrupoDeCaminho[] = [
  // Entrada (DadosDps)
  { padrao: /^dCompet\b/, rotulo: 'Data de competência' },
  { padrao: /^serie\b/, rotulo: 'Série da DPS' },
  { padrao: /^nDPS\b/, rotulo: 'Número da DPS' },
  { padrao: /^cLocEmi\b/, rotulo: 'Município emissor' },
  { padrao: /^tpEmit\b/, rotulo: 'Emitente da DPS' },
  { padrao: /^substituicao\b/, rotulo: 'Substituição' },
  { padrao: /^prestador\.regTrib\b/, rotulo: 'Regime tributário do prestador' },
  { padrao: /^prestador\.end\b/, rotulo: 'Endereço do prestador' },
  { padrao: /^prestador\b/, rotulo: 'Prestador' },
  { padrao: /^tomador\.end\b/, rotulo: 'Endereço do tomador' },
  { padrao: /^tomador\b/, rotulo: 'Tomador' },
  { padrao: /^intermediario\.end\b/, rotulo: 'Endereço do intermediário' },
  { padrao: /^intermediario\b/, rotulo: 'Intermediário' },
  { padrao: /^servico\.local\b/, rotulo: 'Local da prestação' },
  { padrao: /^servico\.comExt\b/, rotulo: 'Comércio exterior' },
  { padrao: /^servico\.obra\b/, rotulo: 'Obra' },
  { padrao: /^servico\.atvEvento\b/, rotulo: 'Evento' },
  { padrao: /^servico\.infoCompl\b/, rotulo: 'Informações complementares' },
  { padrao: /^servico\b/, rotulo: 'Serviço' },
  { padrao: /^valores\.deducaoReducao\.documentos\.docDedRed\[(\d+)\]/, rotulo: numerado('Documento de dedução') },
  { padrao: /^valores\.deducaoReducao\b/, rotulo: 'Dedução ou redução' },
  { padrao: /^valores\b/, rotulo: 'Valores' },
  { padrao: /^tributacao\.issqn\b/, rotulo: 'ISSQN' },
  { padrao: /^tributacao\.federal\b/, rotulo: 'Tributos federais' },
  { padrao: /^tributacao\.totTrib\b/, rotulo: 'Total aproximado dos tributos' },
  { padrao: /^tributacao\b/, rotulo: 'Tributação' },
  { padrao: /^ibsCbs\.classificacao\.diferimento\b/, rotulo: 'Diferimento do IBS/CBS' },
  { padrao: /^ibsCbs\.classificacao\.tributacaoRegular\b/, rotulo: 'Tributação regular do IBS/CBS' },
  { padrao: /^ibsCbs\.classificacao\b/, rotulo: 'Classificação do IBS/CBS' },
  { padrao: /^ibsCbs\.destinatario\b/, rotulo: 'Destinatário' },
  { padrao: /^ibsCbs\.imovel\b/, rotulo: 'Imóvel' },
  { padrao: /^ibsCbs\.reembolsos\.documentos\[(\d+)\]/, rotulo: numerado('Documento de reembolso') },
  { padrao: /^ibsCbs\.reembolsos\b/, rotulo: 'Reembolso, repasse ou ressarcimento' },
  { padrao: /^ibsCbs\b/, rotulo: 'IBS/CBS' },
  // Documento montado (infDPS)
  { padrao: inf('subst\\b'), rotulo: 'Substituição' },
  { padrao: inf('prest\\.regTrib\\b'), rotulo: 'Regime tributário do prestador' },
  { padrao: inf('prest\\.end\\b'), rotulo: 'Endereço do prestador' },
  { padrao: inf('prest\\b'), rotulo: 'Prestador' },
  { padrao: inf('toma\\.end\\b'), rotulo: 'Endereço do tomador' },
  { padrao: inf('toma\\b'), rotulo: 'Tomador' },
  { padrao: inf('interm\\.end\\b'), rotulo: 'Endereço do intermediário' },
  { padrao: inf('interm\\b'), rotulo: 'Intermediário' },
  { padrao: inf('serv\\.locPrest\\b'), rotulo: 'Local da prestação' },
  { padrao: inf('serv\\.comExt\\b'), rotulo: 'Comércio exterior' },
  { padrao: inf('serv\\.obra\\b'), rotulo: 'Obra' },
  { padrao: inf('serv\\.atvEvento\\b'), rotulo: 'Evento' },
  { padrao: inf('serv\\.infoCompl\\b'), rotulo: 'Informações complementares' },
  { padrao: inf('serv\\b'), rotulo: 'Serviço' },
  {
    padrao: inf('valores\\.vDedRed\\.documentos\\.docDedRed(?:\\[(\\d+)\\])?'),
    rotulo: numerado('Documento de dedução'),
  },
  { padrao: inf('valores\\.vDedRed\\b'), rotulo: 'Dedução ou redução' },
  { padrao: inf('valores\\.trib\\.tribMun\\b'), rotulo: 'ISSQN' },
  { padrao: inf('valores\\.trib\\.tribFed\\b'), rotulo: 'Tributos federais' },
  { padrao: inf('valores\\.trib\\.totTrib\\b'), rotulo: 'Total aproximado dos tributos' },
  { padrao: inf('valores\\.trib\\b'), rotulo: 'Tributação' },
  { padrao: inf('valores\\b'), rotulo: 'Valores' },
  { padrao: inf('IBSCBS\\.dest\\b'), rotulo: 'Destinatário' },
  { padrao: inf('IBSCBS\\.imovel\\b'), rotulo: 'Imóvel' },
  {
    padrao: inf('IBSCBS\\.valores\\.gReeRepRes\\.documentos(?:\\[(\\d+)\\])?'),
    rotulo: numerado('Documento de reembolso'),
  },
  { padrao: inf('IBSCBS\\.valores\\.trib\\.gIBSCBS\\.gDif\\b'), rotulo: 'Diferimento do IBS/CBS' },
  { padrao: inf('IBSCBS\\.valores\\.trib\\.gIBSCBS\\.gTribRegular\\b'), rotulo: 'Tributação regular do IBS/CBS' },
  { padrao: inf('IBSCBS\\.valores\\.trib\\b'), rotulo: 'Classificação do IBS/CBS' },
  { padrao: inf('IBSCBS\\b'), rotulo: 'IBS/CBS' },
  { padrao: inf('(?:dCompet)\\b'), rotulo: 'Data de competência' },
  { padrao: inf('serie\\b'), rotulo: 'Série da DPS' },
  { padrao: inf('nDPS\\b'), rotulo: 'Número da DPS' },
  { padrao: inf('cLocEmi\\b'), rotulo: 'Município emissor' },
  { padrao: /^(?:DPS\.)?infDPS\b/, rotulo: 'Identificação da DPS' },
];

/** Campos pelo nome do leiaute (os mesmos na entrada e no XML, quando existem nos dois). */
const CAMPOS: Readonly<Record<string, string>> = {
  CNPJ: 'CNPJ',
  CPF: 'CPF',
  NIF: 'NIF',
  cNaoNIF: 'Motivo da falta de NIF',
  CAEPF: 'CAEPF',
  IM: 'Inscrição municipal',
  xNome: 'Nome',
  fone: 'Telefone',
  email: 'E-mail',
  xLgr: 'Logradouro',
  nro: 'Número',
  xCpl: 'Complemento',
  xBairro: 'Bairro',
  cMun: 'Município',
  CEP: 'CEP',
  cPais: 'País',
  cEndPost: 'Código postal',
  xCidade: 'Cidade',
  xEstProvReg: 'Estado, província ou região',
  opSimpNac: 'Situação no Simples Nacional',
  regApTribSN: 'Regime de apuração no Simples Nacional',
  regEspTrib: 'Regime especial de tributação',
  cLocPrestacao: 'Município da prestação',
  cPaisPrestacao: 'País da prestação',
  cTribNac: 'Código de tributação nacional',
  cTribMun: 'Código de tributação municipal',
  xDescServ: 'Descrição do serviço',
  cNBS: 'Código NBS',
  cIntContrib: 'Código interno do contribuinte',
  vServ: 'Valor do serviço',
  vReceb: 'Valor recebido pelo intermediário',
  vDescIncond: 'Desconto incondicionado',
  vDescCond: 'Desconto condicionado',
  pDR: 'Percentual de dedução ou redução',
  vDR: 'Valor de dedução ou redução',
  vDedutivelRedutivel: 'Valor dedutível ou redutível',
  vDeducaoReducao: 'Valor da dedução ou redução',
  tribISSQN: 'Tributação do ISSQN',
  tpRetISSQN: 'Retenção do ISSQN',
  pAliq: 'Alíquota',
  tpImunidade: 'Tipo de imunidade',
  vTotTrib: 'Valor total dos tributos',
  pTotTrib: 'Percentual total dos tributos',
  indTotTrib: 'Indicador do total dos tributos',
  pTotTribSN: 'Percentual dos tributos no Simples Nacional',
  chSubstda: 'Chave da NFS-e substituída',
  cMotivo: 'Motivo',
  xMotivo: 'Descrição do motivo',
  CST: 'CST',
  cClassTrib: 'Classificação tributária',
  cCredPres: 'Crédito presumido',
  CSTReg: 'CST regular',
  cClassTribReg: 'Classificação tributária regular',
  pDifUF: 'Diferimento da UF',
  pDifMun: 'Diferimento do município',
  pDifCBS: 'Diferimento da CBS',
  cIndOp: 'Indicador da operação',
  indDest: 'Indicador do destinatário',
  indFinal: 'Consumidor final',
  dCompet: 'Data de competência',
  serie: 'Série da DPS',
  nDPS: 'Número da DPS',
  cLocEmi: 'Município emissor',
};

const rotular = criarRotuloDoCaminho({ grupos: GRUPOS, campos: CAMPOS, padrao: 'Dados da DPS' });

/**
 * Rótulo em português do caminho de uma ocorrência da DPS: `Grupo, Campo` quando os dois são conhecidos (`Tomador,
 * CNPJ`), só um deles quando falta o outro, e `Dados da DPS` quando nenhum é.
 */
export function rotuloDoCaminho(caminho: string): string {
  return rotular(caminho);
}
