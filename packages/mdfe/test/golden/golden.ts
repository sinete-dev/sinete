/**
 * Checagem local do builder contra o corpus de MDF-e autorizados (nunca no CI, nunca no repo). Para cada `mdfeProc`,
 * remonta a entrada do domínio a partir do XML autorizado, roda o `montarMdfe` com o mesmo `cMDF`, `tpEmis` e fuso, e
 * compara o `infMDFe` montado com o autorizado em forma canônica (C14N), elemento a elemento.
 *
 * Também confere, sobre o mesmo corpus: a tabela de divisas contra o percurso de cada MDF-e autorizado, o endereço do
 * QR Code, e a forma do `nSeqEvento` e do `Id` dos eventos registrados.
 *
 * Imprime e grava só agregados (contagens, caminhos sem índice, códigos de ocorrência), nunca conteúdo, nome de
 * arquivo, documento, placa ou chave. O schema do MDF-e 3.00b só é vigente a partir de 06/10/2025 em produção: um
 * documento anterior é montado nessa data e a comparação ignora `Id`, `cDV` e `dhEmi`.
 *
 * Uso: `bun packages/mdfe/test/golden/golden.ts` (corpus em `~/.local/state/sinete/corpus/mdfe` ou `SINETE_CORPUS_MDFE`).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import type { ElementoXml } from '@sinete/core/xml';
import { atributoDe, c14n, elementosFilhos, lerXml, primeiroFilho, textoDe } from '@sinete/core/xml';
import { decodificar } from '@sinete/schemas';
import type { TMDFe_infMDFe } from '@sinete/schemas/mdfe/3.00b';
import { TMDFe_infMDFe as InfMDFe } from '@sinete/schemas/mdfe/3.00b';
import type { DadosMdfeRodoviario, UfMdfe } from '../../src/index.ts';
import { conferirPercurso, MDFE_NS, montarMdfe } from '../../src/index.ts';

const dir = process.env.SINETE_CORPUS_MDFE ?? path.join(homedir(), '.local/state/sinete/corpus/mdfe');
if (!existsSync(dir)) {
  console.log(`corpus ausente: ${dir}`);
  process.exit(0);
}

type Obj = Record<string, unknown>;
const inc = (m: Record<string, number>, k: string, n = 1): void => {
  m[k] = (m[k] ?? 0) + n;
};
const o = (v: unknown): Obj => (v ?? {}) as Obj;
const arr = <T>(v: T[] | undefined): T[] => v ?? [];
const def = <T extends Obj>(x: T): T => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as T;
const doc = (x: Obj): Obj => def({ CNPJ: x.CNPJ as string | undefined, CPF: x.CPF as string | undefined });
const docC = (x: Obj): Obj =>
  def({ CNPJ: x.CNPJ as string | undefined, CPF: x.CPF as string | undefined, idEstrangeiro: x.idEstrangeiro });

/** Entrada do domínio a partir do `infMDFe` autorizado (o caminho inverso do builder). */
function entradaDoXml(inf: TMDFe_infMDFe): DadosMdfeRodoviario {
  const ide = inf.ide;
  const e = inf.emit;
  const rodo = o(inf.infModal.rodo);
  const antt = o(rodo.infANTT);
  const tr = o(rodo.veicTracao);
  const prop = (p: unknown): DadosMdfeRodoviario['rodoviario']['tracao']['proprietario'] =>
    p === undefined
      ? undefined
      : (def({
          ...doc(o(p)),
          RNTRC: o(p).RNTRC,
          xNome: o(p).xNome,
          IE: o(p).IE,
          UF: o(p).UF,
          tpProp: o(p).tpProp,
        }) as never);
  const vp = antt.valePed === undefined ? undefined : o(antt.valePed);
  const pp = inf.prodPred;
  const lot = pp?.infLotacao;
  const local = (l: Obj): Obj =>
    l.CEP !== undefined ? { CEP: l.CEP } : { latitude: l.latitude, longitude: l.longitude };
  return def({
    tpEmit: ide.tpEmit,
    tpTransp: ide.tpTransp,
    serie: ide.serie,
    nMDF: ide.nMDF,
    cMDF: ide.cMDF,
    emitente: def({
      ...doc(e as unknown as Obj),
      IE: e.IE,
      xNome: e.xNome,
      xFant: e.xFant,
      endereco: def({ ...e.enderEmit }),
    }),
    ufIni: ide.UFIni as UfMdfe,
    ufFim: ide.UFFim as UfMdfe,
    carregamento: ide.infMunCarrega.map((m) => ({ cMun: m.cMunCarrega, xMun: m.xMunCarrega })),
    percurso: ide.infPercurso?.map((p) => p.UFPer as UfMdfe),
    dhIniViagem: ide.dhIniViagem === undefined ? undefined : relogioFixo(ide.dhIniViagem).agora(),
    indCanalVerde: ide.indCanalVerde === '1' ? true : undefined,
    indCarregaPosterior: ide.indCarregaPosterior === '1' ? true : undefined,
    rodoviario: def({
      RNTRC: antt.RNTRC,
      ciot: arr(antt.infCIOT as Obj[] | undefined).map((c) => def({ CIOT: c.CIOT, ...doc(c) })),
      valePedagio:
        vp === undefined
          ? undefined
          : def({
              dispositivos: arr(vp.disp as Obj[] | undefined).map((d) =>
                def({
                  CNPJForn: d.CNPJForn,
                  responsavel:
                    d.CNPJPg !== undefined ? { CNPJ: d.CNPJPg } : d.CPFPg !== undefined ? { CPF: d.CPFPg } : undefined,
                  nCompra: d.nCompra,
                  vValePed: d.vValePed,
                  tpValePed: d.tpValePed,
                }),
              ),
              categCombVeic: vp.categCombVeic,
            }),
      contratantes: arr(antt.infContratante as Obj[] | undefined).map((c) =>
        def({ xNome: c.xNome, ...docC(c), contrato: c.infContrato }),
      ),
      pagamentos: arr(antt.infPag as Obj[] | undefined).map((p) =>
        def({
          xNome: p.xNome,
          ...docC(p),
          componentes: arr(p.Comp as Obj[] | undefined).map((c) => def({ ...c })),
          vContrato: p.vContrato,
          indAltoDesemp: p.indAltoDesemp === '1' ? true : undefined,
          indPag: p.indPag,
          vAdiant: p.vAdiant,
          indAntecipaAdiant: p.indAntecipaAdiant === '1' ? true : undefined,
          parcelas: arr(p.infPrazo as Obj[] | undefined).map((x) => ({ dVenc: x.dVenc, vParcela: x.vParcela })),
          tpAntecip: p.tpAntecip,
          banco: o(p.infBanc),
        }),
      ),
      tracao: def({
        cInt: tr.cInt,
        placa: tr.placa,
        RENAVAM: tr.RENAVAM,
        tara: tr.tara,
        capKG: tr.capKG,
        capM3: tr.capM3,
        proprietario: prop(tr.prop),
        condutores: arr(tr.condutor as Obj[] | undefined).map((c) => ({ xNome: c.xNome, CPF: c.CPF })),
        tpRod: tr.tpRod,
        tpCar: tr.tpCar,
        UF: tr.UF,
      }),
      reboques: arr(rodo.veicReboque as Obj[] | undefined).map((r) =>
        def({
          cInt: r.cInt,
          placa: r.placa,
          RENAVAM: r.RENAVAM,
          tara: r.tara,
          capKG: r.capKG,
          capM3: r.capM3,
          proprietario: prop(r.prop),
          tpCar: r.tpCar,
          UF: r.UF,
        }),
      ),
      codAgPorto: rodo.codAgPorto,
      lacres: arr(rodo.lacRodo as Obj[] | undefined).map((l) => l.nLacre),
    }),
    descarregamentos: inf.infDoc.infMunDescarga.map((m) =>
      def({
        cMun: m.cMunDescarga,
        xMun: m.xMunDescarga,
        nfe: m.infNFe?.map((n) =>
          def({
            chave: n.chNFe,
            segCodBarra: n.SegCodBarra,
            indReentrega: n.indReentrega === '1' ? true : undefined,
            perigosos: n.peri?.map((p) => def({ ...p })),
          }),
        ),
        cte: m.infCTe?.map((n) =>
          def({
            chave: n.chCTe,
            segCodBarra: n.SegCodBarra,
            indReentrega: n.indReentrega === '1' ? true : undefined,
            perigosos: n.peri?.map((p) => def({ ...p })),
          }),
        ),
      }),
    ),
    seguros: inf.seg?.map((s) =>
      def({
        responsavel: def({ respSeg: s.infResp.respSeg, ...doc(s.infResp as unknown as Obj) }),
        seguradora: s.infSeg === undefined ? undefined : { xSeg: s.infSeg.xSeg, CNPJ: s.infSeg.CNPJ },
        nApol: s.nApol,
        nAver: s.nAver,
      }),
    ),
    produtoPredominante:
      pp === undefined
        ? undefined
        : def({
            tpCarga: pp.tpCarga,
            xProd: pp.xProd,
            cEAN: pp.cEAN,
            NCM: pp.NCM,
            lotacao:
              lot === undefined
                ? undefined
                : {
                    carregamento: local(lot.infLocalCarrega as unknown as Obj),
                    descarregamento: local(lot.infLocalDescarrega as unknown as Obj),
                  },
          }),
    totais: { vCarga: inf.tot.vCarga, cUnid: inf.tot.cUnid, qCarga: inf.tot.qCarga },
    lacres: inf.lacres?.map((l) => l.nLacre),
    autXML: inf.autXML?.map((a) => doc(a as unknown as Obj)),
    informacoesAdicionais: inf.infAdic,
    respTec:
      inf.infRespTec === undefined
        ? undefined
        : def({
            CNPJ: inf.infRespTec.CNPJ,
            xContato: inf.infRespTec.xContato,
            email: inf.infRespTec.email,
            fone: inf.infRespTec.fone,
            csrt:
              inf.infRespTec.idCSRT === undefined
                ? undefined
                : { idCSRT: inf.infRespTec.idCSRT, hashCSRT: inf.infRespTec.hashCSRT },
          }),
  }) as unknown as DadosMdfeRodoviario;
}

