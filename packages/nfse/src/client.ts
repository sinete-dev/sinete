/**
 * Cliente da NFS-e Nacional sobre o `@sinete/transport`: emissão síncrona na Sefin Nacional (`POST /nfse`),
 * substituição, consultas por chave e por Id da DPS, eventos (registro e consulta) e parâmetros municipais com cache.
 * O DANFSe não vem mais do ADN, cuja API de geração foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026, 1): ele sai
 * do XML da NFS-e pelo `danfse` de `@sinete/da/nfse`.
 *
 * mTLS com o certificado do próprio emitente: a Sefin autoriza pelo certificado do canal e exige que a DPS seja
 * assinada pelo emitente (E0718); o sinete não usa transmissor terceiro na NFS-e. O `Transport` recebido é quem
 * apresenta o certificado; confira que é o mesmo e-CNPJ ou e-CPF que assina a DPS.
 *
 * Mensagens (REST com JSON; documentos em gzip e base64): `{"dpsXmlGZipB64"}` na emissão, `{"nfseXmlGZipB64",
 * "chaveAcesso", "idDps", "alertas"}` na resposta; `{"pedidoRegistroEventoXmlGZipB64"}` no evento e
 * `{"eventoXmlGZipB64"}` na resposta; na consulta de eventos, `{"eventos":[{"arquivoXml"}]}` com o XML em base64 do
 * gzip em base64. A rejeição é HTTP 4xx com `erros` (ver `respostas.ts`).
 *
 * Idempotência: grave a DPS assinada antes de enviar. Sem resposta (timeout, conexão caída), nunca monte outra DPS
 * para o mesmo número: `resolverEnvioSemResposta` consulta a DPS pelo Id e, se ela não gerou NFS-e, manda reenviar
 * os mesmos bytes.
 */

import type { Ambiente, Authorized, Clock, Logger, Signer } from '@sinete/core';
import { authorized, ConfigError, noopLogger, ProtocolError, tpAmbOf, ValidationError } from '@sinete/core';
import type { XmlElement } from '@sinete/core/xml';
import { attributeOf, childElements, descendants, firstChild, parseXml, textOf, XMLDSIG_NS } from '@sinete/core/xml';
import { decodeXml } from '@sinete/schemas';
import type { TCNFSe } from '@sinete/schemas/nfse/1.01-20260727';
import { NFSeElement } from '@sinete/schemas/nfse/1.01-20260727';
import type { EndpointRef, NfseApi, Transport, TransportResponse } from '@sinete/transport';
import { nfseEndpoint } from '@sinete/transport';
import { parseChaveNfse } from './codigos.ts';
import situacoes from './data/situacoes.json' with { type: 'json' };
import type { AnaliseFiscalPedido, CancelamentoPedido } from './evento.ts';
import { buildPedidoAnaliseFiscal, buildPedidoCancelamento, signPedidoEvento } from './evento.ts';
import { gunzipBase64, gunzipBase64Duplo, gzipBase64 } from './gzip.ts';
import { NFSE_NS } from './leiaute.ts';
import type { CacheParametros, ParametrosMunicipais } from './parametros.ts';
import { createParametrosMunicipais } from './parametros.ts';
import type { NfseMensagem, NfseOutcome } from './respostas.ts';
import { documentosDosEventos, exigirTexto, lerJson, mensagens, rejeicao, texto } from './respostas.ts';

export interface NfseClientOptions {
  /** Transporte com a identidade TLS do emitente (e-CNPJ ou e-CPF A1, ou A3 pelo helper). */
  readonly transport: Transport;
  /** `homologacao` é a produção restrita. */
  readonly ambiente: Ambiente;
  /** Relógio de emissão: `dhEvento` e validade do cache de parâmetros. */
  readonly clock: Clock;
  /** Assina os pedidos de evento em `cancelar` e `solicitarAnaliseFiscal`. */
  readonly signer?: Signer;
  readonly logger?: Logger;
  /** Prazo por requisição; padrão o do transporte. */
  readonly timeoutMs?: number;
  /** Cache da parametrização municipal; `false` desliga. Padrão: em memória. */
  readonly cacheParametros?: CacheParametros | false;
  /** Validade de uma consulta de parâmetro com resposta. Padrão: 6 horas. */
  readonly ttlParametrosMs?: number;
  /** Sobrepõe a base de uma API (padrão: `nfseEndpoint` do `@sinete/transport`). */
  readonly endpoint?: (api: NfseApi, ambiente: Ambiente) => EndpointRef;
  /** `verAplic` repassado ao `cancelar` e ao `solicitarAnaliseFiscal`; sem valor, cada um usa seu próprio padrão. */
  readonly verAplic?: string;
}

