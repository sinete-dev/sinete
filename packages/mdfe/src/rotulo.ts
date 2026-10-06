/**
 * Rótulo em português do caminho de uma ocorrência do MDF-e (ADR 0011), para mostrar a quem preencheu o manifesto:
 * `Condutor 1, CPF` em vez de `rodoviario.tracao.condutores[0].CPF`. Aceita os caminhos da entrada (`DadosMdfe`) e os do
 * documento montado, tanto os das conferências do montador (`infMDFe.emit.xNome`) quanto os do validador de XSD
 * (`/infMDFe/infDoc/infMunDescarga[2]/xMunDescarga`).
 */

import type { GrupoDeCaminho } from '@sinete/core';
import { criarRotuloDoCaminho } from '@sinete/core';

const numerado =
  (prefixo: string) =>
  (n: number): string =>
    `${prefixo} ${n}`;

/** Do mais específico ao mais geral. Os índices chegam somados de um. */
const GRUPOS: readonly GrupoDeCaminho[] = [
  // Entrada (DadosMdfe)
  { padrao: /^emitente\b/, rotulo: 'Emitente' },
  { padrao: /^tpEmit\b/, rotulo: 'Tipo do emitente' },
  { padrao: /^tpTransp\b/, rotulo: 'Tipo do transportador' },
  { padrao: /^serie\b/, rotulo: 'Série' },
  { padrao: /^nMDF\b/, rotulo: 'Número do MDF-e' },
  { padrao: /^ufIni\b/, rotulo: 'UF de início' },
  { padrao: /^ufFim\b/, rotulo: 'UF de fim' },
  { padrao: /^carregamento\b/, rotulo: 'Município de carregamento' },
  { padrao: /^percurso\b/, rotulo: 'Percurso' },
  { padrao: /^dhIniViagem\b/, rotulo: 'Início da viagem' },
  { padrao: /^indCarregaPosterior\b/, rotulo: 'Carregamento posterior' },
  {
    padrao: /^descarregamentos\[(\d+)\]\.(?:nfe|cte)\[(\d+)\]/,
    rotulo: (d: number, n: number): string => `Documento ${n} do descarregamento ${d}`,
  },
  { padrao: /^descarregamentos\[(\d+)\]/, rotulo: numerado('Descarregamento') },
  { padrao: /^descarregamentos\b/, rotulo: 'Documentos' },
  { padrao: /^rodoviario\.tracao\.condutores\[(\d+)\]/, rotulo: numerado('Condutor') },
  { padrao: /^rodoviario\.tracao\.condutores\b/, rotulo: 'Condutores' },
  { padrao: /^rodoviario\.tracao\.proprietario\b/, rotulo: 'Proprietário do veículo de tração' },
  { padrao: /^rodoviario\.tracao\b/, rotulo: 'Veículo de tração' },
  { padrao: /^rodoviario\.reboques\[(\d+)\]\.proprietario\b/, rotulo: numerado('Proprietário do reboque') },
  { padrao: /^rodoviario\.reboques\[(\d+)\]/, rotulo: numerado('Reboque') },
  { padrao: /^rodoviario\.reboques\b/, rotulo: 'Reboques' },
  { padrao: /^rodoviario\.ciot\b/, rotulo: 'CIOT' },
  { padrao: /^rodoviario\.valePedagio\.dispositivos\[(\d+)\]/, rotulo: numerado('Vale-pedágio') },
  { padrao: /^rodoviario\.valePedagio\b/, rotulo: 'Vale-pedágio' },
  { padrao: /^rodoviario\.contratantes\b/, rotulo: 'Contratante' },
  { padrao: /^rodoviario\.pagamentos\b/, rotulo: 'Pagamento do frete' },
  { padrao: /^rodoviario\b/, rotulo: 'Transporte rodoviário' },
  { padrao: /^aereo\b/, rotulo: 'Transporte aéreo' },
  { padrao: /^seguros\b/, rotulo: 'Seguro da carga' },
  { padrao: /^produtoPredominante\b/, rotulo: 'Produto predominante' },
  { padrao: /^totais\b/, rotulo: 'Totais da carga' },
  { padrao: /^lacres\b/, rotulo: 'Lacres' },
  { padrao: /^autXML\b/, rotulo: 'Autorizados a baixar o XML' },
  { padrao: /^informacoesAdicionais\b/, rotulo: 'Informações adicionais' },
  { padrao: /^respTec\b/, rotulo: 'Responsável técnico' },
  // Documento montado (infMDFe)
  { padrao: /^infMDFe\.ide\.infMunCarrega\b/, rotulo: 'Município de carregamento' },
  { padrao: /^infMDFe\.ide\.infPercurso\b/, rotulo: 'Percurso' },
  { padrao: /^infMDFe\.ide\b/, rotulo: 'Identificação do MDF-e' },
  { padrao: /^infMDFe\.emit\b/, rotulo: 'Emitente' },
  {
    padrao: /^infMDFe\.infDoc\.infMunDescarga(?:\[(\d+)\])?\.(?:infNFe|infCTe|infMDFeTransp)(?:\[(\d+)\])?/,
    rotulo: (d: number, n: number): string => `Documento ${n} do descarregamento ${d}`,
  },
  { padrao: /^infMDFe\.infDoc\.infMunDescarga(?:\[(\d+)\])?/, rotulo: numerado('Descarregamento') },
  { padrao: /^infMDFe\.infDoc\b/, rotulo: 'Documentos' },
  { padrao: /^infMDFe\.infModal\.rodo\.veicTracao\.condutor(?:\[(\d+)\])?/, rotulo: numerado('Condutor') },
  { padrao: /^infMDFe\.infModal\.rodo\.veicTracao\.prop\b/, rotulo: 'Proprietário do veículo de tração' },
  { padrao: /^infMDFe\.infModal\.rodo\.veicTracao\b/, rotulo: 'Veículo de tração' },
  {
    padrao: /^infMDFe\.infModal\.rodo\.veicReboque(?:\[(\d+)\])?\.prop\b/,
    rotulo: numerado('Proprietário do reboque'),
  },
  { padrao: /^infMDFe\.infModal\.rodo\.veicReboque(?:\[(\d+)\])?/, rotulo: numerado('Reboque') },
  { padrao: /^infMDFe\.infModal\.rodo\.infANTT\.infCIOT\b/, rotulo: 'CIOT' },
  { padrao: /^infMDFe\.infModal\.rodo\.infANTT\.valePed\b/, rotulo: 'Vale-pedágio' },
  { padrao: /^infMDFe\.infModal\.rodo\.infANTT\.infContratante\b/, rotulo: 'Contratante' },
  { padrao: /^infMDFe\.infModal\.rodo\.infANTT\.infPag\b/, rotulo: 'Pagamento do frete' },
  { padrao: /^infMDFe\.infModal\.aereo\b/, rotulo: 'Transporte aéreo' },
  { padrao: /^infMDFe\.infModal\.rodo\b/, rotulo: 'Transporte rodoviário' },
  { padrao: /^infMDFe\.infModal\b/, rotulo: 'Modal' },
  { padrao: /^infMDFe\.seg\b/, rotulo: 'Seguro da carga' },
  { padrao: /^infMDFe\.prodPred\b/, rotulo: 'Produto predominante' },
  { padrao: /^infMDFe\.tot\b/, rotulo: 'Totais da carga' },
  { padrao: /^infMDFe\.lacres\b/, rotulo: 'Lacres' },
  { padrao: /^infMDFe\.autXML\b/, rotulo: 'Autorizados a baixar o XML' },
  { padrao: /^infMDFe\.infAdic\b/, rotulo: 'Informações adicionais' },
  { padrao: /^infMDFe\.infRespTec\b/, rotulo: 'Responsável técnico' },
];

