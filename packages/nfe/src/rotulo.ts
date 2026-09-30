/**
 * Rótulo em português do caminho de uma ocorrência da NF-e (ADR 0011), para mostrar a quem preencheu a nota: `Item 2,
 * Descrição do produto` em vez de `itens[1].produto.xProd`. Aceita os caminhos da entrada (`DadosNfe`) e os do
 * documento montado, tanto os das conferências do montador (`infNFe.det[1].prod.xProd`) quanto os do validador de XSD
 * (`/infNFe/det[2]/prod/xProd`).
 */

import type { GrupoDeCaminho } from '@sinete/core';
import { criarRotuloDoCaminho } from '@sinete/core';

const item =
  (prefixo: string) =>
  (n: number): string =>
    `${prefixo} ${n}`;

/** Do mais específico ao mais geral. Os índices chegam somados de um. */
const GRUPOS: readonly GrupoDeCaminho[] = [
  // Entrada (DadosNfe)
  { padrao: /^emitente\b/, rotulo: 'Emitente' },
  { padrao: /^destinatario\b/, rotulo: 'Destinatário' },
  { padrao: /^retirada\b/, rotulo: 'Local de retirada' },
  { padrao: /^entrega\b/, rotulo: 'Local de entrega' },
  { padrao: /^autXML\b/, rotulo: 'Autorizados a baixar o XML' },
  { padrao: /^referenciadas\b/, rotulo: 'Nota referenciada' },
  { padrao: /^itens\[(\d+)\]\.impostos\.icms\b/, rotulo: item('ICMS do item') },
  { padrao: /^itens\[(\d+)\]\.impostos\.ibsCbs\b/, rotulo: item('IBS/CBS do item') },
  { padrao: /^itens\[(\d+)\]\.impostos\b/, rotulo: item('Impostos do item') },
  { padrao: /^itens\[(\d+)\]/, rotulo: item('Item') },
  { padrao: /^itens\b/, rotulo: 'Itens' },
  { padrao: /^transporte\b/, rotulo: 'Transporte' },
  { padrao: /^cobranca\b/, rotulo: 'Cobrança' },
  { padrao: /^pagamento\b/, rotulo: 'Pagamento' },
  { padrao: /^informacoesAdicionais\b/, rotulo: 'Informações adicionais' },
  { padrao: /^agropecuario\b/, rotulo: 'Produtos agropecuários' },
  { padrao: /^respTec\b/, rotulo: 'Responsável técnico' },
  { padrao: /^contingencia\b/, rotulo: 'Contingência' },
  { padrao: /^gCompraGov\b/, rotulo: 'Compra governamental' },
  { padrao: /^exporta\b/, rotulo: 'Exportação' },
  // Opções da montagem da NFC-e (qrCode, urlQrCode, urlChave) e o infNFeSupl montado
  { padrao: /^(?:qrCode|urlQrCode|urlChave)\b/, rotulo: 'QR Code da NFC-e' },
  { padrao: /^(?:NFe\.)?infNFeSupl\b/, rotulo: 'QR Code da NFC-e' },
  // Documento montado (infNFe)
  { padrao: /^infNFe\.ide\.NFref\b/, rotulo: 'Nota referenciada' },
  { padrao: /^infNFe\.ide\b/, rotulo: 'Identificação da nota' },
  { padrao: /^infNFe\.emit\b/, rotulo: 'Emitente' },
  { padrao: /^infNFe\.dest\b/, rotulo: 'Destinatário' },
  { padrao: /^infNFe\.retirada\b/, rotulo: 'Local de retirada' },
  { padrao: /^infNFe\.entrega\b/, rotulo: 'Local de entrega' },
  { padrao: /^infNFe\.autXML\b/, rotulo: 'Autorizados a baixar o XML' },
  { padrao: /^infNFe\.det(?:\[(\d+)\])?\.imposto\.ICMS\b/, rotulo: item('ICMS do item') },
  { padrao: /^infNFe\.det(?:\[(\d+)\])?\.imposto\.IBSCBS\b/, rotulo: item('IBS/CBS do item') },
  { padrao: /^infNFe\.det(?:\[(\d+)\])?\.imposto\b/, rotulo: item('Impostos do item') },
  { padrao: /^infNFe\.det(?:\[(\d+)\])?/, rotulo: item('Item') },
  { padrao: /^infNFe\.total\b/, rotulo: 'Totais da nota' },
  { padrao: /^infNFe\.transp\b/, rotulo: 'Transporte' },
  { padrao: /^infNFe\.cobr\b/, rotulo: 'Cobrança' },
  { padrao: /^infNFe\.pag\b/, rotulo: 'Pagamento' },
  { padrao: /^infNFe\.infAdic\b/, rotulo: 'Informações adicionais' },
  { padrao: /^infNFe\.agropecuario\b/, rotulo: 'Produtos agropecuários' },
  { padrao: /^infNFe\.infRespTec\b/, rotulo: 'Responsável técnico' },
  { padrao: /^infNFe\.exporta\b/, rotulo: 'Exportação' },
];

