/**
 * Conteúdo comparável de um documento assinado, para a barreira da recusa repetida (`RecusaRepetidaOpcoes`): o XML sem
 * os elementos que mudam sozinhos entre duas montagens da mesma nota. Só serve para comparar; o XML enviado nunca passa
 * por aqui.
 */

/** Tira do XML os elementos (com o conteúdo) e o atributo `Id` do grupo principal. */
export function semCampos(xml: string, elementos: readonly string[], grupo: string): string {
  let out = xml;
  for (const e of elementos) {
    out = out.replace(new RegExp(`<(?:[\\w-]+:)?${e}\\b[^>]*?(?:/>|>[\\s\\S]*?</(?:[\\w-]+:)?${e}>)`, 'g'), '');
  }
  return out.replace(new RegExp(`(<(?:[\\w-]+:)?${grupo}\\b[^>]*?)\\sId="[^"]*"`), '$1');
}

/**
 * NF-e e NFC-e: data e hora de emissão e de saída, código numérico e dígito da chave (e com eles o `Id` e o `hashCSRT`,
 * que saem da chave), assinatura e o grupo suplementar do QR Code.
 */
export const conteudoNfe = (xml: string): string =>
  semCampos(xml, ['Signature', 'infNFeSupl', 'dhEmi', 'dhSaiEnt', 'cNF', 'cDV', 'hashCSRT'], 'infNFe');

/** MDF-e: data e hora de emissão, código numérico e dígito da chave, assinatura e o grupo suplementar. */
export const conteudoMdfe = (xml: string): string =>
  semCampos(xml, ['Signature', 'infMDFeSupl', 'dhEmi', 'cMDF', 'cDV'], 'infMDFe');

/** DPS da NFS-e: data e hora de emissão e assinatura (o `Id` sai da série e do número, que não mudam sozinhos). */
export const conteudoDps = (xml: string): string => semCampos(xml, ['Signature', 'dhEmi'], '__sem_grupo__');
