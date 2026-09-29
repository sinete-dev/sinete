// Operação permitida 4: UMA tentativa de autorização de NF-e em SEFAZ-SP homologação (máx. 3 no total).
// Monta com o codec do S1 (PL_010f), assina com o signer do S3 (string final, sem reserializar),
// valida com o XSD oficial (xmllint) e com o verificador do S3, e só então envia.
// Uso: node nfe-autorizacao.ts            (dry-run: monta, assina, valida; não envia)
//      node nfe-autorizacao.ts --send     (idem e envia uma vez)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as nfe from "../../s1-codegen/generated/PL_010f_v1.04/nfe.ts";
import { parseXml } from "../../s1-codegen/src/runtime/xml.ts";
import { serialize } from "../../s1-codegen/src/runtime/serialize.ts";
import { validateTree } from "../../s1-codegen/src/runtime/validate.ts";
import { signXml, verifyDocument, webCryptoSigner } from "../../s3-xmldsig/src/dsig.ts";
import { loadCert } from "./cert.ts";
import { autorizacao, pick } from "./soap.ts";
import { send } from "./transport.ts";

const SEND = process.argv.includes("--send");
const HERE = new URL(".", import.meta.url).pathname;
const RES = `${HERE}results`;
mkdirSync(RES, { recursive: true });
const ATTEMPTS = `${RES}/autorizacao-attempts.json`;
const attempts: any[] = existsSync(ATTEMPTS) ? JSON.parse(readFileSync(ATTEMPTS, "utf8")) : [];
if (SEND && attempts.length >= 3) throw new Error("limite de 3 tentativas de autorização atingido");

const NS = "http://www.portalfiscal.inf.br/nfe";
const CNPJ = "59554465000137";
const URL_AUT = "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx";