/** Campos pelo nome do leiaute (os mesmos na entrada e no XML, quando existem nos dois). */
const CAMPOS: Readonly<Record<string, string>> = {
  IE: 'Inscrição estadual',
  CNPJ: 'CNPJ',
  CPF: 'CPF',
  xNome: 'Nome',
  xFant: 'Nome fantasia',
  xLgr: 'Logradouro',
  nro: 'Número',
  xCpl: 'Complemento',
  xBairro: 'Bairro',
  cMun: 'Município',
  xMun: 'Município',
  UF: 'UF',
  CEP: 'CEP',
  fone: 'Telefone',
  email: 'E-mail',
  placa: 'Placa',
  RNTRC: 'RNTRC',
  RENAVAM: 'RENAVAM',
  tara: 'Tara',
  capKG: 'Capacidade (kg)',
  capM3: 'Capacidade (m³)',
  tpRod: 'Tipo de rodado',
  tpCar: 'Tipo de carroceria',
  chave: 'Chave de acesso',
  chNFe: 'Chave de acesso',
  chCTe: 'Chave de acesso',
  CIOT: 'CIOT',
  CNPJForn: 'CNPJ da fornecedora',
  tpValePed: 'Tipo',
  tpProp: 'Tipo de proprietário',
  xProd: 'Descrição do produto',
  NCM: 'NCM',
  tpCarga: 'Tipo de carga',
  nApol: 'Número da apólice',
  nAver: 'Número da averbação',
  xSeg: 'Seguradora',
  vCarga: 'Valor da carga',
  qCarga: 'Quantidade da carga',
  nLacre: 'Lacre',
  infCpl: 'Informações complementares',
  nac: 'Nacionalidade da aeronave',
  matr: 'Matrícula da aeronave',
  nVoo: 'Número do voo',
  cAerEmb: 'Aeródromo de embarque',
  cAerDes: 'Aeródromo de destino',
  dVoo: 'Data do voo',
  entregaParcial: 'Entrega parcial',
  infEntregaParcial: 'Entrega parcial',
  qtdTotal: 'Quantidade total de volumes',
  qtdParcial: 'Quantidade de volumes neste MDF-e',
};

const rotular = criarRotuloDoCaminho({ grupos: GRUPOS, campos: CAMPOS, padrao: 'Dados do MDF-e' });

/**
 * Rótulo em português do caminho de uma ocorrência do MDF-e: `Grupo, Campo` quando os dois são conhecidos (`Condutor 1,
 * CPF`), só um deles quando falta o outro, e `Dados do MDF-e` quando nenhum é.
 */
export function rotuloDoCaminho(caminho: string): string {
  return rotular(caminho);
}
