/**
 * Leitura da documentação embarcada (`docs/guia/`), compartilhada pelo build, pelas checagens e pelo gerador.
 *
 * A fonte fica em `docs/guia/`; o build copia a pasta para `docs/` de cada pacote cujo `files` cita `docs` (o
 * guarda-chuva `sinete` e o `@sinete/emissor`), e é essa cópia que vai no tarball.
 */
import path from 'node:path';
import { Glob } from 'bun';
import { root } from './workspace.ts';

export const GUIA: string = path.join(root, 'docs/guia');

/** Arquivos Markdown do guia, relativos a `docs/guia/`, em ordem. */
export async function paginasDoGuia(): Promise<string[]> {
  const out: string[] = [];
  for await (const f of new Glob('**/*.md').scan({ cwd: GUIA })) out.push(f);
  return out.sort();
}

/** Um bloco cercado por ``` com a linguagem e as marcas da linha de abertura (```ts continua). */
export interface Bloco {
  readonly lang: string;
  readonly marcas: readonly string[];
  /** Linha (a partir de 1) da primeira linha do corpo. */
  readonly inicio: number;
  readonly corpo: readonly string[];
}

export function blocosDeCodigo(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let dentro: { lang: string; marcas: string[]; inicio: number; corpo: string[] } | undefined;
  for (const [n, linha] of texto.split('\n').entries()) {
    if (dentro === undefined) {
      const m = /^```(\S*)(.*)$/.exec(linha);
      if (m)
        dentro = {
          lang: m[1] ?? '',
          marcas: (m[2] ?? '').trim().split(/\s+/).filter(Boolean),
          inicio: n + 2,
          corpo: [],
        };
      continue;
    }
    if (linha.startsWith('```')) {
      blocos.push(dentro);
      dentro = undefined;
      continue;
    }
    dentro.corpo.push(linha);
  }
  return blocos;
}

/** Um código de erro lançado pelos pacotes, com a classe e o pacote que o lançam. */
export interface CodigoDeErro {
  readonly code: string;
  readonly classe: string;
  readonly pacote: string;
  readonly arquivo: string;
}

const literais = (s: string): string[] => [...s.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1] ?? '');

/**
 * Códigos de erro tipados, levantados do fonte de `packages/*\/src`: o argumento de tipo de cada classe que estende um
 * erro (`extends SineteError<'x'>`, ou um alias `type XErrorCode = 'a' | 'b'` do mesmo arquivo) e o literal passado a
 * `super('x', ...)` dentro da classe, que é o mais específico (o `PolicyError` lança `politica_recusou` do
 * `TransportErrorCode`). Os aliases `*ErrorCode` entram também, para um código declarado e nunca ligado a uma classe
 * não passar despercebido.
 */
export async function codigosDeErro(): Promise<CodigoDeErro[]> {
  const porCodigo = new Map<string, CodigoDeErro>();
  const soltos = new Map<string, { pacote: string; arquivo: string; alias: string }>();
  const manifests = new Map<string, string>();
  for await (const f of new Glob('packages/*/package.json').scan({ cwd: root })) {
    manifests.set(path.dirname(f), (await Bun.file(path.join(root, f)).json()).name);
  }
  for await (const f of new Glob('packages/*/src/**/*.ts').scan({ cwd: root })) {
    // Sem os comentários de bloco: o TSDoc dentro de uma união (`/** alertas 40 e 42; 116 */ | 'x'`) tem `;`.
    const texto = (await Bun.file(path.join(root, f)).text()).replace(/\/\*[\s\S]*?\*\//g, '');
    if (!/extends \w*Error\b/.test(texto)) continue;
    const pacote = manifests.get(f.split('/').slice(0, 2).join('/')) ?? f;
    const aliases = new Map<string, string[]>();
    for (const m of texto.matchAll(/export type (\w+)\s*=([^;]*);/g)) aliases.set(m[1] ?? '', literais(m[2] ?? ''));
    for (const [alias, codes] of aliases) {
      if (!alias.endsWith('ErrorCode')) continue;
      for (const code of codes) soltos.set(code, { pacote, arquivo: f, alias });
    }
    const classes = [...texto.matchAll(/export class (\w+) extends (\w+)(?:<([^>{]*)>)?\s*\{/g)];
    for (const [i, m] of classes.entries()) {
      const classe = m[1] ?? '';
      const arg = (m[3] ?? '').trim();
      const codes = arg.startsWith("'") ? literais(arg) : (aliases.get(arg) ?? []);
      for (const code of codes) if (!porCodigo.has(code)) porCodigo.set(code, { code, classe, pacote, arquivo: f });
      const fim = classes[i + 1]?.index ?? texto.length;
      const corpo = texto.slice(m.index, fim);
      for (const s of corpo.matchAll(/super\(\s*'([a-z0-9_]+)'/g)) {
        porCodigo.set(s[1] ?? '', { code: s[1] ?? '', classe, pacote, arquivo: f });
      }
    }
  }
  for (const [code, o] of soltos) {
    if (!porCodigo.has(code)) throw new Error(`${o.arquivo}: ${code} está em ${o.alias} mas nenhuma classe o lança`);
  }
  return [...porCodigo.values()].sort((a, b) => a.code.localeCompare(b.code));
}
