/**
 * Corpo do `aliquota.ts`, carregado depois da compilação dos pacotes (imports de `@sinete/*` pelo `dist`).
 *
 * 1. Aplica a alíquota publicada na tabela curada (`tools/ibs-cbs-dados/rates.json`) e na gerada do pacote, em memória,
 *    e imprime o diff da curada.
 * 2. Monta os casos dentro da vigência: perfis fixos (os códigos de produtor rural que o gerador já pesa mais) e, com o
 *    oráculo, uma amostra do gerador com a semente.
 * 3. Para cada caso, compara o motor com a tabela nova ao motor com a tabela de hoje e a mesma alíquota informada no
 *    item: precisam dar o mesmo grupo (só o indicador `simulado` muda). E conta o que antes recusava e agora calcula.
 * 4. Com o oráculo, compara o motor com a tabela nova à Calculadora offline, informando a ela a alíquota (a V0059 não
 *    conhece 2027) salvo `--calculadora-com-aliquota`; divergência fora do ledger falha.
 * 5. Com `--gravar` e tudo conferido, grava a tabela curada. A gerada sai do `tools/ibs-cbs-dados/extract.ts`.
 */
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { TabelaDeAliquotas } from '@sinete/ibs-cbs/aliquotas';
import { aliquotasOficiais } from '@sinete/ibs-cbs/aliquotas';
import type { ItemClassificado, Roc } from '@sinete/ibs-cbs/calcular';
import { carregarDataset } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO } from '@sinete/ibs-cbs-dados/embarcado';
import { $ } from 'bun';
import { unpackCalculadora } from '../../ibs-cbs-dados/src/artifact.ts';
import { defaultCacheDir, ensureFile } from '../../ibs-cbs-dados/src/fetch.ts';
import type { LinhaDeReferencia } from './aliquota.ts';
import { aplicarAliquota, cbsNominalDe2027e2028, percentualDaTabela } from './aliquota.ts';
import type { Side } from './check.ts';
import { compareCase, runEngine, runOracle } from './check.ts';
import { diff, flattenRoc } from './compare.ts';
import { ensureImage, loadPin, startOracle } from './container.ts';
import type { OracleCase } from './generate.ts';
import { generator, loadNomenclatures } from './generate.ts';
import type { Ledger } from './ledger.ts';
import { explain } from './ledger.ts';

const here = path.resolve(import.meta.dir, '..');
const root = path.resolve(here, '../..');
const CURADA = path.join(root, 'tools/ibs-cbs-dados/rates.json');
const GERADA = path.join(root, 'packages/ibs-cbs/src/aliquotas/data/rates.json');

const { values: args } = parseArgs({
  options: {
    referencia: { type: 'string' },
    cbs: { type: 'string' },
    inicio: { type: 'string' },
    fim: { type: 'string' },
    ato: { type: 'string' },
    url: { type: 'string' },
    data: { type: 'string' },
    gravar: { type: 'boolean', default: false },
    'sem-oraculo': { type: 'boolean', default: false },
    'calculadora-com-aliquota': { type: 'boolean', default: false },
    n: { type: 'string', default: '300' },
    seed: { type: 'string', default: '2027' },
    api: { type: 'string' },
    out: { type: 'string' },
    cache: { type: 'string' },
    'no-build': { type: 'boolean', default: false },
  },
});
const log = (m: string): void => console.error(`aliquota: ${m}`);
function falhar(m: string): never {
  log(m);
  process.exit(2);
}

const { inicio, fim } = args;
if (!inicio || !fim) falhar('informe --inicio e --fim (AAAA-MM-DD) da vigência publicada');
if ((args.referencia === undefined) === (args.cbs === undefined)) {
  falhar('informe --referencia (a alíquota de referência do Senado) ou --cbs (a CBS nominal), uma das duas');
}
if (args.gravar && (!args.ato || !args.url || !args.data)) falhar('--gravar pede --ato, --url e --data do ato oficial');

const cbs =
  args.referencia !== undefined
    ? cbsNominalDe2027e2028(args.referencia, inicio, fim)
    : percentualDaTabela(args.cbs as string);
