// require() de pacote ESM puro (Node ^20.19 || >=22.12) e identidade de classe entre require e import, na raiz e no
// subpath ./xml (o XmlError do subpath precisa ser SineteError da mesma cópia do core).
const core = require('@sinete/core');
const xml = require('@sinete/core/xml');
const failures = [];
let err;
try {
  core.fixedClock('sem-fuso');
} catch (e) {
  err = e;
}
if (!(err instanceof core.ConfigError) || err.code !== 'config_invalida') failures.push('ConfigError via require');
let xerr;
try {
  xml.parseXml('<a><b></a>');
} catch (e) {
  xerr = e;
}
if (!(xerr instanceof xml.XmlError) || !(xerr instanceof core.SineteError)) failures.push('XmlError via require');
Promise.all([import('@sinete/core'), import('@sinete/core/xml')]).then(([esm, esmXml]) => {
  if (esm.SineteError !== core.SineteError) failures.push('mesma classe em require e import');
  if (esmXml.XmlError !== xml.XmlError) failures.push('mesma XmlError em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
