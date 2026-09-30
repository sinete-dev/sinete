/**
 * Descritores de runtime gerados a partir dos XSD (ADR 0002). Cada módulo gerado exporta um `ComplexType` por tipo
 * complexo, com o mesmo identificador do tipo TS; serializer, decoder e validador são genéricos e percorrem os
 * descritores na ordem do XSD. As chaves são curtas porque o módulo da NF-e tem milhares de descritores.
 */

/** Tipo simples: base embutida do XSD mais as facetas acumuladas na cadeia de derivação. */
export interface SimpleType {
  /** Tipo embutido na raiz da derivação (`string`, `decimal`, `base64Binary`, `ID`, `anyURI`...). */
  readonly b: string;
  /** Patterns: cada passo de derivação é um OU; os passos se somam com E. */
  readonly p?: readonly (readonly string[])[];
  /** Enumeração. */
  readonly e?: readonly string[];
  /** `length`, `minLength`, `maxLength` (octetos em base64Binary e hexBinary). */
  readonly l?: number;
  readonly mn?: number;
  readonly mx?: number;
  /** `totalDigits`, `fractionDigits`. */
  readonly td?: number;
  readonly fd?: number;
  /** `minInclusive`, `maxInclusive`, `minExclusive`, `maxExclusive` (forma lexical). */
  readonly mi?: string;
  readonly ma?: string;
  readonly me?: string;
  readonly mxe?: string;
  /** `whiteSpace` quando não é o padrão do tipo embutido: `p` preserve, `r` replace, `c` collapse. */
  readonly ws?: 'p' | 'r' | 'c';
  /** Nome do tipo no XSD, para mensagens. */
  readonly nm?: string;
}

/** Partícula elemento. */
export interface ElementParticle {
  readonly e: string;
  readonly t: ComplexType | SimpleType;
  /** `minOccurs` quando diferente de 1. */
  readonly n?: number;
  /** `maxOccurs` quando diferente de 1 (`-1` = unbounded). */
  readonly x?: number;
  /** Namespace, quando diferente do tipo complexo dono. */
  readonly ns?: string;
  /** `xs:unique` do elemento com seletor `./*`: atributos que não podem repetir entre os filhos dele. */
  readonly u?: readonly string[];
}

/** Grupo `sequence` (`s`) ou `choice` (`c`). */
export interface GroupParticle {
  readonly g: 's' | 'c';
  readonly i: readonly Particle[];
  readonly n?: number;
  readonly x?: number;
}

/** `xs:any processContents="skip"` de qualquer namespace. O conteúdo fica como XML bruto em `$any`. */
export interface WildcardParticle {
  readonly w: 1;
  readonly n?: number;
  readonly x?: number;
}

export type Particle = ElementParticle | GroupParticle | WildcardParticle;

export interface AttributeDecl {
  readonly a: string;
  readonly t: SimpleType;
  /** `use="required"`. */
  readonly r?: 1;
  /** Valor `fixed`. */
  readonly f?: string;
}

/** Tipo complexo. `T` é um parâmetro fantasma que carrega o tipo TS gerado. */
export interface ComplexType<T = unknown> {
  /** Identificador estável: nome global, ou caminho do elemento para anônimos (`TNFe.infNFe.det`). */
  readonly id: string;
  readonly ns: string;
  readonly a?: readonly AttributeDecl[];
  readonly c?: Particle;
  /** `simpleContent`: tipo do texto. */
  readonly tx?: SimpleType;
  /** `xs:anyAttribute processContents="skip"`: atributos extras vão para `$attrs`. */
  readonly aa?: 1;
  /** Fantasma: nunca existe em runtime. */
  readonly __t?: T;
}

/** Elemento global que pode ser raiz de um documento. */
export interface ElementoRaiz<T = unknown> {
  readonly nome: string;
  readonly ns: string;
  readonly tipo: ComplexType<T>;
}

/** Proveniência de um módulo gerado: de qual pacote oficial saiu cada schema. */
export interface FonteDoSchema {
  /** Pasta do pacote oficial em `tools/xsd-codegen/xsd/` (`nfe/PL_010f_v1.04`). */
  readonly pacote: string;
  /** Nome do zip oficial baixado. */
  readonly arquivo: string;
  readonly sha256: string;
  readonly url: string;
}

export interface DescricaoModuloSchema {
  /** Subpath do módulo (`nfe/PL_010f`). */
  readonly subpath: string;
  readonly documento: string;
  /** Identificador do pacote de liberação (`PL_010f_v1.04`). */
  readonly pl: string;
  readonly fontes: readonly FonteDoSchema[];
  /** Correções de pattern aplicadas sobre o XSD oficial, com o motivo. Ausente quando o XSD foi usado como está. */
  readonly ajustes?: readonly AjusteDoSchema[];
}

/** Correção de um pattern do XSD oficial que nenhum validador conforme aceita (o arquivo oficial não muda). */
export interface AjusteDoSchema {
  /** Tipo simples global. */
  readonly tipo: string;
  /** Pattern do XSD oficial. */
  readonly de: string;
  /** Pattern usado no módulo gerado. */
  readonly para: string;
  readonly motivo: string;
}

/** Valor tipado de um `ComplexType`. */
export type ValorDe<C> = C extends ComplexType<infer T> ? T : never;

export function ehComplexType(t: ComplexType | SimpleType): t is ComplexType {
  return (t as ComplexType).id !== undefined;
}

export function ehElementParticle(p: Particle): p is ElementParticle {
  return (p as ElementParticle).e !== undefined;
}

export function ehWildcard(p: Particle): p is WildcardParticle {
  return (p as WildcardParticle).w === 1;
}

export function minOccurs(p: Particle): number {
  return p.n ?? 1;
}

export function maxOccurs(p: Particle): number {
  return p.x === undefined ? 1 : p.x === -1 ? Number.POSITIVE_INFINITY : p.x;
}
