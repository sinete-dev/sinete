// require() de pacote ESM puro (Node ^20.19 || >=22.12), na raiz e nos subpaths, e identidade entre require e import
// (a raiz e os subpaths saem do mesmo build com splitting: a classe é uma só).
const raiz = require('@sinete/ibs-cbs');
const rates = require('@sinete/ibs-cbs/aliquotas');
const engine = require('@sinete/ibs-cbs/calcular');
const rules = require('@sinete/ibs-cbs/validar');
const det = require('@sinete/ibs-cbs/determinar');
const failures = [];
if (rates.officialRates().nominal('2026-10-10').IBSUF.value !== '0.1') failures.push('alíquota via require');
if (engine.money(engine.Decimal.parse('2.675')) !== '2.68') failures.push('arredondamento via require');
if (!rules.RULES.some((r) => r.id === 'UB12-10')) failures.push('catálogo via require');
if (!det.LEGAL_RULES.some((r) => r.id === 'transferencia-mesmo-contribuinte')) failures.push('regras via require');
if (raiz.Decimal !== engine.Decimal || raiz.RULES !== rules.RULES) failures.push('raiz e subpath com cópias diferentes');
Promise.all([import('@sinete/ibs-cbs'), import('@sinete/ibs-cbs/aliquotas')]).then(([esm, esmRates]) => {
  if (esm.Decimal !== engine.Decimal) failures.push('mesma classe em require e import');
  if (esmRates.RATES_TABLE !== rates.RATES_TABLE) failures.push('mesma tabela em require e import');
  if (esm.LEGAL_RULES !== det.LEGAL_RULES) failures.push('mesmas regras em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