const ato = args.ato ?? '(ato a informar)';
const fonteId = `resolucao-senado-${args.data ?? 'a-informar'}`;
const fonte = {
  id: fonteId,
  titulo: ato,
  url: args.url ?? 'https://legis.senado.leg.br/',
  ...(args.data ? { data: args.data } : {}),
};
const legal =
  args.referencia !== undefined
    ? `LC 214/2025, art. 347: alíquota de referência de ${percentualDaTabela(args.referencia).replace('.', ',')}% fixada pela ${ato}, reduzida em 0,1 ponto percentual`
    : `${ato}: CBS de ${cbs.replace('.', ',')}%`;
const nova = { tributo: 'CBS' as const, inicio, fim, aliquota: cbs, legal, fontes: [fonteId, 'lc214-2025'] };
log(
  `CBS ${cbs}% de ${inicio} a ${fim}${args.referencia !== undefined ? ` (referência ${args.referencia}% menos 0,1 ponto)` : ''}`,
);

// 1. As duas tabelas, em memória.
interface Curada {
  readonly fontesLegais: readonly { readonly id: string }[];
  readonly referencia: readonly LinhaDeReferencia[];
}
const curada = (await Bun.file(CURADA).json()) as Curada;
const curadaNova = {
  ...curada,
  fontesLegais: curada.fontesLegais.some((f) => f.id === fonteId)
    ? curada.fontesLegais
    : [...curada.fontesLegais, fonte],
  referencia: aplicarAliquota(curada.referencia, nova),
};
const gerada = (await Bun.file(GERADA).json()) as TabelaDeAliquotas;
const geradaNova = {
  ...gerada,
  fontes: gerada.fontes.some((f) => f.id === fonteId) ? gerada.fontes : [...gerada.fontes, fonte],
  referencia: aplicarAliquota(gerada.referencia as readonly LinhaDeReferencia[], nova),
} as TabelaDeAliquotas;
const antes = aliquotasOficiais(gerada);
const depois = aliquotasOficiais(geradaNova);

const outDir =
  args.out ?? path.join(os.homedir(), '.local/state/sinete/ibs-cbs-oraculo', `aliquota-${inicio}-${fim}-cbs${cbs}`);
await mkdir(outDir, { recursive: true });
const biome = path.join(root, 'node_modules/.bin/biome');
const formatado = async (body: unknown): Promise<string> =>
  await $`${biome} format --stdin-file-path=${CURADA} < ${new Response(`${JSON.stringify(body, null, 2)}\n`)}`
    .cwd(root)
    .quiet()
    .text();
const textoNovo = await formatado(curadaNova);
const arquivoNovo = path.join(outDir, 'rates.json');
await Bun.write(arquivoNovo, textoNovo);
const d = await $`git diff --no-index --no-color ${CURADA} ${arquivoNovo}`.cwd(root).nothrow().quiet().text();
console.log(`## Diff de tools/ibs-cbs-dados/rates.json\n\n\`\`\`diff\n${d.trim()}\n\`\`\`\n`);

// 2. Casos dentro da vigência.
const dataset = carregarDataset(DATASET_EMBARCADO);
const PERFIS: readonly [string, string, string][] = [
  ['000', '000001', '10059010'],
  ['200', '200036', '10059010'],
  ['200', '200038', '31021010'],
  ['200', '200014', '07020000'],
  ['515', '515001', '31021010'],
  ['410', '410014', '10059010'],
  ['410', '410999', '10059010'],
];
const BASES = ['1000.00', '960.00', '96.00', '26730.00', '0.05', '12345.65'];
const LOCAIS = [
  { uf: 'DF', cMun: '5300108' },
  { uf: 'SP', cMun: '3550308' },
];
const casos: OracleCase[] = [];
for (const date of [...new Set([inicio, fim])])
  for (const local of LOCAIS)
    for (const [cst, cClassTrib, ncm] of PERFIS)
      for (const base of BASES) {
        casos.push({
          id: `perfil-${date}-${local.uf}-${cClassTrib}-${base}`,
          date,
          op: { modelo: 55, local, itens: [{ n: 1, cst, cClassTrib, base }] },
          meta: [{ n: 1, ncm }],
        });
      }
const fixos = casos.length;

