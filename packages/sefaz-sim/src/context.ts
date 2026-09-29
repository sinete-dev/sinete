/**
 * Configuração resolvida, estado de execução e contexto de cada pedido, e as validações gerais que todos os serviços
 * aplicam antes das regras específicas, na ordem do MOC 7.0 Anexo I (item 4.1): certificado de transmissão (grupo A),
 * validação inicial da mensagem (grupo B) e forma da área de dados (grupo D).
 */

import type { Ambiente, Clock } from '@sinete/core';
import type { XmlDocument } from '@sinete/core/xml';
import { attributeOf, parseXml, XmlError } from '@sinete/core/xml';
import type { RootElement, SchemaIssue } from '@sinete/schemas';
import { validateRoot } from '@sinete/schemas';
import type { CertIdentity } from './certs.ts';
import { isDenegacao, motivo, motivoRejeicao } from './messages.ts';
import type { SimRules } from './rules.ts';
import type { ServiceDef, SimAutorizador } from './services.ts';
import type { Contribuinte, SimState, TipoAutorizador } from './state.ts';
import { formatInstant } from './time.ts';
import { hasPrefix } from './xmlutil.ts';

/** SVC que atende a UF simulada quando a contingência está ativa. */
export type Svc = 'SVC-AN' | 'SVC-RS';

/**
 * Ativação da SVC para uma UF (NT 2013.007 v1.03, item 03): a SEFAZ de origem a ativa (`ativa`, 107 na consulta
 * status), a desativa com aviso (`desativando` até `ate`, 113 na consulta status e a recepção ainda aceita; depois de
 * `ate`, como `inativa`) ou a deixa desligada (`inativa`, 114 na consulta status e na recepção).
 */
export type AtivacaoSvc =
  | { readonly situacao: 'ativa' }
  | { readonly situacao: 'desativando'; readonly ate: ReturnType<Clock['now']> }
  | { readonly situacao: 'inativa' };

export interface SimConfig {
  readonly clock: Clock;
  readonly ambiente: Ambiente;
  readonly tpAmb: '1' | '2';
  /** Sigla da UF autorizadora simulada. */
  readonly uf: string;
  readonly cUF: string;
  /** cUF das UFs atendidas pelo autorizador (regras B02-10 e B05). */
  readonly cUFsAtendidas: readonly string[];
  readonly offsetMinutes: number;
  readonly cadastro: readonly Contribuinte[];
  readonly rules: SimRules;
  readonly exigirCertificado: boolean;
  readonly prazoCancelamentoMs: number;
  readonly prazoCancelamentoSubstituicaoMs: number;
  readonly atrasoProcessamentoMs: number;
  readonly respostaSincrona: 'aceita' | 'recusa' | 'assincrona';
  readonly intervaloConsumoIndevidoMs: number;
  /** Tamanho máximo da área de dados em bytes (regra B01, 214). */
  readonly tamanhoMaximo: number;
  /** MDF-e: prazo do cancelamento depois da autorização (K04, 220). */
  readonly prazoCancelamentoMdfeMs: number;
  /** MDF-e: limite da área de dados (B01, 214; o MOC do MDF-e fixa 2048 KB). */
  readonly tamanhoMaximoMdfe: number;
  /** MDF-e: regras de negócio desligadas pelo `id` do MOC (`F86`, `K04`...), para montar cenários. */
  readonly regrasMdfeDesligadas: ReadonlySet<string>;
}

/** Estado mutável de execução, compartilhado pelos três autorizadores. */
export interface Runtime {
  readonly config: SimConfig;
  readonly state: SimState;
  /** `setContingencia`: a UF responde 108, e a SVC (esta) fica ativa para as UFs atendidas. */
  contingencia: Svc | undefined;
  /** SVC da UF simulada pela tabela do `@sinete/transport`, quando `setContingencia` não escolheu outra. */
  readonly svcPadrao: Svc;
  /** Ativação da SVC por cUF (`setAtivacaoSvc`), por cima da que `setContingencia` dá. */
  readonly ativacaoSvc: Map<string, AtivacaoSvc>;
  readonly paralisacao: Map<SimAutorizador, '108' | '109'>;
  /** Paralisação dos serviços do MDF-e (a SVRS), independente da NF-e. */
  paralisacaoMdfe: '108' | '109' | undefined;
  /** Protocolos que saem sem `digVal` (`setProtocoloSemDigVal`). */
  semDigVal: ProtocoloSemDigVal | undefined;
}

