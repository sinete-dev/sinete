// calculate() ingênuo, dirigido pelos dados do rtc-data (regime geral, grupo gIBSCBS). Sem monofasia, sem crédito
// presumido, sem Simples, sem alíquota uniforme setorial. Serve de "motor candidato" para o harness diferencial.
// Aritmética: ponto fixo BigInt. Cada expressão é avaliada em escala alta (30) e arredondada para 8 casas no fim,
// como o AvaliadorExpressaoAritmetica da Calculadora (JEXL + BigDecimal, setScale(8, HALF_EVEN)).
export type Rounding = "HALF_EVEN" | "HALF_UP";
const S = 30n, P = 10n ** S;
type X = bigint; // valor * 10^30

function roundTo(v: X, digits: number, mode: Rounding): X {
  const unit = 10n ** (S - BigInt(digits));
  const neg = v < 0n; const a = neg ? -v : v;
  let q = a / unit; const r = a % unit; const twice = 2n * r;
  if (twice > unit || (twice === unit && (mode === "HALF_UP" || q % 2n === 1n))) q += 1n;
  const out = q * unit; return neg ? -out : out;
}
export const X = (s: string | number): X => {
  const str = String(s); const neg = str.startsWith("-");
  const [i, f = ""] = str.replace(/^[-+]/, "").split(".");
  const v = BigInt(i || "0") * P + BigInt((f + "0".repeat(Number(S))).slice(0, Number(S)) || "0");
  return neg ? -v : v;
};
export const fmtX = (v: X, digits: number, mode: Rounding) => {
  const r = roundTo(v, digits, mode); const neg = r < 0n; const a = neg ? -r : r;
  const ip = a / P; const fp = (a % P).toString().padStart(Number(S), "0").slice(0, digits);
  return (neg ? "-" : "") + ip.toString() + (digits ? "." + fp : "");
};
const mul = (a: X, b: X) => (a * b) / P; // truncamento em escala 30: erro < 1e-30, irrelevante para 8 casas
const div = (a: X, b: X) => (a * P) / b;

/** avaliador mínimo de expressões aritméticas (+ - * / parênteses, números, identificadores) */
export function evaluate(expr: string, vars: Record<string, X | null | undefined>): X {
  const toks = expr.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|[()+\-*/]/g) ?? [];
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const prim = (): X => {
    const t = next();
    if (t === "(") { const v = sum(); next(); return v; }
    if (t === "-") return -prim();
    if (/^\d/.test(t!)) return X(t!);
    const v = vars[t!]; if (v === null || v === undefined) throw new Error(`variável sem valor: ${t} em "${expr}"`);
    return v;
  };
  const prod = (): X => { let v = prim(); while (peek() === "*" || peek() === "/") { const op = next(); const r = prim(); v = op === "*" ? mul(v, r) : div(v, r); } return v; };
  const sum = (): X => { let v = prod(); while (peek() === "+" || peek() === "-") { const op = next(); const r = prod(); v = op === "+" ? v + r : v - r; } return v; };
  return roundTo(sum(), 8, "HALF_EVEN");
}

const inForce = (v: any, d: string) => v.from <= d && (!v.to || v.to >= d);

export interface Item { numero: number; cst: string; cClassTrib: string; baseCalculo: string; quantidade: string; ncm?: string; nbs?: string; aliquotasNominais?: { cbs: string; ibsEstadual: string; ibsMunicipal: string } }
export interface Op { date: string; tpDoc: number; compraGov?: boolean; itens: Item[] }
export type EngineOut = { kind: "ok"; itens: any[]; total: any } | { kind: "unsupported"; reason: string };

