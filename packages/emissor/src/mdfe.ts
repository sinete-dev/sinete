/**
 * `@sinete/emissor/mdfe`: o emissor de MDF-e (`criarEmissorMdfe`) e o perfil do MDF-e (`perfilMdfe`).
 *
 * Importa o `@sinete/mdfe` (peer dependency) de forma estática; a raiz do `@sinete/emissor` não o importa.
 *
 * Mesma política da NF-e, com as diferenças do protocolo: a recepção é síncrona (sem recibo), não há denegação, e a
 * consulta pode achar o MDF-e já cancelado ou encerrado fora deste fluxo (`situacaoAtual`). O autorizador é único
 * (SVRS), e o `ClienteMdfe` confere o `tpAmb` do MDF-e antes do envio, porque ele vai comprimido onde a política do
 * transporte não enxerga.
 */

import type { Recusado } from '@sinete/core';
import { contextoDeTempo, ErroDeValidacao } from '@sinete/core';
import { descendentes, lerXml, textoDe } from '@sinete/core/xml';
import type {
  AutorDocumento,
  ClienteMdfe,
  ClienteMdfeOpcoes,
  DadosMdfe,
  EncerramentoPedido,
  EventoRegistrado,
  MontarMdfeOpcoes,
  ProtocoloMdfe,
  RecuperacaoEvento,
  ResolucaoEnvio,
  ResultadoAutorizacao,
  ResultadoConsulta,
  ResultadoEvento,
} from '@sinete/mdfe';
import {
  assinarMdfe,
  criarClienteMdfe,
  documentoAssinado,
  montarMdfe,
  recuperarEventoRegistrado,
  resolverEnvioSemResposta,
} from '@sinete/mdfe';
import { conteudoMdfe } from './conteudo.ts';
import { codigosDe } from './cstat.ts';
import type { PdfMdfeOpcoes } from './da.ts';
import { carregadorDa } from './da.ts';

export type { PdfMdfeOpcoes, ProtocoloDoEvento } from './da.ts';

import type { Desfecho, DesfechoEvento } from './desfecho.ts';
import { semResposta } from './desfecho.ts';
import type { ContextoEmissor, Emissor, EmissorOpcoes, PerfilDocumento } from './emissor.ts';
import { criarEmissor } from './emissor.ts';
import { eventoRecusado, eventoRegistrado, statusDoRetorno } from './evento.ts';

/** De onde sai o desfecho do MDF-e: a autorização ou a consulta da chave. */
export type BrutoMdfe = ResultadoAutorizacao | ResultadoConsulta;

/** Desfecho de `emitir` e `retomar` do MDF-e. Nunca `denegado`. */
export type DesfechoMdfe = Desfecho<ProtocoloMdfe, BrutoMdfe>;

/** Desfecho do `cancelar` do MDF-e: o evento, ou a consulta que o recuperou. */
export type DesfechoCancelamentoMdfe = DesfechoEvento<EventoRegistrado, ResultadoEvento | ResultadoConsulta>;

/** Desfecho do `encerrar` do MDF-e: o evento, ou a consulta que o recuperou. */
export type DesfechoEncerramentoMdfe = DesfechoEvento<EventoRegistrado, ResultadoEvento | ResultadoConsulta>;

/** Opções da montagem além do ambiente (relógio da emissão, contingência off-line, responsável técnico). */
export type MontagemMdfe = Omit<Partial<MontarMdfeOpcoes>, 'ambiente'>;

/** O manifesto com opções de montagem só dele (a data de emissão que o integrador fixou), por cima das do emissor. */
export interface ManifestoComMontagem {
  readonly mdfe: DadosMdfe;
  readonly montagem: MontagemMdfe;
}

/** A entrada do emissor de MDF-e: o manifesto, ou o manifesto com a montagem dele. */
export type EntradaMdfe = DadosMdfe | ManifestoComMontagem;

export interface PerfilMdfeOpcoes {
  /** Opções da montagem de todos os manifestos; `ManifestoComMontagem` soma as de um manifesto. */
  readonly montagem?: MontagemMdfe;
  /** Opções do cliente além das que o emissor preenche (fuso, endpoints). */
  readonly cliente?: Omit<Partial<ClienteMdfeOpcoes>, 'transporte' | 'assinador' | 'ambiente' | 'relogio'>;
}

