/**
 * Marcas d'água, carimbo de cancelamento e situação do protocolo. As marcas vão atrás do conteúdo (MOC 7.0, Anexo II,
 * 3.10.1). Quem decide a marca é a situação do documento (`situacaoNfe` e `situacaoMdfe`), com os textos e os códigos
 * de `data/leiaute.ts`:
 * - autorizado: sem marca (em homologação, "SEM VALOR FISCAL", Anexo II, 3);
 * - sem protocolo na emissão normal (prévia, XML gravado sem `protNFe`, SVC sem protocolo, EPEC sem o registro do
 *   evento, protocolo com cStat que não é de autorização): "SEM VALOR FISCAL";
 * - contingência em que o documento vale antes da autorização (FS-IA, FS-DA, off-line, EPEC registrado): "EMITIDA EM
 *   CONTINGÊNCIA" e "PENDENTE DE AUTORIZAÇÃO", sem "SEM VALOR FISCAL";
 * - denegado (cStat 110, 301, 302 e 303): "DENEGADA", com o motivo da tabela 4.4.3 e o protocolo de denegação;
 * - cancelado: "CANCELADA", com o protocolo do evento quando ele é passado, ou pelo cStat de cancelamento gravado no
 *   próprio protocolo (NF-e 101, 151 e 155; MDF-e 101), com o `nProt` no campo do protocolo de autorização.
 */

import { CONTINGENCIA_OFFLINE, MARCAS, SITUACAO_MDFE, SITUACAO_NFE } from '../data/leiaute.ts';
import * as f from '../format.ts';
import type { MdfeView } from '../input/mdfe.ts';
import type { NotaView } from '../input/nfe.ts';
import type { Canvas } from '../render/canvas.ts';
import { watermark } from './common.ts';

/** Dados do cancelamento para o carimbo; sem protocolo, o carimbo sai só com "CANCELADA". */
export interface Cancelamento {
  readonly nProt?: string;
  readonly dhRegEvento?: string;
  /** Texto do carimbo (padrão "CANCELADA"; o DAMDFE usa "CANCELADO"). */
  readonly rotulo?: string;
}

/** Situação do documento para as marcas e para o campo do protocolo. */
export type Situacao =
  | { readonly tipo: 'autorizada'; readonly nProt: string; readonly dhRecbto: string }
  | { readonly tipo: 'contingencia' }
  | { readonly tipo: 'sem-protocolo' }
  /**
   * cStat de cancelamento gravado no protocolo por quem importou o documento. O `nProt` e o `dhRecbto` ficam como
   * estavam no protocolo, e são os da autorização: a SEFAZ só cancela documento autorizado e nunca devolve protocolo
   * com esse cStat (MOC 7.0, Visão Geral, 5.4.2, ER08 e ER09).
   */
  | { readonly tipo: 'cancelada'; readonly cStat: string; readonly nProt: string; readonly dhRecbto: string }
  | {
      readonly tipo: 'denegada';
      readonly cStat: string;
      readonly motivo: string;
      readonly nProt: string;
      readonly dhRecbto: string;
    };

/**
 * Situação da NF-e ou da NFC-e pelo protocolo e pela forma de emissão. `epec` diz se o chamador passou o protocolo do
 * EPEC: sem ele, a NF-e com `tpEmis` 4 ainda não pode circular (MOC 7.0, Anexo II, 3.9.3).
 */
export function situacaoNfe(nota: NotaView, epec: boolean): Situacao {
  const p = nota.prot;
  // Autorização sem número de protocolo não se comprova: fica como sem protocolo. A denegação, que só restringe o uso,
  // vale pelo cStat.
  if (p?.nProt && SITUACAO_NFE.autorizada.includes(p.cStat)) {
    return { tipo: 'autorizada', nProt: p.nProt, dhRecbto: p.dhRecbto };
  }
  if (p && SITUACAO_NFE.cancelada.includes(p.cStat)) {
    return { tipo: 'cancelada', cStat: p.cStat, nProt: p.nProt, dhRecbto: p.dhRecbto };
  }
  const motivo = p ? SITUACAO_NFE.denegada[p.cStat] : undefined;
  if (p && motivo) return { tipo: 'denegada', cStat: p.cStat, motivo, nProt: p.nProt, dhRecbto: p.dhRecbto };
  // Protocolo presente com outro cStat já é o desfecho: a autorização não está mais por vir, nem em contingência.
  if (p) return { tipo: 'sem-protocolo' };
  if (CONTINGENCIA_OFFLINE.nfe.includes(nota.tpEmis) || (epec && nota.tpEmis === CONTINGENCIA_OFFLINE.epec)) {
    return { tipo: 'contingencia' };
  }
  return { tipo: 'sem-protocolo' };
}