export function makeEngine(ds: { classTrib: any[]; cst: any[]; treatments: any[]; rates: any }, rounding: Rounding) {
  const TR: Record<string, "cbs" | "ibsEstadual" | "ibsMunicipal"> = { CBS: "cbs", IBSUF: "ibsEstadual", IBSMun: "ibsMunicipal" };
  const out2 = (v: X) => fmtX(v, 2, rounding);
  return function calculate(op: Op): EngineOut {
    const itens: any[] = [];
    const tot = { vBC: 0n, CBS: 0n, IBSUF: 0n, IBSMun: 0n, difCBS: 0n, difIBSUF: 0n, difIBSMun: 0n };
    for (const it of op.itens) {
      const ct = ds.classTrib.find((c) => c.family === "CBS_IBS" && c.code === it.cClassTrib && inForce(c.validity, op.date));
      if (!ct) return { kind: "unsupported", reason: "cClassTrib fora de vigência no dataset" };
      const cst = ds.cst.find((c) => c.family === "CBS_IBS" && c.code === it.cst && inForce(c.validity, op.date));
      const trId = ct.treatments.find((t: any) => inForce(t.validity, op.date))?.treatment;
      const tr = ds.treatments.find((t) => t.id === trId);
      if (!cst || !tr) return { kind: "unsupported", reason: "CST/tratamento ausente" };
      if (tr.flags.possuiMonofasia || cst.groups.gIBSCBSMono) return { kind: "unsupported", reason: "monofasia" };
      if (tr.flags.possuiAjuste) return { kind: "unsupported", reason: "ajuste" };
      if (tr.flags.exigeGrupoTribRegular) return { kind: "unsupported", reason: "tributacao-regular (gTribRegular)" };
      if (ct.rateKind === "Uniforme setorial" || ct.rateKind.startsWith("Alíquotas Combinadas")) return { kind: "unsupported", reason: `tipoAliquota ${ct.rateKind}` };
      if (!cst.groups.gIBSCBS) { itens.push({ numero: it.numero, CST: it.cst, cClassTrib: it.cClassTrib, gIBSCBS: null }); continue; }
      const base = X(it.baseCalculo);
      const g: any = { vBC: null, entes: {} };
      for (const trib of ["IBSUF", "IBSMun", "CBS"] as const) {
        const informed = it.aliquotasNominais?.[TR[trib]];
        let aliq: X;
        if (informed !== undefined) aliq = div(X(informed), X(100));
        else if (ct.rateKind === "Fixa") {
          const f = ct.fixedRates.find((r: any) => r.tributo === trib && inForce(r.validity, op.date));
          if (!f) return { kind: "unsupported", reason: "alíquota fixa ausente" };
          aliq = div(X(f.aliquota), X(100));
        } else if (ct.rateKind === "Sem alíquota") aliq = 0n;
        else {
          const r = ds.rates.referencia.find((r: any) => r.tributo === trib && inForce(r.validity, op.date));
          if (!r) return { kind: "unsupported", reason: `alíquota ${trib} desconhecida em ${op.date}` };
          aliq = div(X(r.aliquota), X(100));
        }
        aliq = roundTo(aliq, 8, "HALF_EVEN");
        const red = ct.reductions.find((r: any) => r.tributo === trib && inForce(r.validity, op.date));
        const pRed = tr.flags.possuiPercentualReducao && red ? roundTo(div(X(red.pRed), X(100)), 8, "HALF_EVEN") : 0n;
        const redutor = ds.rates.redutorCompraGov.find((r: any) => inForce(r.validity, op.date));
        const vars: Record<string, X | null> = { aliquota: aliq, percentualReducao: pRed, pRedutorCompraGov: op.compraGov && redutor ? X(redutor.pRedutor) : 0n, baseCalculoInformada: base, impostoSeletivoInformado: 0n, impostoSeletivoCalculado: 0n, quantidade: X(it.quantidade) };
        const e = tr.expr;
        const aliquota = e.aliquota ? evaluate(e.aliquota, vars) : aliq;
        vars.aliquota = aliquota;
        const efet = e.aliquotaEfetiva ? evaluate(e.aliquotaEfetiva, vars) : aliquota;
        vars.aliquotaEfetiva = efet;
        const bc = (() => { const v = evaluate(e.baseCalculo, vars); return v < 0n ? 0n : v; })();
        vars.baseCalculo = bc;
        let trib$ = evaluate(e.tributoCalculado, vars);
        let pDif: X | null = null, vDif: X | null = null;
        if (e.percentualDiferimento && e.valorDiferimento) {
          vars.tributoCalculado = trib$;
          pDif = evaluate(e.percentualDiferimento, vars); vars.percentualDiferimento = pDif;
          vDif = evaluate(e.valorDiferimento, vars);
          trib$ = trib$ - vDif; if (trib$ < 0n) trib$ = 0n;
        }
        g.vBC = bc;
        g.entes[trib] = { p: aliquota * 100n, pRed: cst.groups.gRed ? pRed * 100n : null, pAliqEfet: cst.groups.gRed ? efet * 100n : null, pDif: cst.groups.gDif && pDif !== null ? pDif * 100n : null, vDif: cst.groups.gDif ? vDif ?? 0n : null, v: trib$ };
        tot[trib] += trib$; if (vDif) tot[("dif" + trib) as "difCBS"] += vDif;
      }
      tot.vBC += g.vBC;
      itens.push({ numero: it.numero, CST: it.cst, cClassTrib: it.cClassTrib, gIBSCBS: g });
    }
    return { kind: "ok", itens, total: tot };
  };
}

/** Regra de aplicabilidade NCM x cClassTrib, reimplementada a partir do dataset (espelha NcmAplicavelService):
 *  sem anexo vigente para o código => 'not-restricted'; senão rejeita quando nenhum vínculo vigente cobre o NCM,
 *  ou quando uma exceção vigente cobre o NCM e não existe vínculo vigente cobrindo o NCM sem nenhuma exceção vigente. */
export function applicableNcm(ncmApp: any[], code: string, ncm: string, date: string): "yes" | "no" | "not-restricted" {
  const rows = ncmApp.filter((a) => a.family === "CBS_IBS" && a.cClassTrib === code && inForce(a.validity, date));
  if (!rows.length) return "not-restricted";
  const cover = rows.filter((a) => ncm.startsWith(a.ncmPrefix));
  if (!cover.length) return "no";
  const exc = cover.some((a) => a.exceptions.some((e: any) => ncm.startsWith(e.ncmPrefix) && inForce(e.validity, date)));
  const clean = cover.some((a) => !a.exceptions.some((e: any) => inForce(e.validity, date)));
  return exc && !clean ? "no" : "yes";
}
