#!/usr/bin/env bun
/**
 * Aplica um mapa de renomeação da API pública (ADR 0015) pelo serviço de renomeação do TypeScript.
 *
 * Um programa só, com o `src` e o `test` de todos os pacotes, `tools/`, `scripts/`, `smoke/` e os blocos ```ts dos
 * READMEs e do guia (cada bloco vira um módulo virtual, e a edição volta para a linha do Markdown). `@sinete/*`, os
 * subpaths e o guarda-chuva `sinete/*` resolvem para o `src` de cada pacote, então a renomeação atravessa os pacotes.
 *
 * O TypeScript 7 do repo não tem language service em JavaScript; a ferramenta usa o 5.9 (`typescript-ls`), que só
 * resolve referências e não substitui o `tsc` do typecheck.
 *
 * Três listas no mapa:
 * - `simbolos`: declarações achadas pelo arquivo e pelo nome (e, para membros, pelo tipo que os declara), renomeadas
 *   com `findRenameLocations`. `tipo` pode ser uma lista, ou uma união: os membros de mesmo nome de todos os tipos são
 *   renomeados juntos, sobre o mesmo estado do programa.
 * - `literais`: valores de união literal (`'authorized'`) e textos como o `name` de uma classe de erro. Só muda o
 *   literal ligado ao tipo pelo verificador (a propriedade comparada, atribuída ou do objeto literal tem a declaração do
 *   mapa entre as suas raízes, ou o tipo esperado é uma união com dois ou mais valores do mesmo grupo). O resto sai no
 *   relatório, sem mudança.
 * - `chavesDeDados`: chaves de JSON de dados, por caminho (`rejeicoes[].effect`, `ufs.*.variants[].checks[].weights`).
 *
 * Uso: `bun tools/renomear/renomear.ts <mapa.json>... [--simular] [--relatorio <arquivo.md>]`. Com `--simular`, tudo roda
 * em memória e nada é gravado. Sem ele, grava e roda `bunx biome check --write` nos arquivos tocados.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { $, Glob } from 'bun';
import ts from 'typescript-ls';
import { blocosDeCodigo, GUIA, paginasDoGuia } from '../../scripts/lib/docs.ts';
import type { ExportTarget } from '../../scripts/lib/workspace.ts';
import { root, workspacePackages } from '../../scripts/lib/workspace.ts';

// ---------------------------------------------------------------------------------------------------------------------
// Mapa

interface EntradaSimbolo {
  /** Arquivo da declaração, relativo à raiz do repo. */
  readonly arquivo: string;
  /** Tipo (interface, classe, alias, variável ou função) que declara o membro; ausente para nome exportado. */
  readonly tipo?: string | readonly string[];
  /** Nome atual. Para membros aninhados, caminho com pontos (`opcoes.path`, parâmetro e depois membro). */
  readonly nome: string;
  readonly novo: string;
}

interface EntradaLiteral {
  readonly arquivo: string;
  readonly tipo: string | readonly string[];
  /** Propriedade que tem o literal; ausente, `tipo` é o alias da própria união (`VerifyFailure`). */
  readonly propriedade?: string;
  readonly antigo: string;
  readonly novo: string;
  /** Outros valores do mesmo grupo (`rejected`, `denied`...): uma união esperada com dois deles identifica o grupo. */
  readonly grupo?: readonly string[];
}

interface EntradaChave {
  /** Arquivo JSON, relativo à raiz. */
  readonly arquivo: string;
  /** Caminho do objeto que contém a chave: `*` é qualquer chave, `[]` qualquer item. Vazio é a raiz. */
  readonly caminho: string;
  readonly antigo: string;
  readonly novo: string;
}

interface EntradaValor {
  readonly arquivo: string;
  readonly caminho: string;
  /** Chave cujo valor (texto) muda, já com o nome depois de `chavesDeDados`. */
  readonly chave: string;
  readonly antigo: string;
  readonly novo: string;
}

interface Mapa {
  readonly pacote: string;
  readonly simbolos?: readonly EntradaSimbolo[];
  readonly literais?: readonly EntradaLiteral[];
  readonly chavesDeDados?: readonly EntradaChave[];
  readonly valoresDeDados?: readonly EntradaValor[];
}

// ---------------------------------------------------------------------------------------------------------------------
// Argumentos

const args = process.argv.slice(2);
const simular = args.includes('--simular');
const iRel = args.indexOf('--relatorio');
const arquivoRelatorio = iRel >= 0 ? args[iRel + 1] : undefined;
const arquivosMapa = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--relatorio');
if (arquivosMapa.length === 0) {
  console.error('uso: bun tools/renomear/renomear.ts <mapa.json>... [--simular] [--relatorio <arquivo.md>]');
  process.exit(2);
}
// Vários mapas (os pacotes de uma fase, na ordem do ADR) rodam como um só: símbolos de todos, depois literais, chaves e
// valores. Os literais já veem todos os nomes novos, e as chaves de JSON não dependem da ordem dos símbolos.
const mapas = arquivosMapa.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Mapa);
const mapa: Mapa = {
  pacote: mapas.map((m) => m.pacote).join(', '),
  simbolos: mapas.flatMap((m) => m.simbolos ?? []),
  literais: mapas.flatMap((m) => m.literais ?? []),
  chavesDeDados: mapas.flatMap((m) => m.chavesDeDados ?? []),
  valoresDeDados: mapas.flatMap((m) => m.valoresDeDados ?? []),
};

// ---------------------------------------------------------------------------------------------------------------------
// Arquivos e estado em memória

const abs = (p: string): string => (path.isAbsolute(p) ? p : path.join(root, p));
const relativo = (p: string): string => path.relative(root, p);

/** Conteúdo atual de cada arquivo real tocado ou lido. */
const conteudo = new Map<string, string>();
const versao = new Map<string, number>();
const tocados = new Set<string>();

function ler(arquivo: string): string {
  let t = conteudo.get(arquivo);
  if (t === undefined) {
    t = readFileSync(arquivo, 'utf8');
    conteudo.set(arquivo, t);
  }
  return t;
}

function gravar(arquivo: string, texto: string): void {
  if (ler(arquivo) === texto) return;
  conteudo.set(arquivo, texto);
  versao.set(arquivo, (versao.get(arquivo) ?? 0) + 1);
  tocados.add(arquivo);
}

async function varrer(padrao: string): Promise<string[]> {
  const out: string[] = [];
  for await (const f of new Glob(padrao).scan({ cwd: root })) {
    if (f.includes('node_modules/') || f.includes('/dist/') || f.endsWith('.d.ts')) continue;
    out.push(path.join(root, f));
  }
  return out;
}

const arquivosTs = [
  ...(await varrer('packages/*/src/**/*.ts')),
  ...(await varrer('packages/*/test/**/*.ts')),
  ...(await varrer('tools/**/*.ts')),
  ...(await varrer('scripts/**/*.ts')),
  ...(await varrer('smoke/*.ts')),
  // As fixtures da smoke consomem a API como quem instalou do npm, em TypeScript, ESM e CommonJS.
  ...(await varrer('smoke/fixtures/**/*.{ts,mjs,cjs}')),
  ...(await varrer('helpers/*/scripts/**/*.ts')),
].sort();

// Blocos ```ts dos READMEs e do guia, cada um (ou cada sequência `continua`) como um módulo virtual.
const markdowns = [
  path.join(root, 'README.md'),
  ...(await varrer('packages/*/README.md')),
  ...(await paginasDoGuia()).map((f) => path.join(GUIA, f)),
];

