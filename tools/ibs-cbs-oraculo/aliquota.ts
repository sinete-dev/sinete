/**
 * O dia da resolução do Senado: aplica uma alíquota publicada no `rates.json` em memória, confere o motor com ela contra
 * o próprio motor com a mesma alíquota informada e contra a Calculadora offline, e imprime o diff da tabela. Com
 * `--gravar`, grava `tools/ibs-cbs-dados/rates.json`; o resto do procedimento está no README, seção "Quando a
 * resolução do Senado sair".
 *
 *   bun tools/ibs-cbs-oraculo/aliquota.ts --referencia 8.8 --inicio 2027-01-01 --fim 2027-12-31 \
 *     --ato 'Resolução do Senado Federal nº N, de DD/MM/AAAA' --url https://... --data AAAA-MM-DD [--gravar]
 *   bun tools/ibs-cbs-oraculo/aliquota.ts --cbs 8.7 --inicio 2027-01-01 --fim 2028-12-31 --sem-oraculo
 *
 * Outras opções: `--n 300` e `--seed 2027` (amostra do gerador dentro da vigência), `--api URL` (contêiner já de pé),
 * `--calculadora-com-aliquota` (a Calculadora já conhece a alíquota do ano: não a informa a ela), `--no-build`,
 * `--out dir` (padrão `~/.local/state/sinete/ibs-cbs-oraculo/aliquota-<inicio>`).
 */
import path from 'node:path';
import { $ } from 'bun';

// Como o `run.ts`: os imports de `@sinete/*` resolvem pelo `dist`, que precisa existir antes de carregar o resto.
if (!process.argv.includes('--no-build')) {
  const root = path.resolve(import.meta.dir, '../..');
  for (const p of ['core', 'ibs-cbs-dados', 'ibs-cbs']) {
    await $`bun scripts/build.ts packages/${p}`.cwd(root).quiet();
  }
  console.error('aliquota: pacotes core, ibs-cbs-dados e ibs-cbs compilados');
}
await import('./src/aliquota-main.ts');
