#!/usr/bin/env bun
/**
 * Portão depois de aplicar os mapas: procura cada nome antigo no repo inteiro (fora dos CHANGELOG) e classifica cada
 * ocorrência. Só passa o que tem justificativa:
 *
 * - `adr`: prosa histórica de um ADR;
 * - `homonimo`: identificador de código que o verificador resolve para outro símbolo (uma variável local `err`, o
 *   `Signer` de outro pacote), ou código fora do TypeScript (Go do helper, `spikes/`, que não importam o sinete);
 * - `revisar`: todo o resto (comentário, texto, Markdown, literal). Tem de chegar a zero, ou virar exceção anotada.
 *
 * Nomes exportados são procurados como palavra em todo texto. Membros e literais (`path`, `status`, `'authorized'`) são
 * palavras comuns demais: no código só contam como texto (`'path'`), acesso (`.path`) ou chave (`path:`) que o
 * verificador não resolve, e na prosa só na forma de código (`.path`, `path:`, entre crases). Um literal com tipo
 * esperado (`string` livre ou a união de outro tipo) é de outro dono: o typecheck já garante que não é da fase. E na
 * prosa, ou num comentário, o membro só conta se a seção (ou as linhas em volta) cita o dono: um nome do arquivo que o
 * declara. Numa seção que só fala do `ErroSinete`, o `code` é o do erro, que fica.
 *
 * Uso: `bun tools/renomear/portao.ts <mapa.json>... [--relatorio <arquivo.md>] [--json <achados.json>] [--excecoes <arquivo.json>]`. O arquivo de
 * exceções é uma lista de `{ "arquivo", "linha", "nome", "motivo" }` para ocorrências `revisar` aceitas de propósito.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { $ } from 'bun';
import ts from 'typescript-ls';
import type { ExportTarget } from '../../scripts/lib/workspace.ts';
import { root, workspacePackages } from '../../scripts/lib/workspace.ts';

interface Mapa {
  readonly simbolos?: readonly {
    readonly arquivo: string;
    readonly tipo?: unknown;
    readonly nome: string;
    readonly novo: string;
  }[];
  readonly literais?: readonly {
    readonly arquivo: string;
    readonly tipo?: unknown;
    readonly antigo: string;
    readonly novo: string;
  }[];
  readonly chavesDeDados?: readonly { readonly arquivo: string; readonly antigo: string }[];
  readonly valoresDeDados?: readonly { readonly antigo: string }[];
}
interface Excecao {
  readonly arquivo: string;
  readonly linha: number;
  readonly nome: string;
  readonly motivo: string;
}

const args = process.argv.slice(2);
const opcao = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const arquivoRelatorio = opcao('--relatorio');
const arquivoExcecoes = opcao('--excecoes');
const arquivoJson = opcao('--json');
const mapas = args
  .filter((a, i) => !a.startsWith('--') && !['--relatorio', '--excecoes', '--json'].includes(args[i - 1] ?? ''))
  .map((f) => JSON.parse(readFileSync(f, 'utf8')) as Mapa);
const excecoes: Excecao[] = arquivoExcecoes ? JSON.parse(readFileSync(arquivoExcecoes, 'utf8')) : [];

const topo = new Set<string>();
const comuns = new Set<string>();
for (const m of mapas) {
  for (const e of m.simbolos ?? []) (e.tipo === undefined ? topo : comuns).add(e.nome.split('.').pop() ?? e.nome);
  for (const e of [...(m.literais ?? []), ...(m.valoresDeDados ?? [])]) comuns.add(e.antigo);
  for (const e of m.chavesDeDados ?? []) comuns.add(e.antigo);
}
for (const n of topo) comuns.delete(n);
/**
 * Dono de cada membro comum: os nomes (antigos e novos) do arquivo que o declara. Na prosa, `status` só é o do
 * `ResultadoSefaz` se a seção fala dele; numa seção que só fala do `ErroSinete`, o `code` é o do erro, que fica.
 */
