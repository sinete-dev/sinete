/**
 * Modelo de entrada do MDF-e (modelo 58, leiaute 3.00b), modais rodoviário, aéreo, aquaviário e ferroviário: o que quem emite descreve. O builder
 * (`montarMdfe`) transforma isto no objeto tipado do `@sinete/schemas` (`mdfe/3.00b`), deriva o que o leiaute permite
 * derivar (quantidades de documentos, número das parcelas, valor do contrato) e confere as regras do MOC antes de
 * serializar.
 *
 * Convenções:
 * - Nomes de campo do leiaute (MOC) onde eles existem (`xNome`, `placa`, `tpCar`, `vCarga`); nomes em português para os
 *   agrupamentos que o leiaute não nomeia ou nomeia por sigla (`emitente`, `carregamento`, `descarregamentos`,
 *   `rodoviario`, `aereo`, `aquaviario`, `ferroviario`, `produtoPredominante`).
 * - Números entram como `DecimalInput` (`'12.34'`, `12.34`, `12n` ou `Decimal`). Prefira texto.
 * - Documentos (CNPJ, CPF, CEP, telefone) aceitam máscara; o builder normaliza.
 * - Códigos do leiaute ficam como uniões de literais (`tpEmit: '2'`), com constantes nomeadas onde ajudam
 *   (`TipoEmitente`, `TipoCarga`).
 *
 * Os dois usos que guiaram o modelo: o produtor rural ou a empresa que transporta a própria carga em veículo próprio
 * (`tpEmit` 2, sem `tpTransp`, com as NF-e que acobertam a carga) e o transportador que presta o serviço (`tpEmit` 1,
 * com CT-e, seguro, CIOT, contratante e pagamento do frete).
 */

import type { Uf } from '@sinete/core';
import type { TUnidadeTransp } from '@sinete/schemas/mdfe/3.00b';
import type { DecimalInput } from './decimal.ts';
import type { UfMdfe } from './percurso.ts';
import type { Instante } from './time.ts';

// ---------------------------------------------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------------------------------------------

/**
 * Tipo do emitente (`tpEmit`): 1 prestador de serviço de transporte (com CT-e); 2 transportador de carga própria (com
 * NF-e; também o prestador que emite CT-e globalizado quando a operação é interna, por regra própria da UF); 3 prestador
 * que emitirá CT-e globalizado.
 */
export const TipoEmitente = {
  PRESTADOR_SERVICO: '1',
  CARGA_PROPRIA: '2',
  CTE_GLOBALIZADO: '3',
} as const;
export type TipoEmitente = (typeof TipoEmitente)[keyof typeof TipoEmitente];

/** Tipo do transportador (`tpTransp`): 1 ETC (empresa); 2 TAC (autônomo); 3 CTC (cooperativa). */
export type TipoTransportador = '1' | '2' | '3';

/** Tipo de carga do produto predominante (`tpCarga`), com o 12 da NT 2025.001. */
export const TipoCarga = {
  GRANEL_SOLIDO: '01',
  GRANEL_LIQUIDO: '02',
  FRIGORIFICADA: '03',
  CONTEINERIZADA: '04',
  CARGA_GERAL: '05',
  NEOGRANEL: '06',
  PERIGOSA_GRANEL_SOLIDO: '07',
  PERIGOSA_GRANEL_LIQUIDO: '08',
  PERIGOSA_FRIGORIFICADA: '09',
  PERIGOSA_CONTEINERIZADA: '10',
  PERIGOSA_CARGA_GERAL: '11',
  GRANEL_PRESSURIZADA: '12',
} as const;
export type TipoCarga = (typeof TipoCarga)[keyof typeof TipoCarga];

/** Tipo de rodado (`tpRod`): 01 truck; 02 toco; 03 cavalo mecânico; 04 VAN; 05 utilitário; 06 outros. */
export type TipoRodado = '01' | '02' | '03' | '04' | '05' | '06';

/** Tipo de carroceria (`tpCar`): 00 não aplicável; 01 aberta; 02 fechada/baú; 03 granelera; 04 porta container; 05 sider. */
export type TipoCarroceria = '00' | '01' | '02' | '03' | '04' | '05';

