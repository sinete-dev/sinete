/**
 * MDF-e sintéticos para os testes. Documentos são exemplos públicos de dígito verificador válido (CNPJ 11.222.333/0001-81,
 * CPF 111.444.777-35 e 529.982.247-25, IE MT 0013000001-9); nomes, placas e chaves de NF-e e CT-e são inventados.
 */

import type { DadosMdfeRodoviario } from '@sinete/mdfe';
import { montarChaveAcesso } from '@sinete/validators';

export const CNPJ_EMIT = '11222333000181';
export const CNPJ_TERCEIRO = '11444777000161';
export const CPF_EMIT = '11144477735';
export const CPF_CONDUTOR = '52998224725';
export const IE_MT = '00130000019';

/** Emissão em homologação em 26/09/2026 (MDF-e 3.00b vigente; CIOT obrigatório em homologação desde 21/09/2026). */
export const EMISSAO = '2026-09-26T10:00:00-04:00';

/** Chave sintética de NF-e (55) ou CT-e (57) de MT, emitida pelo CNPJ de teste. */
export function chaveDoc(n: number, mod: '55' | '57' = '55', tpEmis = '1'): string {
  return montarChaveAcesso({
    cUF: '51',
    aamm: '2609',
    emitente: CNPJ_EMIT,
    mod,
    serie: 1,
    nNF: n,
    tpEmis,
    cNF: String(10_000_000 + n),
  });
}

/** Produtor rural (CPF) transportando a própria carga em veículo próprio, de MT para SP passando por MS. */
export function cargaPropria(extra: Partial<DadosMdfeRodoviario> = {}): DadosMdfeRodoviario {
  return {
    tpEmit: '2',
    serie: 920,
    nMDF: 1,
    emitente: {
      CPF: CPF_EMIT,
      IE: IE_MT,
      xNome: 'PRODUTOR RURAL SINTETICO',
      endereco: {
        xLgr: 'RODOVIA FICTICIA',
        nro: 'KM 10',
        xBairro: 'ZONA RURAL',
        cMun: '5103403',
        xMun: 'CUIABA',
        CEP: '78000-000',
        UF: 'MT',
      },
    },
    ufIni: 'MT',
    ufFim: 'SP',
    percurso: ['MS'],
    carregamento: [{ cMun: '5103403', xMun: 'CUIABA' }],
    rodoviario: {
      tracao: {
        placa: 'ABC1D23',
        tara: 10000,
        capKG: 30000,
        condutores: [{ xNome: 'CONDUTOR SINTETICO', CPF: CPF_CONDUTOR }],
        tpRod: '01',
        tpCar: '03',
        UF: 'MT',
      },
    },
    descarregamentos: [{ cMun: '3550308', xMun: 'SAO PAULO', nfe: [{ chave: chaveDoc(1) }, { chave: chaveDoc(2) }] }],
    produtoPredominante: { tpCarga: '01', xProd: 'SOJA EM GRAOS', NCM: '12019000' },
    totais: { vCarga: '150000.00', cUnid: '01', qCarga: '30000' },
    ...extra,
  };
}
