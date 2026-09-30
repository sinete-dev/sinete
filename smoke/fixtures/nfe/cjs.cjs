// require() de pacote ESM puro e identidade de função entre require e import.
const nfe = require('@sinete/nfe');
const failures = [];
if (nfe.dec('1.005').toFixed(2) !== '1.01') failures.push('decimal via require');
if (nfe.MotivoDesoneracaoIcms.SUFRAMA !== '7') failures.push('enum via require');
if (typeof nfe.calculadoraIbsCbs().calcular !== 'function') failures.push('calculadora padrão via require');
const ibsCbs = require('@sinete/nfe/ibs-cbs');
if (ibsCbs.aliquotasOficiais().nominal('2026-10-10').CBS.valor !== '0.9') failures.push('nfe/ibs-cbs via require');
import('@sinete/nfe').then((esm) => {
  if (esm.montarNfe !== nfe.montarNfe) failures.push('mesma função em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
