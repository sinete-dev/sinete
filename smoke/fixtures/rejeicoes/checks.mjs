// Verificações do @sinete/rejeicoes compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { rejected } from '@sinete/core';
import { enrichOutcome, enrichRejected, REJEICOES, REJEICOES_TABLE, rejeicaoByCode } from '@sinete/rejeicoes';
import { enrichRejectedMdfe, REJEICOES_MDFE, rejeicaoMdfeByCode } from '@sinete/rejeicoes/mdfe';
import { enrichNfseRejected, NFSE_ERROS, NFSE_ERROS_TABLE, nfseErroByCode } from '@sinete/rejeicoes/nfse';

export function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  expect('json embutido', REJEICOES.length >= 810 && REJEICOES_TABLE.sources.length >= 2);
  expect('3 dígitos', rejeicaoByCode('233')?.message === 'IE do destinatário não cadastrada');
  expect('4 dígitos', rejeicaoByCode('1037')?.category === 'reforma');
  const r = enrichRejected(rejected({ cStat: '204', xMotivo: 'Rejeição: Duplicidade de NF-e' }));
  expect('hint', r.hint?.source === 'MOC 7.0 Anexo I, RV 2B08-20');
  const o = enrichOutcome(rejected({ cStat: '9998', xMotivo: 'x' }));
  expect('sem hint fora do catálogo', o.status === 'rejected' && o.hint === undefined);
  expect('mdfe: entrada própria', REJEICOES_MDFE.length >= 200 && rejeicaoMdfeByCode('663')?.message === 'Percurso informado inválido');
  expect('mdfe: hint', enrichRejectedMdfe(rejected({ cStat: '686', xMotivo: 'x' })).hint?.source === 'MOC MDF-e 3.00b Anexo I, regra F86');
  expect('nfse: json embutido', NFSE_ERROS.length >= 490 && NFSE_ERROS_TABLE.sources.length === 2);
  expect('nfse: nível 3', nfseErroByCode('E0312')?.nivel === '3');
  const n = enrichNfseRejected(rejected({ cStat: 'E1229', xMotivo: 'Xml não está utilizando codificação UTF-8.' }));
  expect('nfse: hint', n.hint?.source.includes('RN_RECEPCAO_DPS') === true);
  return failures;
}