/**
 * Protocolos que saem sem `digVal`, opcional no leiaute (`TProtNFe/infProt/digVal` e `TProtMDFe/infProt/digVal`,
 * minOccurs 0), como há autorizador que devolve: `denegacao` só nas denegações da NF-e (110, 301, 302, 303), `todos`
 * também nas autorizações da NF-e e do MDF-e. `onde` escolhe a resposta: a da autorização (envio e recibo), a da
 * consulta protocolo, ou as duas.
 */
export interface ProtocoloSemDigVal {
  readonly quais: 'denegacao' | 'todos';
  readonly onde: 'autorizacao' | 'consulta' | 'ambos';
}

/** O protocolo com este `cStat` sai sem `digVal` na resposta `onde`. */
export function omitirDigVal(rt: Runtime, onde: 'autorizacao' | 'consulta', cStat: string): boolean {
  const s = rt.semDigVal;
  if (s === undefined || (s.onde !== 'ambos' && s.onde !== onde)) return false;
  return s.quais === 'todos' || isDenegacao(cStat);
}

export interface RequestContext {
  readonly rt: Runtime;
  readonly def: ServiceDef;
  readonly autorizador: SimAutorizador;
  /** Área de dados como recebida. */
  readonly payload: string;
  readonly now: number;
  /** Certificado de transmissão lido e aprovado no grupo A, ou `undefined` sem certificado. */
  readonly transmissor: CertIdentity | undefined;
  /** cStat do grupo A quando o certificado de transmissão foi recusado (280, 281, 282). */
  readonly transmissorRecusado: string | undefined;
}

/** `dhRecbto`/`dhResp` no fuso do autorizador. */
export function dh(ctx: { readonly rt: Runtime }, ms: number): string {
  return formatInstant(ms, ctx.rt.config.offsetMinutes);
}

/**
 * Autorizador de um atendimento. `svc` fixa qual SVC atendeu: um lote assíncrono aceito pela SVC-RS é processado como
 * SVC-RS mesmo que a contingência mude antes do processamento. Sem `svc`, vale a contingência atual.
 */
export interface AutorizadorCtx {
  readonly rt: Runtime;
  readonly autorizador: SimAutorizador;
  readonly svc?: Svc | undefined;
}

const svcDe = (ctx: AutorizadorCtx): Svc => ctx.svc ?? svcAtual(ctx.rt);

/** A SVC que atende agora: a escolhida em `setContingencia`, ou a da tabela para a UF simulada. */
export function svcAtual(rt: Runtime): Svc {
  return rt.contingencia ?? rt.svcPadrao;
}

/**
 * Situação da SVC para a UF do `cUF` em `now`: `ativa`, `desativando` (antes de `ate`) ou `inativa`. Sem
 * `setAtivacaoSvc` para a UF, vale `setContingencia` (ligada: ativa; desligada: inativa).
 */
export function situacaoSvc(
  rt: Runtime,
  cUF: string,
  now: number,
):
  | { readonly situacao: 'ativa' }
  | { readonly situacao: 'desativando'; readonly ate: number }
  | { readonly situacao: 'inativa' } {
  const a = rt.ativacaoSvc.get(cUF) ?? { situacao: rt.contingencia === undefined ? 'inativa' : 'ativa' };
  if (a.situacao !== 'desativando') return a;
  const ate = a.ate.getTime();
  return now < ate ? { situacao: 'desativando', ate } : { situacao: 'inativa' };
}

/** `verAplic` do autorizador simulado (o MOC pede a sigla do órgão no início). */
export function verAplic(ctx: AutorizadorCtx): string {
  const sigla = ctx.autorizador === 'uf' ? ctx.rt.config.uf : ctx.autorizador === 'an' ? 'AN' : svcDe(ctx);
  return `${sigla}_SINETE_SIM`;
}