/** NFS-e gerada pela Sefin. `xml` é a string recebida, nunca reserializada; `nfse` é a leitura tolerante dela. */
export interface NfseGerada {
  readonly chaveAcesso: string;
  readonly idDps: string;
  readonly xml: string;
  readonly nfse: TCNFSe;
  readonly nNFSe: string;
  readonly dhProc: string;
  readonly alertas: readonly NfseMensagem[];
  readonly dataHoraProcessamento: string | undefined;
  readonly versaoAplicativo: string | undefined;
}

/** NFS-e lida numa consulta por chave. */
export interface NfseConsultada {
  readonly chaveAcesso: string;
  readonly xml: string;
  readonly nfse: TCNFSe;
}

/** Evento registrado (`evento` do Anexo II), com o XML como veio. */
export interface EventoRegistrado {
  readonly xml: string;
  readonly id: string;
  readonly chaveAcesso: string;
  /** Código do evento (`101101`, `105102`...), lido do grupo `e<código>` do pedido. */
  readonly tpEvento: string;
  readonly nSeqEvento: string;
  readonly dhProc: string;
}

/**
 * Tipo e sequência do evento procurado, os dois obrigatórios. Na produção restrita (28/09/2026) a Sefin respondeu 405
 * a `GET /nfse/{chave}/eventos` e 404 (página HTML do IIS) a `GET /nfse/{chave}/eventos/{tipo}`; só o caminho com a
 * sequência devolveu o evento. O cancelamento (e101101) é sempre a sequência 1.
 */
export interface FiltroEventos {
  /** Código do evento, 6 dígitos (`101101`, `105102`...). */
  readonly tpEvento: string;
  /** Sequência do evento, a partir de 1. */
  readonly nSeqEvento: number;
}

export interface OpcoesEnvio {
  readonly signal?: AbortSignal;
}

export interface NfseClient {
  readonly ambiente: Ambiente;
  /** Envia a DPS assinada (com a declaração UTF-8) e devolve a NFS-e gerada ou a rejeição. */
  autorizar(dpsAssinada: string, opcoes?: OpcoesEnvio): Promise<NfseOutcome<NfseGerada>>;
  /**
   * Emite a DPS substituta (com o grupo `subst`). A Sefin gera a nova NFS-e e registra sozinha o cancelamento por
   * substituição (e105102) na substituída.
   */
  substituir(dpsAssinada: string, opcoes?: OpcoesEnvio): Promise<NfseOutcome<NfseGerada>>;
  /** NFS-e pela chave, ou `undefined` se a Sefin responder 404. */
  consultar(chave: string, opcoes?: OpcoesEnvio): Promise<NfseConsultada | undefined>;
  /** Chave da NFS-e gerada a partir da DPS de Id `idDps`, ou `undefined` se a DPS não gerou NFS-e. */
  consultarDps(
    idDps: string,
    opcoes?: OpcoesEnvio,
  ): Promise<{ readonly idDps: string; readonly chaveAcesso: string } | undefined>;
  /** Registra um pedido de evento já assinado. */
  registrarEvento(pedidoAssinado: string, opcoes?: OpcoesEnvio): Promise<NfseOutcome<EventoRegistrado>>;
  /** Monta, assina (com `options.signer`) e registra o cancelamento (e101101). */
  cancelar(pedido: CancelamentoPedido, opcoes?: OpcoesEnvio): Promise<NfseOutcome<EventoRegistrado>>;
  /** Monta, assina e registra a solicitação de análise fiscal para cancelamento (e101103). */
  solicitarAnaliseFiscal(pedido: AnaliseFiscalPedido, opcoes?: OpcoesEnvio): Promise<NfseOutcome<EventoRegistrado>>;
  /**
   * Evento de um tipo e de uma sequência (`GET /nfse/{chave}/eventos/{tipo}/{seq}`), ou lista vazia se a Sefin
   * responder 404. A Sefin real não lista os eventos sem os dois (ver `FiltroEventos`).
   */
  consultarEventos(chave: string, filtro: FiltroEventos, opcoes?: OpcoesEnvio): Promise<readonly EventoRegistrado[]>;
  readonly parametros: ParametrosMunicipais;
}

