/**
 * `@sinete/emissor/nfe`: o emissor de NF-e (`createNfeEmissor`) e o perfil da NF-e (`perfilNfe`).
 *
 * Importa o `@sinete/nfe` (peer dependency) de forma estática; a raiz do `@sinete/emissor` não o importa.
 *
 * O envio espera o recibo quando a SEFAZ responde 103 (mesmo no envio síncrono), no envio e no reenvio; trata o envio
 * sem resposta (timeout, conexão caída, resposta fora do leiaute, abort depois de o pedido sair) e a duplicidade (204,
 * 539) pela consulta da chave com os mesmos bytes; reenvia os mesmos bytes uma vez quando a nota não consta (217); vai
 * sempre ao autorizador do documento e da chave (cUF e, em SVC, o tpEmis), então um emissor atende todas as UFs do
 * certificado.
 */

import type { Denied, Rejected, Uf } from '@sinete/core';
import { ConfigError, timeContext, ufByCUf, ValidationError } from '@sinete/core';
import type {
  AutorDocumento,
  AutorizacaoOutcome,
  BuildNfeOptions,
  CartaCorrecaoPedido,
  ConsultaOutcome,
  EventoOutcome,
  EventoRegistrado,
  NfeClient,
  NfeClientOptions,
  NfeInput,
  PoliticaRecibo,
  ProtocoloNfe,
  RecuperacaoEvento,
  ResolucaoEnvio,
} from '@sinete/nfe';
import {
  autorizadorContingencia,
  buildNfe,
  conferirEmitenteDoCertificado,
  createNfeClient,
  documentoAssinado,
  recuperarEventoRegistrado,
  resolverEnvioSemResposta,
  signNfe,
} from '@sinete/nfe';
import { conteudoNfe } from './conteudo.ts';
import type {
  ContingenciaAplicada,
  ContingenciaDoPerfil,
  ContingenciaDosBytes,
  EscopoContingencia,
  Sonda,
  SondaSvc,
} from './contingencia.ts';
import { codigosDe, codigosSvc } from './cstat.ts';
import { carregadorDa } from './da.ts';
import type { ConteudoRegistrado, Desfecho, DesfechoEvento } from './desfecho.ts';
import { semResposta } from './desfecho.ts';
import type { ContextoEmissor, Emissor, OpcoesEmissor, PerfilDocumento } from './emissor.ts';
import { createEmissor } from './emissor.ts';
import { eventoRecusado, eventoRegistrado, statusDoRetorno } from './evento.ts';
import { fimDaSvcPeloMotivo } from './svc.ts';

/** De onde sai o desfecho da NF-e: a autorização (ou o recibo) ou a consulta da chave. */
export type BrutoNfe = AutorizacaoOutcome | ConsultaOutcome;

/** Desfecho de `emitir` e `retomar` da NF-e. */
export type DesfechoNfe = Desfecho<ProtocoloNfe, BrutoNfe>;

/** Desfecho do `cancelar` da NF-e: o evento, ou a consulta que o recuperou. */
export type DesfechoCancelamentoNfe = DesfechoEvento<EventoRegistrado, EventoOutcome | ConsultaOutcome>;

/** Opções da montagem além do ambiente (relógio da emissão, IBS/CBS, arredondamento, responsável técnico). */
export type MontagemNfe = Omit<Partial<BuildNfeOptions>, 'ambiente'>;

/**
 * A nota com opções de montagem só dela, por cima das do emissor: a data de emissão que o sistema do integrador já
 * fixou, o pagamento igual ao total, uma exigência relaxada para este emitente.
 */
export interface NotaComMontagem {
  readonly nfe: NfeInput;
  readonly montagem: MontagemNfe;
}

/** A entrada do emissor de NF-e: a nota, ou a nota com a montagem dela. */
export type EntradaNfe = NfeInput | NotaComMontagem;

export interface OpcoesPerfilNfe {
  /**
   * UF dos serviços sem documento do `cliente` (status do serviço, inutilização, distribuição). Não escolhe o
   * autorizador da emissão, que sai do documento e da chave.
   */
  readonly uf?: Uf;
  /**
   * Espera do recibo quando a SEFAZ responde 103 (lote recebido). Padrão: o do `aguardarRecibo` (até 10 consultas, de
   * 2 s a 30 s).
   */
  readonly recibo?: PoliticaRecibo;
  /** Opções da montagem de todas as notas; `NotaComMontagem` soma as de uma nota. */
  readonly montagem?: MontagemNfe;
  /**
   * Opções do cliente além das que o emissor preenche (fuso, endpoints da NFC-e). Sem `contingencia`: a NF-e em SVC
   * sai da montagem (`NfeInput.contingencia`, tpEmis 6 ou 7) e o autorizador sai da chave.
   */
  readonly cliente?: Omit<
    Partial<NfeClientOptions>,
    'transport' | 'signer' | 'ambiente' | 'uf' | 'clock' | 'contingencia'
  >;
}

