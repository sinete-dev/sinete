#!/usr/bin/env bun
/**
 * Gera o conteúdo do Starlight a partir de `docs/guia/`, a fonte única da documentação (ela vai no tarball do `sinete` e
 * do `@sinete/emissor`). Nada em `src/content/docs/` é escrito à mão nem versionado: cada build apaga a pasta e gera de
 * novo. Por página: o `# H1` vira `title` no frontmatter, e os links relativos `x.md` e `x.md#ancora` viram as rotas
 * do site. A estrutura de pastas é mantida. A ordem das páginas na barra lateral segue a do `index.md` (o alfabeto do
 * nome do arquivo não é a ordem de leitura); as páginas que ele não lista (erros e referência) ficam em ordem alfabética.
 * A raiz do site é a página de abertura (`src/abertura.mdx`, só do site); o `index.md` do guia fica em `/guia/`.
 */
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Glob } from 'bun';

const GUIA = path.resolve(import.meta.dir, '../../../docs/guia');
const DESTINO = path.resolve(import.meta.dir, '../src/content/docs');
/** Páginas sem `# H1` (o bloco do `AGENTS.md` começa em `##`, para caber no arquivo do integrador) e o título delas. */
const TITULOS_FIXOS = new Map([['bloco-agents.md', 'Bloco do AGENTS.md']]);
const ABERTURA = path.resolve(import.meta.dir, '../src/abertura.mdx');

/** Rota do site (com barra inicial e final) de uma página do guia, dada pelo caminho relativo a `docs/guia/`. */
export function rota(pagina: string): string {
  const semExt = pagina.replace(/\.md$/, '');
  const limpa = semExt === 'index' ? 'guia' : semExt.replace(/(^|\/)index$/, '');
  return `/${limpa}/`;
}

/** Reescreve os links `.md` de uma linha fora de bloco de código, sem tocar nos trechos entre crases. */
function reescreverLinhas(linha: string, pagina: string): string {
  return linha
    .split(/(`[^`\n]*`)/)
    .map((trecho, i) => {
      if (i % 2 === 1) return trecho;
      return trecho.replace(/\]\(([^)\s#]+\.md)(#[^)\s]*)?\)/g, (todo, alvo: string, ancora?: string) => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(alvo)) return todo;
        const resolvido = path.posix.normalize(path.posix.join(path.posix.dirname(pagina), alvo));
        return `](${rota(resolvido)}${ancora ?? ''})`;
      });
    })
    .join('');
}

/** Posição de cada página na barra lateral: a ordem em que o `index.md` a cita, e 0 para o índice de cada seção. */
export function ordemDoIndice(indice: string): Map<string, number> {
  const ordem = new Map<string, number>();
  for (const m of indice.matchAll(/\]\(([^)\s#]+\.md)(?:#[^)\s]*)?\)/g)) {
    const alvo = path.posix.normalize(m[1] ?? '');
    if (!ordem.has(alvo)) ordem.set(alvo, ordem.size + 1);
  }
  return ordem;
}

export function converter(pagina: string, texto: string, ordem?: number): string {
  const linhas = texto.split('\n');
  // O frontmatter do SKILL.md (`skill-sinete.md`) é da skill, não do site: sai antes do título.
  if (linhas[0] === '---') linhas.splice(0, linhas.indexOf('---', 1) + 1);
  const h1 = linhas.findIndex((l) => l.startsWith('# '));
  const fixo = TITULOS_FIXOS.get(pagina);
  if (h1 === -1 && fixo === undefined) throw new Error(`${pagina}: sem # H1`);
  let titulo = fixo ?? '';
  if (h1 !== -1) {
    titulo = (linhas[h1] ?? '').slice(2).replaceAll('`', '').trim();
    linhas.splice(h1, linhas[h1 + 1]?.trim() === '' ? 2 : 1);
  }
  let emCodigo = false;
  const corpo = linhas.map((l) => {
    if (l.startsWith('```')) {
      emCodigo = !emCodigo;
      return l;
    }
    return emCodigo ? l : reescreverLinhas(l, pagina);
  });
  const posicao = /(^|\/)index\.md$/.test(pagina) ? 0 : ordem;
  const sidebar = posicao === undefined ? '' : `sidebar:\n  order: ${posicao}\n`;
  return `---\ntitle: ${JSON.stringify(titulo)}\n${sidebar}---\n\n${corpo.join('\n')}`;
}

if (import.meta.main) {
  await rm(DESTINO, { recursive: true, force: true });
  const ordem = ordemDoIndice(await Bun.file(path.join(GUIA, 'index.md')).text());
  let n = 0;
  for await (const pagina of new Glob('**/*.md').scan({ cwd: GUIA })) {
    const saida = path.join(DESTINO, pagina === 'index.md' ? 'guia.md' : pagina);
    await mkdir(path.dirname(saida), { recursive: true });
    await Bun.write(saida, converter(pagina, await Bun.file(path.join(GUIA, pagina)).text(), ordem.get(pagina)));
    n++;
  }
  await Bun.write(path.join(DESTINO, 'index.mdx'), Bun.file(ABERTURA));
  console.log(`site: ${n} páginas geradas em ${path.relative(process.cwd(), DESTINO)}`);
}
