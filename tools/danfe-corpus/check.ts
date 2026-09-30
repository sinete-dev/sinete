#!/usr/bin/env bun
/**
 * Renderiza todo o corpus local com o @sinete/da e imprime só estatísticas agregadas (ver README). Nada do conteúdo
 * dos documentos sai no terminal: nem chave, nem nome, nem CNPJ, nem mensagem de erro com trecho do XML.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { ehErroSinete } from '@sinete/core';
import type { Documento } from '@sinete/da';
import { gerarHtml, gerarPdf } from '@sinete/da';
import { dacce } from '@sinete/da/cce';
import { damdfe } from '@sinete/da/mdfe';
import { danfe } from '@sinete/da/nfe';
import { formatoDe, marcaDe } from './formato.ts';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const corpus = arg('--corpus') ?? path.join(homedir(), '.local/state/sinete/corpus');
const saida = arg('--saida');
const zbarEvery = Number(arg('--zbar') ?? 0);
const comMarcas = process.argv.includes('--marcas');
const repo = path.resolve(import.meta.dir, '../..');
if (saida && path.resolve(saida).startsWith(repo) && !path.resolve(saida).includes('/.local/')) {
  console.error('danfe-corpus: --saida precisa ficar fora do repositório (ou num .local/ ignorado pelo git)');
  process.exit(1);
}
if (saida) mkdirSync(saida, { recursive: true });

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (e.toLowerCase().endsWith('.xml')) out.push(p);
  }
  return out.sort();
}

const all = files(corpus);
const texts = all.map((f) => readFileSync(f, 'utf8'));
const chaveRe = /<chNFe>(\d{44})<\/chNFe>/;
// NF-e indexadas pela chave, para o DACCE (nome do emitente) e para o carimbo de cancelamento.
const nfes = new Map<string, string>();
for (const t of texts) {
  const m = /<infNFe[^>]*Id="NFe(\d{44})"/.exec(t);
  if (m?.[1] && /<nfeProc/.test(t)) nfes.set(m[1], t);
}

type Kind =
  | 'danfe'
  | 'danfe-cancelada'
  | 'dacce'
  | 'damdfe'
  | 'danfe-previa'
  | 'danfe-denegada'
  | 'danfe-cancelada-cstat'
  | 'danfe-cancelada-cstat-evento'
  | 'damdfe-previa'
  | 'damdfe-cancelado-cstat'
  | 'damdfe-encerrado'
  | 'outro';
interface Row {
  kind: Kind;
  ok: boolean;
  code?: string;
  pages?: number;
  ms?: number;
  kb?: number;
  deterministic?: boolean;
  fit?: Documento['estatisticas'];
  formato?: string;
  marca?: string;
  /** Algum texto do documento diz "SEM VALOR FISCAL". */
  semValor?: boolean;
  /** O protocolo esperado aparece no documento (conferido aqui, nunca impresso). */
  protocolo?: boolean;
  /** O carimbo traz o protocolo do evento de cancelamento. */
  carimboEvento?: boolean;
  zbar?: { barras: boolean; qr?: boolean };
}
const rows: Row[] = [];

