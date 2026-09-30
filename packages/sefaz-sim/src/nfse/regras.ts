/**
 * Regras de negócio da NFS-e simulada, como dado: cada regra tem o código de erro do Anexo I ou II, a fonte (a linha
 * da planilha oficial, lida do catálogo do `@sinete/rejeicoes/nfse`) e a condição. A lista é trocável por
 * `NfseSimOptions.regras`, e a ordem é a de avaliação: a primeira violada responde.
 *
 * Antes delas, o simulador aplica sempre a recepção (certificado do canal, base64, gzip, declaração UTF-8, prefixo de
 * namespace, schema) e a assinatura, na ordem da aba RN_RECEPCAO_DPS e do nível 1 da aba RN DPS_NFS-e.
 */

import { nfseErroPorCodigo } from '@sinete/rejeicoes/nfse';
import type { TCDPS, TCInfDPS, TCPedRegEvt } from '@sinete/schemas/nfse/1.01-20260727';
import type { AliquotaSim, MunicipioSim, NfseSimConfig, ServicoMunicipalSim } from './dados.ts';
import { convenioDe } from './dados.ts';

/** Uma NFS-e gerada pelo simulador. */
export interface NfseRegistro {
  readonly chave: string;
  readonly idDps: string;
  readonly xml: string;
  readonly emitente: { readonly CNPJ?: string; readonly CPF?: string };
  readonly cLocEmi: string;
  readonly serie: string;
  readonly nDPS: string;
  /** Instante do processamento (ms). */
  readonly processadaEm: number;
  /** `cancelada` pelo e101101, `substituida` pelo e105102 registrado na substituição. */
  situacao: 'normal' | 'cancelada' | 'substituida';
}

/** Um evento registrado. */
export interface EventoNfseRegistro {
  readonly chave: string;
  readonly tpEvento: string;
  readonly nSeqEvento: number;
  readonly id: string;
  readonly xml: string;
  /** Instante do registro (ms), no relógio da Sefin simulada. */
  readonly recebidoEm: number;
}

export interface DpsFatos {
  readonly config: NfseSimConfig;
  readonly dps: TCDPS;
  readonly inf: TCInfDPS;
  /** Instante do processamento (ms) e o `dhEmi` lido (ms), no relógio da Sefin simulada. */
  readonly now: number;
  readonly dhEmi: number;
  /** Dia do `dhEmi` em Brasília, `AAAA-MM-DD`. */
  readonly diaEmissao: string;
  readonly municipioEmissor: MunicipioSim | undefined;
  /** Município de incidência do ISSQN: o emissor (estabelecimento do prestador, regra geral da LC 116/2003). */
  readonly municipioIncidencia: MunicipioSim | undefined;
  readonly servico: ServicoMunicipalSim | undefined;
  readonly aliquota: AliquotaSim | undefined;
  /** NFS-e já gerada com a mesma série, número, município e emitente (E0014). */
  readonly duplicada: NfseRegistro | undefined;
  /** NFS-e apontada no `subst`, quando existe no simulador e é do mesmo emitente. */
  readonly substituida: NfseRegistro | undefined;
}

export interface EventoNfseFatos {
  readonly config: NfseSimConfig;
  readonly pedido: TCPedRegEvt;
  readonly tpEvento: string;
  readonly now: number;
  readonly nfse: NfseRegistro | undefined;
  readonly eventos: readonly EventoNfseRegistro[];
  readonly municipioEmissor: MunicipioSim | undefined;
}

export interface NfseSimRegra<F> {
  /** Código de erro do Anexo I ou II. */
  readonly codigo: string;
  /** Fonte: aba e linha da planilha oficial. */
  readonly fonte: string;
  /** `true` quando o documento viola a regra. */
  violada(f: F): boolean;
  /** Troca os marcadores da mensagem oficial (`<nome_evento_vinculado_a_NFS-e>`). */
  complemento?(f: F): Readonly<Record<string, string>>;
}

export interface NfseSimRegras {
  readonly dps: readonly NfseSimRegra<DpsFatos>[];
  readonly evento: readonly NfseSimRegra<EventoNfseFatos>[];
}

function fonte(codigo: string): string {
  const e = nfseErroPorCodigo(codigo);
  const r = e?.regras[0];
  return r === undefined ? 'sem regra no catálogo' : `${e?.fonte}, linha ${r.linha}`;
}

function regra<F>(
  codigo: string,
  violada: (f: F) => boolean,
  complemento?: NfseSimRegra<F>['complemento'],
): NfseSimRegra<F> {
  return { codigo, fonte: fonte(codigo), violada, ...(complemento === undefined ? {} : { complemento }) };
}

const NOMES_EVENTO: Readonly<Record<string, string>> = {
  '101101': 'Cancelamento de NFS-e',
  '105102': 'Cancelamento de NFS-e por Substituição',
  '101103': 'Solicitação de Análise Fiscal para Cancelamento de NFS-e',
};

/**
 * Emitente MEI na competência: E0037, E0038 e E0312 têm a exceção no Anexo I ("Exceto quando o emitente da DPS for MEI"). O
 * simulador lê o MEI pelo `opSimpNac` 2 do prestador emitente; a E1270 não tem essa exceção na planilha.
 */