const PALAVRAS_DO_DONO: Record<string, readonly string[]> = {
  'packages/core/src/result.ts': ['desfecho', 'desfechos'],
  'packages/core/src/errors.ts': ['ocorrência', 'ocorrências'],
};
const nomesDoArquivo = new Map<string, Set<string>>();
const doArquivo = (a: string): Set<string> => {
  const s = nomesDoArquivo.get(a) ?? new Set(PALAVRAS_DO_DONO[a] ?? []);
  nomesDoArquivo.set(a, s);
  return s;
};
const donos = new Map<string, Set<string>>();
for (const m of mapas) {
  for (const e of m.simbolos ?? []) {
    const nomes = doArquivo(e.arquivo);
    if (e.tipo === undefined) nomes.add(e.nome).add(e.novo);
    else for (const t of String(e.tipo).match(/[A-Za-z_]\w*/g) ?? []) nomes.add(t);
  }
  for (const e of m.literais ?? []) doArquivo(e.arquivo).add(e.antigo).add(e.novo);
  for (const e of m.chavesDeDados ?? []) doArquivo(e.arquivo).add(path.basename(e.arquivo));
}
const ligar = (nome: string, arquivo: string): void => {
  const s = donos.get(nome) ?? new Set<string>();
  donos.set(nome, s.add(arquivo));
};
for (const m of mapas) {
  for (const e of m.simbolos ?? []) if (e.tipo !== undefined) ligar(e.nome.split('.').pop() ?? e.nome, e.arquivo);
  for (const e of m.literais ?? []) ligar(e.antigo, e.arquivo);
  for (const e of m.chavesDeDados ?? []) ligar(e.antigo, e.arquivo);
}
/** O trecho cita algum nome do dono do membro? */
function citaODono(nome: string, trecho: string): boolean {
  for (const a of donos.get(nome) ?? []) for (const n of doArquivo(a)) if (palavra(n).test(trecho)) return true;
  return false;
}
/** JSON de dados cujas chaves os mapas trocam: nele, a chave antiga que sobrou é achado. */
const dadosDaFase = new Set(mapas.flatMap((m) => (m.chavesDeDados ?? []).map((e) => e.arquivo)));
/**
 * Membros e literais só contam em código que usa os pacotes da fase (o pacote em si ou quem o importa): no resto do
 * repo, `status` e `value` são de outros tipos, e o typecheck já prova que nenhum acesso tipado ficou para trás.
 */
const USA_A_FASE =
  /(?:@sinete|sinete)\/(?:core|validators|rejeicoes)\b|packages\/(?:core|validators|rejeicoes)\/src|\.\.\/(?:\.\.\/)*(?:core|validators|rejeicoes)\/src/;

// ---------------------------------------------------------------------------------------------------------------------
// Programa para resolver identificadores (o mesmo recorte do renomear, mais os `.mjs`/`.cjs`)

const arquivos = (await $`git ls-files`.cwd(root).text())
  .split('\n')
  .filter((f) => f !== '' && !f.endsWith('CHANGELOG.md') && existsSync(path.join(root, f)))
  .map((f) => path.join(root, f));
const codigo = arquivos.filter((f) => /\.(ts|mts|cts|mjs|cjs|js)$/.test(f) && !f.includes('/spikes/'));

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
    if (manifest.name.startsWith('@sinete/')) paths[`sinete/${nome.slice('@sinete/'.length)}`] = [src];
  }
}
const base = ts.parseConfigFileTextToJson(
  'tsconfig.base.json',
  readFileSync(path.join(root, 'tsconfig.base.json'), 'utf8'),
);
const { options } = ts.convertCompilerOptionsFromJson(base.config.compilerOptions, root);
const programa = ts.createProgram(codigo, {
  ...options,
  types: ['bun'],
  typeRoots: [path.join(root, 'node_modules/@types')],
  customConditions: ['node'],
  paths,
  noEmit: true,
  allowJs: true,
  checkJs: false,
  isolatedDeclarations: false,
});
const checker = programa.getTypeChecker();

// ---------------------------------------------------------------------------------------------------------------------
// Varredura

type Classe = 'adr' | 'homonimo' | 'revisar' | 'excecao';
interface Achado {
  readonly nome: string;
  readonly arquivo: string;
  readonly linha: number;
  readonly classe: Classe;
  readonly motivo: string;
}
const achados: Achado[] = [];
const esc = (n: string): string => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const palavra = (n: string): RegExp => new RegExp(`(?<![A-Za-z0-9_$])${esc(n)}(?![A-Za-z0-9_$])`, 'g');
const formaDeCodigo = (n: string): RegExp =>
  new RegExp(
    `(?:\\.${esc(n)}(?![A-Za-z0-9_$])|(?<![A-Za-z0-9_$.-])${esc(n)}\\??:|\`${esc(n)}\`|['"]${esc(n)}['"])`,
    'g',
  );

function registrar(nome: string, arquivo: string, linha: number, classe: Classe, motivo: string): void {
  const rel = path.relative(root, arquivo);
  const ex =
    classe === 'revisar' ? excecoes.find((e) => e.arquivo === rel && e.linha === linha && e.nome === nome) : undefined;
  achados.push({ nome, arquivo: rel, linha, classe: ex ? 'excecao' : classe, motivo: ex ? ex.motivo : motivo });
}