const comOraculo = !args['sem-oraculo'];
const ledger = (await Bun.file(path.join(here, 'ledger.json')).json()) as Ledger;
let pin: Awaited<ReturnType<typeof loadPin>> | undefined;
if (comOraculo) {
  pin = await loadPin();
  if (ledger.calculadora.zipSha256 !== pin.zipSha256) falhar('ledger.json é de outra Calculadora: revise o ledger');
  const cacheDir = args.cache ?? defaultCacheDir();
  const zip = await ensureFile({ url: pin.url, sha256: pin.zipSha256, name: 'calculadora.zip', cacheDir, log });
  const { db } = await unpackCalculadora(zip, pin, cacheDir);
  const gen = generator(dataset, loadNomenclatures(db), Number(args.seed));
  const quer = Number(args.n);
  // A alíquota sorteada pelo gerador sai: quem responde agora é a tabela.
  const semInformada = ({ aliquotasInformadas: _a, ...it }: ItemClassificado): ItemClassificado => it;
  for (let tentativas = 0; casos.length - fixos < quer && tentativas < quer * 200; tentativas++) {
    const c = gen.next();
    if (!c || c.date < inicio || c.date > fim) continue;
    casos.push({ ...c, op: { ...c.op, itens: c.op.itens.map(semInformada) } });
  }
  log(`${fixos} casos de perfil e ${casos.length - fixos} do gerador (semente ${args.seed}) dentro da vigência`);
}

// 3 e 4. Comparações.
const recusaPorAliquota = (s: Side<Roc>): boolean => !s.ok && s.error.includes('ibscbs_aliquota_desconhecida');
/** O caso com a mesma alíquota informada nos itens que a tiraram da tabela (os de alíquota fixa do dataset, não). */
function comInformada(c: OracleCase, r: Side<Roc>): OracleCase {
  if (!r.ok) return c;
  const daTabela = new Set(
    r.value.itens
      .filter((i) => i.aliquotas.some((a) => a.origem === 'provedor-nominal' || a.origem === 'provedor-referencia'))
      .map((i) => i.nItem),
  );
  const nominais = depois.nominal(c.date, c.op.local);
  return {
    ...c,
    op: {
      ...c.op,
      itens: c.op.itens.map((it) =>
        daTabela.has(it.n)
          ? {
              ...it,
              aliquotasInformadas: {
                CBS: nominais.CBS.valor ?? '',
                IBSUF: nominais.IBSUF.valor ?? '',
                IBSMun: nominais.IBSMun.valor ?? '',
                motivo: 'mesma alíquota da tabela, informada',
              },
            }
          : it,
      ),
    },
  };
}
const semSimulado = (r: Roc) =>
  Object.fromEntries(Object.entries(flattenRoc(r)).filter(([k]) => !k.endsWith('.simulated')));

