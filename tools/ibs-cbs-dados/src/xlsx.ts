/**
 * Leitor mínimo de XLSX (Office Open XML) para as tabelas oficiais do IT 2025.002. O XLSX é um zip: lemos com o `unzip`
 * do sistema (o mesmo requisito do resto do extrator) e interpretamos `sharedStrings.xml` e as planilhas por regex, o
 * que basta para células de texto e número sem fórmulas. Cada linha vira um mapa `coluna -> valor bruto`.
 */
import { $ } from 'bun';

export type Row = Readonly<Record<string, string>>;
export interface Sheet {
  readonly name: string;
  readonly rows: readonly Row[];
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

async function entry(file: string, name: string): Promise<string> {
  return $`unzip -p ${file} ${name}`.quiet().text();
}

export async function readXlsx(file: string): Promise<Sheet[]> {
  const names = (await $`unzip -Z1 ${file}`.quiet().text()).split('\n').filter(Boolean);
  const shared: string[] = [];
  if (names.includes('xl/sharedStrings.xml')) {
    const x = await entry(file, 'xl/sharedStrings.xml');
    for (const si of x.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const parts = [...(si[1] ?? '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1] ?? '');
      shared.push(decodeXml(parts.join('')));
    }
  }
  const wb = await entry(file, 'xl/workbook.xml');
  const rels = await entry(file, 'xl/_rels/workbook.xml.rels');
  const target = new Map(
    [...rels.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<sheet [^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g)) {
    const t = target.get(m[2]);
    if (!t) throw new Error(`xlsx ${file}: planilha ${m[1]} sem relacionamento`);
    const x = await entry(file, t.startsWith('/') ? t.slice(1) : `xl/${t}`);
    const rows: Row[] = [];
    for (const r of x.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: Record<string, string> = {};
      for (const c of (r[1] ?? '').matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[2] ?? '';
        const body = c[3] ?? '';
        const type = /\bt="(\w+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value: string | undefined;
        if (type === 's') value = v === undefined ? undefined : shared[Number(v)];
        else if (type === 'inlineStr') value = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1];
        else value = v;
        if (value !== undefined && value !== '') row[c[1] ?? ''] = decodeXml(value).replace(/\r\n/g, '\n');
      }
      if (Object.keys(row).length > 0) rows.push(row);
    }
    sheets.push({ name: decodeXml(m[1] ?? ''), rows });
  }
  return sheets;
}

/** Converte linhas brutas em registros pelo cabeçalho (primeira linha cujo conteúdo casa com `headerTest`). */
export function recordsByHeader(sheet: Sheet, firstHeader: string): Record<string, string>[] {
  const idx = sheet.rows.findIndex((r) => Object.values(r)[0]?.trim() === firstHeader);
  if (idx < 0) throw new Error(`planilha ${sheet.name}: cabeçalho "${firstHeader}" não encontrado`);
  const header = sheet.rows[idx] as Row;
  const cols = Object.entries(header).map(([col, name]) => [col, name.replace(/\s+/g, ' ').trim()] as const);
  const out: Record<string, string>[] = [];
  for (const r of sheet.rows.slice(idx + 1)) {
    const rec: Record<string, string> = {};
    for (const [col, name] of cols) {
      const v = r[col];
      if (v !== undefined) rec[name] = v.trim();
    }
    out.push(rec);
  }
  return out;
}
