/**
 * Extratores puros: HTML ou JSON de uma fonte oficial para a lista de itens que ela publica. Um item é o que a página
 * oferece para download ou leitura (esquema, nota técnica, manual, tabela), identificado pelo endereço e descrito pelo
 * título que a página mostra.
 */

export interface Item {
  /** Identificador estável dentro da fonte: o endereço normalizado, ou o nome do arquivo no portal DF-e. */
  readonly id: string;
  readonly titulo: string;
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

function texto(html: string): string {
  return decodificarEntidades(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function ordenar(itens: Item[]): Item[] {
  const unicos = new Map<string, Item>();
  for (const i of itens) if (!unicos.has(i.id)) unicos.set(i.id, i);
  return [...unicos.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Portal da NF-e (`listaConteudo.aspx`): cada documento é um `exibirArquivo.aspx?conteudo=<id>` com o título num
 * `span.tituloConteudo`. O portal escreve o `+` do identificador em base64 como espaço no href; aqui ele volta a `+`.
 */
export function extrairPortalNfe(html: string): Item[] {
  const itens: Item[] = [];
  const re = /href="exibirArquivo\.aspx\?conteudo=([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const conteudo = decodificarEntidades(m[1] ?? '')
      .replace(/ /g, '+')
      .trim();
    const titulo = texto(m[2] ?? '');
    if (conteudo && titulo) itens.push({ id: `exibirArquivo.aspx?conteudo=${conteudo}`, titulo });
  }
  return ordenar(itens);
}

/**
 * Portal DF-e da SVRS (MDF-e e tabelas compartilhadas): os arquivos saem por
 * `download_arquivo_estatico('<sistema>', <tipo>, '<nome>')`. O nome do arquivo é o identificador.
 */
export function extrairPortalDfe(html: string): Item[] {
  const itens: Item[] = [];
  const re = /download_arquivo_estatico\('([^']*)',\s*(\d+),\s*'([^']*)'\)/g;
  for (const m of html.matchAll(re)) {
    const nome = decodificarEntidades(m[3] ?? '').trim();
    if (nome) itens.push({ id: `${(m[1] ?? '').toUpperCase()}/${m[2]}/${nome}`, titulo: nome });
  }
  return ordenar(itens);
}

/**
 * Página do gov.br (documentação da NFS-e Nacional): os links que ficam abaixo do caminho da própria página, que são
 * os arquivos e as subpáginas que ela publica. Menu e rodapé apontam para fora desse caminho e ficam de fora.
 */
export function extrairPaginaGovBr(html: string, pagina: string): Item[] {
  const base = pagina.replace(/\/+$/, '');
  const itens: Item[] = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    let url: string;
    try {
      url = new URL(decodificarEntidades(m[1] ?? ''), `${base}/`).href.replace(/[#?].*$/, '');
    } catch {
      continue;
    }
    url = url.replace(/\/(view|@@download\/file)$/, '');
    // A âncora de acessibilidade ("Ir para o conteúdo") aponta para a própria página e sobra como `${base}/`.
    if (!url.startsWith(`${base}/`) || url.length === base.length + 1) continue;
    itens.push({ id: url, titulo: texto(m[2] ?? '') || url.slice(base.length + 1) });
  }
  return ordenar(itens);
}
