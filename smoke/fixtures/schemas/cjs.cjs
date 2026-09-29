// require() de pacote ESM puro, de um subpath gerado, e identidade de classe entre require e import.
const schemas = require('@sinete/schemas');
const nfe = require('@sinete/schemas/nfe/PL_010f');
const failures = [];
if (nfe.schema.pl !== 'PL_010f_v1.04') failures.push('subpath via require');
if (schemas.validateRoot(nfe.NFeElement, '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"/>').length === 0) failures.push('validateRoot via require');
import('@sinete/schemas').then((esm) => {
  if (esm.VigenciaError !== schemas.VigenciaError) failures.push('mesma classe em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