// ---------------------------------------------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------------------------------------------

/** CNPJ (numérico ou alfanumérico) ou CPF, exclusivos. */
export type DocumentoPessoa =
  | { readonly CNPJ: string; readonly CPF?: never }
  | { readonly CPF: string; readonly CNPJ?: never };

/** CNPJ, CPF ou identificação de estrangeiro (contratante, responsável pelo pagamento). */
export type DocumentoContratante =
  | DocumentoPessoa
  | { readonly idEstrangeiro: string; readonly CNPJ?: never; readonly CPF?: never };

/** Endereço do emitente (`TEndeEmi`). */
export interface EnderecoEmitente {
  readonly xLgr: string;
  readonly nro: string;
  readonly xCpl?: string;
  readonly xBairro: string;
  /** Código IBGE do município, 7 dígitos. */
  readonly cMun: string;
  readonly xMun: string;
  readonly CEP?: string;
  readonly UF: Uf;
  readonly fone?: string;
  readonly email?: string;
}

/**
 * Emitente (grupo `emit`). Pessoa física (produtor rural) emite com CPF, só como carga própria (`tpEmit` 2) e nas
 * séries 920 a 969 (Anexo I, F70 e F71).
 */
export type Emitente = DocumentoPessoa & {
  /** Inscrição estadual, obrigatória fora do regime especial da NFF (F72, 229). */
  readonly IE: string;
  readonly xNome: string;
  readonly xFant?: string;
  readonly endereco: EnderecoEmitente;
};

// ---------------------------------------------------------------------------------------------------------------
// Modal rodoviário
// ---------------------------------------------------------------------------------------------------------------

/** Proprietário ou possuidor do veículo quando não é o emitente (`prop`). */
export type Proprietario = DocumentoPessoa & {
  readonly RNTRC: string;
  readonly xNome: string;
  /** IE e UF vão juntas. */
  readonly IE?: string;
  readonly UF?: UfMdfe;
  /** 0 TAC agregado; 1 TAC independente; 2 outros. */
  readonly tpProp: '0' | '1' | '2';
};

export interface Condutor {
  readonly xNome: string;
  readonly CPF: string;
}

/** Veículo de tração (`veicTracao`). */
export interface VeiculoTracao {
  readonly cInt?: string;
  readonly placa: string;
  readonly RENAVAM?: string;
  /** Tara em kg (inteiro). */
  readonly tara: number | string;
  readonly capKG?: number | string;
  readonly capM3?: number | string;
  /** Proprietário, quando o veículo não é do emitente. */
  readonly proprietario?: Proprietario;
  /** 1 a 10 condutores; o primeiro é o principal. */
  readonly condutores: readonly Condutor[];
  readonly tpRod: TipoRodado;
  readonly tpCar: TipoCarroceria;
  /** UF de licenciamento. */
  readonly UF?: UfMdfe;
}

/** Veículo reboque (`veicReboque`, até 3). */
export interface VeiculoReboque {
  readonly cInt?: string;
  readonly placa: string;
  readonly RENAVAM?: string;
  readonly tara: number | string;
  readonly capKG: number | string;
  readonly capM3?: number | string;
  readonly proprietario?: Proprietario;
  readonly tpCar: TipoCarroceria;
  readonly UF?: UfMdfe;
}

/** CIOT (`infCIOT`): código e o CPF ou CNPJ do responsável pela geração. O código é opcional desde a NT 2025.001. */
export type Ciot = DocumentoPessoa & { readonly CIOT?: string };

/** Dispositivo de vale-pedágio (`valePed/disp`). */
export interface DispositivoValePedagio {
  /** CNPJ da fornecedora do vale-pedágio. */
  readonly CNPJForn: string;
  /** Responsável pelo pagamento, quando não é o emitente. */
  readonly responsavel?: DocumentoPessoa;
  /** Identificador do vale-pedágio obrigatório (IDVPO, NT 2025.001). */
  readonly nCompra?: string;
  readonly vValePed: DecimalInput;
  /** 01 TAG; 04 leitura de placa. */
  readonly tpValePed?: '01' | '04';
}

