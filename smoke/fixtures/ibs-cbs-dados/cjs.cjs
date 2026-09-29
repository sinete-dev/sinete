// require() de pacote ESM puro (Node ^20.19 || >=22.12) com o dataset JSON embutido.
const { bundledDataset } = require('@sinete/ibs-cbs-dados/bundled');
const data = require('@sinete/ibs-cbs-dados');
const failures = [];
const ds = bundledDataset();
if (!ds.at('2026-10-10').classTrib('000001')) failures.push('dataset via require');
if (typeof data.loadDataset !== 'function') failures.push('loadDataset via require');
import('@sinete/ibs-cbs-dados/bundled').then((esm) => {
  if (esm.bundledDataset() !== ds) failures.push('mesmo dataset em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