interface Virtual {
  readonly md: string;
  /** Linha do Markdown (a partir de 0) de cada linha do módulo. */
  readonly linhas: number[];
}
const virtuais = new Map<string, Virtual>();
const DIR_VIRTUAL = path.join(root, '.renomear');

function modulosDoMarkdown(md: string): Map<string, { texto: string; linhas: number[] }> {
  const out = new Map<string, { texto: string; linhas: number[] }>();
  let anterior: { nome: string; corpo: string[]; linhas: number[] } | undefined;
  for (const b of blocosDeCodigo(ler(md))) {
    if (!['ts', 'typescript'].includes(b.lang)) continue;
    let m = b.marcas.includes('continua') ? anterior : undefined;
    if (m === undefined) {
      m = {
        nome: path.join(DIR_VIRTUAL, `${relativo(md).replaceAll('/', '-')}-${b.inicio}.ts`),
        corpo: [],
        linhas: [],
      };
      anterior = m;
    }
    // `inicio` é a linha do Markdown (a partir de 1) da primeira linha do corpo.
    for (const [i, l] of b.corpo.entries()) {
      m.corpo.push(l);
      m.linhas.push(b.inicio - 1 + i);
    }
    out.set(m.nome, { texto: m.corpo.join('\n'), linhas: m.linhas });
  }
  return out;
}

const textoVirtual = new Map<string, string>();
function montarVirtuais(md: string): void {
  for (const [nome, { texto, linhas }] of modulosDoMarkdown(md)) {
    if (textoVirtual.get(nome) !== texto) versao.set(nome, (versao.get(nome) ?? 0) + 1);
    textoVirtual.set(nome, texto);
    virtuais.set(nome, { md, linhas });
  }
}
for (const md of markdowns) montarVirtuais(md);

// ---------------------------------------------------------------------------------------------------------------------
// Opções do compilador: a base do repo, mais `paths` do nome de cada pacote para o `src`

const base = ts.parseConfigFileTextToJson(
  'tsconfig.base.json',
  readFileSync(path.join(root, 'tsconfig.base.json'), 'utf8'),
);
const { options: opcoesBase } = ts.convertCompilerOptionsFromJson(base.config.compilerOptions, root);

function alvoDoExport(t: ExportTarget | undefined): string | undefined {
  if (t === undefined || t === null) return undefined;
  if (typeof t === 'string') return t;
  return alvoDoExport(t.node) ?? alvoDoExport(t.types) ?? alvoDoExport(t.default);
}

const paths: Record<string, string[]> = {};
for (const { dir, manifest } of await workspacePackages()) {
  for (const [sub, t] of Object.entries(manifest.exports ?? {})) {
    const alvo = alvoDoExport(t);
    if (alvo === undefined || !alvo.startsWith('./dist/')) continue;
    const src = path.join(dir, alvo.replace('./dist/', 'src/').replace(/\.d\.ts$|\.js$/, '.ts'));
    if (!existsSync(src)) continue;
    const nome = sub === '.' ? manifest.name : `${manifest.name}${sub.slice(1)}`;
    paths[nome] = [src];
    // Guarda-chuva: `sinete/core` e `sinete/core/xml` reexportam `@sinete/core` e `@sinete/core/xml`.
    if (manifest.name.startsWith('@sinete/')) paths[`sinete/${nome.slice('@sinete/'.length)}`] = [src];
  }
}

const opcoes: ts.CompilerOptions = {
  ...opcoesBase,
  types: ['bun'],
  typeRoots: [path.join(root, 'node_modules/@types')],
  customConditions: ['node'],
  paths,
  noEmit: true,
  allowJs: true,
  checkJs: false,
  isolatedDeclarations: false,
};

// ---------------------------------------------------------------------------------------------------------------------
// Language service

const nomesDoPrograma = (): string[] => [...arquivosTs, ...textoVirtual.keys()];

function textoDe(arquivo: string): string | undefined {
  const v = textoVirtual.get(arquivo);
  if (v !== undefined) return v;
  if (conteudo.has(arquivo)) return conteudo.get(arquivo);
  return existsSync(arquivo) ? ler(arquivo) : undefined;
}

const host: ts.LanguageServiceHost = {
  getCompilationSettings: () => opcoes,
  getScriptFileNames: nomesDoPrograma,
  getScriptVersion: (f) => String(versao.get(f) ?? 0),
  getScriptSnapshot: (f) => {
    const t = textoDe(f);
    return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t);
  },
  getCurrentDirectory: () => root,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: (f) => textoVirtual.has(f) || conteudo.has(f) || ts.sys.fileExists(f),
  readFile: (f) => textoDe(f),
  readDirectory: ts.sys.readDirectory,
  directoryExists: (d) => d.startsWith(DIR_VIRTUAL) || ts.sys.directoryExists(d),
  getDirectories: ts.sys.getDirectories,
};
const ls = ts.createLanguageService(host, ts.createDocumentRegistry());
const programa = (): ts.Program => {
  const p = ls.getProgram();
  if (p === undefined) throw new Error('language service sem programa');
  return p;
};

// ---------------------------------------------------------------------------------------------------------------------
// Edições: arquivo real ou bloco de Markdown

interface Edicao {
  readonly arquivo: string;
  readonly inicio: number;
  readonly fim: number;
  readonly texto: string;
}

/** Aplica edições (de um mesmo passo) e devolve os arquivos reais tocados. */
function aplicar(edicoes: readonly Edicao[]): Set<string> {
  const porArquivo = new Map<string, Edicao[]>();
  for (const e of edicoes) {
    const lista = porArquivo.get(e.arquivo) ?? [];
    if (!lista.some((x) => x.inicio === e.inicio && x.fim === e.fim && x.texto === e.texto)) lista.push(e);
    porArquivo.set(e.arquivo, lista);
  }
  const mds = new Map<string, { linha: number; col: number; fim: number; texto: string }[]>();
  const reais = new Set<string>();
  for (const [arquivo, lista] of porArquivo) {
    lista.sort((a, b) => b.inicio - a.inicio);
    for (let i = 1; i < lista.length; i++) {
      const a = lista[i - 1];
      const b = lista[i];
      if (a !== undefined && b !== undefined && b.fim > a.inicio) {
        throw new Error(`edições sobrepostas em ${relativo(arquivo)} (${b.inicio}-${b.fim} e ${a.inicio}-${a.fim})`);
      }
    }
    const v = virtuais.get(arquivo);
    if (v === undefined) {
      let t = ler(arquivo);
      for (const e of lista) t = t.slice(0, e.inicio) + e.texto + t.slice(e.fim);
      gravar(arquivo, t);
      reais.add(arquivo);
      continue;
    }
    // Posição no módulo virtual → linha e coluna do Markdown (as linhas do bloco são copiadas sem mudança).
    const sf = ts.createSourceFile(arquivo, textoVirtual.get(arquivo) ?? '', ts.ScriptTarget.Latest);
    for (const e of lista) {
      const ini = sf.getLineAndCharacterOfPosition(e.inicio);
      const fim = sf.getLineAndCharacterOfPosition(e.fim);
      if (ini.line !== fim.line) throw new Error(`edição de várias linhas num bloco de ${relativo(v.md)}`);
      const linha = v.linhas[ini.line];
      if (linha === undefined) throw new Error(`linha fora do bloco em ${relativo(v.md)}`);
      const l = mds.get(v.md) ?? [];
      l.push({ linha, col: ini.character, fim: fim.character, texto: e.texto });
      mds.set(v.md, l);
    }
  }
  for (const [md, lista] of mds) {
    const linhas = ler(md).split('\n');
    lista.sort((a, b) => b.linha - a.linha || b.col - a.col);
    for (const e of lista) {
      const l = linhas[e.linha] ?? '';
      linhas[e.linha] = l.slice(0, e.col) + e.texto + l.slice(e.fim);
    }
    gravar(md, linhas.join('\n'));
    montarVirtuais(md);
    reais.add(md);
  }
  return reais;
}

