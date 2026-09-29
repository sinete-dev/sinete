/**
 * Casos de borda do C14N (ADR 0003): os 12 XML sintéticos commitados em `fixtures/edge/` foram assinados por
 * `gerar.ts` e aceitos pelo xmlsec1. Aqui o verificador próprio precisa aceitar todos e recusar a versão adulterada.
 * Quando o xmlsec1 está instalado, ele confere os mesmos arquivos (diferencial contra o libxml2).
 */
import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $ } from 'bun';
import { base64Decode, parseXml, verifySignature } from '../../src/xml/index.ts';
import { EDGE_CASES } from './fixtures/edge/casos.ts';
import { toPem } from './helpers/test-keys.ts';

const dir = path.join(import.meta.dir, 'fixtures/edge');
const load = (name: string): Promise<string> => Bun.file(path.join(dir, `${name}.xml`)).text();

/** Grava em PEM o certificado público sintético que está no KeyInfo do arquivo. */
async function writeCertPem(xml: string, file: string): Promise<void> {
  const b64 = /<X509Certificate>([^<]+)</.exec(xml)?.[1];
  if (!b64) throw new Error('sem X509Certificate');
  await Bun.write(file, toPem('CERTIFICATE', base64Decode(b64)));
}

describe('casos de borda sintéticos', () => {
  test('são 12, como no spike S3', () => {
    expect(EDGE_CASES.length).toBe(12);
  });

  for (const c of EDGE_CASES) {
    test(`${c.name}: verifica e recusa adulteração`, async () => {
      const xml = await load(c.name);
      const r = await verifySignature(xml, { id: c.id, element: c.element });
      expect(r.ok).toBe(true);
      // Um elemento a mais logo depois da tag de abertura do elemento assinado.
      const doc = parseXml(xml);
      const target = doc.ids.get(c.id)?.[0];
      if (!target) throw new Error('alvo ausente');
      const tampered = `${xml.slice(0, target.openEnd)}<z/>${xml.slice(target.openEnd)}`;
      const t = await verifySignature(tampered, { id: c.id, element: c.element });
      expect(t).toMatchObject({ ok: false, failure: 'digest-diverge', signedInfoValid: true });
    });
  }
});

describe.skipIf(!Bun.which('xmlsec1'))('xmlsec1 como oráculo', () => {
  test('aceita os 12 arquivos commitados', async () => {
    const work = await mkdtemp(path.join(tmpdir(), 'sinete-xmlsec-'));
    try {
      for (const c of EDGE_CASES) {
        const pem = path.join(work, `${c.name}.pem`);
        await writeCertPem(await load(c.name), pem);
        const r =
          await $`xmlsec1 --verify --id-attr:Id ${c.element} --trusted-pem ${pem} ${path.join(dir, `${c.name}.xml`)}`
            .nothrow()
            .quiet();
        expect({ name: c.name, exit: r.exitCode }).toEqual({ name: c.name, exit: 0 });
      }
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });

  test('recusa um arquivo adulterado', async () => {
    const work = await mkdtemp(path.join(tmpdir(), 'sinete-xmlsec-'));
    try {
      const c = EDGE_CASES[0];
      if (!c) throw new Error('sem casos');
      const xml = (await load(c.name)).replace('linha1', 'linha9');
      const pem = path.join(work, 'c.pem');
      await writeCertPem(xml, pem);
      const file = path.join(work, 'x.xml');
      await Bun.write(file, xml);
      const r = await $`xmlsec1 --verify --id-attr:Id ${c.element} --trusted-pem ${pem} ${file}`.nothrow().quiet();
      expect(r.exitCode).not.toBe(0);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });
});
