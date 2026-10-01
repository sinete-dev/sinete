#!/usr/bin/env bun
/**
 * Builder reprodutível do catálogo de rejeições do MDF-e (`packages/rejeicoes/src/data/rejeicoes-mdfe.json`).
 *
 * Entrada: os PDFs oficiais listados em `sources-mdfe.json` (conferidos pelo sha256), extraídos com
 * `pdftotext -layout`, mais a curadoria em `curadoria-mdfe.json`. O MDF-e não tem tabela consolidada de rejeições como a
 * 4.4.2 da NF-e: o catálogo é a união das regras de validação do Anexo I (grupo F), da Visão Geral (grupos A a K e
 * consumo indevido) e das NT posteriores ao MOC 3.00b. Cada linha `<regra> ... Obrig.|Facult. <código> Rej. Rejeição:
 * <mensagem>` dá o id da regra e a mensagem, reconstituída pela posição da coluna da mensagem (como no builder da
 * NF-e). Quando o código aparece em mais de uma regra com texto diferente, todas as mensagens ficam em `mensagens`.
 *
 * Uso:
 *   bun tools/rejeicoes-data/mdfe.ts --pdf-dir <dir com os PDFs> [--check]
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $ } from 'bun';
import type { DescricaoTabelaRejeicoes } from '../../packages/rejeicoes/src/index.ts';
import type { RejeicaoMdfe } from '../../packages/rejeicoes/src/mdfe.ts';

type Doc = {
  id: string;
  title: string;
  versao: string;
  citation: string;
  url: string;
  file: string;
  sha256: string;
  from: string;
  to: string | null;
};
type Category = 'schema' | 'assinatura' | 'certificado' | 'cadastro' | 'regra-negocio' | 'duplicidade';
type Curated = {
  category?: Category;
  causaProvavel?: string;
  comoCorrigir?: string;
  referencia?: string;
  orientacao?: string;
};
type Entry = {
  code: string;
  message: string;
  messages?: string[];
  source: string;
  rules: { doc: string; id: string }[];
  category: Category;
  causaProvavel?: string;
  comoCorrigir?: string;
  referencia?: string;
  orientacao?: string;
};

const here = import.meta.dir;
const root = path.resolve(here, '../..');
const out = path.join(root, 'packages/rejeicoes/src/data/rejeicoes-mdfe.json');
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const pdfDir = arg('--pdf-dir') ?? process.env.SINETE_PDF_DIR;
if (!pdfDir) {
  console.error('rejeicoes-data: informe --pdf-dir (ou SINETE_PDF_DIR) com os PDFs de sources-mdfe.json');
  process.exit(1);
}
if (!Bun.which('pdftotext')) {
  console.error('rejeicoes-data: pdftotext não encontrado (poppler: brew install poppler, apt install poppler-utils)');
  process.exit(1);
}

const sources = (await Bun.file(path.join(here, 'sources-mdfe.json')).json()) as {
  retrievedAt: string;
  documents: Doc[];
};
const curadoria = (await Bun.file(path.join(here, 'curadoria-mdfe.json')).json()) as {
  entries: Record<string, Curated>;
  /** Mensagens que a checagem de corte aponta mas estão assim no PDF oficial, com a justificativa. */
  sanityAllow?: Record<string, string>;
  /**
   * Códigos citados nas regras sem a mensagem na mesma célula (a regra de consumo indevido só dá o código 678): a
   * mensagem vem do texto do mesmo documento, citado em `fonte`.
   */
  mensagens?: Record<string, { message: string; source: string; rule: string; doc: string }>;
};

// 1. Confere os PDFs e extrai o texto
const texts = new Map<string, string[]>();
const work = await mkdtemp(path.join(tmpdir(), 'sinete-rejeicoes-mdfe-'));
try {
  for (const d of sources.documents) {
    const file = path.join(pdfDir, d.file);
    const bytes = new Uint8Array(await Bun.file(file).arrayBuffer());
    const sha = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
    if (sha !== d.sha256) {
      console.error(`rejeicoes-data: ${d.file} com sha256 ${sha}, esperado ${d.sha256}`);
      process.exit(1);
    }
    const txt = path.join(work, `${d.id}.txt`);
    await $`pdftotext -layout ${file} ${txt}`.quiet();
    texts.set(d.id, (await Bun.file(txt).text()).split('\n'));
  }
} finally {
  await rm(work, { recursive: true, force: true });
}

/**
 * Marcador da mensagem (`[nProt:999999999999999]`, `[dhEnc: AAAA-MM-DDTHH:MM:SS TZD]`) partido pela quebra de linha da
 * célula no PDF (`[nPro t:9999 99999999999]`): junta o nome e os algarismos, preservando o espaço depois dos dois pontos
 * e o de antes do `TZD`.
 */