// ---------------------------------------------------------------------------------------------------------------------
// Achar declarações

function arquivoDoPrograma(arquivo: string): ts.SourceFile {
  const sf = programa().getSourceFile(abs(arquivo));
  if (sf === undefined) throw new Error(`arquivo fora do programa: ${arquivo}`);
  return sf;
}

type Declaracao =
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration
  | ts.VariableDeclaration;

function declaracoesDoTopo(sf: ts.SourceFile, nome: string): Declaracao[] {
  const out: Declaracao[] = [];
  for (const st of sf.statements) {
    if (
      (ts.isFunctionDeclaration(st) ||
        ts.isClassDeclaration(st) ||
        ts.isInterfaceDeclaration(st) ||
        ts.isTypeAliasDeclaration(st) ||
        ts.isEnumDeclaration(st)) &&
      st.name?.text === nome
    ) {
      out.push(st);
    }
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === nome) out.push(d);
    }
  }
  return out;
}

/** Membros com o nome dado num nó de tipo, atravessando uniões, interseções e referências a tipos do programa. */
function membrosDoTipo(no: ts.Node | undefined, nome: string, vistos: Set<ts.Node>): ts.Node[] {
  if (no === undefined || vistos.has(no)) return [];
  vistos.add(no);
  const checker = programa().getTypeChecker();
  if (ts.isTypeLiteralNode(no) || ts.isInterfaceDeclaration(no) || ts.isClassDeclaration(no)) {
    const lista = no.members as ts.NodeArray<ts.TypeElement | ts.ClassElement>;
    return lista.filter((m) => m.name !== undefined && nomeDe(m.name) === nome);
  }
  if (ts.isObjectLiteralExpression(no)) {
    return no.properties.filter((p) => p.name !== undefined && nomeDe(p.name) === nome);
  }
  if (ts.isUnionTypeNode(no) || ts.isIntersectionTypeNode(no)) {
    return no.types.flatMap((t) => membrosDoTipo(t, nome, vistos));
  }
  if (ts.isParenthesizedTypeNode(no)) return membrosDoTipo(no.type, nome, vistos);
  if (ts.isTypeReferenceNode(no)) {
    const s = checker.getSymbolAtLocation(no.typeName);
    const alvo = s && s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
    return (alvo?.declarations ?? [])
      .filter((d) => !d.getSourceFile().isDeclarationFile)
      .flatMap((d) => membrosDoTipo(ts.isTypeAliasDeclaration(d) ? d.type : d, nome, vistos));
  }
  return [];
}

function nomeDe(n: ts.PropertyName | ts.BindingName): string | undefined {
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isPrivateIdentifier(n)) return n.text;
  return undefined;
}

/** Nós de nome (identificador ou literal) a renomear para uma entrada. */
function nosDoSimbolo(arquivo: string, tipo: string | readonly string[] | undefined, nome: string): ts.Node[] {
  const sf = arquivoDoPrograma(arquivo);
  if (tipo === undefined) {
    const ds = declaracoesDoTopo(sf, nome);
    const d = ds[0];
    if (d?.name === undefined) throw new Error(`${arquivo}: declaração ${nome} não encontrada`);
    return [d.name];
  }
  const out: ts.Node[] = [];
  for (const t of typeof tipo === 'string' ? [tipo] : tipo) {
    const ds = declaracoesDoTopo(sf, t);
    if (ds.length === 0) throw new Error(`${arquivo}: tipo ${t} não encontrado`);
    let atuais: ts.Node[] = ds;
    for (const segmento of nome.split('.')) {
      const proximos: ts.Node[] = [];
      for (const d of atuais) {
        // `@retorno` desce no tipo de retorno anotado (`ok(): { ok: true; value: T }`).
        if (segmento === '@retorno' && ts.isFunctionLike(d)) {
          if (d.type !== undefined) proximos.push(d.type);
          continue;
        }
        if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d) || ts.isMethodSignature(d)) {
          const p = d.parameters.find((x) => nomeDe(x.name) === segmento);
          if (p) {
            proximos.push(p);
            continue;
          }
        }
        const vistos = new Set<ts.Node>();
        if (ts.isTypeAliasDeclaration(d)) proximos.push(...membrosDoTipo(d.type, segmento, vistos));
        else if (ts.isVariableDeclaration(d)) {
          proximos.push(...membrosDoTipo(d.type, segmento, vistos));
          if (d.type === undefined) proximos.push(...membrosDoTipo(d.initializer, segmento, vistos));
        } else if (ts.isTypeNode(d)) {
          proximos.push(...membrosDoTipo(d, segmento, vistos));
        } else if (ts.isParameter(d) || ts.isPropertySignature(d) || ts.isPropertyDeclaration(d)) {
          proximos.push(...membrosDoTipo(d.type, segmento, vistos));
        } else proximos.push(...membrosDoTipo(d, segmento, vistos));
      }
      atuais = proximos;
    }
    if (atuais.length === 0) throw new Error(`${arquivo}: membro ${t}.${nome} não encontrado`);
    for (const d of atuais) {
      const n = (d as ts.NamedDeclaration).name;
      if (n !== undefined) out.push(n);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Relatório

const relatorio: string[] = [
  `# Relatório de renomeação: ${mapa.pacote}`,
  '',
  simular ? 'Modo: simulação (nada gravado).' : 'Modo: aplicado.',
  '',
];
const falhas: string[] = [];
const pos = (sf: ts.SourceFile, p: number): string => {
  const v = virtuais.get(sf.fileName);
  const { line, character } = sf.getLineAndCharacterOfPosition(p);
  if (v !== undefined) return `${relativo(v.md)}:${(v.linhas[line] ?? 0) + 1}:${character + 1}`;
  return `${relativo(sf.fileName)}:${line + 1}:${character + 1}`;
};

/** Diagnósticos por arquivo, para comparar antes e depois (o programa tem erros de base: blocos de exemplo, TS 5.9). */
function diagnosticos(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const p = programa();
  for (const sf of p.getSourceFiles()) {
    if (sf.isDeclarationFile || sf.fileName.includes('node_modules')) continue;
    const ds = [...p.getSyntacticDiagnostics(sf), ...p.getSemanticDiagnostics(sf)];
    out.set(
      sf.fileName,
      ds.map(
        (d) =>
          `${d.start === undefined ? '?' : pos(sf, d.start)} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`,
      ),
    );
  }
  return out;
}

console.error('diagnósticos de base...');
const antes = diagnosticos();

// ---------------------------------------------------------------------------------------------------------------------
// 1. Símbolos

/** Matchers de igualdade do `bun:test`: o argumento é comparado com o `expect(valor)`, cujo tipo vale como esperado. */
const MATCHERS = new Set(['toBe', 'toEqual', 'toStrictEqual', 'toMatchObject', 'toContainEqual', 'toHaveProperty']);
const ANY = ts.TypeFlags.Any | ts.TypeFlags.Unknown;

function tipoDaPropriedade(tipos: readonly ts.Type[], nome: string, checker: ts.TypeChecker): ts.Type[] {
  return tipos
    .flatMap((t) => (t.isUnion() ? t.types : [t]))
    .flatMap((t) => {
      const s = t.getProperty(nome);
      return s ? [checker.getTypeOfSymbol(s)] : [];
    });
}

/**
 * Tipos esperados de uma expressão: o contextual, ou, quando não há (o argumento de `toEqual` é `unknown`), o do
 * `expect(valor)` do matcher, descendo por propriedades e itens de array.
 */
function tiposEsperados(x: ts.Expression, checker: ts.TypeChecker): ts.Type[] {
  const ctx = checker.getContextualType(x);
  // Parâmetro de tipo (o `T` de `ok(valor: T)`, o `U` de um `.map`) não diz nada: vale como sem tipo esperado.
  // Nem o tipo inferido do próprio objeto (o `U` de um `.map(() => ({...}))` sai do corpo que ele mesmo devolve).
  const proprio =
    ctx?.symbol?.declarations?.some(
      (d) => d.getSourceFile() === x.getSourceFile() && d.pos >= x.pos && d.end <= x.end,
    ) === true;
  if (ctx && !(ctx.flags & ANY) && !ctx.isTypeParameter() && !proprio) return [ctx];
  const p = x.parent;
  if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p)) {
    return tiposEsperados(p, checker);
  }
  if (ts.isCallExpression(p) && p.arguments[0] === x && ts.isPropertyAccessExpression(p.expression)) {
    // `expect.objectContaining({...})` vale pelo lugar onde o matcher assimétrico está.
    const assimetrico = ts.isIdentifier(p.expression.expression) && p.expression.expression.text === 'expect';
    if (assimetrico && p.expression.name.text === 'objectContaining') return tiposEsperados(p, checker);
    if (!MATCHERS.has(p.expression.name.text)) return [];
    let alvo = p.expression.expression;
    if (ts.isPropertyAccessExpression(alvo) && alvo.name.text === 'not') alvo = alvo.expression;
    if (!ts.isCallExpression(alvo) || !ts.isIdentifier(alvo.expression) || alvo.expression.text !== 'expect') return [];
    const valor = alvo.arguments[0];
    return valor ? [checker.getTypeAtLocation(valor)] : [];
  }
  if (ts.isPropertyAssignment(p) && p.initializer === x) {
    const nome = nomeDe(p.name);
    return nome === undefined ? [] : tipoDaPropriedade(tiposEsperados(p.parent, checker), nome, checker);
  }
  if (ts.isArrayLiteralExpression(p)) {
    return tiposEsperados(p, checker).flatMap((t) => {
      const i = checker.getIndexTypeOfType(t, ts.IndexKind.Number);
      return i ? [i] : [];
    });
  }
  return [];
}

