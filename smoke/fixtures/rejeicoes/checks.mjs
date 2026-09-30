// Verificações do @sinete/rejeicoes compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { criarRecusado } from '@sinete/core';
import { completarResultado, completarRecusado, REJEICOES, TABELA_REJEICOES, rejeicaoPorCodigo } from '@sinete/rejeicoes';
import { completarRecusadoMdfe, REJEICOES_MDFE, rejeicaoMdfePorCodigo } from '@sinete/rejeicoes/mdfe';
import { completarRecusadoNfse, NFSE_ERROS, TABELA_ERROS_NFSE, nfseErroPorCodigo } from '@sinete/rejeicoes/nfse';

export function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  expect('json embutido', REJEICOES.length >= 810 && TABELA_REJEICOES.fontes.length >= 2);
  expect('3 dígitos', rejeicaoPorCodigo('233')?.mensagem === 'IE do destinatário não cadastrada');
  expect('4 dígitos', rejeicaoPorCodigo('1037')?.categoria === 'reforma');
  const r = completarRecusado(criarRecusado({ cStat: '204', xMotivo: 'Rejeição: Duplicidade de NF-e' }));
  expect('dica', r.dica?.fonte === 'MOC 7.0 Anexo I, RV 2B08-20');
  const o = completarResultado(criarRecusado({ cStat: '9998', xMotivo: 'x' }));
  expect('sem hint fora do catálogo', o.tipo === 'recusado' && o.dica === undefined);
  expect('mdfe: entrada própria', REJEICOES_MDFE.length >= 200 && rejeicaoMdfePorCodigo('663')?.mensagem === 'Percurso informado inválido');
  expect('mdfe: hint', completarRecusadoMdfe(criarRecusado({ cStat: '686', xMotivo: 'x' })).dica?.fonte === 'MOC MDF-e 3.00b Anexo I, regra F86');
  expect('nfse: json embutido', NFSE_ERROS.length >= 490 && TABELA_ERROS_NFSE.fontes.length === 2);
  expect('nfse: nível 3', nfseErroPorCodigo('E0312')?.nivel === '3');
  const n = completarRecusadoNfse(criarRecusado({ cStat: 'E1229', xMotivo: 'Xml não está utilizando codificação UTF-8.' }));
  expect('nfse: hint', n.dica?.fonte.includes('RN_RECEPCAO_DPS') === true);
  return failures;
}
