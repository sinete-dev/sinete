// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { ResultadoAplicabilidade, RegistroClassTrib, DiferencaDeDatasets, DatasetIbsCbs, ConteudoTributario } from '@sinete/ibs-cbs-dados';
import { compararDatasets } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO, datasetEmbarcado } from '@sinete/ibs-cbs-dados/bundled';

const ds: DatasetIbsCbs = datasetEmbarcado();
const at: ConteudoTributario = ds.em('2026-10-10');
const ct: RegistroClassTrib | undefined = at.classTrib('200003');
const r: ResultadoAplicabilidade | undefined = ct ? at.ncmAplicavel(ct, '10063021') : undefined;
const diff: DiferencaDeDatasets = compararDatasets(DATASET_EMBARCADO, DATASET_EMBARCADO);
// @ts-expect-error aplicabilidade é uma união fechada
const bad: ResultadoAplicabilidade['resultado'] = 'talvez';
void [r, diff, bad];
