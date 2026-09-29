// Gera tabelas de largura (WinAnsi 0..255, em 1/1000 em) das fontes padrão do PDF a partir dos AFM da Adobe
// empacotados em @pdf-lib/standard-fonts (MIT). Saída: src/metrics-data.ts
import { Font, FontNames, Encodings } from "@pdf-lib/standard-fonts";
const names = { "Times-Roman": FontNames.TimesRoman, "Times-Bold": FontNames.TimesRomanBold, Helvetica: FontNames.Helvetica, "Helvetica-Bold": FontNames.HelveticaBold, Courier: FontNames.Courier } as const;
// mapa unicode -> código WinAnsi
const uni2code: Record<number, number> = {};
for (let cp = 0; cp < 0x10000; cp++) { if (Encodings.WinAnsi.canEncodeUnicodeCodePoint(cp)) uni2code[cp] = Encodings.WinAnsi.encodeUnicodeCodePoint(cp).code; }
let out = `// gerado por src/gen/metrics.ts; larguras AFM (Adobe Core14) em 1/1000 em, indexadas pelo código WinAnsi\n`;
out += `export const WINANSI_EXTRA: Record<number, number> = ${JSON.stringify(Object.fromEntries(Object.entries(uni2code).filter(([u, c]) => Number(u) !== c)))};\n`;
out += `export const WIDTHS: Record<string, number[]> = {\n`;
for (const [k, n] of Object.entries(names)) {
  const f = Font.load(n); const w: number[] = [];
  for (let c = 0; c < 256; c++) { const u = Number(Object.keys(uni2code).find((x) => uni2code[Number(x)] === c) ?? -1); w.push(u < 0 ? 0 : f.getWidthOfGlyph(Encodings.WinAnsi.encodeUnicodeCodePoint(u).name) ?? 0); }
  out += `  "${k}": ${JSON.stringify(w)},\n`;
}
out += `};\nexport const ASCENT: Record<string, number> = { "Times-Roman": 683, "Times-Bold": 676, Helvetica: 718, "Helvetica-Bold": 718, Courier: 629 };\n`;
await Bun.write("src/metrics-data.ts", out);
console.log("ok", (out.length / 1024).toFixed(1), "KB");
