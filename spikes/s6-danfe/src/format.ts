// Formatação pt-BR determinística (sem Intl, cujo resultado varia entre runtimes e versões de ICU).
export function num(v: unknown, minDec = 2, maxDec = minDec): string {
  if (v === undefined || v === null || v === "") return "";
  let s = String(v); const neg = s.startsWith("-"); if (neg) s = s.slice(1);
  let [i, d = ""] = s.split(".");
  if (d.length > maxDec) { // arredonda em string
    const n = BigInt(i + d.slice(0, maxDec)) + (Number(d[maxDec]) >= 5 ? 1n : 0n);
    const t = n.toString().padStart(maxDec + 1, "0"); i = t.slice(0, t.length - maxDec); d = t.slice(t.length - maxDec);
  }
  d = d.padEnd(minDec, "0"); while (d.length > minDec && d.endsWith("0")) d = d.slice(0, -1);
  i = i.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + i + (d ? "," + d : "");
}
export const cnpjCpf = (v?: string) => !v ? "" : v.length === 14 && /^\d+$/.test(v) ? v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v.length === 11 ? v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : v;
export const cep = (v?: string) => (v && v.length === 8 ? `${v.slice(0, 5)}-${v.slice(5)}` : v ?? "");
export const fone = (v?: string) => !v ? "" : v.length === 10 ? `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}` : v.length === 11 ? `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}` : v;
// data e hora como vieram no XML (fuso do emitente), sem converter
export const data = (dh?: string) => (dh ? `${dh.slice(8, 10)}/${dh.slice(5, 7)}/${dh.slice(0, 4)}` : "");
export const hora = (dh?: string) => (dh && dh.length >= 19 ? dh.slice(11, 19) : "");
export const chave = (c: string) => c.replace(/(\d{4})(?=\d)/g, "$1 ");
export const nNF = (n: string) => n.padStart(9, "0").replace(/^(\d{3})(\d{3})(\d{3})$/, "$1.$2.$3");