const CODIGOS = codigosDe('mdfe');

/** Cancelamento (MOC MDF-e 3.00b, evento 110111). */
const CANCELAMENTO = '110111';
/** Encerramento (MOC MDF-e 3.00b, evento 110112). */
const ENCERRAMENTO = '110112';

/** O evento que a recuperação procura na consulta da chave. */
interface BuscaDoEvento {
  readonly tpEvento: string;
  /** O evento registrado é o deste pedido (mesmo conteúdo)? Sem ela, basta o tipo. */
  readonly confere?: (evento: EventoRegistrado) => boolean;
  /** Situação que a consulta mostra quando o evento foi registrado, mesmo sem o evento legível. */
  readonly situacao?: 'cancelado' | 'encerrado';
}

/** `cMun` do encerramento dentro do `procEventoMDFe`. */
function cMunDoEncerramento(procEventoMDFe: string): string | undefined {
  for (const el of descendentes(lerXml(procEventoMDFe).raiz)) if (el.local === 'cMun') return textoDe(el);
  return undefined;
}

const chaveDe = (xml: string): string => documentoAssinado(xml, 'MDFe', 'infMDFe').id.slice(4);

function autorDe(ctx: ContextoEmissor): AutorDocumento | undefined {
  if (ctx.titular.cnpj !== undefined) return { CNPJ: ctx.titular.cnpj };
  if (ctx.titular.cpf !== undefined) return { CPF: ctx.titular.cpf };
  return undefined;
}

