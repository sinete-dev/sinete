// Assina a amostra local (.local/amostra-nfe.xml) com o cert autoassinado, nos dois modos de Signer,
// confere invariantes de string e verifica com o verificador próprio.
// Uso: <runtime> bench/sign.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { privateEncrypt, constants, createPrivateKey } from 'node:crypto';
import { signXml, verifyDocument, webCryptoSigner, type Signer } from '../src/dsig.ts';

const runtime = 'Deno' in globalThis ? 'deno' : 'Bun' in globalThis ? 'bun' : 'node';
const xml = readFileSync('.local/amostra-nfe.xml', 'utf8');
const id = readFileSync('.local/amostra-id.txt', 'utf8').trim();
const certDer = new Uint8Array(readFileSync('.local/cert.der'));
const pk8 = new Uint8Array(readFileSync('.local/key.pk8.der'));

// modo 'data': WebCrypto RSASSA-PKCS1-v1_5 + SHA-1
const t0 = performance.now();
const a = await signXml(xml, id, await webCryptoSigner(pk8, certDer));
const t1 = performance.now();

// modo 'digest': simula PKCS#11 CKM_RSA_PKCS / HSM remoto (RSA cru sobre o DigestInfo)
const keyObj = createPrivateKey({ key: Buffer.from(pk8), format: 'der', type: 'pkcs8' });
const digestSigner: Signer = {
  kind: 'digest',
  certificateDer: async () => certDer,
  signDigestInfo: async (di) => new Uint8Array(privateEncrypt({ key: keyObj, padding: constants.RSA_PKCS1_PADDING }, di)),
};
const b = await signXml(xml, id, digestSigner);

// invariante: a saída é a entrada com uma única inserção (nada reserializado)
const ins = a.indexOf('<Signature ');
const untouched = a.slice(0, ins) + a.slice(a.indexOf('</Signature>') + '</Signature>'.length) === xml;

const va = await verifyDocument(a);
const vb = await verifyDocument(b);
writeFileSync(`.local/assinada-${runtime}.xml`, a);
// cenário nfeProc: SEFAZ/ERP embrulha a NFe assinada por splice, sem reserializar
const body = a.replace(/^<\?xml[^>]*\?>/, '');
const proc = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${body}<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb></infProt></protNFe></nfeProc>`;
const procXsi = proc.replace('<nfeProc ', '<nfeProc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ');
writeFileSync(`.local/assinada-proc-${runtime}.xml`, proc);
writeFileSync(`.local/assinada-proc-xsi-${runtime}.xml`, procXsi);
console.log(JSON.stringify({
  runtime,
  msAssinar: +(t1 - t0).toFixed(2),
  saidaIgualEntradaMaisInsercao: untouched,
  modosDataEDigestIdenticos: a === b,
  verificaData: va.map((r) => r.ok),
  verificaDigest: vb.map((r) => r.ok),
  verificaDentroDeNfeProc: (await verifyDocument(proc)).map((r) => r.ok),
  verificaNfeProcComXsiNoAncestral: (await verifyDocument(procXsi)).map((r) => r.failure ?? r.ok),
  signatureValueB64Prefix: a.match(/<SignatureValue>(.{16})/)![1],
}));
