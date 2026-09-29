import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse, walk, nsUri, c14n, childEl, textOf, attr, type Element } from '../src/xml.ts';
import { verifySignatureElement, DSIG } from '../src/dsig.ts';
const C = process.env.HOME + '/.local/state/sinete/corpus/';
const lines = readFileSync('results/own-bun-fails.tsv', 'utf8').split('\n').filter(l => l.includes('digest-diverge'));
const sha = (s: string) => createHash('sha1').update(s, 'utf8').digest('base64');
for (const l of lines) {
  const f = l.split('\t')[0];
  const x = readFileSync(C + f, 'utf8');
  const d = parse(x);
  const sig = [...walk(d.root)].find(e => e.local === 'Signature' && nsUri(e, e.prefix) === DSIG)!;
  const si = childEl(sig, 'SignedInfo')!;
  const ref = childEl(si, 'Reference')!;
  const id = attr(ref, 'URI')!.slice(1);
  const dv = textOf(childEl(ref, 'DigestValue')!).trim();
  const t = d.ids.get(id)![0];
  const facts: Record<string, unknown> = {};
  facts.hasCR = x.includes('\r');
  facts.wsOnlyTextNodes = [...walk(t)].reduce((n, e) => n + e.children.filter(c => c.type === 'text' && /^\s+$/.test(c.value) && e.children.some(k => k.type === 'el')).length, 0);
  facts.ancestorsNs = (() => { const a: string[] = []; for (let e = t.parent; e; e = e.parent) for (const [p, u] of e.nsDecls) a.push(`${e.local}:${p || 'default'}`); return a; })();
  facts.targetNs = [...t.nsDecls.keys()];
  // Variante: elemento assinado isolado (sem herança de ancestrais além do default)
  const standalone = parse(x.slice(t.start, t.end));
  const v1 = c14n(standalone.root);
  facts.isoladoSemNs = sha(v1) === dv;
  // Variante: com xmlns nfe/mdfe explícito
  const own = nsUri(t, '');
  const v2 = c14n(parse(x.slice(t.start, t.end).replace(/^<(\w+)/, `<$1 xmlns="${own || 'http://www.portalfiscal.inf.br/nfe'}"`)).root);
  facts.isoladoComNsNfe = sha(v2) === dv;
  // Variante: remove text nodes só-whitespace entre elementos
  const strip = (s: string) => s.replace(/>\s+</g, '><');
  facts.semWsEntreTags = sha(strip(c14n(t))) === dv;
  // Variante: trim de todos os text nodes
  facts.trimTexto = sha(c14n(t).replace(/>([^<]*)</g, (_m, s) => '>' + s.trim() + '<')) === dv;
  // Variante: sem normalizar CR
  // assinatura sobre SignedInfo válida?
  const r = await verifySignatureElement({ ...d, ids: new Map([[id, [t]]]) }, sig);
  const siBytes = new TextEncoder().encode(c14n(si));
  const { X509Certificate, verify } = await import('node:crypto');
  const cert = new X509Certificate(Buffer.from(textOf([...walk(sig)].find(e => e.local === 'X509Certificate')!).replace(/\s+/g, ''), 'base64'));
  facts.signedInfoValido = verify('RSA-SHA1', siBytes, cert.publicKey, Buffer.from(textOf(childEl(sig, 'SignatureValue')!).replace(/\s+/g, ''), 'base64'));
  facts.targetLocal = t.local;
  console.log(f.split('/')[0], JSON.stringify(facts));
}
