// require() de pacote ESM puro (condição node) e identidade de classe entre require e import.
const transport = require('@sinete/transport');
const core = require('@sinete/core');
const failures = [];
const e = new transport.TransportError('falha_tls', 'x');
if (!(e instanceof core.SineteError)) failures.push('TransportError via require');
if (typeof transport.createNodeTransport !== 'function') failures.push('entrada node via require');
import('@sinete/transport').then((esm) => {
  if (esm.TransportError !== transport.TransportError) failures.push('mesma classe em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
