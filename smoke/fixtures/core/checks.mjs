// Verificações do @sinete/core compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import {
  authorized,
  fixedClock,
  formatDateTimeOffset,
  criarRotuloDoCaminho,
  isSineteError,
  matchOutcome,
  normalizarCaminho,
  rejected,
  SefazError,
  SineteError,
  timeContext,
  tpAmbOf,
  UFS,
  ufByCUf,
  unwrapAuthorized,
  ValidationError,
} from '@sinete/core';

export function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = fixedClock('2026-09-25T09:00:00-03:00');
  expect('fixedClock', clock.now().toISOString() === '2026-09-25T12:00:00.000Z');
  expect('normalizarCaminho', normalizarCaminho('/infNFe/det[2]/prod') === 'infNFe.det[1].prod');
  const rotulo = criarRotuloDoCaminho({ grupos: [{ padrao: /^itens\[(\d+)\]/, rotulo: (n) => `Item ${n}` }], campos: { xProd: 'Descrição' }, padrao: '?' });
  expect('criarRotuloDoCaminho', rotulo('itens[0].xProd') === 'Item 1, Descrição');
  expect('formatDateTimeOffset', formatDateTimeOffset(clock.now(), -180) === '2026-09-25T09:00:00-03:00');
  expect('timeContext', timeContext({ emissao: clock }).fatoGerador === clock);
  expect('UFS (json embutido)', UFS.length === 27 && ufByCUf('35')?.sigla === 'SP');
  expect('tpAmb', tpAmbOf('homologacao') === '2');
  const aut = authorized({ cStat: '100', xMotivo: 'Autorizado o uso da NF-e' }, { nProt: '1' });
  expect('unwrapAuthorized', unwrapAuthorized(aut).nProt === '1');
  const rej = rejected({ cStat: '539', xMotivo: 'Duplicidade' });
  expect('matchOutcome', matchOutcome(rej, { authorized: () => 'a', rejected: (r) => r.cStat, denied: () => 'd', pending: () => 'p' }) === '539');
  let err;
  try {
    unwrapAuthorized(rej);
  } catch (e) {
    err = e;
  }
  expect('SefazError instanceof', err instanceof SefazError && err instanceof SineteError && err instanceof Error);
  expect('SefazError code', err?.code === 'sefaz_rejeitou' && err?.cStat === '539');
  expect('isSineteError', isSineteError(err, 'sefaz_rejeitou'));
  const cause = new Error('raiz');
  const v = new ValidationError('x', [{ path: 'a', code: 'b', message: 'c' }], { cause });
  expect('cause', v.cause === cause && JSON.parse(JSON.stringify(v)).cause.message === 'raiz');
  return failures;
}
