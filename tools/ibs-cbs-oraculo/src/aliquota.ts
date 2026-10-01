/**
 * A parte pura do `aliquota.ts`: aplicar numa tabela de alíquotas de referência a alíquota que um ato oficial fixou,
 * dividindo a linha `desconhecida` que cobre a vigência. Serve às duas formas da tabela (a curada em
 * `tools/ibs-cbs-dados/rates.json` e a gerada em `packages/ibs-cbs/src/aliquotas/data/rates.json`), que têm as mesmas
 * linhas em `referencia`.
 */
import { Decimal } from '@sinete/ibs-cbs/calcular';

export type Tributo = 'CBS' | 'IBSUF' | 'IBSMun';

export interface LinhaDeReferencia {
  readonly tributo: Tributo;
  readonly vigencia: { readonly inicio: string; readonly fim: string | null };
  readonly situacao: 'oficial' | 'desconhecida';
  readonly aliquota: string | null;
  readonly legal: string;
  readonly nota?: string;
  readonly fontes: readonly string[];
}

export interface AliquotaPublicada {
  readonly tributo: Tributo;
  readonly inicio: string;
  readonly fim: string;
  /** Percentual nominal, no formato da tabela (`'8.7'`). */
  readonly aliquota: string;
  readonly legal: string;
  readonly fontes: readonly string[];
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Percentual sem zeros à direita, como a tabela grava (`8.70` vira `8.7`, `9.0` vira `9`). */
export function percentualDaTabela(valor: string): string {
  if (!Decimal.isDecimalText(valor)) throw new Error(`alíquota fora do formato decimal: ${valor}`);
  const d = Decimal.parse(valor).stripZeros();
  if (d.isNegative() || d.cmp(Decimal.HUNDRED) > 0) throw new Error(`alíquota fora de 0 a 100: ${valor}`);
  return d.toString();
}

/**
 * CBS nominal de 2027 e 2028 a partir da alíquota de referência do Senado: a referência menos 0,1 ponto percentual
 * (LC 214/2025, art. 347). Fora de 2027 e 2028 a redução não existe, e quem chama informa a CBS nominal direto.
 */
export function cbsNominalDe2027e2028(referencia: string, inicio: string, fim: string): string {
  if (inicio < '2027-01-01' || fim > '2028-12-31') {
    throw new Error('a redução de 0,1 ponto (art. 347) só vale em 2027 e 2028: informe a CBS nominal com --cbs');
  }
  const ref = Decimal.parse(percentualDaTabela(referencia));
  const nominal = ref.sub(Decimal.parse('0.1'));
  if (nominal.isNegative()) throw new Error(`referência ${referencia} menor que 0,1 ponto`);
  return percentualDaTabela(nominal.toString());
}

/**
 * Troca, dentro de `inicio`..`fim`, a linha `desconhecida` do tributo pela alíquota publicada. A vigência precisa caber
 * inteira numa só linha `desconhecida`: alíquota oficial nunca é sobrescrita por aqui (correção de valor oficial é
 * mudança à mão, com a fonte). O que sobrar da linha antes e depois continua `desconhecida`, com o texto original.
 */
export function aplicarAliquota(linhas: readonly LinhaDeReferencia[], nova: AliquotaPublicada): LinhaDeReferencia[] {
  if (!DIA.test(nova.inicio) || !DIA.test(nova.fim) || nova.inicio > nova.fim) {
    throw new Error(`vigência inválida: ${nova.inicio} a ${nova.fim}`);
  }
  const cobre = (l: LinhaDeReferencia): boolean =>
    l.tributo === nova.tributo && l.vigencia.inicio <= nova.inicio && (l.vigencia.fim ?? '9999-12-31') >= nova.fim;
  const alvo = linhas.findIndex(cobre);
  const linha = linhas[alvo];
  if (linha === undefined) {
    throw new Error(`nenhuma linha de ${nova.tributo} cobre ${nova.inicio} a ${nova.fim} inteira`);
  }
  if (linha.situacao !== 'desconhecida') {
    throw new Error(
      `a linha de ${nova.tributo} de ${linha.vigencia.inicio} já é oficial (${linha.aliquota}): corrija à mão, com a fonte`,
    );
  }
  const partes: LinhaDeReferencia[] = [];
  if (linha.vigencia.inicio < nova.inicio) {
    partes.push({ ...linha, vigencia: { inicio: linha.vigencia.inicio, fim: somarDias(nova.inicio, -1) } });
  }
  partes.push({
    tributo: nova.tributo,
    vigencia: { inicio: nova.inicio, fim: nova.fim },
    situacao: 'oficial',
    aliquota: percentualDaTabela(nova.aliquota),
    legal: nova.legal,
    fontes: nova.fontes,
  });
  if (linha.vigencia.fim === null || linha.vigencia.fim > nova.fim) {
    partes.push({ ...linha, vigencia: { inicio: somarDias(nova.fim, 1), fim: linha.vigencia.fim } });
  }
  return [...linhas.slice(0, alvo), ...partes, ...linhas.slice(alvo + 1)];
}
