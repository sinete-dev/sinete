/**
 * Configuração da NFS-e simulada: municípios conveniados com os parâmetros que a Sefin e o ADN consultam (convênio,
 * alíquotas por código de serviço com vigência, prazo de cancelamento), contribuintes do cadastro nacional e as
 * alíquotas de teste do IBS e da CBS. Tudo como dado passado pelo teste; nada de município embutido no código.
 */

import type { Ambiente, Assinador, Relogio, Uf } from '@sinete/core';
import { ErroDeConfiguracao, ehCUf, tpAmbDoAmbiente, ufPorCUf } from '@sinete/core';
import type { TCEnderecoEmitente } from '@sinete/schemas/nfse/1.01-20260727';

/** Alíquota de um código de serviço com vigência (datas `AAAA-MM-DD`, fim inclusivo). */
export interface AliquotaSim {
  /** Alíquota em %, com 2 casas (`2.00`). */
  readonly aliquota: string;
  readonly inicio: string;
  readonly fim?: string;
}

export interface ServicoMunicipalSim {
  /** `010101`, `01.01.01` ou `01.01.01.000` (o código municipal padrão é `000`). */
  readonly codigo: string;
  /** Descrição que vai no `xTribNac` da NFS-e. Padrão: `Serviço <código>`. */
  readonly descricao?: string;
  /** Sem alíquota vigente na competência, a DPS é rejeitada com E0312. */
  readonly aliquotas: readonly AliquotaSim[];
}

export interface MunicipioSim {
  /** Código IBGE (7 dígitos). */
  readonly cMun: string;
  readonly nome: string;
  /** Campos de `parametrosConvenio` (como o ADN responde). Padrão: aderente ao ambiente e ao emissor nacional. */
  readonly convenio?: Readonly<Record<string, number | boolean>>;
  /** Início do convênio (`AAAA-MM-DD`): competência anterior é rejeitada com E1270. Padrão: sem limite. */
  readonly convenioDesde?: string;
  readonly servicos?: readonly ServicoMunicipalSim[];
  /** Prazo de cancelamento em dias depois do processamento (E0822). Padrão: sem prazo. */
  readonly prazoCancelamentoDias?: number;
  /** Respostas das consultas sem formato observado, por chave: `<código>/<competência>` e `<nBM>/<competência>`. */
  readonly regimesEspeciais?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly retencoes?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly beneficios?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** Contribuinte do cadastro nacional, para o grupo `emit` da NFS-e. */
export interface ContribuinteNfseSim {
  readonly CNPJ?: string;
  readonly CPF?: string;
  readonly xNome: string;
  readonly endereco?: TCEnderecoEmitente;
}

export interface AliquotasIbsCbsSim {
  /** Alíquotas em %, com 2 casas. Padrão: CBS 0.90, IBS UF 0.10, IBS municipal 0.00 (ano de teste de 2026, LC 214/2025, arts. 343 a 346). */
  readonly pCBS: string;
  readonly pIBSUF: string;
  readonly pIBSMun: string;
}

export interface NfseSimOptions {
  readonly clock: Relogio;
  /** Assinatura da Sefin simulada na NFS-e e no evento (ex.: `syntheticCertificate({ role: 'servidor' }).signer`). */
  readonly signer: Assinador;
  /** Padrão: `homologacao` (produção restrita). */
  readonly ambiente?: Ambiente;
  readonly municipios?: readonly MunicipioSim[];
  readonly contribuintes?: readonly ContribuinteNfseSim[];
  /** Sem certificado de cliente no TLS, HTTP 403 como o IIS da Sefin. Padrão: `true`. */
  readonly exigirCertificado?: boolean;
  readonly aliquotasIbsCbs?: AliquotasIbsCbsSim;
}

export interface NfseSimConfig {
  readonly clock: Relogio;
  readonly signer: Assinador;
  readonly ambiente: Ambiente;
  readonly tpAmb: '1' | '2';
  readonly municipios: ReadonlyMap<string, MunicipioSim>;
  readonly contribuintes: readonly ContribuinteNfseSim[];
  readonly exigirCertificado: boolean;
  readonly aliquotasIbsCbs: AliquotasIbsCbsSim;
}

/** Código de serviço da parametrização (`01.01.01.000`). */
export function codigoServico(c: string): string {
  const m = /^(\d{2})\.?(\d{2})\.?(\d{2})(?:\.(\d{3}))?$/.exec(c.trim());
  if (m === null) throw new ErroDeConfiguracao(`código de serviço inválido: ${c}`);
  return `${m[1]}.${m[2]}.${m[3]}.${m[4] ?? '000'}`;
}

export function resolverConfig(o: NfseSimOptions): NfseSimConfig {
  const municipios = new Map<string, MunicipioSim>();
  for (const m of o.municipios ?? []) {
    if (!/^\d{7}$/.test(m.cMun)) throw new ErroDeConfiguracao(`município inválido: ${m.cMun}`);
    for (const s of m.servicos ?? []) codigoServico(s.codigo);
    municipios.set(m.cMun, m);
  }
  const ambiente = o.ambiente ?? 'homologacao';
  return {
    clock: o.clock,
    signer: o.signer,
    ambiente,
    tpAmb: tpAmbDoAmbiente(ambiente),
    municipios,
    contribuintes: o.contribuintes ?? [],
    exigirCertificado: o.exigirCertificado ?? true,
    aliquotasIbsCbs: o.aliquotasIbsCbs ?? { pCBS: '0.90', pIBSUF: '0.10', pIBSMun: '0.00' },
  };
}

/** Serviço do município com o código (comparado na forma de 9 dígitos). */
export function servicoDo(m: MunicipioSim | undefined, codigo: string): ServicoMunicipalSim | undefined {
  const alvo = codigoServico(codigo);
  return m?.servicos?.find((s) => codigoServico(s.codigo) === alvo);
}

/** Alíquota vigente no dia (`AAAA-MM-DD`). */
export function aliquotaEm(s: ServicoMunicipalSim | undefined, dia: string): AliquotaSim | undefined {
  return s?.aliquotas.find((a) => a.inicio <= dia && (a.fim === undefined || dia <= a.fim));
}

/** UF do município pelo prefixo IBGE. */
export function ufDoMunicipio(cMun: string): Uf {
  const cUF = cMun.slice(0, 2);
  const info = ehCUf(cUF) ? ufPorCUf(cUF) : undefined;
  if (info === undefined) throw new ErroDeConfiguracao(`município com código de UF inválido: ${cMun}`);
  return info.sigla;
}

/** Convênio como o ADN responde, com os padrões do simulador. */
export function convenioDe(m: MunicipioSim): Readonly<Record<string, number | boolean>> {
  return {
    aderenteAmbienteNacional: 1,
    aderenteEmissorNacional: 1,
    situacaoEmissaoPadraoContribuintesRFB: 1,
    aderenteMAN: 0,
    permiteAproveitametoDeCreditos: true,
    ...m.convenio,
  };
}
