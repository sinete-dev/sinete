// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Result, ValidationIssue } from '@sinete/core';
import type { ChaveAcesso, InscricaoEstadual, ValidationIssueCode } from '@sinete/validators';
import { parseChaveAcesso, parseIe } from '@sinete/validators';

const r: Result<InscricaoEstadual, ValidationIssue> = parseIe('0013000001-9', 'MT');
if (r.ok && r.value.kind === 'numero') {
  const formatted: string = r.value.formatted;
  const legacy: boolean = r.value.legacy;
  void [formatted, legacy];
}
const ch = parseChaveAcesso('52060433009911002506550120000007800267301615', { layout: '1.10' });
if (ch.ok) {
  const c: ChaveAcesso = ch.value;
  const cnpj: string | undefined = c.cnpj;
  void cnpj;
}
const code: ValidationIssueCode = 'ie_dv_invalido';
// @ts-expect-error a UF é a união fechada do core
parseIe('1', 'EX');
void code;