// ---- chave de acesso ----
function mod11(s: string) {
  let sum = 0;
  let w = 2;
  for (let i = s.length - 1; i >= 0; i--) {
    sum += Number(s[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}
const now = new Date();
const brt = new Date(now.getTime() - 3 * 3600_000);
const pad = (n: number, l = 2) => String(n).padStart(l, "0");
const dhEmi = `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}T${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}:${pad(brt.getUTCSeconds())}-03:00`;
const AAMM = `${pad(brt.getUTCFullYear() % 100)}${pad(brt.getUTCMonth() + 1)}`;
const serie = "1";
const nNF = String(attempts.length + 1);
const cNF = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
const base43 = `35${AAMM}${CNPJ}55${serie.padStart(3, "0")}${nNF.padStart(9, "0")}1${cNF}`;
const cDV = String(mod11(base43));
const chave = base43 + cDV;
const Id = `NFe${chave}`;

const ender = { xLgr: "AVENIDA BRIGADEIRO FARIA LIMA", nro: "1811", xCpl: "CONJ 115", xBairro: "JARDIM PAULISTANO", cMun: "3550308", xMun: "SAO PAULO", UF: "SP", CEP: "01452001", cPais: "1058", xPais: "BRASIL" };

const infNFe: nfe.TNFe_infNFe = {
  versao: "4.00",
  Id,
  ide: {
    cUF: "35", cNF, natOp: "VENDA DE MERCADORIA", mod: "55", serie, nNF, dhEmi, tpNF: "1", idDest: "1", cMunFG: "3550308",
    tpImp: "1", tpEmis: "1", cDV, tpAmb: "2", finNFe: "1", indFinal: "1", indPres: "1", procEmi: "0", verProc: "sinete-spike-s2",
  },
  // Sem IE: a empresa não tem inscrição estadual (IE é opcional no XSD do PL_010f).
  emit: { CNPJ, xNome: "FAZER.AI LTDA", enderEmit: ender, CRT: "1" },
  dest: { CNPJ, xNome: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL", enderDest: ender, indIEDest: "9" },
  det: [
    {
      nItem: "1",
      prod: {
        cProd: "1", cEAN: "SEM GTIN", xProd: "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL", NCM: "49119900", CFOP: "5102",
        uCom: "UN", qCom: "1.0000", vUnCom: "1.00", vProd: "1.00", cEANTrib: "SEM GTIN", uTrib: "UN", qTrib: "1.0000", vUnTrib: "1.00", indTot: "1",
      },
      imposto: {
        ICMS: { ICMSSN102: { orig: "0", CSOSN: "102" } },
        PIS: { PISOutr: { CST: "49", vBC: "0.00", pPIS: "0.0000", vPIS: "0.00" } },
        COFINS: { COFINSOutr: { CST: "49", vBC: "0.00", pCOFINS: "0.0000", vCOFINS: "0.00" } },
      },
    },
  ],
  total: {
    ICMSTot: {
      vBC: "0.00", vICMS: "0.00", vICMSDeson: "0.00", vFCP: "0.00", vBCST: "0.00", vST: "0.00", vFCPST: "0.00", vFCPSTRet: "0.00", vProd: "1.00",
      vFrete: "0.00", vSeg: "0.00", vDesc: "0.00", vII: "0.00", vIPI: "0.00", vIPIDevol: "0.00", vPIS: "0.00", vCOFINS: "0.00", vOutro: "0.00", vNF: "1.00",
    },
  },
  transp: { modFrete: "9" },
  pag: { detPag: [{ indPag: "0", tPag: "01", vPag: "1.00" }] },
} as nfe.TNFe_infNFe;

const infXml = serialize(nfe.TNFe_infNFe, "infNFe", infNFe, NS);
const vIssues = validateTree(nfe.TNFe_infNFe, parseXml(`<infNFe xmlns="${NS}"${infXml.slice("<infNFe".length)}`));
if (vIssues.length) {
  console.log("validador do S1:", JSON.stringify(vIssues.slice(0, 10)));
  throw new Error("NF-e inválida pelo validador do S1");
}
const unsigned = `<NFe xmlns="${NS}">${infXml}</NFe>`;

const cert = loadCert();
const signer = await webCryptoSigner(cert.pkcs8Der, cert.leafDer);
const signed = await signXml(unsigned, Id, signer);
if (signed.length <= unsigned.length || !signed.startsWith(unsigned.slice(0, unsigned.indexOf("</infNFe>")))) throw new Error("assinatura alterou o conteúdo");
const ver = await verifyDocument(signed);
if (!ver.length || !ver.every((v) => v.ok)) throw new Error(`verificador do S3 recusou: ${JSON.stringify(ver)}`);

// XSD oficial via xmllint (stdin; o XML assinado só tem certificado público)
const xsd = `${HERE}../../s1-codegen/xsd/PL_010f_v1.04/nfe_v4.00.xsd`;
const xl = spawnSync("xmllint", ["--noout", "--schema", xsd, "-"], { input: signed, encoding: "utf8" });
const xsdOk = xl.status === 0;
console.log(`chave ${chave} | S1 ok | S3 verifica ok | xmllint: ${xl.stderr.trim().split("\n").slice(-3).join(" / ")}`);
if (!xsdOk) throw new Error("XSD oficial recusou; não envia");

const idLote = String(Date.now()).padStart(15, "0").slice(-15);
const envi = `<enviNFe xmlns="${NS}" versao="4.00"><idLote>${idLote}</idLote><indSinc>1</indSinc>${signed}</enviNFe>`;
writeFileSync(`${RES}/nfe-${chave}-assinada.xml`, signed);
if (!SEND) {
  console.log("dry-run: não enviado");
  process.exit(0);
}

const msg = autorizacao(envi);
const r = await send(cert, { url: URL_AUT, body: msg.body, contentType: msg.contentType, service: "NFeAutorizacao4 (SP hom)" });
const rec = {
  at: new Date().toISOString(),
  chave,
  http: r.status,
  error: r.error ?? null,
  lote: { cStat: pick(r.body, "cStat"), xMotivo: pick(r.body, "xMotivo") },
  prot: /<infProt/.test(r.body)
    ? { cStat: [...r.body.matchAll(/<cStat>(\d+)<\/cStat>/g)].map((m) => m[1]), xMotivo: [...r.body.matchAll(/<xMotivo>([^<]*)<\/xMotivo>/g)].map((m) => m[1]), nProt: pick(r.body, "nProt"), dhRecbto: pick(r.body, "dhRecbto") }
    : null,
  tls: r.tls ?? null,
  fault: /Fault/.test(r.body) ? r.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300) : null,
};
attempts.push(rec);
writeFileSync(ATTEMPTS, `${JSON.stringify(attempts, null, 2)}\n`);
writeFileSync(`${RES}/nfe-${chave}-retorno.xml`, r.body);
console.log(JSON.stringify(rec, null, 2));
