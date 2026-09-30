/**
 * Serviços do MDF-e 3.00 (autorizador único, a SVRS) sobre o `@sinete/transport` e a assinatura do `@sinete/core/xml`:
 * status, autorização síncrona (área de dados em GZip e Base64), consulta da situação, consulta dos não encerrados e
 * eventos (cancelamento, encerramento, inclusão de condutor, inclusão de DF-e, pagamento da operação).
 *
 * Todo desfecho que chega a uma resposta da SEFAZ é um `ResultadoSefaz` do core, com a dica do catálogo de rejeições do
 * MDF-e na rejeição. Os documentos processados (`mdfeProc`, `procEventoMDFe`) são montados por splice: o XML assinado
 * entra byte a byte, o protocolo entra como fatia da resposta.
 *
 * Idempotência da autorização (Anexo I, F81 e F82, rejeições 539 e 204): grave o MDF-e assinado antes de enviar; se o
 * envio ficar sem resposta, nunca gere outro `cMDF` nem outro `dhEmi` para o mesmo número. Consulte a chave
 * (`resolverEnvioSemResposta`) e, se ela não constar, reenvie exatamente os mesmos bytes.
 */

import type { Ambiente, Assinador, Logger, Relogio, ResultadoSefaz } from '@sinete/core';
import {
  criarAutorizado,
  ErroDeConfiguracao,
  ErroDeValidacao,
  ErroRespostaInvalida,
  ehUf,
  loggerSilencioso,
  tpAmbDoAmbiente,
  ufPorSigla,
} from '@sinete/core';
import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { assinarXml, elementosFilhos, lerXml, primeiroFilho, textoDe } from '@sinete/core/xml';
import type { OcorrenciaSchema } from '@sinete/schemas';
import { decodificar, serializar, serializarRaiz, validar } from '@sinete/schemas';
import { TProtMDFe, TRetMDFe } from '@sinete/schemas/mdfe/3.00b';
import type {
  TEvento_infEvento_detEvento,
  TEvento_infEvento as TEvento_infEventoT,
} from '@sinete/schemas/mdfe/eventos/3.00b';
import { TEvento_infEvento, TRetEvento } from '@sinete/schemas/mdfe/eventos/3.00b';
import type { TConsMDFeNaoEnc } from '@sinete/schemas/mdfe/servicos/3.00b';
import {
  consMDFeNaoEncElement,
  consSitMDFeElement,
  consStatServMDFeElement,
  TRetConsMDFeNaoEnc,
  TRetConsStatServ,
} from '@sinete/schemas/mdfe/servicos/3.00b';
import type { EndpointResolvido, Transporte } from '@sinete/transport';
import { ErroPolitica, mdfeEndpoint } from '@sinete/transport';
import type { ChaveAcesso } from '@sinete/validators';
import { lerChaveAcesso, lerCnpj, lerCpf } from '@sinete/validators';
import { pagamentosDoLeiaute } from '../build/build.ts';
import emissao from '../data/emissao.json' with { type: 'json' };
import type { Condutor, PagamentoFrete } from '../model.ts';
import { dataDe, formatDh, offsetDaUf } from '../time.ts';
import { cstatEm, rejeitado } from './outcome.ts';
import type { DocumentoAssinado } from './proc.ts';
import { documentoAssinado, envelope, MDFE_NS, sliceElement } from './proc.ts';
import type { MdfeServicoCliente, RespostaSoap } from './soap.ts';
import { chamar } from './soap.ts';

// ---------------------------------------------------------------------------------------------------------------
// Configuração e valores
// ---------------------------------------------------------------------------------------------------------------

/** CNPJ ou CPF do emitente para a consulta dos não encerrados. */
export type AutorDocumento =
  | { readonly CNPJ: string; readonly CPF?: never }
  | { readonly CPF: string; readonly CNPJ?: never };

export interface MdfeClientOptions {
  readonly transport: Transporte;
  /** Assina o MDF-e e os eventos (A1 WebCrypto, A3 via PKCS#11, HSM). */
  readonly signer: Assinador;
  readonly ambiente: Ambiente;
  /** Relógio de emissão: `dhEvento`. */
  readonly clock: Relogio;
  readonly logger?: Logger;
  /** Prazo por requisição; padrão o do transporte. */
  readonly timeoutMs?: number;
  /** Fuso do emitente em minutos; padrão o da UF da chave (`data/fusos.json`). */
  readonly offsetMinutes?: number;
  /** CNPJ ou CPF do emitente, padrão da consulta dos não encerrados. */
  readonly autor?: AutorDocumento;
  /** Sobrepõe o endpoint por serviço (padrão: a tabela do MDF-e do `@sinete/transport`). */
  readonly endpoint?: (servico: MdfeServicoCliente) => EndpointResolvido;
}

