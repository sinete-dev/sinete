#!/usr/bin/env bun
/**
 * Regenera os 12 casos de borda sintéticos do C14N (portados do spike S3) e confere cada um com o xmlsec1, oráculo
 * independente (libxml2). Uso local: `bun packages/core/test/xml/fixtures/edge/gerar.ts`.
 *
 * A chave é gerada na hora e descartada; só o XML assinado (com o certificado público sintético no KeyInfo) é
 * gravado. Se o xmlsec1 aceita, o nosso C14N produziu os mesmos bytes que o libxml2 para o elemento referenciado e
 * para o SignedInfo. O teste `edge.test.ts` verifica os arquivos commitados com o verificador próprio.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $ } from 'bun';
import { assinarXml, conferirAssinatura } from '../../../../src/xml/index.ts';
import { generateTestKeys, toPem } from '../../helpers/test-keys.ts';
import { EDGE_CASES } from './casos.ts';

const here = import.meta.dir;
const keys = await generateTestKeys();
const work = await mkdtemp(path.join(tmpdir(), 'sinete-edge-'));
let failed = 0;
try {
  const pem = path.join(work, 'cert.pem');
  await Bun.write(pem, toPem('CERTIFICATE', keys.certificateDer));
  for (const c of EDGE_CASES) {
    const signed = await assinarXml(`<?xml version="1.0" encoding="UTF-8"?>${c.xml}`, { id: c.id }, keys.dataSigner);
    const file = path.join(here, `${c.name}.xml`);
    await Bun.write(file, signed);
    const own = await conferirAssinatura(signed, { id: c.id, elemento: c.element });
    const x = await $`xmlsec1 --verify --id-attr:Id ${c.element} --trusted-pem ${pem} ${file}`.nothrow().quiet();
    const ok = own.ok && x.exitCode === 0;
    if (!ok) failed++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${c.name}: proprio=${own.ok} xmlsec1=${x.exitCode === 0 ? 'OK' : x.stderr.toString().trim()}`,
    );
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
