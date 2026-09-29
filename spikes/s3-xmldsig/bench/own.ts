// Roda o verificador próprio sobre o corpus. Imprime só agregados.
// Uso: node|bun|deno run -A bench/own.ts [--details]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { verifyDocument } from '../src/dsig.ts';

const CORPUS = join(process.env.HOME ?? '', '.local/state/sinete/corpus');
const runtime = 'Deno' in globalThis ? 'deno' : 'Bun' in globalThis ? 'bun' : `node`;
const fails: string[] = [];
let totalMs = 0;
const summary: Record<string, Record<string, number>> = {};
for (const dir of readdirSync(CORPUS).sort()) {
  const s: Record<string, number> = { docs: 0, assinaturas: 0, ok: 0 };
  summary[dir] = s;
  for (const f of readdirSync(join(CORPUS, dir)).sort()) {
    const xml = readFileSync(join(CORPUS, dir, f), 'utf8');
    s.docs++;
    const t0 = performance.now();
    const res = await verifyDocument(xml);
    totalMs += performance.now() - t0;
    for (const r of res) {
      if (r.failure === 'sem-assinatura') { s['sem-assinatura'] = (s['sem-assinatura'] ?? 0) + 1; continue; }
      s.assinaturas++;
      if (r.ok) { s.ok++; s[`ok:${r.refLocal}`] = (s[`ok:${r.refLocal}`] ?? 0) + 1; }
      else {
        const k = `falha:${r.failure}:${r.refLocal ?? ''}`;
        s[k] = (s[k] ?? 0) + 1;
        fails.push(`${dir}/${f}\t${r.failure}\t${r.refLocal ?? ''}\t${r.detail ?? ''}`);
      }
    }
  }
}
const docs = Object.values(summary).reduce((a, s) => a + s.docs, 0);
console.log(JSON.stringify({ runtime, summary, docs, totalMs: Math.round(totalMs), msPorDoc: +(totalMs / docs).toFixed(3) }, null, 1));
mkdirSync('results', { recursive: true });
writeFileSync(`results/own-${runtime}-fails.tsv`, fails.join('\n'));
