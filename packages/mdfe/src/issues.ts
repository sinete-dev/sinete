/**
 * Coletor de ocorrências de validação (`ValidationIssue` do core). O builder junta todas as ocorrências antes de
 * decidir, em vez de parar na primeira. Os códigos são API pública (snake_case, português, sem acento) e estão listados
 * em `MDFE_ISSUE_CODES`; a mensagem de cada ocorrência de regra de negócio cita a regra do MOC e o `cStat` que a SEFAZ
 * devolveria.
 */

import type { Ocorrencia, OrigemOcorrencia } from '@sinete/core';

export const MDFE_ISSUE_CODES = [
  'campo_obrigatorio',
  'campo_invalido',
  'decimal_invalido',
  'combinacao_invalida',
  'serie_invalida',
  'documento_invalido',
  'ie_invalida',
  'chave_invalida',
  'municipio_uf_divergente',
  'duplicado',
  'percurso_invalido',
  'placa_invalida',
  'tipo_emitente_invalido',
  'carregamento_posterior_invalido',
  'pagamento_invalido',
  'seguro_obrigatorio',
  'ciot_obrigatorio',
  'contratante_obrigatorio',
  'prod_pred_obrigatorio',
  'contingencia_invalida',
  'schema',
] as const;

export type MdfeIssueCode = (typeof MDFE_ISSUE_CODES)[number];

export class Issues {
  readonly list: Ocorrencia[];

  constructor() {
    this.list = [];
  }

  /** Ocorrência sobre a entrada, a não ser que `origem` diga outra coisa (ADR 0011). */
  add(path: string, code: MdfeIssueCode | string, message: string, origem: OrigemOcorrencia = 'entrada'): void {
    this.list.push({ caminho: path, code, mensagem: message, origem });
  }

  /** Ocorrência sobre o que o sinete montou a partir da entrada (XML, schema, PL, chave gerada, calculadora). */
  montagem(path: string, code: MdfeIssueCode | string, message: string): void {
    this.add(path, code, message, 'montagem');
  }

  /** As ocorrências com a `origem` preenchida: a que veio sem (a de um validador avulso) é da entrada. */
  get classificadas(): readonly Ocorrencia[] {
    return this.list.map((i) => (i.origem === undefined ? { ...i, origem: 'entrada' } : i));
  }

  /** Ocorrência de uma regra do MOC: a mensagem termina com a regra e o `cStat` (`(F90, rejeição 663)`). */
  regra(path: string, code: MdfeIssueCode, message: string, regra: string, cStat: string): void {
    this.list.push({ caminho: path, code, mensagem: `${message} (${regra}, rejeição ${cStat})`, origem: 'entrada' });
  }

  get empty(): boolean {
    return this.list.length === 0;
  }
}