/** Membros renomeados de uma entrada, já com o nome novo: as declarações e os tipos que as contêm. */
interface Alvo {
  readonly declaracoes: Set<ts.Node>;
  /** Propriedades de cada tipo que contém um membro, todas e as obrigatórias (para a regra de forma). */
  readonly formas: { readonly todas: Set<string>; readonly obrigatorias: Set<string> }[];
  /** Tipos que contêm os membros. */
  readonly tipos: Set<ts.Type>;
}

function alvoDe(arquivo: string, tipo: string | readonly string[], nome: string, opcional = false): Alvo {
  const checker = programa().getTypeChecker();
  let nos: ts.Node[] = [];
  try {
    nos = nosDoSimbolo(arquivo, tipo, nome);
  } catch (err) {
    if (!opcional) throw err;
  }
  const declaracoes = new Set(nos.map((n) => n.parent));
  const tipos = new Set<ts.Type>();
  for (const d of declaracoes) {
    const c = d.parent;
    tipos.add(checker.getTypeAtLocation(ts.isInterfaceDeclaration(c) || ts.isClassDeclaration(c) ? (c.name ?? c) : c));
  }
  // Sem o membro declarado no tipo (o `name` herdado de `Error`), vale o próprio tipo.
  if (declaracoes.size === 0) {
    for (const t of typeof tipo === 'string' ? [tipo] : tipo) {
      for (const d of declaracoesDoTopo(arquivoDoPrograma(arquivo), t))
        tipos.add(checker.getTypeAtLocation(d.name ?? d));
    }
  }
  const formas = [...tipos].map((t) => {
    const ps = checker.getPropertiesOfType(t);
    return {
      todas: new Set(ps.map((s) => s.name)),
      obrigatorias: new Set(ps.filter((s) => !(s.flags & ts.SymbolFlags.Optional)).map((s) => s.name)),
    };
  });
  return { declaracoes, formas, tipos };
}

function temMembroAlvo(tipos: readonly ts.Type[], nome: string, alvo: Alvo, checker: ts.TypeChecker): boolean {
  return tipos
    .flatMap((t) => (t.isUnion() ? t.types : [t]))
    .some((t) => {
      const s = t.getProperty(nome);
      return s !== undefined && raizes(s, checker).some((d) => alvo.declaracoes.has(d));
    });
}

function raizes(s: ts.Symbol | undefined, checker: ts.TypeChecker): ts.Node[] {
  if (s === undefined) return [];
  return checker.getRootSymbols(s).flatMap((r) => r.declarations ?? []);
}

/**
 * Objeto literal que é uma instância completa de um tipo do alvo: as chaves (com `antigo` lido como `novo`) cabem todas
 * no tipo e cobrem todas as propriedades obrigatórias dele, com duas ou mais chaves. Espalhamentos (`...x`) não contam.
 */
function temForma(obj: ts.ObjectLiteralExpression, antigo: string, novo: string, alvo: Alvo): boolean {
  const chaves = obj.properties.flatMap((p) => {
    const n = p.name === undefined ? undefined : nomeDe(p.name);
    return n === undefined ? [] : [n === antigo ? novo : n];
  });
  if (chaves.length < 2) return false;
  return alvo.formas.some(
    (f) => chaves.every((c) => f.todas.has(c)) && [...f.obrigatorias].every((c) => chaves.includes(c)),
  );
}

function* objetosLiterais(): Generator<{ sf: ts.SourceFile; obj: ts.ObjectLiteralExpression }> {
  for (const sf of programa().getSourceFiles()) {
    if (sf.isDeclarationFile || sf.fileName.includes('node_modules') || sf.fileName.endsWith('.json')) continue;
    const pilha: ts.Node[] = [sf];
    while (pilha.length > 0) {
      const n = pilha.pop() as ts.Node;
      if (ts.isObjectLiteralExpression(n)) yield { sf, obj: n };
      ts.forEachChild(n, (f) => {
        pilha.push(f);
      });
    }
  }
}

/**
 * Depois de aplicar, cada local trocado sem prefixo nem sufixo (fora de import e export) tem de resolver para a mesma
 * declaração renomeada. Um nome novo que já existe no escopo (`erro`, `valor`) captura a referência sem erro de tipo.
 */
