/**
 * IR para um módulo TS: tipos exportados (custo zero em runtime) e descritores `const` com o mesmo identificador,
 * para que `serializar(TNFe, 'NFe', valor)` infira o tipo do valor. Toda exportação tem anotação de tipo explícita
 * (`isolatedDeclarations`, ADR 0001).
 */
import type { AttrIR, ComplexIR, ParticleIR, SchemaIR, SimpleIR, TypeRef } from './ir.ts';

export interface EmitSource {
  readonly pacote: string;
  readonly arquivo: string;
  readonly sha256: string;
  readonly url: string;
}

export interface EmitOptions {
  readonly documento: string;
  /** Caminho de import do runtime a partir do módulo gerado. */
  readonly runtimeImport: string;
  readonly fontes: readonly EmitSource[];
  /** Correções de pattern sobre o XSD oficial, publicadas em `schema.ajustes`. */
  readonly patches?: readonly {
    readonly tipo: string;
    readonly de: string;
    readonly para: string;
    readonly motivo: string;
  }[];
  readonly description: string;
}

export interface EmitResult {
  readonly code: string;
  readonly stats: { readonly complexTypes: number; readonly simpleDescriptors: number; readonly bytes: number };
}

const ident = (id: string): string => id.replace(/[^A-Za-z0-9_$]/g, '_');
const lit = (s: string): string => JSON.stringify(s);
const propKey = (s: string): string => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s) ? s : lit(s));

