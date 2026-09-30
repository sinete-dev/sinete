/**
 * `createSefazSim`: a SEFAZ simulada, com estado e relógio injetado. Recebe pedidos HTTP já lidos (`SimRequest`) e
 * devolve a resposta com o efeito de rede que o cenário pediu (`SimResult`). Os adaptadores de transporte (em processo
 * e servidor HTTPS) aplicam o efeito: responder, derrubar a conexão ou não responder.
 */

import type { Ambiente, Relogio, Uf, UnidadeFederativa } from '@sinete/core';
import { ErroDeConfiguracao, ehUf, tpAmbDoAmbiente, ufPorSigla } from '@sinete/core';
import { nfeContingenciaDaUf } from '@sinete/transport';
import type { CertIdentity } from './certs.ts';
import { checkTransmissor } from './certs.ts';
import type { AtivacaoSvc, RequestContext, Runtime, SimConfig, Svc } from './context.ts';
import { consNaoEncMdfe, consultaMdfe, statusServicoMdfe } from './mdfe/consultas.ts';
import { recepcaoEventoMdfe } from './mdfe/evento.ts';
import { recepcaoMdfe } from './mdfe/recepcao.ts';
import type { SimRules } from './rules.ts';
import { DEFAULT_RULES } from './rules.ts';
import { autorizacao, retAutorizacao, settleLotes } from './services/autorizacao.ts';
import { consultaProtocolo, statusServico } from './services/consulta.ts';
import { distribuicao } from './services/distribuicao.ts';
import { recepcaoEvento } from './services/evento.ts';
import { consultaCadastro, inutilizacao } from './services/inutilizacao.ts';
import type { SimAutorizador, SimServico } from './services.ts';
import { routeOf, servicePath } from './services.ts';
import { parseSoapRequest, SOAP_CONTENT_TYPE, soapFaultEnvelope, soapResponse } from './soap.ts';
import type {
  Contribuinte,
  DistDoc,
  EventoRecord,
  InutilizacaoRecord,
  LoteRecord,
  MdfeEventoRecord,
  MdfeRecord,
  NfeRecord,
} from './state.ts';
import { SimState } from './state.ts';

export interface SefazSimOptions {
  /** Relógio de emissão da SEFAZ simulada. Nos testes, um `manualClock` do `@sinete/core`. */
  readonly clock: Relogio;
  /** UF autorizadora simulada. Padrão: `SP`. */
  readonly uf?: Uf;
  /** UFs atendidas além da própria (autorizador virtual). */
  readonly ufsAtendidas?: readonly Uf[];
  /** Padrão: `homologacao`. */
  readonly ambiente?: Ambiente;
  /** Fuso do autorizador em minutos, para `dhRecbto`. Padrão: -180. */
  readonly offsetMinutes?: number;
  /** Cadastro de contribuintes (regras 1C17 da autorização, consulta cadastro, inutilização). */
  readonly cadastro?: readonly Contribuinte[];
  /** Regras de negócio. Padrão: `DEFAULT_RULES`. */
  readonly rules?: SimRules;
  /**
   * Exige certificado de cliente no canal (sem ele, HTTP 403 como o IIS). Padrão: `true`. O certificado do canal pode
   * ser de outro CNPJ que o do emitente (transmissor terceiro); a regra 213 compara só a assinatura.
   */
  readonly exigirCertificado?: boolean;
  /** Prazos de cancelamento em horas. Padrão: 24 (110111) e 168 (110112). */
  readonly prazoCancelamentoHoras?: number;
  readonly prazoCancelamentoSubstituicaoHoras?: number;
  /** Atraso do processamento do lote assíncrono, em ms do relógio injetado. Padrão: 0. */
  readonly atrasoProcessamentoMs?: number;
  /** `indSinc=1`: `aceita` (padrão), `recusa` (776) ou `assincrona` (devolve recibo mesmo assim). */
  readonly respostaSincrona?: 'aceita' | 'recusa' | 'assincrona';
  /** Espera mínima depois de uma distribuição sem documentos novos (656). Padrão: uma hora. */
  readonly intervaloConsumoIndevidoMs?: number;
  /** Limite da área de dados (214). Padrão: 500 KB. */
  readonly tamanhoMaximo?: number;
  /** MDF-e: prazo do cancelamento em horas depois da autorização (K04, 220). Padrão: 24. */
  readonly prazoCancelamentoMdfeHoras?: number;
  /** MDF-e: limite da área de dados já descompactada (214). Padrão: 2048 KB (MOC MDF-e, item 4.1.5). */
  readonly tamanhoMaximoMdfe?: number;
  /** MDF-e: regras desligadas pelo `id` do MOC (`F86`, `K04`, `J16`...), para montar cenários. */
  readonly regrasMdfeDesligadas?: readonly string[];
}

