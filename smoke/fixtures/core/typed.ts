// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Authorized, Clock, SefazOutcome, Signer, Uf } from '@sinete/core';
import { authorized, fixedClock, SefazError, ufBySigla } from '@sinete/core';
import type { PreparedSignature, VerifyFailure, VerifyResult, XmlDocument, XmlElement } from '@sinete/core/xml';
import { parseXml, signXml, verifySignature } from '@sinete/core/xml';

const clock: Clock = fixedClock('2026-09-25T12:00:00Z');
const out: SefazOutcome<{ nProt: string }> = authorized({ cStat: '100', xMotivo: 'ok' }, { nProt: '1' });
if (out.status === 'authorized') {
  const a: Authorized<{ nProt: string }> = out;
  const nProt: string = a.value.nProt;
  void nProt;
}
const uf: Uf | undefined = ufBySigla('SP')?.sigla;
const e = new SefazError('sefaz_rejeitou', '539', 'Duplicidade');
const code: 'sefaz_rejeitou' | 'sefaz_denegou' | 'sefaz_pendente' = e.code;
// @ts-expect-error Uf é uma união fechada de siglas
const bad: Uf = 'EX';
void [clock, uf, code, bad];

// Subpath ./xml
declare const signer: Signer;
const doc: XmlDocument = parseXml('<a Id="x"><b/></a>');
const root: XmlElement = doc.root;
const pending: Promise<string> = signXml('<r><a Id="x"/></r>', { id: 'x' }, signer);
const result: Promise<VerifyResult> = verifySignature(doc, { id: 'x', element: 'a' });
async function reason(): Promise<VerifyFailure | 'ok'> {
  const r = await result;
  if (r.ok) {
    const el: XmlElement = r.element;
    void el;
    return 'ok';
  }
  return r.failure;
}
declare const p: PreparedSignature;
const bytes: Uint8Array = p.signedInfo;
// @ts-expect-error o verificador exige o Id esperado
void verifySignature(doc, {});
void [root, pending, reason, bytes];
