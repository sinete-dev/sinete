/**
 * Texto e tamanho dos campos de texto conferidos na entrada de um montador (ADR 0011, revisão de 01/10/2026), com o
 * tipo vindo do schema do leiaute: o montador diz só qual elemento recebe cada campo da entrada.
 *
 * Duas conferências: em qualquer texto da entrada, o caractere que o XML não representa; nos campos da tabela, o tipo
 * simples do elemento (tamanho, espaço nas pontas, caractere fora do conjunto aceito). A saída é uma lista de caminho
 * da entrada e mensagem para quem preenche o campo (`no máximo 60 caracteres (tem 61)`), sem nome de validador nem de
 * tipo do XSD; o montador a transforma na própria ocorrência.
 */

import type { ComplexType, Particle, SimpleType } from './desc.ts';
import { ehComplexType, ehElementParticle, ehWildcard } from './desc.ts';
import type { OcorrenciaSchema } from './validate.ts';
import { conferirTipoSimples } from './validate.ts';

/**
 * Campo de texto da entrada (com `[]` onde a entrada é uma lista) e o caminho, em pontos a partir da raiz, do elemento
 * que o recebe como veio. Quando o elemento é complexo, o grupo da entrada é o próprio tipo do schema (mesmos nomes) e
 * cada texto dele é conferido pelo tipo do seu elemento.
 */
export type CampoDeTexto = readonly [entrada: string, xml: string];

/** Um texto recusado: o caminho na entrada e a mensagem para quem o preenche. */
export interface TextoRecusado {
  readonly caminho: string;
  readonly mensagem: string;
}

/** Produção `Char` do XML 1.0: tab, LF, CR, U+0020 a U+D7FF, U+E000 a U+FFFD e U+10000 a U+10FFFF. */
export function textoXmlValido(texto: string): boolean {
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0;
    const ok =
      c === 0x9 ||
      c === 0xa ||
      c === 0xd ||
      (c >= 0x20 && c <= 0xd7ff) ||
      (c >= 0xe000 && c <= 0xfffd) ||
      (c >= 0x10000 && c <= 0x10ffff);
    if (!ok) return false;
  }
  return true;
}

/** O tipo do elemento `nome` entre as partículas (sequências e escolhas aninhadas). */
function elemento(p: Particle | undefined, nome: string): ComplexType | SimpleType | undefined {
  if (p === undefined || ehWildcard(p)) return undefined;
  if (ehElementParticle(p)) return p.e === nome ? p.t : undefined;
  for (const i of p.i) {
    const t = elemento(i, nome);
    if (t !== undefined) return t;
  }
  return undefined;
}

/** O tipo do elemento em `caminho` (pontos) a partir de `raiz`; `undefined` se o schema não o tem. */
function tipoEm(raiz: ComplexType, caminho: string): ComplexType | SimpleType | undefined {
  let t: ComplexType | SimpleType | undefined = raiz;
  for (const nome of caminho.split('.')) {
    if (t === undefined || !ehComplexType(t)) return undefined;
    t = elemento(t.c, nome);
  }
  return t;
}

const tiposPorRaiz = new WeakMap<
  ComplexType,
  WeakMap<readonly CampoDeTexto[], ReadonlyMap<string, ComplexType | SimpleType>>
>();

/** Tipo de cada campo da tabela no schema, calculado uma vez por raiz e tabela. */
function tiposDosCampos(
  raiz: ComplexType,
  campos: readonly CampoDeTexto[],
): ReadonlyMap<string, ComplexType | SimpleType> {
  let porTabela = tiposPorRaiz.get(raiz);
  if (porTabela === undefined) {
    porTabela = new WeakMap();
    tiposPorRaiz.set(raiz, porTabela);
  }
  let m = porTabela.get(campos);
  if (m === undefined) {
    const novo = new Map<string, ComplexType | SimpleType>();
    for (const [entrada, xml] of campos) {
      const t = tipoEm(raiz, xml);
      if (t !== undefined) novo.set(entrada, t);
    }
    m = novo;
    porTabela.set(campos, m);
  }
  return m;
}

