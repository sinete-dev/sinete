#!/usr/bin/env bun
/**
 * Gera as partes da documentação embarcada que saem do código, para nunca copiar assinatura à mão:
 *
 * - `docs/guia/referencia/<pacote>.md` e `referencia/index.md`: cada entrada publicada de cada pacote, com os nomes
 *   exportados, o tipo, a primeira frase do TSDoc, a assinatura das funções e os membros das interfaces, lidos dos
 *   `.d.ts` de `dist` (rode `bun run build` antes);
 * - `docs/guia/erros/index.md`: os códigos de erro levantados do fonte (`codigosDeErro`), com a classe e o pacote;
 * - `packages/cli/src/bloco-agents.ts`: o bloco do `AGENTS.md` (`docs/guia/bloco-agents.md`) como constante, para o
 *   `sinete agents-md`;
 * - `packages/cli/src/skill-sinete.ts`: o `SKILL.md` (`docs/guia/skill-sinete.md`) como constante, também para o
 *   `sinete agents-md`.
 *
 * Uso: bun scripts/docs-gerados.ts           (escreve)
 *      bun scripts/docs-gerados.ts --check   (falha se algo estiver fora de sincronia; roda no `bun run check`)
 */
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { codigosDeErro, GUIA } from './lib/docs.ts';
import type { ExportTarget, Manifest } from './lib/workspace.ts';
import { rel, root, workspacePackages } from './lib/workspace.ts';

const check = process.argv.includes('--check');
const saida = new Map<string, string>();

// ---------------------------------------------------------------------------------------------------------------
// Leitura dos .d.ts
// ---------------------------------------------------------------------------------------------------------------

type Tipo = 'função' | 'classe' | 'interface' | 'tipo' | 'constante' | 'enum' | 'namespace';
interface Simbolo {
  readonly nome: string;
  readonly tipo: Tipo;
  readonly resumo: string;
  /** Assinaturas das funções, tipo das constantes e dos aliases curtos. */
  readonly assinaturas: readonly string[];
  /** Interfaces e classes: o que estendem e os membros. */
  readonly estende?: string;
  readonly membros?: readonly string[];
}

const textos = new Map<string, string>();
async function ler(file: string): Promise<string> {
  let t = textos.get(file);
  if (t === undefined) {
    t = await Bun.file(file).text();
    textos.set(file, t);
  }
  return t;
}

const semComentarios = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const resolverRel = (de: string, spec: string): string =>
  path.resolve(path.dirname(de), spec.replace(/\.js$/, '.d.ts'));
const nomes = (lista: string): { local: string; exportado: string }[] =>
  lista
    .split(',')
    .map((x) => x.trim().replace(/^type\s+/, ''))
    .filter(Boolean)
    .map((x) => {
      const [local = '', exportado = local] = x.split(/\s+as\s+/);
      return { local, exportado };
    });

/** Onde está a declaração de um nome exportado; `externo` quando ele vem de outro pacote. */
type Onde = { readonly file: string; readonly local: string; readonly externo?: string };

/** Nomes exportados por um `.d.ts`: nome → arquivo e nome local da declaração; `*` de pacote externo à parte. */
async function exportados(
  file: string,
  visitados = new Set<string>(),
): Promise<{ nomes: Map<string, Onde>; externos: string[] }> {
  const out = new Map<string, Onde>();
  const externos: string[] = [];
  if (visitados.has(file)) return { nomes: out, externos };
  visitados.add(file);
  const t = semComentarios(await ler(file));
  const importados = new Map<string, Onde>();
  for (const m of t.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const spec = m[2] ?? '';
    for (const n of nomes(m[1] ?? '')) {
      importados.set(
        n.exportado,
        spec.startsWith('.')
          ? { file: resolverRel(file, spec), local: n.local }
          : { file, local: n.local, externo: spec },
      );
    }
  }
  for (const m of t.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}(?:\s*from\s*'([^']+)')?/g)) {
    const spec = m[2];
    for (const n of nomes(m[1] ?? '')) {
      if (spec === undefined) out.set(n.exportado, importados.get(n.local) ?? { file, local: n.local });
      else if (spec.startsWith('.')) out.set(n.exportado, { file: resolverRel(file, spec), local: n.local });
      else out.set(n.exportado, { file, local: n.local, externo: spec });
    }
  }
  for (const m of t.matchAll(/export\s+\*\s+from\s*'([^']+)'/g)) {
    const spec = m[1] ?? '';
    if (!spec.startsWith('.')) {
      externos.push(spec);
      continue;
    }
    const sub = await exportados(resolverRel(file, spec), visitados);
    for (const [k, v] of sub.nomes) if (!out.has(k)) out.set(k, v);
    externos.push(...sub.externos);
  }
  for (const m of t.matchAll(
    /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:function|class|interface|type|const|let|enum|namespace)\s+(\w+)/gm,
  )) {
    out.set(m[1] ?? '', { file, local: m[1] ?? '' });
  }
  return { nomes: out, externos };
}