const marcador = (s: string): string =>
  s.replace(/\[([A-Za-z][A-Za-z ]*):(\s*)([0-9XA-Z:\- ]+)\]/g, (_all, nome: string, sep: string, valor: string) => {
    const v = valor
      .replace(/-\s+/g, '-')
      .replace(/([0-9X])\s+(?=[0-9X])/g, '$1')
      .trim();
    return `[${nome.replace(/\s+/g, '')}:${sep}${v}]`;
  });

const clean = (s: string): string =>
  marcador(
    s
      .replace(/^\s*(Rejeição:\s*)+/, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:)\]])/g, '$1')
      .replace(/([([])\s+/g, '$1')
      .trim(),
  );

/** Cabeçalho e rodapé de página e cabeçalho das tabelas de regras, que não encerram a mensagem. */
const isChrome = (l: string): boolean =>
  /^\s*$/.test(l) ||
  /Página \d+ \/ \d+/.test(l) ||
  /^\s*\d{1,2}\s*$/.test(l) ||
  /^\s*M?Manifesto Eletrônico de Documentos Fiscais\s*$/.test(l) ||
  /^\s*Projeto\s*$/.test(l) ||
  /^\s*MOC 3\.00b\s*$/.test(l) ||
  /^\s*NT 20\d\d\.\d{3} v\d\.\d\d\s*$/.test(l) ||
  /^\s*#?\s*Regra de Validação\s+Aplic/.test(l);

const RULE_ID = /^\s*([A-Z]{1,2}\d{1,3}[a-z]?)\s/;
/** Aplicação (Obrig., Facult., com as grafias do PDF), código, efeito e o começo da mensagem. */
const ROW =
  /\b(?:Obrig[a-z]*|Obirg|Facul[a-z]*)[.,]*\s+(\d{3,4})\.?\s+(?:(?:Rej|Den)[a-z]*[.,;]?|-)?\s*(Rejeição:?|Uso Denegado:?|(?=Serviço Paralisado))?\s*(.*)$/d;
const CONTINUATION_STOP = /^(\d+\s*=|Observa[çc][ãa]o|Obs\.|Nota( \d+)?:|Exce[çc][ãa]o|Retornar\b)/;

type Row = { code: string; rule: string; message: string; leftover?: string };

function parse(doc: Doc): Row[] {
  const ls = texts.get(doc.id) ?? [];
  const from = new RegExp(doc.from);
  const start = ls.findIndex((l) => from.test(l));
  if (start < 0) throw new Error(`${doc.id}: início ${doc.from} não encontrado`);
  const to = doc.to === null ? undefined : new RegExp(doc.to);
  const endAt = to ? ls.findIndex((l, i) => i > start && to.test(l)) : -1;
  const end = endAt < 0 ? ls.length : endAt;
  const rows: Row[] = [];
  const ruleAt = (i: number): string => {
    for (let k = i; k >= Math.max(start, i - 4); k--) {
      const l = ls[k] ?? '';
      if (k < i && ROW.test(l)) break;
      const id = RULE_ID.exec(l);
      if (id) return id[1] ?? '';
    }
    return '';
  };
  for (let i = start; i < end; i++) {
    const l = ls[i] ?? '';
    const m = ROW.exec(l);
    if (!m) continue;
    // A coluna é a do "Rejeição:" (as linhas de continuação se alinham a ela), ou a da própria mensagem sem prefixo.
    let col = m.indices?.[2]?.[0] ?? m.indices?.[3]?.[0] ?? -1;
    let message = m[3] ?? '';
    if (message.trim() === '') {
      // Mensagem acima da linha do código (F95 a F98): procura o "Rejeição:" até 4 linhas acima e junta o que está na
      // coluna dela até a linha do código.
      for (let k = i - 1; k >= Math.max(start, i - 4); k--) {
        const up = ls[k] ?? '';
        if (ROW.test(up)) break;
        const at = up.indexOf('Rejeição:');
        if (at < 0) continue;
        col = at;
        const parts = [up.slice(at + 'Rejeição:'.length)];
        for (let q = k + 1; q < i; q++) {
          const seg = [...(ls[q] ?? '').matchAll(/\S+(?: \S+)*/g)].at(-1);
          if (seg && (seg.index ?? 0) >= at - 6) parts.push(seg[0]);
        }
        message = parts.join(' ');
        break;
      }
      if (message.trim() === '') continue;
    }
    let j = i + 1;
    let stopped = false;
    for (; j < end; j++) {
      const n = ls[j] ?? '';
      if (isChrome(n)) continue;
      if (ROW.test(n)) break;
      const seg = [...n.matchAll(/\S+(?: \S+)*/g)].at(-1);
      if (!seg || (seg.index ?? 0) < col - 6) {
        // Frase que continua em minúscula depois de uma linha só com a descrição da regra (F94): anexa e segue.
        const next = ls[j + 1] ?? '';
        const nseg = [...next.matchAll(/\S+(?: \S+)*/g)].at(-1);
        if (
          !/[.\]]$/.test(message.trim()) &&
          !ROW.test(next) &&
          nseg &&
          (nseg.index ?? 0) >= col - 6 &&
          /^[a-zà-ú0-9]/.test(nseg[0])
        ) {
          message += ` ${nseg[0]}`;
          j++;
          continue;
        }
        break;
      }
      if (CONTINUATION_STOP.test(seg[0]) || /^Rejeição:/.test(seg[0])) {
        stopped = true;
        break;
      }
      message += ` ${seg[0]}`;
    }
    let leftover: string | undefined;
    for (let k = j, seen = 0; !stopped && k < end && seen < 3; k++) {
      const n = ls[k] ?? '';
      if (isChrome(n)) continue;
      if (ROW.test(n)) break;
      seen++;
      const seg = [...n.matchAll(/\S+(?: \S+)*/g)].at(-1);
      if (seg && (seg.index ?? 0) >= col - 6 && /^[a-zà-ú]/.test(seg[0])) {
        leftover = seg[0];
        break;
      }
    }
    rows.push({
      code: m[1] ?? '',
      rule: ruleAt(i),
      message: clean(message),
      ...(leftover === undefined ? {} : { leftover }),
    });
  }
  return rows;
}

