import { expect, test } from 'bun:test';
import { DADOS_PATH, dadosSmoke } from './smoke-dados.ts';

test('smoke/fixtures/da/dados.mjs em dia com o layout (rode test/smoke-dados.ts para atualizar)', async () => {
  expect(await Bun.file(DADOS_PATH).text()).toBe(await dadosSmoke());
});