export interface ValePedagio {
  readonly dispositivos: readonly DispositivoValePedagio[];
  /** Categoria de combinação veicular, obrigatória com vale-pedágio (F95, 731). */
  readonly categCombVeic?: '02' | '04' | '06' | '07' | '08' | '10' | '11' | '12' | '13' | '14';
}

export type Contratante = DocumentoContratante & {
  readonly xNome?: string;
  readonly contrato?: { readonly NroContrato: string; readonly vContratoGlobal: DecimalInput };
};

/** Componente do pagamento: 01 vale-pedágio; 02 impostos; 03 despesas; 04 frete; 99 outros. */
export interface ComponentePagamento {
  readonly tpComp: '01' | '02' | '03' | '04' | '99';
  readonly vComp: DecimalInput;
  readonly xComp?: string;
}

export interface ParcelaPagamento {
  /** Data de vencimento `AAAA-MM-DD`. */
  readonly dVenc: string;
  readonly vParcela: DecimalInput;
}

/** Dados bancários do pagamento (`infBanc`): banco e agência, instituição de pagamento eletrônico ou PIX. */
export type DadosBancarios =
  | { readonly codBanco: string; readonly codAgencia: string }
  | { readonly CNPJIPEF: string }
  | { readonly PIX: string };

/**
 * Pagamento do frete (`infPag`). `nParcela` sai da ordem das parcelas (001, 002...); `vContrato` omitido é a soma
 * dos componentes, informado é conferido contra ela com tolerância de R$ 0,01 (F58, 746).
 */
export type PagamentoFrete = DocumentoContratante & {
  readonly xNome?: string;
  readonly componentes: readonly ComponentePagamento[];
  readonly vContrato?: DecimalInput;
  readonly indAltoDesemp?: true;
  /** 0 à vista; 1 a prazo. */
  readonly indPag: '0' | '1';
  readonly vAdiant?: DecimalInput;
  readonly indAntecipaAdiant?: true;
  readonly parcelas?: readonly ParcelaPagamento[];
  /** 0 não permite antecipar; 1 permite; 2 permite condicionado. */
  readonly tpAntecip?: '0' | '1' | '2';
  readonly banco: DadosBancarios;
};

/** Grupo do modal rodoviário (`rodo`). */
export interface Rodoviario {
  /** RNTRC do emitente (8 dígitos). */
  readonly RNTRC?: string;
  readonly ciot?: readonly Ciot[];
  readonly valePedagio?: ValePedagio;
  readonly contratantes?: readonly Contratante[];
  readonly pagamentos?: readonly PagamentoFrete[];
  readonly tracao: VeiculoTracao;
  readonly reboques?: readonly VeiculoReboque[];
  readonly codAgPorto?: string;
  readonly lacres?: readonly string[];
}

// ---------------------------------------------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------------------------------------------

/** Produto perigoso transportado (`peri`). */
export interface ProdutoPerigoso {
  /** Número ONU (4 dígitos) ou `ND`. */
  readonly nONU: string;
  readonly xNomeAE?: string;
  readonly xClaRisco?: string;
  readonly grEmb?: string;
  /** Quantidade total por produto, com a unidade (texto livre do leiaute, até 20 posições). */
  readonly qTotProd: string;
  readonly qVolTipo?: string;
}

interface DocumentoTransportado {
  /** Chave de acesso de 44 posições. */
  readonly chave: string;
  /** Segundo código de barras (36 dígitos), só para documento emitido em contingência FS-DA. */
  readonly segCodBarra?: string;
  readonly indReentrega?: true;
  readonly perigosos?: readonly ProdutoPerigoso[];
}

export type NfeTransportada = DocumentoTransportado;

/** CT-e transportado; a entrega parcial (corte de voo) só vale no modal aéreo (F34, 702). */
export interface CteTransportado extends DocumentoTransportado {
  /** Entrega parcial (`infEntregaParcial`): quantidade total de volumes e a enviada neste MDF-e (4 casas). */
  readonly entregaParcial?: { readonly qtdTotal: DecimalInput; readonly qtdParcial: DecimalInput };
}

/**
 * MDF-e transportado (`infMDFeTransp`): outro manifesto levado pela embarcação, só no modal aquaviário e só com
 * carregamento ou descarregamento em AM ou AP (F43, 647; F44, 648). A chave é de MDF-e (modelo 58, F45, 649).
 */
