/**
 * Formatação pt-BR determinística, feita em string a partir da forma lexical do XML. Sem `Intl` (o resultado varia
 * entre runtimes e versões do ICU) e sem `Date` (as datas saem como vieram no XML, no fuso do emitente).
 */

/**
 * Número decimal do XML (`'1234.5'`) em pt-BR (`'1.234,50'`): milhar com ponto, decimais com vírgula, entre
 * `minDec` e `maxDec` casas. Arredonda metade para cima, em string (sem passar por ponto flutuante).
 */
export function num(v: string | undefined, minDec = 2, maxDec: number = minDec): string {
  if (v === undefined || v.trim() === '') return '';
  let s = v.trim();
  const neg = s.startsWith('-');
  if (neg || s.startsWith('+')) s = s.slice(1);
  if (!/^\d*(\.\d*)?$/.test(s)) return v.trim();
  let [i = '', d = ''] = s.split('.');
  if (i === '') i = '0';
  if (d.length > maxDec) {
    const up = Number(d[maxDec]) >= 5;
    const n = BigInt(i + d.slice(0, maxDec)) + (up ? 1n : 0n);
    const t = n.toString().padStart(maxDec + 1, '0');
    i = t.slice(0, t.length - maxDec);
    d = t.slice(t.length - maxDec);
  }
  d = d.padEnd(minDec, '0');
  while (d.length > minDec && d.endsWith('0')) d = d.slice(0, -1);
  i = i.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const out = i + (d ? `,${d}` : '');
  return neg && /[1-9]/.test(out) ? `-${out}` : out;
}

/** Valor decimal do XML é maior que zero. */
export function positivo(v: string | undefined): boolean {
  if (v === undefined) return false;
  const s = v.trim();
  return !s.startsWith('-') && /[1-9]/.test(s);
}

/** Soma decimais do XML em centavos exatos (duas casas), para totais derivados como os acréscimos. */
export function soma2(...vs: (string | undefined)[]): string {
  let cents = 0n;
  for (const v of vs) {
    if (!v) continue;
    const s = v.trim();
    const neg = s.startsWith('-');
    const [i = '0', d = ''] = s.replace(/^[-+]/, '').split('.');
    const c = BigInt((i || '0') + d.padEnd(2, '0').slice(0, 2));
    cents += neg ? -c : c;
  }
  const neg = cents < 0n;
  const a = (neg ? -cents : cents).toString().padStart(3, '0');
  return `${neg ? '-' : ''}${a.slice(0, -2)}.${a.slice(-2)}`;
}

/** CNPJ numérico ou alfanumérico (NT 2026.004), CPF, ou o valor como veio. */
export function cnpjCpf(v: string | undefined): string {
  if (!v) return '';
  if (/^[0-9A-Z]{12}\d{2}$/.test(v))
    return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  if (/^\d{11}$/.test(v)) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  return v;
}

export function cep(v: string | undefined): string {
  return v && /^\d{8}$/.test(v) ? `${v.slice(0, 5)}-${v.slice(5)}` : (v ?? '');
}

export function fone(v: string | undefined): string {
  if (!v) return '';
  if (/^\d{10}$/.test(v)) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  if (/^\d{11}$/.test(v)) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  return v;
}

/** Data de um `dhEmi`/`dEmi` do XML (`AAAA-MM-DD...`) em `DD/MM/AAAA`, no fuso em que veio. */
export function data(dh: string | undefined): string {
  return dh && /^\d{4}-\d{2}-\d{2}/.test(dh) ? `${dh.slice(8, 10)}/${dh.slice(5, 7)}/${dh.slice(0, 4)}` : '';
}

/** Hora de um `dhEmi` do XML (`...Thh:mm:ss`), no fuso em que veio. */
export function hora(dh: string | undefined): string {
  return dh && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dh) ? dh.slice(11, 19) : '';
}

export function dataHora(dh: string | undefined): string {
  return [data(dh), hora(dh)].filter(Boolean).join(' ');
}

/** Chave de acesso em blocos de quatro (MOC 7.0, Anexo II, 3.1.1). */
export function chave(c: string): string {
  return c.replace(/(.{4})(?=.)/g, '$1 ');
}

/** Número do documento com nove dígitos em grupos de três: `000.001.234`. */
export function numero(n: string | undefined): string {
  const s = (n ?? '').padStart(9, '0');
  return /^\d{9}$/.test(s) ? `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}` : s;
}

export function serie(s: string | undefined): string {
  return (s ?? '').padStart(3, '0');
}
