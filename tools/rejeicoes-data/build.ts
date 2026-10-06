#!/usr/bin/env bun
/**
 * Builder reprodutível do catálogo de rejeições (`packages/rejeicoes/src/data/rejeicoes.json`).
 *
 * Entrada: os PDFs oficiais listados em `sources.json` (conferidos pelo sha256), extraídos com `pdftotext -layout`
 * (poppler), mais a curadoria manual em `curadoria.json` (categoria forçada, causa provável e correção, sempre com a
 * regra citada). Os PDFs não entram no repositório: são baixados do Portal da NF-e e apontados por `--pdf-dir`.
 *
 * Método (união, porque a tabela 4.4.2 do Anexo I não é exaustiva):
 *   1. Anexo I, tabela 4.4.2 (rejeições) e 4.4.3 (denegações): código e mensagem oficial, com as linhas de
 *      continuação.
 *   2. Anexo I, corpo das regras de validação: toda linha `<regra> <modelo> ... Obrig.|Facul. <código> Rej.|Den.`
 *      dá o id da regra (C17-20), os modelos (55, 65) e, para código que não está na tabela, a mensagem.
 *   3. NT 2025.002, itens 7 e 8 (regras de validação e eventos): o mesmo formato, sem a coluna de efeito; a mensagem
 *      quebra em várias linhas na coluna "Descrição Erro" e é reconstituída pela posição da coluna.
 *
 * Uso:
 *   bun tools/rejeicoes-data/build.ts --pdf-dir <dir com os PDFs> [--check] [--compare-csv <catalogo.csv>]
 *   --check        não grava; sai com 1 se o JSON gerado diferir do versionado
 *   --compare-csv  confronta o conjunto de códigos com um catálogo CSV (coluna `codigo`) e lista as diferenças
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $ } from 'bun';
import type { DescricaoTabelaRejeicoes, Rejeicao } from '../../packages/rejeicoes/src/index.ts';

type Doc = {
  id: string;
  title: string;
  versao: string;
  citation: string;
  url: string;
  file: string;
  sha256: string;
  /**
   * NT com tabela de códigos de mensagem (NT 2025.001, NT 2023.002): o título da seção da tabela e o trecho das regras
   * de validação (início e fim, expressões regulares). Delas só entram os códigos que as fontes principais não têm.
   */
  mensagens?: { tabela: string; regrasDe: string; regrasAte: string; item: string };
  /**
   * NT sem tabela de mensagens, só com regras de validação (NT 2026.007): o trecho das regras (início e, opcional, fim).
   * Delas só entram os códigos que as fontes anteriores não têm, com a mensagem da coluna Descrição Erro. `ignorar` tira
   * códigos que a NT só repete, com o motivo.
   */
  regras?: { de: string; ate?: string; ignorar?: Record<string, string> };
};
type Rule = { doc: string; id: string };
type Category = 'schema' | 'assinatura' | 'certificado' | 'cadastro' | 'regra-negocio' | 'duplicidade' | 'reforma';
type Curated = {
  category?: Category;
  causaProvavel?: string;
  comoCorrigir?: string;
  referencia?: string;
  orientacao?: string;
};
type Entry = {
  code: string;
  effect: 'rejeicao' | 'denegacao';
  message: string;
  /** Mais de uma mensagem oficial para o mesmo código (a tabela 4.4.2 repete 640, 641, 701 e 721). */
  messages?: string[];
  modelos: string[];
  source: string;
  rules: Rule[];
  category: Category;
  causaProvavel?: string;
  comoCorrigir?: string;
  referencia?: string;
  orientacao?: string;
};

const here = import.meta.dir;
const root = path.resolve(here, '../..');
const out = path.join(root, 'packages/rejeicoes/src/data/rejeicoes.json');
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const pdfDir = arg('--pdf-dir') ?? process.env.SINETE_PDF_DIR;
if (!pdfDir) {
  console.error('rejeicoes-data: informe --pdf-dir (ou SINETE_PDF_DIR) com os PDFs de sources.json');
  process.exit(1);
}
if (!Bun.which('pdftotext')) {
  console.error('rejeicoes-data: pdftotext não encontrado (poppler: brew install poppler, apt install poppler-utils)');
  process.exit(1);
}

