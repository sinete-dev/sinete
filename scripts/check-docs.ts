#!/usr/bin/env bun
/**
 * Regras da documentação embarcada (`docs/guia/`), que vai nos tarballs do `sinete` e do `@sinete/emissor`. Os exemplos
 * compilam pelo `check-readme.ts`; as partes geradas ficam em sincronia pelo `docs-gerados.ts --check`. Aqui:
 *
 * - todo código de erro lançado pelos pacotes tem `erros/<code>.md`, e toda página de `erros/` tem um código, com o
 *   título e as seções de sempre (Causa, Correção, Armadilha);
 * - links relativos resolvem e não saem de `docs/guia/` (só essa pasta vai no tarball);
 * - toda página escrita à mão está no `index.md`;
 * - sem travessão, sem os nomes que a doc pública não cita, sem parágrafo quebrado à mão, e CNPJ ou CPF só os de teste;
 * - fora do guia também: nenhum arquivo versionado de `packages/`, `smoke/`, `scripts/`, `tools/`, `docs/`, dos READMEs
 *   e dos changesets cita o sistema do primeiro integrador pelo nome (`lib/nomes.ts`).
 * - o bloco do `AGENTS.md` tem os marcadores, cabe em 8 KB e cita só nomes que a referência do pacote conhece;
 * - a skill (`skill-sinete.md`) tem o frontmatter do padrão Agent Skills (`name: sinete`, `description` de até 1024
 *   caracteres) e a linha que a marca como gerada pelo comando.
 */
import path from 'node:path';
import { blocosDeCodigo, codigosDeErro, GUIA, paginasDoGuia } from './lib/docs.ts';
import { nomesNoRepositorio } from './lib/nomes.ts';

const problemas: string[] = [];
const erro = (onde: string, msg: string): void => {
  problemas.push(`docs/guia/${onde}: ${msg}`);
};

const paginas = await paginasDoGuia();
const texto = new Map<string, string>();
for (const p of paginas) texto.set(p, await Bun.file(path.join(GUIA, p)).text());

// Códigos de erro ------------------------------------------------------------------------------------------------
const codigos = await codigosDeErro();
const comPagina = new Set(
  paginas.filter((p) => p.startsWith('erros/') && p !== 'erros/index.md').map((p) => p.slice(6, -3)),
);
for (const c of codigos) {
  if (!comPagina.has(c.code))
    erro(`erros/${c.code}.md`, `falta a página do código lançado por ${c.classe} (${c.pacote})`);
}
const conhecidos = new Set(codigos.map((c) => c.code));
for (const code of comPagina) {
  const p = `erros/${code}.md`;
  if (!conhecidos.has(code)) erro(p, 'nenhum pacote lança este código');
  const t = texto.get(p) ?? '';
  if (!new RegExp(`^# \`${code}\`: \\S`).test(t)) erro(p, `a primeira linha é \`# \\\`${code}\\\`: título\``);
  for (const secao of ['## Causa', '## Correção', '## Armadilha']) {
    if (!t.includes(`\n${secao}\n`)) erro(p, `falta a seção "${secao}"`);
  }
}

// Links e índice ------------------------------------------------------------------------------------------------
const linkados = new Set<string>();
for (const [p, t] of texto) {
  const semCodigo = t.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of semCodigo.matchAll(/\]\(([^)\s]+)\)/g)) {
    const alvo = m[1] ?? '';
    if (/^[a-z]+:/.test(alvo) || alvo.startsWith('#')) continue;
    const resolvido = path.normalize(path.join(path.dirname(p), alvo.split('#')[0] ?? ''));
    if (resolvido.startsWith('..')) erro(p, `link para fora de docs/guia: ${alvo} (só a pasta vai no tarball)`);
    else if (!texto.has(resolvido)) erro(p, `link quebrado: ${alvo}`);
    if (p === 'index.md') linkados.add(resolvido);
  }
}
for (const p of paginas) {
  if (p === 'index.md' || /^(erros|referencia)\/./.test(p)) continue;
  if (!linkados.has(p)) erro(p, 'a página não está no index.md');
}
for (const p of ['erros/index.md', 'referencia/index.md'])
  if (!linkados.has(p)) erro('index.md', `falta o link para ${p}`);

