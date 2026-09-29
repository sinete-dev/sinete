import { TNFe as A } from "../../../generated/PL_010f_v1.04/nfe.ts";
import { TNFe as B } from "../../../generated/PL_010e_v1.02/nfe.ts";
import { serialize } from "../../runtime/serialize.ts";
export const run = (v: any, nt: boolean) => serialize(nt ? A : B, "NFe", v);
