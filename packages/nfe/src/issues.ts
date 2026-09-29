/**
 * Coletor de ocorrências de validação (`ValidationIssue` do core). O builder junta todas as ocorrências antes de
 * decidir, em vez de parar na primeira. Os códigos são API pública (snake_case, português, sem acento) e estão listados
 * em `NFE_ISSUE_CODES`.
 */

import type { OrigemOcorrencia, ValidationIssue } from '@sinete/core';

export const NFE_ISSUE_CODES = [
  'campo_obrigatorio',
  'campo_invalido',
  'campo_fora_do_pl',
  'decimal_invalido',
  'valor_divergente',
  'combinacao_invalida',
  'modelo_nao_suportado',
  'serie_invalida',
  'documento_invalido',
  'ie_invalida',
  'chave_invalida',
  'referencia_vedada',
  'resp_tec_obrigatorio',
  'csrt_obrigatorio',
  'ibscbs_calculo',
  'ibscbs_base_ausente',
  'ibscbs_nao_suportado',
  'ibscbs_redutor_divergente',
  'ibscbs_regra_nt',
  'totais_divergentes',
  'itens_limite',
  'contingencia_invalida',
  'pagamento_igual_total',
  'emitente_difere_do_certificado',
  'grupo_vedado',
  'pagamento_invalido',
  'qrcode_invalido',
  'schema',
] as const;

export type NfeIssueCode = (typeof NFE_ISSUE_CODES)[number];

export class Issues {
  readonly list: ValidationIssue[];

  constructor() {
    this.list = [];
  }

  /** Ocorrência sobre a entrada, a não ser que `origem` diga outra coisa (ADR 0011). */
  add(path: string, code: NfeIssueCode | string, message: string, origem: OrigemOcorrencia = 'entrada'): void {
    this.list.push({ path, code, message, origem });
  }

  /** Ocorrência sobre o que o sinete montou a partir da entrada (XML, schema, PL, chave gerada, calculadora). */
  montagem(path: string, code: NfeIssueCode | string, message: string): void {
    this.add(path, code, message, 'montagem');
  }

  /** As ocorrências com a `origem` preenchida: a que veio sem (a de um validador avulso) é da entrada. */
  get classificadas(): readonly ValidationIssue[] {
    return this.list.map((i) => (i.origem === undefined ? { ...i, origem: 'entrada' } : i));
  }

  /** Junta ocorrências de outra fonte; a que vier sem `origem` recebe a informada. */
  addAll(issues: readonly ValidationIssue[], origem: OrigemOcorrencia = 'entrada'): void {
    this.list.push(...issues.map((i) => (i.origem === undefined ? { ...i, origem } : i)));
  }

  /** Troca a `origem` das ocorrências a partir da posição `inicio` (as que uma conferência acabou de acrescentar). */
  reclassificarDesde(inicio: number, origem: OrigemOcorrencia): void {
    for (let k = inicio; k < this.list.length; k++) {
      const i = this.list[k];
      if (i !== undefined) this.list[k] = { ...i, origem };
    }
  }

  get empty(): boolean {
    return this.list.length === 0;
  }
}
