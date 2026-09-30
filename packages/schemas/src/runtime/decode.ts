/**
 * Decoder tolerante guiado pelos descritores: árvore do `@sinete/core/xml` para objeto tipado. Os valores ficam na forma
 * lexical exata do documento (decimais inclusive), então nada se perde em formatação.
 *
 * Tolerante de propósito (ADR 0002, decisão 4): documento recebido de terceiros não aborta. Elemento ou atributo
 * desconhecido, whitespace entre tags, texto solto e namespace errado viram ocorrências com o caminho, e o resto do
 * documento é lido. A validação estrita é do `validar`. Nunca reserialize um documento recebido: guarde a string
 * original, que é a que a assinatura cobre.
 */

import type { Ocorrencia } from '@sinete/core';
import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { descendentes, escaparAtributoC14n, namespacesEmEscopo } from '@sinete/core/xml';
import type { ComplexType, ElementoRaiz, ElementParticle, Particle } from './desc.ts';
import { ehComplexType, ehElementParticle, ehWildcard, maxOccurs } from './desc.ts';

/** Códigos das ocorrências do decoder. */
export type CodigoOcorrenciaDecodificacao =
  | 'elemento_desconhecido'
  | 'atributo_desconhecido'
  | 'whitespace_descartado'
  | 'texto_inesperado'
  | 'elemento_em_tipo_simples'
  | 'namespace_divergente'
  | 'raiz_inesperada';

export interface OcorrenciaDecodificacao extends Ocorrencia {
  readonly code: CodigoOcorrenciaDecodificacao;
}

export interface Decodificado<T> {
  readonly valor: T;
  readonly ocorrencias: readonly OcorrenciaDecodificacao[];
}

interface ElInfo {
  readonly p: ElementParticle;
  readonly arr: boolean;
}

interface CtInfo {
  readonly els: Map<string, ElInfo>;
  readonly wildcard: boolean;
  readonly attrs: Set<string>;
}

const infos = new WeakMap<ComplexType, CtInfo>();

function infoOf(ct: ComplexType): CtInfo {
  let m = infos.get(ct);
  if (m) return m;
  const els = new Map<string, ElInfo>();
  let wildcard = false;
  const walk = (p: Particle, rep: boolean): void => {
    if (ehWildcard(p)) wildcard = true;
    else if (ehElementParticle(p)) {
      // Nome repetido com o mesmo tipo em ramos diferentes (IPI no choice do imposto) é uma propriedade só.
      const prev = els.get(p.e);
      els.set(p.e, { p, arr: rep || maxOccurs(p) > 1 || (prev?.arr ?? false) });
    } else for (const i of p.i) walk(i, rep || maxOccurs(p) > 1);
  };
  if (ct.c) walk(ct.c, false);
  m = { els, wildcard, attrs: new Set((ct.a ?? []).map((a) => a.a)) };
  infos.set(ct, m);
  return m;
}

/** Decodifica o elemento `el` como o tipo `ct`. Nunca lança por causa do conteúdo. */
export function decodificar<T>(ct: ComplexType<T>, el: ElementoXml, texto?: string): Decodificado<T> {
  const issues: OcorrenciaDecodificacao[] = [];
  const value = decodificarComplexType(ct as ComplexType, el, issues, `/${el.local}`, texto) as T;
  return { valor: value, ocorrencias: issues };
}

/** Decodifica um documento parseado pela raiz esperada. Raiz com outro nome ou namespace vira ocorrência. */
export function decodificarRaiz<T>(raiz: ElementoRaiz<T>, documento: DocumentoXml): Decodificado<T> {
  const issues: OcorrenciaDecodificacao[] = [];
  if (documento.raiz.local !== raiz.nome || documento.raiz.ns !== raiz.ns) {
    issues.push({
      caminho: `/${documento.raiz.local}`,
      code: 'raiz_inesperada',
      mensagem: `raiz esperada {${raiz.ns}}${raiz.nome}`,
    });
  }
  const value = decodificarComplexType(
    raiz.tipo as ComplexType,
    documento.raiz,
    issues,
    `/${documento.raiz.local}`,
    documento.texto,
  ) as T;
  return { valor: value, ocorrencias: issues };
}

function pushTo(o: Record<string, unknown>, key: string, v: unknown): void {
  const cur = o[key];
  if (Array.isArray(cur)) cur.push(v);
  else o[key] = [v];
}

/**
 * Fragmento de `xs:any` completo em namespaces: o trecho da fonte perde as declarações feitas nos ancestrais, então
 * as que ele usa entram na tag de abertura dele. O default só entra quando difere do namespace do pai, que é o default
 * em que o serializer vai inserir o trecho. Sem prefixo herdado e com o default do pai, o trecho sai intacto.
 */
