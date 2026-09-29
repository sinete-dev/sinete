// Intermediate representation (serializable to JSON). One IR per schema package (PL) and root.

export interface Facets {
  /** each inner array is one derivation step (patterns ORed); steps are ANDed */
  patterns?: string[][];
  enumeration?: string[];
  length?: number;
  minLength?: number;
  maxLength?: number;
  totalDigits?: number;
  fractionDigits?: number;
  minInclusive?: string;
  maxInclusive?: string;
  whiteSpace?: "preserve" | "replace" | "collapse";
}

export interface SimpleIR {
  kind: "simple";
  /** global name when declared at top level, else undefined (anonymous) */
  name?: string;
  /** XSD builtin at the root of the derivation chain (string, ID, base64Binary, anyURI, gYearMonth...) */
  builtin: string;
  /** derivation chain of named types, most derived first (for docs and diff review) */
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
  | { k: "el"; name: string; ns: string; type: TypeRef; min: number; max: number; doc?: string }
  | { k: "seq" | "choice"; min: number; max: number; items: ParticleIR[] };

export type TypeRef = { ref: string } | SimpleIR;

export interface ComplexIR {
  kind: "complex";
  /** stable id: global name, or element path for anonymous types (TNFe.infNFe.det.imposto) */
  id: string;
  anonymous: boolean;
  ns: string;
  attrs: AttrIR[];
  content?: ParticleIR;
  /** simpleContent: the text value type */
  text?: SimpleIR;
  doc?: string;
  unique?: { name: string; selector: string; field: string }[];
}

export interface SchemaIR {
  pl: string;
  root: { name: string; ns: string; type: string };
  namespaces: Record<string, string>;
  complex: Record<string, ComplexIR>;
  /** named simple types, kept for docs and diffs even though particles inline them */
  simple: Record<string, SimpleIR>;
  unsupported: string[];
}
