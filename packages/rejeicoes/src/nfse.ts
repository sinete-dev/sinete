/**
 * `@sinete/rejeicoes/nfse`: catálogo dos códigos de erro da NFS-e Nacional (`E0312`, `E1229`...).
 *
 * O catálogo vive em `data/nfse-erros.json`, gerado por `tools/rejeicoes-data/nfse.ts` a partir das planilhas oficiais
 * do Anexo I (DPS e NFS-e) e do Anexo II (pedido de registro de evento e evento) do leiaute do Sistema Nacional NFS-e,
 * com sha256 conferido, mais a curadoria manual de causa provável e correção. Na NFS-e o código de erro faz o papel do
 * `cStat`: a Sefin responde com uma lista de erros (`Codigo`, `Descricao`), e o desfecho `recusado` do core traz o
 * código no `cStat`.
 */

import type { DicaRejeicao, Recusado } from '@sinete/core';
import table from './data/nfse-erros.json' with { type: 'json' };
import type { FonteRejeicao } from './index.ts';

/** Categoria do erro, para agrupar tratamento e mensagens de interface. */
export type NfseErroCategoria =
  | 'recepcao'
  | 'schema'
  | 'assinatura'
  | 'certificado'
  | 'cadastro'
  | 'parametrizacao-municipal'
  | 'regra-negocio'
  | 'duplicidade'
  | 'evento'
  | 'reforma';

export const NFSE_ERRO_CATEGORIAS: readonly NfseErroCategoria[] = [
  'recepcao',
  'schema',
  'assinatura',
  'certificado',
  'cadastro',
  'parametrizacao-municipal',
  'regra-negocio',
  'duplicidade',
  'evento',
  'reforma',
];

/** Regra de negócio da planilha em que o código aparece. */
export interface NfseErroRegra {
  /** Documento de origem em `TABELA_ERROS_NFSE.fontes`. */
  readonly documento: 'anexo-i' | 'anexo-ii';
  /** Aba da planilha (`RN DPS_NFS-e`, `RN_RECEPCAO_DPS`, `RN EVENTO_PED.REG.EVENTO`). */
  readonly aba: string;
  /** Valor da coluna `#` da linha da regra. */
  readonly linha: string;
  /** Caminho do campo no XML (`NFSe/infNFSe/DPS/infDPS/serv/cServ/cTribNac`); ausente nas regras de recepção. */
  readonly caminho?: string;
  /** Nível da regra: 1 leiaute, 2 regra geral, 3 parametrização municipal. */
  readonly nivel?: '1' | '2' | '3';
  /** Texto da regra de negócio, com espaços normalizados. */
  readonly regra: string;
}

export interface NfseErro {
  /** Código de erro, `E` e 4 dígitos. */
  readonly codigo: string;
  /** Mensagem oficial ("MSG. ERRO"), com espaços normalizados. */
  readonly mensagem: string;
  /** Todas as mensagens oficiais quando o mesmo código aparece com textos diferentes (E1570). */
  readonly mensagens?: readonly string[];
  /** Menor nível entre as regras do código. */
  readonly nivel?: '1' | '2' | '3';
  readonly regras: readonly NfseErroRegra[];
  readonly categoria: NfseErroCategoria;
  /** Documento e aba da primeira regra (`Anexo I v1.01 (20260209), aba RN DPS_NFS-e`). */
  readonly fonte: string;
  /** Diagnóstico curado; presente só nos códigos revisados. */
  readonly causaProvavel?: string;
  readonly comoCorrigir?: string;
  /** Regra citada pela curadoria. */
  readonly referencia?: string;
}

export interface DescricaoTabelaErrosNfse {
  readonly versaoDoFormato: number;
  readonly versao: string;
  readonly fontes: readonly FonteRejeicao[];
}

/** Metadados do catálogo: versão (data de coleta) e planilhas de origem com sha256. */
export const TABELA_ERROS_NFSE: DescricaoTabelaErrosNfse = {
  versaoDoFormato: table.versaoDoFormato,
  versao: table.versao,
  fontes: table.fontes,
};

/** Todas as entradas, em ordem de código. */
export const NFSE_ERROS: readonly NfseErro[] = table.erros as readonly NfseErro[];

const byCode: ReadonlyMap<string, NfseErro> = new Map(NFSE_ERROS.map((e) => [e.codigo, e]));

/** Entrada do catálogo para o código (`'E0312'`), ou `undefined` se não está catalogado. */
export function nfseErroPorCodigo(codigo: string): NfseErro | undefined {
  return byCode.get(codigo.trim().toUpperCase());
}

/** `DicaRejeicao` do core para o código, quando há curadoria de causa e correção. */
export function dicaRejeicaoNfse(codigo: string): DicaRejeicao | undefined {
  const e = nfseErroPorCodigo(codigo);
  if (!e?.causaProvavel || !e.comoCorrigir) return undefined;
  return { causaProvavel: e.causaProvavel, comoCorrigir: e.comoCorrigir, fonte: e.referencia ?? e.fonte };
}

/**
 * Preenche a `dica` de um desfecho `recusado` da NFS-e a partir do catálogo. Não sobrescreve uma `dica` já presente e
 * devolve o mesmo objeto quando não há o que acrescentar.
 */
export function completarRecusadoNfse(desfecho: Recusado): Recusado {
  if (desfecho.dica !== undefined) return desfecho;
  const dica = dicaRejeicaoNfse(desfecho.cStat);
  return dica === undefined ? desfecho : { ...desfecho, dica };
}
