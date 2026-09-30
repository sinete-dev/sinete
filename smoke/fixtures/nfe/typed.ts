// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Ocorrencia } from '@sinete/core';
import type {
  AutorizacaoOutcome,
  BuildNfeResult,
  GrupoIbsCbs,
  IbsCbsCalculator,
  IbsCbsResponse,
  Icms,
  NfeClient,
  NfeInput,
  IbsCbsCalculatorOptions,
} from '@sinete/nfe';
import { carregarDatasetEmbarcado, Decimal, MotivoDesoneracaoIcms, ibsCbsCalculator } from '@sinete/nfe';
import type { IbsCbsDataset } from '@sinete/nfe/ibs-cbs';
import { officialRates } from '@sinete/nfe/ibs-cbs';

const icms: Icms = {
  CST: '20',
  orig: '0',
  pRedBC: '10',
  pICMS: 18,
  desoneracao: { vICMSDeson: '1.00', motDesICMS: MotivoDesoneracaoIcms.OUTROS },
};
// @ts-expect-error o motivo 7 (SUFRAMA) não vale para o CST 20
const errado: Icms = { CST: '20', orig: '0', pRedBC: '10', pICMS: 18, desoneracao: { vICMSDeson: '1', motDesICMS: '7' } };

const calc: IbsCbsCalculator = {
  calcular({ itens }): IbsCbsResponse {
    return {
      itens: itens.map((i) => ({ nItem: i.nItem, IBSCBS: { CST: i.CST, cClassTrib: i.cClassTrib } })),
    };
  },
};
declare const input: NfeInput;
declare const r: BuildNfeResult;
declare const client: NfeClient;
if (!r.ok) {
  const issues: readonly Ocorrencia[] = r.issues;
  void issues;
}
const d: Decimal = Decimal.of('1.5').times(2);
const opcoes: IbsCbsCalculatorOptions = { rates: officialRates(), regras: false };
const padrao: IbsCbsCalculator = ibsCbsCalculator();
const comOpcoes: IbsCbsCalculator = ibsCbsCalculator(opcoes);
const ds: Promise<IbsCbsDataset> = carregarDatasetEmbarcado();
const grupo: GrupoIbsCbs | undefined = undefined;
// @ts-expect-error regras é `false` ou um objeto
ibsCbsCalculator({ regras: true });
declare const desfecho: AutorizacaoOutcome;
const nfeProc: string | undefined = desfecho.tipo === 'autorizado' ? desfecho.valor.nfeProc : undefined;
void [icms, errado, calc, input, client, d, padrao, comOpcoes, ds, grupo, nfeProc];
