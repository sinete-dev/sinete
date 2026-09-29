/**
 * Rótulo em português para o caminho de uma ocorrência (ADR 0011). Cada pacote de documento monta o seu
 * `rotuloDoCaminho` com as tabelas do próprio leiaute; aqui fica só o mecanismo, que é o mesmo para todos.
 */

/**
 * Leva o caminho à forma com pontos e índice a partir de zero. Os montadores usam dois formatos: o da entrada e das
 * conferências do documento montado (`itens[0].produto.xProd`, `infNFe.det[0].prod.xProd`) e o do validador de XSD, com
 * barras e índice a partir de um, só quando o elemento se repete (`/infNFe/det[2]/prod/xProd`).
 */
export function normalizarCaminho(path: string): string {
  if (!path.startsWith('/')) return path;
  return path
    .slice(1)
    .split('/')
    .map((parte) => parte.replace(/\[(\d+)\]$/, (_t, n: string) => `[${Number(n) - 1}]`))
    .join('.');
}

/**
 * Um grupo de caminhos: o `padrao` casa com o começo do caminho normalizado, e `rotulo` recebe os índices capturados já
 * somados de um (o primeiro item é o 1). Grupo que se repete sem índice no XSD (um item só) chega com o índice
 * ausente: `rotulo` recebe `1`.
 */
export interface GrupoDeCaminho {
  readonly padrao: RegExp;
  readonly rotulo: string | ((...numeros: number[]) => string);
}

export interface TabelaDeRotulos {
  /** Do mais específico ao mais geral: vale o primeiro que casar. */
  readonly grupos: readonly GrupoDeCaminho[];
  /** Rótulo do campo pelo último segmento do caminho (`IE`, `xProd`). */
  readonly campos: Readonly<Record<string, string>>;
  /** Quando nem grupo nem campo são conhecidos (`'Dados da NF-e'`). */
  readonly padrao: string;
}

/**
 * Cria a função de rótulo de um documento: `Grupo, Campo` quando os dois são conhecidos (`Item 2, Descrição do
 * produto`), só um deles quando falta o outro, e o `padrao` da tabela quando nenhum casa.
 */
export function criarRotuloDoCaminho(tabela: TabelaDeRotulos): (path: string) => string {
  return (path: string): string => {
    const p = normalizarCaminho(path);
    let grupo = '';
    for (const g of tabela.grupos) {
      const m = g.padrao.exec(p);
      if (m === null) continue;
      grupo =
        typeof g.rotulo === 'string'
          ? g.rotulo
          : g.rotulo(...m.slice(1).map((n) => (n === undefined ? 1 : Number(n) + 1)));
      break;
    }
    const segmento =
      p
        .split(/[.[\]]/)
        .filter((s) => s !== '' && !/^\d+$/.test(s))
        .pop() ?? '';
    const campo = Object.hasOwn(tabela.campos, segmento) ? tabela.campos[segmento] : undefined;
    if (grupo !== '' && campo !== undefined && campo !== grupo) return `${grupo}, ${campo}`;
    return grupo || campo || tabela.padrao;
  };
}