function categorize(message: string): Category {
  const m = message.toLowerCase();
  if (/duplicidade|duplicad|já está (cancelad|encerrad)/.test(m)) return 'duplicidade';
  if (/certificado|cadeia de certifica|lcr\b|icp-brasil/.test(m)) return 'certificado';
  if (/assinatura|digest|signature/.test(m)) return 'assinatura';
  if (/schema|mal-formado|namespace|utf-8|tamanho da mensagem|caracteres de edição|versão informada|compacta/.test(m))
    return 'schema';
  if (/não cadastrad|não habilitad|não vinculad|\b(cnpj|cpf|ie)\b[^,]{0,40}inválid/.test(m)) return 'cadastro';
  return 'regra-negocio';
}

// 2. União
const entries = new Map<string, Entry>();
const allRows: Row[] = [];
for (const doc of sources.documents) {
  for (const r of parse(doc)) {
    allRows.push(r);
    let e = entries.get(r.code);
    if (!e) {
      e = {
        code: r.code,
        message: r.message,
        source: r.rule ? `${doc.citation}, regra ${r.rule}` : doc.citation,
        rules: [],
        category: 'regra-negocio',
      };
      entries.set(r.code, e);
    } else if (r.message !== e.message && !(e.messages ?? []).includes(r.message)) {
      e.messages = [...(e.messages ?? [e.message]), r.message];
    }
    if (r.rule && !e.rules.some((x) => x.doc === doc.id && x.id === r.rule)) e.rules.push({ doc: doc.id, id: r.rule });
  }
}
for (const [code, c] of Object.entries(curadoria.mensagens ?? {})) {
  const e = entries.get(code);
  if (e && e.message !== '') continue;
  const rules = [...(e?.rules ?? [])];
  if (!rules.some((x) => x.doc === c.doc && x.id === c.rule)) rules.push({ doc: c.doc, id: c.rule });
  entries.set(code, { code, message: c.message, source: c.source, rules, category: 'regra-negocio' });
}

const unknownCurated = Object.keys(curadoria.entries).filter((c) => !entries.has(c));
if (unknownCurated.length > 0) {
  console.error(`rejeicoes-data: curadoria cita códigos fora do catálogo: ${unknownCurated.join(', ')}`);
  process.exit(1);
}
// `orientacao` é o texto para quem emite e só existe sobre uma curadoria completa (causa, correção e regra).
const orientacaoSolta = Object.entries(curadoria.entries)
  .filter(([, c]) => c.orientacao !== undefined && !(c.causaProvavel && c.comoCorrigir && c.referencia))
  .map(([code]) => code);
if (orientacaoSolta.length > 0) {
  console.error(
    `rejeicoes-data: orientacao sem causaProvavel, comoCorrigir e referencia: ${orientacaoSolta.join(', ')}`,
  );
  process.exit(1);
}

