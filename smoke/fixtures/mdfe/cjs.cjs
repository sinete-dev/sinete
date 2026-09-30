// require() de pacote ESM puro e identidade de função entre require e import.
const mdfe = require('@sinete/mdfe');
const failures = [];
if (mdfe.dec('1.5').toFixed(2) !== '1.50') failures.push('decimal via require');
if (mdfe.TipoEmitente.CARGA_PROPRIA !== '2') failures.push('enum via require');
if (!mdfe.saoVizinhas('SP', 'MG')) failures.push('divisas via require');
import('@sinete/mdfe').then((esm) => {
  if (esm.montarMdfe !== mdfe.montarMdfe) failures.push('mesma função em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
