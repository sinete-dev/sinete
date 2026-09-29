/**
 * Notas sintéticas para os testes do adaptador. Documentos são exemplos públicos de dígito verificador válido; IE de RS
 * e AM com o DV calculado sobre bases inventadas; nomes e endereços inventados.
 */
import type { Clock } from '@sinete/core';
import { timeContext } from '@sinete/core';
import type { BuildNfeOptions, IbsCbsCalculator, Item, NfeInput } from '../../src/index.ts';

export const CNPJ_EMIT = '11222333000181';
export const CNPJ_DEST = '11444777000161';

export interface Local {
  readonly UF: 'SP' | 'RS' | 'AM';
  readonly cMun: string;
  readonly xMun: string;
  readonly IE: string;
}

export const LOCAIS: Readonly<Record<Local['UF'], Local>> = {
  SP: { UF: 'SP', cMun: '3550308', xMun: 'SAO PAULO', IE: '110042490114' },
  RS: { UF: 'RS', cMun: '4314902', xMun: 'PORTO ALEGRE', IE: '0240001230' },
  AM: { UF: 'AM', cMun: '1302603', xMun: 'MANAUS', IE: '040000125' },
};

export interface ItemRtc {
  readonly CST: string;
  readonly cClassTrib: string;
  /** Base do IBS/CBS; também é o valor do produto. */
  readonly base: string;
}

export function itemRtc(i: ItemRtc, n: number): Item {
  return {
    produto: {
      cProd: `P${n}`,
      xProd: 'PRODUTO SINTETICO',
      NCM: '73181500',
      CFOP: '5102',
      uCom: 'UN',
      qCom: '1',
      vUnCom: i.base,
    },
    impostos: {
      icms: { CST: '00', orig: '0', pICMS: '18' },
      pis: { CST: '07' },
      cofins: { CST: '07' },
      ibsCbs: { classificacao: { CST: i.CST, cClassTrib: i.cClassTrib, vBC: i.base } },
    },
  };
}

export function notaRtc(local: Local, itens: readonly ItemRtc[], nNF = 1): NfeInput {
  const endereco = {
    xLgr: 'RUA DOS TESTES',
    nro: '100',
    xBairro: 'CENTRO',
    cMun: local.cMun,
    xMun: local.xMun,
    UF: local.UF,
  };
  return {
    serie: 1,
    nNF,
    natOp: 'VENDA DE MERCADORIA',
    tpNF: '1',
    emitente: {
      CNPJ: CNPJ_EMIT,
      xNome: 'EMPRESA SINTETICA LTDA',
      endereco: { ...endereco, CEP: '01001000' },
      IE: local.IE,
      CRT: '3',
    },
    destinatario: { CNPJ: CNPJ_DEST, xNome: 'DESTINATARIO SINTETICO LTDA', indIEDest: '9', endereco },
    itens: itens.map(itemRtc),
  };
}

/** Opções do `buildNfe` com cNF determinístico; sem `ibsCbs`, vale a calculadora padrão. */
export function opcoesRtc(clock: Clock, ibsCbs?: IbsCbsCalculator, fatoGerador?: Clock): BuildNfeOptions {
  let seed = 4242;
  return {
    ambiente: 'homologacao',
    time: timeContext({ emissao: clock, ...(fatoGerador === undefined ? {} : { fatoGerador }) }),
    ...(ibsCbs === undefined ? {} : { ibsCbs }),
    random: (b: Uint8Array): Uint8Array => {
      for (let i = 0; i < b.length; i++) {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        b[i] = seed & 0xff;
      }
      return b;
    },
  };
}

/** Achata um objeto em `caminho -> texto`, como as fixtures do oráculo do `@sinete/ibs-cbs/calcular`. */
export function flatten(prefix: string, value: unknown, out: Record<string, string> = {}): Record<string, string> {
  if (value === null || value === undefined) return out;
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      flatten(prefix ? `${prefix}.${k}` : k, v, out);
    return out;
  }
  out[prefix] = String(value);
  return out;
}