const mei = (f: DpsFatos): boolean => f.inf.tpEmit === '1' && f.inf.prest.regTrib.opSimpNac === '2';

/** O ADN responde os indicadores do convênio como 0/1 ou booleano: os dois valem. */
const aderente = (v: number | boolean | undefined): boolean => v === 1 || v === true;

/** Eventos cujo autor tem de ser o emitente da NFS-e. */
const DO_EMITENTE = new Set(['101101', '101103']);
/** Eventos que só a Sefin registra: o contribuinte não é autor possível. */
const DA_SEFIN = new Set(['105102']);
function autorEmitente(f: EventoNfseFatos): boolean {
  const e = f.nfse?.emitente ?? {};
  const inf = f.pedido.infPedReg;
  return inf.CNPJAutor !== undefined ? inf.CNPJAutor === e.CNPJ : inf.CPFAutor === e.CPF;
}

function autorIndevido(f: EventoNfseFatos): boolean {
  return DA_SEFIN.has(f.tpEvento) || (DO_EMITENTE.has(f.tpEvento) && f.nfse !== undefined && !autorEmitente(f));
}

const CANCELAMENTOS = new Set(['101101', '105102']);

/** Regras padrão do simulador, na ordem de avaliação. */
export const NFSE_REGRAS_PADRAO: NfseSimRegras = {
  dps: [
    regra<DpsFatos>('E0006', (f) => f.inf.tpAmb !== f.config.tpAmb),
    regra<DpsFatos>('E0015', (f) => f.inf.dCompet > f.diaEmissao),
    regra<DpsFatos>('E0037', (f) => !mei(f) && f.municipioEmissor === undefined),
    regra<DpsFatos>(
      'E0038',
      (f) =>
        !mei(f) &&
        f.municipioEmissor !== undefined &&
        !aderente(convenioDe(f.municipioEmissor).aderenteEmissorNacional),
    ),
    regra<DpsFatos>('E1270', (f) => {
      const desde = f.municipioEmissor?.convenioDesde;
      return desde !== undefined && f.inf.dCompet < desde;
    }),
    regra<DpsFatos>('E0014', (f) => f.duplicada !== undefined),
    regra<DpsFatos>('E0042', (f) => f.inf.subst !== undefined && f.substituida === undefined),
    regra<DpsFatos>('E0046', (f) => f.substituida !== undefined && f.substituida.situacao !== 'normal'),
    regra<DpsFatos>(
      'E0312',
      (f) =>
        !mei(f) &&
        f.inf.valores.trib.tribMun.tribISSQN === '1' &&
        f.municipioIncidencia !== undefined &&
        f.aliquota === undefined,
    ),
    regra<DpsFatos>(
      'E0617',
      (f) =>
        f.inf.valores.trib.tribMun.pAliq !== undefined &&
        f.inf.prest.regTrib.opSimpNac === '1' &&
        f.municipioIncidencia !== undefined &&
        aderente(convenioDe(f.municipioIncidencia).aderenteEmissorNacional),
    ),
  ],
  evento: [
    regra<EventoNfseFatos>('E1845', (f) => f.pedido.infPedReg.tpAmb !== f.config.tpAmb),
    regra<EventoNfseFatos>('E1831', (f) => f.nfse === undefined),
    // Autor pela planilha "Tipo Eventos" do Anexo II: cancelamento e análise fiscal são do emitente da NFS-e; o
    // cancelamento por substituição (e105102) é da própria Sefin, registrado na emissão da substituta.
    regra<EventoNfseFatos>('E0813', (f) => f.pedido.infPedReg.CNPJAutor !== undefined && autorIndevido(f)),
    regra<EventoNfseFatos>('E0816', (f) => f.pedido.infPedReg.CPFAutor !== undefined && autorIndevido(f)),
    regra<EventoNfseFatos>(
      'E0840',
      (f) => CANCELAMENTOS.has(f.tpEvento) && f.eventos.some((e) => CANCELAMENTOS.has(e.tpEvento)),
      (f) => {
        const ja = f.eventos.find((e) => CANCELAMENTOS.has(e.tpEvento));
        return { '<nome_evento_vinculado_a_NFS-e>': NOMES_EVENTO[ja?.tpEvento ?? ''] ?? 'cancelamento' };
      },
    ),
    regra<EventoNfseFatos>('E0822', (f) => {
      const dias = f.municipioEmissor?.prazoCancelamentoDias;
      return (
        f.tpEvento === '101101' &&
        dias !== undefined &&
        f.nfse !== undefined &&
        f.now - f.nfse.processadaEm > dias * 86_400_000
      );
    }),
  ],
};

/** Mensagem oficial do código, com os marcadores trocados. */
export function mensagemDe(codigo: string, troca: Readonly<Record<string, string>> = {}): string {
  let m = nfseErroPorCodigo(codigo)?.mensagem ?? codigo;
  for (const [de, para] of Object.entries(troca)) m = m.replaceAll(de, para);
  return m;
}
