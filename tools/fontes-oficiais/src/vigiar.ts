#!/usr/bin/env bun
/**
 * Lê as fontes oficiais (`fontes.ts`), compara com `estado.json` e relata o que mudou.
 *
 *   bun tools/fontes-oficiais/src/vigiar.ts                      relatório no stdout, nada gravado
 *   bun tools/fontes-oficiais/src/vigiar.ts --gravar             grava o estado lido em estado.json
 *   bun tools/fontes-oficiais/src/vigiar.ts --relatorio r.md     grava o relatório em arquivo
 *
 * Com `GITHUB_OUTPUT` no ambiente, escreve `mudou` e `falhas` para o workflow. A Calculadora não entra no
 * `estado.json`: a referência dela é o pin de `tools/ibs-cbs-dados/sources.json`, e ela só deixa de aparecer quando
 * o pin for trocado (ADR 0007).
 */
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import type { Estado, Leitura, Mudanca } from './comparar.ts';
import { comparar, mudou, proximoEstado, relatorio } from './comparar.ts';
import type { Item } from './extrair.ts';
import { extrairPaginaGovBr, extrairPortalDfe, extrairPortalNfe } from './extrair.ts';
import type { Fonte } from './fontes.ts';
import { FONTES } from './fontes.ts';

const DIR = path.resolve(import.meta.dir, '..');
const ESTADO = path.join(DIR, 'estado.json');
const SOURCES_IBS_CBS = path.resolve(DIR, '../ibs-cbs-dados/sources.json');
const USER_AGENT = 'Mozilla/5.0 (compatible; sinete-fontes-oficiais; +https://github.com/sinete-dev/sinete)';
const PRAZO_MS = 45_000;

/**
 * GET com cookies entre redirecionamentos. O portal da NF-e (ASP.NET) redireciona para
 * `AspxAutoDetectCookieSupport=1` e só serve a página a quem devolve o cookie; sem isso o `fetch` entra em laço.
 */
async function baixar(url: string, metodo: 'GET' | 'HEAD' = 'GET'): Promise<Response> {
  const cookies = new Map<string, string>();
  let atual = url;
  for (let i = 0; i < 10; i++) {
    const r = await fetch(atual, {
      method: metodo,
      redirect: 'manual',
      signal: AbortSignal.timeout(PRAZO_MS),
      headers: {
        'user-agent': USER_AGENT,
        ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
    });
    for (const c of r.headers.getSetCookie()) {
      const [par] = c.split(';');
      const eq = par?.indexOf('=') ?? -1;
      if (par && eq > 0) cookies.set(par.slice(0, eq).trim(), par.slice(eq + 1).trim());
    }
    const destino = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && destino) {
      atual = new URL(destino, atual).href;
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${atual}`);
    return r;
  }
  throw new Error(`redirecionamentos demais a partir de ${url}`);
}

async function html(r: Response): Promise<string> {
  const bytes = new Uint8Array(await r.arrayBuffer());
  const charset = /charset=([\w-]+)/i.exec(r.headers.get('content-type') ?? '')?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

interface PinCalculadora {
  readonly url: string;
  readonly lastModified: string;
  readonly contentLength: number;
  readonly versao?: { readonly versaoDb?: string };
}

function itemCalculadora(url: string, lastModified: string, contentLength: number): Item {
  return { id: url, titulo: `publicada em ${lastModified}, ${contentLength} bytes` };
}

async function pinCalculadora(): Promise<PinCalculadora> {
  const s = (await Bun.file(SOURCES_IBS_CBS).json()) as { calculadora: PinCalculadora };
  return s.calculadora;
}

async function ler(fonte: Fonte): Promise<readonly Item[]> {
  if (fonte.extrator === 'calculadora') {
    const { downloadUrl } = (await (await baixar(fonte.url)).json()) as { downloadUrl?: string };
    if (!downloadUrl) throw new Error('a API não devolveu downloadUrl');
    const h = await baixar(downloadUrl, 'HEAD');
    const modificado = h.headers.get('last-modified');
    const bruto = h.headers.get('content-length');
    const tamanho = bruto === null ? Number.NaN : Number(bruto);
    if (!modificado || !Number.isSafeInteger(tamanho) || tamanho <= 0) {
      throw new Error('HEAD sem last-modified ou content-length válido');
    }
    return [itemCalculadora(downloadUrl, new Date(modificado).toISOString().replace('.000Z', 'Z'), tamanho)];
  }
  const corpo = await html(await baixar(fonte.url));
  const itens =
    fonte.extrator === 'portal-nfe'
      ? extrairPortalNfe(corpo)
      : fonte.extrator === 'portal-dfe'
        ? extrairPortalDfe(corpo)
        : extrairPaginaGovBr(corpo, fonte.url);
  // Página que responde sem nenhum item é mudança de leiaute ou página de erro, não "tudo saiu".
  if (itens.length === 0) throw new Error('nenhum item reconhecido na página (o leiaute mudou?)');
  return itens;
}

const args = process.argv.slice(2);
const gravar = args.includes('--gravar');
const iRel = args.indexOf('--relatorio');
const arquivoRelatorio = iRel >= 0 ? args[iRel + 1] : undefined;

const estadoAnterior: Estado = (await Bun.file(ESTADO).exists())
  ? ((await Bun.file(ESTADO).json()) as Estado)
  : { fontes: {} };
const pin = await pinCalculadora();

const leituras: Leitura[] = await Promise.all(
  FONTES.map(async (fonte): Promise<Leitura> => {
    try {
      return { fonte, itens: await ler(fonte) };
    } catch (e) {
      return { fonte, erro: e instanceof Error ? e.message : String(e) };
    }
  }),
);

const mudancas: Mudanca[] = [];
for (const l of leituras) {
  if (!l.itens) continue;
  const anterior =
    l.fonte.extrator === 'calculadora'
      ? {
          titulo: l.fonte.titulo,
          url: l.fonte.url,
          itens: [itemCalculadora(pin.url, pin.lastModified, pin.contentLength)],
        }
      : estadoAnterior.fontes[l.fonte.id];
  mudancas.push(comparar(l.fonte, anterior, l.itens));
}
const falhas = leituras.filter((l) => l.erro !== undefined);
const texto = relatorio(mudancas, falhas);

if (arquivoRelatorio) await Bun.write(arquivoRelatorio, texto);
else console.log(texto);

if (gravar) {
  const semCalculadora = leituras.filter((l) => l.fonte.extrator !== 'calculadora');
  const novo = proximoEstado(estadoAnterior, semCalculadora);
  await Bun.write(ESTADO, `${JSON.stringify(novo, null, 2)}\n`);
  console.error(`estado gravado em ${path.relative(process.cwd(), ESTADO)}`);
}

const houve = mudancas.some(mudou);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `mudou=${houve}\nfalhas=${falhas.length}\n`);
}
for (const f of falhas) console.error(`falha: ${f.fonte.id}: ${f.erro}`);