/** Fim da declaração que começa em `i`: o `;` fora de parênteses, chaves e colchetes, ou o `}` que fecha o corpo. */
function fimDaDeclaracao(t: string, i: number, comCorpo: boolean): number {
  let prof = 0;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (c === '(' || c === '{' || c === '[') prof++;
    else if (c === ')' || c === '}' || c === ']') {
      prof--;
      if (comCorpo && prof === 0 && c === '}') return j + 1;
    } else if (c === ';' && prof === 0) return j + 1;
  }
  return t.length;
}

function resumoDo(doc: string): string {
  const texto = doc
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()
    .split(/\n\s*\n/)[0]
    ?.replace(/\s+/g, ' ')
    .replace(/\{@link\s+([^}\s|]+)[^}]*\}/g, '`$1`')
    .trim();
  if (!texto) return '';
  // O primeiro parágrafo inteiro, se curto; senão a primeira frase: até o ponto seguido de espaço e maiúscula, fora de
  // código entre crases e de texto entre aspas.
  if (texto.length <= 300) return texto;
  let crase = false;
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '`') crase = !crase;
    if (texto[i] === '"' && !crase) aspas = !aspas;
    if (!crase && !aspas && texto[i] === '.' && /^\s+[A-ZÀ-Ú`(]/.test(texto.slice(i + 1, i + 3))) {
      return texto.slice(0, i + 1);
    }
  }
  return texto;
}

const compacto = (s: string, max: number): string => {
  const c = s
    .replace(/\s+/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/,\s*\)/g, ')')
    .trim();
  return c.length > max ? `${c.slice(0, max - 1).trimEnd()}…` : c;
};

function membrosDe(corpo: string): string[] {
  const out: string[] = [];
  let prof = 0;
  let linha = '';
  const inner = semComentarios(corpo).slice(corpo.indexOf('{') + 1, -1);
  const flush = (): void => {
    const m = /^(?:readonly\s+|static\s+|protected\s+|private\s+|get\s+)*(\w+)(\?)?\s*(\(|<|:)/.exec(linha.trim());
    if (m && !/^(private|protected|constructor)\b/.test(linha.trim())) {
      const nome = `${m[1]}${m[3] === ':' ? '' : '()'}`;
      if (!out.includes(nome)) out.push(nome);
    }
    linha = '';
  };
  for (const c of inner) {
    if (c === '(' || c === '{' || c === '[') prof++;
    if (c === ')' || c === '}' || c === ']') prof--;
    if (prof === 0 && (c === ';' || c === '\n')) {
      if (linha.trim()) flush();
      continue;
    }
    linha += c;
  }
  if (linha.trim()) flush();
  return out;
}

async function simbolo(nome: string, onde: Onde): Promise<Simbolo | undefined> {
  if (onde.externo !== undefined) {
    return {
      nome,
      tipo: 'tipo',
      resumo: `reexportado de \`${onde.externo}\` (veja a referência dele).`,
      assinaturas: [],
    };
  }
  const t = await ler(onde.file);
  const re = new RegExp(
    `^(?:export\\s+)?(?:declare\\s+)?(?:abstract\\s+)?(function|class|interface|type|const|let|enum|namespace)\\s+${onde.local}\\b`,
    'gm',
  );
  const achados = [...t.matchAll(re)];
  const primeiro = achados[0];
  if (primeiro === undefined) {
    // Reexportado de novo por um `export { x } from` noutro arquivo.
    const sub = (await exportados(onde.file)).nomes.get(onde.local);
    return sub && (sub.externo !== undefined || sub.file !== onde.file) ? simbolo(nome, sub) : undefined;
  }
  const antes = t.slice(0, primeiro.index).trimEnd();
  const doc = antes.endsWith('*/') ? antes.slice(antes.lastIndexOf('/**')) : '';
  const kw = primeiro[1] ?? '';
  const tipo: Tipo =
    kw === 'function'
      ? 'função'
      : kw === 'class'
        ? 'classe'
        : kw === 'interface'
          ? 'interface'
          : kw === 'type'
            ? 'tipo'
            : kw === 'enum'
              ? 'enum'
              : kw === 'namespace'
                ? 'namespace'
                : 'constante';
  const assinaturas: string[] = [];
  let estende: string | undefined;
  let membros: string[] | undefined;
  for (const m of achados) {
    const i = m.index ?? 0;
    const comCorpo = tipo === 'classe' || tipo === 'interface' || tipo === 'enum' || tipo === 'namespace';
    const decl = t.slice(i, fimDaDeclaracao(t, i, comCorpo));
    const sem = decl.replace(/^export\s+/, '').replace(/^declare\s+/, '');
    if (tipo === 'função') assinaturas.push(compacto(sem.replace(/^function\s+/, '').replace(/;$/, ''), 400));
    else if (tipo === 'constante')
      assinaturas.push(compacto(sem.replace(/^(const|let)\s+/, '').replace(/;$/, ''), 240));
    else if (tipo === 'tipo') {
      const c = compacto(sem.replace(/;$/, ''), 240);
      if (!c.endsWith('…')) assinaturas.push(c);
    } else if (tipo === 'interface' || tipo === 'classe') {
      const cab = sem.slice(0, sem.indexOf('{'));
      const e = /\b(?:extends|implements)\s+(.*)$/s.exec(cab);
      if (e) estende = compacto(e[1] ?? '', 200);
      membros = membrosDe(sem);
    }
  }
  return {
    nome,
    tipo,
    resumo: resumoDo(doc),
    assinaturas,
    ...(estende === undefined ? {} : { estende }),
    ...(membros === undefined ? {} : { membros }),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Referência
// ---------------------------------------------------------------------------------------------------------------

/** Arquivos de tipos de uma entrada: `default` e, quando existe, a condição `node`. */
function tiposDe(alvo: ExportTarget): { node?: string; padrao?: string } {
  if (alvo === null || typeof alvo === 'string') return {};
  const tipos = (t: ExportTarget): string | undefined =>
    t !== null && typeof t === 'object' && typeof t.types === 'string' ? t.types : undefined;
  if (typeof alvo.types === 'string') return { padrao: alvo.types };
  const node = alvo.node === undefined ? undefined : tipos(alvo.node);
  const padrao = alvo.default === undefined ? undefined : tipos(alvo.default);
  return { ...(node === undefined ? {} : { node }), ...(padrao === undefined ? {} : { padrao }) };
}

const ORDEM: readonly Tipo[] = ['função', 'classe', 'interface', 'tipo', 'constante', 'enum', 'namespace'];
const TITULO: Record<Tipo, string> = {
  função: 'Funções',
  classe: 'Classes',
  interface: 'Interfaces',
  tipo: 'Tipos',
  constante: 'Constantes',
  enum: 'Enums',
  namespace: 'Namespaces',
};

function linhaDo(s: Simbolo, soNode: boolean): string {
  const partes = [`- \`${s.nome}\``];
  const extra = [s.estende ? `estende \`${s.estende}\`` : '', soNode ? 'só na condição `node`' : ''].filter(Boolean);
  if (extra.length > 0) partes.push(`(${extra.join('; ')})`);
  let t = partes.join(' ');
  if (s.resumo) t += `: ${s.resumo}`;
  else if (s.assinaturas.length > 0) t += ':';
  for (const a of s.assinaturas) t += ` \`${a}\``;
  if (s.membros && s.membros.length > 0) {
    t += `${s.resumo ? '' : ':'} Membros: ${s.membros.map((m) => `\`${m}\``).join(', ')}.`;
  }
  return t;
}

/** Módulos gerados do XSD: a referência só aponta para eles, porque são milhares de tipos com o nome do schema. */
const ehGeradoDoXsd = (m: Manifest, sub: string): boolean => m.name === '@sinete/schemas' && sub !== '.';

const CABECALHO = (nome: string): string =>
  `# Referência: \`${nome}\`\n\nGerado dos \`.d.ts\` publicados por \`scripts/docs-gerados.ts\`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos \`.d.ts\` do pacote instalado (\`node_modules/${nome}/dist/\`), que é a palavra final. Pelo guarda-chuva, \`${nome}/x\` é \`sinete/${nome.replace('@sinete/', '')}/x\`.\n`;

const pacotes = (await workspacePackages()).filter((p) => !p.manifest.private && p.manifest.name !== 'sinete');
const indice: string[] = [];
for (const { dir, manifest: m } of pacotes) {
  const slug = m.name.replace('@sinete/', '');
  const partes = [CABECALHO(m.name)];
  const entradas: string[] = [];
  for (const [sub, alvo] of Object.entries(m.exports ?? {})) {
    if (sub === './package.json') continue;
    const spec = sub === '.' ? m.name : `${m.name}/${sub.slice(2)}`;
    const { node, padrao } = tiposDe(alvo);
    if (ehGeradoDoXsd(m, sub)) {
      entradas.push(`\`${spec}\``);
      partes.push(
        `## \`${spec}\`\n\nCódigo gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e \`schema\` com a proveniência. Os tipos estão em \`node_modules/${m.name}/${(padrao ?? '').replace(/^\.\//, '')}\`.\n`,
      );
      continue;
    }
    const base = padrao ?? node;
    if (base === undefined) continue;
    const exp = await exportados(path.join(dir, base));
    const expNode = node !== undefined && padrao !== undefined ? await exportados(path.join(dir, node)) : undefined;
    const todos = new Map(exp.nomes);
    for (const [k, v] of expNode?.nomes ?? []) if (!todos.has(k)) todos.set(k, v);
    if (todos.size === 0 && exp.externos.length === 0) continue;
    entradas.push(`\`${spec}\``);
    const cab = /^\/\*\*[\s\S]*?\*\//.exec((await ler(path.join(dir, base))).trimStart());
    partes.push(`## \`${spec}\`\n`);
    if (cab) partes.push(`${resumoDoModulo(cab[0])}\n`);
    for (const e of new Set(exp.externos)) partes.push(`Reexporta tudo de \`${e}\` (veja a referência dele).\n`);
    const simbolos: { s: Simbolo; soNode: boolean }[] = [];
    for (const [nome, onde] of [...todos].sort(([a], [b]) => a.localeCompare(b))) {
      const s = await simbolo(nome, onde);
      if (s === undefined) throw new Error(`${m.name}: declaração de ${nome} não encontrada em ${rel(onde.file)}`);
      simbolos.push({ s, soNode: expNode !== undefined && !exp.nomes.has(nome) });
    }
    for (const tipo of ORDEM) {
      const doTipo = simbolos.filter((x) => x.s.tipo === tipo);
      if (doTipo.length === 0) continue;
      partes.push(`### ${TITULO[tipo]}\n\n${doTipo.map((x) => linhaDo(x.s, x.soNode)).join('\n')}\n`);
    }
  }
  saida.set(path.join(GUIA, 'referencia', `${slug}.md`), partes.join('\n'));
  indice.push(`| [\`${m.name}\`](${slug}.md) | ${m.description ?? ''} | ${entradas.join(', ')} |`);
}

function resumoDoModulo(doc: string): string {
  return doc
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

saida.set(
  path.join(GUIA, 'referencia', 'index.md'),
  `# Referência dos pacotes\n\nGerada dos \`.d.ts\` publicados; não edite à mão. Uma página por pacote, com cada entrada (subpath) e os nomes que ela exporta. O guarda-chuva \`sinete\` reexporta cada entrada como \`sinete/<pacote>[/<subpath>]\` (\`@sinete/emissor/nfe\` é \`sinete/emissor/nfe\`), sem raiz, fora o \`@sinete/sefaz-sim\`, que é ferramenta de teste e fica fora dele.\n\n| Pacote | O que é | Entradas |\n|---|---|---|\n${indice.join('\n')}\n`,
);

// ---------------------------------------------------------------------------------------------------------------
// Índice dos erros
// ---------------------------------------------------------------------------------------------------------------

const codigos = await codigosDeErro();
const porPacote = new Map<string, typeof codigos>();
for (const c of codigos) porPacote.set(c.pacote, [...(porPacote.get(c.pacote) ?? []), c]);
const linhasErros: string[] = [];
for (const [pacote, cs] of [...porPacote].sort(([a], [b]) => a.localeCompare(b))) {
  linhasErros.push(`\n## \`${pacote}\`\n`);
  for (const c of cs) {
    const pagina = path.join(GUIA, 'erros', `${c.code}.md`);
    const titulo = (await Bun.file(pagina).exists())
      ? (/^# `[^`]+`: (.*)$/m.exec(await Bun.file(pagina).text())?.[1] ?? '')
      : '';
    linhasErros.push(`- [\`${c.code}\`](${c.code}.md) (\`${c.classe}\`)${titulo ? `: ${titulo}` : ''}`);
  }
}
saida.set(
  path.join(GUIA, 'erros', 'index.md'),
  `# Códigos de erro\n\nGerado do fonte por \`scripts/docs-gerados.ts\`; não edite à mão. Todo erro lançado pelo sinete é um \`SineteError\` com \`code\` estável e \`docs\`, o caminho da página do código nesta pasta (\`erros/<code>.md\`). Decida pelo \`code\` (ou por \`isSineteError(e, code)\`), nunca pela mensagem. Rejeição da SEFAZ não é erro lançado: é desfecho (\`status: 'rejected'\` no cliente, \`tipo: 'recusado'\` no emissor), e o catálogo de rejeições é o \`@sinete/rejeicoes\`.\n${linhasErros.join('\n')}\n`,
);

// ---------------------------------------------------------------------------------------------------------------
// Bloco do AGENTS.md
// ---------------------------------------------------------------------------------------------------------------

const bloco = (await Bun.file(path.join(GUIA, 'bloco-agents.md')).text()).trimEnd();
const escapado = bloco.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
saida.set(
  path.join(root, 'packages/cli/src/bloco-agents.ts'),
  `// GERADO por scripts/docs-gerados.ts a partir de docs/guia/bloco-agents.md. Não edite: rode \`bun scripts/docs-gerados.ts\`.\n/** O bloco do sinete para o \`AGENTS.md\` do integrador, com os marcadores. */\nexport const BLOCO_AGENTS: string = \`${escapado}\n\`;\n`,
);

const skill = (await Bun.file(path.join(GUIA, 'skill-sinete.md')).text()).trimEnd();
const skillEscapada = skill.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
saida.set(
  path.join(root, 'packages/cli/src/skill-sinete.ts'),
  `// GERADO por scripts/docs-gerados.ts a partir de docs/guia/skill-sinete.md. Não edite: rode \`bun scripts/docs-gerados.ts\`.\n/** O \`SKILL.md\` da skill \`sinete\` que o \`sinete agents-md\` grava no projeto do integrador. */\nexport const SKILL_SINETE: string = \`${skillEscapada}\n\`;\n`,
);

// ---------------------------------------------------------------------------------------------------------------

const problemas: string[] = [];
const refDir = path.join(GUIA, 'referencia');
const sobras = (await readdir(refDir).catch(() => [] as string[]))
  .map((f) => path.join(refDir, f))
  .filter((f) => !saida.has(f));
if (check) {
  for (const [f, texto] of saida) {
    const atual = (await Bun.file(f).exists()) ? await Bun.file(f).text() : undefined;
    if (atual !== texto) problemas.push(rel(f));
  }
  for (const f of sobras) problemas.push(`${rel(f)} (sobra)`);
  if (problemas.length > 0) {
    console.error(
      `docs-gerados: fora de sincronia, rode \`bun scripts/docs-gerados.ts\`:\n  ${problemas.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log(`docs-gerados: ${saida.size} arquivo(s) em sincronia`);
} else {
  await mkdir(refDir, { recursive: true });
  for (const f of sobras) await rm(f);
  for (const [f, texto] of saida) await Bun.write(f, texto);
  console.log(`docs-gerados: ${saida.size} arquivo(s) escrito(s)`);
}
