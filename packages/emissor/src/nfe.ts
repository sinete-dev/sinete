/**
 * `@sinete/emissor/nfe`: o emissor de NF-e (`criarEmissorNfe`) e o perfil da NF-e (`perfilNfe`).
 *
 * Importa o `@sinete/nfe` (peer dependency) de forma estática; a raiz do `@sinete/emissor` não o importa.
 *
 * O envio espera o recibo quando a SEFAZ responde 103 (mesmo no envio síncrono), no envio e no reenvio; trata o envio
 * sem resposta (timeout, conexão caída, resposta fora do leiaute, abort depois de o pedido sair) e a duplicidade (204,
 * 539) pela consulta da chave com os mesmos bytes; reenvia os mesmos bytes uma vez quando a nota não consta (217); vai
 * sempre ao autorizador do documento e da chave (cUF e, em SVC, o tpEmis), então um emissor atende todas as UFs do
 * certificado.
 */

import type { Denegado, Recusado, Uf } from '@sinete/core';
import { contextoDeTempo, ErroDeConfiguracao, ErroDeValidacao, ufPorCUf } from '@sinete/core';
import { descendentes, lerXml, textoDe } from '@sinete/core/xml';
import type {
  AutorDocumento,
  CartaCorrecaoPedido,
  ClienteNfe,
  ClienteNfeOpcoes,
  DadosNfe,
  EventoRegistrado,
  MontarNfeOpcoes,
  PoliticaRecibo,
  ProtocoloNfe,
  RecuperacaoEvento,
  ResolucaoEnvio,
  ResultadoAutorizacao,
  ResultadoConsulta,
  ResultadoEvento,
} from '@sinete/nfe';
import {
  assinarNfe,
  autorizadorContingencia,
  conferirEmitenteDoCertificado,
  criarClienteNfe,
  documentoAssinado,
  montarNfe,
  recuperarEventoRegistrado,
  resolverEnvioSemResposta,
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
import type { PdfNfeOpcoes } from './da.ts';
import { carregadorDa } from './da.ts';

export type { FormatoPdfNfe, PdfNfeOpcoes, ProtocoloDoEvento } from './da.ts';

import type { ConteudoRegistrado, Desfecho, DesfechoEvento } from './desfecho.ts';
import type { ContextoEmissor, Emissor, EmissorOpcoes, PerfilDocumento } from './emissor.ts';
import { criarEmissor } from './emissor.ts';
import { eventoRecusado, eventoRegistrado, statusDoRetorno } from './evento.ts';
import type { EnvioOpcoes } from './sinal.ts';
import { abortado, causaDaPendencia, conferirSinal, falhaSemResposta } from './sinal.ts';
import { fimDaSvcPeloMotivo } from './svc.ts';

/** De onde sai o desfecho da NF-e: a autorização (ou o recibo) ou a consulta da chave. */
export type BrutoNfe = ResultadoAutorizacao | ResultadoConsulta;

/** Desfecho de `emitir` e `retomar` da NF-e. */
export type DesfechoNfe = Desfecho<ProtocoloNfe, BrutoNfe>;

/** Desfecho do `cancelar` da NF-e: o evento, ou a consulta que o recuperou. */
export type DesfechoCancelamentoNfe = DesfechoEvento<EventoRegistrado, ResultadoEvento | ResultadoConsulta>;

/** Desfecho da `cartaCorrecao` da NF-e: o evento, ou a consulta que o recuperou. */
export type DesfechoCartaCorrecaoNfe = DesfechoEvento<EventoRegistrado, ResultadoEvento | ResultadoConsulta>;

/** Opções da montagem além do ambiente (relógio da emissão, IBS/CBS, arredondamento, responsável técnico). */
export type MontagemNfe = Omit<Partial<MontarNfeOpcoes>, 'ambiente'>;

/**
 * A nota com opções de montagem só dela, por cima das do emissor: a data de emissão que o sistema do integrador já
 * fixou, o pagamento igual ao total, uma exigência relaxada para este emitente.
 */
export interface NotaComMontagem {
  readonly nfe: DadosNfe;
  readonly montagem: MontagemNfe;
}

/** A entrada do emissor de NF-e: a nota, ou a nota com a montagem dela. */
export type EntradaNfe = DadosNfe | NotaComMontagem;

export interface PerfilNfeOpcoes {
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
   * sai da montagem (`DadosNfe.contingencia`, tpEmis 6 ou 7) e o autorizador sai da chave.
   */
  readonly cliente?: Omit<
    Partial<ClienteNfeOpcoes>,
    'transporte' | 'assinador' | 'ambiente' | 'uf' | 'relogio' | 'contingencia'
  >;
}

const CODIGOS = codigosDe('nfe');

/** Cancelamento (MOC 7.0, Anexo II, evento 110111). */
const CANCELAMENTO = '110111';
/** Carta de correção (MOC 7.0, Anexo II, evento 110110). */
const CARTA_CORRECAO = '110110';

/** O evento que a recuperação procura na consulta da chave. */
interface BuscaDoEvento {
  readonly tpEvento: string;
  /** Só o desta sequência; sem ela, o de maior `nSeqEvento`. */
  readonly nSeqEvento?: number;
  /** O evento registrado é o deste pedido (mesmo conteúdo)? Sem ela, basta o tipo e a sequência. */
  readonly confere?: (evento: EventoRegistrado) => boolean;
}

/** `xCorrecao` do pedido de CC-e dentro do `procEventoNFe`. */
function xCorrecaoDe(procEventoNFe: string): string | undefined {
  for (const el of descendentes(lerXml(procEventoNFe).raiz)) if (el.local === 'xCorrecao') return textoDe(el);
  return undefined;
}

const chaveDe = (xml: string): string => documentoAssinado(xml, 'NFe', 'infNFe').id.slice(3);

function autorDe(ctx: ContextoEmissor): AutorDocumento | undefined {
  if (ctx.titular.cnpj !== undefined) return { CNPJ: ctx.titular.cnpj };
  if (ctx.titular.cpf !== undefined) return { CPF: ctx.titular.cpf };
  return undefined;
}

/**
 * Perfil da NF-e para o `criarEmissor` de `@sinete/emissor/perfil`. Experimental, como aquele subpath (ADR 0016): a forma do
 * perfil (`PerfilDocumento`) pode mudar em versão minor. Para emitir, use a fábrica deste subpath, que é estável.
 *
 * @experimental
 */
export function perfilNfe(
  opcoes: PerfilNfeOpcoes = {},
): PerfilDocumento<EntradaNfe, ClienteNfe, ProtocoloNfe, BrutoNfe> {
  const recusado = (id: string, r: Recusado, bruto: BrutoNfe): DesfechoNfe => ({
    documento: 'nfe',
    tipo: 'recusado',
    id,
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    ...(r.dica === undefined ? {} : { dica: r.dica }),
    bruto,
  });

  /**
   * Uso denegado: definitivo com qualquer `conteudo`, porque a denegação é da chave (MOC 7.0 Anexo I, tabela 4.4.3). O
   * `nfeProc` só vai quando o `digVal` prova que o conteúdo registrado é o destes bytes.
   */
  const denegado = (id: string, xml: string, o: Denegado<ProtocoloNfe>, conteudo: ConteudoRegistrado): DesfechoNfe => ({
    documento: 'nfe',
    tipo: 'denegado',
    id,
    cStat: o.cStat,
    xMotivo: o.xMotivo,
    conteudo,
    ...(o.valor.nfeProc === undefined ? {} : { proc: o.valor.nfeProc }),
    protocolo: o.valor,
    xml,
    bruto: o,
  });

  /** Autoriza; 103 espera o recibo; sem resposta, 204 ou 539, resolve pela consulta. `reenvia` limita o reenvio a um. */
  async function autorizar(cli: ClienteNfe, xml: string, reenvia: boolean, env?: EnvioOpcoes): Promise<DesfechoNfe> {
    const id = chaveDe(xml);
    let r: ResultadoAutorizacao;
    let nRec: string | undefined;
    try {
      r = await cli.autorizar(xml, env);
      // Mesmo com indSinc 1, a SEFAZ pode responder 103 e processar o lote depois: espera o recibo antes de decidir.
      if (r.tipo === 'pendente' && r.referencia !== undefined) {
        nRec = r.referencia;
        r = await cli.aguardarRecibo(
          nRec,
          xml,
          env?.signal === undefined ? opcoes.recibo : { ...opcoes.recibo, ...env },
        );
      }
    } catch (e) {
      const falha = falhaSemResposta(e, env?.signal);
      if (falha === undefined) throw e;
      return resolver(cli, xml, undefined, falha, reenvia, env);
    }
    switch (r.tipo) {
      case 'pendente':
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
      case 'recusado':
        return CODIGOS.duplicidade.has(r.cStat) ? resolver(cli, xml, r, undefined, reenvia, env) : recusado(id, r, r);
      case 'denegado':
        // Resposta ao envio destes bytes: o cliente já recusou um digVal diferente, então só falta ou confere.
        return denegado(id, xml, r, r.valor.nfeProc === undefined ? 'sem-digval' : 'confere');
      default: {
        const p = r.valor;
        // Autorização sem digVal: nada prova que é destes bytes; a consulta decide.
        if (p.nfeProc === undefined) return resolver(cli, xml, undefined, undefined, false, env);
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
    cli: ClienteNfe,
    xml: string,
    anterior: Recusado | undefined,
    erroEnvio: unknown,
    reenvia: boolean,
    env?: EnvioOpcoes,
  ): Promise<DesfechoNfe> {
    const id = chaveDe(xml);
    // A recusa que levou à consulta vai junto da pendência: é o que o emitente precisa ver.
    const ant = anterior === undefined ? {} : { anterior: { cStat: anterior.cStat, xMotivo: anterior.xMotivo } };
    // Depois do abort, nenhuma chamada nova: os bytes ficam para a retomada.
    if (abortado(env?.signal)) {
      const causa = causaDaPendencia(env.signal, erroEnvio);
      return { documento: 'nfe', tipo: 'pendente', id, motivo: 'sem-resposta', causa, ...ant };
    }
    let res: ResolucaoEnvio;
    try {
      res = await resolverEnvioSemResposta(cli, xml, anterior, env);
    } catch (e) {
      const falha = falhaSemResposta(e, env?.signal);
      if (falha === undefined) throw e;
      // Nem a consulta respondeu: os bytes ficam, e o erro que conta é o do envio.
      return {
        documento: 'nfe',
        tipo: 'pendente',
        id,
        motivo: 'sem-resposta',
        causa: causaDaPendencia(env?.signal, erroEnvio, falha),
        ...ant,
      };
    }
    switch (res.acao) {
      case 'concluida': {
        const o = res.resultado;
        if (o.tipo === 'denegado') return denegado(id, xml, o, res.conteudo);
        // A autorização só conclui com o protocolo e o nfeProc destes bytes.
        if (o.tipo === 'autorizado' && o.valor.nfeProc !== undefined) {
          return {
            documento: 'nfe',
            tipo: 'autorizado',
            id,
            cStat: o.cStat,
            xMotivo: o.xMotivo,
            proc: o.valor.nfeProc,
            protocolo: o.valor,
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
          cStat: res.resultado.cStat,
          xMotivo: res.resultado.xMotivo,
          ...ant,
          bruto: res.resultado,
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
        // Abortado durante a consulta: nada de reenvio.
        if (abortado(env?.signal)) {
          return {
            documento: 'nfe',
            tipo: 'pendente',
            id,
            motivo: 'sem-resposta',
            causa: causaDaPendencia(env.signal),
          };
        }
        if (reenvia) return autorizar(cli, res.nfeAssinada, false, env);
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
  const sondas = new Map<string, ClienteNfe>();
  const clienteDaSonda = (uf: string, svc: boolean, ctx: ContextoEmissor): ClienteNfe => {
    const k = `${svc ? 'svc' : 'normal'}:${uf}`;
    let cli = sondas.get(k);
    if (cli === undefined) {
      cli = criarClienteNfe({
        transporte: ctx.transporte(),
        assinador: ctx.assinador,
        ambiente: ctx.ambiente,
        relogio: ctx.relogio,
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
      const uf = ufPorCUf(chave.slice(0, 2))?.sigla;
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
      const daNota = 'montagem' in entrada ? entrada.montagem.tempo : undefined;
      const emissao = (daNota ?? opcoes.montagem?.tempo ?? contextoDeTempo({ emissao: ctx.relogio })).emissao.agora();
      const dhCont = c.desde.getTime() <= emissao.getTime() ? c.desde : emissao;
      const cont = { tpEmis, dhCont, xJust: c.xJust } as const;
      return 'montagem' in entrada
        ? { ...entrada, nfe: { ...entrada.nfe, contingencia: cont } }
        : { ...entrada, contingencia: cont };
    },
    offline: (escopo: EscopoContingencia): boolean => escopo.modelo === '65',
    async sondar(escopo: EscopoContingencia, ctx: ContextoEmissor, env?: EnvioOpcoes): Promise<Sonda> {
      try {
        const r = await clienteDaSonda(escopo.uf, false, ctx).statusServico({
          mod: escopo.modelo === '65' ? '65' : '55',
          ...(env?.signal === undefined ? {} : { signal: env.signal }),
        });
        return { emOperacao: r.tipo === 'autorizado', detalhe: r.cStat };
      } catch (e) {
        return { emOperacao: false, detalhe: `sem resposta (${String(e)})` };
      }
    },
    // A consulta de status na SVC da UF diz se a SEFAZ de origem a ativou (NT 2013.007 v1.03, item 04.7): 107 ativa,
    // 113 em desativação até a hora do xMotivo, 114 desabilitada.
    async sondarSvc(escopo: EscopoContingencia, ctx: ContextoEmissor, env?: EnvioOpcoes): Promise<SondaSvc> {
      try {
        const r = await clienteDaSonda(escopo.uf, true, ctx).statusServico(env);
        const detalhe = `${r.cStat} ${r.xMotivo}`;
        if (r.tipo === 'autorizado') return { situacao: 'ativa', detalhe };
        if (codigosSvc.desativando.has(r.cStat)) {
          return { situacao: 'desativando', fim: fimDaSvcPeloMotivo(r.xMotivo, ctx.relogio), detalhe };
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
    criarCliente(ctx: ContextoEmissor): ClienteNfe {
      const autor = autorDe(ctx);
      return criarClienteNfe({
        transporte: ctx.transporte(),
        assinador: ctx.assinador,
        ambiente: ctx.ambiente,
        ...(opcoes.uf === undefined ? {} : { uf: opcoes.uf }),
        relogio: ctx.relogio,
        ...(autor === undefined ? {} : { autor }),
        ...(ctx.logger === undefined ? {} : { logger: ctx.logger }),
        ...(ctx.timeoutMs === undefined ? {} : { timeoutMs: ctx.timeoutMs }),
        ...opcoes.cliente,
      });
    },
    async assinar(entrada: EntradaNfe, ctx: ContextoEmissor): Promise<{ readonly id: string; readonly xml: string }> {
      const [nota, daNota] = 'montagem' in entrada ? [entrada.nfe, entrada.montagem] : [entrada, undefined];
      const r = await montarNfe(nota, {
        tempo: contextoDeTempo({ emissao: ctx.relogio }),
        ...opcoes.montagem,
        ...daNota,
        ambiente: ctx.ambiente,
      });
      if (!r.ok) throw new ErroDeValidacao('a NF-e não passou na validação', r.ocorrencias);
      // O certificado que assina é o do emitente (MOC 7.0 Anexo I, grupo A e F): sem CNPJ nem CPF da ICP-Brasil, a
      // SEFAZ recusa com 282 (A07); com outro CNPJ-base ou outro CPF, com 213 (F03) ou 227 (F03A).
      if (ctx.titular.cnpj === undefined && ctx.titular.cpf === undefined) {
        throw new ErroDeConfiguracao(
          'o certificado não traz CNPJ nem CPF: a SEFAZ recusa com 282 (MOC 7.0 Anexo I, regra A07)',
        );
      }
      const doCertificado = conferirEmitenteDoCertificado(nota, ctx.titular);
      if (doCertificado.length > 0) {
        throw new ErroDeValidacao('o emitente da NF-e não é o titular do certificado', doCertificado);
      }
      return { id: r.valor.chave, xml: await assinarNfe(r.valor, ctx.assinador) };
    },
    enviar: (cli: ClienteNfe, xml: string, modo: 'primeiro' | 'retomada', env?: EnvioOpcoes): Promise<DesfechoNfe> =>
      modo === 'primeiro' ? autorizar(cli, xml, true, env) : resolver(cli, xml, undefined, undefined, true, env),
  };
}

/** O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/nfe` serve como está. */
export interface ModuloDanfe {
  danfe(xml: string, opcoes?: PdfNfeOpcoes): unknown;
  gerarPdf(documento: never): Uint8Array;
}

export interface EmissorNfeOpcoes extends EmissorOpcoes<ProtocoloNfe, BrutoNfe>, PerfilNfeOpcoes {
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

export interface EmissorNfe extends Emissor<EntradaNfe, ClienteNfe, ProtocoloNfe, BrutoNfe> {
  /** Passagem direta para `cliente.consultar` (ADR 0010): a situação da chave na SEFAZ, sem estado do emissor. */
  consultar(chave: string, nfeAssinada?: string, opcoes?: EnvioOpcoes): Promise<ResultadoConsulta>;
  /**
   * Cancela (110111) com recuperação: sem `nProt`, consulta a chave e, se a nota já está cancelada, devolve o evento
   * registrado; sem resposta, ou com 573 ou 580, confirma pela consulta se a SEFAZ registrou o cancelamento
   * (`recuperado: true`). Nunca conclui pelo `cStat` sozinho. `opcoes.signal` cancela: o pedido abortado depois de sair
   * é `pendente` com `motivo: 'sem-resposta'`, sem a consulta de recuperação.
   */
  cancelar(pedido: CancelamentoNfeEmissor, opcoes?: EnvioOpcoes): Promise<DesfechoCancelamentoNfe>;
  /**
   * Carta de correção (110110) com a mesma recuperação do `cancelar`: sem resposta, ou com 573 ou 580, confirma pela
   * consulta se a SEFAZ registrou a CC-e desta sequência (`nSeqEvento`) com este texto (`recuperado: true`). Se a
   * sequência já tem outra correção registrada, a SEFAZ recusa o pedido e o desfecho é `recusado`: a CC-e seguinte leva
   * o próximo `nSeqEvento`.
   */
  cartaCorrecao(pedido: CartaCorrecaoPedido, opcoes?: EnvioOpcoes): Promise<DesfechoCartaCorrecaoNfe>;
  /** PDF do DANFE a partir do `nfeProc` (`opcoes` são as do `danfe` do `@sinete/da/nfe`). */
  pdf(nfeProc: string, opcoes?: PdfNfeOpcoes): Promise<Uint8Array>;
  /**
   * PDF do DANFE com a marca de cancelada e o protocolo do evento. Só o render: guardar é do integrador. Se a marca
   * falhar (evento de outra nota, por exemplo), lança, e o integrador decide manter o PDF antigo.
   */
  pdfCancelado(
    nfeProc: string,
    procEventoNFe: string,
    opcoes?: Omit<PdfNfeOpcoes, 'cancelamento'>,
  ): Promise<Uint8Array>;
}

/**
 * Abre o PFX e devolve o emissor de NF-e. Nada vai à rede até a primeira operação que precisa dela; o certificado fora
 * da validade é recusado aqui (`ErroCertificado`).
 */
export async function criarEmissorNfe(opcoes: EmissorNfeOpcoes): Promise<EmissorNfe> {
  const base = await criarEmissor(perfilNfe(opcoes), opcoes);
  const da = carregadorDa<ModuloDanfe>('nfe', opcoes.da);

  type Bruto = ResultadoEvento | ResultadoConsulta;
  const registrado = (e: EventoRegistrado, recuperado: boolean, bruto: Bruto): DesfechoCancelamentoNfe =>
    eventoRegistrado(e, e.procEventoNFe, statusDoRetorno(e.retEvento), recuperado, bruto);

  /**
   * Depois de um pedido sem resposta ou recusado por duplicidade de evento: a consulta diz se a SEFAZ registrou o
   * evento (o cancelamento, ou a CC-e da sequência pedida e com o mesmo texto). Nunca conclui pelo `cStat` do pedido.
   */
  async function recuperar(
    chave: string,
    falha: { readonly erro: unknown } | Recusado,
    busca: BuscaDoEvento,
    o: EnvioOpcoes | undefined,
  ): Promise<DesfechoCancelamentoNfe> {
    if (abortado(o?.signal)) {
      return {
        tipo: 'pendente',
        motivo: 'sem-resposta',
        causa: causaDaPendencia(o.signal),
      };
    }
    let rec: RecuperacaoEvento;
    try {
      rec = await recuperarEventoRegistrado(base.cliente, chave, busca.tpEvento, busca.nSeqEvento, o);
    } catch (e) {
      const f = falhaSemResposta(e, o?.signal);
      if (f === undefined) throw e;
      return {
        tipo: 'pendente',
        motivo: 'sem-resposta',
        causa: causaDaPendencia(o?.signal, 'erro' in falha ? falha.erro : undefined, f),
      };
    }
    if (rec.registrado && (busca.confere?.(rec.evento) ?? true)) return registrado(rec.evento, true, rec.consulta);
    if ('erro' in falha)
      return {
        tipo: 'pendente',
        motivo: 'sem-resposta',
        causa: causaDaPendencia(o?.signal, falha.erro),
        bruto: rec.consulta,
      };
    return eventoRecusado(falha, rec.consulta);
  }

  async function cancelar(p: CancelamentoNfeEmissor, o?: EnvioOpcoes): Promise<DesfechoCancelamentoNfe> {
    conferirSinal(o?.signal, 'cancelar');
    const busca: BuscaDoEvento = { tpEvento: CANCELAMENTO };
    let nProt = p.nProt;
    if (nProt === undefined) {
      let rec: RecuperacaoEvento;
      try {
        rec = await recuperarEventoRegistrado(base.cliente, p.chave, CANCELAMENTO, undefined, o);
      } catch (e) {
        const f = falhaSemResposta(e, o?.signal);
        if (f === undefined) throw e;
        // Abortado antes de o pedido sair: nada foi enviado.
        if (abortado(o?.signal)) throw f;
        return { tipo: 'pendente', motivo: 'sem-resposta', causa: f };
      }
      // Já cancelada (a resposta de um pedido anterior se perdeu): o evento vem da consulta.
      if (rec.registrado) return registrado(rec.evento, true, rec.consulta);
      const c = rec.consulta;
      const achado =
        c.tipo === 'autorizado' && c.valor.situacao === 'autorizada' ? c.valor.protocolo?.nProt : undefined;
      if (achado === undefined) {
        // Não consta, rejeitada ou denegada: não há o que cancelar. Cancelada sem o evento legível, ou autorizada sem
        // protocolo, a consulta não decidiu.
        if (c.tipo === 'recusado' || c.tipo === 'denegado') return eventoRecusado(c, c);
        return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: c.cStat, xMotivo: c.xMotivo, bruto: c };
      }
      nProt = achado;
    }
    // A consulta do nProt levou tempo: abortado nela ou logo depois, o pedido não sai.
    conferirSinal(o?.signal, 'cancelar');
    let r: ResultadoEvento;
    try {
      r = await base.cliente.cancelar(
        {
          chave: p.chave,
          nProt,
          xJust: p.xJust,
          ...(p.autor === undefined ? {} : { autor: p.autor }),
        },
        o,
      );
    } catch (e) {
      const f = falhaSemResposta(e, o?.signal);
      if (f === undefined) throw e;
      return recuperar(p.chave, { erro: f }, busca, o);
    }
    switch (r.tipo) {
      case 'autorizado':
        return registrado(r.valor, false, r);
      case 'recusado':
        return CODIGOS.eventoJaRegistrado.has(r.cStat) ? recuperar(p.chave, r, busca, o) : eventoRecusado(r, r);
      default:
        return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: r.cStat, xMotivo: r.xMotivo, bruto: r };
    }
  }

  async function cartaCorrecao(p: CartaCorrecaoPedido, o?: EnvioOpcoes): Promise<DesfechoCartaCorrecaoNfe> {
    conferirSinal(o?.signal, 'cartaCorrecao');
    // A sequência pode já ter outra correção registrada: só é a nossa com o mesmo texto.
    const busca: BuscaDoEvento = {
      tpEvento: CARTA_CORRECAO,
      nSeqEvento: p.nSeqEvento,
      confere: (e: EventoRegistrado): boolean => xCorrecaoDe(e.procEventoNFe) === p.xCorrecao,
    };
    let r: ResultadoEvento;
    try {
      r = await base.cliente.cartaCorrecao(p, o);
    } catch (e) {
      const f = falhaSemResposta(e, o?.signal);
      if (f === undefined) throw e;
      return recuperar(p.chave, { erro: f }, busca, o);
    }
    switch (r.tipo) {
      case 'autorizado':
        return registrado(r.valor, false, r);
      case 'recusado':
        return CODIGOS.eventoJaRegistrado.has(r.cStat) ? recuperar(p.chave, r, busca, o) : eventoRecusado(r, r);
      default:
        return { tipo: 'pendente', motivo: 'consulta-indefinida', cStat: r.cStat, xMotivo: r.xMotivo, bruto: r };
    }
  }

  return {
    tipo: base.tipo,
    titular: base.titular,
    emitir: base.emitir,
    assinar: base.assinar,
    retomar: base.retomar,
    fechar: base.fechar,
    get cliente(): ClienteNfe {
      return base.cliente;
    },
    consultar: (chave: string, nfeAssinada?: string, o?: EnvioOpcoes): Promise<ResultadoConsulta> =>
      base.cliente.consultar(chave, nfeAssinada, o),
    cancelar,
    cartaCorrecao,
    async pdf(nfeProc: string, o?: PdfNfeOpcoes): Promise<Uint8Array> {
      const m = await da();
      return (m.gerarPdf as (doc: unknown) => Uint8Array)(m.danfe(nfeProc, o));
    },
    async pdfCancelado(
      nfeProc: string,
      procEventoNFe: string,
      o?: Omit<PdfNfeOpcoes, 'cancelamento'>,
    ): Promise<Uint8Array> {
      const m = await da();
      return (m.gerarPdf as (doc: unknown) => Uint8Array)(m.danfe(nfeProc, { ...o, cancelamento: procEventoNFe }));
    },
  };
}