const token = (sf: ts.SourceFile, p: number): ts.Node =>
  (ts as unknown as { getTokenAtPosition(sf: ts.SourceFile, p: number): ts.Node }).getTokenAtPosition(sf, p);

function classificarNoCodigo(
  sf: ts.SourceFile,
  pos: number,
  nome: string,
  comum: boolean,
  emForma: boolean,
): [Classe, string] | undefined {
  const t = token(sf, pos);
  if (t.kind >= ts.SyntaxKind.FirstKeyword && t.kind <= ts.SyntaxKind.LastKeyword) return undefined;
  const jsdoc = t.kind >= ts.SyntaxKind.FirstJSDocNode && t.kind <= ts.SyntaxKind.LastJSDocNode;
  const dentro = !jsdoc && pos >= t.getStart(sf) && pos < t.getEnd();
  // Comentário: membro comum só conta na forma de código (`.status`, `status:`, entre crases).
  if (!dentro) return comum && !emForma ? undefined : ['revisar', 'comentário'];
  if (ts.isIdentifier(t) || ts.isPrivateIdentifier(t)) {
    let s = checker.getSymbolAtLocation(t);
    if (s && s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
    const d = s?.declarations?.[0];
    if (d) {
      const onde = `${path.relative(root, d.getSourceFile().fileName)}:${d.getSourceFile().getLineAndCharacterOfPosition(d.getStart()).line + 1}`;
      return ['homonimo', `resolve para ${onde}`];
    }
    // Membro comum sem símbolo (acesso a `any`, chave de um `Record`): só conta se for acesso ou chave.
    if (comum && !(ts.isPropertyAccessExpression(t.parent) || ts.isPropertyAssignment(t.parent))) return undefined;
    return ['revisar', 'identificador sem símbolo'];
  }
  if (ts.isStringLiteralLike(t)) {
    if (comum && t.text !== nome) return undefined;
    // Literal com tipo esperado (`string` livre ou uma união de outro tipo): o typecheck já garante que não é da fase.
    const esperado = ts.isExpression(t) ? checker.getContextualType(t) : undefined;
    if (comum && esperado && !(esperado.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)))
      return ['homonimo', `literal com tipo esperado ${checker.typeToString(esperado).slice(0, 60)}`];
    return ['revisar', 'texto'];
  }
  if (
    t.kind === ts.SyntaxKind.TemplateHead ||
    t.kind === ts.SyntaxKind.TemplateMiddle ||
    t.kind === ts.SyntaxKind.TemplateTail
  ) {
    return comum ? undefined : ['revisar', 'texto'];
  }
  return ['revisar', ts.SyntaxKind[t.kind]];
}

