/**
 * Diff semântico entre duas versões do dataset (desenho §7, passo 3; ADR 0007, "Diff entre versões").
 *
 * Compara tabela a tabela pela `chave` estável de cada registro (família, código, início de vigência). Registros
 * incluídos e removidos aparecem pela chave; registros alterados trazem o caminho de cada campo, com o valor antigo e
 * o novo. Listas internas com vigência (reduções, DF-e, tratamentos) são indexadas pelo conteúdo que as identifica, não
 * pela posição, para que a inclusão de um item não pareça alteração de todos os seguintes. Cada campo alterado recebe
 * um tipo de mudança, no espírito das seções "Alterações na versão" do IT, para o resumo humano do PR de atualização.
 */
import type { BundleDoDataset, NomeDaTabela } from './types.ts';

export type TipoDeMudanca =
  | 'fim-de-vigencia'
  | 'inicio-de-vigencia'
  | 'indicador-de-grupo'
  | 'dfe'
  | 'reducao-ou-aliquota'
  | 'expressao-de-calculo'
  | 'aplicabilidade'
  | 'texto'
  | 'outro';

export interface MudancaDeCampo {
  readonly caminho: string;
  readonly tipo: TipoDeMudanca;
  /** Valor serializado em JSON; `undefined` quando o campo não existia. */
  readonly de?: string;
  readonly para?: string;
}

export interface MudancaDeRegistro {
  readonly chave: string;
  readonly campos: readonly MudancaDeCampo[];
}

export interface DiferencaDeTabela {
  readonly tabela: NomeDaTabela;
  readonly incluidos: readonly string[];
  readonly removidos: readonly string[];
  readonly alterados: readonly MudancaDeRegistro[];
  readonly tipos: Readonly<Partial<Record<TipoDeMudanca, number>>>;
}

export interface DiferencaDeDatasets {
  readonly de: {
    readonly versaoDosDados: string;
    readonly sha256DoDataset: string;
    readonly fontes: readonly string[];
  };
  readonly para: {
    readonly versaoDosDados: string;
    readonly sha256DoDataset: string;
    readonly fontes: readonly string[];
  };
  readonly formatoMudou: boolean;
  readonly tabelas: readonly DiferencaDeTabela[];
  readonly inalteradas: readonly NomeDaTabela[];
}

type Rec = Readonly<Record<string, unknown>>;

/** Identificador de um item de lista interna, pelo conteúdo. */
function itemId(x: unknown, i: number): string {
  if (x === null || x === undefined) return String(i);
  if (typeof x !== 'object') return String(x);
  const o = x as Rec;
  const id = o.chave ?? o.tributo ?? o.modelo ?? o.tratamento ?? o.prefixo ?? o.resumo ?? i;
  const vigencia = o.vigencia as { inicio?: string } | undefined;
  return `${String(id)}${vigencia?.inicio ? `@${vigencia.inicio}` : ''}`;
}

function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(prefix, '[]');
    const seen = new Map<string, number>();
    value.forEach((x, i) => {
      let id = itemId(x, i);
      const n = (seen.get(id) ?? 0) + 1;
      seen.set(id, n);
      if (n > 1) id = `${id}#${n}`;
      flatten(x, `${prefix}[${id}]`, out);
    });
    return;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) out.set(prefix, '{}');
    for (const k of keys) flatten((value as Rec)[k], prefix ? `${prefix}.${k}` : k, out);
    return;
  }
  out.set(prefix, JSON.stringify(value));
}

