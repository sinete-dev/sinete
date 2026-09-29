// Verificações do @sinete/validators compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { isSineteError, ValidationError } from '@sinete/core';
import {
  buildChaveAcesso,
  formatCnpj,
  IE_TABLE,
  isValidCaepf,
  isValidCnpj,
  isValidCpf,
  isValidIe,
  parseChaveAcesso,
  parseIe,
  ieRule,
} from '@sinete/validators';

export function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  expect('cpf', isValidCpf('123.456.789-09') && !isValidCpf('123.456.789-00'));
  expect('cnpj numérico', isValidCnpj('11.222.333/0001-81'));
  expect('cnpj alfanumérico', isValidCnpj('PC3D315K000193') && formatCnpj('pc3d315k000193') === 'PC.3D3.15K/0001-93');
  expect('caepf', !isValidCaepf('11222333000181'));
  const ch = parseChaveAcesso('52060433009911002506550120000007800267301615', { layout: '1.10' });
  expect('chave', ch.ok && ch.value.uf === 'GO' && ch.value.cnpj === '33009911002506');
  const alfa = buildChaveAcesso({ cUF: '43', aamm: '2607', emitente: 'PC3D315K000193', mod: '55', serie: 1, nNF: 1, tpEmis: 1, cNF: 1 });
  expect('chave alfanumérica', parseChaveAcesso(alfa).ok);
  expect('ie json embutido', Object.keys(IE_TABLE).length === 3 && ieRule('SP').variants.length === 2);
  expect('ie mt', isValidIe('0013000001-9', 'MT'));
  expect('ie sp produtor', isValidIe('P-01100424.3/002', 'SP'));
  const bad = parseIe('120000386', 'MA', { path: 'dest.IE' });
  expect('ie ocorrência', !bad.ok && bad.error.code === 'ie_dv_invalido');
  const e = new ValidationError('x', bad.ok ? [] : [bad.error]);
  expect('compõe ValidationError', isSineteError(e, 'validacao_falhou') && e.issues[0].path === 'dest.IE');
  return failures;
}
