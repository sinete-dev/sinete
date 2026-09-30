/**
 * Checagem local do builder contra o corpus (nunca no CI, nunca no repo). Para cada NF-e modelo 55 do corpus, remonta
 * a entrada do domínio a partir do XML autorizado e roda o `montarNfe` em duas passadas:
 *
 * - `informado`: todos os valores do XML vão na entrada. Mede quantas notas reais o builder aceita, quais ocorrências
 *   aparecem (por caminho sem índice) e se os totais recalculados (`ICMSTot`, `vNF`) batem com os autorizados.
 * - `derivado`: os valores que o builder sabe calcular (vICMS, vFCP, ST com ICMS próprio, diferimento, vIPI, vPIS,
 *   vCOFINS, crédito do Simples, vProd) saem da entrada. Mede, campo a campo, quantas vezes a conta do builder dá o
 *   mesmo texto do XML autorizado, e quantas fica dentro de R$ 0,01.
 *
 * Imprime e grava só agregados (contagens, caminhos de schema sem índice, nomes de grupo), nunca conteúdo, nome de
 * arquivo, documento ou chave. A emissão é simulada em homologação numa data fixa do PL_010f: a chave e o dhEmi
 * gerados não importam aqui, só os valores.
 *
 * Uso: `bun packages/nfe/test/golden/golden.ts` (corpus em `~/.local/state/sinete/corpus` ou `SINETE_CORPUS`).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import { descendentes, lerXml } from '@sinete/core/xml';
import { decodificar } from '@sinete/schemas';
import type { TNFe_infNFe } from '@sinete/schemas/nfe/PL_010f';
import { TNFe_infNFe as InfNFe } from '@sinete/schemas/nfe/PL_010f';
import type { DadosNfe, Icms, Item, MontarNfeOpcoes } from '../../src/index.ts';
import { Decimal, montarNfe } from '../../src/index.ts';

const corpusDir = process.env.SINETE_CORPUS ?? path.join(homedir(), '.local/state/sinete/corpus');
const PASTAS = ['nfe-proprias', 'nfe-importadas'];
const NS = 'http://www.portalfiscal.inf.br/nfe';

type Obj = Record<string, unknown>;
type Modo = 'informado' | 'derivado';

const inc = (m: Record<string, number>, k: string, n = 1): void => {
  m[k] = (m[k] ?? 0) + n;
};
const semIndice = (p: string): string => p.replace(/\[\d+\]/g, '');
const o = (v: unknown): Obj => (v ?? {}) as Obj;
const def = <T extends Obj>(x: T): T => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as T;

/** Campos que o builder deriva, por grupo; na passada `derivado` saem da entrada. */
const DERIVADOS_ICMS = ['vICMS', 'vFCP', 'vBCFCP', 'vICMSOp', 'vICMSDif', 'vFCPDif', 'vFCPEfet', 'vCredICMSSN'];
const DERIVADOS_ST = ['vICMSST', 'vFCPST', 'vBCFCPST'];

function icmsDoXml(grupos: Obj, modo: Modo): { icms: Icms; nome: string } {
  const [nome, g0] = Object.entries(grupos)[0] as [string, Obj];
  const g = { ...g0 } as Obj;
  const temProprio = g.vICMS !== undefined && !['ICMSSN900'].includes(nome);
  const st =
    g.modBCST === undefined
      ? undefined
      : def({
          modBCST: g.modBCST,
          pMVAST: g.pMVAST,
          pRedBCST: g.pRedBCST,
          vBCST: g.vBCST,
          pICMSST: g.pICMSST,
          vICMSST: g.vICMSST,
          vBCFCPST: g.vBCFCPST,
          pFCPST: g.pFCPST,
          vFCPST: g.vFCPST,
          // Sem ICMS próprio no grupo, o abatimento não é deduzível do XML: o ST fica como informado.
          ...(temProprio ? {} : { vICMSDeducaoST: '0' }),
        });
  for (const k of ['modBCST', 'pMVAST', 'pRedBCST', 'vBCST', 'pICMSST', 'vICMSST', 'vBCFCPST', 'pFCPST', 'vFCPST'])
    delete g[k];
  const deson =
    g.vICMSDeson === undefined
      ? undefined
      : def({ vICMSDeson: g.vICMSDeson, motDesICMS: g.motDesICMS, indDeduzDeson: g.indDeduzDeson });
  const desonSt =
    g.vICMSSTDeson === undefined ? undefined : { vICMSSTDeson: g.vICMSSTDeson, motDesICMSST: g.motDesICMSST };
  for (const k of ['vICMSDeson', 'motDesICMS', 'indDeduzDeson', 'vICMSSTDeson', 'motDesICMSST']) delete g[k];
  if (modo === 'derivado') {
    for (const k of DERIVADOS_ICMS) delete g[k];
    if (st && temProprio) for (const k of DERIVADOS_ST) delete (st as Obj)[k];
    // Sem alíquota, o valor não é derivável: mantém o informado.
    if (g0.pICMS === undefined && g0.vICMS !== undefined) g.vICMS = g0.vICMS;
    if (g0.pFCP === undefined && g0.vFCP !== undefined) g.vFCP = g0.vFCP;
  }
  const extra: Obj = {};
  if (st) extra.st = st;
  if (deson) extra.desoneracao = deson;
  if (desonSt) extra.desoneracaoSt = desonSt;
  if (nome === 'ICMSPart') extra.grupo = 'Part';
  if (nome === 'ICMSST') extra.grupo = 'ST';
  return { icms: { ...g, ...extra } as unknown as Icms, nome };
}

