// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Ocorrencia } from '@sinete/core';
import type {
  ResultadoAutorizacao,
  ResultadoMontagemNfe,
  GrupoIbsCbs,
  CalculadoraIbsCbs,
  RespostaIbsCbs,
  Icms,
  ClienteNfe,
  DadosNfe,
  CalculadoraIbsCbsOpcoes,
} from '@sinete/nfe';
import { carregarDatasetEmbarcado, Decimal, MotivoDesoneracaoIcms, calculadoraIbsCbs } from '@sinete/nfe';
import type { DatasetIbsCbs } from '@sinete/nfe/ibs-cbs';
import { aliquotasOficiais } from '@sinete/nfe/ibs-cbs';

const icms: Icms = {
  CST: '20',
  orig: '0',
  pRedBC: '10',
  pICMS: 18,
  desoneracao: { vICMSDeson: '1.00', motDesICMS: MotivoDesoneracaoIcms.OUTROS },
};
// @ts-expect-error o motivo 7 (SUFRAMA) não vale para o CST 20
const errado: Icms = { CST: '20', orig: '0', pRedBC: '10', pICMS: 18, desoneracao: { vICMSDeson: '1', motDesICMS: '7' } };

const calc: CalculadoraIbsCbs = {
  calcular({ itens }): RespostaIbsCbs {
    return {
      itens: itens.map((i) => ({ nItem: i.nItem, IBSCBS: { CST: i.CST, cClassTrib: i.cClassTrib } })),
    };
  },
};
declare const input: DadosNfe;
declare const r: ResultadoMontagemNfe;
declare const client: ClienteNfe;
if (!r.ok) {
  const issues: readonly Ocorrencia[] = r.ocorrencias;
  void issues;
}
const d: Decimal = Decimal.of('1.5').times(2);
const opcoes: CalculadoraIbsCbsOpcoes = { aliquotas: aliquotasOficiais(), regras: false };
const padrao: CalculadoraIbsCbs = calculadoraIbsCbs();
const comOpcoes: CalculadoraIbsCbs = calculadoraIbsCbs(opcoes);
const ds: Promise<DatasetIbsCbs> = carregarDatasetEmbarcado();
const grupo: GrupoIbsCbs | undefined = undefined;
// @ts-expect-error regras é `false` ou um objeto
calculadoraIbsCbs({ regras: true });
declare const desfecho: ResultadoAutorizacao;
const nfeProc: string | undefined = desfecho.tipo === 'autorizado' ? desfecho.valor.nfeProc : undefined;
void [icms, errado, calc, input, client, d, padrao, comOpcoes, ds, grupo, nfeProc];