const CODIGOS = codigosDe('nfe');

/** Cancelamento (MOC 7.0, Anexo II, evento 110111). */
const CANCELAMENTO = '110111';

const chaveDe = (xml: string): string => documentoAssinado(xml, 'NFe', 'infNFe').id.slice(3);

function autorDe(ctx: ContextoEmissor): AutorDocumento | undefined {
  if (ctx.titular.cnpj !== undefined) return { CNPJ: ctx.titular.cnpj };
  if (ctx.titular.cpf !== undefined) return { CPF: ctx.titular.cpf };
  return undefined;
}

/** Perfil da NF-e para o `createEmissor` da raiz. */
export function perfilNfe(
  opcoes: OpcoesPerfilNfe = {},
): PerfilDocumento<EntradaNfe, NfeClient, ProtocoloNfe, BrutoNfe> {
  const recusado = (id: string, r: Rejected, bruto: BrutoNfe): DesfechoNfe => ({
    documento: 'nfe',
    tipo: 'recusado',
    id,
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    ...(r.hint === undefined ? {} : { hint: r.hint }),
    bruto,
  });

  /**
   * Uso denegado: definitivo com qualquer `conteudo`, porque a denegação é da chave (MOC 7.0 Anexo I, tabela 4.4.3). O
   * `nfeProc` só vai quando o `digVal` prova que o conteúdo registrado é o destes bytes.
   */
  const denegado = (id: string, xml: string, o: Denied<ProtocoloNfe>, conteudo: ConteudoRegistrado): DesfechoNfe => ({
    documento: 'nfe',
    tipo: 'denegado',
    id,
    cStat: o.cStat,
    xMotivo: o.xMotivo,
    conteudo,
    ...(o.value.nfeProc === undefined ? {} : { proc: o.value.nfeProc }),
    protocolo: o.value,
    xml,
    bruto: o,
  });

  /** Autoriza; 103 espera o recibo; sem resposta, 204 ou 539, resolve pela consulta. `reenvia` limita o reenvio a um. */
  async function autorizar(cli: NfeClient, xml: string, reenvia: boolean): Promise<DesfechoNfe> {
    const id = chaveDe(xml);
    let r: AutorizacaoOutcome;
    let nRec: string | undefined;
    try {
      r = await cli.autorizar(xml);
      // Mesmo com indSinc 1, a SEFAZ pode responder 103 e processar o lote depois: espera o recibo antes de decidir.
      if (r.status === 'pending' && r.ref !== undefined) {
        nRec = r.ref;
        r = await cli.aguardarRecibo(nRec, xml, opcoes.recibo);
      }
    } catch (e) {
      if (!semResposta(e)) throw e;
      return resolver(cli, xml, undefined, e, reenvia);
    }
    switch (r.status) {
      case 'pending':
        // O recibo não saiu de pendente dentro da espera: os bytes ficam, e `retomar` consulta a chave depois.
        return {
          documento: 'nfe',
          tipo: 'pendente',
          id,
          motivo: 'lote-em-processamento',
          cStat: r.cStat,
          xMotivo: r.xMotivo,
          ...(nRec === undefined ? {} : { nRec }),
          bruto: r,
        };
      case 'rejected':
        return CODIGOS.duplicidade.has(r.cStat) ? resolver(cli, xml, r, undefined, reenvia) : recusado(id, r, r);
      case 'denied':
        // Resposta ao envio destes bytes: o cliente já recusou um digVal diferente, então só falta ou confere.
        return denegado(id, xml, r, r.value.nfeProc === undefined ? 'sem-digval' : 'confere');
      default: {
        const p = r.value;
        // Autorização sem digVal: nada prova que é destes bytes; a consulta decide.
        if (p.nfeProc === undefined) return resolver(cli, xml, undefined, undefined, false);
        return {
          documento: 'nfe',
          tipo: 'autorizado',
          id,
          cStat: r.cStat,
          xMotivo: r.xMotivo,
          proc: p.nfeProc,
          protocolo: p,
          bruto: r,
        };
      }
    }
  }

  async function resolver(
    cli: NfeClient,
    xml: string,
    anterior: Rejected | undefined,
    erroEnvio: unknown,
    reenvia: boolean,
  ): Promise<DesfechoNfe> {
    const id = chaveDe(xml);
    // A recusa que levou à consulta vai junto da pendência: é o que o emitente precisa ver.
    const ant = anterior === undefined ? {} : { anterior: { cStat: anterior.cStat, xMotivo: anterior.xMotivo } };
    let res: ResolucaoEnvio;
    try {
      res = await resolverEnvioSemResposta(cli, xml, anterior);
    } catch (e) {
      if (!semResposta(e)) throw e;
      // Nem a consulta respondeu: os bytes ficam, e o erro que conta é o do envio.
      return { documento: 'nfe', tipo: 'pendente', id, motivo: 'sem-resposta', causa: erroEnvio ?? e, ...ant };
    }
    switch (res.acao) {
      case 'concluida': {
        const o = res.outcome;
        if (o.status === 'denied') return denegado(id, xml, o, res.conteudo);
        // A autorização só conclui com o protocolo e o nfeProc destes bytes.
        if (o.status === 'authorized' && o.value.nfeProc !== undefined) {
          return {
            documento: 'nfe',
            tipo: 'autorizado',
            id,
            cStat: o.cStat,
            xMotivo: o.xMotivo,
            proc: o.value.nfeProc,
            protocolo: o.value,
            ...(res.situacao === 'cancelada' ? { situacaoAtual: 'cancelado' } : {}),
            bruto: o,
          };
        }
        return { documento: 'nfe', tipo: 'pendente', id, motivo: 'consulta-indefinida', ...ant, bruto: o };
      }
      case 'indefinida':
        return {
          documento: 'nfe',
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
          documento: 'nfe',
          tipo: 'divergente',
          id,
          ...(res.chNFe === undefined ? {} : { chaveRegistrada: res.chNFe }),
          ...(res.consulta === undefined
            ? { cStat: res.motivo.cStat, xMotivo: res.motivo.xMotivo }
            : {
                conteudo: 'difere',
                xMotivo: 'a chave está autorizada com outro conteúdo (o digVal não confere com os bytes gravados)',
              }),
          bruto: res.motivo,
        };
      case 'sem-prova':
        // Nem a resposta nem a consulta trazem o digVal: guardar como autorizada seria dar por nossa uma NF-e que nada
        // prova ser esta, e esperar não muda a resposta da consulta. Os bytes ficam, e a retomada alerta na primeira.
        return {
          documento: 'nfe',
          tipo: 'divergente',
          id,
          conteudo: 'sem-digval',
          cStat: res.consulta.cStat,
          xMotivo:
            'a chave está autorizada, mas o protocolo não traz o digVal: nada prova que a NF-e autorizada é a destes bytes',
          ...(res.situacao === 'cancelada' ? { situacaoAtual: 'cancelado' } : {}),
          bruto: res.consulta,
        };
      case 'reenviar':
        if (reenvia) return autorizar(cli, res.nfeAssinada, false);
        if (anterior !== undefined) return recusado(id, anterior, anterior);
        if (erroEnvio !== undefined) {
          return { documento: 'nfe', tipo: 'pendente', id, motivo: 'sem-resposta', causa: erroEnvio };
        }
        return {
          documento: 'nfe',
          tipo: 'pendente',
          id,
          motivo: 'consulta-indefinida',
          xMotivo: 'a NF-e não consta depois do reenvio',
        };
    }
  }

  /**
   * Cliente da consulta de status por UF, criado no primeiro uso (a sonda da contingência automática): o do autorizador
   * normal e, com `svc`, o da SVC da UF (`contingencia: 'svc'` no cliente).
   */
  const sondas = new Map<string, NfeClient>();
  const clienteDaSonda = (uf: string, svc: boolean, ctx: ContextoEmissor): NfeClient => {
    const k = `${svc ? 'svc' : 'normal'}:${uf}`;
    let cli = sondas.get(k);
    if (cli === undefined) {
      cli = createNfeClient({
        transport: ctx.transporte(),
        signer: ctx.signer,
        ambiente: ctx.ambiente,
        clock: ctx.clock,
        ...(ctx.logger === undefined ? {} : { logger: ctx.logger }),
        ...(ctx.timeoutMs === undefined ? {} : { timeoutMs: ctx.timeoutMs }),
        ...opcoes.cliente,
        uf: uf as Uf,
        ...(svc ? { contingencia: 'svc' as const } : {}),
      });
      sondas.set(k, cli);
    }
    return cli;
  };
  const contingencia: ContingenciaDoPerfil<EntradaNfe, ContextoEmissor> = {
    escopo(entrada: EntradaNfe): EscopoContingencia | undefined {
      const nota = 'montagem' in entrada ? entrada.nfe : entrada;
      if (nota.contingencia !== undefined) return undefined;
      return { documento: 'nfe', modelo: nota.modelo ?? '55', uf: nota.emitente.endereco.UF };
    },
    dosBytes(xml: string): ContingenciaDosBytes | undefined {
      const chave = chaveDe(xml);
      const uf = ufByCUf(chave.slice(0, 2))?.sigla;
      if (uf === undefined) return undefined;
      // Chave de acesso: cUF (1-2), modelo (21-22) e tpEmis (35) (MOC 7.0, Visão Geral, 2.2.6, tabela 2-1).
      const tpEmis = chave.slice(34, 35);
      return {
        escopo: { documento: 'nfe', modelo: chave.slice(20, 22), uf },
        emContingencia: tpEmis !== '1',
        offline: tpEmis === '9',
      };
    },
    aplicar(
      entrada: EntradaNfe,
      escopo: EscopoContingencia,
      c: ContingenciaAplicada,
      ctx: ContextoEmissor,
    ): EntradaNfe {
      // NFC-e: off-line, tpEmis 9 (a SVC não autoriza NFC-e, B22-70); NF-e: a SVC da UF, 6 ou 7 (B22-60).
      const tpEmis = escopo.modelo === '65' ? '9' : autorizadorContingencia(escopo.uf as Uf, ctx.ambiente).tpEmis;
      // dhCont não passa da emissão (B28-40): a emissão é a do relógio que a montagem vai usar (o da nota, o das opções
      // de montagem ou o do emissor), que pode estar atrás do banco.
      const daNota = 'montagem' in entrada ? entrada.montagem.time : undefined;
      const emissao = (daNota ?? opcoes.montagem?.time ?? timeContext({ emissao: ctx.clock })).emissao.now();
      const dhCont = c.desde.getTime() <= emissao.getTime() ? c.desde : emissao;
      const cont = { tpEmis, dhCont, xJust: c.xJust } as const;
      return 'montagem' in entrada
        ? { ...entrada, nfe: { ...entrada.nfe, contingencia: cont } }
        : { ...entrada, contingencia: cont };
    },
    offline: (escopo: EscopoContingencia): boolean => escopo.modelo === '65',
    async sondar(escopo: EscopoContingencia, ctx: ContextoEmissor): Promise<Sonda> {
      try {
        const r = await clienteDaSonda(escopo.uf, false, ctx).statusServico({
          mod: escopo.modelo === '65' ? '65' : '55',
        });
        return { emOperacao: r.status === 'authorized', detalhe: r.cStat };
      } catch (e) {
        return { emOperacao: false, detalhe: `sem resposta (${String(e)})` };
      }
    },
    // A consulta de status na SVC da UF diz se a SEFAZ de origem a ativou (NT 2013.007 v1.03, item 04.7): 107 ativa,
    // 113 em desativação até a hora do xMotivo, 114 desabilitada.
    async sondarSvc(escopo: EscopoContingencia, ctx: ContextoEmissor): Promise<SondaSvc> {
      try {
        const r = await clienteDaSonda(escopo.uf, true, ctx).statusServico();
        const detalhe = `${r.cStat} ${r.xMotivo}`;
        if (r.status === 'authorized') return { situacao: 'ativa', detalhe };
        if (codigosSvc.desativando.has(r.cStat)) {
          return { situacao: 'desativando', fim: fimDaSvcPeloMotivo(r.xMotivo, ctx.clock), detalhe };
        }
        if (codigosSvc.desativada.has(r.cStat)) return { situacao: 'desativada', detalhe };
        return { situacao: 'indisponivel', detalhe };
      } catch (e) {
        return { situacao: 'indisponivel', detalhe: `sem resposta (${String(e)})` };
      }
    },
    // Sem resposta, ou o serviço paralisado na autorização ou na consulta que tentou resolver o envio sem resposta.
    falha: (d: Desfecho): boolean =>
      (d.tipo === 'pendente' &&
        (d.motivo === 'sem-resposta' ||
          (d.motivo === 'consulta-indefinida' && d.cStat !== undefined && CODIGOS.paralisado.has(d.cStat)))) ||
      (d.tipo === 'recusado' && CODIGOS.paralisado.has(d.cStat)),
    // 114 na autorização pela SVC (NT 2013.007 v1.03, item 04.1, regras C03.2 e GB02.2).
    svcDesativada: (d: Desfecho): boolean => d.tipo === 'recusado' && codigosSvc.desativada.has(d.cStat),
  };

  return {
    tipo: 'nfe',
    contingencia,
    indefinido: (cStat: string): boolean => CODIGOS.indefinido.has(cStat),
    transitorio: (cStat: string): boolean => CODIGOS.transitorio.has(cStat),
    recusaPorCampoVolatil: (cStat: string): boolean => CODIGOS.campoVolatil.has(cStat),
    conteudoParaRecusa: conteudoNfe,
    criarCliente(ctx: ContextoEmissor): NfeClient {
      const autor = autorDe(ctx);
      return createNfeClient({
        transport: ctx.transporte(),
        signer: ctx.signer,
        ambiente: ctx.ambiente,
        ...(opcoes.uf === undefined ? {} : { uf: opcoes.uf }),
        clock: ctx.clock,
        ...(autor === undefined ? {} : { autor }),
        ...(ctx.logger === undefined ? {} : { logger: ctx.logger }),
        ...(ctx.timeoutMs === undefined ? {} : { timeoutMs: ctx.timeoutMs }),
        ...opcoes.cliente,
      });
    },
    async assinar(entrada: EntradaNfe, ctx: ContextoEmissor): Promise<{ readonly id: string; readonly xml: string }> {
      const [nota, daNota] = 'montagem' in entrada ? [entrada.nfe, entrada.montagem] : [entrada, undefined];
      const r = await buildNfe(nota, {
        time: timeContext({ emissao: ctx.clock }),
        ...opcoes.montagem,
        ...daNota,
        ambiente: ctx.ambiente,
      });
      if (!r.ok) throw new ValidationError('a NF-e não passou na validação', r.issues);
      // O certificado que assina é o do emitente (MOC 7.0 Anexo I, grupo A e F): sem CNPJ nem CPF da ICP-Brasil, a
      // SEFAZ recusa com 282 (A07); com outro CNPJ-base ou outro CPF, com 213 (F03) ou 227 (F03A).
      if (ctx.titular.cnpj === undefined && ctx.titular.cpf === undefined) {
        throw new ConfigError(
          'o certificado não traz CNPJ nem CPF: a SEFAZ recusa com 282 (MOC 7.0 Anexo I, regra A07)',
        );
      }
      const doCertificado = conferirEmitenteDoCertificado(nota, ctx.titular);
      if (doCertificado.length > 0) {
        throw new ValidationError('o emitente da NF-e não é o titular do certificado', doCertificado);
      }
      return { id: r.value.chave, xml: await signNfe(r.value, ctx.signer) };
    },
    enviar: (cli: NfeClient, xml: string, modo: 'primeiro' | 'retomada'): Promise<DesfechoNfe> =>
      modo === 'primeiro' ? autorizar(cli, xml, true) : resolver(cli, xml, undefined, undefined, true),
  };
}

