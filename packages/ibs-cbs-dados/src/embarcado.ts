/**
 * `@sinete/ibs-cbs-dados/embarcado`: o dataset embarcado nesta versão do pacote, extraído por `tools/ibs-cbs-dados` das fontes
 * oficiais fixadas em `manifesto.fontes`. Entrada separada da principal para que quem carrega dados em runtime de
 * outra origem não leve os ~2 MB de JSON para o bundle.
 */

import anexos from './data/anexos.json' with { type: 'json' };
import aplicabilidadeNbs from './data/aplicabilidadeNbs.json' with { type: 'json' };
import aplicabilidadeNcm from './data/aplicabilidadeNcm.json' with { type: 'json' };
import atorClassTrib from './data/atorClassTrib.json' with { type: 'json' };
import atores from './data/atores.json' with { type: 'json' };
import classTrib from './data/classTrib.json' with { type: 'json' };
import credPres from './data/credPres.json' with { type: 'json' };
import cst from './data/cst.json' with { type: 'json' };
import gruposDeAtores from './data/gruposDeAtores.json' with { type: 'json' };
import manifest from './data/manifest.json' with { type: 'json' };
import nfseNbs from './data/nfseNbs.json' with { type: 'json' };
import redutorCompraGov from './data/redutorCompraGov.json' with { type: 'json' };
import tiposDfe from './data/tiposDfe.json' with { type: 'json' };
import transferenciaCbs from './data/transferenciaCbs.json' with { type: 'json' };
import tratamentos from './data/tratamentos.json' with { type: 'json' };
import type { DatasetIbsCbs } from './dataset.ts';
import { carregarDataset } from './dataset.ts';
import type { BundleDoDataset, ManifestoDoDataset, TabelasDoDataset } from './types.ts';

/** O bundle embarcado, como gravado em `src/data/`. */
export const DATASET_EMBARCADO: BundleDoDataset = {
  manifesto: manifest as unknown as ManifestoDoDataset,
  tabelas: {
    cst,
    classTrib,
    tratamentos,
    credPres,
    aplicabilidadeNcm,
    aplicabilidadeNbs,
    anexos,
    nfseNbs,
    gruposDeAtores,
    atores,
    atorClassTrib,
    tiposDfe,
    redutorCompraGov,
    transferenciaCbs,
  } as unknown as TabelasDoDataset,
};

let loaded: DatasetIbsCbs | undefined;

/** O dataset embarcado, carregado uma vez por processo. */
export function datasetEmbarcado(): DatasetIbsCbs {
  loaded ??= carregarDataset(DATASET_EMBARCADO);
  return loaded;
}
