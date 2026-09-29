// Mensagens SOAP 1.2 mínimas (NF-e 4.00, MDF-e 3.00). Montadas a partir do MOC e dos WSDL oficiais.
const env = (body: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>${body}</soap12:Body></soap12:Envelope>`;

export const ct = (action: string) => `application/soap+xml; charset=utf-8; action="${action}"`;

export function nfeStatus(cUF: string) {
  const ns = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4";
  return {
    body: env(`<nfeDadosMsg xmlns="${ns}"><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>2</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg>`),
    contentType: ct(`${ns}/nfeStatusServicoNF`),
  };
}

export function mdfeStatus() {
  const ns = "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeStatusServico";
  return {
    body: env(`<mdfeDadosMsg xmlns="${ns}"><consStatServMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe"><tpAmb>2</tpAmb><xServ>STATUS</xServ></consStatServMDFe></mdfeDadosMsg>`),
    contentType: ct(`${ns}/mdfeStatusServicoMDF`),
  };
}

export function consultaCadastro(uf: string, cnpj: string) {
  const ns = "http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4";
  return {
    body: env(`<nfeDadosMsg xmlns="${ns}"><ConsCad versao="2.00" xmlns="http://www.portalfiscal.inf.br/nfe"><infCons><xServ>CONS-CAD</xServ><UF>${uf}</UF><CNPJ>${cnpj}</CNPJ></infCons></ConsCad></nfeDadosMsg>`),
    contentType: ct(`${ns}/consultaCadastro`),
  };
}

export function distDFe(cUFAutor: string, cnpj: string) {
  const ns = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";
  return {
    body: env(`<nfeDistDFeInteresse xmlns="${ns}"><nfeDadosMsg><distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>2</tpAmb><cUFAutor>${cUFAutor}</cUFAutor><CNPJ>${cnpj}</CNPJ><distNSU><ultNSU>000000000000000</ultNSU></distNSU></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse>`),
    contentType: ct(`${ns}/nfeDistDFeInteresse`),
  };
}

export function autorizacao(enviNFe: string) {
  const ns = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4";
  return { body: env(`<nfeDadosMsg xmlns="${ns}">${enviNFe}</nfeDadosMsg>`), contentType: ct(`${ns}/nfeAutorizacaoLote`) };
}

export const pick = (xml: string, tag: string) => new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`).exec(xml)?.[1] ?? null;
export const pickAll = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`, "g"))].map((m) => m[1]);
