/**
 * `criarSefazSim`: a SEFAZ simulada, com estado e relógio injetado. Recebe pedidos HTTP já lidos (`PedidoSim`) e
 * devolve a resposta com o efeito de rede que o cenário pediu (`RespostaSim`). Os adaptadores de transporte (em processo
 * e servidor HTTPS) aplicam o efeito: responder, derrubar a conexão ou não responder.
 */

import type { Ambiente, Relogio, Uf, UnidadeFederativa } from '@sinete/core';
import { ErroDeConfiguracao, ehUf, tpAmbDoAmbiente, ufPorSigla } from '@sinete/core';
import { nfeContingenciaDaUf } from '@sinete/transport';
import type { IdentidadeDoCertificado } from './certs.ts';
import { conferirTransmissor } from './certs.ts';
import type { AtivacaoSvc, ConfiguracaoSim, ContextoDoPedido, EstadoDeExecucao, Svc } from './context.ts';
import { consNaoEncMdfe, consultaMdfe, statusServicoMdfe } from './mdfe/consultas.ts';
import { recepcaoEventoMdfe } from './mdfe/evento.ts';
import { recepcaoMdfe } from './mdfe/recepcao.ts';
import type { RegrasSim } from './rules.ts';
import { REGRAS_PADRAO } from './rules.ts';
import { autorizacao, retAutorizacao, settleLotes } from './services/autorizacao.ts';
import { consultaProtocolo, statusServico } from './services/consulta.ts';
import { distribuicao } from './services/distribuicao.ts';
import { recepcaoEvento } from './services/evento.ts';
import { consultaCadastro, inutilizacao } from './services/inutilizacao.ts';
import type { AutorizadorSim, ServicoSim } from './services.ts';
import { caminhoDoServico, rotaDe } from './services.ts';
import { parseSoapRequest, SOAP_CONTENT_TYPE, soapFaultEnvelope, soapResponse } from './soap.ts';
import type {
  Contribuinte,
  DocumentoDaDistribuicao,
  RegistroEvento,
  RegistroEventoMdfe,
  RegistroInutilizacao,
  RegistroLote,
  RegistroMdfe,
  RegistroNfe,
} from './state.ts';
import { SimState } from './state.ts';

