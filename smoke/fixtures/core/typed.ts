// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Autorizado, Relogio, ResultadoSefaz, Assinador, Uf } from '@sinete/core';
import { criarAutorizado, relogioFixo, ErroSefaz, ufPorSigla } from '@sinete/core';
import type { AssinaturaPreparada, MotivoFalhaConferencia, ResultadoConferencia, DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { lerXml, assinarXml, conferirAssinatura } from '@sinete/core/xml';

const clock: Relogio = relogioFixo('2026-09-25T12:00:00Z');
const out: ResultadoSefaz<{ nProt: string }> = criarAutorizado({ cStat: '100', xMotivo: 'ok' }, { nProt: '1' });
if (out.tipo === 'autorizado') {
  const a: Autorizado<{ nProt: string }> = out;
  const nProt: string = a.valor.nProt;
  void nProt;
}
const uf: Uf | undefined = ufPorSigla('SP')?.sigla;
const e = new ErroSefaz('sefaz_rejeitou', '539', 'Duplicidade');
const code: 'sefaz_rejeitou' | 'sefaz_denegou' | 'sefaz_pendente' = e.code;
// @ts-expect-error Uf é uma união fechada de siglas
const bad: Uf = 'EX';
void [clock, uf, code, bad];

// Subpath ./xml
declare const signer: Assinador;
const doc: DocumentoXml = lerXml('<a Id="x"><b/></a>');
const root: ElementoXml = doc.raiz;
const pending: Promise<string> = assinarXml('<r><a Id="x"/></r>', { id: 'x' }, signer);
const result: Promise<ResultadoConferencia> = conferirAssinatura(doc, { id: 'x', elemento: 'a' });
async function reason(): Promise<MotivoFalhaConferencia | 'ok'> {
  const r = await result;
  if (r.ok) {
    const el: ElementoXml = r.elemento;
    void el;
    return 'ok';
  }
  return r.motivo;
}
declare const p: AssinaturaPreparada;
const bytes: Uint8Array = p.signedInfo;
// @ts-expect-error o verificador exige o Id esperado
void conferirAssinatura(doc, {});
void [root, pending, reason, bytes];
