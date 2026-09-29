#!/usr/bin/env bun
/**
 * Gera `packages/cert/src/data/icp-brasil.json`, o bundle ICP-Brasil do @sinete/cert (ADR 0004, decisão 2).
 *
 * Fonte única: o `ACcompactado.zip` publicado pelo ITI, cujo SHA-512 tem de conferir com o `hashsha512.txt` do mesmo
 * site (o build recusa o zip se não conferir). O que entra está em `selecao.json`: as raízes v5, v10, v11 e v12 e as
 * intermediárias SSL vistas nos servidores DF-e, cada uma conferida pelo SHA-256. A saída é determinística para o
 * mesmo zip e a mesma data de coleta, então `--check` serve de trava no CI (o dado versionado bate com a fonte).
 *
 * Uso:
 *   bun tools/icp-bundle/build-bundle.ts --retrieved-at 2026-09-25            # baixa zip e hash do ITI
 *   bun tools/icp-bundle/build-bundle.ts --zip ACcompactado.zip --hash hashsha512.txt --retrieved-at 2026-09-25
 *   bun tools/icp-bundle/build-bundle.ts ... --check                          # só compara com o arquivo versionado
 */
import { createHash, X509Certificate } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { $ } from 'bun';

const ZIP_URL = 'http://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/ACcompactado.zip';
const HASH_URL = 'http://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/hashsha512.txt';
const root = path.resolve(import.meta.dir, '../..');
const OUT = path.join(root, 'packages/cert/src/data/icp-brasil.json');

const { values: args } = parseArgs({
  options: {
    zip: { type: 'string' },
    hash: { type: 'string' },
    'retrieved-at': { type: 'string' },
    out: { type: 'string', default: OUT },
    check: { type: 'boolean', default: false },
  },
});
const retrievedAt = args['retrieved-at'];
if (!retrievedAt || !/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt)) {
  console.error('informe --retrieved-at AAAA-MM-DD (data em que o zip foi baixado do ITI)');
  process.exit(2);
}

interface Selection {
  roots: { file: string; sha256: string }[];
  intermediates: { file: string; sha256: string; seenOn: number; source: string }[];
  excluded: { file: string; reason: string }[];
}
const selection = (await Bun.file(path.join(import.meta.dir, 'selecao.json')).json()) as Selection;

const work = await mkdtemp(path.join(tmpdir(), 'sinete-icp-'));
try {
  async function obtain(local: string | undefined, url: string, name: string): Promise<string> {
    if (local) return path.resolve(local);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const file = path.join(work, name);
    await Bun.write(file, await res.arrayBuffer());
    return file;
  }
  const zipPath = await obtain(args.zip, ZIP_URL, 'ACcompactado.zip');
  const hashPath = await obtain(args.hash, HASH_URL, 'hashsha512.txt');
  const zip = new Uint8Array(await Bun.file(zipPath).arrayBuffer());
  const sha512 = createHash('sha512').update(zip).digest('hex');
  const official = (await Bun.file(hashPath).text()).trim().split(/\s+/)[0]?.toLowerCase();
  if (sha512 !== official) throw new Error(`SHA-512 do zip (${sha512}) não confere com o do ITI (${official})`);

  const entries = (await $`unzip -Z1 ${zipPath}`.text()).split('\n').filter((l) => l.endsWith('.crt'));
  const read = async (file: string): Promise<X509Certificate> => {
    if (!entries.includes(file)) throw new Error(`${file} não está no zip`);
    return new X509Certificate(await $`unzip -p ${zipPath} ${file}`.arrayBuffer().then((b) => Buffer.from(b)));
  };
  const cn = (dn: string): string => /CN=([^\n]+)/.exec(dn)?.[1] ?? dn;
  const describe = (c: X509Certificate, file: string, kind: 'root' | 'intermediate', source: string) => {
    const k = c.publicKey.asymmetricKeyDetails;
    return {
      id: kind === 'root' ? `icp-brasil-${file.replace(/^ICP-Brasil|\.crt$/g, '')}` : file.replace(/\.crt$/, ''),
      kind,
      tls: true,
      file,
      subject: c.subject.replace(/\n/g, ', '),
      subjectCN: cn(c.subject),
      issuerCN: cn(c.issuer),
      sha256: c.fingerprint256,
      notBefore: new Date(c.validFrom).toISOString().replace('.000', ''),
      notAfter: new Date(c.validTo).toISOString().replace('.000', ''),
      keyType: `${c.publicKey.asymmetricKeyType}-${k?.modulusLength ?? '?'}`,
      source,
      der: c.raw.toString('base64'),
    };
  };
  const certificates = [];
  for (const { file, sha256 } of selection.roots) {
    const c = await read(file);
    if (c.subject !== c.issuer) throw new Error(`${file} não é autoassinado`);
    // Fixado fora do zip: zip e hash chegam por HTTP, e uma raiz trocada no caminho viraria âncora de confiança.
    if (c.fingerprint256 !== sha256)
      throw new Error(`${file}: SHA-256 ${c.fingerprint256} diverge do fixado ${sha256}`);
    certificates.push(describe(c, file, 'root', `${ZIP_URL}#${file}`));
  }
  for (const i of selection.intermediates) {
    const c = await read(i.file);
    if (c.fingerprint256 !== i.sha256) throw new Error(`${i.file}: SHA-256 ${c.fingerprint256} diverge de ${i.sha256}`);
    certificates.push({
      ...describe(c, i.file, 'intermediate', `${ZIP_URL}#${i.file}`),
      seenOn: i.seenOn,
      why: i.source,
    });
  }
  const doc = {
    $comment:
      'Gerado por tools/icp-bundle/build-bundle.ts; não edite à mão. Atualizar o bundle é release minor do @sinete/cert.',
    schemaVersion: 1,
    version: retrievedAt.replace(/-/g, '.'),
    source: { url: ZIP_URL, sha512, hashUrl: HASH_URL, retrievedAt, zipCertificates: entries.length },
    excluded: selection.excluded,
    certificates,
  };
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  if (args.check) {
    const current = await Bun.file(args.out).text();
    if (current !== text) {
      console.error(`${path.relative(root, args.out)} diverge do que o zip gera; rode sem --check e revise o diff`);
      process.exit(1);
    }
    console.log(`${path.relative(root, args.out)} confere com o zip (${certificates.length} certificados)`);
  } else {
    await Bun.write(args.out, text);
    console.log(`escrito ${path.relative(root, args.out)}: ${certificates.length} certificados de ${entries.length}`);
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