function pisCofinsDoXml(grupos: Obj | undefined, tag: 'PIS' | 'COFINS', modo: Modo): Obj | undefined {
  if (grupos === undefined) return undefined;
  const [, g] = Object.entries(grupos)[0] as [string, Obj];
  const r = def({
    CST: g.CST,
    vBC: g.vBC,
    aliquota: g[`p${tag}`],
    qBCProd: g.qBCProd,
    vAliqProd: g.vAliqProd,
    valor: modo === 'derivado' ? undefined : g[`v${tag}`],
  });
  return r;
}

function pisCofinsStDoXml(g: Obj | undefined, tag: 'PIS' | 'COFINS'): Obj | undefined {
  if (g === undefined) return undefined;
  return def({
    vBC: g.vBC,
    aliquota: g[`p${tag}`],
    qBCProd: g.qBCProd,
    vAliqProd: g.vAliqProd,
    valor: g[`v${tag}`],
    indSoma: g[`indSoma${tag}ST`],
  });
}

function ipiDoXml(g: Obj | undefined, modo: Modo): Obj | undefined {
  if (g === undefined) return undefined;
  const head = def({ cEnq: g.cEnq, CNPJProd: g.CNPJProd, cSelo: g.cSelo, qSelo: g.qSelo });
  if (g.IPINT) return { ...head, CST: o(g.IPINT).CST };
  const t = o(g.IPITrib);
  return def({
    ...head,
    CST: t.CST,
    vBC: t.vBC,
    pIPI: t.pIPI,
    qUnid: t.qUnid,
    vUnid: t.vUnid,
    vIPI: modo === 'derivado' ? undefined : t.vIPI,
  });
}

function itemDoXml(det: Obj, modo: Modo): { item: Item; icms?: string } {
  const p = o(det.prod);
  const imp = o(det.imposto);
  const especificoKey = ['veicProd', 'med', 'arma', 'comb', 'nRECOPI'].find((k) => p[k] !== undefined);
  const produto = def({
    ...p,
    vProd: modo === 'derivado' ? undefined : p.vProd,
    especifico: especificoKey ? { [especificoKey]: p[especificoKey] } : undefined,
    veicProd: undefined,
    med: undefined,
    arma: undefined,
    comb: undefined,
    nRECOPI: undefined,
  });
  let icms: { icms: Icms; nome: string } | undefined;
  if (imp.ICMS) icms = icmsDoXml(o(imp.ICMS), modo);
  const issqn = imp.ISSQN
    ? def({ ...o(imp.ISSQN), vISSQN: modo === 'derivado' ? undefined : o(imp.ISSQN).vISSQN })
    : undefined;
  const impostos = def({
    vTotTrib: imp.vTotTrib,
    icms: icms?.icms,
    ipi: ipiDoXml(imp.IPI as Obj | undefined, modo),
    ii: imp.II,
    issqn,
    pis: pisCofinsDoXml(imp.PIS as Obj | undefined, 'PIS', modo),
    pisSt: pisCofinsStDoXml(imp.PISST as Obj | undefined, 'PIS'),
    cofins: pisCofinsDoXml(imp.COFINS as Obj | undefined, 'COFINS', modo),
    cofinsSt: pisCofinsStDoXml(imp.COFINSST as Obj | undefined, 'COFINS'),
    icmsUfDest: imp.ICMSUFDest,
    is: imp.IS,
    ibsCbs: imp.IBSCBS ? { grupo: imp.IBSCBS } : undefined,
  });
  const devol = o(det.impostoDevol);
  const item = def({
    produto,
    impostos,
    impostoDevol: det.impostoDevol ? { pDevol: devol.pDevol, vIPIDevol: o(devol.IPI).vIPIDevol } : undefined,
    infAdProd: det.infAdProd,
    obsItem: det.obsItem,
  }) as unknown as Item;
  return icms ? { item, icms: icms.nome } : { item };
}

