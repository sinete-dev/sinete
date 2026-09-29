/**
 * `@sinete/emissor/mdfe`: o emissor de MDF-e (`createMdfeEmissor`) e o perfil do MDF-e (`perfilMdfe`).
 *
 * Importa o `@sinete/mdfe` (peer dependency) de forma estática; a raiz do `@sinete/emissor` não o importa.
 *
 * Mesma política da NF-e, com as diferenças do protocolo: a recepção é síncrona (sem recibo), não há denegação, e a
 * consulta pode achar o MDF-e já cancelado ou encerrado fora deste fluxo (`situacaoAtual`). O autorizador é único
 * (SVRS), e o `MdfeClient` confere o `tpAmb` do MDF-e antes do envio, porque ele vai comprimido onde a política do
 * transporte não enxerga.
 */

import type { Rejected } from '@sinete/core';
import { timeContext, ValidationError } from '@sinete/core';
import type {
  AutorDocumento,
  AutorizacaoOutcome,
  BuildMdfeOptions,
  ConsultaOutcome,
  EncerramentoPedido,
  EventoOutcome,
  EventoRegistrado,
  MdfeClient,
  MdfeClientOptions,
  MdfeInput,
  ProtocoloMdfe,
  RecuperacaoEvento,
  ResolucaoEnvio,
} from '@sinete/mdfe';
import {
  buildMdfe,
  createMdfeClient,
  documentoAssinado,
  recuperarEventoRegistrado,
  resolverEnvioSemResposta,
  signMdfe,
} from '@sinete/mdfe';
import { conteudoMdfe } from './conteudo.ts';
import { codigosDe } from './cstat.ts';
import { carregadorDa } from './da.ts';
import type { Desfecho, DesfechoEvento } from './desfecho.ts';
import { semResposta } from './desfecho.ts';
import type { ContextoEmissor, Emissor, OpcoesEmissor, PerfilDocumento } from './emissor.ts';
import { createEmissor } from './emissor.ts';
import { eventoRecusado, eventoRegistrado, statusDoRetorno } from './evento.ts';

/** De onde sai o desfecho do MDF-e: a autorização ou a consulta da chave. */
export type BrutoMdfe = AutorizacaoOutcome | ConsultaOutcome;

/** Desfecho de `emitir` e `retomar` do MDF-e. Nunca `denegado`. */
export type DesfechoMdfe = Desfecho<ProtocoloMdfe, BrutoMdfe>;

/** Desfecho do `cancelar` do MDF-e: o evento, ou a consulta que o recuperou. */
export type DesfechoCancelamentoMdfe = DesfechoEvento<EventoRegistrado, EventoOutcome | ConsultaOutcome>;

/** Opções da montagem além do ambiente (relógio da emissão, contingência off-line, responsável técnico). */
export type MontagemMdfe = Omit<Partial<BuildMdfeOptions>, 'ambiente'>;

/** O manifesto com opções de montagem só dele (a data de emissão que o integrador fixou), por cima das do emissor. */
export interface ManifestoComMontagem {
  readonly mdfe: MdfeInput;
  readonly montagem: MontagemMdfe;
}

/** A entrada do emissor de MDF-e: o manifesto, ou o manifesto com a montagem dele. */
export type EntradaMdfe = MdfeInput | ManifestoComMontagem;

export interface OpcoesPerfilMdfe {
  /** Opções da montagem de todos os manifestos; `ManifestoComMontagem` soma as de um manifesto. */
  readonly montagem?: MontagemMdfe;
  /** Opções do cliente além das que o emissor preenche (fuso, endpoints). */
  readonly cliente?: Omit<Partial<MdfeClientOptions>, 'transport' | 'signer' | 'ambiente' | 'clock'>;
}

const CODIGOS = codigosDe('mdfe');

/** Cancelamento (MOC MDF-e 3.00b, evento 110111). */
const CANCELAMENTO = '110111';

const chaveDe = (xml: string): string => documentoAssinado(xml, 'MDFe', 'infMDFe').id.slice(4);

function autorDe(ctx: ContextoEmissor): AutorDocumento | undefined {
  if (ctx.titular.cnpj !== undefined) return { CNPJ: ctx.titular.cnpj };
  if (ctx.titular.cpf !== undefined) return { CPF: ctx.titular.cpf };
  return undefined;
}

