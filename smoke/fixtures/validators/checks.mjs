// Verificações do @sinete/validators compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { ehErroSinete, ErroDeValidacao } from '@sinete/core';
import {
  montarChaveAcesso,
  formatarCnpj,
  TABELA_IE,
  caepfValido,
  cnpjValido,
  cpfValido,
  ieValida,
  lerChaveAcesso,
  lerIe,
  regraIe,
} from '@sinete/validators';

export function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  expect('cpf', cpfValido('123.456.789-09') && !cpfValido('123.456.789-00'));
  expect('cnpj numérico', cnpjValido('11.222.333/0001-81'));
  expect('cnpj alfanumérico', cnpjValido('PC3D315K000193') && formatarCnpj('pc3d315k000193') === 'PC.3D3.15K/0001-93');
  expect('caepf', !caepfValido('11222333000181'));
  const ch = lerChaveAcesso('52060433009911002506550120000007800267301615', { leiaute: '1.10' });
  expect('chave', ch.ok && ch.valor.uf === 'GO' && ch.valor.cnpj === '33009911002506');
  const alfa = montarChaveAcesso({ cUF: '43', aamm: '2607', emitente: 'PC3D315K000193', mod: '55', serie: 1, nNF: 1, tpEmis: 1, cNF: 1 });
  expect('chave alfanumérica', lerChaveAcesso(alfa).ok);
  expect('ie json embutido', Object.keys(TABELA_IE).length === 3 && regraIe('SP').variantes.length === 2);
  expect('ie mt', ieValida('0013000001-9', 'MT'));
  expect('ie sp produtor', ieValida('P-01100424.3/002', 'SP'));
  const bad = lerIe('120000386', 'MA', { caminho: 'dest.IE' });
  expect('ie ocorrência', !bad.ok && bad.erro.code === 'ie_dv_invalido');
  const e = new ErroDeValidacao('x', bad.ok ? [] : [bad.erro]);
  expect('compõe ValidationError', ehErroSinete(e, 'validacao_falhou') && e.ocorrencias[0].caminho === 'dest.IE');
  return failures;
}
