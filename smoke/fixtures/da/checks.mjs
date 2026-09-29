// Verificações do @sinete/da compartilhadas por Node, Bun, Deno e Chromium: layout, PDF e HTML a partir de XML
// sintéticos, com o sha256 do PDF igual em todas as runtimes. Devolve a lista de falhas (vazia = ok).
import { isSineteError } from '@sinete/core';
import { code128C, DanfeError, qrMatrix, toHtml, toPdf, toSvg } from '@sinete/da';
import { dacce } from '@sinete/da/cce';
import { damdfe } from '@sinete/da/mdfe';
import { danfce, toPdf as toPdfNfce } from '@sinete/da/nfce';
import { danfe } from '@sinete/da/nfe';
import { danfse, toPdf as toPdfNfse } from '@sinete/da/nfse';
import { MDFE, NFCE, NFE, NFSE, SHA256 } from './dados.mjs';

async function sha256(b) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', b));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const doc = danfe(NFE);
  const pdf = toPdf(doc);
  expect('PDF começa com %PDF-1.4', String.fromCharCode(...pdf.subarray(0, 8)) === '%PDF-1.4');
  expect('sha256 do DANFE', (await sha256(pdf)) === SHA256.danfe);
  expect('sha256 do DANFE NFC-e', (await sha256(toPdf(danfe(NFCE)))) === SHA256.nfce);
  expect('danfce de /nfce igual ao danfe', (await sha256(toPdfNfce(danfce(NFCE)))) === SHA256.nfce);
  expect('renderizador reexportado é o mesmo', toPdfNfce === toPdf);
  expect('sha256 do DAMDFE', (await sha256(toPdf(damdfe(MDFE)))) === SHA256.damdfe);
  expect('sha256 do DANFSe', (await sha256(toPdfNfse(danfse(NFSE)))) === SHA256.danfse);
  expect('HTML', toHtml(doc).includes('<svg class="pg"'));
  expect('SVG', toSvg(doc.pages[0], doc).startsWith('<svg'));
  expect('QR', qrMatrix('sinete').length === 21);
  expect('CODE-128C', code128C('09758364').length === 43);
  let err;
  try {
    danfe(NFCE, { formato: 'retrato' });
  } catch (e) {
    err = e;
  }
  expect('DanfeError', err instanceof DanfeError && isSineteError(err, 'formato_incompativel'));
  let err2;
  try {
    dacce(NFE);
  } catch (e) {
    err2 = e;
  }
  expect('dacce recusa nfeProc', isSineteError(err2, 'documento_inesperado'));
  let err3;
  try {
    danfse(NFE);
  } catch (e) {
    err3 = e;
  }
  expect('danfse recusa nfeProc', isSineteError(err3, 'documento_inesperado'));
  return failures;
}