interface DpsLida {
  readonly id: string;
  readonly tpAmb: string;
  readonly substituta: boolean;
}

function lerDps(xml: string): DpsLida {
  if (!xml.startsWith('<?xml')) {
    throw new ConfigError(
      'DPS sem a declaração XML: a Sefin recusa com E1229; monte com buildDps, que já a inclui, e assine a string dele',
    );
  }
  let root: XmlElement;
  try {
    root = parseXml(xml).root;
  } catch (cause) {
    throw new ConfigError('DPS não é XML bem formado', { cause });
  }
  const inf = firstChild(root, 'infDPS', NFSE_NS);
  if (root.local !== 'DPS' || root.ns !== NFSE_NS || inf === undefined)
    throw new ConfigError('o documento não é uma DPS');
  const tpAmb = firstChild(inf, 'tpAmb', NFSE_NS);
  return {
    id: attributeOf(inf, 'Id') ?? '',
    tpAmb: tpAmb === undefined ? '' : textOf(tpAmb),
    substituta: firstChild(inf, 'subst', NFSE_NS) !== undefined,
  };
}

function lerEvento(xml: string, operacao: string): EventoRegistrado {
  let root: XmlElement;
  try {
    root = parseXml(xml).root;
  } catch (cause) {
    throw new ProtocolError(`${operacao}: evento não é XML bem formado`, { cause });
  }
  const inf = firstChild(root, 'infEvento', NFSE_NS);
  const ped = inf && firstChild(inf, 'pedRegEvento', NFSE_NS);
  const infPed = ped && firstChild(ped, 'infPedReg', NFSE_NS);
  if (root.local !== 'evento' || inf === undefined || infPed === undefined) {
    throw new ProtocolError(`${operacao}: resposta sem evento`, { details: { operacao, raiz: root.local } });
  }
  const grupo = childElements(infPed).find((e) => /^e\d{6}$/.test(e.local));
  const val = (el: XmlElement, nome: string): string => {
    const c = firstChild(el, nome, NFSE_NS);
    return c === undefined ? '' : textOf(c);
  };
  return {
    xml,
    id: attributeOf(inf, 'Id') ?? '',
    chaveAcesso: val(infPed, 'chNFSe'),
    tpEvento: grupo === undefined ? '' : grupo.local.slice(1),
    nSeqEvento: val(inf, 'nSeqEvento'),
    dhProc: val(inf, 'dhProc'),
  };
}

function conferirChave(chave: string): void {
  parseChaveNfse(chave);
}

/** Desfecho `authorized` da NFS-e gerada, com o `cStat` do documento e o texto da tabela de situações. */
function geradaAutorizada(nfse: TCNFSe, v: Omit<NfseGerada, 'nfse' | 'nNFSe' | 'dhProc'>): Authorized<NfseGerada> {
  const inf = nfse.infNFSe;
  const cStat = inf.cStat;
  const xMotivo = (situacoes.nfse as Record<string, string>)[cStat] ?? 'NFS-e gerada';
  return authorized({ cStat, xMotivo }, { ...v, nfse, nNFSe: inf.nNFSe, dhProc: inf.dhProc });
}