function endereco(e: Obj | undefined): Obj | undefined {
  if (e === undefined) return undefined;
  if (e.UF === 'EX')
    return def({
      exterior: true,
      xLgr: e.xLgr,
      nro: e.nro,
      xCpl: e.xCpl,
      xBairro: e.xBairro,
      cPais: e.cPais ?? '0000',
      xPais: e.xPais ?? 'EXTERIOR',
      fone: e.fone,
    });
  return def({
    xLgr: e.xLgr,
    nro: e.nro,
    xCpl: e.xCpl,
    xBairro: e.xBairro,
    cMun: e.cMun,
    xMun: e.xMun,
    UF: e.UF,
    CEP: e.CEP,
    fone: e.fone,
  });
}

function entradaDoXml(inf: TNFe_infNFe, modo: Modo): { input: DadosNfe; grupos: string[] } {
  const ide = o(inf.ide);
  const emit = o(inf.emit);
  const dest = inf.dest ? o(inf.dest) : undefined;
  const itens = (inf.det as unknown as Obj[]).map((d) => itemDoXml(d, modo));
  const refs = (ide.NFref as Obj[] | undefined)?.map((r) => r);
  const pag = o(inf.pag);
  const input = def({
    serie: ide.serie,
    nNF: ide.nNF,
    natOp: ide.natOp,
    tpNF: ide.tpNF,
    finNFe: ide.finNFe,
    idDest: ide.idDest,
    indFinal: ide.indFinal,
    indPres: ide.indPres,
    indIntermed: ide.indIntermed,
    cMunFG: ide.cMunFG,
    referenciadas: refs,
    emitente: def({
      CNPJ: emit.CNPJ,
      CPF: emit.CPF,
      xNome: emit.xNome,
      xFant: emit.xFant,
      endereco: endereco(emit.enderEmit as Obj),
      IE: emit.IE,
      IEST: emit.IEST,
      IM: emit.IM,
      CNAE: emit.CNAE,
      CRT: emit.CRT,
    }),
    destinatario: dest
      ? def({
          CNPJ: dest.CNPJ,
          CPF: dest.CPF,
          idEstrangeiro: dest.idEstrangeiro,
          xNome: dest.xNome,
          endereco: endereco(dest.enderDest as Obj | undefined),
          indIEDest: dest.indIEDest,
          IE: dest.IE,
          ISUF: dest.ISUF,
          IM: dest.IM,
          email: dest.email,
        })
      : undefined,
    itens: itens.map((i) => i.item),
    transporte: { modFrete: o(inf.transp).modFrete },
    pagamento: pag.detPag
      ? def({
          detPag: (pag.detPag as Obj[]).map((d) =>
            def({ indPag: d.indPag, tPag: d.tPag, xPag: d.xPag, vPag: d.vPag, card: d.card }),
          ),
          vTroco: pag.vTroco,
        })
      : undefined,
  }) as unknown as DadosNfe;
  return { input, grupos: itens.map((i) => i.icms ?? 'sem ICMS') };
}

/** Compara campo a campo (texto igual, ou dentro de R$ 0,01). */
function comparar(
  orig: Obj,
  novo: Obj,
  prefixo: string,
  igual: Record<string, number>,
  tol: Record<string, number>,
  dif: Record<string, number>,
): void {
  for (const [k, v] of Object.entries(orig)) {
    if (typeof v !== 'string' || !/^-?\d+(\.\d+)?$/.test(v)) continue;
    const n = novo[k];
    const chave = `${prefixo}.${k}`;
    if (n === v) inc(igual, chave);
    else if (typeof n === 'string' && Decimal.of(n).minus(v).abs().compare('0.01') <= 0) inc(tol, chave);
    else inc(dif, chave);
  }
}

const opcoes: MontarNfeOpcoes = {
  ambiente: 'homologacao',
  tempo: contextoDeTempo({ emissao: relogioFixo('2026-09-26T12:00:00-03:00') }),
  exigencias: { infRespTec: 'opcional', csrt: 'opcional' },
};

const r = {
  docs: 0,
  nfe55: 0,
  ignorados: {} as Record<string, number>,
  gruposIcms: {} as Record<string, number>,
  informado: {
    ok: 0,
    falha: 0,
    ocorrencias: {} as Record<string, number>,
    totais: { igual: {}, tolerancia: {}, diferente: {} } as Record<string, Record<string, number>>,
  },
  derivado: {
    ok: 0,
    falha: 0,
    ocorrencias: {} as Record<string, number>,
    itens: { igual: {}, tolerancia: {}, diferente: {} } as Record<string, Record<string, number>>,
  },
};

