// require() de pacote ESM puro (condição node) e identidade de classe entre require e import.
const sim = require('@sinete/sefaz-sim');
const failures = [];
if (typeof sim.criarSefazSim !== 'function') failures.push('criarSefazSim via require');
if (typeof sim.iniciarServidorSefazSim !== 'function') failures.push('entrada node via require');
import('@sinete/sefaz-sim').then((esm) => {
  if (esm.criarSefazSim !== sim.criarSefazSim) failures.push('mesma função em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
