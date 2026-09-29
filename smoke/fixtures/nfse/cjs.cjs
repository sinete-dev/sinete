// require() de pacote ESM puro e identidade de função entre require e import.
const nfse = require('@sinete/nfse');
const failures = [];
if (nfse.cTribNacDps('01.01.01') !== '010101') failures.push('cTribNac via require');
if (nfse.TIPOS_EVENTO.cancelamento !== '101101') failures.push('tipos de evento via require');
if (nfse.VERSAO_LEIAUTE !== '1.01') failures.push('versão do leiaute via require');
import('@sinete/nfse').then((esm) => {
  if (esm.buildDps !== nfse.buildDps) failures.push('mesma função em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
