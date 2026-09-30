/**
 * Portas do `@sinete/nfe` para o que pode vir de fora. A montagem só conhece o contrato estreito declarado aqui; a
 * implementação padrão do IBS/CBS é o `calculadoraIbsCbs` (`rtc.ts`, sobre o `@sinete/ibs-cbs`), e quem calcula em outro
 * lugar (ou testa com alíquotas fixas) injeta a sua em `MontarNfeOpcoes.ibsCbs`.
 */

import type { Ambiente, Ocorrencia, Uf } from '@sinete/core';
import type { TTribNFe } from '@sinete/schemas/nfe/PL_010f';
import type { Decimal } from './decimal.ts';
import type { Instante } from './time.ts';

/** Um item classificado, com os valores que a calculadora pode precisar para a base do IBS/CBS. */
export interface PedidoIbsCbsItem {
  /** Número do item na nota (1 a 990). */
  readonly nItem: number;
  /** CST do IBS/CBS (3 dígitos). */
  readonly CST: string;
  /** Classificação tributária (6 dígitos). */
  readonly cClassTrib: string;
  readonly indDoacao?: '1';
  readonly cCredPres?: string;
  /**
   * Tributação regular (`gTribRegular`, UB68): o CST e o cClassTrib que valeriam sem a suspensão, o diferimento ou a
   * exportação do `cClassTrib` principal, quando ele exige ou permite o grupo (550001, por exemplo).
   */
  readonly gTribRegular?: { readonly CSTReg: string; readonly cClassTribReg: string };
  /** Base informada por quem emite; ausente, a calculadora determina. */
  readonly vBC?: Decimal;
  readonly NCM: string;
  readonly CFOP: string;
  readonly uTrib: string;
  readonly qTrib: Decimal;
  readonly vProd: Decimal;
  readonly vDesc: Decimal;
  readonly vFrete: Decimal;
  readonly vSeg: Decimal;
  readonly vOutro: Decimal;
  /** Tributos do item já calculados pelo builder (a base do IBS/CBS pode excluí-los, conforme a LC 214/2025). */
  readonly vICMS: Decimal;
  readonly vICMSST: Decimal;
  readonly vFCP: Decimal;
  readonly vFCPST: Decimal;
  readonly vIPI: Decimal;
  readonly vPIS: Decimal;
  readonly vCOFINS: Decimal;
  readonly vII: Decimal;
  readonly vISSQN: Decimal;
  /**
   * ICMS e FCP de partilha do item para a UF de destino (grupo `ICMSUFDest`, DIFAL da EC 87/2015); zero sem o grupo.
   * A base do IBS/CBS pode deduzi-los junto com o ICMS próprio.
   */
  readonly vICMSUFDest: Decimal;
  readonly vFCPUFDest: Decimal;
}

/** Dados da nota que decidem a regra aplicável (local da operação, vigência, compra governamental). */
export interface PedidoIbsCbsNota {
  /** Instante do fato gerador (relógio `fatoGerador` do `ContextoDeTempo`): decide a vigência das alíquotas. */
  readonly fatoGerador: Instante;
  /** Instante da emissão (o do `dhEmi`): decide quais regras de validação da NT já estão implantadas no ambiente. */
  readonly emissao: Instante;
  readonly ambiente: Ambiente;
  readonly mod: '55' | '65';
  readonly tpNF: '0' | '1';
  readonly finNFe: string;
  readonly tpNFDebito?: string;
  readonly tpNFCredito?: string;
  readonly indFinal: '0' | '1';
  readonly indPres: string;
  readonly emitente: { readonly UF: Uf; readonly cMun: string; readonly CRT: string };
  /** Local de destino da operação (entrega, destinatário ou `cMunFGIBS`, nessa ordem de precedência do leiaute). */
  readonly destino?: { readonly UF: Uf | 'EX'; readonly cMun: string };
  readonly cMunFGIBS?: string;
  readonly compraGov?: { readonly tpEnteGov: string; readonly pRedutor: Decimal; readonly tpOperGov: string };
}

/** Resultado da calculadora: o grupo `IBSCBS` de cada item pedido, já na forma lexical do leiaute. */
export interface RespostaIbsCbs {
  readonly itens: readonly { readonly nItem: number; readonly IBSCBS: TTribNFe }[];
  /**
   * Problemas de classificação ou de dado (`caminho` relativo ao item, como `itens[2].impostos.ibsCbs`). A ocorrência sem
   * `origem` entra como `montagem` (ADR 0011); marque `entrada` a que aponta um valor da nota.
   */
  readonly ocorrencias?: readonly Ocorrencia[];
}

/**
 * Calcula o IBS e a CBS dos itens classificados. O padrão é o `calculadoraIbsCbs`, sobre o `@sinete/ibs-cbs/calcular`; nos
 * testes, um dublê com alíquotas fixas. A calculadora não vê o XML nem o resto da nota além do que está no pedido.
 */
export interface CalculadoraIbsCbs {
  calcular(pedido: {
    readonly nota: PedidoIbsCbsNota;
    readonly itens: readonly PedidoIbsCbsItem[];
  }): RespostaIbsCbs | Promise<RespostaIbsCbs>;
}