/** Perfil do MDF-e para o `criarEmissor` da raiz. */
export function perfilMdfe(
  opcoes: PerfilMdfeOpcoes = {},
): PerfilDocumento<EntradaMdfe, ClienteMdfe, ProtocoloMdfe, BrutoMdfe> {
  const recusado = (id: string, r: Recusado, bruto: BrutoMdfe): DesfechoMdfe => ({
    documento: 'mdfe',
    tipo: 'recusado',
    id,
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    ...(r.dica === undefined ? {} : { dica: r.dica }),
    bruto,
  });

  /** Autoriza; sem resposta, 204 ou 539, resolve pela consulta. `reenvia` limita o reenvio a um. */
  async function autorizar(cli: ClienteMdfe, xml: string, reenvia: boolean): Promise<DesfechoMdfe> {
    const id = chaveDe(xml);
    let r: ResultadoAutorizacao;
    try {
      r = await cli.autorizar(xml);
    } catch (e) {
      if (!semResposta(e)) throw e;
      return resolver(cli, xml, undefined, e, reenvia);
    }
    switch (r.tipo) {
      case 'recusado':
        return CODIGOS.duplicidade.has(r.cStat) ? resolver(cli, xml, r, undefined, reenvia) : recusado(id, r, r);
      case 'autorizado': {
        const p = r.valor;
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
    cli: ClienteMdfe,
    xml: string,
    anterior: Recusado | undefined,
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
        const o = res.resultado;
        if (o.tipo === 'autorizado' && o.valor.mdfeProc !== undefined) {
          return {
            documento: 'mdfe',
            tipo: 'autorizado',
            id,
            cStat: o.cStat,
            xMotivo: o.xMotivo,
            proc: o.valor.mdfeProc,
            protocolo: o.valor,
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
          cStat: res.resultado.cStat,
          xMotivo: res.resultado.xMotivo,
          ...ant,
          bruto: res.resultado,
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
    criarCliente(ctx: ContextoEmissor): ClienteMdfe {
      const autor = autorDe(ctx);
      return criarClienteMdfe({
        transporte: ctx.transporte(),
        assinador: ctx.assinador,
        ambiente: ctx.ambiente,
        relogio: ctx.relogio,
        ...(autor === undefined ? {} : { autor }),
        ...(ctx.logger === undefined ? {} : { logger: ctx.logger }),
        ...(ctx.timeoutMs === undefined ? {} : { timeoutMs: ctx.timeoutMs }),
        ...opcoes.cliente,
      });
    },
    async assinar(entrada: EntradaMdfe, ctx: ContextoEmissor): Promise<{ readonly id: string; readonly xml: string }> {
      const [mdfe, doManifesto] = 'montagem' in entrada ? [entrada.mdfe, entrada.montagem] : [entrada, undefined];
      const r = await montarMdfe(mdfe, {
        tempo: contextoDeTempo({ emissao: ctx.relogio }),
        ...opcoes.montagem,
        ...doManifesto,
        ambiente: ctx.ambiente,
      });
      if (!r.ok) throw new ErroDeValidacao('o MDF-e não passou na validação', r.ocorrencias);
      return { id: r.valor.chave, xml: await assinarMdfe(r.valor, ctx.assinador) };
    },
    enviar: (cli: ClienteMdfe, xml: string, modo: 'primeiro' | 'retomada'): Promise<DesfechoMdfe> =>
      modo === 'primeiro' ? autorizar(cli, xml, true) : resolver(cli, xml, undefined, undefined, true),
  };
}

/** O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/mdfe` serve como está. */
export interface ModuloDamdfe {
  damdfe(xml: string, opcoes?: PdfMdfeOpcoes): unknown;
  gerarPdf(documento: never): Uint8Array;
}

export interface EmissorMdfeOpcoes extends EmissorOpcoes<ProtocoloMdfe, BrutoMdfe>, PerfilMdfeOpcoes {
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

export interface EmissorMdfe extends Emissor<EntradaMdfe, ClienteMdfe, ProtocoloMdfe, BrutoMdfe> {
  consultar(chave: string, mdfeAssinado?: string): Promise<ResultadoConsulta>;
  /**
   * Cancela (110111) com recuperação: sem `nProt`, consulta a chave e, se o MDF-e já está cancelado, devolve o evento
   * registrado; sem resposta, ou com duplicidade de evento (631), confirma pela consulta se a SEFAZ registrou o
   * cancelamento (`recuperado: true`). Nunca conclui pelo `cStat` sozinho.
   */
  cancelar(pedido: CancelamentoMdfeEmissor): Promise<DesfechoCancelamentoMdfe>;
  /**
   * Encerramento na chegada (110112) com a mesma recuperação do `cancelar`: sem resposta, ou com duplicidade de evento
   * (631), confirma pela consulta se a SEFAZ registrou o encerramento neste município (`recuperado: true`). Já
   * encerrado em outro município, a SEFAZ recusa o pedido e o desfecho é `recusado`; encerrado sem o evento legível na
   * consulta, `pendente`.
   */
  encerrar(pedido: EncerramentoPedido): Promise<DesfechoEncerramentoMdfe>;
  /** PDF do DAMDFE a partir do `mdfeProc` (`opcoes` são as do `damdfe` do `@sinete/da/mdfe`). */
  pdf(mdfeProc: string, opcoes?: PdfMdfeOpcoes): Promise<Uint8Array>;
  /**
   * PDF do DAMDFE com a marca de cancelado e o protocolo do evento. Só o render: guardar é do integrador. Se a marca
   * falhar, lança, e o integrador decide manter o PDF antigo.
   */
  pdfCancelado(
    mdfeProc: string,
    procEventoMDFe: string,
    opcoes?: Omit<PdfMdfeOpcoes, 'cancelado'>,
  ): Promise<Uint8Array>;
}

/**
 * Abre o PFX e devolve o emissor de MDF-e. Nada vai à rede até a primeira operação que precisa dela; o certificado
 * fora da validade é recusado aqui (`ErroCertificado`).
 */
export async function criarEmissorMdfe(opcoes: EmissorMdfeOpcoes): Promise<EmissorMdfe> {
  const base = await criarEmissor(perfilMdfe(opcoes), opcoes);
  const da = carregadorDa<ModuloDamdfe>('mdfe', opcoes.da);

  type Bruto = ResultadoEvento | ResultadoConsulta;
  const registrado = (e: EventoRegistrado, recuperado: boolean, bruto: Bruto): DesfechoCancelamentoMdfe =>
    eventoRegistrado(e, e.procEventoMDFe, statusDoRetorno(e.retEventoMDFe), recuperado, bruto);

  /**
   * Depois de um pedido sem resposta ou recusado por duplicidade de evento: a consulta diz se a SEFAZ registrou o
   * evento (o cancelamento, ou o encerramento neste município). Nunca conclui pelo `cStat` do pedido.
   */
  async function recuperar(
    chave: string,
    falha: { readonly erro: unknown } | Recusado,
    busca: BuscaDoEvento = { tpEvento: CANCELAMENTO },
  ): Promise<DesfechoCancelamentoMdfe> {
    let rec: RecuperacaoEvento;
    try {
      rec = await recuperarEventoRegistrado(base.cliente, chave, busca.tpEvento);
    } catch (e) {
      if (!semResposta(e)) throw e;
      return { tipo: 'pendente', motivo: 'sem-resposta', causa: 'erro' in falha ? falha.erro : e };
    }
    if (rec.registrado && (busca.confere?.(rec.evento) ?? true)) return registrado(rec.evento, true, rec.consulta);
    const c = rec.consulta;
    // A consulta diz que o evento existe, mas sem o evento legível (ou nenhum da busca): não decidiu.
    if (
      !rec.registrado &&
      busca.situacao !== undefined &&
      c.tipo === 'autorizado' &&
      c.valor.situacao === busca.situacao
    ) {
      return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: c.cStat, xMotivo: c.xMotivo, bruto: c };
    }
    if ('erro' in falha) return { tipo: 'pendente', motivo: 'sem-resposta', causa: falha.erro, bruto: c };
    return eventoRecusado(falha, c);
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
        c.tipo === 'autorizado' && c.valor.situacao === 'autorizado' ? c.valor.protocolo?.nProt : undefined;
      if (achado === undefined) {
        // Não consta ou rejeitado: não há o que cancelar. Encerrado não se cancela (o cancelamento recusa, pelo cStat da
        // SEFAZ); cancelado sem o evento legível, ou sem protocolo, a consulta não decidiu.
        if (c.tipo === 'recusado') return eventoRecusado(c, c);
        return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: c.cStat, xMotivo: c.xMotivo, bruto: c };
      }
      nProt = achado;
    }
    let o: ResultadoEvento;
    try {
      o = await base.cliente.cancelar({ chave: p.chave, nProt, xJust: p.xJust });
    } catch (e) {
      if (!semResposta(e)) throw e;
      return recuperar(p.chave, { erro: e });
    }
    switch (o.tipo) {
      case 'autorizado':
        return registrado(o.valor, false, o);
      case 'recusado':
        return CODIGOS.eventoJaRegistrado.has(o.cStat) ? recuperar(p.chave, o) : eventoRecusado(o, o);
      default:
        return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: o.cStat, xMotivo: o.xMotivo, bruto: o };
    }
  }

  async function encerrar(p: EncerramentoPedido): Promise<DesfechoEncerramentoMdfe> {
    // O MDF-e se encerra uma vez só: o encerramento registrado é o deste pedido quando é do mesmo município.
    const busca: BuscaDoEvento = {
      tpEvento: ENCERRAMENTO,
      confere: (e: EventoRegistrado): boolean => cMunDoEncerramento(e.procEventoMDFe) === p.cMun,
      situacao: 'encerrado',
    };
    let o: ResultadoEvento;
    try {
      o = await base.cliente.encerrar(p);
    } catch (e) {
      if (!semResposta(e)) throw e;
      return recuperar(p.chave, { erro: e }, busca);
    }
    switch (o.tipo) {
      case 'autorizado':
        return registrado(o.valor, false, o);
      case 'recusado':
        return CODIGOS.eventoJaRegistrado.has(o.cStat) ? recuperar(p.chave, o, busca) : eventoRecusado(o, o);
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
    get cliente(): ClienteMdfe {
      return base.cliente;
    },
    consultar: (chave: string, mdfeAssinado?: string): Promise<ResultadoConsulta> =>
      base.cliente.consultar(chave, mdfeAssinado),
    cancelar,
    encerrar,
    async pdf(mdfeProc: string, o?: PdfMdfeOpcoes): Promise<Uint8Array> {
      const m = await da();
      return (m.gerarPdf as (doc: unknown) => Uint8Array)(m.damdfe(mdfeProc, o));
    },
    async pdfCancelado(
      mdfeProc: string,
      procEventoMDFe: string,
      o?: Omit<PdfMdfeOpcoes, 'cancelado'>,
    ): Promise<Uint8Array> {
      const m = await da();
      return (m.gerarPdf as (doc: unknown) => Uint8Array)(m.damdfe(mdfeProc, { ...o, cancelado: procEventoMDFe }));
    },
  };
}