function conferirCaptura(edicoes: readonly Edicao[], nos: readonly ts.Node[], novo: string): string[] {
  const deslocadas = new Map<string, { inicio: number; texto: string; novoInicio: number }[]>();
  const porArquivo = new Map<string, Edicao[]>();
  for (const x of edicoes) porArquivo.set(x.arquivo, [...(porArquivo.get(x.arquivo) ?? []), x]);
  for (const [arquivo, lista] of porArquivo) {
    const ordem = [...new Map(lista.map((x) => [x.inicio, x])).values()].sort((a, b) => a.inicio - b.inicio);
    let delta = 0;
    const out: { inicio: number; texto: string; novoInicio: number }[] = [];
    for (const x of ordem) {
      out.push({ inicio: x.inicio, texto: x.texto, novoInicio: x.inicio + delta });
      delta += x.texto.length - (x.fim - x.inicio);
    }
    deslocadas.set(arquivo, out);
  }
  const alvos = new Set<string>();
  for (const n of nos) {
    const sf = n.getSourceFile();
    const d = deslocadas.get(sf.fileName)?.find((x) => x.inicio === n.getStart(sf) + (ts.isStringLiteral(n) ? 1 : 0));
    if (d) alvos.add(`${sf.fileName}:${d.novoInicio}`);
  }
  const checker = programa().getTypeChecker();
  const token = (sf: ts.SourceFile, p: number): ts.Node =>
    (ts as unknown as { getTokenAtPosition(sf: ts.SourceFile, p: number): ts.Node }).getTokenAtPosition(sf, p);
  const problemas: string[] = [];
  for (const [arquivo, lista] of deslocadas) {
    const sf = programa().getSourceFile(arquivo);
    if (sf === undefined || virtuais.has(arquivo)) continue;
    for (const x of lista) {
      if (x.texto !== novo) continue;
      const t = token(sf, x.novoInicio);
      if (!ts.isIdentifier(t) || t.text !== novo) continue;
      const pai = t.parent;
      if (ts.isImportSpecifier(pai) || ts.isExportSpecifier(pai) || ts.isImportClause(pai)) continue;
      let s = checker.getSymbolAtLocation(t);
      if (s === undefined) continue;
      if (s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
      const decls = [...(s.declarations ?? []), ...checker.getRootSymbols(s).flatMap((r) => r.declarations ?? [])];
      // A propriedade ou o método de um objeto literal declara a si mesmo: não há o que capturar.
      if (ts.isPropertyAssignment(pai) || ts.isShorthandPropertyAssignment(pai) || ts.isMethodDeclaration(pai))
        continue;
      const ok = decls.some((d) => {
        const nome = (d as ts.NamedDeclaration).name;
        const dsf = d.getSourceFile();
        return (
          nome !== undefined && alvos.has(`${dsf.fileName}:${nome.getStart(dsf) + (ts.isStringLiteral(nome) ? 1 : 0)}`)
        );
      });
      if (!ok && !alvos.has(`${arquivo}:${x.novoInicio}`)) {
        const onde = decls[0] ? pos(decls[0].getSourceFile(), decls[0].getStart()) : '?';
        problemas.push(`- ${pos(sf, x.novoInicio)}: \`${novo}\` resolve para outra declaração (${onde})`);
      }
    }
  }
  return problemas;
}

const capturas: string[] = [];
const chavesSoltas: string[] = [];
/** Arquivos tocados por cada membro renomeado, para procurar o nome antigo escrito como texto no fim. */
const membrosRenomeados: { arquivos: Set<string>; antigo: string; novo: string }[] = [];

relatorio.push(
  '## Símbolos',
  '',
  '| Entrada | Novo | Locais | Arquivos | Chaves fora do alcance |',
  '|---|---|---|---|---|',
);
for (const e of mapa.simbolos ?? []) {
  const rotulo = `${e.tipo === undefined ? '' : `${typeof e.tipo === 'string' ? e.tipo : e.tipo.join('|')}.`}${e.nome}`;
  let nos: ts.Node[];
  try {
    nos = nosDoSimbolo(e.arquivo, e.tipo, e.nome);
  } catch (err) {
    falhas.push(`símbolo ${rotulo}: ${(err as Error).message}`);
    continue;
  }
  const antigo = e.nome.split('.').pop() ?? e.nome;
  const edicoes: Edicao[] = [];
  let erro: string | undefined;
  for (const no of nos) {
    const sf = no.getSourceFile();
    const inicio = no.getStart(sf) + (ts.isStringLiteral(no) ? 1 : 0);
    const info = ls.getRenameInfo(sf.fileName, inicio, { allowRenameOfImportPath: false });
    if (!info.canRename) {
      erro = info.localizedErrorMessage;
      break;
    }
    // Com prefixo e sufixo, o serviço preserva os nomes locais: a propriedade abreviada (`{ path }` vira
    // `{ caminho: path }`) e a desestruturação. Mas também preserva o nome exportado (`export { novo as antigo }`,
    // `import { novo as antigo }`) e para ali. Em import e export o nome é trocado inteiro, e a busca continua a partir
    // dele, até não sobrar local novo.
    const fila: [string, number][] = [[sf.fileName, inicio]];
    const vistos = new Set<string>();
    while (fila.length > 0 && erro === undefined) {
      const [f, p] = fila.shift() as [string, number];
      const locais = ls.findRenameLocations(f, p, false, false, { providePrefixAndSuffixTextForRename: true }) ?? [];
      for (const l of locais) {
        const chave = `${l.fileName}:${l.textSpan.start}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        const alvo = programa().getSourceFile(l.fileName);
        if (alvo === undefined || alvo.isDeclarationFile || l.fileName.includes('node_modules')) {
          erro = `referência fora do repo: ${l.fileName}`;
          break;
        }
        const texto = alvo.text.slice(l.textSpan.start, l.textSpan.start + l.textSpan.length);
        if (texto !== antigo) {
          erro = `local com texto inesperado (${texto}) em ${pos(alvo, l.textSpan.start)}`;
          break;
        }
        const token = (
          ts as unknown as { getTokenAtPosition(sf: ts.SourceFile, p: number): ts.Node }
        ).getTokenAtPosition(alvo, l.textSpan.start);
        const emModulo = ts.isImportSpecifier(token.parent) || ts.isExportSpecifier(token.parent);
        if (emModulo && (l.prefixText || l.suffixText)) fila.push([l.fileName, l.textSpan.start]);
        edicoes.push({
          arquivo: l.fileName,
          inicio: l.textSpan.start,
          fim: l.textSpan.start + l.textSpan.length,
          texto: emModulo ? e.novo : `${l.prefixText ?? ''}${e.novo}${l.suffixText ?? ''}`,
        });
      }
    }
  }
  if (erro !== undefined) {
    falhas.push(`símbolo ${rotulo}: ${erro}`);
    continue;
  }
  const arquivos = aplicar(edicoes);
  capturas.push(...conferirCaptura(edicoes, nos, e.novo));

  // Chaves de objeto literal que o serviço não alcança: objeto sem tipo contextual (o `toEqual({...})` de um teste,
  // um `const` sem anotação). Troca quando o tipo esperado pelo `expect` tem o membro renomeado, ou quando todas as
  // chaves do objeto cabem num tipo do alvo; cada troca vai para o relatório.
  let soltas = 0;
  if (e.tipo !== undefined) {
    const caminhoNovo = [...e.nome.split('.').slice(0, -1), e.novo].join('.');
    const alvo = alvoDe(e.arquivo, e.tipo, caminhoNovo);
    const checker = programa().getTypeChecker();
    const extras: Edicao[] = [];
    for (const { sf, obj } of objetosLiterais()) {
      for (const p of obj.properties) {
        if (!(ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) || nomeDe(p.name) !== antigo) continue;
        const esperados = tiposEsperados(obj, checker);
        let motivo: string | undefined;
        if (esperados.length > 0) {
          if (temMembroAlvo(esperados, e.novo, alvo, checker)) motivo = 'tipo do expect';
        } else if (
          !/\/(tools|scripts)\//.test(relativo(sf.fileName).replace(/^/, '/')) &&
          temForma(obj, antigo, e.novo, alvo)
        ) {
          // Fora de `tools/` e `scripts/`: os geradores têm tipos paralelos aos do pacote e mudam à mão, inteiros.
          motivo = 'forma do objeto';
        }
        if (motivo === undefined) continue;
        const q = p.name.getStart(sf);
        extras.push({
          arquivo: sf.fileName,
          inicio: q,
          fim: p.name.getEnd(),
          texto: ts.isShorthandPropertyAssignment(p) ? `${e.novo}: ${antigo}` : e.novo,
        });
        chavesSoltas.push(`- ${pos(sf, q)}: \`${antigo}\` → \`${e.novo}\` (${motivo})`);
      }
    }
    // `Clock['now']` num tipo de acesso indexado: o serviço não renomeia o texto do índice.
    for (const sf of programa().getSourceFiles()) {
      if (sf.isDeclarationFile || sf.fileName.includes('node_modules') || !sf.text.includes(antigo)) continue;
      const visitar = (n: ts.Node): void => {
        if (
          ts.isIndexedAccessTypeNode(n) &&
          ts.isLiteralTypeNode(n.indexType) &&
          ts.isStringLiteral(n.indexType.literal) &&
          n.indexType.literal.text === antigo &&
          temMembroAlvo([checker.getTypeFromTypeNode(n.objectType)], e.novo, alvo, checker)
        ) {
          const q = n.indexType.literal.getStart(sf) + 1;
          extras.push({ arquivo: sf.fileName, inicio: q, fim: q + antigo.length, texto: e.novo });
          chavesSoltas.push(`- ${pos(sf, q)}: \`['${antigo}']\` → \`['${e.novo}']\` (acesso indexado)`);
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
    }
    aplicar(extras);
    soltas = extras.length;
    membrosRenomeados.push({ arquivos: new Set([...arquivos, ...extras.map((x) => x.arquivo)]), antigo, novo: e.novo });
  }
  relatorio.push(`| \`${rotulo}\` | \`${e.novo}\` | ${edicoes.length} | ${arquivos.size} | ${soltas} |`);
}
if (chavesSoltas.length > 0) {
  relatorio.push('', '### Chaves de objeto fora do alcance do serviço, trocadas pela regra', '', ...chavesSoltas);
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Literais

/** Símbolo da propriedade a que o literal se liga (comparação, `case`), com o tipo do objeto que a tem. */
function propriedadeLigada(
  lit: ts.Expression,
  checker: ts.TypeChecker,
): { simbolo?: ts.Symbol; tipoDoObjeto?: ts.Type; tipoDoLado?: ts.Type } {
  let p: ts.Node = lit.parent;
  let filho: ts.Node = lit;
  while (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p)) {
    filho = p;
    p = p.parent;
  }
  const lado = (x: ts.Expression): { simbolo?: ts.Symbol; tipoDoObjeto?: ts.Type; tipoDoLado?: ts.Type } => {
    // O tipo do outro lado da comparação (`e.nivel === 'warn'`): a união dele decide pelo grupo.
    const tipoDoLado = checker.getTypeAtLocation(x);
    if (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) {
      const s = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(x) ? x.name : x.argumentExpression);
      const t = checker.getTypeAtLocation(x.expression);
      // Dentro da classe, `this` é um parâmetro de tipo restrito à própria classe.
      const tipoDoObjeto = t.isTypeParameter() ? (checker.getBaseConstraintOfType(t) ?? t) : t;
      return { ...(s ? { simbolo: s } : {}), tipoDoObjeto, tipoDoLado };
    }
    return { tipoDoLado };
  };
  if (ts.isBinaryExpression(p)) return lado(p.left === filho ? p.right : p.left);
  // `expect([r.status, r.cStat]).toEqual(['authorized', '100'])`: o item na mesma posição do array do `expect`.
  if (ts.isArrayLiteralExpression(p) && ts.isCallExpression(p.parent) && p.parent.arguments[0] === p) {
    const m = p.parent.expression;
    if (ts.isPropertyAccessExpression(m) && MATCHERS.has(m.name.text)) {
      let alvo = m.expression;
      if (ts.isPropertyAccessExpression(alvo) && alvo.name.text === 'not') alvo = alvo.expression;
      const valor = ts.isCallExpression(alvo) ? alvo.arguments[0] : undefined;
      const par =
        valor && ts.isArrayLiteralExpression(valor)
          ? valor.elements[p.elements.indexOf(filho as ts.Expression)]
          : undefined;
      if (par !== undefined) return lado(par);
    }
  }
  if (ts.isCaseClause(p)) return lado(p.parent.parent.expression);
  if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && MATCHERS.has(p.expression.name.text)) {
    let alvo = p.expression.expression;
    if (ts.isPropertyAccessExpression(alvo) && alvo.name.text === 'not') alvo = alvo.expression;
    if (ts.isCallExpression(alvo) && alvo.arguments[0]) return lado(alvo.arguments[0]);
  }
  if (ts.isPropertyAssignment(p) && p.initializer === filho) {
    const nome = nomeDe(p.name);
    const t = tiposEsperados(p.parent, checker)[0];
    // O objeto devolvido por uma função `async` tem o `Promise` como tipo esperado.
    const s =
      t && nome !== undefined ? (t.getProperty(nome) ?? checker.getAwaitedType(t)?.getProperty(nome)) : undefined;
    return { ...(s ? { simbolo: s } : {}), ...(t ? { tipoDoObjeto: t } : {}) };
  }
  return {};
}

