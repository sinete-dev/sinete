#!/usr/bin/env bun
/**
 * Confronta o `parseIe` do @sinete/validators com outra implementação sobre pares `UF<TAB>IE` lidos do stdin e imprime
 * só estatísticas agregadas por UF. Nunca imprime, grava ou devolve os valores: a lista costuma vir de base real.
 *
 * Uso:
 *   <fonte de pares UF\tIE> | bun tools/ie-crosscheck/crosscheck.ts [--reference caminho/modulo.ts]
 *
 * O módulo de referência exporta `validate(ie: string, uf: string): boolean`. Sem ele, só as estatísticas do sinete.
 * Linhas com UF desconhecida ou IE vazia são contadas à parte.
 */
import path from 'node:path';
import type { Uf } from '@sinete/core';
import { isUf } from '@sinete/core';
import { parseIe } from '@sinete/validators';

type Stats = {
  total: number;
  ok: number;
  isento: number;
  legacy: number;
  ref: number;
  agree: number;
  codes: Map<string, number>;
  onlySinete: number;
  onlyRef: number;
  onlySineteZeros: number;
};

const refIdx = process.argv.indexOf('--reference');
const refPath = refIdx > 0 ? process.argv[refIdx + 1] : undefined;
const ref = refPath
  ? ((await import(path.resolve(refPath))) as { validate: (ie: string, uf: string) => boolean })
  : undefined;

const byUf = new Map<string, Stats>();
let skipped = 0;
const text = await Bun.stdin.text();
for (const line of text.split('\n')) {
  if (!line.trim()) continue;
  const [ufRaw = '', ie = ''] = line.split('\t');
  const uf = ufRaw.trim().toUpperCase();
  if (!isUf(uf) || !ie.trim() || ie.trim().toUpperCase() === 'NULL') {
    skipped++;
    continue;
  }
  const s = byUf.get(uf) ?? {
    total: 0,
    ok: 0,
    isento: 0,
    legacy: 0,
    ref: 0,
    agree: 0,
    codes: new Map<string, number>(),
    onlySinete: 0,
    onlyRef: 0,
    onlySineteZeros: 0,
  };
  byUf.set(uf, s);
  s.total++;
  const r = parseIe(ie, uf as Uf);
  if (r.ok) {
    s.ok++;
    if (r.value.kind === 'isento') s.isento++;
    else if (r.value.legacy) s.legacy++;
  } else s.codes.set(r.error.code, (s.codes.get(r.error.code) ?? 0) + 1);
  if (ref) {
    const isento = r.ok && r.value.kind === 'isento';
    const refOk = ref.validate(ie, uf);
    if (refOk) s.ref++;
    // ISENTO não é número de inscrição: a comparação é só entre números.
    if (isento) s.agree++;
    else if (refOk === r.ok) s.agree++;
    else if (r.ok) {
      s.onlySinete++;
      // aceita só depois de ajustar zeros à esquerda (nota *2 do Anexo I)
      if (r.value.kind === 'numero' && r.value.value !== ie.replace(/[.\-/\s]/g, '').toUpperCase()) s.onlySineteZeros++;
    } else s.onlyRef++;
  }
}

const rows = [...byUf.entries()].sort(([a], [b]) => a.localeCompare(b));
const pct = (n: number, d: number): string => (d === 0 ? '-' : `${((100 * n) / d).toFixed(1)}%`);
console.log(
  `UF\ttotal\tsinete_ok\tisento\tlegado${ref ? '\tref_ok\tconcorda\tso_sinete(zeros)\tso_ref' : ''}\tfalhas_sinete`,
);
const sum = { total: 0, ok: 0, ref: 0, agree: 0 };
for (const [uf, s] of rows) {
  sum.total += s.total;
  sum.ok += s.ok;
  sum.ref += s.ref;
  sum.agree += s.agree;
  const codes = [...s.codes.entries()].map(([c, n]) => `${c}=${n}`).join(' ');
  console.log(
    [
      uf,
      s.total,
      `${s.ok} (${pct(s.ok, s.total)})`,
      s.isento,
      s.legacy,
      ...(ref
        ? [
            `${s.ref} (${pct(s.ref, s.total)})`,
            `${s.agree} (${pct(s.agree, s.total)})`,
            `${s.onlySinete} (${s.onlySineteZeros})`,
            s.onlyRef,
          ]
        : []),
      codes,
    ].join('\t'),
  );
}
console.log(
  `\ntotal ${sum.total}; sinete válidas ${pct(sum.ok, sum.total)}${ref ? `; referência válidas ${pct(sum.ref, sum.total)}; concordância ${pct(sum.agree, sum.total)}` : ''}; linhas ignoradas ${skipped}`,
);
