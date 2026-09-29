/**
 * Teste diferencial opcional contra a Calculadora offline (ADR 0007). Fora do `bun run check`: precisa de Docker, do
 * zip oficial (baixado e conferido pelo sha256) e de alguns minutos. Roda localmente e no workflow `ibs-cbs-oraculo` do CI.
 *
 *   bun tools/ibs-cbs-oraculo/run.ts [--n 400] [--seed 1] [--api URL] [--image tag] [--keep] [--out dir]
 *                               [--pairs 400] [--actors 60] [--record] [--no-build]
 *
 * 1. Compila `core`, `ibs-cbs-dados` e `ibs-cbs` (o oráculo importa os pacotes pelo `dist`).
 * 2. Garante a imagem conferida pelo `diff_id` e sobe um contêiner com nome único (ou usa `--api`).
 * 3. Gera `--n` operações sintéticas com a semente, calcula nos dois lados e compara campo a campo; cada divergência
 *    precisa de uma entrada em `ledger.json`. Confere também o dataset contra a API `dados-abertos`.
 * 4. Falha (saída 1) com divergência não explicada, entrada do ledger vencida (`expectHits` sem nenhum caso) ou
 *    diferença no dataset. O relatório vai para `--out` (padrão `~/.local/state/sinete/ibs-cbs-oraculo/`).
 * 5. Com `--record`, grava as fixtures dos testes unitários a partir desta execução.
 * 6. Remove o contêiner que criou (pelo nome), salvo `--keep`.
 */
import path from 'node:path';
import { $ } from 'bun';

// Os imports de `@sinete/*` do oráculo resolvem pelo `dist`: compila a cadeia antes de carregar o resto (em checkout
// limpo não há `dist`, e um import estático falharia antes de qualquer build).
if (!process.argv.includes('--no-build')) {
  const root = path.resolve(import.meta.dir, '../..');
  for (const p of ['core', 'ibs-cbs-dados', 'ibs-cbs']) {
    await $`bun scripts/build.ts packages/${p}`.cwd(root).quiet();
  }
  console.error('ibs-cbs-oraculo: pacotes core, ibs-cbs-dados e ibs-cbs compilados');
}
await import('./src/main.ts');
