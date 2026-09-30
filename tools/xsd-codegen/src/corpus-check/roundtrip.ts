#!/usr/bin/env bun
import type { ElementoXml } from '../../../../packages/core/src/xml/index.ts';
import {
  atributoDe,
  c14n,
  codificarBase64,
  conferirAssinatura,
  descendentes,
  ErroXml,
  encontrarAssinaturas,
  lerXml,
  textoDe,
} from '../../../../packages/core/src/xml/index.ts';
/**
 * Round-trip no corpus local: parse, decode tolerante, serialize canônico do elemento assinado e comparação com o
 * original (bytes, C14N e SHA-1 contra o DigestValue). Também roda o validador. Só agregados na saída.
 *
 * Uso: bun src/corpus-check/roundtrip.ts   (resultado também em ~/.local/state/sinete/results/roundtrip.json)
 */
import type { ComplexType, RootElement } from '../../../../packages/schemas/src/index.ts';
import { decodeRoot, serialize, validate } from '../../../../packages/schemas/src/index.ts';
import * as mdfe300b from '../../../../packages/schemas/src/mdfe/3.00b.ts';
import * as cancelamento from '../../../../packages/schemas/src/nfe/evento-cancelamento/PL_010d.ts';
import * as cce from '../../../../packages/schemas/src/nfe/evento-cce/PL_010d.ts';
import * as nfe010e from '../../../../packages/schemas/src/nfe/PL_010e.ts';
import * as nfe010f from '../../../../packages/schemas/src/nfe/PL_010f.ts';
import { corpusDocs, inc, runtimeName, schemaPath, writeResult } from './common.ts';

interface Target {
  readonly label: string;
  readonly root: RootElement<unknown>;
  /** Tipo e nome do elemento assinado. */
  readonly signedType: ComplexType;
  readonly signedName: string;
  /** Caminho no objeto decodificado até o elemento assinado. */
  readonly pick: (v: Record<string, unknown>) => unknown;
}

const nfeTarget = (label: string, m: typeof nfe010f | typeof nfe010e): Target => ({
  label,
  root: m.nfeProcElement as RootElement<unknown>,
  signedType: m.TNFe_infNFe as ComplexType,
  signedName: 'infNFe',
  pick: (v) => (v.NFe as Record<string, unknown> | undefined)?.infNFe,
});
const eventoTarget = (label: string, m: typeof cancelamento | typeof cce): Target => ({
  label,
  root: m.procEventoNFeElement as RootElement<unknown>,
  signedType: m.TEvento_infEvento as ComplexType,
  signedName: 'infEvento',
  pick: (v) => (v.evento as Record<string, unknown> | undefined)?.infEvento,
});
const mdfeTarget: Target = {
  label: 'mdfe/3.00b',
  root: mdfe300b.mdfeProcElement as RootElement<unknown>,
  signedType: mdfe300b.TMDFe_infMDFe as ComplexType,
  signedName: 'infMDFe',
  pick: (v) => (v.MDFe as Record<string, unknown> | undefined)?.infMDFe,
};

async function sha1(s: string): Promise<string> {
  return codificarBase64(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))));
}

function newStats(): Record<string, unknown> {
  return {
    docs: 0,
    parseErrors: 0,
    semAssinatura: 0,
    assinaturaOriginalConfere: 0,
    digestNossoConfere: 0,
    digestNossoConfereQuandoOriginalConfere: 0,
    igualC14nOriginal: 0,
    igualBytesOriginal: 0,
    validos: 0,
    ocorrenciasDecode: {} as Record<string, number>,
    ocorrenciasValidacao: {} as Record<string, number>,
    falhasAssinatura: {} as Record<string, number>,
  };
}

