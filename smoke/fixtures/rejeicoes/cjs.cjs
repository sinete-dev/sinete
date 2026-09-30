// require() de pacote ESM puro (Node ^20.19 || >=22.12) com o catálogo JSON embutido.
const rej = require('@sinete/rejeicoes');
const failures = [];
if (rej.rejeicaoPorCodigo('539')?.categoria !== 'duplicidade') failures.push('lookup via require');
import('@sinete/rejeicoes').then((esm) => {
  if (esm.REJEICOES !== rej.REJEICOES) failures.push('mesmo catálogo em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