/** Pedido HTTP como chegou ao simulador. */
export interface SimRequest {
  readonly method?: string;
  /** Caminho com a query, como `/uf/ws/NFeAutorizacao4`. */
  readonly path: string;
  /** Cabeçalhos com nome em minúsculas. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | Uint8Array;
  /** Certificado de cliente apresentado no TLS, em DER. */
  readonly clientCertificate?: Uint8Array;
}

/** O que fazer com a conexão: responder, derrubar ou deixar sem resposta até o cliente desistir. */
export type SimEffect = 'respond' | 'drop' | 'hang';

export interface SimResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly effect: SimEffect;
  /** Espera antes do efeito, em ms de tempo real. */
  readonly delayMs: number;
}

/** Falha de rede injetada. */
export type SimFault =
  /** Derruba a conexão antes de processar (o pedido não chega) ou depois (processado, sem resposta: o 204 do reenvio). */
  | { readonly kind: 'drop'; readonly phase: 'before' | 'after' }
  /** Não responde até o cliente desistir, antes ou depois de processar. */
  | { readonly kind: 'hang'; readonly phase: 'before' | 'after' }
  /** Responde normalmente depois de uma espera em tempo real. */
  | { readonly kind: 'delay'; readonly ms: number }
  /** Responde só um status HTTP (503 do balanceador, 500 do IIS), sem processar. */
  | { readonly kind: 'http'; readonly status: number };

export interface FaultTarget {
  /** Só este serviço (da NF-e ou do MDF-e); padrão: todos. */
  readonly servico?: SimServico;
  readonly autorizador?: SimAutorizador;
  /** Quantas vezes a falha acontece. Padrão: 1. `Infinity` até `clearFaults()`. */
  readonly times?: number;
}

/** Consultas ao estado para as asserções dos testes. */
export interface SimInspect {
  nfe(chave: string): NfeRecord | undefined;
  nfes(): readonly NfeRecord[];
  eventos(chave?: string): readonly EventoRecord[];
  inutilizacoes(): readonly InutilizacaoRecord[];
  mdfe(chave: string): MdfeRecord | undefined;
  mdfes(): readonly MdfeRecord[];
  eventosMdfe(chave?: string): readonly MdfeEventoRecord[];
  lote(nRec: string): LoteRecord | undefined;
  /** Fila de distribuição de um interessado (CNPJ ou CPF). */
  distribuicao(interessado: string): readonly DistDoc[];
}