/** O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/nfe` serve como está. */
export interface ModuloDanfe {
  danfe(xml: string, opcoes?: object): unknown;
  toPdf(doc: never): Uint8Array;
}

export interface NfeEmissorOptions extends OpcoesEmissor<ProtocoloNfe, BrutoNfe>, OpcoesPerfilNfe {
  /**
   * Módulo `@sinete/da/nfe` para o `pdf` e o `pdfCancelado`. Padrão: importado na primeira chamada, se estiver
   * instalado (Node e Bun). No Deno e num bundle de browser, importe `@sinete/da/nfe` de forma estática e passe aqui.
   */
  readonly da?: ModuloDanfe;
}

/** Pedido de cancelamento do emissor. Sem `nProt`, o emissor o tira da consulta da chave. */
export interface CancelamentoNfeEmissor {
  readonly chave: string;
  readonly xJust: string;
  readonly nProt?: string | undefined;
  /** Padrão: o CNPJ ou CPF do emitente na chave. */
  readonly autor?: AutorDocumento;
}

export interface NfeEmissor extends Emissor<EntradaNfe, NfeClient, ProtocoloNfe, BrutoNfe> {
  consultar(chave: string, nfeAssinada?: string): Promise<ConsultaOutcome>;
  /**
   * Cancela (110111) com recuperação: sem `nProt`, consulta a chave e, se a nota já está cancelada, devolve o evento
   * registrado; sem resposta, ou com 573 ou 580, confirma pela consulta se a SEFAZ registrou o cancelamento
   * (`recuperado: true`). Nunca conclui pelo `cStat` sozinho.
   */
  cancelar(pedido: CancelamentoNfeEmissor): Promise<DesfechoCancelamentoNfe>;
  cartaCorrecao(pedido: CartaCorrecaoPedido): Promise<EventoOutcome>;
  /** PDF do DANFE a partir do `nfeProc` (`opcoes` são as do `danfe`: `formato`, `logo`). */
  pdf(nfeProc: string, opcoes?: object): Promise<Uint8Array>;
  /**
   * PDF do DANFE com a marca de cancelada e o protocolo do evento. Só o render: guardar é do integrador. Se a marca
   * falhar (evento de outra nota, por exemplo), lança, e o integrador decide manter o PDF antigo.
   */
  pdfCancelado(nfeProc: string, procEventoNFe: string, opcoes?: object): Promise<Uint8Array>;
}