/** Perfil do MDF-e para o `createEmissor` da raiz. */
export function perfilMdfe(
  opcoes: OpcoesPerfilMdfe = {},
): PerfilDocumento<EntradaMdfe, MdfeClient, ProtocoloMdfe, BrutoMdfe> {
  const recusado = (id: string, r: Rejected, bruto: BrutoMdfe): DesfechoMdfe => ({
    documento: 'mdfe',
    tipo: 'recusado',
    id,
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    ...(r.hint === undefined ? {} : { hint: r.hint }),
    bruto,
  });

  /** Autoriza; sem resposta, 204 ou 539, resolve pela consulta. `reenvia` limita o reenvio a um. */
  async function autorizar(cli: MdfeClient, xml: string, reenvia: boolean): Promise<DesfechoMdfe> {
    const id = chaveDe(xml);
    let r: AutorizacaoOutcome;
    try {
      r = await cli.autorizar(xml);
    } catch (e) {
      if (!semResposta(e)) throw e;
      return resolver(cli, xml, undefined, e, reenvia);
    }
    switch (r.status) {
      case 'rejected':
        return CODIGOS.duplicidade.has(r.cStat) ? resolver(cli, xml, r, undefined, reenvia) : recusado(id, r, r);
      case 'authorized': {
        const p = r.value;
        // Protocolo sem digVal: nada prova que é destes bytes; a consulta decide.
        if (p.mdfeProc === undefined) return resolver(cli, xml, undefined, undefined, false);
        return {
          documento: 'mdfe',
          tipo: 'autorizado',
          id,
          cStat: r.cStat,
          xMotivo: r.xMotivo,
          proc: p.mdfeProc,
          protocolo: p,
          bruto: r,
        };
      }
      default:
        // Sem lote assíncrono no MDF-e: pendência na recepção síncrona só pode ser resolvida pela consulta.
        return {
          documento: 'mdfe',
          tipo: 'pendente',
          id,
          motivo: 'lote-em-processamento',
          cStat: r.cStat,
          xMotivo: r.xMotivo,
          bruto: r,
        };
    }
  }

  async function resolver(
    cli: MdfeClient,
    xml: string,
    anterior: Rejected | undefined,
    erroEnvio: unknown,
    reenvia: boolean,
  ): Promise<DesfechoMdfe> {
    const id = chaveDe(xml);
    // A recusa que levou à consulta vai junto da pendência: é o que o emitente precisa ver.
    const ant = anterior === undefined ? {} : { anterior: { cStat: anterior.cStat, xMotivo: anterior.xMotivo } };
    let res: ResolucaoEnvio;
    try {
      res = await resolverEnvioSemResposta(cli, xml, anterior);
    } catch (e) {
      if (!semResposta(e)) throw e;
      return { documento: 'mdfe', tipo: 'pendente', id, motivo: 'sem-resposta', causa: erroEnvio ?? e, ...ant };
    }
    switch (res.acao) {
      case 'concluida': {
        const o = res.outcome;
        if (o.status === 'authorized' && o.value.mdfeProc !== undefined) {
          return {
            documento: 'mdfe',
            tipo: 'autorizado',
            id,
            cStat: o.cStat,
            xMotivo: o.xMotivo,
            proc: o.value.mdfeProc,
            protocolo: o.value,
            ...(res.situacao === 'autorizado' ? {} : { situacaoAtual: res.situacao }),
            bruto: o,
          };
        }
        return { documento: 'mdfe', tipo: 'pendente', id, motivo: 'consulta-indefinida', ...ant, bruto: o };
      }
      case 'indefinida':
        return {
          documento: 'mdfe',
          tipo: 'pendente',
          id,
          motivo: 'consulta-indefinida',
          cStat: res.outcome.cStat,
          xMotivo: res.outcome.xMotivo,
          ...ant,
          bruto: res.outcome,
        };
      case 'divergente':
        return {
          documento: 'mdfe',
          tipo: 'divergente',
          id,
          ...(res.chMDFe === undefined ? {} : { chaveRegistrada: res.chMDFe }),
          ...(res.consulta === undefined
            ? { cStat: res.motivo.cStat, xMotivo: res.motivo.xMotivo }
            : {
                conteudo: 'difere',
                xMotivo: 'a chave está autorizada com outro conteúdo (o digVal não confere com os bytes gravados)',
              }),
          bruto: res.motivo,
        };
      case 'sem-prova':
        // Nem a resposta nem a consulta trazem o digVal: nada prova que o MDF-e autorizado é o destes bytes, e esperar
        // não muda a resposta da consulta. Os bytes ficam, e a retomada alerta na primeira.
        return {
          documento: 'mdfe',
          tipo: 'divergente',
          id,
          conteudo: 'sem-digval',
          cStat: res.consulta.cStat,
          xMotivo:
            'a chave está autorizada, mas o protocolo não traz o digVal: nada prova que o MDF-e autorizado é o destes bytes',
          ...(res.situacao === 'autorizado' ? {} : { situacaoAtual: res.situacao }),
          bruto: res.consulta,
        };
      case 'reenviar':
        if (reenvia) return autorizar(cli, res.mdfeAssinado, false);
        if (anterior !== undefined) return recusado(id, anterior, anterior);
        if (erroEnvio !== undefined) {
          return { documento: 'mdfe', tipo: 'pendente', id, motivo: 'sem-resposta', causa: erroEnvio };
        }
        return {
          documento: 'mdfe',
          tipo: 'pendente',
          id,
          motivo: 'consulta-indefinida',
          xMotivo: 'o MDF-e não consta depois do reenvio',
        };
    }
  }

  return {
    tipo: 'mdfe',
    indefinido: (cStat: string): boolean => CODIGOS.indefinido.has(cStat),
    transitorio: (cStat: string): boolean => CODIGOS.transitorio.has(cStat),
    recusaPorCampoVolatil: (cStat: string): boolean => CODIGOS.campoVolatil.has(cStat),
    conteudoParaRecusa: conteudoMdfe,
    criarCliente(ctx: ContextoEmissor): MdfeClient {
      const autor = autorDe(ctx);
      return createMdfeClient({
        transport: ctx.transporte(),
        signer: ctx.signer,
        ambiente: ctx.ambiente,
        clock: ctx.clock,
        ...(autor === undefined ? {} : { autor }),
        ...(ctx.logger === undefined ? {} : { logger: ctx.logger }),
        ...(ctx.timeoutMs === undefined ? {} : { timeoutMs: ctx.timeoutMs }),
        ...opcoes.cliente,
      });
    },
    async assinar(entrada: EntradaMdfe, ctx: ContextoEmissor): Promise<{ readonly id: string; readonly xml: string }> {
      const [mdfe, doManifesto] = 'montagem' in entrada ? [entrada.mdfe, entrada.montagem] : [entrada, undefined];
      const r = buildMdfe(mdfe, {
        time: timeContext({ emissao: ctx.clock }),
        ...opcoes.montagem,
        ...doManifesto,
        ambiente: ctx.ambiente,
      });
      if (!r.ok) throw new ValidationError('o MDF-e não passou na validação', r.issues);
      return { id: r.value.chave, xml: await signMdfe(r.value, ctx.signer) };
    },
    enviar: (cli: MdfeClient, xml: string, modo: 'primeiro' | 'retomada'): Promise<DesfechoMdfe> =>
      modo === 'primeiro' ? autorizar(cli, xml, true) : resolver(cli, xml, undefined, undefined, true),
  };
}

