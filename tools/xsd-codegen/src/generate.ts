/**
 * Gera todos os módulos de `MODULES`: IR em `tools/xsd-codegen/ir/<subpath>.json`, módulo TS em
 * `packages/schemas/src/<subpath>.ts` e o bloco `exports` do `packages/schemas/package.json`. Antes, confere que
 * cada XSD usado bate com o sha256 do `SOURCE.md` do pacote.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { compilarRegexXsd } from '../../../packages/schemas/src/runtime/regex.ts';
import type { EmitSource } from './emit.ts';
import { emitModule } from './emit.ts';
import type { ParticleIR, SchemaIR, SimpleIR } from './ir.ts';
import type { ModuleSpec } from './modules.ts';
import { MODULES } from './modules.ts';
import { buildIR } from './xsd.ts';

export const toolDir: string = path.resolve(import.meta.dir, '..');
export const repoRoot: string = path.resolve(toolDir, '../..');
export const xsdDir: string = path.join(toolDir, 'xsd');
const schemasDir = path.join(repoRoot, 'packages/schemas');

export interface SourceInfo extends EmitSource {
  /** Arquivo relativo à pasta do pacote para sha256. */
  readonly files: ReadonlyMap<string, string>;
}

/** Lê o SOURCE.md de um pacote: zip, sha256, URL de download e o sha256 de cada arquivo extraído. */
export function readSource(pacote: string): SourceInfo {
  const md = readFileSync(path.join(xsdDir, pacote, 'SOURCE.md'), 'utf8');
  const zip = /Arquivo baixado: `([^`]+)` \(sha256 `([0-9a-f]{64})`\)/.exec(md);
  const url = /^- Download: (\S+)$/m.exec(md);
  if (!zip || !url) throw new Error(`${pacote}/SOURCE.md sem arquivo, sha256 ou download`);
  const files = new Map<string, string>();
  for (const m of md.matchAll(/^([0-9a-f]{64}) {2}(.+)$/gm)) files.set(m[2] as string, m[1] as string);
  return { pacote, arquivo: zip[1] as string, sha256: zip[2] as string, url: url[1] as string, files };
}

/** Confere o sha256 de cada arquivo listado no SOURCE.md. Devolve os divergentes. */
export function verifySource(src: SourceInfo): string[] {
  const bad: string[] = [];
  for (const [rel, sha] of src.files) {
    const got = createHash('sha256')
      .update(readFileSync(path.join(xsdDir, src.pacote, rel)))
      .digest('hex');
    if (got !== sha) bad.push(`${src.pacote}/${rel}`);
  }
  return bad;
}

function checkPatterns(ir: SchemaIR): void {
  const seen = new Set<string>();
  const visit = (s: SimpleIR): void => {
    for (const step of s.facets.patterns ?? []) {
      for (const p of step) {
        if (seen.has(p)) continue;
        seen.add(p);
        compilarRegexXsd(p);
      }
    }
  };
  const walk = (p: ParticleIR): void => {
    if (p.k === 'el') {
      if (!('ref' in p.type)) visit(p.type);
    } else if (p.k !== 'any') for (const i of p.items) walk(i);
  };
  for (const c of Object.values(ir.complex)) {
    for (const a of c.attrs) visit(a.type);
    if (c.text) visit(c.text);
    if (c.content) walk(c.content);
  }
}

export interface Generated {
  /** Caminho absoluto para conteúdo. */
  readonly files: Map<string, string>;
  readonly stats: Record<string, unknown>[];
}

export function irToJson(ir: SchemaIR): string {
  return `${JSON.stringify(ir, (_k, v) => (v === Number.POSITIVE_INFINITY ? 'unbounded' : v), 1)}\n`;
}

export function generateModule(spec: ModuleSpec): { ir: SchemaIR; code: string; stats: Record<string, unknown> } {
  const fontes = spec.pacotes.map(readSource);
  for (const f of fontes) {
    const bad = verifySource(f);
    if (bad.length > 0) throw new Error(`sha256 diverge do SOURCE.md: ${bad.join(', ')}`);
  }
  const abs = (p: string): string => path.join(xsdDir, p);
  const overrides = Object.fromEntries(
    Object.entries(spec.overrides ?? {}).map(([k, v]) => [k, { entry: abs(v.entry), element: v.element }]),
  );
  const ir = buildIR({
    subpath: spec.subpath,
    pl: spec.pl,
    entries: spec.entries.map(abs),
    roots: spec.roots,
    ...(spec.anyBindings ? { anyBindings: spec.anyBindings } : {}),
    overrides,
    missingImports: Object.fromEntries(Object.entries(spec.missingImports ?? {}).map(([k, v]) => [k, abs(v)])),
    ...(spec.untypedAsText ? { untypedAsText: spec.untypedAsText } : {}),
    ...(spec.opaqueElements ? { opaqueElements: spec.opaqueElements } : {}),
    replaceImports: Object.fromEntries(Object.entries(spec.replaceImports ?? {}).map(([k, v]) => [k, abs(v.por)])),
    ...(spec.patches
      ? { patternPatches: Object.fromEntries(spec.patches.map((p) => [p.tipo, { de: p.de, para: p.para }])) }
      : {}),
  });
  if (spec.patches) ir.patches = spec.patches.map((p) => ({ ...p }));
  if (ir.unsupported.length > 0) {
    throw new Error(`${spec.subpath}: construções fora do subconjunto suportado:\n  ${ir.unsupported.join('\n  ')}`);
  }
  checkPatterns(ir);
  const depth = spec.subpath.split('/').length - 1;
  const { code, stats } = emitModule(ir, {
    documento: spec.documento,
    runtimeImport: `${'../'.repeat(depth)}runtime/desc.ts`,
    fontes: fontes.map(({ files: _f, ...rest }) => rest),
    ...(spec.patches ? { patches: spec.patches } : {}),
    description: spec.description,
  });
  return { ir, code, stats: { subpath: spec.subpath, ...stats } };
}

export function generateAll(): Generated {
  const files = new Map<string, string>();
  const stats: Record<string, unknown>[] = [];
  const exportsMap: Record<string, unknown> = {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
  };
  for (const spec of MODULES) {
    const t0 = performance.now();
    const { ir, code, stats: s } = generateModule(spec);
    files.set(path.join(toolDir, 'ir', `${spec.subpath}.json`), irToJson(ir));
    files.set(path.join(schemasDir, 'src', `${spec.subpath}.ts`), code);
    exportsMap[`./${spec.subpath}`] = { types: `./dist/${spec.subpath}.d.ts`, default: `./dist/${spec.subpath}.js` };
    stats.push({ ...s, ms: Math.round(performance.now() - t0) });
  }
  exportsMap['./package.json'] = './package.json';
  const pkgFile = path.join(schemasDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as Record<string, unknown>;
  pkg.exports = exportsMap;
  files.set(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  return { files, stats };
}
