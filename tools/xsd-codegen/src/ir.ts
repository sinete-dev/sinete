/**
 * Representação intermediária (IR) serializável em JSON: uma por módulo gerado. É o que o revisor lê quando chega
 * uma NT nova (`diff.ts` compara duas IRs e lista caminhos adicionados, removidos e alterados).
 */

export interface Facets {
  /** Cada array interno é um passo de derivação (patterns em OU); os passos se somam com E. */
  patterns?: string[][];
  enumeration?: string[];
  length?: number;
  minLength?: number;
  maxLength?: number;
  totalDigits?: number;
  fractionDigits?: number;
  minInclusive?: string;
  maxInclusive?: string;
  minExclusive?: string;
  maxExclusive?: string;
  whiteSpace?: 'preserve' | 'replace' | 'collapse';
}

export interface SimpleIR {
  kind: 'simple';
  /** Nome global, ou ausente para tipo anônimo. */
  name?: string;
  /** Tipo embutido na raiz da derivação. */
  builtin: string;
  /** Cadeia de tipos nomeados, do mais derivado para a base. */
  chain: string[];
  facets: Facets;
  doc?: string;
}

export interface AttrIR {
  name: string;
  type: SimpleIR;
  required: boolean;
  fixed?: string;
  doc?: string;
}

export type ParticleIR =
  | {
      k: 'el';
      name: string;
      ns: string;
      type: TypeRef;
      min: number;
      max: number;
      /** xs:unique do elemento, com seletor `./*` e campo `@attr`: atributos que não repetem entre os filhos. */
      unique?: string[];
      doc?: string;
    }
  | { k: 'seq' | 'choice'; min: number; max: number; items: ParticleIR[] }
  | { k: 'any'; min: number; max: number };

export type TypeRef = { ref: string } | SimpleIR;

export interface ComplexIR {
  kind: 'complex';
  /** Id estável: nome global, ou caminho do elemento para anônimos (`TNFe.infNFe.det.imposto`). */
  id: string;
  anonymous: boolean;
  ns: string;
  attrs: AttrIR[];
  content?: ParticleIR;
  /** simpleContent: tipo do texto. */
  text?: SimpleIR;
  anyAttribute?: boolean;
  doc?: string;
}

export interface RootIR {
  name: string;
  ns: string;
  type: string;
}

export interface SchemaIR {
  subpath: string;
  pl: string;
  roots: RootIR[];
  complex: Record<string, ComplexIR>;
  /** Tipos simples nomeados, guardados para documentação e diff (as partículas os copiam inline). */
  simple: Record<string, SimpleIR>;
  unsupported: string[];
  /** Correções de pattern aplicadas sobre o XSD oficial, com o motivo (`ModuleSpec.patches`). */
  patches?: { tipo: string; de: string; para: string; motivo: string }[];
}