/** Status do serviço (cStat 107). */
export interface StatusServico {
  readonly cUF: string;
  readonly verAplic: string;
  readonly dhRecbto: string;
  readonly tMed?: string;
  readonly dhRetorno?: string;
  readonly xObs?: string;
}

/** Protocolo de autorização de um MDF-e. */
export interface ProtocoloMdfe {
  readonly chMDFe: string;
  readonly cStat: string;
  readonly xMotivo: string;
  readonly nProt?: string;
  readonly dhRecbto: string;
  readonly digVal?: string;
  readonly verAplic: string;
  /** `protMDFe` como veio na resposta (fatia do texto). */
  readonly protMDFe: string;
  /** `mdfeProc` com o MDF-e assinado byte a byte e o `protMDFe`, quando o `digVal` confere com o MDF-e enviado. */
  readonly mdfeProc?: string;
}

export type AutorizacaoOutcome = ResultadoSefaz<ProtocoloMdfe, never>;

/** Opções de toda chamada que vai à rede. */
export interface OpcoesEnvio {
  /** Cancela a requisição em curso. */
  readonly signal?: AbortSignal;
}

/** Opções do envio para autorização. */
export type AutorizarOpcoes = OpcoesEnvio;

/** Situação do MDF-e na consulta: autorizado (100), cancelado (101) ou encerrado (132). */
export interface ConsultaMdfe {
  readonly chMDFe: string;
  readonly situacao: 'autorizado' | 'cancelado' | 'encerrado';
  readonly protocolo?: ProtocoloMdfe;
  /** `procEventoMDFe` devolvidos, como fatias da resposta. */
  readonly eventos: readonly string[];
  /** Com o MDF-e assinado dado: o `digVal` do protocolo é o DigestValue dele. */
  readonly digValConfere?: boolean;
}

export type ConsultaOutcome = ResultadoSefaz<ConsultaMdfe, never>;

/** MDF-e autorizado e ainda não encerrado do emitente. */
export interface MdfeNaoEncerrado {
  readonly chMDFe: string;
  readonly nProt: string;
}

/** Evento registrado (135; 134 e 136 quando a vinculação ao MDF-e tem ressalva). */
export interface EventoRegistrado {
  readonly chMDFe: string;
  readonly tpEvento: string;
  readonly nSeqEvento: string;
  readonly nProt?: string;
  readonly dhRegEvento?: string;
  readonly xEvento?: string;
  /** `retEventoMDFe` como veio na resposta. */
  readonly retEventoMDFe: string;
  /** Evento assinado + `retEventoMDFe`. */
  readonly procEventoMDFe: string;
}

export type EventoOutcome = ResultadoSefaz<EventoRegistrado, never>;

export interface CancelamentoPedido {
  readonly chave: string;
  readonly nProt: string;
  /** 15 a 255 caracteres. */
  readonly xJust: string;
}

export interface EncerramentoPedido {
  readonly chave: string;
  readonly nProt: string;
  /** Data do encerramento, `AAAA-MM-DD`; padrão o dia do relógio no fuso do emitente. */
  readonly dtEnc?: string;
  /** UF do encerramento (`EX` com o município 9999999, K04). */
  readonly uf: string;
  /** Código IBGE do município de encerramento. */
  readonly cMun: string;
  /**
   * Encerramento pelo transportador terceiro (NT 2024.001, HP07 e K11): o proprietário do veículo de tração, diferente
   * do emitente, encerra com o próprio certificado. Vira o autor do evento e liga o `indEncPorTerceiro`.
   */
  readonly terceiro?: AutorDocumento;
}

export interface InclusaoCondutorPedido {
  readonly chave: string;
  /** Sequencial do evento para o MDF-e, de 1 a 99 (K01). */
  readonly nSeqEvento: number;
  readonly condutor: Condutor;
}

export interface InclusaoDfePedido {
  readonly chave: string;
  readonly nProt: string;
  readonly nSeqEvento: number;
  readonly carregamento: { readonly cMun: string; readonly xMun: string };
  readonly documentos: readonly {
    readonly cMunDescarga: string;
    readonly xMunDescarga: string;
    readonly chNFe: string;
  }[];
}

