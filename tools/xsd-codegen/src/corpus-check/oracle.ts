#!/usr/bin/env bun
/**
 * Veredito do validador próprio contra o `xmllint --schema` (libxml2) no corpus local, por módulo. O critério de
 * aceitação é concordar no veredito (válido ou inválido) de cada documento. Só agregados na saída: as mensagens do
 * xmllint são reduzidas a (tipo de erro, nome local do elemento), sem valores.
 *
 * Eventos são conferidos como a SEFAZ faz, em duas etapas: o envelope genérico do PL_010d (detEvento é xs:any) e o
 * detEvento isolado contra o schema do tipo de evento, com os tipos básicos do PL_010d (a mesma composição do módulo
 * gerado). Os schemas-invólucro ficam em ~/.local/state/sinete/oracle/.
 *
 * Uso: bun src/corpus-check/oracle.ts   (resultado também em ~/.local/state/sinete/results/oracle-xmllint.json)
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { c14n, descendants, parseXml, XmlError } from '../../../../packages/core/src/xml/index.ts';
import type { RootElement } from '../../../../packages/schemas/src/index.ts';
import { validateRoot } from '../../../../packages/schemas/src/index.ts';
import * as mdfe300b from '../../../../packages/schemas/src/mdfe/3.00b.ts';
import * as cancelamento from '../../../../packages/schemas/src/nfe/evento-cancelamento/PL_010d.ts';
import * as cce from '../../../../packages/schemas/src/nfe/evento-cce/PL_010d.ts';
import * as nfe010e from '../../../../packages/schemas/src/nfe/PL_010e.ts';
import * as nfe010f from '../../../../packages/schemas/src/nfe/PL_010f.ts';
import { xsdDir } from '../generate.ts';
import { corpusDocs, inc, runtimeName, stateDir, writeResult } from './common.ts';

const oracleDir = path.join(stateDir, 'oracle');
mkdirSync(oracleDir, { recursive: true });

function wrapper(name: string, include: string, element: string, type: string): string {
  const file = path.join(oracleDir, `${name}.xsd`);
  writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns="http://www.portalfiscal.inf.br/nfe" targetNamespace="http://www.portalfiscal.inf.br/nfe" elementFormDefault="qualified" attributeFormDefault="unqualified">
  <xs:include schemaLocation="${include}"/>
  <xs:element name="${element}" type="${type}"/>
</xs:schema>
`,
  );
  return file;
}

/** detEvento do tipo de evento, com os tipos básicos do PL_010d ao lado (a mesma composição do módulo gerado). */
function detEventoSchema(name: string, eventoFile: string): string {
  const dir = path.join(oracleDir, name);
  mkdirSync(dir, { recursive: true });
  copyFileSync(path.join(xsdDir, eventoFile), path.join(dir, path.basename(eventoFile)));
  copyFileSync(
    path.join(xsdDir, 'nfe/PL_010d_v1.03/Evento/tiposBasico_v1.03.xsd'),
    path.join(dir, 'tiposBasico_v1.03.xsd'),
  );
  return path.join(dir, path.basename(eventoFile));
}

interface Lint {
  readonly valid: boolean;
  readonly kinds: string[];
}

function xmllint(schema: string, src: string): Lint {
  const r = Bun.spawnSync(['xmllint', '--noout', '--schema', schema, '-'], { stdin: new TextEncoder().encode(src) });
  const kinds: string[] = [];
  for (const line of r.stderr.toString().split('\n')) {
    const m = /Element '(?:\{[^}]*\})?([^']+)'(?:, attribute '([^']+)')?: (.*)/.exec(line);
    if (!m) continue;
    const msg = m[3] ?? '';
    const kind =
      /\[facet '(\w+)'\]/.exec(msg)?.[1] ??
      (/not expected|Missing child/.test(msg)
        ? 'modelo_de_conteudo'
        : /is not a valid value/.test(msg)
          ? 'tipo'
          : /is required/.test(msg)
            ? 'atributo_obrigatorio'
            : /not allowed/.test(msg)
              ? 'nao_permitido'
              : /No matching global declaration|not declared/.test(msg)
                ? 'raiz'
                : 'outro');
    kinds.push(`${kind} ${m[1]}${m[2] ? `/@${m[2]}` : ''}`);
  }
  return { valid: r.exitCode === 0, kinds };
}

interface Group {
  readonly label: string;
  readonly dir: string;
  readonly root: RootElement<unknown>;
  readonly accept: (src: string) => boolean;
  readonly oracle: (src: string) => Lint;
}

const nfeGroup = (dir: string, label: string, m: typeof nfe010f, pl: string): Group => ({
  label: `${dir} :: ${label}`,
  dir,
  root: m.nfeProcElement as RootElement<unknown>,
  accept: () => true,
  oracle: (
    (schema: string) => (src: string) =>
      xmllint(schema, src)
  )(wrapper(`nfeProc-${label.replace(/\W/g, '_')}`, path.join(xsdDir, pl), 'nfeProc', 'TNfeProc')),
});

