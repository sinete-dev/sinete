/**
 * Serviços da NF-e 4.00 sobre o `@sinete/transport` e a assinatura do `@sinete/core/xml`: status, autorização síncrona e
 * assíncrona (recibo e consulta do recibo com política de espera), consulta protocolo, eventos (cancelamento,
 * cancelamento por substituição, CC-e, manifestação do destinatário no AN), inutilização, consulta cadastro e
 * Distribuição DF-e. Contingência SVC por dado: o autorizador SVC-AN ou SVC-RS de cada UF vem do `@sinete/transport`.
 *
 * Todo desfecho que chega a uma resposta da SEFAZ é um `SefazOutcome` do core (autorizado, rejeitado, denegado,
 * pendente), com a dica do `@sinete/rejeicoes` na rejeição. Os documentos processados (`nfeProc`, `procEventoNFe`,
 * `ProcInutNFe`) são montados por splice: o XML assinado entra byte a byte, o protocolo entra como fatia da resposta.
 *
 * Idempotência da autorização (MOC 7.0, Visão Geral; RV de duplicidade 204 e 539): grave o XML assinado antes de
 * enviar; se o envio ficar sem resposta (timeout, conexão caída), nunca gere outro `cNF` nem outro `dhEmi` para o mesmo
 * número. Consulte a chave (`resolverEnvioSemResposta`) e, se ela não constar, reenvie exatamente os mesmos bytes.
 */

import type { Ambiente, Clock, CUf, Logger, SefazOutcome, Signer, Uf } from '@sinete/core';
import {
  authorized,
  ConfigError,
  denied,
  noopLogger,
  ProtocolError,
  pending,
  tpAmbOf,
  ufByCUf,
  ufBySigla,
  ValidationError,
} from '@sinete/core';
import type { XmlDocument, XmlElement } from '@sinete/core/xml';
import { childElements, firstChild, parseXml, signXml, textOf } from '@sinete/core/xml';
import type { ComplexType, SchemaIssue } from '@sinete/schemas';
import { decode, decodeXml, serialize, serializeRoot, validate } from '@sinete/schemas';
import type { TRetConsCad_infCons_infCad } from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import { ConsCadElement, TRetConsCad } from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import { consSitNFeElement, TProtNFe, TRetConsSitNFe } from '@sinete/schemas/nfe/consulta-protocolo/PL_010d';
import type { distDFeInt, resEvento, resNFe } from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import {
  distDFeIntElement,
  resEventoElement,
  resNFeElement,
  retDistDFeInt,
} from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import { TEvento_infEvento as TEventoCanc, TRetEnvEvento } from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import type { TEvento_infEvento_detEvento as DetCancSubst } from '@sinete/schemas/nfe/evento-cancelamento-substituicao/PL_010d';
import { TEvento_infEvento as TEventoCancSubst } from '@sinete/schemas/nfe/evento-cancelamento-substituicao/PL_010d';
import type { TEvento_infEvento_detEvento as DetCce } from '@sinete/schemas/nfe/evento-cce/PL_010d';
import { TEvento_infEvento as TEventoCce } from '@sinete/schemas/nfe/evento-cce/PL_010d';
import { TEvento_infEvento as TEventoCiencia } from '@sinete/schemas/nfe/evento-ciencia-operacao/PL_010d';
import { TEvento_infEvento as TEventoConfirmacao } from '@sinete/schemas/nfe/evento-confirmacao-operacao/PL_010d';
import { TEvento_infEvento as TEventoDesconhecimento } from '@sinete/schemas/nfe/evento-desconhecimento-operacao/PL_010d';
import { TEvento_infEvento as TEventoNaoRealizada } from '@sinete/schemas/nfe/evento-operacao-nao-realizada/PL_010d';
import { TInutNFe_infInut, TRetInutNFe } from '@sinete/schemas/nfe/inutilizacao/PL_010d';
import { TRetConsReciNFe, TRetEnviNFe } from '@sinete/schemas/nfe/PL_010f';
import { consStatServElement, TRetConsStatServ } from '@sinete/schemas/nfe/status-servico/PL_009q';
import type { EndpointRef, NfeServico, Transport } from '@sinete/transport';
import { nfceEndpoint, nfeContingenciaDaUf, nfeEndpoint } from '@sinete/transport';
import type { ChaveAcesso } from '@sinete/validators';
import { parseChaveAcesso, parseCnpj, parseCpf } from '@sinete/validators';
import { formatDh, offsetDaUf } from '../time.ts';
import { gunzipBase64 } from './gzip.ts';
import { cstatEm, rejeitado } from './outcome.ts';
import type { DocumentoAssinado } from './proc.ts';
import { documentoAssinado, envelope, NFE_NS, sliceElement } from './proc.ts';
import type { RespostaSoap } from './soap.ts';
import { chamar } from './soap.ts';

// ---------------------------------------------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------------------------------------------

/** CNPJ ou CPF de quem assina um evento ou consulta a distribuição. */
export type AutorDocumento =
  | { readonly CNPJ: string; readonly CPF?: never }
  | { readonly CPF: string; readonly CNPJ?: never };

/** Espera injetável (testes passam uma que não dorme). */
export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface NfeClientOptions {
  readonly transport: Transport;
  /** Assina NF-e, eventos e inutilização (A1 WebCrypto, A3 via PKCS#11, HSM). */
  readonly signer: Signer;
  readonly ambiente: Ambiente;
  /**
   * UF dos serviços que não partem de um documento: status do serviço, inutilização, recibo consultado sem a NF-e,
   * `cUFAutor` padrão da distribuição e fuso da manifestação. Autorização, consulta, recibo com a NF-e e eventos da
   * própria nota vão ao autorizador da chave (cUF e tpEmis), seja qual for esta UF; sem ela, os serviços que precisam
   * dela lançam `ConfigError`.
   */
  readonly uf?: Uf;
  /** Relógio de emissão: `dhEvento`, número do lote. */
  readonly clock: Clock;
  readonly logger?: Logger;
  /** Prazo por requisição; padrão o do transporte. */
  readonly timeoutMs?: number;
  /** Fuso do emitente em minutos; padrão o da UF da chave nos eventos e o de `uf` na manifestação (`data/fusos.json`). */
  readonly offsetMinutes?: number;
  /**
   * `svc`: o status do serviço e o recibo consultado sem a NF-e vão ao SVC-AN ou SVC-RS de `uf`. Não vale para o que
   * parte de um documento: a NF-e assinada em SVC (tpEmis 6 ou 7, na chave) vai ao SVC que a chave diz, e a assinada
   * fora dele vai à UF, com ou sem esta opção.
   */
  readonly contingencia?: 'svc';
  /** CNPJ ou CPF do titular do certificado: autor da manifestação, interessado da distribuição, emitente da inutilização. */
  readonly autor?: AutorDocumento;
  readonly sleep?: Sleep;
  /**
   * Sobrepõe o endpoint da NFC-e (modelo 65) por serviço e UF. Sem ela, vale a tabela da NFC-e do `@sinete/transport`
   * (`nfceEndpoint`), que em várias UFs (SP, MG, PR, RS, SVRS) é outro host que o da NF-e. A NFC-e não tem SVC: com
   * `contingencia: 'svc'`, o documento modelo 65 continua indo ao autorizador normal da NFC-e.
   */
  readonly nfceEndpoint?: (servico: NfeServico, uf: Uf) => EndpointRef;
  /** Gerador de `idLote` (até 15 dígitos); padrão: os milissegundos do relógio. */
  readonly idLote?: () => string;
}

