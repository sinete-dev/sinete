#!/usr/bin/env bun
/**
 * Builder reprodutível do catálogo de erros da NFS-e Nacional (`packages/rejeicoes/src/data/nfse-erros.json`).
 *
 * Entrada: as planilhas oficiais listadas em `sources-nfse.json` (Anexo I e Anexo II do leiaute da NFS-e, seção
 * "Documentação Atual" do Portal NFS-e), conferidas pelo sha256 antes de qualquer leitura, mais a curadoria manual em
 * `curadoria-nfse.json`. As planilhas não entram no repositório: são baixadas do portal e apontadas por `--xlsx-dir`.
 *
 * O xlsx é um zip de XML (ECMA-376): o builder lê `xl/workbook.xml`, as relações, `xl/sharedStrings.xml` e cada aba
 * com `unzip -p` e o parser do `@sinete/core/xml`. Abas lidas:
 *   - Anexo I, `RN_RECEPCAO_DPS`: A #, B regra, E efeito, F código, G mensagem (linhas sem código são títulos).
 *   - Anexo I, `RN DPS_NFS-e`, e Anexo II, `RN EVENTO_PED.REG.EVENTO`: A #, B caminho, C campo, D regra, G efeito,
 *     H código, I mensagem, J nível (1 leiaute, 2 geral, 3 parametrização municipal). Linha sem B e C continua o
 *     campo da linha anterior.
 *
 * Uso:
 *   bun tools/rejeicoes-data/nfse.ts --xlsx-dir <dir com as planilhas> [--check]
 *   --check  não grava; sai com 1 se o JSON gerado diferir do versionado
 */
import path from 'node:path';
import { $ } from 'bun';
import type { ElementoXml } from '../../packages/core/src/xml/index.ts';
import { atributoDe, descendentes, elementosFilhos, lerXml, textoDe } from '../../packages/core/src/xml/index.ts';
import type { DescricaoTabelaRejeicoes } from '../../packages/rejeicoes/src/index.ts';
import type { NfseErro, NfseErroRegra } from '../../packages/rejeicoes/src/nfse.ts';

type Nivel = '1' | '2' | '3';
type Categoria =
  | 'recepcao'
  | 'schema'
  | 'assinatura'
  | 'certificado'
  | 'cadastro'
  | 'parametrizacao-municipal'
  | 'regra-negocio'
  | 'duplicidade'
  | 'evento'
  | 'reforma';
type Doc = {
  id: 'anexo-i' | 'anexo-ii';
  title: string;
  versao: string;
  citation: string;
  url: string;
  file: string;
  sha256: string;
  sheets: string[];
};
// Regra e entrada com os tipos do pacote: um membro renomeado no `@sinete/rejeicoes` quebra a compilação aqui.
type Regra = NfseErroRegra;
type Curated = { categoria?: Categoria; causaProvavel?: string; comoCorrigir?: string; referencia?: string };
type Entry = NfseErro;

const here = import.meta.dir;
const root = path.resolve(here, '../..');
const out = path.join(root, 'packages/rejeicoes/src/data/nfse-erros.json');
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const xlsxDir = arg('--xlsx-dir') ?? process.env.SINETE_XLSX_DIR;
if (!xlsxDir) {
  console.error('nfse-erros: informe --xlsx-dir (ou SINETE_XLSX_DIR) com as planilhas de sources-nfse.json');
  process.exit(1);
}

const sources = (await Bun.file(path.join(here, 'sources-nfse.json')).json()) as {
  retrievedAt: string;
  page: string;
  documents: Doc[];
};
const curadoria = (await Bun.file(path.join(here, 'curadoria-nfse.json')).json()) as {
  notes: string;
  entradas: Record<string, Curated>;
};

