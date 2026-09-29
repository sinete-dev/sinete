/**
 * Gravação das fixtures dos testes unitários a partir de uma execução do oráculo. Os testes padrão (`bun run check`)
 * não sobem contêiner: conferem o motor e o dataset contra estas respostas gravadas.
 *
 * - `packages/ibs-cbs/test/calcular/fixtures/oracle-cases.json`: cada caso com a entrada, a saída do motor projetada em
 *   `caminho -> texto` e as divergências em relação à Calculadora, com a entrada do ledger que explica cada uma.
 * - `packages/ibs-cbs-dados/test/fixtures/oracle-data.json`: pares de aplicabilidade de NCM/NBS, consultas por atores e
 *   listas de cClassTrib e CST vigentes, como a API `dados-abertos` respondeu.
 *
 * Tudo sintético: CST, cClassTrib, NCM e NBS de tabelas oficiais, valores inventados, nenhum dado pessoal.
 */
import path from 'node:path';
import { $ } from 'bun';
import type { CaseResult } from './check.ts';
import { flattenRoc } from './compare.ts';
import type { ActorsCase, ApplicabilityPair, ListCase } from './data.ts';
import type { OracleCase } from './generate.ts';
import type { Ledger } from './ledger.ts';
import { explain } from './ledger.ts';

async function writeFormatted(root: string, file: string, value: unknown): Promise<void> {
  const biome = path.join(root, 'node_modules/.bin/biome');
  const body =
    await $`${biome} format --stdin-file-path=${file} < ${new Response(`${JSON.stringify(value, null, 2)}\n`)}`
      .cwd(root)
      .quiet()
      .text();
  await Bun.write(file, body);
}

export async function writeFixtures(
  root: string,
  ledger: Ledger,
  recorded: readonly { case: OracleCase; result: CaseResult }[],
  data: { pairs: readonly ApplicabilityPair[]; actors: readonly ActorsCase[]; lists: readonly ListCase[] },
  opts: { seed: number; versaoDb: string; log: (m: string) => void },
): Promise<void> {
  const header = {
    comment:
      'Gravado por tools/ibs-cbs-oraculo/run.ts --record contra a Calculadora offline fixada. Não editar à mão: regravar.',
    calculadora: ledger.calculadora,
    seed: opts.seed,
  };
  const cases = recorded.map(({ case: c, result }) => ({
    id: c.id,
    date: c.date,
    op: c.op,
    engine: result.engine.ok ? flattenRoc(result.engine.value) : { error: result.engine.error.split(' ')[0] },
    // A resposta da Calculadora é a saída do motor com as divergências (`theirs`) aplicadas: gravar só a diferença
    // mantém a fixture pequena sem perder a informação.
    ...(result.oracle.ok ? {} : { oracleError: result.oracle.error }),
    divergences: result.divergences.map((d) => ({
      ...(d.diff ? d.diff : { outcome: d.outcome }),
      ledger: explain(ledger, c, d)?.id ?? null,
    })),
  }));
  const engineFile = path.join(root, 'packages/ibs-cbs/test/calcular/fixtures/oracle-cases.json');
  await writeFormatted(root, engineFile, { ...header, cases });
  const dataFile = path.join(root, 'packages/ibs-cbs-dados/test/fixtures/oracle-data.json');
  await writeFormatted(root, dataFile, { ...header, ...data });
  opts.log(
    `fixtures gravadas: ${path.relative(root, engineFile)} (${cases.length} casos), ${path.relative(root, dataFile)}`,
  );
}
