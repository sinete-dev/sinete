/**
 * Notas sintéticas para os testes do builder. Documentos são exemplos públicos de dígito verificador válido
 * (11.222.333/0001-81, 111.444.777-35, IE SP 110.042.490.114); nomes e endereços são inventados.
 */
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import type { CalculadoraIbsCbs, DadosNfe, Item, MontarNfeOpcoes } from '../../src/index.ts';
import { Decimal } from '../../src/index.ts';

export const CNPJ_EMIT = '11222333000181';
export const CNPJ_DEST = '11444777000161';
export const CPF = '11144477735';
export const IE_SP = '110042490114';

/** Emissão em homologação em 26/09/2026 (PL_010f vigente em homologação). */
export const EMISSAO = '2026-09-26T10:00:00-03:00';

export function opcoes(extra: Partial<MontarNfeOpcoes> = {}, at: string = EMISSAO): MontarNfeOpcoes {
  let seed = 12345;
  return {
    ambiente: 'homologacao',
    tempo: contextoDeTempo({ emissao: relogioFixo(at) }),
    aleatorio: (b: Uint8Array): Uint8Array => {
      for (let i = 0; i < b.length; i++) {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        b[i] = seed & 0xff;
      }
      return b;
    },
    ...extra,
  };
}

export function item(extra: Partial<Item> = {}, icms: Item['impostos']['icms'] = undefined): Item {
  return {
    produto: {
      cProd: 'P001',
      xProd: 'PARAFUSO SINTETICO',
      NCM: '73181500',
      CFOP: '5102',
      uCom: 'UN',
      qCom: '10',
      vUnCom: '1.5',
    },
    impostos: {
      icms: icms ?? { CST: '00', orig: '0', pICMS: '18' },
      pis: { CST: '01', vBC: '15.00', aliquota: '1.65' },
      cofins: { CST: '01', vBC: '15.00', aliquota: '7.60' },
    },
    ...extra,
  };
}

export function nota(extra: Partial<DadosNfe> = {}): DadosNfe {
  return {
    serie: 1,
    nNF: 123,
    natOp: 'VENDA DE MERCADORIA',
    tpNF: '1',
    emitente: {
      CNPJ: CNPJ_EMIT,
      xNome: 'EMPRESA SINTETICA LTDA',
      endereco: {
        xLgr: 'RUA DOS TESTES',
        nro: '100',
        xBairro: 'CENTRO',
        cMun: '3550308',
        xMun: 'SAO PAULO',
        UF: 'SP',
        CEP: '01001-000',
      },
      IE: IE_SP,
      CRT: '3',
    },
    destinatario: {
      CPF,
      xNome: 'CONSUMIDOR SINTETICO',
      indIEDest: '9',
      endereco: {
        xLgr: 'AVENIDA FICTICIA',
        nro: '1',
        xBairro: 'BAIRRO',
        cMun: '3550308',
        xMun: 'SAO PAULO',
        UF: 'SP',
      },
    },
    itens: [item()],
    ...extra,
  };
}

/** Dublê da calculadora: IBS UF 0,1%, IBS Mun 0%, CBS 0,9% sobre (vProd - vDesc), como na fase de teste de 2026. */
export const calculadoraFixa: CalculadoraIbsCbs = {
  calcular({ itens }) {
    return {
      itens: itens.map((i) => {
        const vBC = i.vBC ?? i.vProd.minus(i.vDesc);
        const f = (p: string): string => vBC.percent(Decimal.of(p)).toFixed(2, 'HALF_EVEN');
        return {
          nItem: i.nItem,
          IBSCBS: {
            CST: i.CST,
            cClassTrib: i.cClassTrib,
            gIBSCBS: {
              vBC: vBC.toFixed(2),
              gIBSUF: { pIBSUF: '0.1000', vIBSUF: f('0.1') },
              gIBSMun: { pIBSMun: '0.0000', vIBSMun: '0.00' },
              vIBS: f('0.1'),
              gCBS: { pCBS: '0.9000', vCBS: f('0.9') },
            },
          },
        };
      }),
    };
  },
};