export interface MdfeTransportado {
  /** Chave de acesso de 44 posições do MDF-e transportado. */
  readonly chave: string;
  readonly indReentrega?: true;
  /** Unidades de transporte (`infUnidTransp`), no tipo do leiaute. */
  readonly unidadesTransporte?: readonly TUnidadeTransp[];
  readonly perigosos?: readonly ProdutoPerigoso[];
}

/** Município de descarregamento com os documentos que descarregam nele (`infMunDescarga`). */
export interface Descarregamento {
  readonly cMun: string;
  readonly xMun: string;
  readonly nfe?: readonly NfeTransportada[];
  readonly cte?: readonly CteTransportado[];
}

/** Município de descarregamento do modal aquaviário, que também pode levar MDF-e transportado. */
export interface DescarregamentoAquaviario extends Descarregamento {
  readonly mdfe?: readonly MdfeTransportado[];
}

export interface MunicipioCarregamento {
  readonly cMun: string;
  readonly xMun: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Seguro, produto predominante e totais
// ---------------------------------------------------------------------------------------------------------------

/** Seguro da carga (`seg`). `respSeg` 1 emitente; 2 contratante (com o CNPJ ou CPF dele). */
export interface Seguro {
  readonly responsavel: { readonly respSeg: '1' | '2' } & Partial<DocumentoPessoa>;
  readonly seguradora?: { readonly xSeg: string; readonly CNPJ: string };
  readonly nApol?: string;
  readonly nAver?: readonly string[];
}

/** Local de carregamento ou descarregamento da carga lotação: CEP ou coordenadas (6 casas). */
export type LocalLotacao = { readonly CEP: string } | { readonly latitude: string; readonly longitude: string };

/**
 * Produto predominante (`prodPred`): o de maior valor. Na carga lotação (um único DF-e), `lotacao` leva os locais de
 * carregamento e descarregamento (grupo `infLotacao`, dentro de `prodPred`).
 */
export interface ProdutoPredominante {
  readonly tpCarga: TipoCarga;
  readonly xProd: string;
  readonly cEAN?: string;
  /** NCM com 2 ou 8 dígitos; obrigatório na carga lotação da prestação de serviço (NT 2025.001, F55a). */
  readonly NCM?: string;
  readonly lotacao?: { readonly carregamento: LocalLotacao; readonly descarregamento: LocalLotacao };
}

/** Totais da carga. `qNFe` e `qCTe` saem dos documentos. */
export interface TotaisCarga {
  /** Valor total da carga. */
  readonly vCarga: DecimalInput;
  /** Unidade do peso bruto: 01 kg; 02 tonelada. */
  readonly cUnid: '01' | '02';
  /** Peso bruto total (4 casas). */
  readonly qCarga: DecimalInput;
}

/** Responsável técnico (`infRespTec`). */
export interface ResponsavelTecnico {
  readonly CNPJ: string;
  readonly xContato: string;
  readonly email: string;
  readonly fone: string;
  readonly csrt?: { readonly idCSRT: string; readonly hashCSRT: string };
}

/** Grupo do modal aéreo (`aereo`, MOC 3.00b Anexo I, 3.2). */
export interface Aereo {
  /** Marca da nacionalidade da aeronave (1 a 4 posições). */
  readonly nac: string;
  /** Marca de matrícula da aeronave (1 a 6 posições). */
  readonly matr: string;
  /** Número do voo, no formato AB1234 (5 a 9 posições). */
  readonly nVoo: string;
  /** Aeródromo de embarque: código IATA de três letras ou, sem ele, a sigla OACI. */
  readonly cAerEmb: string;
  /** Aeródromo de destino: código IATA de três letras ou, sem ele, a sigla OACI. */
  readonly cAerDes: string;
  /** Data do voo (`AAAA-MM-DD`). */
  readonly dVoo: string;
}

/** Terminal de carregamento (`infTermCarreg`). */
export interface TerminalCarregamento {
  /** Código do terminal na tabela do Ministério dos Transportes (1 a 8 posições). */
  readonly cTermCarreg: string;
  readonly xTermCarreg: string;
}

/** Terminal de descarregamento (`infTermDescarreg`). */
export interface TerminalDescarregamento {
  /** Código do terminal na tabela do Ministério dos Transportes (1 a 8 posições). */
  readonly cTermDescarreg: string;
  readonly xTermDescarreg: string;
}

/** Embarcação do comboio (`infEmbComb`). */
export interface EmbarcacaoComboio {
  readonly cEmbComb: string;
  /** Identificador da balsa. */
  readonly xBalsa: string;
}

/** Unidade de carga vazia (`infUnidCargaVazia`): 1 contêiner, 2 ULD, 3 pallet, 4 outros. */
export interface UnidadeCargaVazia {
  readonly idUnidCargaVazia: string;
  readonly tpUnidCargaVazia: '1' | '2' | '3' | '4';
}

/** Unidade de transporte vazia (`infUnidTranspVazia`): 1 caminhão (tração), 2 carreta (reboque). */
export interface UnidadeTransporteVazia {
  readonly idUnidTranspVazia: string;
  readonly tpUnidTranspVazia: '1' | '2';
}

/** Grupo do modal aquaviário (`aquav`, MOC 3.00b Anexo I, 3.4, com o MMSI da NT 2025.001). */
export interface Aquaviario {
  /** IRIN do navio (1 a 10 posições). */
  readonly irin: string;
  /** Tipo de embarcação (2 dígitos, tabela do Ministério dos Transportes). */
  readonly tpEmb: string;
  /** Código da embarcação (1 a 10 posições). */
  readonly cEmbar: string;
  /** Nome da embarcação. */
  readonly xEmbar: string;
  /** Número da viagem (até 10 dígitos, sem zero à esquerda). */
  readonly nViag: string;
  /** Porto de embarque (tabela do Ministério dos Transportes, 1 a 5 posições). */
  readonly cPrtEmb: string;
  /** Porto de destino (tabela do Ministério dos Transportes, 1 a 5 posições). */
  readonly cPrtDest: string;
  /** Porto de transbordo. */
  readonly prtTrans?: string;
  /** Tipo de navegação: 0 interior, 1 cabotagem. */
  readonly tpNav?: '0' | '1';
  /** Até 5 terminais de carregamento. */
  readonly terminaisCarregamento?: readonly TerminalCarregamento[];
  /** Até 5 terminais de descarregamento. */
  readonly terminaisDescarregamento?: readonly TerminalDescarregamento[];
  /** Até 30 embarcações do comboio. */
  readonly comboio?: readonly EmbarcacaoComboio[];
  readonly unidadesCargaVazias?: readonly UnidadeCargaVazia[];
  readonly unidadesTransporteVazias?: readonly UnidadeTransporteVazia[];
  /** Maritime Mobile Service Identity (9 dígitos), opcional desde a NT 2025.001. */
  readonly MMSI?: string;
}

/** Composição do trem (`trem`). */
export interface Trem {
  /** Prefixo do trem (1 a 10 posições). */
  readonly xPref: string;
  /** Liberação do trem na origem. */
  readonly dhTrem?: Instante;
  /** Sigla da estação de origem (1 a 3 posições). */
  readonly xOri: string;
  /** Sigla da estação de destino (1 a 3 posições). */
  readonly xDest: string;
}

/** Vagão da composição (`vag`). */
export interface Vagao {
  /** Peso base de cálculo do frete, em toneladas (3 casas). */
  readonly pesoBC: DecimalInput;
  /** Peso real, em toneladas (3 casas). */
  readonly pesoR: DecimalInput;
  /** Tipo de vagão (3 posições). */
  readonly tpVag?: string;
  /** Série de identificação do vagão (3 posições). */
  readonly serie: string;
  /** Número de identificação do vagão (1 a 8 dígitos, sem zero à esquerda). */
  readonly nVag: string;
  /** Sequência do vagão na composição (1 a 3 dígitos). */
  readonly nSeq?: string;
  /** Tonelada útil: só o peso da carga, em toneladas (2 ou 3 casas). */
  readonly TU: DecimalInput;
}

/** Grupo do modal ferroviário (`ferrov`, MOC 3.00b Anexo I, 3.3). `qVag` sai da contagem de `vagoes`. */
export interface Ferroviario {
  readonly trem: Trem;
  /** Vagões carregados (ao menos um). */
  readonly vagoes: readonly Vagao[];
}

// ---------------------------------------------------------------------------------------------------------------
// MDF-e
// ---------------------------------------------------------------------------------------------------------------

/**
 * Campos do MDF-e comuns a todos os modais. `D` é o descarregamento do modal: só o aquaviário leva MDF-e transportado.
 */
export interface CamposMdfe<D extends Descarregamento = Descarregamento> {
  readonly tpEmit: TipoEmitente;
  /**
   * Tipo do transportador: no modal rodoviário, só quando o veículo de tração é de terceiro
   * (`rodoviario.tracao.proprietario`); TAC (2) com proprietário CPF, ETC (1) ou CTC (3) com CNPJ (F18 a F20).
   */
  readonly tpTransp?: TipoTransportador;
  readonly serie: number | string;
  readonly nMDF: number | string;
  /**
   * Código numérico da chave (8 dígitos). Omitido, o builder sorteia. Na reemissão em contingência off-line, informe o
   * cMDF do documento original: a chave muda só no tpEmis e no DV (MOC Visão Geral, item 11.1).
   */
  readonly cMDF?: string;
  readonly emitente: Emitente;
  /** UF de início e de fim da viagem (`EX` para o exterior). */
  readonly ufIni: UfMdfe;
  readonly ufFim: UfMdfe;
  /** Municípios de carregamento (1 a 50), na UF de início. */
  readonly carregamento: readonly MunicipioCarregamento[];
  /**
   * UFs atravessadas entre `ufIni` e `ufFim`, na ordem. No modal rodoviário, vazio quando as duas fazem divisa ou são a
   * mesma (F90).
   */
  readonly percurso?: readonly UfMdfe[];
  /** Início previsto da viagem. */
  readonly dhIniViagem?: Instante;
  readonly indCanalVerde?: true;
  /** Carregamento posterior, só no modal rodoviário: os documentos entram depois, pelo evento de inclusão de DF-e (F21 a F27). */
  readonly indCarregaPosterior?: true;
  /** Municípios de descarregamento (1 a 1000), na UF de fim, com os documentos de cada um. */
  readonly descarregamentos: readonly D[];
  readonly seguros?: readonly Seguro[];
  readonly produtoPredominante?: ProdutoPredominante;
  readonly totais: TotaisCarga;
  readonly lacres?: readonly string[];
  /** CNPJ ou CPF autorizados a obter o XML (até 10). */
  readonly autXML?: readonly DocumentoPessoa[];
  readonly informacoesAdicionais?: { readonly infAdFisco?: string; readonly infCpl?: string };
  readonly respTec?: ResponsavelTecnico;
}

/** MDF-e do modal rodoviário (`modal` 1). */
export interface DadosMdfeRodoviario extends CamposMdfe {
  readonly rodoviario: Rodoviario;
  readonly aereo?: never;
  readonly aquaviario?: never;
  readonly ferroviario?: never;
}

/** MDF-e do modal aéreo (`modal` 2). */
export interface DadosMdfeAereo extends CamposMdfe {
  readonly aereo: Aereo;
  readonly rodoviario?: never;
  readonly aquaviario?: never;
  readonly ferroviario?: never;
}

/** MDF-e do modal aquaviário (`modal` 3). */
export interface DadosMdfeAquaviario extends CamposMdfe<DescarregamentoAquaviario> {
  readonly aquaviario: Aquaviario;
  readonly rodoviario?: never;
  readonly aereo?: never;
  readonly ferroviario?: never;
}

/** MDF-e do modal ferroviário (`modal` 4). */
export interface DadosMdfeFerroviario extends CamposMdfe {
  readonly ferroviario: Ferroviario;
  readonly rodoviario?: never;
  readonly aereo?: never;
  readonly aquaviario?: never;
}

/** Entrada do `montarMdfe`: os campos comuns e o grupo de um modal, um e só um. */
export type DadosMdfe = DadosMdfeRodoviario | DadosMdfeAereo | DadosMdfeAquaviario | DadosMdfeFerroviario;
