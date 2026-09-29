/**
 * `@sinete/ibs-cbs-dados/bundled`: o dataset embarcado nesta versão do pacote, extraído por `tools/ibs-cbs-dados` das fontes
 * oficiais fixadas em `manifest.sources`. Entrada separada da principal para que quem carrega dados em runtime de
 * outra origem não leve os ~2 MB de JSON para o bundle.
 */
import actorClassTrib from './data/actorClassTrib.json' with { type: 'json' };
import actorGroups from './data/actorGroups.json' with { type: 'json' };
import actors from './data/actors.json' with { type: 'json' };
import annexes from './data/annexes.json' with { type: 'json' };
import cbsTransfer from './data/cbsTransfer.json' with { type: 'json' };
import classTrib from './data/classTrib.json' with { type: 'json' };
import credPres from './data/credPres.json' with { type: 'json' };
import cst from './data/cst.json' with { type: 'json' };
import dfeTypes from './data/dfeTypes.json' with { type: 'json' };
import govPurchaseReducer from './data/govPurchaseReducer.json' with { type: 'json' };
import manifest from './data/manifest.json' with { type: 'json' };
import nbsApplicability from './data/nbsApplicability.json' with { type: 'json' };
import ncmApplicability from './data/ncmApplicability.json' with { type: 'json' };
import nfseNbs from './data/nfseNbs.json' with { type: 'json' };
import treatments from './data/treatments.json' with { type: 'json' };
import type { IbsCbsDataset } from './dataset.ts';
import { loadDataset } from './dataset.ts';
import type { DatasetBundle, DatasetManifest, DatasetTables } from './types.ts';

/** O bundle embarcado, como gravado em `src/data/`. */
export const BUNDLED_DATASET: DatasetBundle = {
  manifest: manifest as unknown as DatasetManifest,
  tables: {
    cst,
    classTrib,
    treatments,
    credPres,
    ncmApplicability,
    nbsApplicability,
    annexes,
    nfseNbs,
    actorGroups,
    actors,
    actorClassTrib,
    dfeTypes,
    govPurchaseReducer,
    cbsTransfer,
  } as unknown as DatasetTables,
};

let loaded: IbsCbsDataset | undefined;

/** O dataset embarcado, carregado uma vez por processo. */
export function bundledDataset(): IbsCbsDataset {
  loaded ??= loadDataset(BUNDLED_DATASET);
  return loaded;
}