/** Primeira diferença entre dois elementos, como caminho sem índice e o tipo da diferença. */
function diferenca(a: ElementoXml, b: ElementoXml, p: string, ignorar: ReadonlySet<string>): string | undefined {
  const aa = elementosFilhos(a).filter((x) => !ignorar.has(x.local));
  const bb = elementosFilhos(b).filter((x) => !ignorar.has(x.local));
  if (aa.length === 0 && bb.length === 0) {
    return textoDe(a).trim() === textoDe(b).trim() ? undefined : `${p}: texto`;
  }
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) {
    const x = aa[i];
    const y = bb[i];
    if (x === undefined) return `${p}/${y?.local}: só no montado`;
    if (y === undefined) return `${p}/${x.local}: só no autorizado`;
    if (x.local !== y.local) return `${p}/${x.local}: ordem ou ausência (montado tem ${y.local})`;
    const d = diferenca(x, y, `${p}/${x.local}`, ignorar);
    if (d !== undefined) return d;
  }
  return undefined;
}

const r = {
  arquivos: 0,
  mdfeProc: 0,
  eventos: 0,
  semInfMDFe: 0,
  montados: 0,
  rejeitadosPeloBuilder: 0,
  /** Rejeitados só por F30a/F37a num documento anterior à vigência, montado na data de início dela (artefato). */
  rejeitadosSoPelaDataDeslocada: 0,
  identicosC14n: 0,
  identicosNormalizados: 0,
  foraDaVigencia: 0,
  ocorrencias: {} as Record<string, number>,
  diferencas: {} as Record<string, number>,
  percurso: {
    comPercurso: 0,
    validos: 0,
    invalidos: 0,
    semPercursoInterestadual: 0,
    trechosInvalidos: {} as Record<string, number>,
  },
  qrCode: { total: 0, enderecoIgualAoDado: 0, comSign: 0 },
  eventosForma: {
    nSeqEvento: {} as Record<string, number>,
    idComprimento: {} as Record<string, number>,
    cStat: {} as Record<string, number>,
    tpEvento: {} as Record<string, number>,
  },
  formas: { qCarga: {} as Record<string, number>, vCarga: {} as Record<string, number> },
};

