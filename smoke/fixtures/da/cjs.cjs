// require() de pacote ESM puro e identidade de classe entre require e import, na raiz e nos subpaths (a classe de erro
// é uma só: raiz e subpaths saem do mesmo build com splitting).
const da = require('@sinete/da');
const nfe = require('@sinete/da/nfe');
const nfce = require('@sinete/da/nfce');
const mdfe = require('@sinete/da/mdfe');
const cce = require('@sinete/da/cce');
const nfse = require('@sinete/da/nfse');
const core = require('@sinete/core');
const failures = [];
let err;
try {
  nfe.danfe('<a/>');
} catch (e) {
  err = e;
}
if (!(err instanceof da.ErroDa) || !(err instanceof core.ErroSinete)) failures.push('ErroDa via require');
if (nfe.ErroDa !== da.ErroDa || mdfe.ErroDa !== da.ErroDa || nfse.ErroDa !== da.ErroDa) {
  failures.push('uma classe só entre subpaths');
}
if (typeof nfce.danfce !== 'function' || typeof mdfe.damdfe !== 'function' || typeof cce.dacce !== 'function' || typeof nfse.danfse !== 'function') {
  failures.push('funções dos subpaths via require');
}
if (da.gerarPdf({ titulo: 't', paginas: [], imagens: {}, estatisticas: { reduzidos: 0, quebrados: 0, cortados: 0 } })[0] !== 37) failures.push('gerarPdf via require');
import('@sinete/da').then((esm) => {
  if (esm.ErroDa !== da.ErroDa) failures.push('mesma classe em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