export interface SefazSimOpcoes {
  /** Relógio de emissão da SEFAZ simulada. Nos testes, um `relogioManual` do `@sinete/core`. */
  readonly relogio: Relogio;
  /** UF autorizadora simulada. Padrão: `SP`. */
  readonly uf?: Uf;
  /** UFs atendidas além da própria (autorizador virtual). */
  readonly ufsAtendidas?: readonly Uf[];
  /** Padrão: `homologacao`. */
  readonly ambiente?: Ambiente;
  /** Fuso do autorizador em minutos, para `dhRecbto`. Padrão: -180. */
  readonly deslocamentoMin?: number;
  /** Cadastro de contribuintes (regras 1C17 da autorização, consulta cadastro, inutilização). */
  readonly cadastro?: readonly Contribuinte[];
  /** Regras de negócio. Padrão: `REGRAS_PADRAO`. */
  readonly regras?: RegrasSim;
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
export interface PedidoSim {
  readonly metodo?: string;
  /** Caminho com a query, como `/uf/ws/NFeAutorizacao4`. */
  readonly caminho: string;
  /** Cabeçalhos com nome em minúsculas. */
  readonly cabecalhos?: Readonly<Record<string, string>>;
  readonly corpo?: string | Uint8Array;
  /** Certificado de cliente apresentado no TLS, em DER. */
  readonly certificadoDoCliente?: Uint8Array;
}

/** O que fazer com a conexão: responder, derrubar ou deixar sem resposta até o cliente desistir. */
export type EfeitoSim = 'responder' | 'derrubar' | 'travar';

export interface RespostaSim {
  readonly status: number;
  readonly cabecalhos: Readonly<Record<string, string>>;
  readonly corpo: string;
  readonly efeito: EfeitoSim;
  /** Espera antes do efeito, em ms de tempo real. */
  readonly atrasoMs: number;
}

/** Falha de rede injetada. */
export type FalhaSim =
  /** Derruba a conexão antes de processar (o pedido não chega) ou depois (processado, sem resposta: o 204 do reenvio). */
  | { readonly tipo: 'derrubar'; readonly fase: 'antes' | 'depois' }
  /** Não responde até o cliente desistir, antes ou depois de processar. */
  | { readonly tipo: 'travar'; readonly fase: 'antes' | 'depois' }
  /** Responde normalmente depois de uma espera em tempo real. */
  | { readonly tipo: 'atraso'; readonly ms: number }
  /** Responde só um status HTTP (503 do balanceador, 500 do IIS), sem processar. */
  | { readonly tipo: 'http'; readonly status: number };

export interface AlvoDaFalha {
  /** Só este serviço (da NF-e ou do MDF-e); padrão: todos. */
  readonly servico?: ServicoSim;
  readonly autorizador?: AutorizadorSim;
  /** Quantas vezes a falha acontece. Padrão: 1. `Infinity` até `limparFalhas()`. */
  readonly vezes?: number;
}

/** Consultas ao estado para as asserções dos testes. */
export interface InspecaoSim {
  nfe(chave: string): RegistroNfe | undefined;
  nfes(): readonly RegistroNfe[];
  eventos(chave?: string): readonly RegistroEvento[];
  inutilizacoes(): readonly RegistroInutilizacao[];
  mdfe(chave: string): RegistroMdfe | undefined;
  mdfes(): readonly RegistroMdfe[];
  eventosMdfe(chave?: string): readonly RegistroEventoMdfe[];
  lote(nRec: string): RegistroLote | undefined;
  /** Fila de distribuição de um interessado (CNPJ ou CPF). */
  distribuicao(interessado: string): readonly DocumentoDaDistribuicao[];
}

export interface SefazSim {
  readonly configuracao: ConfiguracaoSim;
  /** Atende um pedido. */
  atender(pedido: PedidoSim): Promise<RespostaSim>;
  /** Caminho do serviço (`/uf/ws/NFeAutorizacao4`). Com `url`, a URL completa a partir da `urlBase`. */
  caminho(servico: ServicoSim, autorizador?: AutorizadorSim): string;
  url(urlBase: string, servico: ServicoSim, autorizador?: AutorizadorSim): string;
  /** Agenda uma falha de rede para os próximos pedidos que casarem com o alvo. */
  injetarFalha(falha: FalhaSim, alvo?: AlvoDaFalha): void;
  limparFalhas(): void;
  /** Serviço paralisado no autorizador (108 ou 109), ou `undefined` para voltar à operação. */
  definirParalisacao(cStat: '108' | '109' | undefined, autorizador?: AutorizadorSim): void;
  /** Serviços do MDF-e (SVRS) paralisados (108 ou 109), ou `undefined` para voltar à operação. */
  definirParalisacaoMdfe(cStat: '108' | '109' | undefined): void;
  /**
   * Protocolos sem `digVal` (veja `ProtocoloSemDigVal`): `denegacao` ou `todos`, na resposta da autorização, na da
   * consulta ou nas duas (padrão). `undefined` volta ao normal. Vale para as respostas seguintes, inclusive de NF-e e
   * MDF-e já registrados; o estado guarda o `digVal`.
   */
  definirProtocoloSemDigVal(
    quais: 'denegacao' | 'todos' | undefined,
    onde?: 'autorizacao' | 'consulta' | 'ambos',
  ): void;
  /**
   * Liga a contingência (a UF responde 108 e a SVC passa a atender, ativa para as UFs atendidas) ou desliga com
   * `undefined` (a UF volta, e a SVC responde 114). Desfaz o `definirAtivacaoSvc`.
   */
  definirContingencia(svc: Svc | undefined): void;
  /**
   * Ativação da SVC para a UF (padrão: a simulada), sem mexer na UF: `ativa` (107), `desativando` com a hora (113 no
   * status até ela, 114 depois) ou `inativa` (114 no status e na autorização). `undefined` volta ao que
   * `definirContingencia` dá. NT 2013.007 v1.03, itens 03, 04.1 e 04.7.
   */
  definirAtivacaoSvc(ativacao: AtivacaoSvc | undefined, uf?: Uf): void;
  /** Processa os lotes assíncronos vencidos no relógio atual. */
  processarLotes(): Promise<void>;
  readonly inspecao: InspecaoSim;
}

interface ArmedFault {
  readonly fault: FalhaSim;
  readonly target: AlvoDaFalha;
  remaining: number;
}

function resolveConfig(o: SefazSimOpcoes): ConfiguracaoSim {
  const uf = o.uf ?? 'SP';
  if (!ehUf(uf)) throw new ErroDeConfiguracao(`UF inválida: ${String(uf)}`);
  const ambiente = o.ambiente ?? 'homologacao';
  const cUFs = [uf, ...(o.ufsAtendidas ?? [])].map((u) => {
    if (!ehUf(u)) throw new ErroDeConfiguracao(`UF atendida inválida: ${String(u)}`);
    return (ufPorSigla(u) as UnidadeFederativa).cUF;
  });
  return {
    relogio: o.relogio,
    ambiente,
    tpAmb: tpAmbDoAmbiente(ambiente),
    uf,
    cUF: (ufPorSigla(uf) as UnidadeFederativa).cUF,
    cUFsAtendidas: [...new Set(cUFs)],
    deslocamentoMin: o.deslocamentoMin ?? -180,
    cadastro: o.cadastro ?? [],
    regras: o.regras ?? REGRAS_PADRAO,
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

const HANDLERS: Readonly<Record<ServicoSim, (ctx: ContextoDoPedido) => string | Promise<string>>> = {
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

function plain(status: number, body: string): RespostaSim {
  return { status, cabecalhos: { 'content-type': TEXT }, corpo: body, efeito: 'responder', atrasoMs: 0 };
}

/** Cria a SEFAZ simulada. Cada instância tem estado próprio. */
export function criarSefazSim(opcoes: SefazSimOpcoes): SefazSim {
  const config = resolveConfig(opcoes);
  const rt: EstadoDeExecucao = {
    configuracao: config,
    estado: new SimState(),
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
  const defaultAutorizador = (s: ServicoSim): AutorizadorSim => (s === 'NFeDistribuicaoDFe' ? 'an' : 'uf');

  function takeFault(servico: ServicoSim, autorizador: AutorizadorSim): FalhaSim | undefined {
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

  async function atender(request: PedidoSim): Promise<RespostaSim> {
    const route = rotaDe(request.caminho);
    if (route === undefined) return plain(404, 'serviço não encontrado');
    const { definicao: def, autorizador } = route;
    const fault = takeFault(def.servico, autorizador);
    if (fault?.tipo === 'http') return plain(fault.status, `HTTP ${fault.status}`);
    const network = fault?.tipo === 'derrubar' || fault?.tipo === 'travar' ? fault : undefined;
    if (network?.fase === 'antes') return { ...plain(0, ''), efeito: network.tipo };
    if ((request.metodo ?? 'POST').toUpperCase() !== 'POST') return plain(405, 'use POST');
    const now = config.relogio.agora().getTime();
    let transmissor: IdentidadeDoCertificado | undefined;
    let transmissorRecusado: string | undefined;
    if (request.certificadoDoCliente === undefined) {
      if (config.exigirCertificado) return plain(403, 'certificado de cliente obrigatório');
    } else {
      const c = conferirTransmissor(request.certificadoDoCliente, now);
      if (c.ok) transmissor = c.identidade;
      else transmissorRecusado = c.cStat;
    }
    const body = typeof request.corpo === 'string' ? request.corpo : new TextDecoder().decode(request.corpo);
    const soap = parseSoapRequest(body, def, request.cabecalhos?.['content-type']);
    if (!soap.ok) {
      return {
        status: 500,
        cabecalhos: { 'content-type': SOAP_CONTENT_TYPE },
        corpo: soapFaultEnvelope(soap.code, soap.reason),
        efeito: 'responder',
        atrasoMs: 0,
      };
    }
    await settleLotes(rt, now);
    const ctx: ContextoDoPedido = {
      rt: rt,
      definicao: def,
      autorizador,
      payload: soap.payload,
      agora: now,
      transmissor,
      transmissorRecusado,
    };
    const ret = await HANDLERS[def.servico](ctx);
    const effect: EfeitoSim = network?.tipo ?? 'responder';
    return {
      status: 200,
      cabecalhos: { 'content-type': SOAP_CONTENT_TYPE },
      corpo: soapResponse(def, ret, soap.naOperacao === true),
      efeito: effect,
      atrasoMs: fault?.tipo === 'atraso' ? fault.ms : 0,
    };
  }

  const st = rt.estado;
  return {
    configuracao: config,
    atender: (request: PedidoSim): Promise<RespostaSim> => exclusivo(() => atender(request)),
    caminho: (servico: ServicoSim, autorizador?: AutorizadorSim): string =>
      caminhoDoServico(servico, autorizador ?? defaultAutorizador(servico)),
    url: (baseUrl: string, servico: ServicoSim, autorizador?: AutorizadorSim): string =>
      `${baseUrl.replace(/\/+$/, '')}${caminhoDoServico(servico, autorizador ?? defaultAutorizador(servico))}`,
    injetarFalha(fault: FalhaSim, target: AlvoDaFalha = {}): void {
      faults.push({ fault, target, remaining: target.vezes ?? 1 });
    },
    limparFalhas(): void {
      faults.length = 0;
    },
    definirParalisacao(cStat: '108' | '109' | undefined, autorizador: AutorizadorSim = 'uf'): void {
      if (cStat === undefined) rt.paralisacao.delete(autorizador);
      else rt.paralisacao.set(autorizador, cStat);
    },
    definirParalisacaoMdfe(cStat: '108' | '109' | undefined): void {
      rt.paralisacaoMdfe = cStat;
    },
    definirProtocoloSemDigVal(
      quais: 'denegacao' | 'todos' | undefined,
      onde: 'autorizacao' | 'consulta' | 'ambos' = 'ambos',
    ): void {
      rt.semDigVal = quais === undefined ? undefined : { quais, onde };
    },
    definirContingencia(svc: Svc | undefined): void {
      rt.contingencia = svc;
      rt.ativacaoSvc.clear();
    },
    definirAtivacaoSvc(ativacao: AtivacaoSvc | undefined, uf?: Uf): void {
      const sigla = uf ?? config.uf;
      if (!ehUf(sigla)) throw new ErroDeConfiguracao(`UF inválida: ${String(sigla)}`);
      const { cUF } = ufPorSigla(sigla) as UnidadeFederativa;
      if (ativacao === undefined) rt.ativacaoSvc.delete(cUF);
      else rt.ativacaoSvc.set(cUF, ativacao);
    },
    processarLotes: (): Promise<void> => exclusivo(() => settleLotes(rt, config.relogio.agora().getTime())),
    inspecao: {
      nfe: (chave: string): RegistroNfe | undefined => st.nfes.get(chave),
      nfes: (): readonly RegistroNfe[] => [...st.nfes.values()],
      eventos: (chave?: string): readonly RegistroEvento[] =>
        chave === undefined ? [...st.eventos] : st.eventosDa(chave),
      inutilizacoes: (): readonly RegistroInutilizacao[] => [...st.inutilizacoes],
      mdfe: (chave: string): RegistroMdfe | undefined => st.mdfes.get(chave),
      mdfes: (): readonly RegistroMdfe[] => [...st.mdfes.values()],
      eventosMdfe: (chave?: string): readonly RegistroEventoMdfe[] =>
        chave === undefined ? [...st.eventosMdfe] : st.eventosDoMdfe(chave),
      lote: (nRec: string): RegistroLote | undefined => st.lotes.get(nRec),
      distribuicao: (interessado: string): readonly DocumentoDaDistribuicao[] => [
        ...(st.distribuicao.get(interessado) ?? []),
      ],
    },
  };
}