function literaisDoGrupo(tipos: readonly ts.Type[]): Set<string> {
  const out = new Set<string>();
  for (const t of tipos) for (const u of t.isUnion() ? t.types : [t]) if (u.isStringLiteral()) out.add(u.value);
  return out;
}

if ((mapa.literais ?? []).length > 0) {
  relatorio.push('', '## Literais', '');
  for (const e of mapa.literais ?? []) {
    let alvo: Alvo;
    try {
      if (e.propriedade === undefined) {
        const decls = (typeof e.tipo === 'string' ? [e.tipo] : e.tipo).flatMap((t) =>
          declaracoesDoTopo(arquivoDoPrograma(e.arquivo), t),
        );
        const checker = programa().getTypeChecker();
        alvo = {
          declaracoes: new Set(decls),
          formas: [],
          tipos: new Set(decls.map((d) => checker.getTypeAtLocation(d.name ?? d))),
        };
      } else alvo = alvoDe(e.arquivo, e.tipo, e.propriedade, true);
    } catch (err) {
      falhas.push(`literal ${e.antigo}: ${(err as Error).message}`);
      continue;
    }
    if (alvo.tipos.size === 0) {
      falhas.push(`literal ${e.antigo}: tipo ${String(e.tipo)} não encontrado em ${e.arquivo}`);
      continue;
    }
    const checker = programa().getTypeChecker();
    const grupo = new Set([e.antigo, ...(e.grupo ?? [])]);
    const edicoes: Edicao[] = [];
    const porMotivo = new Map<string, number>();
    const naoResolvidos: string[] = [];
    for (const sf of programa().getSourceFiles()) {
      if (sf.isDeclarationFile || sf.fileName.includes('node_modules') || sf.fileName.endsWith('.json')) continue;
      if (!sf.text.includes(e.antigo)) continue;
      const visitar = (n: ts.Node): void => {
        if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === e.antigo) {
          let motivo: string | undefined;
          if (ts.isLiteralTypeNode(n.parent)) {
            // O literal da própria declaração (`readonly status: 'authorized'`, ou um membro da união dela).
            let d: ts.Node = n.parent;
            while (ts.isUnionTypeNode(d.parent) || ts.isParenthesizedTypeNode(d.parent)) d = d.parent;
            if (alvo.declaracoes.has(d.parent)) motivo = 'declaração';
          } else {
            const { simbolo, tipoDoObjeto, tipoDoLado } = propriedadeLigada(n, checker);
            if (raizes(simbolo, checker).some((d) => alvo.declaracoes.has(d))) motivo = 'propriedade';
            else if (tipoDoObjeto && (simbolo === undefined || simbolo.name === e.propriedade)) {
              const base = (t: ts.Type): ts.Type[] => [
                t,
                ...(t.isClass() ? checker.getBaseTypes(t).flatMap(base) : []),
              ];
              const partes = tipoDoObjeto.isUnion() ? tipoDoObjeto.types : [tipoDoObjeto];
              const doAlvo = partes.some((t) => base(t).some((b) => alvo.tipos.has(b)));
              if (doAlvo && simbolo?.name === e.propriedade) motivo = 'tipo do objeto';
            }
            if (motivo === undefined) {
              const valores = literaisDoGrupo([...tiposEsperados(n, checker), ...(tipoDoLado ? [tipoDoLado] : [])]);
              if (valores.has(e.antigo) && [...grupo].filter((g) => valores.has(g)).length >= 2)
                motivo = 'união do grupo';
            }
            if (motivo === undefined && ts.isPropertyAssignment(n.parent) && n.parent.initializer === n) {
              const obj = n.parent.parent;
              const chave = nomeDe(n.parent.name);
              if (chave === e.propriedade && tiposEsperados(obj, checker).length === 0 && temForma(obj, '', '', alvo)) {
                motivo = 'forma do objeto';
              }
              // A chave é a propriedade do mapa e o tipo esperado do literal é o próprio valor (`tipo: 'data'` num
              // objeto cujo tipo esperado o verificador não expõe como propriedade, o retorno de uma fábrica).
              const esperado = literaisDoGrupo(tiposEsperados(n, checker));
              if (
                motivo === undefined &&
                chave === e.propriedade &&
                esperado.size > 0 &&
                [...esperado].every((v) => grupo.has(v))
              ) {
                motivo = 'chave e tipo esperado';
              }
            }
          }
          if (motivo !== undefined) {
            const q = n.getStart(sf) + 1;
            edicoes.push({ arquivo: sf.fileName, inicio: q, fim: q + e.antigo.length, texto: e.novo });
            porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);
          } else {
            // O que o verificador viu, para quem revisa: a propriedade ligada (se houver) e o tipo esperado.
            const { simbolo } = ts.isLiteralTypeNode(n.parent) ? { simbolo: undefined } : propriedadeLigada(n, checker);
            const d = raizes(simbolo, checker)[0];
            const esperado = tiposEsperados(n, checker)[0];
            const visto = [
              simbolo ? `propriedade \`${simbolo.name}\`${d ? ` de ${pos(d.getSourceFile(), d.getStart())}` : ''}` : '',
              esperado ? `esperado \`${checker.typeToString(esperado).slice(0, 80)}\`` : '',
            ].filter(Boolean);
            naoResolvidos.push(`${pos(sf, n.getStart(sf))}${visto.length ? ` (${visto.join('; ')})` : ''}`);
          }
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
    }
    aplicar(edicoes);
    const motivos = [...porMotivo].map(([m, n]) => `${m} ${n}`).join(', ');
    relatorio.push(
      `- \`${e.propriedade}: '${e.antigo}'\` → \`'${e.novo}'\`: ${edicoes.length} trocados (${motivos || 'nenhum'}); ${naoResolvidos.length} não ligados ao tipo, sem mudança${naoResolvidos.length ? ':' : '.'}`,
    );
    for (const n of naoResolvidos) relatorio.push(`  - ${n}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Chaves de dados (JSON)

function objetosNoCaminho(no: ts.Expression, segmentos: readonly string[]): ts.ObjectLiteralExpression[] {
  const [s, ...resto] = segmentos;
  if (s === undefined) return ts.isObjectLiteralExpression(no) ? [no] : [];
  const item = s.endsWith('[]');
  const chave = item ? s.slice(0, -2) : s;
  let filhos: ts.Expression[] = [no];
  if (chave !== '') {
    if (!ts.isObjectLiteralExpression(no)) return [];
    filhos = no.properties
      .filter(ts.isPropertyAssignment)
      .filter((p) => chave === '*' || nomeDe(p.name) === chave)
      .map((p) => p.initializer);
  }
  if (item) filhos = filhos.flatMap((f) => (ts.isArrayLiteralExpression(f) ? [...f.elements] : []));
  return filhos.flatMap((f) => objetosNoCaminho(f, resto));
}

if ((mapa.chavesDeDados ?? []).length > 0) {
  relatorio.push('', '## Chaves de dados', '');
  for (const e of mapa.chavesDeDados ?? []) {
    const arquivo = abs(e.arquivo);
    const json = ts.parseJsonText(arquivo, ler(arquivo));
    const raiz = json.statements[0]?.expression;
    if (raiz === undefined) {
      falhas.push(`chave ${e.antigo}: ${e.arquivo} vazio`);
      continue;
    }
    const segmentos = e.caminho === '' ? [] : e.caminho.split('.');
    const edicoes: Edicao[] = [];
    for (const o of objetosNoCaminho(raiz, segmentos)) {
      for (const p of o.properties) {
        if (!ts.isPropertyAssignment(p) || nomeDe(p.name) !== e.antigo) continue;
        if (o.properties.some((q) => q.name !== undefined && nomeDe(q.name) === e.novo)) {
          falhas.push(`chave ${e.antigo}: ${e.arquivo} já tem ${e.novo} no mesmo objeto`);
          continue;
        }
        const q = p.name.getStart(json);
        edicoes.push({ arquivo, inicio: q, fim: p.name.getEnd(), texto: JSON.stringify(e.novo) });
      }
    }
    // O código que lê o JSON importado (`table.schemaVersion`): acesso cujo símbolo é uma das chaves trocadas.
    const chaves = new Set(edicoes.map((x) => x.inicio));
    const checker = programa().getTypeChecker();
    const acessos: Edicao[] = [];
    if (programa().getSourceFile(arquivo) !== undefined) {
      for (const sf of programa().getSourceFiles()) {
        if (sf.isDeclarationFile || sf.fileName.includes('node_modules') || !sf.text.includes(e.antigo)) continue;
        const visitar = (n: ts.Node): void => {
          if (ts.isPropertyAccessExpression(n) && n.name.text === e.antigo) {
            const s = checker.getSymbolAtLocation(n.name);
            const doJson = (s?.declarations ?? []).some((d) => {
              const nome = (d as ts.NamedDeclaration).name;
              return (
                d.getSourceFile().fileName === arquivo &&
                nome !== undefined &&
                chaves.has(nome.getStart(d.getSourceFile()))
              );
            });
            if (doJson) {
              const q = n.name.getStart(sf);
              acessos.push({ arquivo: sf.fileName, inicio: q, fim: q + e.antigo.length, texto: e.novo });
            }
          }
          ts.forEachChild(n, visitar);
        };
        visitar(sf);
      }
    }
    aplicar([...edicoes, ...acessos]);
    relatorio.push(
      `- \`${e.arquivo}\` \`${e.caminho || '(raiz)'}.${e.antigo}\` → \`${e.novo}\`: ${edicoes.length} chaves, ${acessos.length} acessos no código`,
    );
  }
}