for (const d of sources.documents) {
  const file = path.join(xlsxDir, d.file);
  const bytes = await Bun.file(file)
    .bytes()
    .catch(() => undefined);
  if (!bytes) {
    console.error(`nfse-erros: ${d.file} não encontrado em ${xlsxDir}`);
    process.exit(1);
  }
  const sha = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
  if (sha !== d.sha256) {
    console.error(`nfse-erros: ${d.file} com sha256 ${sha}, esperado ${d.sha256}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Leitura do xlsx
// ---------------------------------------------------------------------------------------------------------------

const unzip = async (file: string, entry: string): Promise<string> =>
  (await $`unzip -p ${file} ${entry}`.quiet()).stdout.toString('utf8');

/** Texto de um `<si>` ou `<is>`: os `<t>` na ordem, fora da leitura fonética (`<rPh>`). */
function richText(el: ElementoXml): string {
  let s = '';
  const walk = (e: ElementoXml): void => {
    for (const c of elementosFilhos(e)) {
      if (c.local === 'rPh') continue;
      if (c.local === 't') s += textoDe(c);
      else walk(c);
    }
  };
  walk(el);
  return s;
}

type Row = { n: number; cells: Map<string, string> };

async function readSheets(file: string, wanted: readonly string[]): Promise<Map<string, Row[]>> {
  const shared: string[] = [];
  const ssXml = await unzip(file, 'xl/sharedStrings.xml').catch(() => '');
  if (ssXml) for (const si of elementosFilhos(lerXml(ssXml).raiz)) shared.push(richText(si));
  const rels = new Map<string, string>();
  for (const r of elementosFilhos(lerXml(await unzip(file, 'xl/_rels/workbook.xml.rels')).raiz)) {
    rels.set(atributoDe(r, 'Id') ?? '', atributoDe(r, 'Target') ?? '');
  }
  const wb = lerXml(await unzip(file, 'xl/workbook.xml')).raiz;
  const result = new Map<string, Row[]>();
  for (const s of descendentes(wb)) {
    if (s.local !== 'sheet') continue;
    const name = atributoDe(s, 'name') ?? '';
    if (!wanted.includes(name)) continue;
    const rid = s.atributos.find((a) => a.local === 'id')?.valor ?? '';
    const target = (rels.get(rid) ?? '').replace(/^\//, '');
    const entry = target.startsWith('xl/') ? target : `xl/${target}`;
    const rows: Row[] = [];
    for (const row of descendentes(lerXml(await unzip(file, entry)).raiz)) {
      if (row.local !== 'row') continue;
      const cells = new Map<string, string>();
      for (const c of elementosFilhos(row)) {
        if (c.local !== 'c') continue;
        const col = /^[A-Z]+/.exec(atributoDe(c, 'r') ?? '')?.[0] ?? '';
        const t = atributoDe(c, 't');
        const v = elementosFilhos(c).find((x) => x.local === 'v');
        let val: string | undefined;
        if (t === 's' && v) val = shared[Number(textoDe(v))];
        else if (t === 'inlineStr') {
          const is = elementosFilhos(c).find((x) => x.local === 'is');
          val = is ? richText(is) : undefined;
        } else if (v) val = textoDe(v);
        if (val !== undefined && val.trim() !== '') cells.set(col, val);
      }
      rows.push({ n: Number(atributoDe(row, 'r')), cells });
    }
    result.set(name, rows);
  }
  for (const w of wanted) if (!result.has(w)) throw new Error(`${path.basename(file)}: aba "${w}" não encontrada`);
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// Extração das regras
// ---------------------------------------------------------------------------------------------------------------

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const CODE = /^E\d{4}$/;
type Found = { code: string; mensagem: string; regra: Regra };
const found: Found[] = [];
const oddEffects: string[] = [];

for (const d of sources.documents) {
  const sheets = await readSheets(path.join(xlsxDir, d.file), d.sheets);
  for (const [aba, rows] of sheets) {
    const recepcao = aba === 'RN_RECEPCAO_DPS';
    const col = recepcao
      ? { efeito: 'E', code: 'F', msg: 'G', regra: 'B' }
      : { efeito: 'G', code: 'H', msg: 'I', regra: 'D' };
    let caminho: string | undefined;
    for (const { cells } of rows) {
      const get = (c: string): string => norm(cells.get(c) ?? '');
      if (!recepcao && (get('B') || get('C'))) {
        const b = get('B') === '-' ? '' : get('B');
        caminho = `${b}${get('C')}` || undefined;
      }
      const raw = get(col.code);
      if (raw === '' || raw === '-' || /^CÓD/i.test(raw)) continue;
      const codes = raw.split(/[\s,;/]+/).filter(Boolean);
      for (const code of codes) {
        if (!CODE.test(code)) throw new Error(`${d.file} ${aba} linha ${get('A')}: código fora do formato: ${code}`);
      }
      const efeito = get(col.efeito);
      if (efeito !== 'Rej.') oddEffects.push(`${d.id} ${aba} #${get('A')} ${codes.join(',')}: efeito "${efeito}"`);
      const nivel = get('J');
      const regra: Regra = {
        documento: d.id,
        aba,
        linha: get('A'),
        ...(recepcao || caminho === undefined ? {} : { caminho }),
        ...(!recepcao && /^[123]$/.test(nivel) ? { nivel: nivel as Nivel } : {}),
        regra: get(col.regra),
      };
      for (const code of codes) found.push({ code, mensagem: get(col.msg), regra });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// União por código e categoria
// ---------------------------------------------------------------------------------------------------------------

const docById = new Map(sources.documents.map((d) => [d.id, d]));
const byCode = new Map<string, Found[]>();
for (const f of found) byCode.set(f.code, [...(byCode.get(f.code) ?? []), f]);

function categoria(fs: readonly Found[], nivel: Nivel | undefined): Categoria {
  const regras = fs.map((f) => f.regra);
  const msgs = fs.map((f) => f.mensagem).join(' ');
  if (regras.some((r) => /(^|\/)Signature$/.test(r.caminho ?? ''))) return 'assinatura';
  if (regras.some((r) => r.aba === 'RN_RECEPCAO_DPS')) {
    return /certificado/i.test(msgs) ? 'certificado' : 'recepcao';
  }
  if (/já (existe|foi)|duplicid|em duplicidade/i.test(msgs)) return 'duplicidade';
  if (nivel === '3') return 'parametrizacao-municipal';
  if (regras.some((r) => /IBSCBS|gIBS|gCBS/.test(r.caminho ?? ''))) return 'reforma';
  if (regras.every((r) => r.documento === 'anexo-ii')) return 'evento';
  if (/schema|esquema/i.test(msgs)) return 'schema';
  if (/cadastr/i.test(msgs)) return 'cadastro';
  return 'regra-negocio';
}

const result: Entry[] = [];
for (const code of [...byCode.keys()].sort()) {
  const fs = byCode.get(code) as Found[];
  const mensagens = [...new Set(fs.map((f) => f.mensagem).filter(Boolean))];
  const niveis = fs.map((f) => f.regra.nivel).filter((n): n is Nivel => n !== undefined);
  const nivel = niveis.length > 0 ? (niveis.sort()[0] as Nivel) : undefined;
  const first = fs[0]?.regra as Regra;
  const cur = curadoria.entradas[code];
  const e: Entry = {
    codigo: code,
    mensagem: mensagens[0] ?? '',
    ...(mensagens.length > 1 ? { mensagens } : {}),
    ...(nivel === undefined ? {} : { nivel }),
    regras: fs.map((f) => f.regra),
    categoria: cur?.categoria ?? categoria(fs, nivel),
    fonte: `${docById.get(first.documento)?.citation}, aba ${first.aba}`,
  };
  if (cur?.causaProvavel !== undefined) {
    if (cur.comoCorrigir === undefined || cur.referencia === undefined) {
      throw new Error(`curadoria de ${code} incompleta: causaProvavel, comoCorrigir e referencia andam juntos`);
    }
    Object.assign(e, { causaProvavel: cur.causaProvavel, comoCorrigir: cur.comoCorrigir, referencia: cur.referencia });
  }
  if (e.mensagem === '') throw new Error(`${code} sem mensagem oficial`);
  result.push(e);
}
const unknown = Object.keys(curadoria.entradas).filter((c) => !byCode.has(c));
if (unknown.length > 0) {
  console.error(`nfse-erros: curadoria cita código fora do catálogo: ${unknown.join(' ')}`);
  process.exit(1);
}

const data: DescricaoTabelaRejeicoes & { geradoPor: string; notas: string; erros: readonly NfseErro[] } = {
  versaoDoFormato: 1,
  versao: sources.retrievedAt.replaceAll('-', '.'),
  geradoPor: 'tools/rejeicoes-data/nfse.ts',
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
    'União dos códigos de erro das abas de regras de negócio do Anexo I (RN_RECEPCAO_DPS e RN DPS_NFS-e) e do Anexo II (RN EVENTO_PED.REG.EVENTO) do leiaute da NFS-e Nacional. Mensagem oficial com espaços normalizados; `mensagens` quando o mesmo código aparece com textos diferentes. `nivel` é o menor nível entre as regras (1 leiaute, 2 geral, 3 parametrização municipal). `categoria` é heurística sobre aba, caminho, nível e mensagem, com correções na curadoria. `causaProvavel` e `comoCorrigir` só onde houve curadoria, com a regra citada em `referencia`. Três regras do Anexo I (E0675, E0676, E0677) trazem "Obrig." na coluna de efeito; tratadas como rejeição, como as demais.',
  erros: result,
};

const biome = path.join(root, 'node_modules/.bin/biome');
const json = await $`${biome} format --stdin-file-path=${out} < ${new Response(`${JSON.stringify(data, null, 2)}\n`)}`
  .cwd(root)
  .quiet()
  .text();

const counts = new Map<string, number>();
for (const e of result) counts.set(e.categoria, (counts.get(e.categoria) ?? 0) + 1);
const perDoc = (id: string): number => new Set(found.filter((f) => f.regra.documento === id).map((f) => f.code)).size;
console.log(
  `${result.length} códigos (Anexo I ${perDoc('anexo-i')}, Anexo II ${perDoc('anexo-ii')}, ${found.length} regras); categorias: ${[
    ...counts,
  ]
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')}; com curadoria: ${result.filter((e) => 'causaProvavel' in e).length}`,
);
if (oddEffects.length > 0)
  console.log(`efeito diferente de "Rej." (tratado como rejeição):\n  ${oddEffects.join('\n  ')}`);

if (process.argv.includes('--check')) {
  const current = await Bun.file(out)
    .text()
    .catch(() => '');
  if (current !== json) {
    console.error(`nfse-erros: ${path.relative(root, out)} difere do gerado; rode sem --check e confira o diff`);
    process.exit(1);
  }
  console.log('nfse-erros: JSON versionado confere com o gerado');
} else {
  await Bun.write(out, json);
  console.log(`gravado ${path.relative(root, out)}`);
}
