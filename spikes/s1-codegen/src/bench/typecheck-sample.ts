// Compile-time check of the generated types (choice exclusivity, enums). Values are synthetic.
import type { TNFe_infNFe_dest, TNFe_infNFe_ide } from "../../generated/PL_010f_v1.04/nfe.ts";

export const okCnpj: Pick<TNFe_infNFe_dest, "CNPJ" | "indIEDest"> & TNFe_infNFe_dest = { CNPJ: "00000000000191", indIEDest: "9" };
// @ts-expect-error CNPJ and CPF are a choice: both at once must not type-check
export const bothIds: TNFe_infNFe_dest = { CNPJ: "00000000000191", CPF: "00000000000", indIEDest: "9" };
// @ts-expect-error indIEDest is an enumeration
export const badEnum: TNFe_infNFe_dest = { CPF: "00000000000", indIEDest: "3" };
export const tpAmb: TNFe_infNFe_ide["tpAmb"] = "2";
