// require() de pacote ESM puro (Node ^20.19 || >=22.12) com o dataset JSON embutido.
const { datasetEmbarcado } = require('@sinete/ibs-cbs-dados/embarcado');
const data = require('@sinete/ibs-cbs-dados');
const failures = [];
const ds = datasetEmbarcado();
if (!ds.em('2026-10-10').classTrib('000001')) failures.push('dataset via require');
if (typeof data.carregarDataset !== 'function') failures.push('carregarDataset via require');
import('@sinete/ibs-cbs-dados/embarcado').then((esm) => {
  if (esm.datasetEmbarcado() !== ds) failures.push('mesmo dataset em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