export interface SefazSim {
  readonly config: SimConfig;
  /** Atende um pedido. */
  handle(request: SimRequest): Promise<SimResult>;
  /** Caminho do serviço (`/uf/ws/NFeAutorizacao4`). Com `baseUrl`, a URL completa. */
  path(servico: SimServico, autorizador?: SimAutorizador): string;
  url(baseUrl: string, servico: SimServico, autorizador?: SimAutorizador): string;
  /** Agenda uma falha de rede para os próximos pedidos que casarem com o alvo. */
  injectFault(fault: SimFault, target?: FaultTarget): void;
  clearFaults(): void;
  /** Serviço paralisado no autorizador (108 ou 109), ou `undefined` para voltar à operação. */
  setParalisacao(cStat: '108' | '109' | undefined, autorizador?: SimAutorizador): void;
  /** Serviços do MDF-e (SVRS) paralisados (108 ou 109), ou `undefined` para voltar à operação. */
  setParalisacaoMdfe(cStat: '108' | '109' | undefined): void;
  /**
   * Protocolos sem `digVal` (veja `ProtocoloSemDigVal`): `denegacao` ou `todos`, na resposta da autorização, na da
   * consulta ou nas duas (padrão). `undefined` volta ao normal. Vale para as respostas seguintes, inclusive de NF-e e
   * MDF-e já registrados; o estado guarda o `digVal`.
   */
  setProtocoloSemDigVal(quais: 'denegacao' | 'todos' | undefined, onde?: 'autorizacao' | 'consulta' | 'ambos'): void;
  /**
   * Liga a contingência (a UF responde 108 e a SVC passa a atender, ativa para as UFs atendidas) ou desliga com
   * `undefined` (a UF volta, e a SVC responde 114). Desfaz o `setAtivacaoSvc`.
   */
  setContingencia(svc: Svc | undefined): void;
  /**
   * Ativação da SVC para a UF (padrão: a simulada), sem mexer na UF: `ativa` (107), `desativando` com a hora (113 no
   * status até ela, 114 depois) ou `inativa` (114 no status e na autorização). `undefined` volta ao que
   * `setContingencia` dá. NT 2013.007 v1.03, itens 03, 04.1 e 04.7.
   */
  setAtivacaoSvc(ativacao: AtivacaoSvc | undefined, uf?: Uf): void;
  /** Processa os lotes assíncronos vencidos no relógio atual. */
  settle(): Promise<void>;
  readonly inspect: SimInspect;
}

interface ArmedFault {
  readonly fault: SimFault;
  readonly target: FaultTarget;
  remaining: number;
}

function resolveConfig(o: SefazSimOptions): SimConfig {
  const uf = o.uf ?? 'SP';
  if (!ehUf(uf)) throw new ErroDeConfiguracao(`UF inválida: ${String(uf)}`);
  const ambiente = o.ambiente ?? 'homologacao';
  const cUFs = [uf, ...(o.ufsAtendidas ?? [])].map((u) => {
    if (!ehUf(u)) throw new ErroDeConfiguracao(`UF atendida inválida: ${String(u)}`);
    return (ufPorSigla(u) as UnidadeFederativa).cUF;
  });
  return {
    clock: o.clock,
    ambiente,
    tpAmb: tpAmbDoAmbiente(ambiente),
    uf,
    cUF: (ufPorSigla(uf) as UnidadeFederativa).cUF,
    cUFsAtendidas: [...new Set(cUFs)],
    offsetMinutes: o.offsetMinutes ?? -180,
    cadastro: o.cadastro ?? [],
    rules: o.rules ?? DEFAULT_RULES,
    exigirCertificado: o.exigirCertificado ?? true,
    prazoCancelamentoMs: (o.prazoCancelamentoHoras ?? 24) * 3_600_000,
    prazoCancelamentoSubstituicaoMs: (o.prazoCancelamentoSubstituicaoHoras ?? 168) * 3_600_000,
    atrasoProcessamentoMs: o.atrasoProcessamentoMs ?? 0,
    respostaSincrona: o.respostaSincrona ?? 'aceita',
    intervaloConsumoIndevidoMs: o.intervaloConsumoIndevidoMs ?? 3_600_000,
    tamanhoMaximo: o.tamanhoMaximo ?? 500 * 1024,
    prazoCancelamentoMdfeMs: (o.prazoCancelamentoMdfeHoras ?? 24) * 3_600_000,
    tamanhoMaximoMdfe: o.tamanhoMaximoMdfe ?? 2048 * 1024,
    regrasMdfeDesligadas: new Set(o.regrasMdfeDesligadas ?? []),
  };
}

