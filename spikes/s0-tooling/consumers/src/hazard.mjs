// Dual package hazard: a mesma app carrega o pacote por import e por require.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const out = {};
for (const name of ['@sinete/core', '@sinete/core-dual']) {
  const viaImport = await import(name);
  const viaRequire = require(name);
  const e = new viaRequire.SineteError('E1', 'x');
  out[name] = { sameClass: viaImport.SineteError === viaRequire.SineteError, instanceofAcross: e instanceof viaImport.SineteError };
}
console.log(JSON.stringify({ rt: `node ${process.version}`, ...out }));
