// require() de pacote ESM puro (Node ^20.19 || >=22.12) e identidade de classe entre require e import, na raiz e no
// subpath ./xml (o XmlError do subpath precisa ser SineteError da mesma cópia do core).
const core = require('@sinete/core');
const xml = require('@sinete/core/xml');
const failures = [];
let err;
try {
  core.relogioFixo('sem-fuso');
} catch (e) {
  err = e;
}
if (!(err instanceof core.ErroDeConfiguracao) || err.code !== 'config_invalida') failures.push('ErroDeConfiguracao via require');
let xerr;
try {
  xml.lerXml('<a><b></a>');
} catch (e) {
  xerr = e;
}
if (!(xerr instanceof xml.ErroXml) || !(xerr instanceof core.ErroSinete)) failures.push('ErroXml via require');
Promise.all([import('@sinete/core'), import('@sinete/core/xml')]).then(([esm, esmXml]) => {
  if (esm.ErroSinete !== core.ErroSinete) failures.push('mesma classe em require e import');
  if (esmXml.ErroXml !== xml.ErroXml) failures.push('mesma ErroXml em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