const QR_BASE = 'https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode';
const semIndice = (p: string): string => p.replace(/\[\d+\]/g, '');
const forma = (s: string): string => s.replace(/[0-9]/g, '9');

for (const nome of readdirSync(dir).sort()) {
  if (!nome.endsWith('.xml')) continue;
  r.arquivos++;
  const texto = readFileSync(path.join(dir, nome), 'utf8');
  const docXml = lerXml(texto.replace(/^﻿?<\?xml[^?]*\?>\s*/, ''));
  if (docXml.raiz.local === 'procEventoMDFe') {
    r.eventos++;
    const ev = primeiroFilho(docXml.raiz, 'eventoMDFe', MDFE_NS);
    const inf = ev && primeiroFilho(ev, 'infEvento', MDFE_NS);
    if (inf) {
      const seq = primeiroFilho(inf, 'nSeqEvento', MDFE_NS);
      if (seq) inc(r.eventosForma.nSeqEvento, forma(textoDe(seq)));
      inc(r.eventosForma.idComprimento, String((atributoDe(inf, 'Id') ?? '').length));
      const tp = primeiroFilho(inf, 'tpEvento', MDFE_NS);
      if (tp) inc(r.eventosForma.tpEvento, textoDe(tp));
    }
    const ret = primeiroFilho(docXml.raiz, 'retEventoMDFe', MDFE_NS);
    const rinf = ret && primeiroFilho(ret, 'infEvento', MDFE_NS);
    const cs = rinf && primeiroFilho(rinf, 'cStat', MDFE_NS);
    if (cs) inc(r.eventosForma.cStat, textoDe(cs));
    continue;
  }
  if (docXml.raiz.local !== 'mdfeProc') continue;
  r.mdfeProc++;
  const mdfe = primeiroFilho(docXml.raiz, 'MDFe', MDFE_NS);
  const infEl = mdfe && primeiroFilho(mdfe, 'infMDFe', MDFE_NS);
  if (!mdfe || !infEl) {
    r.semInfMDFe++;
    continue;
  }
  const supl = primeiroFilho(mdfe, 'infMDFeSupl', MDFE_NS);
  const qr = supl && primeiroFilho(supl, 'qrCodMDFe', MDFE_NS);
  if (qr) {
    r.qrCode.total++;
    const t = textoDe(qr).trim();
    if (t.toLowerCase().startsWith(`${QR_BASE.toLowerCase()}?`)) r.qrCode.enderecoIgualAoDado++;
    if (t.includes('&sign=')) r.qrCode.comSign++;
  }
  const inf = decodificar(InfMDFe, infEl, docXml.texto).valor;
  inc(r.formas.qCarga, forma(inf.tot.qCarga));
  inc(r.formas.vCarga, forma(inf.tot.vCarga).replace(/^9+/, 'N'));
  const perc = (inf.ide.infPercurso ?? []).map((p) => p.UFPer as UfMdfe);
  const trecho = conferirPercurso(inf.ide.UFIni as UfMdfe, perc, inf.ide.UFFim as UfMdfe);
  if (perc.length > 0) r.percurso.comPercurso++;
  else if (inf.ide.UFIni !== inf.ide.UFFim) r.percurso.semPercursoInterestadual++;
  if (trecho === undefined) r.percurso.validos++;
  else {
    r.percurso.invalidos++;
    inc(r.percurso.trechosInvalidos, [trecho.de, trecho.para].sort().join('-'));
  }

  const dhEmi = inf.ide.dhEmi;
  const offset = ((): number => {
    const m = /([+-])(\d{2}):(\d{2})$/.exec(dhEmi);
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : -180;
  })();
  const ambiente = inf.ide.tpAmb === '1' ? 'producao' : 'homologacao';
  const inicio = ambiente === 'producao' ? '2025-10-06' : '2025-07-01';
  const vigente = dhEmi.slice(0, 10) >= inicio;
  if (!vigente) r.foraDaVigencia++;
  const quando = vigente ? dhEmi : `${inicio}T12:00:00${dhEmi.slice(-6)}`;
  const entrada = entradaDoXml(inf);
  const b = await montarMdfe(entrada, {
    ambiente,
    tempo: contextoDeTempo({ emissao: relogioFixo(quando) }),
    deslocamentoMin: offset,
    verProc: inf.ide.verProc,
    tpEmis: inf.ide.tpEmis as '1' | '2',
  });
  if (!b.ok) {
    if (!vigente && b.ocorrencias.every((i) => /\(F(30|37)a, /.test(i.mensagem))) {
      r.rejeitadosSoPelaDataDeslocada++;
      continue;
    }
    r.rejeitadosPeloBuilder++;
    for (const i of b.ocorrencias) inc(r.ocorrencias, `${i.code} ${semIndice(i.caminho)}`);
    continue;
  }
  r.montados++;
  const montadoEl = primeiroFilho(lerXml(b.valor.xml).raiz, 'infMDFe', MDFE_NS) as ElementoXml;
  if (c14n(montadoEl) === c14n(infEl)) {
    r.identicosC14n++;
    r.identicosNormalizados++;
    continue;
  }
  const d = diferenca(infEl, montadoEl, 'infMDFe', new Set(vigente ? [] : ['cDV', 'dhEmi']));
  if (d === undefined) r.identicosNormalizados++;
  else inc(r.diferencas, d);
}

const outDir = path.join(homedir(), '.local/state/sinete/results');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'mdfe-golden.json'), `${JSON.stringify(r, null, 1)}\n`);
console.log(JSON.stringify(r, null, 1));
