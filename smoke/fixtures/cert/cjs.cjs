// require() de pacote ESM puro e identidade de classe entre require e import.
const cert = require('@sinete/cert');
const core = require('@sinete/core');
const failures = [];
const e = new cert.CertError('pfx_invalido', 'x');
if (!(e instanceof core.SineteError) || !core.isSineteError(e, 'pfx_invalido')) failures.push('CertError via require');
import('@sinete/cert').then((esm) => {
  if (esm.CertError !== cert.CertError) failures.push('mesma classe em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