function eventoGroup(label: string, m: typeof cancelamento, tp: string, eventoFile: string): Group {
  const envelope = path.join(xsdDir, 'nfe/PL_010d_v1.03/Evento/procEventoNFe_v1.00.xsd');
  const det = detEventoSchema(label.replace(/\W/g, '_'), eventoFile);
  return {
    label: `eventos-nfe :: ${label}`,
    dir: 'eventos-nfe',
    root: m.procEventoNFeElement as RootElement<unknown>,
    accept: (src) => new RegExp(`<tpEvento>${tp}</tpEvento>`).test(src),
    oracle: (src) => {
      const a = xmllint(envelope, src);
      let detXml: string | undefined;
      try {
        for (const e of descendants(parseXml(src).root)) {
          if (e.local === 'detEvento') {
            detXml = c14n(e);
            break;
          }
        }
      } catch (e) {
        if (!(e instanceof XmlError)) throw e;
      }
      const b = detXml === undefined ? { valid: true, kinds: [] } : xmllint(det, detXml);
      return { valid: a.valid && b.valid, kinds: [...a.kinds, ...b.kinds] };
    },
  };
}

const MODAL_XSD: Readonly<Record<string, string>> = {
  rodo: 'mdfeModalRodoviario_v3.00.xsd',
  aereo: 'mdfeModalAereo_v3.00.xsd',
  aquav: 'mdfeModalAquaviario_v3.00.xsd',
  ferrov: 'mdfeModalFerroviario_v3.00.xsd',
};

const groups: Group[] = [
  nfeGroup('nfe-proprias', 'nfe/PL_010f', nfe010f, 'nfe/PL_010f_v1.04/leiauteNFe_v4.00.xsd'),
  nfeGroup(
    'nfe-proprias',
    'nfe/PL_010e',
    nfe010e as unknown as typeof nfe010f,
    'nfe/PL_010e_v1.02/NFe/leiauteNFe_v4.00.xsd',
  ),
  nfeGroup('nfe-importadas', 'nfe/PL_010f', nfe010f, 'nfe/PL_010f_v1.04/leiauteNFe_v4.00.xsd'),
  nfeGroup(
    'nfe-importadas',
    'nfe/PL_010e',
    nfe010e as unknown as typeof nfe010f,
    'nfe/PL_010e_v1.02/NFe/leiauteNFe_v4.00.xsd',
  ),
  eventoGroup('nfe/evento-cancelamento/PL_010d', cancelamento, '110111', 'nfe/Evento_Canc_PL_v1.01/e110111_v1.00.xsd'),
  eventoGroup(
    'nfe/evento-cce/PL_010d',
    cce as unknown as typeof cancelamento,
    '110110',
    'nfe/Evento_CCe_PL_v1.01/e110110_v1.00.xsd',
  ),
  {
    label: 'mdfe :: mdfe/3.00b',
    dir: 'mdfe',
    root: mdfe300b.mdfeProcElement as RootElement<unknown>,
    accept: (src) => /^(?:<\?xml[^>]*\?>)?\s*<mdfeProc[\s>]/.test(src),
    oracle: (src) => {
      // Também em duas etapas: o infModal é xs:any (skip) e o modal é validado pelo schema dele.
      const dir = path.join(xsdDir, 'mdfe/PL_MDFe_300b_NT012025_1.05');
      const a = xmllint(path.join(dir, 'procMDFe_v3.00.xsd'), src);
      let modal: { name: string; xml: string } | undefined;
      try {
        for (const e of descendants(parseXml(src).root)) {
          if (e.local === 'infModal') {
            const k = e.children.find((c) => c.type === 'element');
            if (k?.type === 'element') modal = { name: k.local, xml: c14n(k) };
            break;
          }
        }
      } catch (e) {
        if (!(e instanceof XmlError)) throw e;
      }
      const file = modal && MODAL_XSD[modal.name];
      const b = modal && file ? xmllint(path.join(dir, file), modal.xml) : { valid: true, kinds: [] };
      return { valid: a.valid && b.valid, kinds: [...a.kinds, ...b.kinds] };
    },
  },
];

