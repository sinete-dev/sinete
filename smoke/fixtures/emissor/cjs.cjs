// require() de pacote ESM puro e identidade de classe entre require e import, na raiz e nos subpaths (as classes de
// erro são uma só: raiz e subpaths saem do mesmo build com splitting).
const emissor = require('@sinete/emissor');
const memoria = require('@sinete/emissor/memoria');
const contrato = require('@sinete/emissor/contrato');
const nfe = require('@sinete/emissor/nfe');
const mdfe = require('@sinete/emissor/mdfe');
const nfse = require('@sinete/emissor/nfse');
const core = require('@sinete/core');
const failures = [];
if (!(new emissor.TravaPerdidaError('x') instanceof core.SineteError)) failures.push('TravaPerdidaError via require');
if (typeof memoria.createMemoriaStore !== 'function' || typeof contrato.casosDoContrato !== 'function') {
  failures.push('memoria e contrato via require');
}
if (
  typeof nfe.createNfeEmissor !== 'function' ||
  typeof mdfe.createMdfeEmissor !== 'function' ||
  typeof nfse.createNfseEmissor !== 'function'
) {
  failures.push('emissores via require');
}
import('@sinete/emissor').then((esm) => {
  if (esm.TravaPerdidaError !== emissor.TravaPerdidaError) failures.push('mesma classe em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