/**
 * Os campos da tabela cujo elemento não existe em `raiz`: um erro de digitação na tabela de um montador, que deixaria o
 * campo sem conferência sem aviso. Os testes de cada montador cobram a lista vazia.
 */
export function camposSemElemento(raiz: ComplexType, campos: readonly CampoDeTexto[]): string[] {
  return campos.filter(([, xml]) => tipoEm(raiz, xml) === undefined).map(([entrada]) => entrada);
}

/** Os valores de `caminho` (com `[]` nas listas) na entrada, com o caminho concreto de cada um. */
function valoresEm(raiz: unknown, caminho: string): [string, unknown][] {
  let atuais: [string, unknown][] = [['', raiz]];
  for (const parte of caminho.split('.')) {
    const lista = parte.endsWith('[]');
    const chave = lista ? parte.slice(0, -2) : parte;
    const proximos: [string, unknown][] = [];
    for (const [c, v] of atuais) {
      if (typeof v !== 'object' || v === null) continue;
      const filho = (v as Record<string, unknown>)[chave];
      const base = c === '' ? chave : `${c}.${chave}`;
      if (!lista) proximos.push([base, filho]);
      else if (Array.isArray(filho)) for (const [n, f] of filho.entries()) proximos.push([`${base}[${n}]`, f]);
    }
    atuais = proximos;
  }
  return atuais;
}

/** Cada texto de um grupo que é o próprio tipo do schema, com o tipo simples do seu elemento. */
function textosDoGrupo(
  valor: unknown,
  tipo: ComplexType,
  caminho: string,
  saida: [string, string, SimpleType][],
): void {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return;
  for (const [k, v] of Object.entries(valor)) {
    const t = elemento(tipo.c, k);
    if (t === undefined) continue;
    const itens: [string, unknown][] = Array.isArray(v)
      ? v.map((x, n) => [`${caminho}.${k}[${n}]`, x])
      : [[`${caminho}.${k}`, v]];
    for (const [c, x] of itens) {
      if (ehComplexType(t)) textosDoGrupo(x, t, c, saida);
      else if (typeof x === 'string') saida.push([c, x, t]);
    }
  }
}

/** Objeto literal da entrada: um `Date`, um decimal ou outra instância de classe não tem texto a conferir. */
function objetoSimples(valor: unknown): valor is Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null) return false;
  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
}

/** Caminhos de todos os textos da entrada com caractere que o XML não representa. */
function textosForaDoXml(valor: unknown, caminho: string, saida: string[]): void {
  if (typeof valor === 'string') {
    if (!textoXmlValido(valor)) saida.push(caminho);
  } else if (Array.isArray(valor)) {
    for (const [n, v] of valor.entries()) textosForaDoXml(v, `${caminho}[${n}]`, saida);
  } else if (objetoSimples(valor)) {
    for (const [k, v] of Object.entries(valor)) textosForaDoXml(v, caminho === '' ? k : `${caminho}.${k}`, saida);
  }
}

/** Mensagem do caractere que não vai ao documento e que a pessoa não consegue ver (controle, invisível). */
const CARACTERE_INVISIVEL = 'caractere não aceito (símbolo ou caractere de controle)';

/** Caractere que a pessoa enxerga: letra, marca, número, pontuação ou símbolo. */
const VISIVEL = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u;

/** Se o pattern do tipo recusa `valor`. */
function padraoRecusa(tipo: SimpleType, valor: string): boolean {
  const saida: OcorrenciaSchema[] = [];
  conferirTipoSimples(tipo, valor, '', saida);
  return saida.some((o) => o.code === 'padrao');
}

/**
 * O primeiro caractere de `valor` que o tipo não aceita no meio de um texto, ou `undefined` se todos passam. Só num
 * tipo de texto livre (que aceita `AAA`): num tipo de formato (só dígitos, um código), o problema é o formato, e
 * apontar um caractere seria um palpite.
 */