/** O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/mdfe` serve como está. */
export interface ModuloDamdfe {
  damdfe(xml: string, opcoes?: object): unknown;
  toPdf(doc: never): Uint8Array;
}

export interface MdfeEmissorOptions extends OpcoesEmissor<ProtocoloMdfe, BrutoMdfe>, OpcoesPerfilMdfe {
  /**
   * Módulo `@sinete/da/mdfe` para o `pdf` e o `pdfCancelado`. Padrão: importado na primeira chamada, se estiver
   * instalado (Node e Bun). No Deno e num bundle de browser, importe `@sinete/da/mdfe` de forma estática e passe aqui.
   */
  readonly da?: ModuloDamdfe;
}

/** Pedido de cancelamento do emissor. Sem `nProt`, o emissor o tira da consulta da chave. */
export interface CancelamentoMdfeEmissor {
  readonly chave: string;
  readonly xJust: string;
  readonly nProt?: string | undefined;
}

export interface MdfeEmissor extends Emissor<EntradaMdfe, MdfeClient, ProtocoloMdfe, BrutoMdfe> {
  consultar(chave: string, mdfeAssinado?: string): Promise<ConsultaOutcome>;
  /**
   * Cancela (110111) com recuperação: sem `nProt`, consulta a chave e, se o MDF-e já está cancelado, devolve o evento
   * registrado; sem resposta, ou com duplicidade de evento (631), confirma pela consulta se a SEFAZ registrou o
   * cancelamento (`recuperado: true`). Nunca conclui pelo `cStat` sozinho.
   */
  cancelar(pedido: CancelamentoMdfeEmissor): Promise<DesfechoCancelamentoMdfe>;
  /** Encerramento na chegada (110112). */
  encerrar(pedido: EncerramentoPedido): Promise<EventoOutcome>;
  /** PDF do DAMDFE a partir do `mdfeProc` (`opcoes` são as do `damdfe`: `documentos`, `logo`). */
  pdf(mdfeProc: string, opcoes?: object): Promise<Uint8Array>;
  /**
   * PDF do DAMDFE com a marca de cancelado e o protocolo do evento. Só o render: guardar é do integrador. Se a marca
   * falhar, lança, e o integrador decide manter o PDF antigo.
   */
  pdfCancelado(mdfeProc: string, procEventoMDFe: string, opcoes?: object): Promise<Uint8Array>;
}

