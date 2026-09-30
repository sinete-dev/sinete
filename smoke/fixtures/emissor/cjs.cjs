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
if (!(new emissor.ErroTravaPerdida('x') instanceof core.ErroSinete)) failures.push('ErroTravaPerdida via require');
if (typeof memoria.criarMemoriaStore !== 'function' || typeof contrato.casosDoContrato !== 'function') {
  failures.push('memoria e contrato via require');
}
if (
  typeof nfe.criarEmissorNfe !== 'function' ||
  typeof mdfe.criarEmissorMdfe !== 'function' ||
  typeof nfse.criarEmissorNfse !== 'function'
) {
  failures.push('emissores via require');
}
import('@sinete/emissor').then((esm) => {
  if (esm.ErroTravaPerdida !== emissor.ErroTravaPerdida) failures.push('mesma classe em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
