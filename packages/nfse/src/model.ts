/**
 * Entrada do domínio da DPS (Declaração de Prestação de Serviço) da NFS-e Nacional, leiaute 1.01.
 *
 * Os grupos têm nomes em português (`prestador`, `tomador`, `servico`, `tributacao`, `ibsCbs`) e os campos, o nome do
 * leiaute. Grupos raros ou já bem tipados pelo XSD (endereço, comércio exterior, obra, evento, dedução e redução,
 * tributação federal) são o tipo gerado do `@sinete/schemas`, repassado sem conversão. Valores monetários aceitam texto
 * ou número e saem com 2 casas (`valores.ts`).
 *
 * A DPS declara; a Sefin Nacional calcula. O ISSQN (base, alíquota parametrizada, valor) e o IBS e a CBS (alíquotas,
 * valores, totais) vêm na NFS-e gerada. Do IBS/CBS a DPS leva só a classificação (NT SE/CGNFS-e 004): indicador da
 * operação, destinatário, CST, cClassTrib e os grupos opcionais de tributação regular, diferimento e reembolso.
 */

import type {
  TCAtvEvento,
  TCBeneficioMunicipal,
  TCComExterior,
  TCExigSuspensa,
  TCInfoCompl,
  TCInfoDedRed,
  TCInfoObra,
  TCInfoPessoa,
  TCInfoPrestador,
  TCRTCInfoDest,
  TCRTCInfoImovel,
  TCRTCInfoReeRepRes,
  TCTribFederal,
  TCTribTotal,
  TSCodJustSubst,
  TSEmitenteDPS,
  TSMotivoEmisTI,
  TSRTCIndDest,
  TSRTCIndFinal,
  TSRTCTpEnteGov,
  TSRTCTpOper,
  TSTipoImunidadeISSQN,
  TSTipoRetISSQN,
  TSTribISSQN,
} from '@sinete/schemas/nfse/1.01-20260727';
import type { Valor } from './valores.ts';

/** Prestador: CNPJ, CPF, NIF ou motivo de não ter NIF, mais o regime de tributação (`regTrib`). */
export type Prestador = TCInfoPrestador;

/** Tomador ou intermediário. */
export type Pessoa = TCInfoPessoa;

/** Local da prestação: município (IBGE, `0000000` para águas marítimas) ou país (ISO, prestação no exterior). */
export type LocalPrestacao =
  | { readonly cLocPrestacao: string; readonly cPaisPrestacao?: never }
  | { readonly cPaisPrestacao: string; readonly cLocPrestacao?: never };

export interface Servico {
  readonly local: LocalPrestacao;
  /** Código de tributação nacional: `010101` ou `01.01.01` (o builder grava os 6 dígitos). */
  readonly cTribNac: string;
  /** Código de tributação municipal (3 dígitos), quando o município desdobra o código nacional. */
  readonly cTribMun?: string;
  /** Descrição do serviço (até 2000 caracteres). */
  readonly xDescServ: string;
  /** Código NBS 2.0 (9 dígitos, Anexo B). */
  readonly cNBS?: string;
  /** Código interno do contribuinte. */
  readonly cIntContrib?: string;
  readonly comExt?: TCComExterior;
  readonly obra?: TCInfoObra;
  readonly atvEvento?: TCAtvEvento;
  readonly infoCompl?: TCInfoCompl;
}

export interface ValoresDps {
  /** Valor do serviço (`vServ`). */
  readonly vServ: Valor;
  /** Valor recebido pelo intermediário (`vReceb`). */
  readonly vReceb?: Valor;
  readonly vDescIncond?: Valor;
  readonly vDescCond?: Valor;
  /** Dedução ou redução da base de cálculo (percentual, valor ou documentos). */
  readonly deducaoReducao?: TCInfoDedRed;
}

/** Tributação municipal (ISSQN) como declarada; o valor do imposto é da Sefin. */
export interface Issqn {
  /** 1 operação tributável, 2 imunidade, 3 exportação, 4 não incidência. */
  readonly tribISSQN: TSTribISSQN;
  /** 1 não retido, 2 retido pelo tomador, 3 retido pelo intermediário. */
  readonly tpRetISSQN: TSTipoRetISSQN;
  /**
   * Alíquota em %, só quando a regra do município pede (município de incidência fora do sistema nacional, Simples
   * com retenção): parametrizada, ela vem da Sefin e informar causa rejeição (E0617, E0625 e afins).
   */
  readonly pAliq?: Valor;
  /** País do resultado na exportação (ISO, 2 letras). */
  readonly cPaisResult?: string;
  readonly tpImunidade?: TSTipoImunidadeISSQN;
  readonly exigSusp?: TCExigSuspensa;
  /** Benefício municipal (número do benefício da parametrização e redução por valor ou percentual). */
  readonly BM?: TCBeneficioMunicipal;
}