/** Cria o cliente. Nada é enviado até a primeira operação. */
export function createNfseClient(options: NfseClientOptions): NfseClient {
  const { transport, ambiente } = options;
  const logger = options.logger ?? noopLogger;
  const endpointDe = (api: NfseApi): EndpointRef =>
    (options.endpoint ?? ((a: NfseApi, amb: Ambiente): EndpointRef => nfseEndpoint({ ambiente: amb, api: a })))(
      api,
      ambiente,
    );
  const tpAmb = tpAmbOf(ambiente);

  async function enviar(
    api: NfseApi,
    caminho: string,
    corpo: Record<string, string> | undefined,
    opcoes: OpcoesEnvio | undefined,
    operacao: string,
  ): Promise<TransportResponse> {
    const endpoint = endpointDe(api);
    const url = `${endpoint.url.replace(/\/+$/, '')}${caminho}`;
    const started = options.clock.now().getTime();
    const res = await transport.send({
      url,
      method: corpo === undefined ? 'GET' : 'POST',
      headers:
        corpo === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      endpoint,
      ...(opcoes?.signal === undefined ? {} : { signal: opcoes.signal }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
    logger.debug('nfse.envio', { operacao, status: res.status, ms: options.clock.now().getTime() - started });
    return res;
  }

  function foraDoContrato(operacao: string, res: TransportResponse): ProtocolError {
    const json = lerJson(res.text());
    return new ProtocolError(`${operacao}: HTTP ${res.status} inesperado`, {
      details: {
        operacao,
        status: res.status,
        codigos: json === undefined ? [] : mensagens(json, 'erros').map((e) => e.codigo),
      },
    });
  }

  async function nfseDe(json: Record<string, unknown>, operacao: string): Promise<{ xml: string; nfse: TCNFSe }> {
    const xml = await gunzipBase64(exigirTexto(json, 'nfseXmlGZipB64', operacao), 'nfseXmlGZipB64');
    let decoded: ReturnType<typeof decodeXml<TCNFSe>>;
    try {
      decoded = decodeXml(NFSeElement, xml);
    } catch (cause) {
      throw new ProtocolError(`${operacao}: NFS-e não é XML bem formado`, { cause });
    }
    if (decoded.issues.some((i) => i.code === 'raiz_inesperada')) {
      throw new ProtocolError(`${operacao}: o documento devolvido não é uma NFS-e`);
    }
    return { xml, nfse: decoded.value };
  }

  async function emitirDps(
    dps: string,
    opcoes: OpcoesEnvio | undefined,
    operacao: string,
  ): Promise<NfseOutcome<NfseGerada>> {
    const lida = lerDps(dps);
    if (lida.tpAmb !== tpAmb) {
      throw new ConfigError(`DPS com tpAmb ${lida.tpAmb} num cliente de ${ambiente} (tpAmb ${tpAmb})`, {
        details: { tpAmb: lida.tpAmb, ambiente },
      });
    }
    if (operacao === 'substituir' && !lida.substituta) throw new ConfigError('DPS substituta sem o grupo subst');
    const res = await enviar('sefin', '/nfse', { dpsXmlGZipB64: await gzipBase64(dps) }, opcoes, operacao);
    const json = lerJson(res.text());
    if (res.status >= 400 && res.status < 500) return rejeicao(json, res.status, operacao);
    if ((res.status !== 200 && res.status !== 201) || json === undefined) throw foraDoContrato(operacao, res);
    const chaveAcesso = exigirTexto(json, 'chaveAcesso', operacao);
    const { xml, nfse } = await nfseDe(json, operacao);
    const inf = nfse.infNFSe;
    // A NFS-e tem de ser a desta DPS: chave igual à do Id e DPS embutida com o mesmo Id.
    if (inf?.Id !== `NFS${chaveAcesso}` || inf.DPS?.infDPS?.Id !== lida.id) {
      throw new ProtocolError(`${operacao}: a NFS-e devolvida não corresponde à DPS enviada`, {
        details: { operacao, chaveAcesso, idDps: lida.id },
      });
    }
    return geradaAutorizada(nfse, {
      chaveAcesso,
      idDps: lida.id,
      xml,
      alertas: mensagens(json, 'alertas'),
      dataHoraProcessamento: texto(json, 'dataHoraProcessamento'),
      versaoAplicativo: texto(json, 'versaoAplicativo'),
    });
  }

  async function registrar(pedido: string, opcoes: OpcoesEnvio | undefined): Promise<NfseOutcome<EventoRegistrado>> {
    let root: XmlElement;
    try {
      root = parseXml(pedido).root;
    } catch (cause) {
      throw new ConfigError('pedido de evento não é XML bem formado', { cause });
    }
    const inf = firstChild(root, 'infPedReg', NFSE_NS);
    const ch = inf && firstChild(inf, 'chNFSe', NFSE_NS);
    const amb = inf && firstChild(inf, 'tpAmb', NFSE_NS);
    if (root.local !== 'pedRegEvento' || ch === undefined || amb === undefined) {
      throw new ConfigError('o documento não é um pedido de registro de evento');
    }
    if (textOf(amb) !== tpAmb)
      throw new ConfigError(`pedido de evento com tpAmb ${textOf(amb)} num cliente de ${ambiente}`);
    if (!pedido.startsWith('<?xml')) throw new ConfigError('pedido de evento sem a declaração XML UTF-8');
    const chave = textOf(ch);
    conferirChave(chave);
    const body = { pedidoRegistroEventoXmlGZipB64: await gzipBase64(pedido) };
    const res = await enviar('sefin', `/nfse/${chave}/eventos`, body, opcoes, 'evento');
    const json = lerJson(res.text());
    if (res.status >= 400 && res.status < 500) return rejeicao(json, res.status, 'evento');
    if ((res.status !== 200 && res.status !== 201) || json === undefined) throw foraDoContrato('evento', res);
    const xml = await gunzipBase64(exigirTexto(json, 'eventoXmlGZipB64', 'evento'), 'eventoXmlGZipB64');
    const ev = lerEvento(xml, 'evento');
    if (ev.chaveAcesso !== chave) throw new ProtocolError('evento: o evento devolvido é de outra NFS-e');
    return authorized({ cStat: situacoes.evento.cStat, xMotivo: situacoes.evento.xMotivo }, ev);
  }

  function assinante(): Signer {
    if (options.signer === undefined)
      throw new ConfigError('cancelar e solicitarAnaliseFiscal precisam de options.signer');
    return options.signer;
  }

  const eventoOpts = {
    ambiente,
    clock: options.clock,
    ...(options.verAplic === undefined ? {} : { verAplic: options.verAplic }),
  };

  const parametros = createParametrosMunicipais({
    transport,
    endpoint: endpointDe('parametrizacao'),
    clock: options.clock,
    logger,
    ...(options.cacheParametros === undefined ? {} : { cache: options.cacheParametros }),
    ...(options.ttlParametrosMs === undefined ? {} : { ttlMs: options.ttlParametrosMs }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });

  return {
    ambiente,
    autorizar: (dps: string, opcoes?: OpcoesEnvio): Promise<NfseOutcome<NfseGerada>> =>
      emitirDps(dps, opcoes, 'autorizar'),
    substituir: (dps: string, opcoes?: OpcoesEnvio): Promise<NfseOutcome<NfseGerada>> =>
      emitirDps(dps, opcoes, 'substituir'),

    async consultar(chave: string, opcoes?: OpcoesEnvio): Promise<NfseConsultada | undefined> {
      conferirChave(chave);
      const res = await enviar('sefin', `/nfse/${chave}`, undefined, opcoes, 'consultar');
      if (res.status === 404) return undefined;
      const json = lerJson(res.text());
      if (res.status !== 200 || json === undefined) throw foraDoContrato('consultar', res);
      const { xml, nfse } = await nfseDe(json, 'consultar');
      if (nfse.infNFSe?.Id !== `NFS${chave}`) throw new ProtocolError('consultar: a NFS-e devolvida é de outra chave');
      return { chaveAcesso: chave, xml, nfse };
    },

    async consultarDps(
      idDps: string,
      opcoes?: OpcoesEnvio,
    ): Promise<{ readonly idDps: string; readonly chaveAcesso: string } | undefined> {
      if (!/^DPS\d{8}[0-9A-Z]{14}\d{20}$/.test(idDps)) throw new ConfigError(`Id de DPS inválido: ${idDps}`);
      const res = await enviar('sefin', `/dps/${idDps}`, undefined, opcoes, 'consultarDps');
      if (res.status === 404) return undefined;
      const json = lerJson(res.text());
      if (res.status !== 200 || json === undefined) throw foraDoContrato('consultarDps', res);
      const chaveAcesso = exigirTexto(json, 'chaveAcesso', 'consultarDps');
      conferirChave(chaveAcesso);
      return { idDps, chaveAcesso };
    },

    registrarEvento: registrar,

    async cancelar(pedido: CancelamentoPedido, opcoes?: OpcoesEnvio): Promise<NfseOutcome<EventoRegistrado>> {
      const r = buildPedidoCancelamento(pedido, eventoOpts);
      if (!r.ok) throw new ValidationError('pedido de cancelamento inválido', r.issues);
      return registrar(await signPedidoEvento(r.value, assinante()), opcoes);
    },

    async solicitarAnaliseFiscal(
      pedido: AnaliseFiscalPedido,
      opcoes?: OpcoesEnvio,
    ): Promise<NfseOutcome<EventoRegistrado>> {
      const r = buildPedidoAnaliseFiscal(pedido, eventoOpts);
      if (!r.ok) throw new ValidationError('pedido de análise fiscal inválido', r.issues);
      return registrar(await signPedidoEvento(r.value, assinante()), opcoes);
    },

    async consultarEventos(
      chave: string,
      filtro: FiltroEventos,
      opcoes?: OpcoesEnvio,
    ): Promise<readonly EventoRegistrado[]> {
      conferirChave(chave);
      const { tpEvento, nSeqEvento } = filtro ?? ({} as Partial<FiltroEventos>);
      if (tpEvento === undefined || nSeqEvento === undefined) {
        throw new ConfigError(
          'consultarEventos precisa de tpEvento e nSeqEvento: a Sefin responde 405 sem o tipo e 404 sem a sequência ' +
            '(GET /nfse/{chave}/eventos/{tipo}/{seq}, observado na produção restrita em 28/09/2026)',
        );
      }
      if (!/^\d{6}$/.test(tpEvento)) throw new ConfigError(`código de evento inválido: ${tpEvento}`);
      if (!Number.isSafeInteger(nSeqEvento) || nSeqEvento < 1) {
        throw new ConfigError(`nSeqEvento inválido: ${nSeqEvento}`);
      }
      const res = await enviar(
        'sefin',
        `/nfse/${chave}/eventos/${tpEvento}/${nSeqEvento}`,
        undefined,
        opcoes,
        'consultarEventos',
      );
      // 404 é "evento não registrado", com qualquer corpo. O caminho completo é o único que a Sefin atende, então o
      // 404 não vem de rota errada; e o corpo do 404 de evento inexistente não foi observado (o do caminho sem a
      // sequência é a página HTML do IIS). Ler o 404 como ausência só leva a `pendente` no emissor, nunca a um
      // cancelamento que não houve.
      if (res.status === 404) return [];
      const json = lerJson(res.text());
      if (res.status !== 200 || json === undefined) throw foraDoContrato('consultarEventos', res);
      const out: EventoRegistrado[] = [];
      for (const d of documentosDosEventos(json, 'consultarEventos')) {
        const xml = d.duplo
          ? await gunzipBase64Duplo(d.b64, 'arquivoXml')
          : await gunzipBase64(d.b64, 'eventoXmlGZipB64');
        const ev = lerEvento(xml, 'consultarEventos');
        if (ev.chaveAcesso !== chave) throw new ProtocolError('consultarEventos: o evento devolvido é de outra NFS-e');
        out.push(ev);
      }
      return out;
    },

    parametros,
  };
}

/** Desfecho de `resolverEnvioSemResposta`, com a mesma forma do resolvedor da NF-e e do MDF-e. */
export type ResolucaoEnvio =
  /** A DPS gerou NFS-e: `outcome` é o desfecho que a emissão teria devolvido, e `nfse` a leitura da consulta. */
  | {
      readonly acao: 'concluida';
      readonly chaveAcesso: string;
      readonly nfse: NfseConsultada;
      readonly outcome: Authorized<NfseGerada>;
    }
  /** A Sefin não tem NFS-e para esta DPS: reenvie `dpsAssinada`, exatamente os mesmos bytes. */
  | { readonly acao: 'reenviar'; readonly dpsAssinada: string }
  /**
   * Existe NFS-e para o Id desta DPS, mas de outro conteúdo: a DPS embutida nela tem outro DigestValue. Não reenvie:
   * recupere a NFS-e registrada (`nfse`) e descarte a DPS local.
   */
  | { readonly acao: 'divergente'; readonly chaveAcesso: string; readonly nfse: NfseConsultada };

/** DigestValue da assinatura de um elemento `DPS` (a própria raiz ou o primeiro descendente). */
function digestDaDps(xml: string): string | undefined {
  let root: XmlElement;
  try {
    root = parseXml(xml.replace(/^<\?xml[^?]*\?>/, '')).root;
  } catch {
    return undefined;
  }
  let dps: XmlElement | undefined;
  for (const d of descendants(root)) {
    if (d.local === 'DPS' && d.ns === NFSE_NS) {
      dps = d;
      break;
    }
  }
  const sig = dps && firstChild(dps, 'Signature', XMLDSIG_NS);
  if (sig === undefined) return undefined;
  for (const d of descendants(sig)) if (d.local === 'DigestValue' && d.ns === XMLDSIG_NS) return textOf(d).trim();
  return undefined;
}

/**
 * Depois de um envio sem resposta (timeout, conexão caída), descobre se a DPS gerou NFS-e: consulta pelo Id da DPS
 * e, achando a chave, lê a NFS-e. Nunca monte outra DPS para o mesmo número antes disso: a Sefin responderia E0014
 * (série e número já usados) ou geraria uma segunda nota se o número mudasse.
 */
export async function resolverEnvioSemResposta(client: NfseClient, dpsAssinada: string): Promise<ResolucaoEnvio> {
  const { id, tpAmb } = lerDps(dpsAssinada);
  // O Id da DPS não carrega o ambiente: série e número repetidos em produção e em homologação dariam outra NFS-e.
  if (tpAmb !== tpAmbOf(client.ambiente)) {
    throw new ConfigError(`DPS com tpAmb ${tpAmb} num cliente de ${client.ambiente}: consulte no ambiente da DPS`);
  }
  const dps = await client.consultarDps(id);
  if (dps === undefined) return { acao: 'reenviar', dpsAssinada };
  const nfse = await client.consultar(dps.chaveAcesso);
  if (nfse === undefined) throw new ProtocolError('a DPS consta como processada, mas a NFS-e não foi encontrada');
  if (nfse.nfse.infNFSe?.DPS?.infDPS?.Id !== id) {
    throw new ProtocolError('a NFS-e da consulta não corresponde à DPS', { details: { chaveAcesso: dps.chaveAcesso } });
  }
  // Mesmo Id não prova o mesmo conteúdo: série e número repetidos com outra DPS também caem aqui. Só um DigestValue
  // presente dos dois lados e diferente prova outra DPS; sem ele (a Sefin não devolver a assinatura), vale o Id.
  const nosso = digestDaDps(dpsAssinada);
  const registrado = digestDaDps(nfse.xml);
  if (nosso !== undefined && registrado !== undefined && nosso !== registrado) {
    return { acao: 'divergente', chaveAcesso: dps.chaveAcesso, nfse };
  }
  const outcome = geradaAutorizada(nfse.nfse, {
    chaveAcesso: dps.chaveAcesso,
    idDps: id,
    xml: nfse.xml,
    alertas: [],
    dataHoraProcessamento: undefined,
    versaoAplicativo: undefined,
  });
  return { acao: 'concluida', chaveAcesso: dps.chaveAcesso, nfse, outcome };
}