async function processDoc(src: string, t: Target, s: Record<string, unknown>): Promise<void> {
  const n = (k: string): void => {
    s[k] = (s[k] as number) + 1;
  };
  n('docs');
  let doc: ReturnType<typeof lerXml>;
  try {
    doc = lerXml(src);
  } catch (e) {
    if (e instanceof ErroXml) {
      n('parseErrors');
      return;
    }
    throw e;
  }
  const d = decodeRoot(t.root, doc);
  for (const i of d.issues) inc(s.ocorrenciasDecode as Record<string, number>, `${i.code} ${schemaPath(i.caminho)}`);
  const vi = validate(t.root.type as ComplexType, doc.raiz);
  if (vi.length === 0) n('validos');
  for (const k of new Set(vi.map((i) => `${i.code} ${schemaPath(i.caminho)}`))) {
    inc(s.ocorrenciasValidacao as Record<string, number>, k);
  }

  let signed: ElementoXml | undefined;
  for (const e of descendentes(doc.raiz)) {
    if (e.local === t.signedName) {
      signed = e;
      break;
    }
  }
  const value = t.pick(d.value as Record<string, unknown>);
  if (!signed || value === undefined) return;
  const ours = serialize(t.signedType, t.signedName, value, signed.pai?.ns ?? '');
  if (ours === src.slice(signed.inicio, signed.fim)) n('igualBytesOriginal');
  const withNs = serialize(t.signedType, t.signedName, value, '');
  if (withNs === c14n(signed)) n('igualC14nOriginal');

  const id = atributoDe(signed, 'Id') ?? '';
  const sig = encontrarAssinaturas(doc).find((x) => {
    for (const r of descendentes(x)) if (r.local === 'Reference') return atributoDe(r, 'URI') === `#${id}`;
    return false;
  });
  if (!sig) {
    n('semAssinatura');
    return;
  }
  const v = await conferirAssinatura(doc, { id, elemento: t.signedName });
  if (v.ok) n('assinaturaOriginalConfere');
  else inc(s.falhasAssinatura as Record<string, number>, v.motivo);
  let dv = '';
  for (const e of descendentes(sig)) if (e.local === 'DigestValue') dv = textoDe(e).trim();
  if ((await sha1(withNs)) === dv) {
    n('digestNossoConfere');
    if (v.ok) n('digestNossoConfereQuandoOriginalConfere');
  }
}

const result: Record<string, unknown> = { runtime: runtimeName(), grupos: {} };
const grupos = result.grupos as Record<string, Record<string, unknown>>;
const t0 = performance.now();
for (const [dir, targets] of [
  ['nfe-proprias', [nfeTarget('nfe/PL_010f', nfe010f), nfeTarget('nfe/PL_010e', nfe010e)]],
  ['nfe-importadas', [nfeTarget('nfe/PL_010f', nfe010f), nfeTarget('nfe/PL_010e', nfe010e)]],
] as const) {
  for (const t of targets) {
    const s = newStats();
    for (const src of corpusDocs(dir)) await processDoc(src, t, s);
    grupos[`${dir} :: ${t.label}`] = s;
  }
}
{
  const canc = newStats();
  const carta = newStats();
  const outros: Record<string, number> = {};
  for (const src of corpusDocs('eventos-nfe')) {
    const tp = /<tpEvento>(\d+)<\/tpEvento>/.exec(src)?.[1] ?? '?';
    if (tp === '110111') await processDoc(src, eventoTarget('evento-cancelamento/PL_010d', cancelamento), canc);
    else if (tp === '110110') await processDoc(src, eventoTarget('evento-cce/PL_010d', cce), carta);
    else inc(outros, tp);
  }
  grupos['eventos-nfe :: nfe/evento-cancelamento/PL_010d'] = canc;
  grupos['eventos-nfe :: nfe/evento-cce/PL_010d'] = carta;
  grupos['eventos-nfe :: outros tpEvento (não processados)'] = outros;
}
{
  const s = newStats();
  const outros: Record<string, number> = {};
  for (const src of corpusDocs('mdfe')) {
    const rootName = /<([A-Za-z]+)[\s>]/.exec(src.replace(/^<\?xml[^>]*\?>/, ''))?.[1] ?? '?';
    if (rootName === 'mdfeProc') await processDoc(src, mdfeTarget, s);
    else inc(outros, rootName);
  }
  grupos['mdfe :: mdfe/3.00b'] = s;
  grupos['mdfe :: outras raízes (não processadas)'] = outros;
}
result.segundos = Math.round((performance.now() - t0) / 100) / 10;
const file = writeResult('roundtrip', result);
console.log(JSON.stringify(result, null, 1));
console.error(`resultado em ${file}`);
