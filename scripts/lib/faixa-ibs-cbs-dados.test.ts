/**
 * O `@sinete/ibs-cbs-dados` tem versão de calendário (`AAAA.M.patch`), e `^2026.9.2` não aceita `2027.1.0`: quem
 * depende dele declara uma faixa aberta para cima (`workspace:>=`), e a trava de compatibilidade é o `versaoDoFormato`,
 * conferido em runtime pelo motor (`exigirFormatoDosDados` do `@sinete/ibs-cbs`). ADR 0016.
 */
import { expect, test } from 'bun:test';
import { workspacePackages } from './workspace.ts';

const DADOS = '@sinete/ibs-cbs-dados';

test('quem depende do ibs-cbs-dados aceita o dataset atual e os dos anos seguintes', async () => {
  const pacotes = await workspacePackages();
  const atual = pacotes.find((p) => p.manifest.name === DADOS)?.manifest.version as string;
  const ano = Number(atual.split('.')[0]);
  const dependentes = pacotes.filter(
    (p) => p.manifest.name !== 'sinete' && p.manifest.private !== true && p.manifest.dependencies?.[DADOS],
  );
  expect(dependentes.map((p) => p.manifest.name).sort()).toEqual(['@sinete/ibs-cbs', '@sinete/nfe']);
  for (const p of dependentes) {
    // O que o `bun pm pack` grava: `workspace:^` vira `^<atual>`, `workspace:*` a versão exata, o resto como está.
    const declarada = String(p.manifest.dependencies?.[DADOS]).replace(/^workspace:/, '');
    const faixa =
      declarada === '*' ? atual : declarada === '^' || declarada === '~' ? `${declarada}${atual}` : declarada;
    const aceita = [atual, `${ano + 1}.1.0`, `${ano + 2}.6.3`].map((v) => Bun.semver.satisfies(v, faixa));
    expect({ pacote: p.manifest.name, faixa, aceita }).toEqual({
      pacote: p.manifest.name,
      faixa,
      aceita: [true, true, true],
    });
  }
});