function wildcardFragment(source: string, c: ElementoXml, parent: ElementoXml): string {
  const raw = source.slice(c.inicio, c.fim);
  const outer = namespacesEmEscopo(parent);
  const need = new Map<string, string>();
  const declaredInside = (e: ElementoXml, prefix: string): boolean => {
    for (let x: ElementoXml | null = e; x && x !== parent; x = x.pai) if (x.namespaces.has(prefix)) return true;
    return false;
  };
  const use = (e: ElementoXml, prefix: string): void => {
    if (prefix === 'xml' || need.has(prefix) || declaredInside(e, prefix)) return;
    const uri = outer.get(prefix) ?? '';
    if (prefix === '' && uri === parent.ns) return;
    need.set(prefix, uri);
  };
  for (const e of descendentes(c)) {
    use(e, e.prefixo);
    for (const a of e.atributos) if (a.prefixo !== '') use(e, a.prefixo);
  }
  if (need.size === 0) return raw;
  const decls = [...need]
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .map(([p, u]) => ` ${p === '' ? 'xmlns' : `xmlns:${p}`}="${escaparAtributoC14n(u)}"`)
    .join('');
  const at = 1 + c.nome.length;
  return raw.slice(0, at) + decls + raw.slice(at);
}

function pushAttr(o: Record<string, unknown>, name: string, value: string): void {
  const cur = (o.$attrs as Record<string, string> | undefined) ?? {};
  // defineProperty porque o nome vem do documento: `__proto__` como atributo não pode virar troca de protótipo.
  Object.defineProperty(cur, name, { value, enumerable: true, writable: true, configurable: true });
  o.$attrs = cur;
}

function decodificarComplexType(
  ct: ComplexType,
  el: ElementoXml,
  issues: OcorrenciaDecodificacao[],
  path: string,
  source: string | undefined,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const info = infoOf(ct);
  for (const a of el.atributos) {
    if (a.ns === '' && info.attrs.has(a.local)) o[a.local] = a.valor;
    else if (ct.aa) {
      pushAttr(o, a.nome, a.valor);
      // Atributo com prefixo leva a declaração junto, senão o serializer emitiria um prefixo não declarado.
      if (a.prefixo !== '' && a.prefixo !== 'xml') pushAttr(o, `xmlns:${a.prefixo}`, a.ns);
    } else
      issues.push({
        caminho: `${path}/@${a.nome}`,
        code: 'atributo_desconhecido',
        mensagem: 'atributo fora do schema',
      });
  }
  if (ct.tx) {
    let s = '';
    for (const c of el.filhos) {
      if (c.tipo === 'texto') s += c.valor;
      else if (c.tipo === 'elemento') {
        issues.push({
          caminho: `${path}/${c.local}`,
          code: 'elemento_em_tipo_simples',
          mensagem: 'elemento em conteúdo simples',
        });
      }
    }
    o.$text = s;
    return o;
  }
  for (const c of el.filhos) {
    if (c.tipo === 'instrucao') continue;
    if (c.tipo === 'texto') {
      const ws = /^[ \t\n\r]*$/.test(c.valor);
      issues.push(
        ws
          ? { caminho: path, code: 'whitespace_descartado', mensagem: 'whitespace entre elementos descartado' }
          : { caminho: path, code: 'texto_inesperado', mensagem: 'texto em elemento só de elementos' },
      );
      continue;
    }
    const ei = info.els.get(c.local);
    const cp = `${path}/${c.local}`;
    if (!ei) {
      if (info.wildcard && source !== undefined) {
        pushTo(o, '$any', wildcardFragment(source, c, el));
      } else {
        issues.push({ caminho: cp, code: 'elemento_desconhecido', mensagem: 'elemento fora do schema' });
      }
      continue;
    }
    if (c.ns !== (ei.p.ns ?? ct.ns)) {
      issues.push({ caminho: cp, code: 'namespace_divergente', mensagem: `namespace esperado ${ei.p.ns ?? ct.ns}` });
    }
    const v = ehComplexType(ei.p.t)
      ? decodificarComplexType(ei.p.t, c, issues, cp, source)
      : decodificarSimpleType(c, issues, cp);
    if (ei.arr) pushTo(o, c.local, v);
    else o[c.local] = v;
  }
  return o;
}

function decodificarSimpleType(el: ElementoXml, issues: OcorrenciaDecodificacao[], path: string): string {
  for (const a of el.atributos) {
    issues.push({ caminho: `${path}/@${a.nome}`, code: 'atributo_desconhecido', mensagem: 'atributo fora do schema' });
  }
  const first = el.filhos[0];
  if (el.filhos.length === 1 && first?.tipo === 'texto') return first.valor;
  let s = '';
  for (const c of el.filhos) {
    if (c.tipo === 'texto') s += c.valor;
    else if (c.tipo === 'elemento') {
      issues.push({
        caminho: `${path}/${c.local}`,
        code: 'elemento_em_tipo_simples',
        mensagem: 'elemento em tipo simples',
      });
    }
  }
  return s;
}
