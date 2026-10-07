#!/usr/bin/env bun
/**
 * Empurra as tags de release do HEAD que o remoto ainda não tem (#65): as dos pacotes num push e a do guarda-chuva
 * `sinete@<versão>` sozinha, por último, para o GitHub criar o evento que dispara o job `release`. Pode ser relançado
 * depois de um push parcial: só empurra o que falta, e recusa tag do remoto com outro objeto.
 *
 * Uso: bun scripts/push-tags.ts [remoto]  (padrão: origin)
 */
import { $ } from 'bun';
import { lerLsRemote, planejarPush } from './lib/tags.ts';

const remoto = process.argv[2] ?? 'origin';
const nomes = (await $`git tag --points-at HEAD`.text()).split('\n').filter((t) => t !== '');
const locais = new Map<string, string>();
for (const tag of nomes) locais.set(tag, (await $`git rev-parse ${`refs/tags/${tag}`}`.text()).trim());
const remotas = lerLsRemote(await $`git ls-remote --tags ${remoto}`.text());
const plano = planejarPush(locais, remotas);

if (plano.sozinha === undefined) {
  console.log(`push-tags: nenhuma tag de release do HEAD falta em ${remoto}`);
  process.exit(0);
}
if (plano.juntas.length > 0) {
  console.log(`push-tags: ${plano.juntas.length} tag(s) num push: ${plano.juntas.join(' ')}`);
  await $`git push --no-follow-tags ${remoto} ${plano.juntas.map((t) => `refs/tags/${t}`)}`;
}
console.log(`push-tags: ${plano.sozinha} sozinha (dispara o job release)`);
await $`git push --no-follow-tags ${remoto} ${`refs/tags/${plano.sozinha}`}`;