/** Opções de toda chamada que vai à rede. */
export interface OpcoesEnvio {
  /** Cancela a requisição em curso. */
  readonly signal?: AbortSignal;
}

/** Opções da consulta de um recibo. */
export interface ConsultaReciboOpcoes extends OpcoesEnvio {
  /**
   * Modelo do lote, para escolher o serviço (NFC-e vai pelo `nfceEndpoint`). Com a NF-e assinada o modelo vem da
   * chave e este campo, se vier, tem de bater; sem ela, é obrigatório para NFC-e e o padrão é 55.
   */
  readonly mod?: '55' | '65';
}

/** Política de consulta do recibo (autorização assíncrona). */
export interface PoliticaRecibo extends ConsultaReciboOpcoes {
  /** Consultas no máximo. Padrão 10. */
  readonly maxTentativas?: number;
  /** Espera antes da primeira consulta e mínima entre consultas. Padrão 2 000 ms (o MOC pede aguardar o tMed). */
  readonly esperaMinimaMs?: number;
  /** Fator de crescimento da espera. Padrão 1,5. */
  readonly multiplicador?: number;
  /** Teto da espera. Padrão 30 000 ms. */
  readonly esperaMaximaMs?: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Valores dos desfechos
// ---------------------------------------------------------------------------------------------------------------

/** Status do serviço (cStat 107). */
export interface StatusServico {
  readonly cUF: string;
  readonly verAplic: string;
  readonly dhRecbto: string;
  /** Tempo médio de resposta, em segundos. */
  readonly tMed?: string;
  readonly dhRetorno?: string;
  readonly xObs?: string;
}

/** Protocolo de uma NF-e (autorização ou denegação). */
export interface ProtocoloNfe {
  readonly chNFe: string;
  readonly cStat: string;
  readonly xMotivo: string;
  readonly nProt?: string;
  readonly dhRecbto: string;
  readonly digVal?: string;
  readonly verAplic: string;
  /** `protNFe` como veio na resposta (fatia do texto). */
  readonly protNFe: string;
  /**
   * `nfeProc` com a NF-e assinada byte a byte e o `protNFe`; presente quando a NF-e assinada é conhecida e o `digVal`
   * do protocolo confere com o DigestValue dela.
   */
  readonly nfeProc?: string;
}

/** Desfecho da autorização: autorizada, denegada (número consumido), rejeitada ou pendente (recibo em `ref`). */
export type AutorizacaoOutcome = SefazOutcome<ProtocoloNfe, ProtocoloNfe>;

/** Situação da NF-e na consulta protocolo. */
export interface ConsultaNfe {
  readonly chNFe: string;
  readonly situacao: 'autorizada' | 'cancelada' | 'denegada';
  readonly protocolo?: ProtocoloNfe;
  /** `procEventoNFe` devolvidos, como fatias da resposta. */
  readonly eventos: readonly string[];
  /** Com a NF-e assinada dada: o `digVal` do protocolo é o DigestValue dela. */
  readonly digValConfere?: boolean;
}

export type ConsultaOutcome = SefazOutcome<ConsultaNfe, ConsultaNfe>;

/** Evento registrado (cStat 135, 136 ou 155). */
export interface EventoRegistrado {
  readonly chNFe: string;
  readonly tpEvento: string;
  readonly nSeqEvento: string;
  readonly nProt?: string;
  readonly dhRegEvento: string;
  /** `retEvento` como veio na resposta. */
  readonly retEvento: string;
  /** Evento assinado + `retEvento`. */
  readonly procEventoNFe: string;
}

export type EventoOutcome = SefazOutcome<EventoRegistrado, never>;

/** Inutilização homologada (cStat 102). */
export interface Inutilizacao {
  readonly nProt?: string;
  readonly dhRecbto: string;
  readonly retInutNFe: string;
  readonly procInutNFe: string;
}

export type InutilizacaoOutcome = SefazOutcome<Inutilizacao, never>;

export interface Cadastro {
  readonly UF: string;
  readonly dhCons: string;
  readonly infCad: readonly TRetConsCad_infCons_infCad[];
}

/** Documento devolvido pela Distribuição DF-e, já descompactado. */
export interface DocumentoDistribuido {
  readonly NSU: string;
  /** Schema que o AN informa (`resNFe_v1.01.xsd`, `procNFe_v4.00.xsd`...). */
  readonly schema: string;
  readonly tipo: 'resNFe' | 'resEvento' | 'procNFe' | 'procEventoNFe' | 'outro';
  /** XML como veio dentro do gzip. Guarde este texto; não reserialize. */
  readonly xml: string;
  readonly resNFe?: resNFe;
  readonly resEvento?: resEvento;
}

export interface Distribuicao {
  readonly ultNSU: string;
  readonly maxNSU: string;
  readonly dhResp: string;
  readonly documentos: readonly DocumentoDistribuido[];
}

export type ManifestacaoTipo = 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao-realizada';

export interface AutorizarOpcoes extends OpcoesEnvio {
  /** `indSinc` 1 (padrão) ou 0 (lote assíncrono com recibo). */
  readonly sincrono?: boolean;
}

/** Opções do status do serviço. */
export interface StatusServicoOpcoes extends OpcoesEnvio {
  /** `65` consulta o autorizador da NFC-e. Padrão 55. */
  readonly mod?: '55' | '65';
}

export interface CancelamentoPedido {
  readonly chave: string;
  readonly nProt: string;
  readonly xJust: string;
  /** Padrão: o CNPJ ou CPF do emitente na chave. */
  readonly autor?: AutorDocumento;
}

export interface CancelamentoSubstituicaoPedido {
  readonly chave: string;
  readonly nProt: string;
  readonly xJust: string;
  /** Chave da NFC-e que substitui a cancelada. */
  readonly chNFeRef: string;
  readonly cOrgaoAutor: string;
  readonly tpAutor?: '1';
  readonly verAplic: string;
  readonly autor?: AutorDocumento;
}

export interface CartaCorrecaoPedido {
  readonly chave: string;
  readonly xCorrecao: string;
  /** 1 a 20; cada CC-e nova substitui a anterior e leva o sequencial seguinte. */
  readonly nSeqEvento: number;
  readonly autor?: AutorDocumento;
}

export interface ManifestacaoPedido {
  readonly chave: string;
  readonly tipo: ManifestacaoTipo;
  /** Obrigatória na operação não realizada (15 a 255 caracteres). */
  readonly xJust?: string;
  readonly autor?: AutorDocumento;
}

export interface InutilizacaoPedido {
  /** Ano com 2 ou 4 dígitos. */
  readonly ano: number | string;
  readonly serie: number | string;
  readonly nNFIni: number | string;
  readonly nNFFin: number | string;
  readonly xJust: string;
  readonly mod?: '55' | '65';
  readonly autor?: AutorDocumento;
}

export type CadastroPedido = { readonly uf: Uf } & (
  | { readonly CNPJ: string }
  | { readonly CPF: string }
  | { readonly IE: string }
);

export type DistribuicaoConsulta =
  | { readonly ultNSU: string | number }
  | { readonly NSU: string | number }
  | { readonly chNFe: string };

export interface DistribuicaoOpcoes extends OpcoesEnvio {
  /** UF do interessado; padrão a UF do cliente. */
  readonly cUFAutor?: string;
  readonly autor?: AutorDocumento;
}

export interface NfeClient {
  readonly options: NfeClientOptions;
  /**
   * Status do serviço de autorização na UF das opções (MOC 7.0, tabela 4.4.1: 107 em operação, 108 e 109 paralisado).
   * Com `mod: '65'`, o do autorizador da NFC-e, que em várias UFs é outro host.
   */
  statusServico(opcoes?: StatusServicoOpcoes): Promise<SefazOutcome<StatusServico, never>>;
  /** Envia uma NF-e assinada (a string devolvida pela assinatura, sem outra alteração). Padrão síncrono. */
  autorizar(nfeAssinada: string, opcoes?: AutorizarOpcoes): Promise<AutorizacaoOutcome>;
  /** Consulta o recibo de um lote assíncrono; com a NF-e assinada, monta o `nfeProc`. */
  consultarRecibo(nRec: string, nfeAssinada?: string, opcoes?: ConsultaReciboOpcoes): Promise<AutorizacaoOutcome>;
  /** Consulta o recibo até sair de pendente ou esgotar a política. */
  aguardarRecibo(nRec: string, nfeAssinada?: string, politica?: PoliticaRecibo): Promise<AutorizacaoOutcome>;
  consultar(chave: string, nfeAssinada?: string, opcoes?: OpcoesEnvio): Promise<ConsultaOutcome>;
  cancelar(p: CancelamentoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
  /** Cancelamento por substituição (110112): só NFC-e (modelo 65). */
  cancelarPorSubstituicao(p: CancelamentoSubstituicaoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
  cartaCorrecao(p: CartaCorrecaoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
  /** Manifestação do destinatário, registrada no Ambiente Nacional (cOrgao 91). */
  manifestar(p: ManifestacaoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome>;
  inutilizar(p: InutilizacaoPedido, opcoes?: OpcoesEnvio): Promise<InutilizacaoOutcome>;
  consultarCadastro(p: CadastroPedido, opcoes?: OpcoesEnvio): Promise<SefazOutcome<Cadastro, never>>;
  distribuicaoDFe(
    consulta: DistribuicaoConsulta,
    opcoes?: DistribuicaoOpcoes,
  ): Promise<SefazOutcome<Distribuicao, never>>;
}

// ---------------------------------------------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------------------------------------------

/** Autorizador SVC da UF e o `tpEmis` que a NF-e emitida nele leva (6 SVC-AN, 7 SVC-RS; MOC 7.0, B22). */
export function autorizadorContingencia(
  uf: Uf,
  ambiente: Ambiente,
): { readonly autorizador: 'SVC-AN' | 'SVC-RS'; readonly tpEmis: '6' | '7' } {
  const autorizador = nfeContingenciaDaUf(uf, ambiente);
  return { autorizador, tpEmis: autorizador === 'SVC-AN' ? '6' : '7' };
}

const defaultSleep: Sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    // O listener sai também quando o prazo vence: um signal longo reaproveitado entre esperas não acumula listeners.
    const onAbort = (): void => {
      clearTimeout(t);
      reject(signal?.reason);
    };
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

function chaveValida(chave: string, path: string): ChaveAcesso {
  const r = parseChaveAcesso(chave, { path });
  if (!r.ok) throw new ValidationError(`chave de acesso inválida: ${r.error.message}`, [r.error]);
  return r.value;
}

function schemaIssues(what: string, issues: readonly SchemaIssue[]): void {
  if (issues.length > 0) throw new ValidationError(`${what} não confere com o schema`, issues);
}

function documentoAutor(a: AutorDocumento, path: string): { CNPJ: string } | { CPF: string } {
  if (a.CNPJ !== undefined) {
    const r = parseCnpj(a.CNPJ, { path: `${path}.CNPJ` });
    if (!r.ok) throw new ValidationError('CNPJ do autor inválido', [r.error]);
    return { CNPJ: r.value };
  }
  const r = parseCpf(a.CPF ?? '', { path: `${path}.CPF` });
  if (!r.ok) throw new ValidationError('CPF do autor inválido', [r.error]);
  return { CPF: r.value };
}

function autorDaChave(c: ChaveAcesso): { CNPJ: string } | { CPF: string } {
  // parseChaveAcesso já exigiu CNPJ ou "000" + CPF válido nas 14 posições do emitente.
  return c.cnpj !== undefined ? { CNPJ: c.cnpj } : { CPF: c.cpf ?? c.emitente.slice(3) };
}

/**
 * Autor de um evento do emitente (cancelamento, cancelamento por substituição, CC-e): o informado tem de ser o CNPJ ou
 * o CPF do emitente na chave, senão a SEFAZ rejeita com 574 (MOC 7.0 Visão Geral, RV P12-44); sem autor, é o da chave.
 */
function autorDoEmitente(a: AutorDocumento | undefined, c: ChaveAcesso): { CNPJ: string } | { CPF: string } {
  const daChave = autorDaChave(c);
  if (a === undefined) return daChave;
  const autor = documentoAutor(a, 'autor');
  const [campo, valor] = 'CNPJ' in autor ? ['CNPJ', autor.CNPJ] : ['CPF', autor.CPF];
  if (valor !== ('CNPJ' in daChave ? daChave.CNPJ : daChave.CPF) || campo !== ('CNPJ' in daChave ? 'CNPJ' : 'CPF')) {
    throw new ValidationError('o autor do evento não é o emitente da NF-e', [
      {
        path: `autor.${campo}`,
        code: 'autor_difere_do_emitente',
        message: `o autor de um evento do emitente é o ${'CNPJ' in daChave ? 'CNPJ' : 'CPF'} da chave (P12-44, rejeição 574)`,
        origem: 'entrada',
      },
    ]);
  }
  return autor;
}

/**
 * Autorizador SVC pelo tpEmis da chave (MOC 7.0, B22: 6 SVC-AN, 7 SVC-RS). A nota assinada em contingência é
 * autorizada, consultada e cancelada no SVC que a autorizou, seja qual for a contingência de agora (NT 2013.007).
 */
const SVC_DO_TPEMIS: Readonly<Record<string, 'SVC-AN' | 'SVC-RS'>> = { '6': 'SVC-AN', '7': 'SVC-RS' };

/** Chave do documento assinado, lida para rotear: o emitente é conferido pela SEFAZ, não aqui. */
function chaveDoDocumento(a: DocumentoAssinado): ChaveAcesso {
  const r = parseChaveAcesso(a.id.slice(3), { path: 'infNFe.Id', checkEmitente: false });
  if (!r.ok) throw new ConfigError(`Id da NF-e assinada não é uma chave de acesso: ${r.error.message}`);
  return r.value;
}

/** Fatia autossuficiente (com o `xmlns` do elemento), para devolver ao chamador fora de um envelope. */
function avulso(doc: XmlDocument, el: XmlElement): string {
  return sliceElement(doc, el, '');
}

/** Protocolo lido e a fatia sem `xmlns` redundante, para entrar no `nfeProc`. */
interface ProtocoloLido {
  readonly p: Omit<ProtocoloNfe, 'nfeProc'>;
  readonly embutido: string;
}

/** Monta o protocolo a partir do `protNFe` da resposta. */
function lerProtocolo(doc: XmlDocument, el: XmlElement): ProtocoloLido {
  const { value } = decode(TProtNFe, el, doc.source);
  const inf = value.infProt;
  if (!inf) throw new ProtocolError('protNFe sem infProt');
  const p = {
    chNFe: inf.chNFe,
    cStat: inf.cStat,
    xMotivo: inf.xMotivo,
    dhRecbto: inf.dhRecbto,
    verAplic: inf.verAplic,
    protNFe: avulso(doc, el),
    ...(inf.nProt === undefined ? {} : { nProt: inf.nProt }),
    ...(inf.digVal === undefined ? {} : { digVal: inf.digVal }),
  };
  return { p, embutido: sliceElement(doc, el) };
}

/**
 * Protocolo de uma NF-e que este cliente enviou: o `digVal` tem de ser o DigestValue da nota assinada, senão o
 * protocolo é de outro conteúdo e nenhum `nfeProc` é montado (`ProtocolError`). Sem `digVal` não há como provar que o
 * protocolo é deste conteúdo: o desfecho volta sem `nfeProc` (confirme com `consultar`).
 */
function desfechoDoProtocolo({ p, embutido }: ProtocoloLido, a: DocumentoAssinado | undefined): AutorizacaoOutcome {
  const status = { cStat: p.cStat, xMotivo: p.xMotivo };
  const autorizada = cstatEm(p.cStat, 'autorizada');
  const denegada = cstatEm(p.cStat, 'denegada');
  if (!autorizada && !denegada) return rejeitado(status);
  let full: ProtocoloNfe = p;
  if (a) {
    if (`NFe${p.chNFe}` !== a.id) {
      throw new ProtocolError('protocolo de outra chave de acesso', { details: { chNFe: p.chNFe } });
    }
    if (p.digVal !== undefined && p.digVal !== a.digestValue) {
      throw new ProtocolError('digVal do protocolo difere do DigestValue da NF-e enviada', {
        details: { chNFe: p.chNFe, cStat: p.cStat },
      });
    }
    if (p.digVal !== undefined) full = { ...p, nfeProc: envelope('nfeProc', '4.00', [a.xml, embutido]) };
  }
  return autorizada ? authorized(status, full) : denied(status, full);
}

function protNFeDaChave(parent: XmlElement, a: DocumentoAssinado | undefined): XmlElement | undefined {
  const prots = childElements(parent).filter((e) => e.local === 'protNFe' && e.ns === NFE_NS);
  if (!a) return prots[0];
  const chave = a.id.slice(3);
  return (
    prots.find((e) => {
      const inf = firstChild(e, 'infProt', NFE_NS);
      const ch = inf && firstChild(inf, 'chNFe', NFE_NS);
      return ch !== undefined && textOf(ch).trim() === chave;
    }) ?? (prots.length === 1 ? prots[0] : undefined)
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------------------------------------------

const EVENTO_VERSAO = '1.00';
/** Texto fixo das condições de uso da CC-e (schema e110110, primeira forma do enum). */
const XCONDUSO: DetCce['xCondUso'] =
  'A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido na emissão de documento fiscal, desde que o erro não esteja relacionado com: I - as variáveis que determinam o valor do imposto tais como: base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação; II - a correção de dados cadastrais que implique mudança do remetente ou do destinatário; III - a data de emissão ou de saída.';

/** Manifestação do destinatário (NT 2012.002): tipo de evento, descrição e schema do `detEvento`. */
const MANIFESTACOES: Readonly<
  Record<ManifestacaoTipo, { readonly tpEvento: string; readonly descEvento: string; readonly ct: ComplexType }>
> = {
  confirmacao: { tpEvento: '210200', descEvento: 'Confirmacao da Operacao', ct: TEventoConfirmacao },
  ciencia: { tpEvento: '210210', descEvento: 'Ciencia da Operacao', ct: TEventoCiencia },
  desconhecimento: { tpEvento: '210220', descEvento: 'Desconhecimento da Operacao', ct: TEventoDesconhecimento },
  'nao-realizada': { tpEvento: '210240', descEvento: 'Operacao nao Realizada', ct: TEventoNaoRealizada },
};

interface EventoPedido {
  readonly ct: ComplexType;
  readonly tpEvento: string;
  readonly chave: string;
  readonly nSeqEvento: number;
  readonly cOrgao: string;
  readonly autor: { CNPJ: string } | { CPF: string };
  readonly detEvento: Readonly<Record<string, unknown>>;
  readonly endpoint: EndpointRef;
  /** Fuso do `dhEvento`. */
  readonly offsetMinutes: number;
  readonly signal: AbortSignal | undefined;
}

/** Cria o cliente dos serviços da NF-e. */
export function createNfeClient(options: NfeClientOptions): NfeClient {
  const logger = (options.logger ?? noopLogger).child({ modulo: 'nfe', ambiente: options.ambiente });
  const sleep = options.sleep ?? defaultSleep;
  const tpAmb = tpAmbOf(options.ambiente);
  const ufInfo = options.uf === undefined ? undefined : ufBySigla(options.uf);
  if (options.uf !== undefined && !ufInfo) throw new ConfigError(`UF inválida: ${String(options.uf)}`);
  /** UF dos serviços sem documento; sem `options.uf`, `ConfigError` nomeando o serviço. */
  const ufPadrao = (servico: string): { readonly uf: Uf; readonly cUF: CUf } => {
    if (options.uf === undefined || ufInfo === undefined) {
      throw new ConfigError(`${servico} precisa da UF: informe NfeClientOptions.uf`);
    }
    return { uf: options.uf, cUF: ufInfo.cUF };
  };
  /** Fuso de um evento pela UF de quem o registra. */
  const offsetDe = (uf: Uf): number => options.offsetMinutes ?? offsetDaUf(uf);

  const idLote = (): string => {
    const id = options.idLote ? options.idLote() : String(options.clock.now().getTime()).slice(-15);
    if (!/^[0-9]{1,15}$/.test(id)) throw new ConfigError(`idLote inválido: ${id}`);
    return id;
  };

  /** Endpoint da NFC-e: a opção `nfceEndpoint` ou a tabela da NFC-e do transporte, sempre no autorizador normal. */
  const endpointNfce = (servico: NfeServico, uf: Uf): EndpointRef =>
    options.nfceEndpoint
      ? options.nfceEndpoint(servico, uf)
      : nfceEndpoint({ ambiente: options.ambiente, servico, uf });

  /**
   * Endpoint de um serviço sem documento, pela UF das opções: NF-e com SVC quando `contingencia` pede; NFC-e no
   * autorizador normal.
   */
  const endpoint = (servico: NfeServico, mod = '55'): EndpointRef => {
    const { uf } = ufPadrao(servico);
    if (mod === '65') return endpointNfce(servico, uf);
    return nfeEndpoint({
      ambiente: options.ambiente,
      servico,
      uf,
      ...(options.contingencia === undefined ? {} : { contingencia: options.contingencia }),
    });
  };

  /**
   * Endpoint de um serviço sobre um documento, pelo autorizador da chave: a UF do cUF e, no tpEmis 6 ou 7, o SVC que
   * autorizou a nota. `naUf` força o autorizador da UF (a CC-e não existe no SVC). A NFC-e vai sempre ao autorizador
   * normal da NFC-e.
   */
  const endpointDaChave = (servico: NfeServico, c: ChaveAcesso, naUf = false): EndpointRef => {
    if (c.mod === '65') return endpointNfce(servico, c.uf);
    const svc = naUf || c.tpEmis === undefined ? undefined : SVC_DO_TPEMIS[c.tpEmis];
    return nfeEndpoint({
      ambiente: options.ambiente,
      servico,
      ...(svc === undefined ? { uf: c.uf } : { autorizador: svc }),
    });
  };

  const call = (
    ep: EndpointRef,
    servico: NfeServico,
    mensagem: string,
    retorno: string,
    signal?: AbortSignal,
  ): Promise<RespostaSoap> =>
    chamar({
      transport: options.transport,
      endpoint: ep,
      servico,
      mensagem,
      retorno,
      logger,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(signal === undefined ? {} : { signal }),
    });

  const autorPadrao = (a: AutorDocumento | undefined, path: string): { CNPJ: string } | { CPF: string } => {
    const autor = a ?? options.autor;
    if (!autor) throw new ConfigError(`informe o CNPJ ou CPF do autor (${path} ou NfeClientOptions.autor)`);
    return documentoAutor(autor, path);
  };

  async function consultarRecibo(
    nRec: string,
    nfeAssinada?: string,
    opcoes: ConsultaReciboOpcoes = {},
  ): Promise<AutorizacaoOutcome> {
    if (!/^[0-9]{15}$/.test(nRec)) throw new ConfigError(`número de recibo inválido: ${nRec}`);
    const a = nfeAssinada === undefined ? undefined : documentoAssinado(nfeAssinada, 'NFe', 'infNFe');
    const c = a === undefined ? undefined : chaveDoDocumento(a);
    if (c !== undefined && opcoes.mod !== undefined && opcoes.mod !== c.mod) {
      throw new ConfigError(`mod ${opcoes.mod} não é o da NF-e assinada (${c.mod})`);
    }
    const msg = envelope('consReciNFe', '4.00', [`<tpAmb>${tpAmb}</tpAmb><nRec>${nRec}</nRec>`]);
    // O recibo é do autorizador que recebeu o lote: com a NF-e, o da chave; sem ela, o das opções.
    const ep =
      c === undefined ? endpoint('NFeRetAutorizacao', opcoes.mod ?? '55') : endpointDaChave('NFeRetAutorizacao', c);
    const r = await call(ep, 'NFeRetAutorizacao', msg, 'retConsReciNFe', opcoes.signal);
    const v = decode(TRetConsReciNFe, r.ret, r.doc.source).value;
    if (v.nRec !== undefined && v.nRec !== nRec) {
      throw new ProtocolError('retorno de outro recibo', { details: { nRec: v.nRec } });
    }
    const status = { cStat: v.cStat, xMotivo: v.xMotivo };
    logger.info('nfe.recibo', { nRec, cStat: v.cStat });
    if (cstatEm(v.cStat, 'loteEmProcessamento') || cstatEm(v.cStat, 'loteRecebido'))
      return pending(status, { ref: nRec });
    if (cstatEm(v.cStat, 'loteProcessado')) {
      const el = protNFeDaChave(r.ret, a);
      if (!el) throw new ProtocolError('lote processado sem o protNFe da NF-e', { details: { nRec } });
      return desfechoDoProtocolo(lerProtocolo(r.doc, el), a);
    }
    return rejeitado(status);
  }

  async function consultar(chave: string, nfeAssinada?: string, opcoes?: OpcoesEnvio): Promise<ConsultaOutcome> {
    const c = chaveValida(chave, 'chNFe');
    const a = nfeAssinada === undefined ? undefined : documentoAssinado(nfeAssinada, 'NFe', 'infNFe');
    if (a && a.id !== `NFe${c.chave}`) throw new ConfigError('a NF-e assinada não é a da chave consultada');
    const msg = serializeRoot(consSitNFeElement, { versao: '4.00', tpAmb, xServ: 'CONSULTAR', chNFe: c.chave });
    const ep = endpointDaChave('NfeConsultaProtocolo', c);
    const r = await call(ep, 'NfeConsultaProtocolo', msg, 'retConsSitNFe', opcoes?.signal);
    const v = decode(TRetConsSitNFe, r.ret, r.doc.source).value;
    const status = { cStat: v.cStat, xMotivo: v.xMotivo };
    logger.info('nfe.consulta', { chNFe: c.chave, cStat: v.cStat });
    const situacao = cstatEm(v.cStat, 'autorizada')
      ? 'autorizada'
      : cstatEm(v.cStat, 'cancelada')
        ? 'cancelada'
        : cstatEm(v.cStat, 'denegada')
          ? 'denegada'
          : undefined;
    if (situacao === undefined) return rejeitado(status);
    const protEl = firstChild(r.ret, 'protNFe', NFE_NS);
    const eventos = childElements(r.ret)
      .filter((e) => e.local === 'procEventoNFe' && e.ns === NFE_NS)
      .map((e) => avulso(r.doc, e));
    let protocolo: ProtocoloNfe | undefined;
    let digValConfere: boolean | undefined;
    if (protEl) {
      const { p, embutido } = lerProtocolo(r.doc, protEl);
      if (p.chNFe !== c.chave) {
        throw new ProtocolError('protocolo de outra chave de acesso na consulta', { details: { chNFe: p.chNFe } });
      }
      protocolo = p;
      if (a) {
        digValConfere = p.digVal !== undefined && p.digVal === a.digestValue;
        if (digValConfere) protocolo = { ...p, nfeProc: envelope('nfeProc', '4.00', [a.xml, embutido]) };
      }
    }
    const value: ConsultaNfe = {
      chNFe: c.chave,
      situacao,
      eventos,
      ...(protocolo === undefined ? {} : { protocolo }),
      ...(digValConfere === undefined ? {} : { digValConfere }),
    };
    return situacao === 'denegada' ? denied(status, value) : authorized(status, value);
  }

  async function enviarEvento(p: EventoPedido): Promise<EventoOutcome> {
    const nSeq = p.nSeqEvento;
    if (!Number.isInteger(nSeq) || nSeq < 1 || nSeq > 99) throw new ConfigError(`nSeqEvento inválido: ${nSeq}`);
    const nSeqEvento = String(nSeq);
    // Id = "ID" + tpEvento + chave + nSeqEvento com 2 dígitos (leiaute do evento, atributo Id de infEvento).
    const id = `ID${p.tpEvento}${p.chave}${nSeqEvento.padStart(2, '0')}`;
    const inf = {
      Id: id,
      cOrgao: p.cOrgao,
      tpAmb,
      ...p.autor,
      chNFe: p.chave,
      dhEvento: formatDh(options.clock.now(), p.offsetMinutes),
      tpEvento: p.tpEvento,
      nSeqEvento,
      verEvento: EVENTO_VERSAO,
      detEvento: p.detEvento,
    };
    const infXml = serialize(p.ct, 'infEvento', inf, NFE_NS);
    const evento = `<evento xmlns="${NFE_NS}" versao="${EVENTO_VERSAO}">${infXml}</evento>`;
    const infEl = firstChild(parseXml(evento).root, 'infEvento', NFE_NS) as XmlElement;
    schemaIssues('evento', validate(p.ct, infEl));
    const assinado = await signXml(evento, { id }, options.signer);
    const msg = envelope('envEvento', EVENTO_VERSAO, [`<idLote>${idLote()}</idLote>`, assinado]);
    const r = await call(p.endpoint, 'RecepcaoEvento', msg, 'retEnvEvento', p.signal);
    const v = decode(TRetEnvEvento, r.ret, r.doc.source).value;
    logger.info('nfe.evento', { chNFe: p.chave, tpEvento: p.tpEvento, cStat: v.cStat });
    if (!cstatEm(v.cStat, 'loteEventoProcessado')) return rejeitado({ cStat: v.cStat, xMotivo: v.xMotivo });
    const retEl = childElements(r.ret).find((e) => e.local === 'retEvento' && e.ns === NFE_NS);
    const ret = v.retEvento?.[0]?.infEvento;
    if (!retEl || !ret) throw new ProtocolError('lote de evento processado sem retEvento');
    // O retorno tem de ser deste evento: chave, tipo e sequência, quando vierem, iguais aos enviados.
    const divergentes = (
      [
        ['chNFe', ret.chNFe, p.chave],
        ['tpEvento', ret.tpEvento, p.tpEvento],
        ['nSeqEvento', ret.nSeqEvento === undefined ? undefined : String(Number(ret.nSeqEvento)), nSeqEvento],
      ] as const
    ).filter(([, veio, enviado]) => veio !== undefined && veio !== enviado);
    if (divergentes.length > 0) {
      throw new ProtocolError('retEvento de outro evento', {
        details: Object.fromEntries(divergentes.map(([k, veio]) => [k, veio])),
      });
    }
    const status = { cStat: ret.cStat, xMotivo: ret.xMotivo };
    if (!cstatEm(ret.cStat, 'eventoRegistrado')) return rejeitado(status);
    return authorized(status, {
      chNFe: p.chave,
      tpEvento: p.tpEvento,
      nSeqEvento,
      dhRegEvento: ret.dhRegEvento,
      retEvento: avulso(r.doc, retEl),
      procEventoNFe: envelope('procEventoNFe', EVENTO_VERSAO, [assinado, sliceElement(r.doc, retEl)]),
      ...(ret.nProt === undefined ? {} : { nProt: ret.nProt }),
    });
  }

  const client: NfeClient = {
    options,

    async statusServico(opcoes?: StatusServicoOpcoes): Promise<SefazOutcome<StatusServico, never>> {
      const { cUF } = ufPadrao('NfeStatusServico');
      const msg = serializeRoot(consStatServElement, { versao: '4.00', tpAmb, cUF, xServ: 'STATUS' });
      const r = await call(
        endpoint('NfeStatusServico', opcoes?.mod),
        'NfeStatusServico',
        msg,
        'retConsStatServ',
        opcoes?.signal,
      );
      const v = decode(TRetConsStatServ, r.ret, r.doc.source).value;
      const status = { cStat: v.cStat, xMotivo: v.xMotivo };
      logger.info('nfe.status', { cStat: v.cStat });
      if (!cstatEm(v.cStat, 'servicoEmOperacao')) return rejeitado(status);
      return authorized(status, {
        cUF: v.cUF,
        verAplic: v.verAplic,
        dhRecbto: v.dhRecbto,
        ...(v.tMed === undefined ? {} : { tMed: v.tMed }),
        ...(v.dhRetorno === undefined ? {} : { dhRetorno: v.dhRetorno }),
        ...(v.xObs === undefined ? {} : { xObs: v.xObs }),
      });
    },

    async autorizar(nfeAssinada: string, opcoes: AutorizarOpcoes = {}): Promise<AutorizacaoOutcome> {
      const a = documentoAssinado(nfeAssinada, 'NFe', 'infNFe');
      const sincrono = opcoes.sincrono ?? true;
      const msg = envelope('enviNFe', '4.00', [
        `<idLote>${idLote()}</idLote><indSinc>${sincrono ? '1' : '0'}</indSinc>`,
        a.xml,
      ]);
      // O autorizador é o do documento: a UF do cUF e, assinada em SVC (tpEmis 6 ou 7), o SVC da chave.
      const ep = endpointDaChave('NFeAutorizacao', chaveDoDocumento(a));
      const r = await call(ep, 'NFeAutorizacao', msg, 'retEnviNFe', opcoes.signal);
      const v = decode(TRetEnviNFe, r.ret, r.doc.source).value;
      const status = { cStat: v.cStat, xMotivo: v.xMotivo };
      logger.info('nfe.autorizacao', { chNFe: a.id.slice(3), cStat: v.cStat, sincrono });
      if (cstatEm(v.cStat, 'loteRecebido')) {
        const nRec = v.infRec?.nRec;
        if (!nRec) throw new ProtocolError('lote recebido sem número de recibo');
        const tMed = Number(v.infRec?.tMed ?? '0');
        return pending(status, { ref: nRec, retryAfterMs: Math.max(1, tMed) * 1000 });
      }
      const protEl = protNFeDaChave(r.ret, a);
      if (protEl) return desfechoDoProtocolo(lerProtocolo(r.doc, protEl), a);
      return rejeitado(status);
    },

    consultarRecibo,

    async aguardarRecibo(
      nRec: string,
      nfeAssinada?: string,
      politica: PoliticaRecibo = {},
    ): Promise<AutorizacaoOutcome> {
      const max = politica.maxTentativas ?? 10;
      const minimo = politica.esperaMinimaMs ?? 2000;
      const mult = politica.multiplicador ?? 1.5;
      const teto = politica.esperaMaximaMs ?? 30_000;
      if (!(max >= 1) || !(minimo >= 0) || !(mult >= 1) || !(teto >= minimo)) {
        throw new ConfigError('política de consulta do recibo inválida', { details: { max, minimo, mult, teto } });
      }
      let espera = minimo;
      let ultimo: AutorizacaoOutcome | undefined;
      for (let i = 0; i < max; i++) {
        await sleep(espera, politica.signal);
        // O mesmo signal cancela a espera e a requisição em curso.
        ultimo = await consultarRecibo(nRec, nfeAssinada, politica);
        if (ultimo.status !== 'pending') return ultimo;
        espera = Math.min(teto, Math.max(minimo, Math.round(espera * mult), ultimo.retryAfterMs ?? 0));
      }
      return ultimo as AutorizacaoOutcome;
    },

    consultar,

    async cancelar(p: CancelamentoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      return enviarEvento({
        ct: TEventoCanc,
        tpEvento: '110111',
        chave: c.chave,
        nSeqEvento: 1,
        cOrgao: c.cUF,
        autor: autorDoEmitente(p.autor, c),
        detEvento: { versao: EVENTO_VERSAO, descEvento: 'Cancelamento', nProt: p.nProt, xJust: p.xJust },
        // No autorizador da nota: o SVC só cancela a NF-e que ele autorizou, e a da UF só se cancela na UF.
        endpoint: endpointDaChave('RecepcaoEvento', c),
        offsetMinutes: offsetDe(c.uf),
        signal: opcoes?.signal,
      });
    },

    async cancelarPorSubstituicao(p: CancelamentoSubstituicaoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      if (c.mod !== '65') {
        throw new ValidationError('cancelamento por substituição só existe para NFC-e', [
          {
            path: 'chave',
            code: 'modelo_nao_suportado',
            message: 'O evento 110112 é exclusivo da NFC-e (modelo 65)',
          },
        ]);
      }
      const ref = chaveValida(p.chNFeRef, 'chNFeRef');
      // detEvento do e110112_v1.00.xsd (Evento_CancSubst_v1.01, NT 2018.004), validado com o envelope.
      const detEvento: DetCancSubst = {
        versao: EVENTO_VERSAO,
        descEvento: 'Cancelamento por substituicao',
        cOrgaoAutor: p.cOrgaoAutor as DetCancSubst['cOrgaoAutor'],
        tpAutor: p.tpAutor ?? '1',
        verAplic: p.verAplic,
        nProt: p.nProt,
        xJust: p.xJust,
        chNFeRef: ref.chave,
      };
      return enviarEvento({
        ct: TEventoCancSubst,
        tpEvento: '110112',
        chave: c.chave,
        nSeqEvento: 1,
        cOrgao: c.cUF,
        autor: autorDoEmitente(p.autor, c),
        detEvento,
        endpoint: endpointDaChave('RecepcaoEvento', c),
        offsetMinutes: offsetDe(c.uf),
        signal: opcoes?.signal,
      });
    },

    async cartaCorrecao(p: CartaCorrecaoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      if (!Number.isInteger(p.nSeqEvento) || p.nSeqEvento < 1 || p.nSeqEvento > 20) {
        throw new ConfigError(`nSeqEvento da CC-e vai de 1 a 20: ${p.nSeqEvento}`);
      }
      return enviarEvento({
        ct: TEventoCce,
        tpEvento: '110110',
        chave: c.chave,
        nSeqEvento: p.nSeqEvento,
        cOrgao: c.cUF,
        autor: autorDoEmitente(p.autor, c),
        detEvento: {
          versao: EVENTO_VERSAO,
          descEvento: 'Carta de Correção',
          xCorrecao: p.xCorrecao,
          xCondUso: XCONDUSO,
        },
        // A CC-e vai sempre à UF: o SVC só recebe o cancelamento (NT 2013.007).
        endpoint: endpointDaChave('RecepcaoEvento', c, true),
        offsetMinutes: offsetDe(c.uf),
        signal: opcoes?.signal,
      });
    },

    async manifestar(p: ManifestacaoPedido, opcoes?: OpcoesEnvio): Promise<EventoOutcome> {
      const c = chaveValida(p.chave, 'chave');
      const m = MANIFESTACOES[p.tipo];
      if (!m) throw new ConfigError(`tipo de manifestação desconhecido: ${String(p.tipo)}`);
      return enviarEvento({
        ct: m.ct,
        tpEvento: m.tpEvento,
        chave: c.chave,
        nSeqEvento: 1,
        // Manifestação do destinatário: registrada no Ambiente Nacional, cOrgao 91 (NT 2012.002).
        cOrgao: '91',
        autor: autorPadrao(p.autor, 'autor'),
        detEvento: {
          versao: EVENTO_VERSAO,
          descEvento: m.descEvento,
          ...(p.xJust === undefined ? {} : { xJust: p.xJust }),
        },
        endpoint: nfeEndpoint({ ambiente: options.ambiente, servico: 'RecepcaoEvento', autorizador: 'AN' }),
        // Quem manifesta é o destinatário: o fuso é o da UF dele, quando informada.
        offsetMinutes: offsetDe(options.uf ?? c.uf),
        signal: opcoes?.signal,
      });
    },

    async inutilizar(p: InutilizacaoPedido, opcoes?: OpcoesEnvio): Promise<InutilizacaoOutcome> {
      const autor = autorPadrao(p.autor, 'autor');
      // NT 2018.001 v1.10, item 6.1: o controle de inutilização não se aplica ao emitente pessoa física, e o leiaute do
      // pedido não prevê o CPF; a série 910 a 969 (emitente CPF) é rejeitada com 266 (regra I02a, item 6.2).
      if (!('CNPJ' in autor)) {
        throw new ValidationError('inutilização não se aplica ao emitente pessoa física', [
          {
            path: 'autor.CPF',
            code: 'inutilizacao_emitente_cpf',
            message: 'O pedido de inutilização só existe para emitente CNPJ (NT 2018.001 v1.10, item 6.1)',
          },
        ]);
      }
      const cnpj = autor.CNPJ;
      const { uf, cUF } = ufPadrao('NfeInutilizacao');
      const anoTxt = String(p.ano);
      const ano = anoTxt.length === 4 ? anoTxt.slice(2) : anoTxt.padStart(2, '0');
      const mod = p.mod ?? '55';
      const serie = String(p.serie);
      const ini = String(p.nNFIni);
      const fin = String(p.nNFFin);
      for (const [k, x, re] of [
        ['ano', ano, /^[0-9]{2}$/],
        ['serie', serie, /^(0|[1-9][0-9]{0,2})$/],
        ['nNFIni', ini, /^[1-9][0-9]{0,8}$/],
        ['nNFFin', fin, /^[1-9][0-9]{0,8}$/],
      ] as const) {
        if (!re.test(x)) throw new ConfigError(`${k} inválido para inutilização: ${x}`);
      }
      if (Number(fin) < Number(ini)) throw new ConfigError('nNFFin menor que nNFIni');
      if (Number(serie) >= 910 && Number(serie) <= 969) {
        throw new ValidationError('série de emitente pessoa física não se inutiliza', [
          {
            path: 'serie',
            code: 'inutilizacao_serie_cpf',
            message: 'Série 910 a 969 identifica emitente CPF: a SEFAZ rejeita com 266 (NT 2018.001 v1.10, regra I02a)',
          },
        ]);
      }
      // Id = "ID" + cUF + ano + CNPJ + mod + série (3) + número inicial (9) + número final (9) (leiaute infInut).
      const id = `ID${cUF}${ano}${cnpj}${mod}${serie.padStart(3, '0')}${ini.padStart(9, '0')}${fin.padStart(9, '0')}`;
      const inf = {
        Id: id,
        tpAmb,
        xServ: 'INUTILIZAR' as const,
        cUF,
        ano,
        CNPJ: cnpj,
        mod,
        serie,
        nNFIni: ini,
        nNFFin: fin,
        xJust: p.xJust,
      };
      const infXml = serialize(TInutNFe_infInut, 'infInut', inf, NFE_NS);
      const inut = envelope('inutNFe', '4.00', [infXml]);
      const infEl = firstChild(parseXml(inut).root, 'infInut', NFE_NS) as XmlElement;
      schemaIssues('pedido de inutilização', validate(TInutNFe_infInut, infEl));
      const assinado = await signXml(inut, { id }, options.signer);
      // A inutilização não existe no SVC (o SVC-RS nem publica o serviço): vai sempre ao autorizador normal da UF.
      const ep =
        mod === '65'
          ? endpointNfce('NfeInutilizacao', uf)
          : nfeEndpoint({ ambiente: options.ambiente, servico: 'NfeInutilizacao', uf });
      const r = await call(ep, 'NfeInutilizacao', assinado, 'retInutNFe', opcoes?.signal);
      const v = decode(TRetInutNFe, r.ret, r.doc.source).value;
      const status = { cStat: v.infInut.cStat, xMotivo: v.infInut.xMotivo };
      logger.info('nfe.inutilizacao', { id, cStat: status.cStat });
      if (!cstatEm(status.cStat, 'inutilizacaoHomologada')) return rejeitado(status);
      // A homologação tem de ser desta faixa: os campos que o retorno trouxer, iguais aos do pedido.
      const r0 = v.infInut;
      const n = (x: string | undefined): string | undefined => (x === undefined ? undefined : String(Number(x)));
      const confere: readonly (readonly [string, string | undefined, string])[] = [
        ['ano', r0.ano, ano],
        ['CNPJ', r0.CNPJ ?? (r0 as { CPF?: string }).CPF, cnpj],
        ['mod', r0.mod, mod],
        ['serie', n(r0.serie), String(Number(serie))],
        ['nNFIni', n(r0.nNFIni), String(Number(ini))],
        ['nNFFin', n(r0.nNFFin), String(Number(fin))],
      ];
      const fora = confere.filter(([, veio, pedido]) => veio !== undefined && veio !== pedido);
      if (fora.length > 0) {
        throw new ProtocolError('retInutNFe de outra faixa', {
          details: Object.fromEntries(fora.map(([k, v]) => [k, v])),
        });
      }
      return authorized(status, {
        dhRecbto: v.infInut.dhRecbto,
        retInutNFe: avulso(r.doc, r.ret),
        procInutNFe: envelope('ProcInutNFe', '4.00', [assinado, sliceElement(r.doc, r.ret)]),
        ...(v.infInut.nProt === undefined ? {} : { nProt: v.infInut.nProt }),
      });
    },

    async consultarCadastro(p: CadastroPedido, opcoes?: OpcoesEnvio): Promise<SefazOutcome<Cadastro, never>> {
      const doc =
        'CNPJ' in p
          ? documentoAutor({ CNPJ: p.CNPJ }, 'CNPJ')
          : 'CPF' in p
            ? documentoAutor({ CPF: p.CPF }, 'CPF')
            : { IE: p.IE.replace(/[^0-9A-Za-z]/g, '').toUpperCase() };
      const msg = serializeRoot(ConsCadElement, { versao: '2.00', infCons: { xServ: 'CONS-CAD', UF: p.uf, ...doc } });
      const ep = nfeEndpoint({ ambiente: options.ambiente, servico: 'NfeConsultaCadastro', uf: p.uf });
      const r = await call(ep, 'NfeConsultaCadastro', msg, 'retConsCad', opcoes?.signal);
      const v = decode(TRetConsCad, r.ret, r.doc.source).value;
      const i = v.infCons;
      const status = { cStat: i.cStat, xMotivo: i.xMotivo };
      logger.info('nfe.cadastro', { uf: p.uf, cStat: i.cStat });
      if (!cstatEm(i.cStat, 'cadastroEncontrado')) return rejeitado(status);
      return authorized(status, { UF: i.UF, dhCons: i.dhCons, infCad: i.infCad ?? [] });
    },

    async distribuicaoDFe(
      consulta: DistribuicaoConsulta,
      opcoes: DistribuicaoOpcoes = {},
    ): Promise<SefazOutcome<Distribuicao, never>> {
      const autor = autorPadrao(opcoes.autor, 'autor');
      const nsu = (x: string | number, k: string): string => {
        const s = String(x);
        if (!/^[0-9]{1,15}$/.test(s)) throw new ConfigError(`${k} inválido: ${s}`);
        return s.padStart(15, '0');
      };
      const grupo =
        'ultNSU' in consulta
          ? { distNSU: { ultNSU: nsu(consulta.ultNSU, 'ultNSU') } }
          : 'NSU' in consulta
            ? { consNSU: { NSU: nsu(consulta.NSU, 'NSU') } }
            : { consChNFe: { chNFe: chaveValida(consulta.chNFe, 'chNFe').chave } };
      const cUFAutor = opcoes.cUFAutor ?? ufPadrao('NFeDistribuicaoDFe').cUF;
      if (ufByCUf(cUFAutor) === undefined) throw new ConfigError(`cUFAutor inválido: ${cUFAutor}`);
      const msg = serializeRoot(distDFeIntElement, {
        versao: '1.01',
        tpAmb,
        cUFAutor: cUFAutor as CUf,
        ...autor,
        ...grupo,
      } as distDFeInt);
      const ep = nfeEndpoint({ ambiente: options.ambiente, servico: 'NFeDistribuicaoDFe' });
      const r = await call(ep, 'NFeDistribuicaoDFe', msg, 'retDistDFeInt', opcoes.signal);
      const v = decode(retDistDFeInt, r.ret, r.doc.source).value;
      const status = { cStat: v.cStat, xMotivo: v.xMotivo };
      logger.info('nfe.distribuicao', { cStat: v.cStat, ultNSU: v.ultNSU, maxNSU: v.maxNSU });
      const base = { ultNSU: v.ultNSU, maxNSU: v.maxNSU, dhResp: v.dhResp };
      if (cstatEm(v.cStat, 'distribuicaoNenhumDocumento')) return authorized(status, { ...base, documentos: [] });
      if (!cstatEm(v.cStat, 'distribuicaoDocumentos')) return rejeitado(status);
      const documentos: DocumentoDistribuido[] = [];
      for (const z of v.loteDistDFeInt?.docZip ?? []) {
        const xml = await gunzipBase64(z.$text);
        documentos.push(documentoDistribuido(z.NSU ?? '', z.schema, xml));
      }
      return authorized(status, { ...base, documentos });
    },
  };
  return client;
}

/** Classifica e, nos resumos, decodifica o documento da distribuição pelo nome do schema. */
function documentoDistribuido(NSU: string, schema: string, xml: string): DocumentoDistribuido {
  const nome = schema.replace(/_v?\d.*$/, '');
  const base = { NSU, schema, xml };
  if (nome === 'resNFe') return { ...base, tipo: 'resNFe', resNFe: decodeXml(resNFeElement, xml).value };
  if (nome === 'resEvento') return { ...base, tipo: 'resEvento', resEvento: decodeXml(resEventoElement, xml).value };
  if (nome === 'procNFe') return { ...base, tipo: 'procNFe' };
  if (nome === 'procEventoNFe') return { ...base, tipo: 'procEventoNFe' };
  return { ...base, tipo: 'outro' };
}