const tally = {
  casos: casos.length,
  antesRecusavaPorAliquota: 0,
  agoraCalcula: 0,
  agoraRecusa: 0,
  tabelaIgualInformada: 0,
  tabelaDiferenteDaInformada: 0,
  oraculo: { iguais: 0, recusadosPelosDois: 0, explicadas: 0, semExplicacao: 0 },
};
const diferencasDoMotor: unknown[] = [];
const semExplicacao: unknown[] = [];
const amostra: string[] = [];
let stop = async (): Promise<void> => {};
let api = args.api;
if (comOraculo && !api && pin) {
  const oracle = await startOracle(pin, await ensureImage(pin, { cacheDir: args.cache ?? defaultCacheDir(), log }), {
    log,
  });
  api = oracle.api;
  stop = oracle.stop;
}
try {
  for (const c of casos) {
    const novo = runEngine(c, dataset, depois);
    const velho = runEngine(c, dataset, antes);
    if (recusaPorAliquota(velho)) tally.antesRecusavaPorAliquota++;
    if (novo.ok) tally.agoraCalcula++;
    else tally.agoraRecusa++;
    const inf = comInformada(c, novo);
    const informado = runEngine(inf, dataset, antes);
    if (novo.ok && informado.ok) {
      const dd = diff(semSimulado(novo.value), semSimulado(informado.value));
      if (dd.length === 0) tally.tabelaIgualInformada++;
      else {
        tally.tabelaDiferenteDaInformada++;
        diferencasDoMotor.push({ caso: c.id, diferencas: dd.slice(0, 10) });
      }
    } else if (novo.ok !== informado.ok) {
      tally.tabelaDiferenteDaInformada++;
      diferencasDoMotor.push({
        caso: c.id,
        tabela: novo.ok ? 'calcula' : novo.error,
        informada: informado.ok ? 'calcula' : informado.error,
      });
    }
    if (c.id.startsWith(`perfil-${inicio}-DF-`) && c.op.itens[0]?.base === '1000.00') {
      const g = novo.ok ? novo.value.itens[0]?.IBSCBS.gIBSCBS : undefined;
      const red = g?.gCBS.gRed?.pAliqEfet;
      amostra.push(
        `| ${c.op.itens[0]?.cClassTrib} | ${velho.ok ? 'calcula' : 'recusa'} | ${novo.ok ? (g ? `${g.gCBS.pCBS}${red ? ` (efetiva ${red})` : ''}` : 'sem gIBSCBS') : `recusa: ${novo.error.slice(0, 60)}`} | ${g?.gCBS.vCBS ?? ''} | ${g?.vIBS ?? ''} |`,
      );
    }
    if (!api) continue;
    const paraCalculadora = args['calculadora-com-aliquota'] ? c : inf;
    const r = compareCase(novo, await runOracle(api, paraCalculadora));
    // Informada à Calculadora, a alíquota marca o cálculo dela como simulado; o motor, pela tabela, não.
    const divergencias = args['calculadora-com-aliquota']
      ? r.divergences
      : r.divergences.filter((x) => !x.diff?.path.endsWith('.simulated'));
    if (!r.engine.ok && !r.oracle.ok && divergencias.length === 0) tally.oraculo.recusadosPelosDois++;
    else if (divergencias.length === 0) tally.oraculo.iguais++;
    else {
      const sem = divergencias.filter((x) => explain(ledger, paraCalculadora, x) === undefined);
      if (sem.length === 0) tally.oraculo.explicadas++;
      else {
        tally.oraculo.semExplicacao++;
        semExplicacao.push({ caso: paraCalculadora, divergencias: sem });
      }
    }
  }
} finally {
  await stop();
}

console.log(`## CBS de ${cbs}% de ${inicio} a ${fim}\n`);
console.log('Perfis em DF, base 1.000,00, na data de início:\n');
console.log('| cClassTrib | tabela de hoje | pCBS com a tabela nova | vCBS | vIBS |\n|---|---|---|---|---|');
console.log(`${amostra.join('\n')}\n`);
console.log(`- casos: ${tally.casos} (${fixos} de perfil${comOraculo ? `, ${tally.casos - fixos} do gerador` : ''})`);
console.log(`- recusados hoje por alíquota desconhecida: ${tally.antesRecusavaPorAliquota}`);
console.log(`- com a tabela nova: ${tally.agoraCalcula} calculam, ${tally.agoraRecusa} recusam (outros motivos)`);
console.log(
  `- tabela nova x mesma alíquota informada: ${tally.tabelaIgualInformada} iguais, ${tally.tabelaDiferenteDaInformada} diferentes`,
);
if (api) {
  const o = tally.oraculo;
  console.log(
    `- Calculadora ${pin?.versao.versaoDb}${args['calculadora-com-aliquota'] ? ' (sem informar a alíquota)' : ' (com a alíquota informada)'}: ${o.iguais} iguais, ${o.recusadosPelosDois} recusados pelos dois, ${o.explicadas} com divergência no ledger, ${o.semExplicacao} sem explicação`,
  );
} else console.log('- Calculadora: não rodou (--sem-oraculo)');

const relatorio = path.join(outDir, 'report.json');
await Bun.write(
  relatorio,
  `${JSON.stringify({ cbs, inicio, fim, ato, tally, diferencasDoMotor: diferencasDoMotor.slice(0, 50), semExplicacao: semExplicacao.slice(0, 50) }, null, 2)}\n`,
);
log(`relatório em ${relatorio}; tabela curada proposta em ${arquivoNovo}`);

const falhou = tally.tabelaDiferenteDaInformada > 0 || tally.oraculo.semExplicacao > 0;
if (falhou) {
  log('FALHOU: a tabela nova não reproduz a alíquota informada, ou a Calculadora diverge fora do ledger');
  process.exit(1);
}
if (args.gravar) {
  await Bun.write(CURADA, textoNovo);
  log(`gravado ${path.relative(root, CURADA)}; agora rode bun tools/ibs-cbs-dados/extract.ts`);
}