function caractereRecusado(tipo: SimpleType, valor: string): string | undefined {
  if (padraoRecusa(tipo, 'AAA')) return undefined;
  for (const ch of new Set(valor)) if (padraoRecusa(tipo, `A${ch}A`)) return ch;
  return undefined;
}

/**
 * As regras do tipo que `valor` viola, em texto para quem preenche o campo. O código do validador decide a regra; a
 * mensagem diz o limite (do próprio tipo) e, no `padrao`, se o problema é o espaço nas pontas ou um caractere.
 */
function mensagensDoTexto(tipo: SimpleType, valor: string, violadas: readonly OcorrenciaSchema[]): string[] {
  if (violadas.length === 0) return [];
  if (valor.trim() === '') return ['não pode ficar em branco'];
  const tamanho = [...valor].length;
  const mensagens = new Set<string>();
  for (const o of violadas) {
    if (o.code === 'tamanho_maximo' && tipo.mx !== undefined)
      mensagens.add(`no máximo ${tipo.mx} caracteres (tem ${tamanho})`);
    else if (o.code === 'tamanho_minimo' && tipo.mn !== undefined)
      mensagens.add(`no mínimo ${tipo.mn} caracteres (tem ${tamanho})`);
    else if (o.code === 'tamanho' && tipo.l !== undefined)
      mensagens.add(`exatamente ${tipo.l} caracteres (tem ${tamanho})`);
    else if (o.code === 'padrao') {
      const espaco = valor !== valor.trim();
      const ch = caractereRecusado(tipo, valor);
      if (espaco) mensagens.add('sem espaço no começo nem no fim');
      if (ch !== undefined) mensagens.add(VISIVEL.test(ch) ? `caractere não aceito: “${ch}”` : CARACTERE_INVISIVEL);
      if (!espaco && ch === undefined) mensagens.add('formato não aceito');
    } else mensagens.add('valor não aceito neste campo');
  }
  return [...mensagens];
}

/**
 * Confere os textos da entrada: em qualquer campo, o caractere que o XML não representa; nos campos da tabela, o tipo
 * do elemento em `raiz` (tamanho, espaço nas pontas, caractere fora do conjunto aceito), um texto recusado por regra
 * violada. `pular` são os caminhos que não se conferem: os que já têm ocorrência de outra conferência da entrada e os
 * que a montagem troca por um texto fixo. Um campo recusado pelo caractere não é conferido de novo pelo tipo.
 */
export function conferirTextos(
  entrada: unknown,
  raiz: ComplexType,
  campos: readonly CampoDeTexto[],
  pular: ReadonlySet<string> = new Set(),
): TextoRecusado[] {
  const saida: TextoRecusado[] = [];
  const recusados = new Set(pular);
  const foraDoXml: string[] = [];
  textosForaDoXml(entrada, '', foraDoXml);
  for (const c of foraDoXml) {
    if (recusados.has(c)) continue;
    saida.push({ caminho: c, mensagem: CARACTERE_INVISIVEL });
    recusados.add(c);
  }
  const tipos = tiposDosCampos(raiz, campos);
  for (const [campo] of campos) {
    const tipo = tipos.get(campo);
    if (tipo === undefined) continue;
    const textos: [string, string, SimpleType][] = [];
    for (const [caminho, valor] of valoresEm(entrada, campo)) {
      if (ehComplexType(tipo)) textosDoGrupo(valor, tipo, caminho, textos);
      else if (typeof valor === 'string') textos.push([caminho, valor, tipo]);
    }
    for (const [caminho, valor, t] of textos) {
      if (recusados.has(caminho)) continue;
      const violadas: OcorrenciaSchema[] = [];
      conferirTipoSimples(t, valor, caminho, violadas);
      for (const mensagem of mensagensDoTexto(t, valor, violadas)) saida.push({ caminho, mensagem });
    }
  }
  return saida;
}