export function tipoDeMudanca(caminho: string): TipoDeMudanca {
  if (/vigencia\.fim$/.test(caminho)) return 'fim-de-vigencia';
  if (/vigencia\.inicio$/.test(caminho)) return 'inicio-de-vigencia';
  if (/^grupos\./.test(caminho)) return 'indicador-de-grupo';
  if (/^dfe(\[|$)/.test(caminho)) return 'dfe';
  if (/^(reducoes|aliquotasFixas)(\[|$)|pRed|^aliquota|^tipoDeAliquota|pRedutor|percentual/.test(caminho))
    return 'reducao-ou-aliquota';
  if (/^expressao\.|^indicadores\.|^tratamentos(\[|$)/.test(caminho)) return 'expressao-de-calculo';
  if (/^(prefixo|excecoes|itemDoAnexo|nbs|cIndOp)/.test(caminho)) return 'aplicabilidade';
  if (/descricao|nome|legal|memoriaTemplate|texto|nota|titulo/.test(caminho)) return 'texto';
  return 'outro';
}

function diffTable(table: NomeDaTabela, a: readonly Rec[], b: readonly Rec[]): DiferencaDeTabela | undefined {
  const ia = new Map(a.map((r) => [String(r.chave), r]));
  const ib = new Map(b.map((r) => [String(r.chave), r]));
  const added = [...ib.keys()].filter((k) => !ia.has(k)).sort();
  const removed = [...ia.keys()].filter((k) => !ib.has(k)).sort();
  const changed: MudancaDeRegistro[] = [];
  const kinds: Partial<Record<TipoDeMudanca, number>> = {};
  for (const [key, ra] of [...ia].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) {
    const rb = ib.get(key);
    if (!rb) continue;
    const fa = new Map<string, string>();
    const fb = new Map<string, string>();
    flatten(ra, '', fa);
    flatten(rb, '', fb);
    const paths = [...new Set([...fa.keys(), ...fb.keys()])].filter((p) => fa.get(p) !== fb.get(p)).sort();
    if (paths.length === 0) continue;
    const fields = paths.map((path): MudancaDeCampo => {
      const kind = tipoDeMudanca(path);
      kinds[kind] = (kinds[kind] ?? 0) + 1;
      const from = fa.get(path);
      const to = fb.get(path);
      return {
        caminho: path,
        tipo: kind,
        ...(from === undefined ? {} : { de: from }),
        ...(to === undefined ? {} : { para: to }),
      };
    });
    changed.push({ chave: key, campos: fields });
  }
  if (!added.length && !removed.length && !changed.length) return undefined;
  return { tabela: table, incluidos: added, removidos: removed, alterados: changed, tipos: kinds };
}

export function compararDatasets(a: BundleDoDataset, b: BundleDoDataset): DiferencaDeDatasets {
  const shaA = new Map(a.manifesto.tabelas.map((t) => [t.nome, t.sha256]));
  const tables: DiferencaDeTabela[] = [];
  const unchanged: NomeDaTabela[] = [];
  const names = [...new Set([...a.manifesto.tabelas.map((t) => t.nome), ...b.manifesto.tabelas.map((t) => t.nome)])];
  for (const name of names) {
    const tb = b.manifesto.tabelas.find((t) => t.nome === name);
    if (tb && shaA.get(name) === tb.sha256) {
      unchanged.push(name);
      continue;
    }
    const ta = (a.tabelas as unknown as Record<string, readonly Rec[] | undefined>)[name] ?? [];
    const tbRecords = (b.tabelas as unknown as Record<string, readonly Rec[] | undefined>)[name] ?? [];
    const d = diffTable(name, ta, tbRecords);
    if (d) tables.push(d);
    else unchanged.push(name);
  }
  const side = (x: BundleDoDataset): DiferencaDeDatasets['de'] => ({
    versaoDosDados: x.manifesto.versaoDosDados,
    sha256DoDataset: x.manifesto.sha256DoDataset,
    fontes: x.manifesto.fontes.map((s) => `${s.id} ${s.versao}`),
  });
  return {
    de: side(a),
    para: side(b),
    formatoMudou: a.manifesto.versaoDoFormato !== b.manifesto.versaoDoFormato,
    tabelas: tables,
    inalteradas: unchanged,
  };
}

/** Resumo em Markdown do diff, para o corpo do PR de atualização do pacote. `limite` corta cada lista. */
export function formatarDiferenca(diferenca: DiferencaDeDatasets, limite = 20): string {
  const out: string[] = [];
  out.push(`# ibs-cbs-dados ${diferenca.de.versaoDosDados} -> ${diferenca.para.versaoDosDados}`, '');
  out.push(`- de: ${diferenca.de.fontes.join(', ')} (${diferenca.de.sha256DoDataset.slice(0, 12)})`);
  out.push(`- para: ${diferenca.para.fontes.join(', ')} (${diferenca.para.sha256DoDataset.slice(0, 12)})`);
  if (diferenca.formatoMudou) out.push('- **mudança de formato (versaoDoFormato)**');
  out.push('');
  if (diferenca.tabelas.length === 0) out.push('Nenhuma tabela mudou.');
  for (const t of diferenca.tabelas) {
    const kinds = Object.entries(t.tipos)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ');
    out.push(
      `## ${t.tabela}: +${t.incluidos.length} -${t.removidos.length} ~${t.alterados.length}${kinds ? ` (${kinds})` : ''}`,
    );
    for (const k of t.incluidos.slice(0, limite)) out.push(`- incluído \`${k}\``);
    for (const k of t.removidos.slice(0, limite)) out.push(`- removido \`${k}\``);
    for (const c of t.alterados.slice(0, limite)) {
      for (const f of c.campos.slice(0, limite)) {
        out.push(`- \`${c.chave}\` ${f.caminho}: ${f.de ?? '(ausente)'} -> ${f.para ?? '(ausente)'}`);
      }
    }
    const hidden = Math.max(0, t.incluidos.length - limite) + Math.max(0, t.removidos.length - limite);
    const hiddenChanged = Math.max(0, t.alterados.length - limite);
    if (hidden || hiddenChanged) out.push(`- (mais ${hidden + hiddenChanged} omitidos; veja o JSON)`);
    out.push('');
  }
  out.push(`Sem mudança: ${diferenca.inalteradas.join(', ') || '(nenhuma)'}`);
  return `${out.join('\n')}\n`;
}