if (!existsSync(corpusDir)) {
  console.log(`corpus ausente em ${corpusDir}: nada a fazer`);
  process.exit(0);
}

for (const pasta of PASTAS) {
  const dir = path.join(corpusDir, pasta);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.xml')) continue;
    r.docs++;
    let doc: ReturnType<typeof lerXml>;
    try {
      doc = lerXml(readFileSync(path.join(dir, f), 'utf8'));
    } catch {
      inc(r.ignorados, 'xml ilegível');
      continue;
    }
    const el = Array.from(descendentes(doc.raiz)).find((e) => e.local === 'infNFe' && e.ns === NS);
    if (el === undefined) {
      inc(r.ignorados, 'sem infNFe');
      continue;
    }
    const inf = decodificar(InfNFe, el).valor;
    if (inf.ide.mod !== '55') {
      inc(r.ignorados, `modelo ${inf.ide.mod}`);
      continue;
    }
    r.nfe55++;
    for (const modo of ['informado', 'derivado'] as const) {
      const { input, grupos } = entradaDoXml(inf, modo);
      if (modo === 'informado') for (const g of grupos) inc(r.gruposIcms, g);
      let res: Awaited<ReturnType<typeof montarNfe>>;
      try {
        res = await montarNfe(input, opcoes);
      } catch (e) {
        inc(r[modo].ocorrencias, `exceção ${(e as Error).name}`);
        r[modo].falha++;
        continue;
      }
      if (!res.ok) {
        r[modo].falha++;
        for (const i of res.ocorrencias) inc(r[modo].ocorrencias, `${i.code} ${semIndice(i.caminho)}`);
        continue;
      }
      r[modo].ok++;
      const novo = res.valor.infNFe;
      if (modo === 'informado') {
        const t = r.informado.totais;
        comparar(
          o(inf.total.ICMSTot),
          o(novo.total.ICMSTot),
          'ICMSTot',
          t.igual as Record<string, number>,
          t.tolerancia as Record<string, number>,
          t.diferente as Record<string, number>,
        );
      } else {
        const t = r.derivado.itens;
        (inf.det as unknown as Obj[]).forEach((d, n) => {
          const nd = (novo.det as unknown as Obj[])[n] as Obj;
          const [gnome, g] = Object.entries(o(o(d.imposto).ICMS))[0] ?? ['', {}];
          const ng = o(o(o(nd.imposto).ICMS)[gnome]);
          comparar(
            o(g),
            ng,
            gnome,
            t.igual as Record<string, number>,
            t.tolerancia as Record<string, number>,
            t.diferente as Record<string, number>,
          );
          comparar(
            { vProd: o(d.prod).vProd },
            { vProd: o(nd.prod).vProd },
            'prod',
            t.igual as Record<string, number>,
            t.tolerancia as Record<string, number>,
            t.diferente as Record<string, number>,
          );
          for (const tag of ['PIS', 'COFINS']) {
            const [pn, pg] = Object.entries(o(o(d.imposto)[tag]))[0] ?? ['', {}];
            comparar(
              o(pg),
              o(o(o(nd.imposto)[tag])[pn]),
              pn,
              t.igual as Record<string, number>,
              t.tolerancia as Record<string, number>,
              t.diferente as Record<string, number>,
            );
          }
          const ipi = o(o(d.imposto).IPI).IPITrib;
          if (ipi)
            comparar(
              o(ipi),
              o(o(o(nd.imposto).IPI).IPITrib),
              'IPITrib',
              t.igual as Record<string, number>,
              t.tolerancia as Record<string, number>,
              t.diferente as Record<string, number>,
            );
        });
      }
    }
  }
}

const top = (m: Record<string, number>, n = 25): Record<string, number> =>
  Object.fromEntries(
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n),
  );
const saida = {
  ...r,
  informado: { ...r.informado, ocorrencias: top(r.informado.ocorrencias, 40) },
  derivado: { ...r.derivado, ocorrencias: top(r.derivado.ocorrencias, 40) },
};
const outDir = path.join(homedir(), '.local/state/sinete/results');
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'nfe-golden.json');
writeFileSync(file, `${JSON.stringify(saida, null, 1)}\n`);
console.log(
  JSON.stringify({
    docs: r.docs,
    nfe55: r.nfe55,
    informado: { ok: r.informado.ok, falha: r.informado.falha },
    derivado: { ok: r.derivado.ok, falha: r.derivado.falha },
  }),
);
console.log(`resultado em ${file}`);