/**
 * Situação do MDF-e: o MDF-e não tem denegação (MOC MDF-e 3.00b, Visão Geral, 4.2.6); o encerrado (132) continua
 * autorizado e o cancelado (101) leva o carimbo.
 */
export function situacaoMdfe(m: MdfeView): Situacao {
  const p = m.prot;
  if (p?.nProt && (SITUACAO_MDFE.autorizada.includes(p.cStat) || SITUACAO_MDFE.encerrada.includes(p.cStat))) {
    return { tipo: 'autorizada', nProt: p.nProt, dhRecbto: p.dhRecbto };
  }
  if (p && SITUACAO_MDFE.cancelada.includes(p.cStat)) {
    return { tipo: 'cancelada', cStat: p.cStat, nProt: p.nProt, dhRecbto: p.dhRecbto };
  }
  // Protocolo presente com outro cStat já é o desfecho, mesmo em contingência.
  if (p) return { tipo: 'sem-protocolo' };
  return CONTINGENCIA_OFFLINE.mdfe.includes(m.tpEmis) ? { tipo: 'contingencia' } : { tipo: 'sem-protocolo' };
}

/**
 * Protocolo de autorização de uso para o campo do protocolo: o da nota autorizada e o que ficou no protocolo da nota
 * cancelada pelo cStat.
 */
export function protocoloDeUso(s: Situacao): { readonly nProt: string; readonly dhRecbto: string } | undefined {
  if (s.tipo === 'autorizada') return s;
  if (s.tipo === 'cancelada' && s.nProt) return s;
  return undefined;
}

/**
 * Carimbo de cancelamento: o do evento passado pelo chamador, que traz o protocolo do cancelamento, prevalece; sem
 * ele, o cStat de cancelamento no protocolo carimba sem o protocolo do evento, que o XML não tem.
 */
export function carimbo(s: Situacao, cancel: Cancelamento | undefined, rotulo?: string): Cancelamento | undefined {
  if (cancel) return cancel;
  if (s.tipo !== 'cancelada') return undefined;
  return rotulo ? { rotulo } : {};
}

/**
 * Aviso de uma linha para o corpo do documento (informações complementares no A4, área de mensagem fiscal na bobina,
 * rodapé no simplificado), onde o MOC 7.0, Anexo II, 3 também admite o "SEM VALOR FISCAL".
 */
export function avisoSituacao(s: Situacao): string {
  if (s.tipo === 'sem-protocolo') return `${MARCAS.semProtocolo} - ${MARCAS.semValor}`;
  if (s.tipo === 'denegada') return `${MARCAS.denegada} - ${s.motivo.toUpperCase()}`;
  return '';
}

export function marcas(
  c: Canvas,
  pageW: number,
  pageH: number,
  tpAmb: string,
  /** Sem situação (DACCE), só as marcas de homologação e de cancelamento. */
  situacao: Situacao | undefined,
  cancel: Cancelamento | undefined,
  contingencia: readonly string[] = MARCAS.contingencia,
): void {
  const lines: string[] = [];
  if (cancel) {
    lines.push(cancel.rotulo ?? 'CANCELADA');
    if (cancel.nProt) lines.push(`PROTOCOLO ${cancel.nProt} ${f.dataHora(cancel.dhRegEvento)}`.trim());
  } else if (situacao?.tipo === 'denegada') {
    lines.push(
      MARCAS.denegada,
      situacao.motivo.toUpperCase(),
      `PROTOCOLO ${situacao.nProt} ${f.dataHora(situacao.dhRecbto)}`.trim(),
    );
  } else if (situacao?.tipo === 'contingencia') lines.push(...contingencia);
  else if (situacao?.tipo === 'sem-protocolo') lines.push(MARCAS.semValor, MARCAS.semProtocolo);
  if (tpAmb === '2') {
    if (lines.length === 0) lines.push(MARCAS.semValor, MARCAS.homologacao);
    else if (lines[0] === MARCAS.semValor) lines.push(MARCAS.homologacao);
    else lines.push(MARCAS.semValor);
  }
  const forte = cancel !== undefined || situacao?.tipo === 'denegada';
  if (lines.length) watermark(c, pageW, pageH, lines, forte ? 0.72 : 0.82);
}