// Conteúdo --------------------------------------------------------------------------------------------------------
/** CNPJ e CPF sintéticos que o repositório já usa nos testes e fixtures. */
const DOCUMENTOS_DE_TESTE = new Set([
  '11222333000181',
  '44555666000181',
  '11144477735',
  '52998224725',
  // IE de MT dos exemplos (o roteiro da SEFAZ-MT), que tem 11 dígitos como um CPF.
  '00130000019',
]);
const PROIBIDOS: [RegExp, string][] = [
  [/[—–]/, 'travessão (use vírgula, dois-pontos ou outra frase)'],
  [/\bacbr\b/i, 'a doc apresenta o sinete pelo que ele faz, sem citar outro projeto'],
  [/\br[ée]gua\b/i, 'palavra proibida'],
];
for (const [p, t] of texto) {
  const linhas = t.split('\n');
  let emCodigo = false;
  // O frontmatter da skill é YAML, não prosa: uma chave por linha não é parágrafo quebrado.
  const fimFrontmatter = linhas[0] === '---' ? linhas.indexOf('---', 1) : -1;
  for (const [i, l] of linhas.entries()) {
    const onde = `${p}:${i + 1}`;
    if (i <= fimFrontmatter) {
      for (const [re, msg] of PROIBIDOS) if (re.test(l)) erro(onde, msg);
      continue;
    }
    for (const [re, msg] of PROIBIDOS) if (re.test(l)) erro(onde, msg);
    for (const m of l.matchAll(
      /(?<![\dA-Z])(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?![\d])/g,
    )) {
      const digitos = (m[1] ?? '').replace(/\D/g, '');
      const mascara = /^0+$/.test(digitos);
      if ((digitos.length === 14 || digitos.length === 11) && !mascara && !DOCUMENTOS_DE_TESTE.has(digitos)) {
        erro(onde, `${m[1]} parece CNPJ ou CPF e não é um dos de teste do repositório`);
      }
    }
    if (l.startsWith('```')) {
      emCodigo = !emCodigo;
      continue;
    }
    if (emCodigo) continue;
    const prox = linhas[i + 1] ?? '';
    const estrutural = (x: string): boolean => /^(\s*$|#|\s*[-*+] |\s*\d+\. |\||>|<!--|```)/.test(x);
    if (l.trim() && !/^(#|\||<!--)/.test(l) && prox.trim() && !estrutural(prox)) {
      erro(onde, 'parágrafo quebrado à mão: um parágrafo por linha');
    }
  }
}

// Bloco do AGENTS.md -----------------------------------------------------------------------------------------------
const bloco = texto.get('bloco-agents.md');
if (bloco === undefined) erro('bloco-agents.md', 'não existe');
else {
  const corpo = bloco.trimEnd();
  if (!corpo.startsWith('<!-- BEGIN:sinete-agent-rules -->')) erro('bloco-agents.md', 'começa com o marcador BEGIN');
  if (!corpo.endsWith('<!-- END:sinete-agent-rules -->')) erro('bloco-agents.md', 'termina com o marcador END');
  const bytes = new TextEncoder().encode(corpo).length;
  if (bytes > 8192) erro('bloco-agents.md', `${bytes} bytes; o alvo é até 8 KB`);
  if (blocosDeCodigo(corpo).length > 0) erro('bloco-agents.md', 'sem blocos de código: o bloco é índice, não exemplo');
  // Cada linha `- \`sinete/<pacote>...\`: ...` do índice só cita nomes que a referência do pacote conhece.
  for (const [i, l] of corpo.split('\n').entries()) {
    const m = /^- `(?:sinete|@sinete)\/([a-z-]+)[^`]*`[^:]*: (.*)$/.exec(l);
    if (!m) continue;
    const propria = texto.get(`referencia/${m[1]}.md`);
    if (propria === undefined) {
      erro(`bloco-agents.md:${i + 1}`, `sem referência para ${m[1]}`);
      continue;
    }
    // Uma entrada que reexporta outro pacote inteiro (`@sinete/nfe/ibs-cbs`) conhece os nomes dele também.
    const reexportados = [...propria.matchAll(/Reexporta tudo de `@sinete\/([a-z-]+)`/g)].map(
      (r) => texto.get(`referencia/${r[1]}.md`) ?? '',
    );
    const ref = [propria, ...reexportados].join('\n');
    for (const n of (m[2] ?? '').matchAll(/`\.?([A-Za-z_]\w*)(\(\))?`/g)) {
      const nome = n[1] ?? '';
      if (!ref.includes(`\`${nome}\``) && !ref.includes(`\`${nome}()\``)) {
        erro(`bloco-agents.md:${i + 1}`, `\`${nome}\` não aparece na referência de ${m[1]}`);
      }
    }
  }
}

// Skill sinete ------------------------------------------------------------------------------------------------------
const skill = texto.get('skill-sinete.md');
if (skill === undefined) erro('skill-sinete.md', 'não existe');
else {
  const m = /^---\nname: (\S+)\ndescription: (.+)\n---\n/.exec(skill);
  if (!m) erro('skill-sinete.md', 'começa com o frontmatter `name` e `description`, cada um em uma linha, entre `---`');
  else {
    if (m[1] !== 'sinete') erro('skill-sinete.md', '`name` é `sinete` (e o diretório da skill tem o mesmo nome)');
    if ((m[2] ?? '').length > 1024) erro('skill-sinete.md', '`description` passa de 1024 caracteres');
    if (/: /.test(m[2] ?? '')) erro('skill-sinete.md', '`description` com ": " quebra o YAML sem aspas');
  }
  if (!skill.includes('\n<!-- sinete-skill: ')) erro('skill-sinete.md', 'falta a linha `<!-- sinete-skill: ... -->`');
  if (skill.split('\n').length > 500) erro('skill-sinete.md', 'passa de 500 linhas; a skill só aponta para a doc');
}

// Nomes que o repositório não cita, em tudo que é versionado (o guia incluído) -------------------------------------
for (const o of await nomesNoRepositorio()) problemas.push(`${o.arquivo}:${o.linha}: "${o.trecho}": ${o.motivo}`);

for (const p of problemas) console.error(p);
console.log(
  `check-docs: ${paginas.length} página(s), ${codigos.length} código(s) de erro; ${problemas.length} problema(s)`,
);
process.exit(problemas.length ? 1 : 0);
