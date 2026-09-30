// Gera smoke/fixtures/da/dados.mjs: XML sintéticos e o sha256 esperado do PDF de cada um. A smoke confere que Node,
// Bun, Deno e Chromium geram os mesmos bytes; o teste smoke-dados.test.ts confere que o arquivo está em dia.
// Uso: bun packages/da/test/smoke-dados.ts
import path from 'node:path';
import { gerarPdf } from '../src/index.ts';
import { damdfe } from '../src/mdfe.ts';
import { danfe } from '../src/nfe.ts';
import { danfse } from '../src/nfse.ts';
import { mdfeXml, nfeXml } from './fixtures.ts';
import { NFSE_FIXTURES, nfseXml } from './fixtures-nfse.ts';

export const DADOS_PATH: string = path.join(import.meta.dir, '../../../smoke/fixtures/da/dados.mjs');

async function sha256(b: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', b as Uint8Array<ArrayBuffer>));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function dadosSmoke(): Promise<string> {
  const nfe = nfeXml({ name: 'smoke', items: 2, transp: true, dups: 2, fat: true, ibscbs: true });
  const nfce = nfeXml({ name: 'smoke-nfce', items: 1, mod: '65', destCpf: true });
  const mdfe = mdfeXml({ name: 'smoke-mdfe' });
  const fxNfse = NFSE_FIXTURES[0];
  if (!fxNfse) throw new Error('fixtures da NFS-e vazias');
  const nfse = nfseXml(fxNfse);
  const hashes = {
    danfe: await sha256(gerarPdf(danfe(nfe))),
    nfce: await sha256(gerarPdf(danfe(nfce))),
    damdfe: await sha256(gerarPdf(damdfe(mdfe))),
    danfse: await sha256(gerarPdf(danfse(nfse))),
  };
  return `// Gerado por packages/da/test/smoke-dados.ts: não edite à mão. Só dado sintético.
export const NFE = ${JSON.stringify(nfe)};
export const NFCE = ${JSON.stringify(nfce)};
export const MDFE = ${JSON.stringify(mdfe)};
export const NFSE = ${JSON.stringify(nfse)};
export const SHA256 = ${JSON.stringify(hashes, null, 2)};
`;
}

if (import.meta.main) await Bun.write(DADOS_PATH, await dadosSmoke());
