// Verificações do @sinete/core compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import {
  criarAutorizado,
  relogioFixo,
  formatarDataHoraComFuso,
  criarRotuloDoCaminho,
  ehErroSinete,
  tratarResultado,
  normalizarCaminho,
  criarRecusado,
  ErroSefaz,
  ErroSinete,
  contextoDeTempo,
  tpAmbDoAmbiente,
  UFS,
  ufPorCUf,
  exigirAutorizado,
  ErroDeValidacao,
} from '@sinete/core';

export function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = relogioFixo('2026-09-25T09:00:00-03:00');
  expect('relogioFixo', clock.agora().toISOString() === '2026-09-25T12:00:00.000Z');
  expect('normalizarCaminho', normalizarCaminho('/infNFe/det[2]/prod') === 'infNFe.det[1].prod');
  const rotulo = criarRotuloDoCaminho({ grupos: [{ padrao: /^itens\[(\d+)\]/, rotulo: (n) => `Item ${n}` }], campos: { xProd: 'Descrição' }, padrao: '?' });
  expect('criarRotuloDoCaminho', rotulo('itens[0].xProd') === 'Item 1, Descrição');
  expect('formatarDataHoraComFuso', formatarDataHoraComFuso(clock.agora(), -180) === '2026-09-25T09:00:00-03:00');
  expect('contextoDeTempo', contextoDeTempo({ emissao: clock }).fatoGerador === clock);
  expect('UFS (json embutido)', UFS.length === 27 && ufPorCUf('35')?.sigla === 'SP');
  expect('tpAmb', tpAmbDoAmbiente('homologacao') === '2');
  const aut = criarAutorizado({ cStat: '100', xMotivo: 'Autorizado o uso da NF-e' }, { nProt: '1' });
  expect('exigirAutorizado', exigirAutorizado(aut).nProt === '1');
  const rej = criarRecusado({ cStat: '539', xMotivo: 'Duplicidade' });
  expect('tratarResultado', tratarResultado(rej, { autorizado: () => 'a', recusado: (r) => r.cStat, denegado: () => 'd', pendente: () => 'p' }) === '539');
  let err;
  try {
    exigirAutorizado(rej);
  } catch (e) {
    err = e;
  }
  expect('ErroSefaz instanceof', err instanceof ErroSefaz && err instanceof ErroSinete && err instanceof Error);
  expect('ErroSefaz code', err?.code === 'sefaz_rejeitou' && err?.cStat === '539');
  expect('ehErroSinete', ehErroSinete(err, 'sefaz_rejeitou'));
  const cause = new Error('raiz');
  const v = new ErroDeValidacao('x', [{ caminho: 'a', code: 'b', mensagem: 'c' }], { cause });
  expect('cause', v.cause === cause && JSON.parse(JSON.stringify(v)).cause.message === 'raiz');
  return failures;
}