// A saída tem o tipo do pacote: um membro renomeado no `@sinete/rejeicoes` quebra a compilação aqui, e não o JSON.
const result: RejeicaoMdfe[] = [...entries.values()]
  .sort((a, b) => Number(a.code) - Number(b.code))
  .map((e): RejeicaoMdfe => {
    const c = curadoria.entries[e.code] ?? {};
    return {
      codigo: e.code,
      efeito: 'rejeicao',
      mensagem: e.message,
      ...(e.messages ? { mensagens: e.messages } : {}),
      modelos: ['58'],
      fonte: e.source,
      regras: e.rules.map((r) => ({ documento: r.doc, id: r.id })),
      categoria: c.category ?? categorize(e.message),
      ...(c.causaProvavel ? { causaProvavel: c.causaProvavel } : {}),
      ...(c.comoCorrigir ? { comoCorrigir: c.comoCorrigir } : {}),
      ...(c.referencia ? { referencia: c.referencia } : {}),
      ...(c.orientacao ? { orientacao: c.orientacao } : {}),
    };
  });

// 3. Checagem de corte, como no builder da NF-e
const DANGLING = /\s(a|o|as|os|ao|aos|e|ou|de|da|do|das|dos|com|para|por|no|na|nos|nas|em|um|uma|que|se|sem)$/i;
const balanced = (m: string, open: string, close: string): boolean => m.split(open).length === m.split(close).length;
const allow = curadoria.sanityAllow ?? {};
const suspects: string[] = [];
for (const e of entries.values()) {
  const leftover = allRows.find((r) => r.code === e.code && r.leftover !== undefined)?.leftover;
  for (const m of e.messages ?? [e.message]) {
    const why = [
      m === '' ? 'mensagem vazia' : '',
      DANGLING.test(m) ? 'termina em palavra de ligação' : '',
      balanced(m, '(', ')') && balanced(m, '[', ']') ? '' : 'parêntese ou colchete sem fechar',
      leftover === undefined ? '' : `continuação não anexada: "${leftover}"`,
    ].filter(Boolean);
    if (why.length > 0 && !allow[e.code]) suspects.push(`${e.code} (${why.join('; ')}): ${m}`);
  }
}
if (suspects.length > 0) {
  console.error(`rejeicoes-data: ${suspects.length} mensagem(ns) com sinal de corte:`);
  for (const x of suspects) console.error(`  ${x}`);
  process.exit(1);
}

const data: DescricaoTabelaRejeicoes & { geradoPor: string; notas: string; rejeicoes: readonly RejeicaoMdfe[] } = {
  versaoDoFormato: 1,
  versao: sources.retrievedAt.replaceAll('-', '.'),
  geradoPor: 'tools/rejeicoes-data/mdfe.ts',
  fontes: sources.documents.map((d) => ({
    id: d.id,
    titulo: d.title,
    versao: d.versao,
    citacao: d.citation,
    url: d.url,
    sha256: d.sha256,
    coletadoEm: sources.retrievedAt,
  })),
  notas:
    'MDF-e (modelo 58): união das regras de validação do MOC 3.00b (Anexo I, grupo F; Visão Geral, grupos A a K e consumo indevido) e das NT 2024.001, 2024.002, 2025.001 e 2026.001. O MDF-e não tem tabela consolidada de rejeições; código que aparece em regras com textos diferentes traz todos em `mensagens`. Mensagem oficial sem ajuste. Os códigos colidem com os da NF-e com outro significado: use este catálogo só para MDF-e.',
  rejeicoes: result,
};
const biome = path.join(root, 'node_modules/.bin/biome');
const json = await $`${biome} format --stdin-file-path=${out} < ${new Response(`${JSON.stringify(data, null, 2)}\n`)}`
  .cwd(root)
  .quiet()
  .text();

const counts = new Map<string, number>();
for (const e of result) counts.set(e.categoria, (counts.get(e.categoria) ?? 0) + 1);
console.log(
  `${result.length} códigos do MDF-e; categorias: ${[...counts].map(([k, v]) => `${k}=${v}`).join(' ')}; com curadoria: ${result.filter((e) => 'causaProvavel' in e).length}; com orientação: ${result.filter((e) => 'orientacao' in e).length}`,
);

if (process.argv.includes('--check')) {
  const current = await Bun.file(out)
    .text()
    .catch(() => '');
  if (current !== json) {
    console.error(`rejeicoes-data: ${path.relative(root, out)} difere do gerado; rode sem --check e confira o diff`);
    process.exit(1);
  }
  console.log('rejeicoes-data: JSON versionado do MDF-e confere com o gerado');
} else {
  await Bun.write(out, json);
  console.log(`gravado ${path.relative(root, out)}`);
}