/**
 * Abre o PFX e devolve o emissor de NF-e. Nada vai à rede até a primeira operação que precisa dela; o certificado fora
 * da validade é recusado aqui (`CertError`).
 */
export async function createNfeEmissor(opcoes: NfeEmissorOptions): Promise<NfeEmissor> {
  const base = await createEmissor(perfilNfe(opcoes), opcoes);
  const da = carregadorDa<ModuloDanfe>('nfe', opcoes.da);

  type Bruto = EventoOutcome | ConsultaOutcome;
  const registrado = (e: EventoRegistrado, recuperado: boolean, bruto: Bruto): DesfechoCancelamentoNfe =>
    eventoRegistrado(e, e.procEventoNFe, statusDoRetorno(e.retEvento), recuperado, bruto);

  /**
   * Depois de um pedido sem resposta ou recusado por duplicidade de evento: a consulta diz se a SEFAZ registrou o
   * cancelamento. Nunca conclui pelo `cStat` do pedido.
   */
  async function recuperar(
    chave: string,
    falha: { readonly erro: unknown } | Rejected,
  ): Promise<DesfechoCancelamentoNfe> {
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

  async function cancelar(p: CancelamentoNfeEmissor): Promise<DesfechoCancelamentoNfe> {
    let nProt = p.nProt;
    if (nProt === undefined) {
      let rec: RecuperacaoEvento;
      try {
        rec = await recuperarEventoRegistrado(base.cliente, p.chave, CANCELAMENTO);
      } catch (e) {
        if (!semResposta(e)) throw e;
        return { tipo: 'pendente', motivo: 'sem-resposta', causa: e };
      }
      // Já cancelada (a resposta de um pedido anterior se perdeu): o evento vem da consulta.
      if (rec.registrado) return registrado(rec.evento, true, rec.consulta);
      const c = rec.consulta;
      const achado =
        c.status === 'authorized' && c.value.situacao === 'autorizada' ? c.value.protocolo?.nProt : undefined;
      if (achado === undefined) {
        // Não consta, rejeitada ou denegada: não há o que cancelar. Cancelada sem o evento legível, ou autorizada sem
        // protocolo, a consulta não decidiu.
        if (c.status === 'rejected' || c.status === 'denied') return eventoRecusado(c, c);
        return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: c.cStat, xMotivo: c.xMotivo, bruto: c };
      }
      nProt = achado;
    }
    let o: EventoOutcome;
    try {
      o = await base.cliente.cancelar({
        chave: p.chave,
        nProt,
        xJust: p.xJust,
        ...(p.autor === undefined ? {} : { autor: p.autor }),
      });
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
    get cliente(): NfeClient {
      return base.cliente;
    },
    consultar: (chave: string, nfeAssinada?: string): Promise<ConsultaOutcome> =>
      base.cliente.consultar(chave, nfeAssinada),
    cancelar,
    cartaCorrecao: (pedido: CartaCorrecaoPedido): Promise<EventoOutcome> => base.cliente.cartaCorrecao(pedido),
    async pdf(nfeProc: string, o?: object): Promise<Uint8Array> {
      const m = await da();
      return (m.toPdf as (doc: unknown) => Uint8Array)(m.danfe(nfeProc, o));
    },
    async pdfCancelado(nfeProc: string, procEventoNFe: string, o?: object): Promise<Uint8Array> {
      const m = await da();
      return (m.toPdf as (doc: unknown) => Uint8Array)(m.danfe(nfeProc, { ...o, cancelamento: procEventoNFe }));
    },
  };
}