/**
 * Abre o PFX e devolve o emissor de MDF-e. Nada vai à rede até a primeira operação que precisa dela; o certificado
 * fora da validade é recusado aqui (`CertError`).
 */
export async function createMdfeEmissor(opcoes: MdfeEmissorOptions): Promise<MdfeEmissor> {
  const base = await createEmissor(perfilMdfe(opcoes), opcoes);
  const da = carregadorDa<ModuloDamdfe>('mdfe', opcoes.da);

  type Bruto = EventoOutcome | ConsultaOutcome;
  const registrado = (e: EventoRegistrado, recuperado: boolean, bruto: Bruto): DesfechoCancelamentoMdfe =>
    eventoRegistrado(e, e.procEventoMDFe, statusDoRetorno(e.retEventoMDFe), recuperado, bruto);

  async function recuperar(
    chave: string,
    falha: { readonly erro: unknown } | Rejected,
  ): Promise<DesfechoCancelamentoMdfe> {
    let rec: RecuperacaoEvento;
    try {
      rec = await recuperarEventoRegistrado(base.cliente, chave, CANCELAMENTO);
    } catch (e) {
      if (!semResposta(e)) throw e;
      return { tipo: 'pendente', motivo: 'sem-resposta', causa: 'erro' in falha ? falha.erro : e };
    }
    if (rec.registrado) return registrado(rec.evento, true, rec.consulta);
    if ('erro' in falha) return { tipo: 'pendente', motivo: 'sem-resposta', causa: falha.erro, bruto: rec.consulta };
    return eventoRecusado(falha, rec.consulta);
  }

  async function cancelar(p: CancelamentoMdfeEmissor): Promise<DesfechoCancelamentoMdfe> {
    let nProt = p.nProt;
    if (nProt === undefined) {
      let rec: RecuperacaoEvento;
      try {
        rec = await recuperarEventoRegistrado(base.cliente, p.chave, CANCELAMENTO);
      } catch (e) {
        if (!semResposta(e)) throw e;
        return { tipo: 'pendente', motivo: 'sem-resposta', causa: e };
      }
      if (rec.registrado) return registrado(rec.evento, true, rec.consulta);
      const c = rec.consulta;
      const achado =
        c.status === 'authorized' && c.value.situacao === 'autorizado' ? c.value.protocolo?.nProt : undefined;
      if (achado === undefined) {
        // Não consta ou rejeitado: não há o que cancelar. Encerrado não se cancela (o cancelamento recusa, pelo cStat da
        // SEFAZ); cancelado sem o evento legível, ou sem protocolo, a consulta não decidiu.
        if (c.status === 'rejected') return eventoRecusado(c, c);
        return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: c.cStat, xMotivo: c.xMotivo, bruto: c };
      }
      nProt = achado;
    }
    let o: EventoOutcome;
    try {
      o = await base.cliente.cancelar({ chave: p.chave, nProt, xJust: p.xJust });
    } catch (e) {
      if (!semResposta(e)) throw e;
      return recuperar(p.chave, { erro: e });
    }
    switch (o.status) {
      case 'authorized':
        return registrado(o.value, false, o);
      case 'rejected':
        return CODIGOS.eventoJaRegistrado.has(o.cStat) ? recuperar(p.chave, o) : eventoRecusado(o, o);
      default:
        return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: o.cStat, xMotivo: o.xMotivo, bruto: o };
    }
  }

  return {
    tipo: base.tipo,
    titular: base.titular,
    emitir: base.emitir,
    assinar: base.assinar,
    retomar: base.retomar,
    fechar: base.fechar,
    get cliente(): MdfeClient {
      return base.cliente;
    },
    consultar: (chave: string, mdfeAssinado?: string): Promise<ConsultaOutcome> =>
      base.cliente.consultar(chave, mdfeAssinado),
    cancelar,
    encerrar: (pedido: EncerramentoPedido): Promise<EventoOutcome> => base.cliente.encerrar(pedido),
    async pdf(mdfeProc: string, o?: object): Promise<Uint8Array> {
      const m = await da();
      return (m.toPdf as (doc: unknown) => Uint8Array)(m.damdfe(mdfeProc, o));
    },
    async pdfCancelado(mdfeProc: string, procEventoMDFe: string, o?: object): Promise<Uint8Array> {
      const m = await da();
      return (m.toPdf as (doc: unknown) => Uint8Array)(m.damdfe(mdfeProc, { ...o, cancelado: procEventoMDFe }));
    },
  };
}
