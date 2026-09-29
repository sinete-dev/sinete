// Operação permitida 5 (parte 2): UMA emissão de DPS na Sefin Nacional, produção restrita (tpAmb=2),
// porque o convênio de São Paulo (3550308) respondeu aderenteEmissorNacional=1.
// Leiaute: esquemas XSD NFS-e v1.01 (gov.br, pacote 2026-02-09). Assinatura: signer do S3 (RSA-SHA1, C14N 1.0).
// Uso: node nfse-dps.ts (dry-run) | node nfse-dps.ts --send
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { signXml, verifyDocument, webCryptoSigner } from "../../s3-xmldsig/src/dsig.ts";
import { loadCert } from "./cert.ts";
import { assertAllowed } from "./guard.ts";
import { send } from "./transport.ts";

const SEND = process.argv.includes("--send");
const HERE = new URL(".", import.meta.url).pathname;
const RES = `${HERE}results`;
mkdirSync(RES, { recursive: true });
const ATT = `${RES}/dps-attempts.json`;
const attempts: any[] = existsSync(ATT) ? JSON.parse(readFileSync(ATT, "utf8")) : [];
// Limite: 1ª tentativa (E1229) + a corrigida + no máximo 1 correção de formato = 3 no total.
if (SEND && attempts.length >= 3) throw new Error("limite de tentativas de DPS atingido");

const NS = "http://www.sped.fazenda.gov.br/nfse";
const CNPJ = "59554465000137";
const cMun = "3550308";
const URL_NFSE = "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse";

const now = new Date(Date.now() - 60_000); // 1 min no passado: dhEmi não pode ser futuro
const brt = new Date(now.getTime() - 3 * 3600_000);
const p2 = (n: number) => String(n).padStart(2, "0");
const d = `${brt.getUTCFullYear()}-${p2(brt.getUTCMonth() + 1)}-${p2(brt.getUTCDate())}`;
const dhEmi = `${d}T${p2(brt.getUTCHours())}:${p2(brt.getUTCMinutes())}:${p2(brt.getUTCSeconds())}-03:00`;
const serie = "1";
const nDPS = "1";
const Id = `DPS${cMun}2${CNPJ}${serie.padStart(5, "0")}${nDPS.padStart(15, "0")}`;
if (!/^DPS[0-9]{42}$/.test(Id)) throw new Error(`Id inválido ${Id}`);

// Prestador = emitente (tpEmit=1): nome e endereço vêm do cadastro nacional e não são informados.
// Sem tomador: o schema permite; evita usar CNPJ/CPF de terceiros.
const infDPS =
  `<infDPS Id="${Id}">` +
  `<tpAmb>2</tpAmb><dhEmi>${dhEmi}</dhEmi><verAplic>sinete-spike-s2</verAplic><serie>${serie}</serie><nDPS>${nDPS}</nDPS><dCompet>${d}</dCompet><tpEmit>1</tpEmit><cLocEmi>${cMun}</cLocEmi>` +
  `<prest><CNPJ>${CNPJ}</CNPJ><regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>` +
  `<serv><locPrest><cLocPrestacao>${cMun}</cLocPrestacao></locPrest><cServ><cTribNac>010101</cTribNac><xDescServ>SERVICO DE TESTE EMITIDO EM PRODUCAO RESTRITA - SEM VALOR FISCAL</xDescServ></cServ></serv>` +
  `<valores><vServPrest><vServ>1.00</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun><totTrib><indTotTrib>0</indTotTrib></totTrib></trib></valores>` +
  `</infDPS>`;
const unsigned = `<DPS xmlns="${NS}" versao="1.01">${infDPS}</DPS>`;
assertAllowed(URL_NFSE, unsigned); // tpAmb do DPS em claro, antes do gzip

const cert = loadCert();
const signed = await signXml(unsigned, Id, await webCryptoSigner(cert.pkcs8Der, cert.leafDer));
const ver = await verifyDocument(signed);
if (!ver.length || !ver.every((v) => v.ok)) throw new Error(`verificador do S3 recusou: ${JSON.stringify(ver)}`);
// O XSD oficial v1.01 tem pattern "^0{0,4}\\d{1,5}$" em TSSerieDPS; em regex XSD ^ e $ são literais, então
// nenhuma série valida no xmllint. Validamos contra cópia com só essa âncora removida (nfse-xsd/patched).
const xsd = `${HERE}nfse-xsd/patched/DPS_v1.01.xsd`;
const xl = spawnSync("xmllint", ["--noout", "--schema", xsd, "-"], { input: signed, encoding: "utf8" });
console.log(`Id ${Id} | S3 verifica ok | xmllint: ${xl.stderr.trim().split("\n").slice(-3).join(" / ")}`);
if (xl.status !== 0) throw new Error("XSD DPS v1.01 recusou; não envia");
writeFileSync(`${RES}/dps-${Id}-assinada.xml`, signed);
if (!SEND) {
  console.log("dry-run: não enviado");
  process.exit(0);
}

// Correção do E1229: declaração XML UTF-8 na frente. Fica fora do elemento assinado; a assinatura não muda.
const doc = `<?xml version="1.0" encoding="UTF-8"?>${signed}`;
const body = JSON.stringify({ dpsXmlGZipB64: gzipSync(Buffer.from(doc, "utf8")).toString("base64") });
const r = await send(cert, { url: URL_NFSE, method: "POST", body, contentType: "application/json", service: "NFS-e POST /nfse (DPS, produção restrita)" });
let json: any = null;
try {
  json = JSON.parse(r.body);
} catch {}
let nfseResumo: any = null;
if (json?.nfseXmlGZipB64) {
  const x = gunzipSync(Buffer.from(json.nfseXmlGZipB64, "base64")).toString("utf8");
  nfseResumo = { chaveAcesso: json.chaveAcesso ?? null, nNFSe: /<nNFSe>([^<]*)</.exec(x)?.[1], cStat: /<cStat>([^<]*)</.exec(x)?.[1], tpAmb: /<ambGer>([^<]*)</.exec(x)?.[1] };
  writeFileSync(`${RES}/nfse-${json.chaveAcesso ?? Id}.xml`, x);
}
const rec = { at: new Date().toISOString(), Id, http: r.status, error: r.error ?? null, tls: r.tls ?? null, erros: json?.erros ?? json?.erro ?? null, alertas: json?.alertas ?? null, nfse: nfseResumo, raw: json ? undefined : r.body.slice(0, 500) };
attempts.push(rec);
writeFileSync(ATT, `${JSON.stringify(attempts, null, 2)}\n`);
console.log(JSON.stringify(rec, null, 2));