/** Campos pelo nome do leiaute (os mesmos na entrada e no XML). */
const CAMPOS: Readonly<Record<string, string>> = {
  IE: 'Inscrição estadual',
  IEST: 'Inscrição estadual do substituto tributário',
  IM: 'Inscrição municipal',
  CNPJ: 'CNPJ',
  CPF: 'CPF',
  idEstrangeiro: 'Identificação do estrangeiro',
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
  natOp: 'Natureza da operação',
  serie: 'Série',
  nNF: 'Número da nota',
  cProd: 'Código do produto',
  cEAN: 'GTIN',
  cEANTrib: 'GTIN da unidade tributável',
  xProd: 'Descrição do produto',
  NCM: 'NCM',
  CEST: 'CEST',
  cBenef: 'Código de benefício fiscal',
  CFOP: 'CFOP',
  uCom: 'Unidade comercial',
  qCom: 'Quantidade comercial',
  vUnCom: 'Valor unitário comercial',
  uTrib: 'Unidade tributável',
  qTrib: 'Quantidade tributável',
  vUnTrib: 'Valor unitário tributável',
  vProd: 'Valor do produto',
  vDesc: 'Desconto',
  vFrete: 'Frete',
  vSeg: 'Seguro',
  vOutro: 'Outras despesas',
  CST: 'CST',
  CSOSN: 'CSOSN',
  cClassTrib: 'Classificação tributária (cClassTrib)',
  vBC: 'Base de cálculo',
  refNFe: 'Chave da NF-e referenciada',
  refNFP: 'Nota de produtor referenciada',
  AAMM: 'Mês de emissão da nota referenciada',
  modFrete: 'Modalidade do frete',
  placa: 'Placa',
  RNTC: 'RNTC',
  tPag: 'Meio de pagamento',
  vPag: 'Valor do pagamento',
  vTroco: 'Troco',
  card: 'Cartão',
  CSC: 'CSC',
  idCSC: 'Identificador do CSC',
  versao: 'Versão',
  xJust: 'Justificativa',
  dhCont: 'Entrada em contingência',
  infCpl: 'Informações complementares',
  infAdFisco: 'Informações de interesse do fisco',
};

const rotular = criarRotuloDoCaminho({ grupos: GRUPOS, campos: CAMPOS, padrao: 'Dados da NF-e' });

/**
 * Rótulo em português do caminho de uma ocorrência da NF-e: `Grupo, Campo` quando os dois são conhecidos (`Emitente,
 * Inscrição estadual`), só um deles quando falta o outro, e `Dados da NF-e` quando nenhum é.
 */
export function rotuloDoCaminho(caminho: string): string {
  return rotular(caminho);
}
