/**
 * MDF-e sintéticos para os testes. Documentos são exemplos públicos de dígito verificador válido (CNPJ 11.222.333/0001-81,
 * CPF 111.444.777-35 e 529.982.247-25, IE MT 0013000001-9); nomes, placas e chaves de NF-e e CT-e são inventados.
 */
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import { montarChaveAcesso } from '@sinete/validators';
import type { BuildMdfeOptions, MdfeInput } from '../../src/index.ts';

export const CNPJ_EMIT = '11222333000181';
export const CNPJ_TERCEIRO = '11444777000161';
export const CPF_EMIT = '11144477735';
export const CPF_CONDUTOR = '52998224725';
export const IE_MT = '00130000019';

/** Emissão em homologação em 26/09/2026 (MDF-e 3.00b vigente; CIOT obrigatório em homologação desde 21/09/2026). */
export const EMISSAO = '2026-09-26T10:00:00-04:00';

export function opcoes(extra: Partial<BuildMdfeOptions> = {}, at: string = EMISSAO): BuildMdfeOptions {
  let seed = 4242;
  return {
    ambiente: 'homologacao',
    time: contextoDeTempo({ emissao: relogioFixo(at) }),
    random: (b: Uint8Array): Uint8Array => {
      for (let i = 0; i < b.length; i++) {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        b[i] = seed & 0xff;
      }
      return b;
    },
    ...extra,
  };
}

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
export function cargaPropria(extra: Partial<MdfeInput> = {}): MdfeInput {
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

/** Transportador (CNPJ) prestando serviço com um CT-e (carga lotação), com seguro, CIOT, contratante e pagamento. */
export function prestador(extra: Partial<MdfeInput> = {}): MdfeInput {
  return {
    tpEmit: '1',
    serie: 1,
    nMDF: 10,
    emitente: {
      CNPJ: CNPJ_EMIT,
      IE: IE_MT,
      xNome: 'TRANSPORTADORA SINTETICA LTDA',
      endereco: {
        xLgr: 'AVENIDA FICTICIA',
        nro: '100',
        xBairro: 'CENTRO',
        cMun: '5103403',
        xMun: 'CUIABA',
        UF: 'MT',
      },
    },
    ufIni: 'MT',
    ufFim: 'GO',
    carregamento: [{ cMun: '5103403', xMun: 'CUIABA' }],
    rodoviario: {
      RNTRC: '12345678',
      ciot: [{ CIOT: '123456789012', CNPJ: CNPJ_EMIT }],
      contratantes: [{ xNome: 'CONTRATANTE SINTETICO', CNPJ: CNPJ_TERCEIRO }],
      pagamentos: [
        {
          CNPJ: CNPJ_TERCEIRO,
          componentes: [
            { tpComp: '04', vComp: '4000.00' },
            { tpComp: '01', vComp: '250.50' },
          ],
          indPag: '1',
          vAdiant: '1000.00',
          parcelas: [
            { dVenc: '2026-10-10', vParcela: '1625.25' },
            { dVenc: '2026-11-10', vParcela: '1625.25' },
          ],
          banco: { PIX: 'pix-sintetico@exemplo.invalid' },
        },
      ],
      tracao: {
        placa: 'XYZ9A87',
        tara: 12000,
        capKG: 40000,
        condutores: [{ xNome: 'CONDUTOR SINTETICO', CPF: CPF_CONDUTOR }],
        tpRod: '03',
        tpCar: '02',
        UF: 'MT',
      },
      reboques: [{ placa: 'QWE4R56', tara: 7000, capKG: 30000, tpCar: '02', UF: 'MT' }],
    },
    descarregamentos: [{ cMun: '5208707', xMun: 'GOIANIA', cte: [{ chave: chaveDoc(7, '57') }] }],
    seguros: [
      {
        responsavel: { respSeg: '1' },
        seguradora: { xSeg: 'SEGURADORA SINTETICA', CNPJ: CNPJ_TERCEIRO },
        nApol: 'APOLICE-1',
        nAver: ['AVERBACAO-1'],
      },
    ],
    produtoPredominante: {
      tpCarga: '05',
      xProd: 'CARGA GERAL SINTETICA',
      NCM: '84713012',
      lotacao: {
        carregamento: { CEP: '78000000' },
        descarregamento: { latitude: '-16.686891', longitude: '-49.264794' },
      },
    },
    totais: { vCarga: '98000.00', cUnid: '01', qCarga: '25000.5' },
    ...extra,
  };
}