function jsdoc(lines: (string | undefined)[], indent: string): string {
  const ls = lines
    .filter((l): l is string => Boolean(l))
    .flatMap((l) => l.replace(/\*\//g, '*\\/').split('\n'))
    .map((l) => l.trim())
    .filter(Boolean);
  if (ls.length === 0) return '';
  if (ls.length === 1) return `${indent}/** ${ls[0]} */\n`;
  return `${indent}/**\n${ls.map((l) => `${indent} * ${l}`).join('\n')}\n${indent} */\n`;
}

function facetSummary(s: SimpleIR): string | undefined {
  const f = s.facets;
  const parts: string[] = [];
  if (s.name) parts.push(`xsd:${s.name}`);
  else if (s.chain[0]) parts.push(`xsd:${s.chain[0]}`);
  if (f.length !== undefined) parts.push(`tamanho ${f.length}`);
  if (f.minLength !== undefined || f.maxLength !== undefined) {
    parts.push(`tamanho ${f.minLength ?? 0}..${f.maxLength ?? '*'}`);
  }
  const p = f.patterns;
  if (p && p.length === 1 && p[0]?.length === 1 && (p[0][0] ?? '').length < 80) parts.push(`pattern \`${p[0][0]}\``);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

const WS: Readonly<Record<string, string>> = { preserve: 'p', replace: 'r', collapse: 'c' };

export function emitModule(ir: SchemaIR, opts: EmitOptions): EmitResult {
  const used = new Set<string>();
  const claim = (name: string, what: string): string => {
    if (used.has(name)) throw new Error(`${ir.subpath}: identificador ${name} repetido (${what})`);
    used.add(name);
    return name;
  };

  // ---------- descritores de tipo simples (deduplicados) ----------
  const stNames = new Map<string, string>();
  const stDecls: string[] = [];
  let anon = 0;
  const stExpr = (s: SimpleIR): string => {
    const f = s.facets;
    const o: string[] = [`b: ${lit(s.builtin)}`];
    if (f.patterns) o.push(`p: ${JSON.stringify(f.patterns)}`);
    if (f.enumeration) o.push(`e: ${JSON.stringify(f.enumeration)}`);
    if (f.length !== undefined) o.push(`l: ${f.length}`);
    if (f.minLength !== undefined) o.push(`mn: ${f.minLength}`);
    if (f.maxLength !== undefined) o.push(`mx: ${f.maxLength}`);
    if (f.totalDigits !== undefined) o.push(`td: ${f.totalDigits}`);
    if (f.fractionDigits !== undefined) o.push(`fd: ${f.fractionDigits}`);
    if (f.minInclusive !== undefined) o.push(`mi: ${lit(f.minInclusive)}`);
    if (f.maxInclusive !== undefined) o.push(`ma: ${lit(f.maxInclusive)}`);
    if (f.minExclusive !== undefined) o.push(`me: ${lit(f.minExclusive)}`);
    if (f.maxExclusive !== undefined) o.push(`mxe: ${lit(f.maxExclusive)}`);
    const builtinWs = s.builtin === 'string' ? 'preserve' : s.builtin === 'normalizedString' ? 'replace' : 'collapse';
    if (f.whiteSpace && f.whiteSpace !== builtinWs) o.push(`ws: ${lit(WS[f.whiteSpace] ?? 'p')}`);
    const nm = s.name ?? s.chain[0];
    if (nm) o.push(`nm: ${lit(nm)}`);
    return `{ ${o.join(', ')} }`;
  };
  const stRef = (s: SimpleIR): string => {
    const expr = stExpr(s);
    const found = stNames.get(expr);
    if (found) return found;
    const name = s.name && !used.has(`st_${ident(s.name)}`) ? `st_${ident(s.name)}` : `st$${anon++}`;
    claim(name, 'descritor simples');
    stNames.set(expr, name);
    stDecls.push(`const ${name}: SimpleType = ${expr};`);
    return name;
  };

  // ---------- tipos TS dos valores ----------
  const typeDecls: string[] = [];
  const namedSimpleEmitted = new Set<string>();
  const valueType = (s: SimpleIR): string => {
    if (!s.facets.enumeration) return 'string';
    const u = s.facets.enumeration.map(lit).join(' | ');
    if (!s.name) return u;
    const tn = ident(s.name);
    if (!namedSimpleEmitted.has(s.name)) {
      namedSimpleEmitted.add(s.name);
      claim(tn, 'enumeração nomeada');
      typeDecls.push(`${jsdoc([s.doc, facetSummary(s)], '')}export type ${tn} = ${u};\n`);
    }
    return tn;
  };
  const refType = (t: TypeRef): string => ('ref' in t ? ident(t.ref) : valueType(t));

  interface Shape {
    members: string[];
    unions: string[];
    names: string[];
  }
  const shapeOf = (p: ParticleIR, forceOptional: boolean, forceArray: boolean): Shape => {
    if (p.k === 'any') {
      const opt = forceOptional || p.min === 0;
      return {
        members: [
          `  /** Conteúdo de \`xs:any\` (processContents skip), como XML bruto em ordem. */\n  $any${opt ? '?' : ''}: string[];`,
        ],
        unions: [],
        names: ['$any'],
      };
    }
    if (p.k === 'el') {
      const arr = forceArray || p.max > 1;
      const opt = forceOptional || p.min === 0;
      const t = refType(p.type);
      const ty = arr ? (t.includes('|') ? `(${t})[]` : `${t}[]`) : t;
      const card = arr ? `ocorre ${p.min}..${p.max === Number.POSITIVE_INFINITY ? 'n' : p.max}` : undefined;
      const doc = jsdoc([p.doc, 'ref' in p.type ? undefined : facetSummary(p.type), card], '  ');
      return { members: [`${doc}  ${propKey(p.name)}${opt ? '?' : ''}: ${ty};`], unions: [], names: [p.name] };
    }
    const rep = p.max > 1;
    if (p.k === 'seq') {
      const parts = p.items.map((i) => shapeOf(i, forceOptional || p.min === 0, forceArray || rep));
      return {
        members: parts.flatMap((x) => x.members),
        unions: parts.flatMap((x) => x.unions),
        names: parts.flatMap((x) => x.names),
      };
    }
    if (rep || forceArray) {
      // choice repetível: sem exclusividade no tipo (não aparece nos leiautes atuais; fica como alternativa segura)
      const parts = p.items.map((i) => shapeOf(i, true, true));
      return {
        members: parts.flatMap((x) => x.members),
        unions: parts.flatMap((x) => x.unions),
        names: parts.flatMap((x) => x.names),
      };
    }
    const branches = p.items.map((i) => shapeOf(i, false, false));
    const all = [...new Set(branches.flatMap((b) => b.names))];
    const term = (b: Shape): string => {
      const nevers = all.filter((n) => !b.names.includes(n)).map((n) => `${propKey(n)}?: never`);
      const obj = `{\n${b.members.join('\n')}${nevers.length > 0 ? `\n  ${nevers.join('; ')};` : ''}\n}`;
      return [obj, ...b.unions.map((u) => `(${u})`)].join(' & ');
    };
    const terms = branches.map(term);
    if (p.min === 0 || forceOptional) terms.push(`{ ${all.map((n) => `${propKey(n)}?: never`).join('; ')} }`);
    return { members: [], unions: [terms.map((t) => `(${t})`).join('\n  | ')], names: all };
  };

  // ---------- descritores complexos, em ordem de dependência ----------
  const ctDecls: string[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const ctRef = (id: string): string => {
    const c = ir.complex[id];
    if (!c) throw new Error(`${ir.subpath}: tipo complexo ${id} ausente na IR`);
    if (!done.has(id)) emitComplex(c);
    return ident(id);
  };
  const occ = (min: number, max: number): string =>
    `${min !== 1 ? `, n: ${min}` : ''}${max !== 1 ? `, x: ${max === Number.POSITIVE_INFINITY ? -1 : max}` : ''}`;
  const particleExpr = (p: ParticleIR, ownerNs: string): string => {
    if (p.k === 'any') return `{ w: 1${occ(p.min, p.max)} }`;
    if (p.k === 'el') {
      const t = 'ref' in p.type ? ctRef(p.type.ref) : stRef(p.type);
      const u = p.unique ? `, u: ${JSON.stringify(p.unique)}` : '';
      return `{ e: ${lit(p.name)}, t: ${t}${occ(p.min, p.max)}${p.ns !== ownerNs ? `, ns: ${lit(p.ns)}` : ''}${u} }`;
    }
    const items = p.items.map((i) => particleExpr(i, ownerNs)).join(', ');
    return `{ g: ${lit(p.k === 'seq' ? 's' : 'c')}, i: [${items}]${occ(p.min, p.max)} }`;
  };
  const attrExpr = (a: AttrIR): string =>
    `{ a: ${lit(a.name)}, t: ${stRef(a.type)}${a.required ? ', r: 1' : ''}${a.fixed !== undefined ? `, f: ${lit(a.fixed)}` : ''} }`;

  const checkNames = (c: ComplexIR): void => {
    const seen = new Map<string, string>();
    const walk = (p: ParticleIR): void => {
      if (p.k === 'any') {
        if (seen.has('$any')) throw new Error(`${ir.subpath}: ${c.id} tem mais de um xs:any`);
        seen.set('$any', '');
      } else if (p.k === 'el') {
        const key = 'ref' in p.type ? `ref:${p.type.ref}` : stExpr(p.type);
        const prev = seen.get(p.name);
        if (prev !== undefined && prev !== key) {
          throw new Error(`${ir.subpath}: ${c.id} declara ${p.name} duas vezes com tipos diferentes`);
        }
        seen.set(p.name, key);
      } else for (const i of p.items) walk(i);
    };
    if (c.content) walk(c.content);
  };

  function emitComplex(c: ComplexIR): void {
    if (done.has(c.id)) return;
    if (visiting.has(c.id)) throw new Error(`${ir.subpath}: ciclo de tipos em ${c.id}`);
    visiting.add(c.id);
    checkNames(c);
    const body: string[] = [`id: ${lit(c.id)}`, `ns: ${lit(c.ns)}`];
    if (c.attrs.length > 0) body.push(`a: [${c.attrs.map(attrExpr).join(', ')}]`);
    if (c.content) body.push(`c: ${particleExpr(c.content, c.ns)}`);
    if (c.text) body.push(`tx: ${stRef(c.text)}`);
    if (c.anyAttribute) body.push('aa: 1');
    visiting.delete(c.id);
    done.add(c.id);
    const name = claim(ident(c.id), 'tipo complexo');
    ctDecls.push(`export const ${name}: ComplexType<${name}> = { ${body.join(', ')} };`);

    const members: string[] = [];
    for (const a of c.attrs) {
      const t = a.fixed !== undefined ? lit(a.fixed) : valueType(a.type);
      const doc = jsdoc([a.doc, `@attribute ${facetSummary(a.type) ?? ''}`], '  ');
      members.push(`${doc}  ${propKey(a.name)}${a.required ? '' : '?'}: ${t};`);
    }
    if (c.anyAttribute)
      members.push(
        '  /** Atributos de `xs:anyAttribute` (processContents skip). */\n  $attrs?: Record<string, string>;',
      );
    if (c.text) members.push('  $text: string;');
    let unions: string[] = [];
    if (c.content) {
      const sh = shapeOf(c.content, false, false);
      members.push(...sh.members);
      unions = sh.unions;
    }
    const obj = `{\n${members.join('\n')}\n}`;
    const def = [obj, ...unions.map((u) => `(\n  ${u}\n)`)].join(' & ');
    typeDecls.push(
      `${jsdoc([c.doc, `xsd: ${c.anonymous ? 'tipo anônimo de ' : ''}${c.id}`], '')}export type ${name} = ${def};\n`,
    );
  }

  for (const id of Object.keys(ir.complex)) {
    const c = ir.complex[id];
    if (c) emitComplex(c);
  }

  const roots = ir.roots.map((r) => {
    const n = claim(`${ident(r.name)}Element`, 'elemento raiz');
    const t = ident(r.type);
    return `${jsdoc([`Elemento raiz \`${r.name}\` (tipo ${r.type}).`], '')}export const ${n}: ElementoRaiz<${t}> = { nome: ${lit(r.name)}, ns: ${lit(r.ns)}, tipo: ${t} };`;
  });
  claim('schema', 'metadados');
  const info = {
    subpath: ir.subpath,
    documento: opts.documento,
    pl: ir.pl,
    fontes: opts.fontes,
    ...(opts.patches ? { ajustes: opts.patches } : {}),
  };

  const out: string[] = [];
  out.push('// biome-ignore-all format: código gerado');
  out.push('// biome-ignore-all lint: código gerado');
  out.push(
    `/**\n * GERADO por tools/xsd-codegen a partir de ${ir.pl}. Não edite: rode \`bun run --cwd tools/xsd-codegen gen\`.\n *\n${opts.description
      .split('\n')
      .map((l) => ` * ${l}`.trimEnd())
      .join('\n')}\n *\n * Fontes (conteúdo oficial, sha256 em tools/xsd-codegen/xsd/<pacote>/SOURCE.md):\n${opts.fontes
      .map((f) => ` * - ${f.pacote} (${f.arquivo})`)
      .join('\n')}${
      opts.patches
        ? `\n *\n * Correções sobre o XSD oficial (schema.ajustes):\n${opts.patches
            .map((p) => ` * - ${p.tipo}: pattern \`${p.de}\` gerado como \`${p.para}\``)
            .join('\n')}`
        : ''
    }\n */`,
  );
  out.push(
    `import type { ComplexType, DescricaoModuloSchema, ElementoRaiz, SimpleType } from ${lit(opts.runtimeImport)};\n`,
  );
  out.push(
    `/** Proveniência deste módulo. */\nexport const schema: DescricaoModuloSchema = ${JSON.stringify(info, null, 2)};\n`,
  );
  out.push('// ---------- tipos ----------\n');
  out.push(...typeDecls);
  out.push('\n// ---------- descritores de tipo simples ----------');
  out.push(...stDecls);
  out.push('\n// ---------- descritores de tipo complexo (ordem do XSD) ----------');
  out.push(...ctDecls);
  out.push('\n// ---------- elementos raiz ----------');
  out.push(...roots);
  const code = `${out.join('\n')}\n`;
  return { code, stats: { complexTypes: done.size, simpleDescriptors: stDecls.length, bytes: code.length } };
}