function zbarCheck(pdf: Uint8Array, digits: string, qr?: string): Row['zbar'] {
  const dir = mkdtempSync(path.join(tmpdir(), 'danfe-corpus-'));
  try {
    writeFileSync(path.join(dir, 'x.pdf'), pdf);
    execFileSync('pdftoppm', [
      '-r',
      '150',
      '-f',
      '1',
      '-l',
      '1',
      '-png',
      '-singlefile',
      path.join(dir, 'x.pdf'),
      path.join(dir, 'x'),
    ]);
    let out = '';
    try {
      out = execFileSync('zbarimg', ['-q', path.join(dir, 'x.png')]).toString();
    } catch (e) {
      out = String((e as { stdout?: Buffer }).stdout ?? '');
    }
    return {
      barras: out.includes(`CODE-128:${digits}`),
      ...(qr === undefined ? {} : { qr: out.includes(`QR-Code:${qr}`) }),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Variantes para as marcas de documento sem valor fiscal (`--marcas`), feitas do próprio XML autorizado: a prévia é o
 * `NFe` (ou `MDFe`) sem o protocolo, e a denegada troca o cStat do `protNFe` por 302. O XML só é lido, nunca assinado.
 */
function semProtocolo(t: string, raiz: 'NFe' | 'MDFe', ns: string): string | undefined {
  const m = new RegExp(`<${raiz}[\\s>][\\s\\S]*</${raiz}>`).exec(t)?.[0];
  if (!m) return undefined;
  return /^<[^>]*xmlns=/.test(m) ? m : m.replace(`<${raiz}`, `<${raiz} xmlns="${ns}"`);
}
function comCStat(t: string, prot: 'protNFe' | 'protMDFe', cStat: string): string | undefined {
  const re = new RegExp(`(<${prot}[\\s\\S]*?<cStat>)\\d+(</cStat>)`);
  const out = t.replace(re, (_, a: string, b: string) => `${a}${cStat}${b}`);
  return out === t ? undefined : out;
}
const denegada = (t: string): string | undefined => comCStat(t, 'protNFe', '302');
/** `nProt` do protocolo (ou do retorno do evento), para conferir que ele aparece no documento. */
const nProtDe = (t: string, tag: 'protNFe' | 'protMDFe' | 'retEvento'): string | undefined =>
  new RegExp(`<${tag}[\\s\\S]*?<nProt>(\\d+)</nProt>`).exec(t)?.[1];

/** Variantes feitas do XML real com `--marcas`; os PDFs delas não vão para o `--saida`. */
const variantes = new Set<Kind>([
  'danfe-previa',
  'danfe-denegada',
  'danfe-cancelada-cstat',
  'danfe-cancelada-cstat-evento',
  'damdfe-previa',
  'damdfe-cancelado-cstat',
  'damdfe-encerrado',
]);
interface Esperado {
  /** Protocolo que precisa aparecer em algum texto do documento. */
  readonly protocolo?: string | undefined;
  /** Protocolo do evento que precisa aparecer no carimbo (texto girado). */
  readonly carimbo?: string | undefined;
}

let n = 0;
function run(
  kind: Kind,
  render: () => Documento,
  digits: string,
  qr: string | undefined,
  esperado: Esperado = {},
): void {
  try {
    const t0 = performance.now();
    const doc = render();
    const pdf = gerarPdf(doc);
    gerarHtml(doc);
    const ms = performance.now() - t0;
    const again = gerarPdf(render());
    const deterministic = again.length === pdf.length && again.every((b, i) => b === pdf[i]);
    const row: Row = {
      kind,
      ok: true,
      pages: doc.paginas.length,
      ms,
      kb: pdf.length / 1024,
      deterministic,
      fit: doc.estatisticas,
    };
    row.formato = formatoDe(doc.titulo);
    row.marca = marcaDe(doc);
    const textos = doc.paginas.flatMap((p) => p.ops.flatMap((o) => (o.t === 'texto' ? [o] : [])));
    row.semValor = textos.some((o) => o.s.includes('SEM VALOR FISCAL'));
    const { protocolo, carimbo } = esperado;
    if (protocolo) row.protocolo = textos.some((o) => o.s.includes(protocolo));
    if (carimbo)
      row.carimboEvento = textos.some(
        (o) => o.rotacao !== undefined && o.rotacao > 0 && o.rotacao < 90 && o.s.includes(carimbo),
      );
    if (zbarEvery > 0 && n % zbarEvery === 0 && digits) row.zbar = zbarCheck(pdf, digits, qr);
    if (saida && !variantes.has(kind)) {
      writeFileSync(path.join(saida, `${String(n).padStart(5, '0')}.pdf`), pdf);
    }
    rows.push(row);
  } catch (e) {
    rows.push({ kind, ok: false, code: ehErroSinete(e) ? e.code : 'excecao_nao_tipada' });
  }
}

for (const t of texts) {
  n++;
  const root = /<(nfeProc|procEventoNFe|mdfeProc|NFe|MDFe)[\s>]/.exec(t)?.[1];
  const tp = /<tpEvento>(\d{6})</.exec(t)?.[1];
  let kind: Kind = 'outro';
  let render: (() => Documento) | undefined;
  let digits = '';
  let qr: string | undefined;
  if (root === 'nfeProc' || root === 'NFe') {
    kind = 'danfe';
    render = () => danfe(t);
    digits = /Id="NFe(\d{44})"/.exec(t)?.[1] ?? '';
    if (/<mod>65</.test(t)) qr = /<qrCode>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/qrCode>/.exec(t)?.[1];
  } else if (root === 'procEventoNFe' && tp === '110110') {
    kind = 'dacce';
    const ch = chaveRe.exec(t)?.[1] ?? '';
    const nfe = nfes.get(ch);
    render = () => dacce(t, nfe ? { nfe } : {});
    digits = ch;
  } else if (root === 'procEventoNFe' && (tp === '110111' || tp === '110112')) {
    const ch = chaveRe.exec(t)?.[1] ?? '';
    const nfe = nfes.get(ch);
    if (nfe) {
      kind = 'danfe-cancelada';
      render = () => danfe(nfe, { cancelamento: t });
      digits = ch;
    }
  } else if (root === 'mdfeProc' || root === 'MDFe') {
    kind = 'damdfe';
    render = () => damdfe(t);
    digits = /Id="MDFe(\d{44})"/.exec(t)?.[1] ?? '';
    qr = /<qrCodMDFe>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/qrCodMDFe>/.exec(t)?.[1]?.replace(/&amp;/g, '&');
  }
  if (!render) {
    rows.push({ kind, ok: true });
    continue;
  }
  run(kind, render, digits, qr);
  if (!comMarcas) continue;
  if (root === 'nfeProc') {
    const previa = semProtocolo(t, 'NFe', 'http://www.portalfiscal.inf.br/nfe');
    if (previa) run('danfe-previa', () => danfe(previa), digits, qr);
    const den = denegada(t);
    if (den) run('danfe-denegada', () => danfe(den), digits, qr);
    // Cancelada pelo cStat do protocolo, como grava quem importa a nota (ADR 0006, decisão 15).
    const canc = comCStat(t, 'protNFe', '101');
    if (canc) run('danfe-cancelada-cstat', () => danfe(canc), digits, qr, { protocolo: nProtDe(t, 'protNFe') });
  } else if (kind === 'danfe-cancelada') {
    // As duas fontes: o protocolo com cStat 101 e o evento; o carimbo precisa ser o do evento.
    const nfe = nfes.get(digits);
    const canc = nfe ? comCStat(nfe, 'protNFe', '101') : undefined;
    if (canc && nfe) {
      run('danfe-cancelada-cstat-evento', () => danfe(canc, { cancelamento: t }), digits, qr, {
        protocolo: nProtDe(nfe, 'protNFe'),
        carimbo: nProtDe(t, 'retEvento'),
      });
    }
  } else if (root === 'mdfeProc') {
    const previa = semProtocolo(t, 'MDFe', 'http://www.portalfiscal.inf.br/mdfe');
    if (previa) run('damdfe-previa', () => damdfe(previa), digits, qr);
    const esperado = { protocolo: nProtDe(t, 'protMDFe') };
    const canc = comCStat(t, 'protMDFe', '101');
    if (canc) run('damdfe-cancelado-cstat', () => damdfe(canc), digits, qr, esperado);
    const enc = comCStat(t, 'protMDFe', '132');
    if (enc) run('damdfe-encerrado', () => damdfe(enc), digits, qr, esperado);
  }
}

const pct = (xs: number[], p: number): string => {
  if (xs.length === 0) return '-';
  const s = [...xs].sort((a, b) => a - b);
  return (s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0).toFixed(2);
};
console.log(`corpus: ${all.length} arquivos XML`);
for (const kind of [
  'danfe',
  'danfe-cancelada',
  'dacce',
  'damdfe',
  'danfe-previa',
  'danfe-denegada',
  'danfe-cancelada-cstat',
  'danfe-cancelada-cstat-evento',
  'damdfe-previa',
  'damdfe-cancelado-cstat',
  'damdfe-encerrado',
  'outro',
] as const) {
  const rs = rows.filter((r) => r.kind === kind);
  if (rs.length === 0) continue;
  const ok = rs.filter((r) => r.ok && r.pages !== undefined);
  const fails = new Map<string, number>();
  for (const r of rs) if (!r.ok) fails.set(r.code ?? '?', (fails.get(r.code ?? '?') ?? 0) + 1);
  const pages = new Map<number, number>();
  for (const r of ok) pages.set(r.pages ?? 0, (pages.get(r.pages ?? 0) ?? 0) + 1);
  const formatos = new Map<string, number>();
  for (const r of ok) formatos.set(r.formato ?? '?', (formatos.get(r.formato ?? '?') ?? 0) + 1);
  const marcas = new Map<string, number>();
  for (const r of ok) marcas.set(r.marca ?? '?', (marcas.get(r.marca ?? '?') ?? 0) + 1);
  console.log(`\n${kind}: ${rs.length} documentos`);
  if (kind === 'outro') continue;
  console.log(`  renderizados: ${ok.length}; falhas: ${[...fails].map(([c, k]) => `${c}=${k}`).join(', ') || '0'}`);
  console.log(`  formatos: ${[...formatos].map(([f, k]) => `${f}=${k}`).join(', ')}`);
  console.log(`  marcas: ${[...marcas].map(([f, k]) => `${f}=${k}`).join(', ')}`);
  console.log(`  com "SEM VALOR FISCAL" no documento: ${ok.filter((r) => r.semValor).length}`);
  const prot = ok.filter((r) => r.protocolo !== undefined);
  if (prot.length) console.log(`  protocolo presente: ${prot.filter((r) => r.protocolo).length}/${prot.length}`);
  const ev = ok.filter((r) => r.carimboEvento !== undefined);
  if (ev.length)
    console.log(`  carimbo com o protocolo do evento: ${ev.filter((r) => r.carimboEvento).length}/${ev.length}`);
  console.log(
    `  folhas: ${[...pages]
      .sort((a, b) => a[0] - b[0])
      .map(([p, k]) => `${p}=${k}`)
      .join(', ')}`,
  );
  console.log(`  determinístico (2 renders, bytes iguais): ${ok.filter((r) => r.deterministic).length}/${ok.length}`);
  console.log(
    `  encaixe: docs com texto reduzido ${ok.filter((r) => (r.fit?.reduzidos ?? 0) > 0).length}, quebrado ${ok.filter((r) => (r.fit?.quebrados ?? 0) > 0).length}, cortado ${ok.filter((r) => (r.fit?.cortados ?? 0) > 0).length}`,
  );
  console.log(
    `  layout + PDF + HTML, ms/doc p50 ${pct(
      ok.map((r) => r.ms ?? 0),
      50,
    )} p95 ${pct(
      ok.map((r) => r.ms ?? 0),
      95,
    )}`,
  );
  console.log(
    `  PDF, KB p50 ${pct(
      ok.map((r) => r.kb ?? 0),
      50,
    )} máx ${pct(
      ok.map((r) => r.kb ?? 0),
      100,
    )}`,
  );
  const z = ok.filter((r) => r.zbar);
  if (z.length > 0) {
    const qrs = z.filter((r) => r.zbar?.qr !== undefined);
    console.log(
      `  zbarimg (amostra de ${z.length}): CODE-128 ${z.filter((r) => r.zbar?.barras).length}/${z.length}` +
        (qrs.length ? `, QR ${qrs.filter((r) => r.zbar?.qr).length}/${qrs.length}` : ''),
    );
  }
}