/** Tipo do autorizador no protocolo: 1 SEFAZ, 3 SVC-RS, 4 SVC-AN (tabela 4-8), 8 Ambiente Nacional (891...). */
export function tipoAutorizador(ctx: AutorizadorCtx): TipoAutorizador {
  if (ctx.autorizador === 'an') return '8';
  if (ctx.autorizador === 'svc') return svcDe(ctx) === 'SVC-RS' ? '3' : '4';
  return '1';
}

/** Rejeição de lote ou de mensagem: `cStat` com a mensagem oficial. */
export interface Status {
  readonly cStat: string;
  readonly xMotivo: string;
}

export function status(cStat: string, params?: Readonly<Record<string, string>>): Status {
  return { cStat, xMotivo: motivo(cStat, params) };
}

export interface PreludeSpec {
  /** Raízes aceitas; a primeira é a esperada para as regras D01a e D01b. */
  readonly roots: readonly RootElement<unknown>[];
  /** Serviço de autorização: 225, 565 e 568 no lugar de 215, 516 e 517. */
  readonly lote: boolean;
}

export type Prelude =
  | { readonly ok: true; readonly doc: XmlDocument; readonly root: RootElement<unknown> }
  | { readonly ok: false; readonly status: Status; readonly doc: XmlDocument | undefined };

function schemaFailure(doc: XmlDocument, spec: PreludeSpec, issues: readonly SchemaIssue[]): Status {
  const expected = spec.roots[0] as RootElement<unknown>;
  // D01a e D01b: raiz esperada e atributo versao, aplicados quando o schema falha.
  if (issues.some((i) => i.code === 'raiz_inesperada') || doc.root.local !== expected.name) {
    return status(spec.lote ? '565' : '516');
  }
  if (attributeOf(doc.root, 'versao') === undefined) return status(spec.lote ? '568' : '517');
  return status(spec.lote ? '225' : '215');
}

/**
 * Grupos A, B e D. Devolve o documento parseado e a raiz que validou, ou o status da rejeição (o serviço monta a
 * resposta com os campos que conseguir ler).
 */
export function prelude(ctx: RequestContext, spec: PreludeSpec): Prelude {
  if (ctx.transmissorRecusado !== undefined) {
    return { ok: false, status: status(ctx.transmissorRecusado), doc: undefined };
  }
  // B01: tamanho da área de dados.
  if (new TextEncoder().encode(ctx.payload).length > ctx.rt.config.tamanhoMaximo) {
    return { ok: false, status: status('214'), doc: undefined };
  }
  // B02: XML malformado (a área de dados isolada do envelope precisa se sustentar sozinha).
  let doc: XmlDocument;
  try {
    doc = parseXml(ctx.payload);
  } catch (e) {
    if (e instanceof XmlError) return { ok: false, status: status('243'), doc: undefined };
    throw e;
  }
  // B03 e B04: serviço paralisado (na SVC e no AN só pela paralisação explícita; na UF também pela contingência).
  const parado =
    ctx.rt.paralisacao.get(ctx.autorizador) ??
    (ctx.autorizador === 'uf' && ctx.rt.contingencia !== undefined ? '108' : undefined);
  if (parado !== undefined) {
    return { ok: false, status: { cStat: parado, xMotivo: motivoRejeicao(parado) }, doc };
  }
  // D01e: caracteres de edição entre as tags.
  if (/>\s+</.test(ctx.payload)) return { ok: false, status: status('588'), doc };
  // D01: schema, em qualquer das raízes aceitas (PL vigentes).
  let firstIssues: readonly SchemaIssue[] | undefined;
  let valid: RootElement<unknown> | undefined;
  for (const root of spec.roots) {
    const issues = validateRoot(root, doc);
    if (issues.length === 0) {
      valid = root;
      break;
    }
    firstIssues ??= issues;
  }
  if (valid === undefined) return { ok: false, status: schemaFailure(doc, spec, firstIssues ?? []), doc };
  // D02: prefixo de namespace.
  if (hasPrefix(doc.root)) return { ok: false, status: status('404'), doc };
  return { ok: true, doc, root: valid };
}
