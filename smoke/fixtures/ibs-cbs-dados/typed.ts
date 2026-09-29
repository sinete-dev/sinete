// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { ApplicabilityResult, ClassTribRecord, DatasetDiff, IbsCbsDataset, TaxContent } from '@sinete/ibs-cbs-dados';
import { diffDatasets } from '@sinete/ibs-cbs-dados';
import { BUNDLED_DATASET, bundledDataset } from '@sinete/ibs-cbs-dados/bundled';

const ds: IbsCbsDataset = bundledDataset();
const at: TaxContent = ds.at('2026-10-10');
const ct: ClassTribRecord | undefined = at.classTrib('200003');
const r: ApplicabilityResult | undefined = ct ? at.applicableNcm(ct, '10063021') : undefined;
const diff: DatasetDiff = diffDatasets(BUNDLED_DATASET, BUNDLED_DATASET);
// @ts-expect-error aplicabilidade é uma união fechada
const bad: ApplicabilityResult['result'] = 'talvez';
void [r, diff, bad];
