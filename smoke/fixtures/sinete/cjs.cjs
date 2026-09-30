// require() dos subpaths do guarda-chuva, a mesma cópia do pacote de origem e a ausência da raiz.
const nfe = require('sinete/nfe');
const origem = require('@sinete/nfe');
const da = require('sinete/da/mdfe');
const failures = [];
if (nfe.montarNfe !== origem.montarNfe) failures.push('sinete/nfe via require');
if (typeof da.damdfe !== 'function') failures.push('sinete/da/mdfe via require');
try {
  require('sinete');
  failures.push('a raiz do guarda-chuva não pode existir');
} catch (e) {
  if (e.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') failures.push(`raiz: ${e.code}`);
}
import('sinete/nfe').then((esm) => {
  if (esm.montarNfe !== nfe.montarNfe) failures.push('mesma função em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
