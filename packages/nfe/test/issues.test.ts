import { expect, test } from 'bun:test';
import { CODIGOS_OCORRENCIA_NFE } from '../src/index.ts';
import { Issues } from '../src/issues.ts';

test('Issues acumula ocorrências com códigos estáveis', () => {
  const i = new Issues();
  expect(i.empty).toBe(true);
  i.add('a', 'campo_obrigatorio', 'm');
  i.addAll([{ caminho: 'b', code: 'schema', mensagem: 'n' }]);
  expect(i.empty).toBe(false);
  expect(i.list.map((x) => x.caminho)).toEqual(['a', 'b']);
  expect(CODIGOS_OCORRENCIA_NFE).toContain('campo_fora_do_pl');
});