const result: Record<string, unknown> = { runtime: runtimeName(), grupos: {} };
const t0 = performance.now();
for (const g of groups) {
  const s = {
    docs: 0,
    xmlMalformado: 0,
    concordaValido: 0,
    concordaInvalido: 0,
    soXmllintRecusa: 0,
    soNosRecusamos: 0,
    divergencias: {} as Record<string, number>,
  };
  for (const src of corpusDocs(g.dir)) {
    if (!g.accept(src)) continue;
    s.docs++;
    const x = g.oracle(src);
    let ours: ReturnType<typeof validateRoot>;
    try {
      ours = validateRoot(g.root, src);
    } catch (e) {
      if (!(e instanceof XmlError)) throw e;
      s.xmlMalformado++;
      if (x.valid) inc(s.divergencias, 'xmllint aceita XML que o parser estrito recusa');
      else s.concordaInvalido++;
      continue;
    }
    const oursValid = ours.length === 0;
    if (oursValid && x.valid) s.concordaValido++;
    else if (!oursValid && !x.valid) s.concordaInvalido++;
    else if (x.valid) {
      s.soNosRecusamos++;
      for (const o of ours) inc(s.divergencias, `so nos: ${o.code} ${o.path.replace(/\[\d+\]/g, '')}`);
    } else {
      s.soXmllintRecusa++;
      for (const k of x.kinds) inc(s.divergencias, `so xmllint: ${k}`);
    }
  }
  (result.grupos as Record<string, unknown>)[g.label] = s;
}
// Mutações: documentos válidos alterados por splice (sem reserializar), para exercitar o lado inválido do validador.
// PRNG com semente fixa: a rodada é reproduzível.
let seed = 20260925;
const rand = (n: number): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};
type Mutation = (src: string) => string | undefined;
const leaves = (src: string): { start: number; end: number; openEnd: number; contentEnd: number }[] => {
  const out: { start: number; end: number; openEnd: number; contentEnd: number }[] = [];
  for (const e of descendants(parseXml(src).root)) {
    if (e.children.length > 0 && e.children.every((c) => c.type === 'text')) out.push(e);
  }
  return out;
};
const MUTATIONS: Record<string, Mutation> = {
  'remove folha': (src) => {
    const l = leaves(src);
    const e = l[rand(l.length)];
    return e && src.slice(0, e.start) + src.slice(e.end);
  },
  'duplica folha': (src) => {
    const l = leaves(src);
    const e = l[rand(l.length)];
    return e && src.slice(0, e.end) + src.slice(e.start, e.end) + src.slice(e.end);
  },
  'texto com sufixo': (src) => {
    const l = leaves(src);
    const e = l[rand(l.length)];
    return e && `${src.slice(0, e.contentEnd)}9X${src.slice(e.contentEnd)}`;
  },
  'texto vazio': (src) => {
    const l = leaves(src);
    const e = l[rand(l.length)];
    return e && src.slice(0, e.openEnd) + src.slice(e.contentEnd);
  },
  'texto com espaço nas pontas': (src) => {
    const l = leaves(src);
    const e = l[rand(l.length)];
    return e && `${src.slice(0, e.openEnd)} ${src.slice(e.openEnd, e.contentEnd)} ${src.slice(e.contentEnd)}`;
  },
  'troca folhas vizinhas': (src) => {
    const doc = parseXml(src);
    const pairs: [XmlEl, XmlEl][] = [];
    for (const e of descendants(doc.root)) {
      const kids = e.children.filter((c): c is XmlEl => c.type === 'element');
      for (let i = 0; i + 1 < kids.length; i++) {
        const a = kids[i] as XmlEl;
        const b = kids[i + 1] as XmlEl;
        if (a.end === b.start && a.local !== b.local) pairs.push([a, b]);
      }
    }
    const pair = pairs[rand(pairs.length)];
    if (!pair) return undefined;
    const [a, b] = pair;
    return src.slice(0, a.start) + src.slice(b.start, b.end) + src.slice(a.start, a.end) + src.slice(b.end);
  },
};
type XmlEl = ReturnType<typeof parseXml>['root'];
const mutacoes: Record<string, Record<string, number>> = {};
for (const g of [groups[0], groups[4], groups[6]] as Group[]) {
  const s: Record<string, number> = { mutados: 0, concorda: 0, discorda: 0 };
  const div: Record<string, number> = {};
  let taken = 0;
  for (const src of corpusDocs(g.dir)) {
    if (!g.accept(src) || taken >= 150) continue;
    if (validateRoot(g.root, src).length > 0 || !g.oracle(src).valid) continue;
    taken++;
    for (const [nome, mut] of Object.entries(MUTATIONS)) {
      const m = mut(src);
      if (m === undefined) continue;
      s.mutados = (s.mutados ?? 0) + 1;
      const x = g.oracle(m);
      let oursValid: boolean;
      try {
        oursValid = validateRoot(g.root, m).length === 0;
      } catch {
        oursValid = false;
      }
      if (oursValid === x.valid) s.concorda = (s.concorda ?? 0) + 1;
      else {
        s.discorda = (s.discorda ?? 0) + 1;
        const detalhe = x.valid
          ? validateRoot(g.root, m)
              .map((o) => `${o.code} ${o.path.replace(/\[\d+\]/g, '')}`)
              .join(', ')
          : (x.kinds[0] ?? '?');
        inc(div, `${nome}: ${x.valid ? 'só nós recusamos' : 'só xmllint recusa'} (${detalhe})`);
      }
    }
  }
  mutacoes[g.label] = { ...s, ...div };
}
result.mutacoes = mutacoes;
result.segundos = Math.round((performance.now() - t0) / 100) / 10;
const file = writeResult('oracle-xmllint', result);
console.log(JSON.stringify(result, null, 1));
console.error(`resultado em ${file}`);
