import qrcode from "qrcode-generator";
export function qrModules(text: string, ecc: "L" | "M" | "Q" | "H" = "M"): boolean[][] {
  const q = qrcode(0, ecc); q.addData(text, "Byte"); q.make();
  const n = q.getModuleCount(); return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}