if ((mapa.valoresDeDados ?? []).length > 0) {
  relatorio.push('', '## Valores de dados', '');
  for (const e of mapa.valoresDeDados ?? []) {
    const arquivo = abs(e.arquivo);
    const json = ts.parseJsonText(arquivo, ler(arquivo));
    const raiz = json.statements[0]?.expression;
    if (raiz === undefined) {
      falhas.push(`valor ${e.antigo}: ${e.arquivo} vazio`);
      continue;
    }
    const edicoes: Edicao[] = [];
    for (const o of objetosNoCaminho(raiz, e.caminho === '' ? [] : e.caminho.split('.'))) {
      for (const p of o.properties) {
        if (!ts.isPropertyAssignment(p) || nomeDe(p.name) !== e.chave) continue;
        if (!ts.isStringLiteral(p.initializer) || p.initializer.text !== e.antigo) continue;
        const q = p.initializer.getStart(json);
        edicoes.push({ arquivo, inicio: q, fim: p.initializer.getEnd(), texto: JSON.stringify(e.novo) });
      }
    }
    aplicar(edicoes);
    relatorio.push(
      `- \`${e.arquivo}\` \`${e.caminho}.${e.chave}: '${e.antigo}'\` → \`'${e.novo}'\`: ${edicoes.length}`,
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Conferência: diagnósticos novos e nomes antigos que sobraram no texto

// O nome de um membro escrito como texto (`'hint' in r`, `Object.keys(p)` comparado com uma lista,
// `toHaveProperty('path')`): o verificador não liga o texto ao membro. Só nos arquivos que a renomeação tocou.
const nomesComoTexto: string[] = [];
for (const { arquivos, antigo, novo } of membrosRenomeados) {
  for (const f of arquivos) {
    const sf = programa().getSourceFile(f);
    if (sf === undefined) continue;
    const visitar = (n: ts.Node): void => {
      // A chave num objeto que o serviço e a regra de forma não ligaram ao tipo (os `details` de um erro são um
      // `Record`), e o acesso `.antigo` que sobrou.
      if (
        (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) &&
        nomeDe(n.name) === antigo &&
        ts.isObjectLiteralExpression(n.parent)
      ) {
        nomesComoTexto.push(
          `- ${pos(sf, n.name.getStart(sf))}: chave \`${antigo}\` (membro renomeado para \`${novo}\`)`,
        );
      }
      if (ts.isPropertyAccessExpression(n) && n.name.text === antigo) {
        nomesComoTexto.push(
          `- ${pos(sf, n.name.getStart(sf))}: acesso \`.${antigo}\` (membro renomeado para \`${novo}\`)`,
        );
      }
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === antigo) {
        if (!ts.isLiteralTypeNode(n.parent) && !ts.isImportDeclaration(n.parent)) {
          nomesComoTexto.push(`- ${pos(sf, n.getStart(sf))}: \`'${antigo}'\` (membro renomeado para \`${novo}\`)`);
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
}
relatorio.push(
  '',
  `## Nome antigo de membro que sobrou nos arquivos tocados (${nomesComoTexto.length}, revisar à mão)`,
  '',
  ...nomesComoTexto,
);

console.error('diagnósticos depois...');
const depois = diagnosticos();
const novos: string[] = [];
for (const [f, ds] of depois) {
  const base = new Set((antes.get(f) ?? []).map((d) => d.replace(/^\S+ /, '')));
  for (const d of ds) if (!base.has(d.replace(/^\S+ /, ''))) novos.push(d);
}
relatorio.push('', `## Diagnósticos novos (${novos.length})`, '');
for (const d of novos.slice(0, 300)) relatorio.push(`- ${d}`);
if (novos.length > 300) relatorio.push(`- ... mais ${novos.length - 300}`);

// Nomes exportados são distintivos: procurados em todo texto. Membros e literais (`path`, `status`) são comuns demais
// fora da API, então só no Markdown e só na forma de código (`.path`, `path:`, `'authorized'`).
const escapar = (n: string): string => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const topo = [...new Set((mapa.simbolos ?? []).filter((e) => e.tipo === undefined).map((e) => e.nome))];
const membros = [
  ...new Set((mapa.simbolos ?? []).filter((e) => e.tipo !== undefined).map((e) => e.nome.split('.').pop() ?? e.nome)),
];
const literais = [...new Set((mapa.literais ?? []).map((e) => e.antigo))];
const padroes: RegExp[] = [];
if (topo.length > 0) padroes.push(new RegExp(`\\b(${topo.map(escapar).join('|')})\\b`, 'g'));
const padroesMd: RegExp[] = [...padroes];
if (membros.length > 0)
  padroesMd.push(new RegExp(`(?:\\.|\\b)(${membros.map(escapar).join('|')})(?=\\??:|\\b(?!-))`, 'g'));
if (literais.length > 0) padroesMd.push(new RegExp(`['"\`](${literais.map(escapar).join('|')})['"\`]`, 'g'));
const textos = [...arquivosTs, ...markdowns, ...(await varrer('docs/**/*.md'))].filter(
  (f, i, a) => a.indexOf(f) === i && !f.includes('/docs/adr/') && !textoVirtual.has(f),
);
const sobras: string[] = [];
for (const f of textos) {
  const md = f.endsWith('.md');
  for (const [i, l] of ler(f).split('\n').entries()) {
    const achados = new Set<string>();
    for (const re of md ? padroesMd : padroes) for (const m of l.matchAll(re)) achados.add(m[1] ?? '');
    if (md && membros.length > 0) {
      // Membro só conta no Markdown quando aparece como código: `.path`, `path:` ou entre crases.
      for (const n of membros)
        if (!new RegExp(`(\\.${escapar(n)}\\b|\\b${escapar(n)}\\??:|\`${escapar(n)}\`)`).test(l)) achados.delete(n);
    }
    if (achados.size > 0) sobras.push(`- ${relativo(f)}:${i + 1}: ${[...achados].join(', ')}`);
  }
}
relatorio.push(
  '',
  `## Nome antigo que sobrou no texto (${sobras.length} linhas)`,
  '',
  'Comentários, prosa de Markdown e homônimos de outros símbolos. Nada aqui foi trocado: revisar à mão. Membros e literais só são procurados no Markdown, na forma de código.',
  '',
  ...sobras,
);

if (capturas.length > 0) relatorio.push('', `## Possíveis capturas de nome (${capturas.length})`, '', ...capturas);
if (falhas.length > 0) relatorio.push('', '## Falhas', '', ...falhas.map((f) => `- ${f}`));

// ---------------------------------------------------------------------------------------------------------------------
// Gravação

if (!simular) {
  for (const f of tocados) writeFileSync(f, conteudo.get(f) ?? '');
  const formatar = [...tocados].filter((f) => /\.(ts|json)$/.test(f));
  if (formatar.length > 0) await $`bunx biome check --write ${formatar}`.cwd(root).nothrow();
}
relatorio.push('', `Arquivos tocados: ${tocados.size}.`);
const saida = relatorio.join('\n');
if (arquivoRelatorio) writeFileSync(arquivoRelatorio, `${saida}\n`);
else console.log(saida);
console.error(`${tocados.size} arquivos tocados, ${novos.length} diagnósticos novos, ${falhas.length} falhas`);
process.exit(falhas.length > 0 || capturas.length > 0 ? 1 : 0);