export interface PagamentoOperacaoPedido {
  readonly chave: string;
  readonly nProt: string;
  /** Padrão 1: o evento é único por MDF-e (K01). */
  readonly nSeqEvento?: number;
  readonly qtdViagens: number;
  readonly nroViagem: number;
  readonly pagamentos: readonly PagamentoFrete[];
}

export interface MdfeClient {
  readonly options: MdfeClientOptions;
  statusServico(opcoes?: OpcoesEnvio): Promise<ResultadoSefaz<StatusServico, never>>;
  /**
   * Envia um MDF-e assinado (a string devolvida pelo `signMdfe`, sem outra alteração). O `tpAmb` do MDF-e diferente do
   * ambiente do cliente lança `ErroPolitica` antes do envio.
   */
  autorizar(mdfeAssinado: string, opcoes?: AutorizarOpcoes): Promise<AutorizacaoOutcome>;
  /** Situação do MDF-e; com o MDF-e assinado, confere o `digVal` e monta o `mdfeProc`. */
  consultar(chave: string, mdfeAssinado?: string, opcoes?: OpcoesEnvio): Promise<ConsultaOutcome>;
  /** MDF-e autorizados e não encerrados do emitente (111 com a lista; 112 sem nenhum). */
  consultarNaoEncerrados(
    autor?: AutorDocumento,
    opcoes?: OpcoesEnvio,
  ): Promise<ResultadoSefaz<readonly MdfeNaoEncerrado[], never>>;
  cancelar(p: CancelamentoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
  encerrar(p: EncerramentoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
  incluirCondutor(p: InclusaoCondutorPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
  incluirDFe(p: InclusaoDfePedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
  pagamentoOperacao(p: PagamentoOperacaoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
}

// ---------------------------------------------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------------------------------------------

const VERSAO = '3.00';

function chaveValida(chave: string, path: string): ChaveAcesso {
  const r = lerChaveAcesso(chave, { caminho: path });
  if (!r.ok) throw new ErroDeValidacao(`chave de acesso inválida: ${r.erro.mensagem}`, [r.erro]);
  if (r.valor.mod !== '58') {
    throw new ErroDeValidacao('a chave não é de MDF-e', [
      { caminho: path, code: 'chave_invalida', mensagem: `modelo ${r.valor.mod}, esperado 58` },
    ]);
  }
  return r.valor;
}

function schemaIssues(what: string, issues: readonly OcorrenciaSchema[]): void {
  if (issues.length > 0) throw new ErroDeValidacao(`${what} não confere com o schema`, issues);
}

function documentoAutor(a: AutorDocumento, path: string): { CNPJ: string } | { CPF: string } {
  if (a.CNPJ !== undefined) {
    const r = lerCnpj(a.CNPJ, { caminho: `${path}.CNPJ` });
    if (!r.ok) throw new ErroDeValidacao('CNPJ inválido', [r.erro]);
    return { CNPJ: r.valor };
  }
  const r = lerCpf(a.CPF ?? '', { caminho: `${path}.CPF` });
  if (!r.ok) throw new ErroDeValidacao('CPF inválido', [r.erro]);
  return { CPF: r.valor };
}

const [SERIE_CPF_INI, SERIE_CPF_FIM] = emissao.series.cpf as [number, number];

/**
 * O emitente da chave é o autor dos eventos do emissor (J09). CPF quando a série é de pessoa física (920 a 969) ou a
 * emissão é da NFF (tpEmis 3), como na observação da J09; CNPJ nos demais. As 14 posições sozinhas não bastam: `000`
 * seguido de alguns CPF também forma um CNPJ válido.
 */
function autorDaChave(c: ChaveAcesso): { CNPJ: string } | { CPF: string } {
  const serie = Number(c.serie);
  const pessoaFisica = (serie >= SERIE_CPF_INI && serie <= SERIE_CPF_FIM) || c.tpEmis === '3';
  return pessoaFisica ? { CPF: c.emitente.slice(3) } : { CNPJ: c.emitente };
}

/** Fatia autossuficiente (com o `xmlns` do elemento), para devolver ao chamador fora de um envelope. */
function avulso(doc: DocumentoXml, el: ElementoXml): string {
  return sliceElement(doc, el, '');
}

interface ProtocoloLido {
  readonly p: Omit<ProtocoloMdfe, 'mdfeProc'>;
  readonly embutido: string;
}

function lerProtocolo(doc: DocumentoXml, el: ElementoXml): ProtocoloLido {
  const inf = decodificar(TProtMDFe, el, doc.texto).valor.infProt;
  if (!inf) throw new ErroRespostaInvalida('protMDFe sem infProt');
  const p = {
    chMDFe: inf.chMDFe,
    cStat: inf.cStat,
    xMotivo: inf.xMotivo,
    dhRecbto: inf.dhRecbto,
    verAplic: inf.verAplic,
    protMDFe: avulso(doc, el),
    ...(inf.nProt === undefined ? {} : { nProt: inf.nProt }),
    ...(inf.digVal === undefined ? {} : { digVal: inf.digVal }),
  };
  return { p, embutido: sliceElement(doc, el) };
}

/** `mdfeProc`: MDF-e assinado + protocolo, só quando o `digVal` prova que o protocolo é deste conteúdo. */
function comProc({ p, embutido }: ProtocoloLido, a: DocumentoAssinado): ProtocoloMdfe {
  if (`MDFe${p.chMDFe}` !== a.id) {
    throw new ErroRespostaInvalida('protocolo de outra chave de acesso', { detalhes: { chMDFe: p.chMDFe } });
  }
  if (p.digVal === undefined) return p;
  if (p.digVal !== a.digestValue) {
    throw new ErroRespostaInvalida('digVal do protocolo difere do DigestValue do MDF-e enviado', {
      detalhes: { chMDFe: p.chMDFe, cStat: p.cStat },
    });
  }
  return { ...p, mdfeProc: envelope('mdfeProc', VERSAO, [a.xml, embutido]) };
}

/**
 * O `tpAmb` do MDF-e assinado tem de ser o do cliente. O MDF-e vai em GZip e Base64 no `mdfeDadosMsg`, onde a
 * `politicaDeHostsPermitidos` do transporte não enxerga o `tpAmb` (ela confere o corpo em texto, como faz com a NF-e): sem esta
 * conferência, um MDF-e de produção iria ao ambiente de homologação, ou o contrário. Recusa com o `ErroPolitica` do
 * transporte, o mesmo que a NF-e recebe da política, antes de qualquer socket.
 */
function conferirAmbiente(a: DocumentoAssinado, tpAmb: string): void {
  const inf = primeiroFilho(a.doc.raiz, 'infMDFe', MDFE_NS);
  const ide = inf === undefined ? undefined : primeiroFilho(inf, 'ide', MDFE_NS);
  const el = ide === undefined ? undefined : primeiroFilho(ide, 'tpAmb', MDFE_NS);
  const doDocumento = el === undefined ? undefined : textoDe(el).trim();
  if (doDocumento !== tpAmb) {
    throw new ErroPolitica(`tpAmb ${doDocumento ?? 'ausente'} no MDF-e, o cliente é do tpAmb ${tpAmb}`, {
      tpAmb: doDocumento ?? '',
      esperado: tpAmb,
    });
  }
}

interface EventoPedido {
  readonly c: ChaveAcesso;
  readonly tpEvento: string;
  readonly nSeqEvento: number;
  /** Nome do elemento do evento dentro de `detEvento` e o conteúdo dele. */
  readonly detalhe: { readonly nome: keyof TEvento_infEvento_detEvento; readonly valor: Record<string, unknown> };
  /** Autor que não é o emitente da chave (encerramento pelo transportador terceiro). */
  readonly autor?: { CNPJ: string } | { CPF: string };
  readonly signal: AbortSignal | undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------------------------------------------

/** Cria o cliente dos serviços do MDF-e. */
export function createMdfeClient(options: MdfeClientOptions): MdfeClient {
  const logger = (options.logger ?? loggerSilencioso).child({ modulo: 'mdfe', ambiente: options.ambiente });
  const tpAmb = tpAmbDoAmbiente(options.ambiente);
  const endpoint = (servico: MdfeServicoCliente): EndpointResolvido =>
    options.endpoint ? options.endpoint(servico) : mdfeEndpoint({ ambiente: options.ambiente, servico });
  const offsetDe = (c: ChaveAcesso): number => options.offsetMinutes ?? offsetDaUf(c.uf);

  const call = (
    servico: MdfeServicoCliente,
    mensagem: string,
    retorno: string,
    signal?: AbortSignal,
    cStatEm?: string,
  ): Promise<RespostaSoap> =>
    chamar({
      ...(cStatEm === undefined ? {} : { cStatEm }),
      transport: options.transport,
      endpoint: endpoint(servico),
      servico,
      mensagem,
      retorno,
      logger,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(signal === undefined ? {} : { signal }),
    });

  async function enviarEvento(p: EventoPedido): Promise<EventoOutcome> {
    const nSeq = p.nSeqEvento;
    if (!Number.isInteger(nSeq) || nSeq < 1 || nSeq > 999) throw new ErroDeConfiguracao(`nSeqEvento inválido: ${nSeq}`);
    const nSeqEvento = String(nSeq);
    // Id = "ID" + tpEvento + chave + nSeqEvento com 2 dígitos (até 99) ou 3 (até 999) (Visão Geral, 5.1.1, GP04).
    const id = `ID${p.tpEvento}${p.c.chave}${nSeqEvento.padStart(nSeq > 99 ? 3 : 2, '0')}`;
    const inf = {
      Id: id,
      cOrgao: p.c.cUF,
      tpAmb,
      ...(p.autor ?? autorDaChave(p.c)),
      chMDFe: p.c.chave,
      dhEvento: formatDh(options.clock.agora(), offsetDe(p.c)),
      tpEvento: p.tpEvento,
      nSeqEvento,
      detEvento: { versaoEvento: VERSAO, [p.detalhe.nome]: p.detalhe.valor },
    };
    const infXml = serializar(TEvento_infEvento, 'infEvento', inf as unknown as TEvento_infEventoT, MDFE_NS);
    const evento = `<eventoMDFe xmlns="${MDFE_NS}" versao="${VERSAO}">${infXml}</eventoMDFe>`;
    const infEl = primeiroFilho(lerXml(evento).raiz, 'infEvento', MDFE_NS) as ElementoXml;
    schemaIssues('evento', validar(TEvento_infEvento, infEl));
    const assinado = await assinarXml(evento, { id }, options.signer);
    const r = await call('MDFeRecepcaoEvento', assinado, 'retEventoMDFe', p.signal, 'infEvento');
    const ret = decodificar(TRetEvento, r.ret, r.doc.texto).valor.infEvento;
    logger.info('mdfe.evento', { chMDFe: p.c.chave, tpEvento: p.tpEvento, cStat: ret.cStat });
    const status = { cStat: ret.cStat, xMotivo: ret.xMotivo };
    if (!cstatEm(ret.cStat, 'eventoRegistrado')) return rejeitado(status);
    // O retorno tem de ser deste evento: chave, tipo e sequência, quando vierem, iguais aos enviados.
    const divergentes = (
      [
        ['chMDFe', ret.chMDFe, p.c.chave],
        ['tpEvento', ret.tpEvento, p.tpEvento],
        ['nSeqEvento', ret.nSeqEvento === undefined ? undefined : String(Number(ret.nSeqEvento)), nSeqEvento],
      ] as const
    ).filter(([, veio, enviado]) => veio !== undefined && veio !== enviado);
    if (divergentes.length > 0) {
      throw new ErroRespostaInvalida('retEventoMDFe de outro evento', {
        detalhes: Object.fromEntries(divergentes.map(([k, veio]) => [k, veio])),
      });
    }
    return criarAutorizado(status, {
      chMDFe: p.c.chave,
      tpEvento: p.tpEvento,
      nSeqEvento,
      retEventoMDFe: avulso(r.doc, r.ret),
      procEventoMDFe: envelope('procEventoMDFe', VERSAO, [assinado, sliceElement(r.doc, r.ret)]),
      ...(ret.nProt === undefined ? {} : { nProt: ret.nProt }),
      ...(ret.dhRegEvento === undefined ? {} : { dhRegEvento: ret.dhRegEvento }),
      ...(ret.xEvento === undefined ? {} : { xEvento: ret.xEvento }),
    });
  }

  const nProtValido = (nProt: string): string => {
    if (!/^[0-9]{15}$/.test(nProt)) throw new ErroDeConfiguracao(`nProt inválido: ${nProt}`);
    return nProt;
  };

  const client: MdfeClient = {
    options,

    async statusServico(opcoes?: OpcoesEnvio): Promise<ResultadoSefaz<StatusServico, never>> {
      const msg = serializarRaiz(consStatServMDFeElement, { versao: VERSAO, tpAmb, xServ: 'STATUS' });
      const r = await call('MDFeStatusServico', msg, 'retConsStatServMDFe', opcoes?.signal);
      const v = decodificar(TRetConsStatServ, r.ret, r.doc.texto).valor;
      const status = { cStat: v.cStat, xMotivo: v.xMotivo };
      logger.info('mdfe.status', { cStat: v.cStat });
      if (!cstatEm(v.cStat, 'servicoEmOperacao')) return rejeitado(status);
      return criarAutorizado(status, {
        cUF: v.cUF,
        verAplic: v.verAplic,
        dhRecbto: v.dhRecbto,
        ...(v.tMed === undefined ? {} : { tMed: String(v.tMed) }),
        ...(v.dhRetorno === undefined ? {} : { dhRetorno: v.dhRetorno }),
        ...(v.xObs === undefined ? {} : { xObs: v.xObs }),
      });
    },

    async autorizar(mdfeAssinado: string, opcoes: AutorizarOpcoes = {}): Promise<AutorizacaoOutcome> {
      const a = documentoAssinado(mdfeAssinado, 'MDFe', 'infMDFe');
      conferirAmbiente(a, tpAmb);
      const r = await call('MDFeRecepcaoSinc', a.xml, 'retMDFe', opcoes.signal);
      const v = decodificar(TRetMDFe, r.ret, r.doc.texto).valor;
      const chave = a.id.slice(4);
      logger.info('mdfe.autorizacao', { chMDFe: chave, cStat: v.cStat });
      const protEl = primeiroFilho(r.ret, 'protMDFe', MDFE_NS);
      if (protEl === undefined) return rejeitado({ cStat: v.cStat, xMotivo: v.xMotivo });
      const lido = lerProtocolo(r.doc, protEl);
      const status = { cStat: lido.p.cStat, xMotivo: lido.p.xMotivo };
      if (!cstatEm(lido.p.cStat, 'autorizado')) return rejeitado(status);
      return criarAutorizado(status, comProc(lido, a));
    },

    async consultar(chave: string, mdfeAssinado?: string, opcoes?: OpcoesEnvio): Promise<ConsultaOutcome> {
      const c = chaveValida(chave, 'chMDFe');
      const a = mdfeAssinado === undefined ? undefined : documentoAssinado(mdfeAssinado, 'MDFe', 'infMDFe');
      if (a && a.id !== `MDFe${c.chave}`) throw new ErroDeConfiguracao('o MDF-e assinado não é o da chave consultada');
      const msg = serializarRaiz(consSitMDFeElement, { versao: VERSAO, tpAmb, xServ: 'CONSULTAR', chMDFe: c.chave });
      const r = await call('MDFeConsulta', msg, 'retConsSitMDFe', opcoes?.signal);
      const txt = (local: string): string => {
        const el = primeiroFilho(r.ret, local, MDFE_NS);
        return el === undefined ? '' : textoDe(el).trim();
      };
      const status = { cStat: txt('cStat'), xMotivo: txt('xMotivo') };
      logger.info('mdfe.consulta', { chMDFe: c.chave, cStat: status.cStat });
      const situacao = cstatEm(status.cStat, 'autorizado')
        ? 'autorizado'
        : cstatEm(status.cStat, 'cancelado')
          ? 'cancelado'
          : cstatEm(status.cStat, 'encerrado')
            ? 'encerrado'
            : undefined;
      if (situacao === undefined) return rejeitado(status);
      // No retConsSitMDFe, protMDFe e procEventoMDFe são envelopes com `versao` e um `xs:any` que traz o documento da
      // versão correspondente (consSitMDFeTiposBasico_v3.00.xsd): o protMDFe e o procEventoMDFe de dentro. Um retorno
      // com o `infProt` direto no envelope também é aceito.
      const interno = (el: ElementoXml, local: string): ElementoXml => primeiroFilho(el, local, MDFE_NS) ?? el;
      const protWrap = primeiroFilho(r.ret, 'protMDFe', MDFE_NS);
      const protEl = protWrap === undefined ? undefined : interno(protWrap, 'protMDFe');
      const eventos = elementosFilhos(r.ret)
        .filter((e) => e.local === 'procEventoMDFe' && e.ns === MDFE_NS)
        .map((e) => avulso(r.doc, interno(e, 'procEventoMDFe')));
      let protocolo: ProtocoloMdfe | undefined;
      let digValConfere: boolean | undefined;
      if (protEl) {
        const lido = lerProtocolo(r.doc, protEl);
        if (lido.p.chMDFe !== c.chave) {
          throw new ErroRespostaInvalida('protocolo de outra chave de acesso na consulta', {
            detalhes: { chMDFe: lido.p.chMDFe },
          });
        }
        protocolo = lido.p;
        if (a) {
          digValConfere = lido.p.digVal !== undefined && lido.p.digVal === a.digestValue;
          if (digValConfere) protocolo = comProc(lido, a);
        }
      }
      return criarAutorizado(status, {
        chMDFe: c.chave,
        situacao,
        eventos,
        ...(protocolo === undefined ? {} : { protocolo }),
        ...(digValConfere === undefined ? {} : { digValConfere }),
      });
    },

    async consultarNaoEncerrados(
      autor?: AutorDocumento,
      opcoes?: OpcoesEnvio,
    ): Promise<ResultadoSefaz<readonly MdfeNaoEncerrado[], never>> {
      const quem = autor ?? options.autor;
      if (!quem)
        throw new ErroDeConfiguracao('informe o CNPJ ou CPF do emitente (argumento ou MdfeClientOptions.autor)');
      const doc = documentoAutor(quem, 'autor');
      const msg = serializarRaiz(consMDFeNaoEncElement, {
        versao: VERSAO,
        tpAmb,
        xServ: 'CONSULTAR NÃO ENCERRADOS',
        ...doc,
      } as TConsMDFeNaoEnc);
      const r = await call('MDFeConsNaoEnc', msg, 'retConsMDFeNaoEnc', opcoes?.signal);
      const v = decodificar(TRetConsMDFeNaoEnc, r.ret, r.doc.texto).valor;
      const status = { cStat: v.cStat, xMotivo: v.xMotivo };
      logger.info('mdfe.nao-encerrados', { cStat: v.cStat, quantidade: v.infMDFe?.length ?? 0 });
      if (cstatEm(v.cStat, 'naoEncerradosNenhum')) return criarAutorizado(status, []);
      if (!cstatEm(v.cStat, 'naoEncerradosLocalizados')) return rejeitado(status);
      return criarAutorizado(
        status,
        (v.infMDFe ?? []).map((i) => ({ chMDFe: i.chMDFe, nProt: i.nProt })),
      );
    },

    async cancelar(p: CancelamentoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      return enviarEvento({
        c,
        tpEvento: '110111',
        nSeqEvento: 1,
        detalhe: {
          nome: 'evCancMDFe',
          valor: { descEvento: 'Cancelamento', nProt: nProtValido(p.nProt), xJust: p.xJust },
        },
        signal: opcoes?.signal,
      });
    },

    async encerrar(p: EncerramentoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      const exterior = p.uf === 'EX';
      const cUF = exterior ? '99' : cUFdaUf(p.uf);
      // K04 (689): encerramento no exterior usa o município 9999999; K03 (614): o município é da UF informada.
      if (exterior && p.cMun !== '9999999') {
        throw new ErroDeValidacao('encerramento no exterior usa o município 9999999 (K04, rejeição 689)', [
          {
            caminho: 'cMun',
            code: 'municipio_uf_divergente',
            mensagem: 'cUF 99 exige cMun 9999999 (K04, rejeição 689)',
          },
        ]);
      }
      if (!exterior && p.cMun.slice(0, 2) !== cUF) {
        throw new ErroDeValidacao('município de encerramento fora da UF (K03, rejeição 614)', [
          { caminho: 'cMun', code: 'municipio_uf_divergente', mensagem: `cMun fora da UF ${p.uf} (K03, rejeição 614)` },
        ]);
      }
      const dtEnc = p.dtEnc ?? dataDe(options.clock.agora(), offsetDe(c));
      const terceiro = p.terceiro === undefined ? undefined : documentoAutor(p.terceiro, 'terceiro');
      const emitente = autorDaChave(c);
      if (
        terceiro !== undefined &&
        ('CNPJ' in terceiro ? terceiro.CNPJ : terceiro.CPF) === ('CNPJ' in emitente ? emitente.CNPJ : emitente.CPF)
      ) {
        throw new ErroDeConfiguracao(
          'o transportador terceiro precisa ser diferente do emitente do MDF-e (K11, rejeição 524)',
        );
      }
      return enviarEvento({
        c,
        tpEvento: '110112',
        nSeqEvento: 1,
        ...(terceiro === undefined ? {} : { autor: terceiro }),
        detalhe: {
          nome: 'evEncMDFe',
          valor: {
            descEvento: 'Encerramento',
            nProt: nProtValido(p.nProt),
            dtEnc,
            cUF,
            cMun: p.cMun,
            ...(terceiro === undefined ? {} : { indEncPorTerceiro: '1' }),
          },
        },
        signal: opcoes?.signal,
      });
    },

    async incluirCondutor(p: InclusaoCondutorPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      if (!Number.isInteger(p.nSeqEvento) || p.nSeqEvento < 1 || p.nSeqEvento > 99) {
        throw new ErroDeConfiguracao(`nSeqEvento da inclusão de condutor vai de 1 a 99 (K01): ${p.nSeqEvento}`);
      }
      const cpf = lerCpf(p.condutor.CPF, { caminho: 'condutor.CPF' });
      if (!cpf.ok) throw new ErroDeValidacao('CPF do condutor inválido (K06, rejeição 645)', [cpf.erro]);
      return enviarEvento({
        c,
        tpEvento: '110114',
        nSeqEvento: p.nSeqEvento,
        detalhe: {
          nome: 'evIncCondutorMDFe',
          valor: { descEvento: 'Inclusao Condutor', condutor: { xNome: p.condutor.xNome, CPF: cpf.valor } },
        },
        signal: opcoes?.signal,
      });
    },

    async incluirDFe(p: InclusaoDfePedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      if (!Number.isInteger(p.nSeqEvento) || p.nSeqEvento < 1 || p.nSeqEvento > 99) {
        throw new ErroDeConfiguracao(`nSeqEvento da inclusão de DF-e vai de 1 a 99 (K01): ${p.nSeqEvento}`);
      }
      if (p.documentos.length === 0) throw new ErroDeConfiguracao('informe ao menos uma NF-e');
      const infDoc = p.documentos.map((d, n) => {
        const r = lerChaveAcesso(d.chNFe, { caminho: `documentos[${n}].chNFe` });
        if (!r.ok || r.valor.mod !== '55') {
          const erro = r.ok
            ? { caminho: `documentos[${n}].chNFe`, code: 'chave_invalida', mensagem: 'modelo diferente de 55' }
            : r.erro;
          throw new ErroDeValidacao('chave de NF-e inválida na inclusão (K10, rejeição 709)', [erro]);
        }
        return { cMunDescarga: d.cMunDescarga, xMunDescarga: d.xMunDescarga, chNFe: r.valor.chave };
      });
      return enviarEvento({
        c,
        tpEvento: '110115',
        nSeqEvento: p.nSeqEvento,
        detalhe: {
          nome: 'evIncDFeMDFe',
          valor: {
            descEvento: 'Inclusao DF-e',
            nProt: nProtValido(p.nProt),
            cMunCarrega: p.carregamento.cMun,
            xMunCarrega: p.carregamento.xMun,
            infDoc,
          },
        },
        signal: opcoes?.signal,
      });
    },

    async pagamentoOperacao(p: PagamentoOperacaoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      const viagem = (n: number, k: string): string => {
        if (!Number.isInteger(n) || n < 1 || n > 99_999) throw new ErroDeConfiguracao(`${k} de 1 a 99999: ${n}`);
        return String(n).padStart(5, '0');
      };
      if (p.pagamentos.length === 0) throw new ErroDeConfiguracao('informe ao menos um pagamento');
      const { infPag, issues } = pagamentosDoLeiaute(
        p.pagamentos,
        dataDe(options.clock.agora(), offsetDe(c)),
        'pagamentos',
      );
      if (issues.length > 0) throw new ErroDeValidacao('pagamento da operação inválido', issues);
      return enviarEvento({
        c,
        tpEvento: '110116',
        nSeqEvento: p.nSeqEvento ?? 1,
        detalhe: {
          nome: 'evPagtoOperMDFe',
          valor: {
            descEvento: 'Pagamento Operacao MDF-e',
            nProt: nProtValido(p.nProt),
            infViagens: {
              qtdViagens: viagem(p.qtdViagens, 'qtdViagens'),
              nroViagem: viagem(p.nroViagem, 'nroViagem'),
            },
            infPag,
          },
        },
        signal: opcoes?.signal,
      });
    },
  };
  return client;
}

/** cUF (2 dígitos) da UF de encerramento, pela tabela de UFs do core. */
function cUFdaUf(uf: string): string {
  const info = ehUf(uf) ? ufPorSigla(uf) : undefined;
  if (info === undefined) throw new ErroDeConfiguracao(`UF de encerramento inválida: ${uf}`);
  return info.cUF;
}
