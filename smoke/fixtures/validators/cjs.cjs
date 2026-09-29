// require() de pacote ESM puro (Node ^20.19 || >=22.12) e o JSON da tabela de IE embutido no bundle.
const v = require('@sinete/validators');
const failures = [];
if (!v.isValidIe('10.987.654-7', 'GO')) failures.push('ie via require');
if (!v.isValidCnpj('12.ABC.345/01DE-35')) failures.push('cnpj via require');
import('@sinete/validators').then((esm) => {
  if (esm.parseIe !== v.parseIe) failures.push('mesma função em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
