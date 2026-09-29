// Alvos da rodada S4 (NF-e homologação, só NfeStatusServico). Lista fechada, igual à guarda do helper.
import { readFileSync } from "node:fs";
import { nfeStatus, pick } from "../../s2-tls/real/soap.ts";

export const S2 = new URL("../../s2-tls/", import.meta.url).pathname;
export const ROOT = new URL("../", import.meta.url).pathname;
const ep = JSON.parse(readFileSync(`${S2}endpoints.json`, "utf8"));
const hom = ep.nfe.homologacao.authorizers;
const strip = (u: string) => u.replace(/\?wsdl$/i, "");

export const TARGETS = (
  [
    ["SP", "35", "renegociação"],
    ["SVRS", "42", "cert no handshake, opcional (403); anuncia PSS"],
    ["BA", "29", "renegociação"],
    ["GO", "52", "aborta sem cert (após a requisição)"],
    ["MG", "31", "aborta sem cert"],
    ["PR", "41", "aborta sem cert; só CBC"],
  ] as const
).map(([uf, cUF, note]) => ({ uf, cUF, note, url: strip(hom[uf].NfeStatusServico.url), host: new URL(hom[uf].NfeStatusServico.url).hostname }));

export function statusRequest(cUF: string) {
  const m = nfeStatus(cUF);
  return { method: "POST", headers: { "content-type": m.contentType }, body: Buffer.from(m.body).toString("base64"), service: "NfeStatusServico" };
}

export const cStat = (b64: string) => {
  const x = Buffer.from(b64, "base64").toString("utf8");
  return { cStat: pick(x, "cStat"), xMotivo: pick(x, "xMotivo"), head: pick(x, "cStat") ? undefined : x.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 120) };
};
