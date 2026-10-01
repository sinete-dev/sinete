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
 * os arquivos e as subpáginas que ela publica. Menu e rodapé apontam para fora desse caminho e ficam de fora. Links
 * relativos resolvem como o navegador resolveria: pelo `<base href>` da página, ou pelo endereço dela. O Plone do
 * gov.br publica a página como um documento dentro da pasta (o `og:url`), e o logo e os botões de compartilhar apontam
 * para ele: esse endereço é a própria página e fica de fora, senão uma página sem nenhum documento passaria por lida.
 */
export function extrairPaginaGovBr(html: string, pagina: string): Item[] {
  const base = pagina.replace(/\/+$/, '');
  const declarado = /<base\b[^>]*href="([^"]+)"/i.exec(html)?.[1];
  let referencia = pagina;
  try {
    if (declarado) referencia = new URL(decodificarEntidades(declarado), pagina).href;
  } catch {
    referencia = pagina;
  }
  const propria = /<meta\b[^>]*property="og:url"[^>]*content="([^"]+)"/i.exec(html)?.[1];
  const itens: Item[] = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    let url: string;
    try {
      url = new URL(decodificarEntidades(m[1] ?? ''), referencia).href.replace(/[#?].*$/, '');
    } catch {
      continue;
    }
    url = url.replace(/\/(view|@@download\/file)$/, '');
    // A âncora de acessibilidade ("Ir para o conteúdo") aponta para a própria página e sobra como `${base}/`.
    if (!url.startsWith(`${base}/`) || url.length === base.length + 1) continue;
    if (propria && url === decodificarEntidades(propria).replace(/\/+$/, '')) continue;
    itens.push({ id: url, titulo: texto(m[2] ?? '') || url.slice(base.length + 1) });
  }
  return ordenar(itens);
}

/** Texto sem acento, em minúsculas e com espaços simples, para casar termos de ementa escritos de qualquer jeito. */
function normalizado(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
}

/**
 * A ementa trata da alíquota de referência do IBS/CBS (EC 132/2023, ADCT art. 130; LC 214/2025, arts. 14, 18 e 347):
 * cita "alíquota(s) de referência", o IBS ou a CBS pelo nome ou pela sigla. Nenhuma resolução nem projeto de resolução
 * do Senado anterior à reforma casa com isso (conferido em 01/10/2026 contra as 6.578 resoluções e os 275 projetos em
 * tramitação), então qualquer item que aparecer é publicação nova a olhar.
 */
export function ementaDaAliquotaDeReferencia(ementa: string): boolean {
  return /aliquotas? de referencia|(contribuicao social|imposto) sobre bens e servicos|\b(cbs|ibs)\b/.test(
    normalizado(ementa),
  );
}

function lista(v: unknown): unknown[] | undefined {
  if (Array.isArray(v)) return v;
  return v !== null && typeof v === 'object' ? [v] : undefined;
}

const textoJson = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/**
 * Dados abertos do Senado, legislação (`/dadosabertos/legislacao/lista.json?tipo=RSF`): as resoluções do Senado cuja
 * ementa trata da alíquota de referência. A lista vazia depois do filtro é o normal até a resolução sair; o que conta
 * como falha de leitura é a resposta sem a lista de normas (leiaute mudou ou página de erro).
 */
export function extrairNormasDoSenado(json: unknown): Item[] {
  const docs = lista(
    (json as { ListaDocumento?: { documentos?: { documento?: unknown } } } | null)?.ListaDocumento?.documentos
      ?.documento,
  );
  if (docs === undefined || docs.length === 0) throw new Error('resposta sem a lista de normas (o leiaute mudou?)');
  const itens: Item[] = [];
  for (const d of docs as Record<string, unknown>[]) {
    const ementa = textoJson(d.ementa);
    const id = textoJson(d.id);
    if (!id || !ementaDaAliquotaDeReferencia(ementa)) continue;
    itens.push({ id: `https://legis.senado.leg.br/norma/${id}`, titulo: `${textoJson(d.normaNome)}: ${ementa}` });
  }
  return ordenar(itens);
}

/**
 * Dados abertos do Senado, processos (`/dadosabertos/processo?sigla=PRS&tramitando=S`): os projetos de resolução em
 * tramitação cuja ementa trata da alíquota de referência. Avisa antes da resolução: o projeto aparece ao ser apresentado
 * e sai da lista ao virar norma, que então aparece na fonte das resoluções.
 */
export function extrairProcessosDoSenado(json: unknown): Item[] {
  const procs = lista(json);
  if (procs === undefined || procs.length === 0)
    throw new Error('resposta sem a lista de processos (o leiaute mudou?)');
  const itens: Item[] = [];
  for (const p of procs as Record<string, unknown>[]) {
    const ementa = textoJson(p.ementa);
    const codigo = p.codigoMateria;
    if ((typeof codigo !== 'number' && typeof codigo !== 'string') || !ementaDaAliquotaDeReferencia(ementa)) continue;
    itens.push({
      id: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}`,
      titulo: `${textoJson(p.identificacao)}: ${ementa}`,
    });
  }
  return ordenar(itens);
}