const sources = (await Bun.file(path.join(here, 'sources.json')).json()) as { retrievedAt: string; documents: Doc[] };
const curadoria = (await Bun.file(path.join(here, 'curadoria.json')).json()) as {
  entries: Record<string, Curated>;
  /**
   * Códigos de NT posteriores ao Anexo I que o builder não lê por inteiro: a mensagem, a regra e o documento (de
   * `sources.json`). O builder confere que a linha da regra, com o código, está no texto do PDF.
   */
  adicionais?: Record<
    string,
    { message: string; doc: string; rule: string; modelos: string[]; effect: 'rejeicao' | 'denegacao' }
  >;
  /** Mensagens que a checagem de corte aponta mas estão assim no PDF oficial, com a justificativa. */
  sanityAllow?: Record<string, string>;
};

// 1. Confere os PDFs e extrai o texto
const texts = new Map<string, string[]>();
const work = await mkdtemp(path.join(tmpdir(), 'sinete-rejeicoes-'));
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
const docById = new Map(sources.documents.map((d) => [d.id, d]));
const lines = (id: string): string[] => texts.get(id) ?? [];

const clean = (s: string): string =>
  s
    .replace(/^\s*(Rejeição:\s*)+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .trim();

/** Linhas de cabeçalho e rodapé de página, que interrompem tabelas sem encerrar a entrada. */
const isChrome = (l: string): boolean =>
  /^\s*$/.test(l) ||
  /Página \d+ \/ \d+/.test(l) ||
  /^\s*Nota Fiscal Eletrônica/.test(l) ||
  /^\s*MOC 7\.0 \S Anexo I/.test(l) ||
  /^\s*Reforma Tributária \S Lei Complementar/.test(l) ||
  /^\s*NT 2025\.002-RTC\s*$/.test(l) ||
  /^\s*Projeto\s*$/.test(l) ||
  /^\s*NT \d{4}\.\d{3} - \S/.test(l) ||
  /^\s*(Campo|Campo-Seq|#)\s+(Modelo|Regra)/.test(l) ||
  /^\s*CÓD\s+MOTIVOS/.test(l);

// 2. Tabelas 4.4.2 e 4.4.3 do Anexo I
type TableRow = { code: string; message: string; effect: 'rejeicao' | 'denegacao' };
function parseTables(ls: string[]): TableRow[] {
  const start = ls.findIndex((l) => /^4\.4\.2\. Tabela de Códigos de Rejeição/.test(l));
  const denStart = ls.findIndex((l) => /^4\.4\.3\. Tabela de Códigos de Denegação/.test(l));
  if (start < 0 || denStart < 0) throw new Error('Anexo I: tabelas 4.4.2/4.4.3 não encontradas');
  const rows: TableRow[] = [];
  let cur: TableRow | undefined;
  for (let i = start + 1; i < ls.length; i++) {
    const l = ls[i] ?? '';
    if (i > denStart && /^OBS\.:/.test(l)) break;
    const effect = i > denStart ? 'denegacao' : 'rejeicao';
    const m = /^\s*(\d{3,4})\s+(?:Rejeição:?|Uso Denegado:)\s*(.*)$/.exec(l);
    if (m) {
      cur = { code: m[1] ?? '', message: m[2] ?? '', effect };
      rows.push(cur);
    } else if (isChrome(l) || /^4\.4\.3\./.test(l) || /^CÓD\s/.test(l)) {
    } else if (cur && /^\s{2,}\S/.test(l)) cur.message += ` ${l.trim()}`;
  }
  for (const r of rows) r.message = clean(r.message);
  return rows;
}

// 3. Regras de validação (corpo do Anexo I e da NT)
type RuleRow = {
  code: string;
  rule: string;
  modelos: string[];
  message: string;
  effect: 'rejeicao' | 'denegacao';
  /** Texto que ficou na coluna da descrição logo depois da mensagem sem ser anexado (para a checagem de corte). */
  leftover?: string;
};
const RULE_ID = /^\s*(\d{0,2}[A-Z]{1,4}\d{1,3}[a-z]?(?:\.\d+)?(?:-\d{1,3})?)\s/;
const RULE_ROW =
  /\b(?:Obrig\.?|Obirg\.|Facul\.?)\s+(\d{3,4})\s+(?:(Rej|Den)[.,]?\s+)?(Rejeição:?|Uso Denegado:?)\s*(.*)$/;
/** Início de anotação na coluna da descrição, que encerra a mensagem. */
const CONTINUATION_STOP = /^(\d+\s*=|Observa[çc][ãa]o|Obs\.|Nota( \d+)?:|Exce[çc][ãa]o)/;
/** Código sem o "Rejeição:" na mesma linha: a mensagem começou numa das linhas de cima (NT 2025.002, I08-141). */
const RULE_ROW_SPLIT = /\b(?:Obrig\.?|Obirg\.|Facul\.?)\s+(\d{3,4})\s+(?!Rej|Den|Rejeição|Uso)(\S.*)$/;

function parseRules(ls: string[], from: RegExp, to?: RegExp): RuleRow[] {
  const start = ls.findIndex((l) => from.test(l));
  const end = to ? ls.findIndex((l, i) => i > start && to.test(l)) : ls.length;
  if (start < 0) throw new Error(`início ${from} não encontrado`);
  const rows: RuleRow[] = [];
  /** Id e modelos da regra: na própria linha ou até 2 linhas acima (célula quebrada), nunca herdados de outra regra. */
  const ruleAt = (i: number): { id: string; modelos: string[] } => {
    for (let k = i; k >= Math.max(start, i - 2); k--) {
      const l = ls[k] ?? '';
      if (k < i && (RULE_ROW.test(l) || RULE_ROW_SPLIT.test(l))) break;
      const id = RULE_ID.exec(l);
      if (!id) continue;
      const rest = l.slice((id.index ?? 0) + (id[0]?.length ?? 0));
      const mod = /^\s*(55\/65|55|65)\b/.exec(rest);
      return { id: id[1] ?? '', modelos: mod ? (mod[1] ?? '').split('/') : [] };
    }
    const mod = /^\s*(55\/65|55|65)\s/.exec(ls[i] ?? '');
    return { id: '', modelos: mod ? (mod[1] ?? '').split('/') : [] };
  };
  for (let i = start; i < (end < 0 ? ls.length : end); i++) {
    const l = ls[i] ?? '';
    let m = RULE_ROW.exec(l);
    let col = m ? l.indexOf(m[3] ?? '') : -1;
    let message = m?.[4] ?? '';
    if (!m) {
      const split = RULE_ROW_SPLIT.exec(l);
      if (!split) continue;
      // procura o "Rejeição:" até 3 linhas acima, na coluna da descrição
      for (let k = i - 1; k >= Math.max(start, i - 3); k--) {
        const up = ls[k] ?? '';
        const at = up.indexOf('Rejeição:');
        if (at >= 0 && !RULE_ROW.test(up) && !RULE_ROW_SPLIT.test(up)) {
          m = ['', split[1] ?? '', undefined, 'Rejeição:', ''] as unknown as RegExpExecArray;
          col = at;
          message = `${up.slice(at + 'Rejeição:'.length).trim()} ${split[2] ?? ''}`;
          break;
        }
      }
      if (!m) continue;
    }
    // continuação na coluna da mensagem, atravessando quebra de página
    let j = i + 1;
    let stopped = false;
    for (; j < ls.length; j++) {
      const n = ls[j] ?? '';
      if (isChrome(n)) continue;
      // Linha de outra regra (com código) encerra; linha só com id (célula de id em várias linhas, B32-10/BB02-10)
      // pode trazer a continuação da mensagem na coluna da descrição.
      if (RULE_ROW.test(n) || RULE_ROW_SPLIT.test(n)) break;
      const seg = [...n.matchAll(/\S+(?: \S+)*/g)].at(-1);
      if (!seg || (seg.index ?? 0) < col - 6) break;
      // Anotações da coluna de descrição que não são mensagem: lista de valores (1=União), observação, nota, exceção.
      if (CONTINUATION_STOP.test(seg[0])) {
        stopped = true;
        break;
      }
      message += ` ${seg[0]}`;
    }
    // Olha as próximas 3 linhas do mesmo bloco: texto na coluna da descrição começando em minúscula é continuação
    // de frase que ficou para trás (sinal de mensagem cortada).
    let leftover: string | undefined;
    for (let k = j, seen = 0; !stopped && k < ls.length && seen < 3; k++) {
      const n = ls[k] ?? '';
      if (isChrome(n)) continue;
      if (RULE_ROW.test(n) || RULE_ROW_SPLIT.test(n)) break;
      seen++;
      const seg = [...n.matchAll(/\S+(?: \S+)*/g)].at(-1);
      if (seg && (seg.index ?? 0) >= col - 6 && /^[a-zà-ú]/.test(seg[0])) {
        leftover = seg[0];
        break;
      }
    }
    const where = ruleAt(i);
    rows.push({
      code: m[1] ?? '',
      rule: where.id,
      modelos: where.modelos,
      message: clean(message),
      ...(leftover === undefined ? {} : { leftover }),
      effect: m[3]?.startsWith('Uso') || m[2] === 'Den' ? 'denegacao' : 'rejeicao',
    });
  }
  return rows;
}

const anexo = lines('moc70-anexo1');
const table = parseTables(anexo);
const anexoRules = parseRules(
  anexo,
  /^4\. Regras de Validação dos Webservices/,
  /^4\.4\.1\. Tabela de Códigos de Resultado/,
);
const nt = lines('nt2025002');
const ntRules = parseRules(nt, /^7\. Regras de Validação/, /^9\. DANFE/);

// 4. União e categoria
function categorize(code: string, message: string, fromNt: boolean): Category {
  const m = message.toLowerCase();
  if (fromNt && Number(code) >= 1000) return 'reforma';
  if (/duplicidade|já está (cancelad|inutilizad|denegad)|já (foi )?utilizad|já autorizad|já registrad/.test(m))
    return 'duplicidade';
  if (/certificado|cadeia de certifica|lcr\b|icp-brasil/.test(m)) return 'certificado';
  if (/assinatura|digest|signature|signedinfo|canonicaliza|transform/.test(m)) return 'assinatura';
  if (
    /schema|xml mal formado|namespace|utf-8|tamanho da mensagem|versão do (arquivo|leiaute)|caracteres de edição|tag raiz|atributo versao/.test(
      m,
    )
  )
    return 'schema';
  if (
    /não cadastrad|não habilitad|irregularidade|não vinculad|não está ativa|credenciad|uso denegado|não pertence a suframa|\b(cnpj|cpf|ie|inscrição suframa)\b[^,]{0,40}inválid/.test(
      m,
    )
  )
    return 'cadastro';
  return 'regra-negocio';
}

const entries = new Map<string, Entry>();
const anexoDoc = docById.get('moc70-anexo1');
const ntDoc = docById.get('nt2025002');
if (!anexoDoc || !ntDoc) throw new Error('sources.json sem moc70-anexo1 ou nt2025002');
for (const r of table) {
  const prev = entries.get(r.code);
  if (prev) {
    prev.messages = [...(prev.messages ?? [prev.message]), r.message];
    continue;
  }
  entries.set(r.code, {
    code: r.code,
    effect: r.effect,
    message: r.message,
    modelos: [],
    source: `${anexoDoc.citation}, tabela ${r.effect === 'denegacao' ? '4.4.3' : '4.4.2'}`,
    rules: [],
    category: 'regra-negocio',
  });
}
for (const [doc, rows] of [
  [anexoDoc, anexoRules],
  [ntDoc, ntRules],
] as const) {
  for (const r of rows) {
    let e = entries.get(r.code);
    if (!e) {
      e = {
        code: r.code,
        effect: r.effect,
        message: r.message,
        modelos: [],
        source: `${doc.citation}, regra ${r.rule}`,
        rules: [],
        category: 'regra-negocio',
      };
      entries.set(r.code, e);
    }
    if (r.rule && !e.rules.some((x) => x.doc === doc.id && x.id === r.rule)) e.rules.push({ doc: doc.id, id: r.rule });
    for (const m of r.modelos) if (!e.modelos.includes(m)) e.modelos.push(m);
  }
}

for (const [code, a] of Object.entries(curadoria.adicionais ?? {})) {
  const doc = docById.get(a.doc);
  if (!doc) throw new Error(`curadoria.adicionais: ${code} cita o documento ${a.doc}, fora de sources.json`);
  const linha = new RegExp(`^\\s*${a.rule.replace(/[-.]/g, '\\$&')}\\s.*\\s${code}\\s`);
  if (!lines(a.doc).some((l) => linha.test(l))) {
    throw new Error(`curadoria.adicionais: regra ${a.rule} com o código ${code} não encontrada em ${doc.citation}`);
  }
  if (entries.has(code)) throw new Error(`curadoria.adicionais: ${code} já está no catálogo; tire de adicionais`);
  entries.set(code, {
    code,
    effect: a.effect,
    message: a.message,
    modelos: [...a.modelos],
    source: `${doc.citation}, regra ${a.rule}`,
    rules: [{ doc: a.doc, id: a.rule }],
    category: 'regra-negocio',
  });
}
// 3b. Tabelas de mensagens das NT complementares: código e mensagem da tabela da NT, modelos e regra do trecho de
// regras de validação dela. Só códigos novos: o que o Anexo I ou a NT 2025.002 já têm fica como está.
function parseMensagens(ls: string[], tabela: RegExp): TableRow[] {
  const start = ls.findIndex((l) => tabela.test(l));
  if (start < 0) throw new Error(`tabela ${tabela} não encontrada`);
  const rows: TableRow[] = [];
  let cur: TableRow | undefined;
  for (let i = start + 1; i < ls.length; i++) {
    const l = ls[i] ?? '';
    const m = /^\s*(\d{3,4})\s+(Rejeição:|Uso Denegado:)\s*(.*)$/.exec(l);
    if (m) {
      cur = { code: m[1] ?? '', message: m[3] ?? '', effect: m[2] === 'Uso Denegado:' ? 'denegacao' : 'rejeicao' };
      rows.push(cur);
    } else if (isChrome(l) || /^\s*(Código|CÓDIGO)\s/.test(l)) {
    } else if (cur && /^\s{2,}\S/.test(l) && !/^\s*\d/.test(l)) cur.message += ` ${l.trim()}`;
  }
  for (const r of rows) r.message = clean(r.message);
  return rows;
}
const complementares = sources.documents.filter((d) => d.mensagens !== undefined);
const complementaresRules: RuleRow[] = [];
for (const d of complementares) {
  const cfg = d.mensagens as NonNullable<Doc['mensagens']>;
  const ls = lines(d.id);
  const regras = parseRules(ls, new RegExp(cfg.regrasDe), new RegExp(cfg.regrasAte));
  for (const r of parseMensagens(ls, new RegExp(cfg.tabela))) {
    if (entries.has(r.code)) continue;
    const daRegra = regras.filter((x) => x.code === r.code);
    complementaresRules.push(...daRegra);
    const modelos = [...new Set(daRegra.flatMap((x) => x.modelos))];
    entries.set(r.code, {
      code: r.code,
      effect: r.effect,
      message: r.message,
      modelos,
      source: `${d.citation}, item ${cfg.item}`,
      rules: [...new Set(daRegra.map((x) => x.rule).filter(Boolean))].map((id) => ({ doc: d.id, id })),
      category: 'regra-negocio',
    });
  }
}

// 3c. NT só com regras de validação: códigos novos com a mensagem, os modelos e a regra do próprio trecho.
const soRegrasRules: RuleRow[] = [];
for (const d of sources.documents.filter((x) => x.regras !== undefined)) {
  const cfg = d.regras as NonNullable<Doc['regras']>;
  for (const r of parseRules(lines(d.id), new RegExp(cfg.de), cfg.ate ? new RegExp(cfg.ate) : undefined)) {
    if (cfg.ignorar?.[r.code] !== undefined) continue;
    if (entries.has(r.code) && !soRegrasRules.some((x) => x.code === r.code)) continue;
    soRegrasRules.push(r);
    const e = entries.get(r.code);
    if (e) {
      if (r.rule && !e.rules.some((x) => x.doc === d.id && x.id === r.rule)) e.rules.push({ doc: d.id, id: r.rule });
      for (const m of r.modelos) if (!e.modelos.includes(m)) e.modelos.push(m);
      continue;
    }
    entries.set(r.code, {
      code: r.code,
      effect: r.effect,
      message: r.message,
      modelos: [...r.modelos],
      source: `${d.citation}, regra ${r.rule}`,
      rules: r.rule ? [{ doc: d.id, id: r.rule }] : [],
      category: 'regra-negocio',
    });
  }
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
const ntCodes = new Set(ntRules.map((r) => r.code));
// A saída tem o tipo do pacote: um membro renomeado no `@sinete/rejeicoes` quebra a compilação aqui, e não o JSON.
const result: Rejeicao[] = [...entries.values()]
  .sort((a, b) => Number(a.code) - Number(b.code))
  .map((e): Rejeicao => {
    const c = curadoria.entries[e.code] ?? {};
    const fromNt = ntCodes.has(e.code) && !table.some((t) => t.code === e.code);
    const modelos = e.modelos.length > 0 ? e.modelos.sort() : ['55', '65'];
    return {
      codigo: e.code,
      efeito: e.effect,
      mensagem: e.message,
      ...(e.messages ? { mensagens: e.messages } : {}),
      modelos: modelos as Rejeicao['modelos'],
      fonte: e.source,
      regras: e.rules.map((r) => ({ documento: r.doc, id: r.id })),
      categoria: c.category ?? (e.effect === 'denegacao' ? 'cadastro' : categorize(e.code, e.message, fromNt)),
      ...(c.causaProvavel ? { causaProvavel: c.causaProvavel } : {}),
      ...(c.comoCorrigir ? { comoCorrigir: c.comoCorrigir } : {}),
      ...(c.referencia ? { referencia: c.referencia } : {}),
      ...(c.orientacao ? { orientacao: c.orientacao } : {}),
    };
  });

// 5. Checagem de corte: toda mensagem precisa terminar como frase inteira. Sinais de corte: termina em artigo,
// preposição ou conjunção; parêntese ou colchete sem fechar; texto em minúscula logo abaixo na coluna da descrição que
// não foi anexado. Exceções só com justificativa em curadoria.json (`sanityAllow`), conferidas no PDF.
const DANGLING = /\s(a|o|as|os|ao|aos|e|ou|de|da|do|das|dos|com|para|por|no|na|nos|nas|em|um|uma|que|se|sem)$/i;
const balanced = (m: string, open: string, close: string): boolean => m.split(open).length === m.split(close).length;
const allow = curadoria.sanityAllow ?? {};
const suspects: string[] = [];
const leftovers = new Map<string, string>();
for (const r of [...anexoRules, ...ntRules, ...complementaresRules, ...soRegrasRules])
  if (r.leftover && entries.get(r.code)?.message === r.message) leftovers.set(r.code, r.leftover);
for (const e of entries.values()) {
  for (const m of e.messages ?? [e.message]) {
    const why = [
      DANGLING.test(m) ? 'termina em palavra de ligação' : '',
      balanced(m, '(', ')') && balanced(m, '[', ']') ? '' : 'parêntese ou colchete sem fechar',
      leftovers.has(e.code) ? `continuação não anexada: "${leftovers.get(e.code)}"` : '',
    ].filter(Boolean);
    if (why.length > 0 && !allow[e.code]) suspects.push(`${e.code} (${why.join('; ')}): ${m}`);
  }
}
if (suspects.length > 0) {
  console.error(`rejeicoes-data: ${suspects.length} mensagem(ns) com sinal de corte:`);
  for (const x of suspects) console.error(`  ${x}`);
  process.exit(1);
}

const data: DescricaoTabelaRejeicoes & { geradoPor: string; notas: string; rejeicoes: readonly Rejeicao[] } = {
  versaoDoFormato: 1,
  versao: sources.retrievedAt.replaceAll('-', '.'),
  geradoPor: 'tools/rejeicoes-data/build.ts',
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
    'União da tabela 4.4.2/4.4.3 do Anexo I com os códigos das regras de validação do Anexo I e da NT 2025.002, os códigos de outras NT listados em `adicionais` da curadoria (regra conferida no PDF) os códigos novos das tabelas de mensagens da NT 2025.001 e da NT 2023.002 (NFC-e) e os códigos novos das regras de validação da NT 2026.007 (contribuinte exclusivo do IBS/CBS). Mensagem oficial sem ajuste (placeholders como [nItem: 999] mantidos). `modelos` vem das regras; sem regra localizada, 55 e 65. `categoria` é heurística sobre a mensagem, com correções manuais na curadoria. `causaProvavel` e `comoCorrigir` só onde houve curadoria, com a regra citada em `referencia`.',
  rejeicoes: result,
};
// Formatado pelo Biome do repo, para o `bun run format` não reescrever o arquivo gerado.
const biome = path.join(root, 'node_modules/.bin/biome');
const json = await $`${biome} format --stdin-file-path=${out} < ${new Response(`${JSON.stringify(data, null, 2)}\n`)}`
  .cwd(root)
  .quiet()
  .text();

const csvPath = arg('--compare-csv');
if (csvPath) {
  const csv = (await Bun.file(csvPath).text()).split('\n').slice(1).filter(Boolean);
  const theirs = new Set(csv.map((l) => l.split(',')[0] ?? ''));
  const ours = new Set(result.map((e) => e.codigo));
  const onlyTheirs = [...theirs].filter((c) => !ours.has(c));
  const onlyOurs = [...ours].filter((c) => !theirs.has(c));
  console.log(`csv: ${theirs.size} códigos; builder: ${ours.size}`);
  console.log(`só no csv (${onlyTheirs.length}): ${onlyTheirs.join(' ')}`);
  console.log(`só no builder (${onlyOurs.length}): ${onlyOurs.join(' ')}`);
}

const counts = new Map<string, number>();
for (const e of result) counts.set(e.categoria, (counts.get(e.categoria) ?? 0) + 1);
console.log(
  `${result.length} códigos (tabela ${table.length}, regras Anexo I ${anexoRules.length}, regras NT ${ntRules.length}); categorias: ${[
    ...counts,
  ]
    .map(([k, v]) => `${k}=${v}`)
    .join(
      ' ',
    )}; com curadoria: ${result.filter((e) => 'causaProvavel' in e).length}; com orientação: ${result.filter((e) => 'orientacao' in e).length}`,
);

if (process.argv.includes('--check')) {
  const current = await Bun.file(out)
    .text()
    .catch(() => '');
  if (current !== json) {
    console.error(`rejeicoes-data: ${path.relative(root, out)} difere do gerado; rode sem --check e confira o diff`);
    process.exit(1);
  }
  console.log('rejeicoes-data: JSON versionado confere com o gerado');
} else {
  await Bun.write(out, json);
  console.log(`gravado ${path.relative(root, out)}`);
}
