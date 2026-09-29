// Verifica o corpus com xml-crypto e xmldsigjs. Imprime só agregados.
// Uso: <runtime> bench/libs.ts xml-crypto|xmldsigjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DOMParser, XMLSerializer, DOMImplementation } from '@xmldom/xmldom';

const which = process.argv[2];
const CORPUS = join(process.env.HOME ?? '', '.local/state/sinete/corpus');
const DSIG = 'http://www.w3.org/2000/09/xmldsig#';
const runtime = 'Deno' in globalThis ? 'deno' : 'Bun' in globalThis ? 'bun' : 'node';

type Verify = (xml: string) => Promise<(boolean | string)[]>;
let verify: Verify;

if (which === 'xml-crypto') {
  const { SignedXml } = await import('xml-crypto');
  verify = async (xml) => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const sigs = Array.from(doc.getElementsByTagNameNS(DSIG, 'Signature'));
    if (!sigs.length) return ['sem-assinatura'];
    return sigs.map((node) => {
      try {
        const sig = new SignedXml({ getCertFromKeyInfo: SignedXml.getCertFromKeyInfo});
        sig.loadSignature(node as any);
        return sig.checkSignature(xml);
      } catch (e) {
        return 'erro:' + String((e as Error).message).slice(0, 60);
      }
    });
  };
} else if (which === 'xmldsigjs') {
  const xmldsig = await import('xmldsigjs');
  const core = await import('xml-core');
  core.setNodeDependencies({ DOMParser, XMLSerializer, DOMImplementation } as any);
  xmldsig.Application.setEngine(runtime, globalThis.crypto as any);
  verify = async (xml) => {
    let doc: Document;
    try { doc = xmldsig.Parse(xml); } catch (e) { return ['erro:parse']; }
    const sigs = Array.from(doc.getElementsByTagNameNS(DSIG, 'Signature'));
    if (!sigs.length) return ['sem-assinatura'];
    const out: (boolean | string)[] = [];
    for (const node of sigs) {
      try {
        const sx = new xmldsig.SignedXml(doc);
        sx.LoadXml(node as any);
        out.push(await sx.Verify());
      } catch (e) {
        out.push('erro:' + String((e as Error).message).slice(0, 60));
      }
    }
    return out;
  };
} else throw new Error('uso: libs.ts xml-crypto|xmldsigjs');

const summary: Record<string, Record<string, number>> = {};
const fails: string[] = [];
let ms = 0, docs = 0;
for (const dir of readdirSync(CORPUS).sort()) {
  const s: Record<string, number> = { docs: 0, assinaturas: 0, ok: 0 };
  summary[dir] = s;
  for (const f of readdirSync(join(CORPUS, dir)).sort()) {
    const xml = readFileSync(join(CORPUS, dir, f), 'utf8');
    s.docs++; docs++;
    const t0 = performance.now();
    const res = await verify(xml);
    ms += performance.now() - t0;
    for (const r of res) {
      if (r === 'sem-assinatura') { s[r] = (s[r] ?? 0) + 1; continue; }
      s.assinaturas++;
      if (r === true) s.ok++;
      else { const k = r === false ? 'falso' : r; s[k] = (s[k] ?? 0) + 1; fails.push(`${dir}/${f}\t${k}`); }
    }
  }
}
console.log(JSON.stringify({ lib: which, runtime, summary, docs, totalMs: Math.round(ms), msPorDoc: +(ms / docs).toFixed(3) }, null, 1));
mkdirSync('results', { recursive: true });
writeFileSync(`results/${which}-${runtime}-fails.tsv`, fails.join('\n'));
