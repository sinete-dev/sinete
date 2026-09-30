/**
 * Códigos e identificadores da NFS-e Nacional, com a regra de formação do leiaute 1.01 (Anexo I, aba "LEIAUTE
 * DPS_NFS-e", e Anexo II, aba "LEIAUTE EVENTO_PED.REG.EVENTO").
 *
 * - Código de tributação nacional (`cTribNac`): 6 dígitos na DPS (item, subitem e desdobro nacional da LC 116/2003).
 *   A parametrização do ADN usa 9 dígitos com pontos, o `cTribNac` mais o código municipal de 3 dígitos
 *   (`01.01.01.000`); sem pontos, o ADN responde 400 (ADR 0004, rodada 3).
 * - Id da DPS (45): `DPS` + município emissor (7) + tipo de inscrição (1: CPF, 2: CNPJ) + inscrição (14, CPF com zeros à
 *   esquerda) + série (5) + número (15).
 * - Chave da NFS-e (50): município (7) + ambiente gerador (1) + tipo de inscrição (1) + inscrição (14) + nNFSe (13) +
 *   ano e mês (4) + código numérico (9) + DV (1). O Anexo I não publica o algoritmo do DV, então o sinete confere só a
 *   estrutura da chave e nunca recusa uma chave pelo DV.
 * - Id do pedido de registro de evento (59): `PRE` + chave (50) + código do evento (6).
 */

import { ErroDeConfiguracao } from '@sinete/core';

const CTRIBNAC = /^(\d{2})\.?(\d{2})\.?(\d{2})$/;

/** `cTribNac` na forma da DPS (6 dígitos), a partir de `010101` ou `01.01.01`. Lança `ConfigError` fora disso. */
export function cTribNacDps(codigo: string): string {
  const m = CTRIBNAC.exec(codigo.trim());
  if (m === null) {
    throw new ErroDeConfiguracao(
      `código de tributação nacional inválido: ${JSON.stringify(codigo)} (use 010101 ou 01.01.01)`,
    );
  }
  return `${m[1]}${m[2]}${m[3]}`;
}

/**
 * Código de serviço da parametrização municipal do ADN: `01.01.01.000`, o `cTribNac` com pontos seguido do código de
 * tributação municipal (`cTribMun`, 3 dígitos, `000` sem desdobro municipal).
 */
export function codigoServicoParametrizacao(cTribNac: string, cTribMun: string = '000'): string {
  const n = cTribNacDps(cTribNac);
  if (!/^\d{3}$/.test(cTribMun)) throw new ErroDeConfiguracao(`código de tributação municipal inválido: ${cTribMun}`);
  return `${n.slice(0, 2)}.${n.slice(2, 4)}.${n.slice(4, 6)}.${cTribMun}`;
}

/** Inscrição do emitente da DPS: CNPJ (14, numérico ou alfanumérico) ou CPF (11). */
export type InscricaoFederal =
  | { readonly CNPJ: string; readonly CPF?: never }
  | { readonly CPF: string; readonly CNPJ?: never };

/** Tipo de inscrição (1 CPF, 2 CNPJ) e inscrição com 14 posições, como entram no Id da DPS e na chave. */
export function inscricaoId(doc: InscricaoFederal): { readonly tpInsc: '1' | '2'; readonly inscricao: string } {
  if (doc.CNPJ !== undefined) {
    if (!/^[0-9A-Z]{12}\d{2}$/.test(doc.CNPJ)) throw new ErroDeConfiguracao(`CNPJ fora do formato: ${doc.CNPJ}`);
    return { tpInsc: '2', inscricao: doc.CNPJ };
  }
  if (!/^\d{11}$/.test(doc.CPF)) throw new ErroDeConfiguracao(`CPF fora do formato: ${doc.CPF}`);
  return { tpInsc: '1', inscricao: `000${doc.CPF}` };
}

export interface IdDpsPartes {
  /** Município emissor (`cLocEmi`, IBGE, 7 dígitos). */
  readonly cLocEmi: string;
  readonly emitente: InscricaoFederal;
  readonly serie: string;
  readonly nDPS: string;
}

/** Id da DPS (`DPS` + 42 posições). */
export function idDps(p: IdDpsPartes): string {
  if (!/^\d{7}$/.test(p.cLocEmi)) throw new ErroDeConfiguracao(`cLocEmi inválido: ${p.cLocEmi}`);
  if (!/^\d{1,5}$/.test(p.serie)) throw new ErroDeConfiguracao(`série inválida: ${p.serie}`);
  if (!/^\d{1,15}$/.test(p.nDPS)) throw new ErroDeConfiguracao(`nDPS inválido: ${p.nDPS}`);
  const { tpInsc, inscricao } = inscricaoId(p.emitente);
  return `DPS${p.cLocEmi}${tpInsc}${inscricao}${p.serie.padStart(5, '0')}${p.nDPS.padStart(15, '0')}`;
}

/** Partes da chave de acesso da NFS-e. */
export interface ChaveNfse {
  readonly chave: string;
  /** Município emissor (IBGE). */
  readonly cMun: string;
  /** Ambiente gerador: 1 sistema próprio do município, 2 Sefin Nacional (Anexo I, `ambGer`). */
  readonly ambGer: string;
  readonly tpInsc: '1' | '2';
  /** CNPJ (14) ou CPF (11), sem o preenchimento. */
  readonly inscricao: string;
  readonly nNFSe: string;
  /** Ano e mês da emissão, `AAMM`. */
  readonly anoMes: string;
  readonly cNum: string;
  readonly dv: string;
}

const CHAVE = /^(\d{7})(\d)([12])([0-9A-Z]{14})(\d{13})(\d{4})(\d{9})(\d)$/;

/** Lê a chave de 50 posições. Lança `ConfigError` se a estrutura não bate; o DV não é conferido (ver o topo). */
export function parseChaveNfse(chave: string): ChaveNfse {
  const m = CHAVE.exec(chave);
  if (m === null) throw new ErroDeConfiguracao(`chave de NFS-e inválida: ${JSON.stringify(chave)}`);
  const tpInsc = m[3] as '1' | '2';
  const insc = m[4] as string;
  if (tpInsc === '1' && !insc.startsWith('000'))
    throw new ErroDeConfiguracao(`chave de NFS-e com CPF mal preenchido: ${chave}`);
  return {
    chave,
    cMun: m[1] as string,
    ambGer: m[2] as string,
    tpInsc,
    inscricao: tpInsc === '1' ? insc.slice(3) : insc,
    nNFSe: m[5] as string,
    anoMes: m[6] as string,
    cNum: m[7] as string,
    dv: m[8] as string,
  };
}

/** Códigos de evento da NFS-e (Anexo II, aba "TIPO EVENTOS DE NFSe") que o sinete envia ou reconhece pelo nome. */
export const TIPOS_EVENTO = {
  cancelamento: '101101',
  cancelamentoPorSubstituicao: '105102',
  solicitacaoAnaliseFiscal: '101103',
} as const;

/** Id do pedido de registro de evento: `PRE` + chave + código do evento. */
export function idPedidoEvento(chave: string, tpEvento: string): string {
  parseChaveNfse(chave);
  if (!/^\d{6}$/.test(tpEvento)) throw new ErroDeConfiguracao(`código de evento inválido: ${tpEvento}`);
  return `PRE${chave}${tpEvento}`;
}
