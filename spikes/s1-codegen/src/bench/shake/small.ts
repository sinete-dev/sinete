import { TEndereco } from "../../../generated/PL_010f_v1.04/nfe.ts";
import { serialize } from "../../runtime/serialize.ts";
export const run = (v: TEndereco) => serialize(TEndereco, "enderDest", v, TEndereco.ns);
