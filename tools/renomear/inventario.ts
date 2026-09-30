#!/usr/bin/env bun
/**
 * Inventário da API pública de pacotes, para escrever o mapa de uma fase: nomes exportados, membros de interfaces,
 * classes e tipos, parâmetros (posicionais e de opções), valores de união literal. Uma linha por item, em JSON.
 *
 * Uso: `bun tools/renomear/inventario.ts <pacote>... [--json <saida.json>]`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript-ls';
import type { ExportTarget } from '../../scripts/lib/workspace.ts';
import { root, workspacePackages } from '../../scripts/lib/workspace.ts';

const args = process.argv.slice(2);
const iJson = args.indexOf('--json');
const saida = iJson >= 0 ? args[iJson + 1] : undefined;
const pedidos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');

function alvos(t: ExportTarget | undefined, out: string[] = []): string[] {
  if (t === undefined || t === null) return out;
  if (typeof t === 'string') out.push(t);
  else for (const v of Object.values(t)) alvos(v as ExportTarget, out);
  return out;
}
const paths: Record<string, string[]> = {};
const entradas: { pacote: string; sub: string; arquivo: string }[] = [];
for (const { dir, manifest } of await workspacePackages()) {
  for (const [sub, t] of Object.entries(manifest.exports ?? {})) {
    const srcs = [
      ...new Set(
        alvos(t)
          .filter((a) => a.startsWith('./dist/'))
          .map((a) => path.join(dir, a.replace('./dist/', 'src/').replace(/\.d\.ts$|\.js$/, '.ts')))
          .filter((f) => existsSync(f)),
      ),
    ];
    if (srcs.length === 0) continue;
    const nome = sub === '.' ? manifest.name : `${manifest.name}${sub.slice(1)}`;
    paths[nome] = [srcs[0] ?? ''];
    if (pedidos.includes(manifest.name.replace('@sinete/', '')))
      for (const f of srcs) entradas.push({ pacote: manifest.name, sub, arquivo: f });
  }
}
const base = ts.parseConfigFileTextToJson(
  'tsconfig.base.json',
  readFileSync(path.join(root, 'tsconfig.base.json'), 'utf8'),
);
const { options } = ts.convertCompilerOptionsFromJson(base.config.compilerOptions, root);
const programa = ts.createProgram(
  entradas.map((e) => e.arquivo),
  {
    ...options,
    types: ['bun'],
    typeRoots: [path.join(root, 'node_modules/@types')],
    customConditions: ['node'],
    paths,
    noEmit: true,
    isolatedDeclarations: false,
  },
);
const checker = programa.getTypeChecker();

interface Item {
  readonly pacote: string;
  readonly sub: string;
  readonly arquivo: string;
  readonly linha: number;
  readonly tipo?: string;
  readonly nome: string;
  readonly categoria: string;
  readonly detalhe?: string;
}
const itens: Item[] = [];
const vistos = new Set<string>();
const onde = (n: ts.Node): [string, number] => {
  const sf = n.getSourceFile();
  return [path.relative(root, sf.fileName), sf.getLineAndCharacterOfPosition(n.getStart()).line + 1];
};
const nomeDe = (n: ts.Node | undefined): string | undefined =>
  n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isPrivateIdentifier(n)) ? n.text : undefined;
const doRepo = (n: ts.Node): boolean => {
  const f = n.getSourceFile().fileName;
  return f.startsWith(path.join(root, 'packages')) && !f.includes('/node_modules/');
};

function add(
  ctx: { pacote: string; sub: string },
  n: ts.Node,
  nome: string,
  categoria: string,
  tipo?: string,
  detalhe?: string,
): void {
  const [arquivo, linha] = onde(n);
  const chave = `${arquivo}:${linha}:${tipo}:${nome}:${categoria}`;
  if (vistos.has(chave)) return;
  vistos.add(chave);
  itens.push({
    pacote: ctx.pacote,
    sub: ctx.sub,
    arquivo,
    linha,
    ...(tipo ? { tipo } : {}),
    nome,
    categoria,
    ...(detalhe ? { detalhe } : {}),
  });
}

function literais(ctx: { pacote: string; sub: string }, t: ts.TypeNode | undefined, dono: string, n: ts.Node): void {
  if (!t) return;
  const vals: string[] = [];
  const junta = (x: ts.TypeNode): void => {
    if (ts.isUnionTypeNode(x)) x.types.forEach(junta);
    else if (ts.isLiteralTypeNode(x) && ts.isStringLiteral(x.literal)) vals.push(x.literal.text);
    else if (ts.isParenthesizedTypeNode(x)) junta(x.type);
  };
  junta(t);
  if (vals.length > 0) add(ctx, n, vals.join(' | '), 'literais', dono);
}

function membrosDoTipo(ctx: { pacote: string; sub: string }, t: ts.TypeNode | undefined, dono: string, prof = 0): void {
  if (!t || prof > 3) return;
  if (ts.isTypeLiteralNode(t)) for (const m of t.members) membro(ctx, m, dono, prof + 1);
  else if (ts.isUnionTypeNode(t) || ts.isIntersectionTypeNode(t))
    for (const x of t.types) membrosDoTipo(ctx, x, dono, prof);
  else if (ts.isParenthesizedTypeNode(t) || ts.isTypeOperatorNode(t)) membrosDoTipo(ctx, t.type, dono, prof);
  // Lista e argumento de tipo (`readonly { code: string }[]`, `Readonly<Record<string, { url: string }>>`): o membro é
  // do item, com o mesmo dono.
  else if (ts.isArrayTypeNode(t)) membrosDoTipo(ctx, t.elementType, dono, prof);
  else if (ts.isTypeReferenceNode(t)) for (const x of t.typeArguments ?? []) membrosDoTipo(ctx, x, dono, prof);
  else if (ts.isFunctionTypeNode(t)) {
    t.parameters.forEach((p) => {
      parametro(ctx, p, dono, prof + 1);
    });
    membrosDoTipo(ctx, t.type, `${dono}@retorno`, prof + 1);
  }
  literais(ctx, t, dono, t);
}

function parametro(ctx: { pacote: string; sub: string }, p: ts.ParameterDeclaration, dono: string, prof: number): void {
  const n = nomeDe(p.name);
  if (n === undefined) return;
  add(ctx, p, n, 'parametro', dono);
  membrosDoTipo(ctx, p.type, `${dono}.${n}`, prof);
}

function membro(ctx: { pacote: string; sub: string }, m: ts.Node, dono: string, prof: number): void {
  if (ts.isPropertySignature(m) || ts.isPropertyDeclaration(m)) {
    if (m.modifiers?.some((x) => x.kind === ts.SyntaxKind.PrivateKeyword || x.kind === ts.SyntaxKind.ProtectedKeyword))
      return;
    const n = nomeDe(m.name);
    if (n === undefined || ts.isPrivateIdentifier(m.name)) return;
    add(ctx, m, n, 'membro', dono);
    membrosDoTipo(ctx, m.type, `${dono}.${n}`, prof);
  } else if (ts.isMethodSignature(m) || ts.isMethodDeclaration(m)) {
    if (m.modifiers?.some((x) => x.kind === ts.SyntaxKind.PrivateKeyword || x.kind === ts.SyntaxKind.ProtectedKeyword))
      return;
    const n = nomeDe(m.name);
    if (n === undefined || ts.isPrivateIdentifier(m.name)) return;
    add(ctx, m, n, 'metodo', dono);
    m.parameters.forEach((p) => {
      parametro(ctx, p, `${dono}.${n}`, prof);
    });
    membrosDoTipo(ctx, m.type, `${dono}.${n}@retorno`, prof);
  } else if (ts.isConstructorDeclaration(m)) {
    m.parameters.forEach((p) => {
      parametro(ctx, p, `${dono}.constructor`, prof);
    });
  } else if (ts.isGetAccessor(m)) {
    const n = nomeDe(m.name);
    if (n) add(ctx, m, n, 'membro', dono);
  }
}

for (const e of entradas) {
  const sf = programa.getSourceFile(e.arquivo);
  if (!sf) continue;
  const mod = checker.getSymbolAtLocation(sf);
  if (!mod) continue;
  const ctx = { pacote: e.pacote, sub: e.sub };
  for (const exp of checker.getExportsOfModule(mod)) {
    let s = exp;
    if (s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
    for (const d of s.declarations ?? []) {
      if (!doRepo(d)) continue;
      const nome = exp.getName();
      const kind = ts.SyntaxKind[d.kind];
      const reexport = !d
        .getSourceFile()
        .fileName.includes(`/packages/${e.pacote.replace('@sinete/', '').replace(/^sinete$/, 'sinete')}/`);
      add(ctx, d, nome, reexport ? 'reexport' : 'topo', undefined, kind);
      if (reexport) continue;
      if (ts.isFunctionDeclaration(d)) {
        d.parameters.forEach((p) => {
          parametro(ctx, p, nome, 0);
        });
        membrosDoTipo(ctx, d.type, `${nome}@retorno`, 0);
      } else if (ts.isInterfaceDeclaration(d) || ts.isClassDeclaration(d)) {
        for (const m of d.members) membro(ctx, m, nome, 0);
      } else if (ts.isTypeAliasDeclaration(d)) {
        membrosDoTipo(ctx, d.type, nome, 0);
      } else if (ts.isVariableDeclaration(d)) {
        if (d.type) membrosDoTipo(ctx, d.type, nome, 0);
        const init = d.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)))
          init.parameters.forEach((p) => {
            parametro(ctx, p, nome, 0);
          });
      }
    }
  }
}
if (saida) writeFileSync(saida, `${JSON.stringify(itens, null, 1)}\n`);
console.error(`inventário: ${itens.length} itens em ${entradas.length} entradas`);