const HANDLERS: Readonly<Record<SimServico, (ctx: RequestContext) => string | Promise<string>>> = {
  NfeStatusServico: statusServico,
  NFeAutorizacao: autorizacao,
  NFeRetAutorizacao: retAutorizacao,
  NfeConsultaProtocolo: consultaProtocolo,
  RecepcaoEvento: recepcaoEvento,
  NfeInutilizacao: inutilizacao,
  NfeConsultaCadastro: consultaCadastro,
  NFeDistribuicaoDFe: distribuicao,
  MDFeRecepcaoSinc: recepcaoMdfe,
  MDFeConsulta: consultaMdfe,
  MDFeConsNaoEnc: consNaoEncMdfe,
  MDFeStatusServico: statusServicoMdfe,
  MDFeRecepcaoEvento: recepcaoEventoMdfe,
};

const TEXT = 'text/plain; charset=utf-8';

function plain(status: number, body: string): SimResult {
  return { status, headers: { 'content-type': TEXT }, body, effect: 'respond', delayMs: 0 };
}

/** Cria a SEFAZ simulada. Cada instância tem estado próprio. */
export function createSefazSim(options: SefazSimOptions): SefazSim {
  const config = resolveConfig(options);
  const rt: Runtime = {
    config,
    state: new SimState(),
    contingencia: undefined,
    svcPadrao: nfeContingenciaDaUf(config.uf as Uf, config.ambiente),
    ativacaoSvc: new Map(),
    paralisacao: new Map(),
    paralisacaoMdfe: undefined,
    semDigVal: undefined,
  };
  const faults: ArmedFault[] = [];
  // Um pedido por vez da leitura do relógio até a resposta: a verificação de assinatura é assíncrona, e dois pedidos
  // intercalados veriam o estado pela metade (lote publicado antes de processar, duplicidade não detectada).
  let fila: Promise<unknown> = Promise.resolve();
  function exclusivo<T>(fn: () => Promise<T>): Promise<T> {
    const run = fila.then(fn, fn);
    fila = run.catch(() => undefined);
    return run;
  }
  const defaultAutorizador = (s: SimServico): SimAutorizador => (s === 'NFeDistribuicaoDFe' ? 'an' : 'uf');

  function takeFault(servico: SimServico, autorizador: SimAutorizador): SimFault | undefined {
    const i = faults.findIndex(
      (f) =>
        (f.target.servico === undefined || f.target.servico === servico) &&
        (f.target.autorizador === undefined || f.target.autorizador === autorizador),
    );
    if (i < 0) return undefined;
    const armed = faults[i] as ArmedFault;
    armed.remaining -= 1;
    if (armed.remaining <= 0) faults.splice(i, 1);
    return armed.fault;
  }

  async function atender(request: SimRequest): Promise<SimResult> {
    const route = routeOf(request.path);
    if (route === undefined) return plain(404, 'serviço não encontrado');
    const { def, autorizador } = route;
    const fault = takeFault(def.servico, autorizador);
    if (fault?.kind === 'http') return plain(fault.status, `HTTP ${fault.status}`);
    const network = fault?.kind === 'drop' || fault?.kind === 'hang' ? fault : undefined;
    if (network?.phase === 'before') return { ...plain(0, ''), effect: network.kind };
    if ((request.method ?? 'POST').toUpperCase() !== 'POST') return plain(405, 'use POST');
    const now = config.clock.agora().getTime();
    let transmissor: CertIdentity | undefined;
    let transmissorRecusado: string | undefined;
    if (request.clientCertificate === undefined) {
      if (config.exigirCertificado) return plain(403, 'certificado de cliente obrigatório');
    } else {
      const c = checkTransmissor(request.clientCertificate, now);
      if (c.ok) transmissor = c.identity;
      else transmissorRecusado = c.cStat;
    }
    const body = typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body);
    const soap = parseSoapRequest(body, def, request.headers?.['content-type']);
    if (!soap.ok) {
      return {
        status: 500,
        headers: { 'content-type': SOAP_CONTENT_TYPE },
        body: soapFaultEnvelope(soap.code, soap.reason),
        effect: 'respond',
        delayMs: 0,
      };
    }
    await settleLotes(rt, now);
    const ctx: RequestContext = {
      rt,
      def,
      autorizador,
      payload: soap.payload,
      now,
      transmissor,
      transmissorRecusado,
    };
    const ret = await HANDLERS[def.servico](ctx);
    const effect: SimEffect = network?.kind ?? 'respond';
    return {
      status: 200,
      headers: { 'content-type': SOAP_CONTENT_TYPE },
      body: soapResponse(def, ret, soap.naOperacao === true),
      effect,
      delayMs: fault?.kind === 'delay' ? fault.ms : 0,
    };
  }

  const st = rt.state;
  return {
    config,
    handle: (request: SimRequest): Promise<SimResult> => exclusivo(() => atender(request)),
    path: (servico: SimServico, autorizador?: SimAutorizador): string =>
      servicePath(servico, autorizador ?? defaultAutorizador(servico)),
    url: (baseUrl: string, servico: SimServico, autorizador?: SimAutorizador): string =>
      `${baseUrl.replace(/\/+$/, '')}${servicePath(servico, autorizador ?? defaultAutorizador(servico))}`,
    injectFault(fault: SimFault, target: FaultTarget = {}): void {
      faults.push({ fault, target, remaining: target.times ?? 1 });
    },
    clearFaults(): void {
      faults.length = 0;
    },
    setParalisacao(cStat: '108' | '109' | undefined, autorizador: SimAutorizador = 'uf'): void {
      if (cStat === undefined) rt.paralisacao.delete(autorizador);
      else rt.paralisacao.set(autorizador, cStat);
    },
    setParalisacaoMdfe(cStat: '108' | '109' | undefined): void {
      rt.paralisacaoMdfe = cStat;
    },
    setProtocoloSemDigVal(
      quais: 'denegacao' | 'todos' | undefined,
      onde: 'autorizacao' | 'consulta' | 'ambos' = 'ambos',
    ): void {
      rt.semDigVal = quais === undefined ? undefined : { quais, onde };
    },
    setContingencia(svc: Svc | undefined): void {
      rt.contingencia = svc;
      rt.ativacaoSvc.clear();
    },
    setAtivacaoSvc(ativacao: AtivacaoSvc | undefined, uf?: Uf): void {
      const sigla = uf ?? config.uf;
      if (!ehUf(sigla)) throw new ErroDeConfiguracao(`UF inválida: ${String(sigla)}`);
      const { cUF } = ufPorSigla(sigla) as UnidadeFederativa;
      if (ativacao === undefined) rt.ativacaoSvc.delete(cUF);
      else rt.ativacaoSvc.set(cUF, ativacao);
    },
    settle: (): Promise<void> => exclusivo(() => settleLotes(rt, config.clock.agora().getTime())),
    inspect: {
      nfe: (chave: string): NfeRecord | undefined => st.nfes.get(chave),
      nfes: (): readonly NfeRecord[] => [...st.nfes.values()],
      eventos: (chave?: string): readonly EventoRecord[] =>
        chave === undefined ? [...st.eventos] : st.eventosDa(chave),
      inutilizacoes: (): readonly InutilizacaoRecord[] => [...st.inutilizacoes],
      mdfe: (chave: string): MdfeRecord | undefined => st.mdfes.get(chave),
      mdfes: (): readonly MdfeRecord[] => [...st.mdfes.values()],
      eventosMdfe: (chave?: string): readonly MdfeEventoRecord[] =>
        chave === undefined ? [...st.eventosMdfe] : st.eventosDoMdfe(chave),
      lote: (nRec: string): LoteRecord | undefined => st.lotes.get(nRec),
      distribuicao: (interessado: string): readonly DistDoc[] => [...(st.distribuicao.get(interessado) ?? [])],
    },
  };
}