export interface Tributacao {
  readonly issqn: Issqn;
  readonly federal?: TCTribFederal;
  /**
   * Total aproximado dos tributos (Lei 12.741/2012). Obrigatório fora do MEI: `vTotTrib` ou `pTotTrib`, ou
   * `pTotTribSN` no ME/EPP. No MEI, o padrão é `{ indTotTrib: '0' }` (não informado), o único regime que aceita o indicador.
   */
  readonly totTrib?: TCTribTotal;
}

/** Classificação do IBS e da CBS do serviço (grupo `IBSCBS/valores/trib/gIBSCBS`). */
export interface ClassificacaoIbsCbs {
  /** CST do IBS/CBS (3 dígitos). */
  readonly CST: string;
  /** Classificação tributária (6 dígitos). */
  readonly cClassTrib: string;
  readonly cCredPres?: string;
  /** Tributação regular (`gTribRegular`): CST e classificação que valeriam sem o tratamento informado. */
  readonly tributacaoRegular?: { readonly CSTReg: string; readonly cClassTribReg: string };
  /** Diferimento em % por esfera (`gDif`). */
  readonly diferimento?: { readonly pDifUF: Valor; readonly pDifMun: Valor; readonly pDifCBS: Valor };
}

/** Grupo `IBSCBS` da DPS: o que o emitente declara (NT SE/CGNFS-e 004). */
export interface IbsCbsDps {
  /** Finalidade: `0` NFS-e regular. Padrão `0`. */
  readonly finNFSe?: '0';
  /** Consumo pessoal (`1`) ou não (`0`). */
  readonly indFinal?: TSRTCIndFinal;
  /** Código indicador da operação (Anexo C, 6 dígitos). */
  readonly cIndOp: string;
  readonly tpOper?: TSRTCTpOper;
  /** Chaves de NFS-e referenciadas (`gRefNFSe`). */
  readonly refNFSe?: readonly string[];
  readonly tpEnteGov?: TSRTCTpEnteGov;
  /** Destinatário diferente do tomador (`1`) ou o próprio tomador (`0`). */
  readonly indDest: TSRTCIndDest;
  readonly destinatario?: TCRTCInfoDest;
  readonly imovel?: TCRTCInfoImovel;
  /** Reembolso, repasse e ressarcimento (`gReeRepRes`). */
  readonly reembolsos?: TCRTCInfoReeRepRes;
  readonly classificacao: ClassificacaoIbsCbs;
}

/** NFS-e substituída por esta DPS (grupo `subst`). */
export interface Substituicao {
  readonly chSubstda: string;
  /** 01 desenquadramento do Simples, 02 enquadramento, 03 inclusão retroativa de imunidade ou isenção, 04 exclusão retroativa, 05 rejeição pelo tomador ou intermediário, 99 outros. */
  readonly cMotivo: TSCodJustSubst;
  readonly xMotivo?: string;
}

export interface DpsInput {
  /** Série (até 5 dígitos, de `0` a `89999`). */
  readonly serie: string | number;
  /** Número da DPS (1 a 15 dígitos, sem zero à esquerda). */
  readonly nDPS: string | number | bigint;
  /** Data de competência `AAAA-MM-DD`. Padrão: o dia do relógio de fato gerador em Brasília. */
  readonly dCompet?: string;
  /** Quem emite a DPS: 1 prestador (padrão), 2 tomador, 3 intermediário. */
  readonly tpEmit?: TSEmitenteDPS;
  readonly cMotivoEmisTI?: TSMotivoEmisTI;
  readonly chNFSeRej?: string;
  /** Município emissor (IBGE, 7 dígitos): onde o emitente está cadastrado e o convênio está ativo. */
  readonly cLocEmi: string;
  readonly substituicao?: Substituicao;
  readonly prestador: Prestador;
  readonly tomador?: Pessoa;
  readonly intermediario?: Pessoa;
  readonly servico: Servico;
  readonly valores: ValoresDps;
  readonly tributacao: Tributacao;
  readonly ibsCbs?: IbsCbsDps;
}