for (const arquivo of arquivos) {
  let texto: string;
  try {
    texto = readFileSync(arquivo, 'utf8');
  } catch {
    continue;
  }
  if (texto.includes('\u0000')) continue;
  const rel = path.relative(root, arquivo);
  const sf = programa.getSourceFile(arquivo);
  const linhaDe = (p: number): number => texto.slice(0, p).split('\n').length;
  const linhas = texto.split('\n');
  const vizinhanca = (p: number, n: number): string => {
    const l = linhaDe(p) - 1;
    return linhas.slice(Math.max(0, l - n), l + n + 1).join('\n');
  };
  /** A seção de Markdown em volta (de um título ao próximo). */
  const secao = (p: number): string => {
    const l = linhaDe(p) - 1;
    let a = l;
    while (a > 0 && !/^#{1,6} /.test(linhas[a] ?? '')) a--;
    let b = l + 1;
    while (b < linhas.length && !/^#{1,6} /.test(linhas[b] ?? '')) b++;
    return linhas.slice(a, b).join('\n');
  };
  const procurar = (nome: string, re: RegExp, comum: boolean): void => {
    for (const m of texto.matchAll(re)) {
      const inicio = (m.index ?? 0) + m[0].indexOf(nome);
      const linha = linhaDe(inicio);
      if (rel.startsWith('docs/adr/')) registrar(nome, arquivo, linha, 'adr', 'prosa histórica do ADR');
      else if (rel.startsWith('spikes/'))
        registrar(nome, arquivo, linha, 'homonimo', 'spike: código descartável, não importa o sinete');
      else if (rel.endsWith('.go')) registrar(nome, arquivo, linha, 'homonimo', 'código Go do helper');
      else if (sf) {
        const antes = texto[inicio - 1] ?? '';
        const depois = texto.slice(inicio + nome.length, inicio + nome.length + 2);
        const emForma = ['.', '`', "'", '"'].includes(antes) || /^(\?:|:|`|'|")/.test(depois);
        const c = classificarNoCodigo(sf, inicio, nome, comum, emForma);
        if (c && c[0] === 'revisar' && c[1] === 'comentário' && comum && !citaODono(nome, vizinhanca(inicio, 10)))
          registrar(nome, arquivo, linha, 'homonimo', 'membro comum num comentário que não cita o dono');
        else if (c) registrar(nome, arquivo, linha, c[0], c[1]);
      } else if (comum && !citaODono(nome, secao(inicio)))
        registrar(nome, arquivo, linha, 'homonimo', 'membro comum numa seção que não cita o dono');
      else registrar(nome, arquivo, linha, 'revisar', 'texto');
    }
  };
  for (const n of topo) if (texto.includes(n)) procurar(n, palavra(n), false);
  const daFase = /^packages\/(core|validators|rejeicoes)\//.test(rel) || USA_A_FASE.test(texto);
  if (rel.endsWith('.json')) {
    // JSON: nos dados da fase, a chave antiga (`"effect":`) é achado; nos outros, é outro formato.
    if (dadosDaFase.has(rel)) for (const n of comuns) procurar(n, new RegExp(`"${esc(n)}"\\s*:`, 'g'), true);
    continue;
  }
  if (sf && !daFase) continue;
  // Fora do código, membros só na prosa (Markdown), e não na referência gerada dos outros pacotes: ela sai dos `.d.ts`,
  // e os `code`, `source` e `status` de lá são dos tipos daqueles pacotes.
  const referenciaDeOutro = /^docs\/guia\/referencia\/(?!core|validators|rejeicoes)/.test(rel);
  if (!sf && (!/\.mdx?$/.test(rel) || referenciaDeOutro)) continue;
  for (const n of comuns) if (texto.includes(n)) procurar(n, sf ? palavra(n) : formaDeCodigo(n), true);
}

// ---------------------------------------------------------------------------------------------------------------------
// Relatório

const porClasse = new Map<Classe, number>();
for (const a of achados) porClasse.set(a.classe, (porClasse.get(a.classe) ?? 0) + 1);
const L: string[] = [
  '# Portão dos nomes antigos',
  '',
  `${topo.size} nomes exportados (palavra em todo texto) e ${comuns.size} membros e literais (forma de código). Fora: CHANGELOG.`,
  '',
  '| Classe | Ocorrências |',
  '|---|---|',
  ...(['revisar', 'excecao', 'adr', 'homonimo'] as const).map((c) => `| ${c} | ${porClasse.get(c) ?? 0} |`),
  '',
  '## Por nome',
  '',
  '| Nome | revisar | exceção | adr | homônimo |',
  '|---|---|---|---|---|',
];
for (const n of [...topo, ...comuns].sort()) {
  const d = achados.filter((a) => a.nome === n);
  if (d.length === 0) continue;
  const c = (k: Classe): number => d.filter((a) => a.classe === k).length;
  L.push(`| \`${n}\` | ${c('revisar')} | ${c('excecao')} | ${c('adr')} | ${c('homonimo')} |`);
}
L.push('', '## A revisar', '');
for (const a of achados.filter((x) => x.classe === 'revisar'))
  L.push(`- ${a.arquivo}:${a.linha} \`${a.nome}\` (${a.motivo})`);
L.push('', '## Exceções aceitas', '');
for (const a of achados.filter((x) => x.classe === 'excecao'))
  L.push(`- ${a.arquivo}:${a.linha} \`${a.nome}\`: ${a.motivo}`);
L.push('', '## Homônimos (amostra por nome)', '');
for (const n of [...topo, ...comuns].sort()) {
  const h = achados.filter((a) => a.nome === n && a.classe === 'homonimo');
  if (h.length > 0)
    L.push(
      `- \`${n}\` (${h.length}): ${h
        .slice(0, 3)
        .map((a) => `${a.arquivo}:${a.linha} ${a.motivo}`)
        .join('; ')}`,
    );
}
const saida = `${L.join('\n')}\n`;
if (arquivoRelatorio) writeFileSync(arquivoRelatorio, saida);
if (arquivoJson) writeFileSync(arquivoJson, `${JSON.stringify(achados, null, 1)}\n`);
else console.log(saida);
const revisar = porClasse.get('revisar') ?? 0;
console.error(
  `portão: ${revisar} a revisar, ${porClasse.get('excecao') ?? 0} exceções, ${porClasse.get('adr') ?? 0} em ADR, ${porClasse.get('homonimo') ?? 0} homônimos`,
);
process.exit(revisar > 0 ? 1 : 0);
