/**
 * DPS sintética e cenários contra o `@sinete/sefaz-sim` (NFS-e). Os CNPJ e CPF têm DV calculado sobre bases
 * inventadas; os certificados são gerados na hora e nada vai para o repo.
 */

import { relogioManual } from '@sinete/core';
import type { DadosDps } from '@sinete/nfse';
import type { CertificadoSintetico, MunicipioSim } from '@sinete/sefaz-sim';
import { certificadoSintetico } from '@sinete/sefaz-sim';
import { calcularDvCnpj, calcularDvCpf } from '@sinete/validators';

export const cnpj = (base12: string): string => base12 + calcularDvCnpj(base12);
export const cpf = (base9: string): string => base9 + calcularDvCpf(base9);

export const PRESTADOR: string = cnpj('112223330001');
export const TOMADOR: string = cnpj('445556660001');
export const OUTRO: string = cnpj('778889990001');
export const PRESTADOR_CPF: string = cpf('123456789');
/** São Paulo e Campinas (códigos IBGE). */
export const SAO_PAULO = '3550308';
export const CAMPINAS = '3509502';
export const EMISSAO = '2026-09-25T10:00:00-03:00';

export const MUNICIPIOS: readonly MunicipioSim[] = [
  {
    cMun: SAO_PAULO,
    nome: 'São Paulo',
    prazoCancelamentoDias: 30,
    servicos: [
      {
        codigo: '01.01.01',
        descricao: 'Análise e desenvolvimento de sistemas.',
        aliquotas: [{ aliquota: '2.00', inicio: '2026-01-01' }],
      },
      { codigo: '17.01.01', aliquotas: [{ aliquota: '5.00', inicio: '2025-03-17', fim: '2025-03-17' }] },
    ],
    regimesEspeciais: { '01.01.01.000/2026-09-25': { regimesEspeciais: [{ codigo: 1 }] } },
    retencoes: { '2026-09-25': { retencoes: [] } },
    beneficios: { '12345678901234/2026-09-25': { beneficio: { tipo: 1 } } },
  },
  { cMun: CAMPINAS, nome: 'Campinas', convenio: { aderenteEmissorNacional: 0 } },
];

export function dps(over: Partial<DadosDps> = {}): DadosDps {
  return {
    serie: '1',
    nDPS: '1',
    cLocEmi: SAO_PAULO,
    prestador: { CNPJ: PRESTADOR, regTrib: { opSimpNac: '3', regApTribSN: '1', regEspTrib: '0' } },
    tomador: { CNPJ: TOMADOR, xNome: 'TOMADOR SINTETICO LTDA' },
    servico: {
      local: { cLocPrestacao: SAO_PAULO },
      cTribNac: '01.01.01',
      xDescServ: 'Desenvolvimento de software sob encomenda (teste sintético)',
      cNBS: '115021000',
    },
    valores: { vServ: '1500.00' },
    tributacao: { issqn: { tribISSQN: '1', tpRetISSQN: '1' }, totTrib: { pTotTribSN: '6.00' } },
    ...over,
  };
}

export interface Certs {
  readonly ac: CertificadoSintetico;
  readonly servidor: CertificadoSintetico;
  readonly prestador: CertificadoSintetico;
  readonly outro: CertificadoSintetico;
}

export async function gerarCerts(): Promise<Certs> {
  const clock = relogioManual(EMISSAO);
  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac', diasDeValidade: 3650 });
  const [servidor, prestador, outro] = await Promise.all([
    certificadoSintetico({ relogio: clock, papel: 'servidor', emissor: ac }),
    certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: PRESTADOR, emissor: ac }),
    certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: OUTRO, emissor: ac }),
  ]);
  return { ac, servidor, prestador, outro };
}
