// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Resultado, Ocorrencia } from '@sinete/core';
import type { ChaveAcesso, InscricaoEstadual, CodigoOcorrencia } from '@sinete/validators';
import { lerChaveAcesso, lerIe } from '@sinete/validators';

const r: Resultado<InscricaoEstadual, Ocorrencia> = lerIe('0013000001-9', 'MT');
if (r.ok && r.valor.tipo === 'numero') {
  const formatted: string = r.valor.formatada;
  const legacy: boolean = r.valor.legado;
  void [formatted, legacy];
}
const ch = lerChaveAcesso('52060433009911002506550120000007800267301615', { leiaute: '1.10' });
if (ch.ok) {
  const c: ChaveAcesso = ch.valor;
  const cnpj: string | undefined = c.cnpj;
  void cnpj;
}
const code: CodigoOcorrencia = 'ie_dv_invalido';
// @ts-expect-error a UF é a união fechada do core
lerIe('1', 'EX');
void code;
