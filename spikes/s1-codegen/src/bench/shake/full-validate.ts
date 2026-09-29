import { TNFe } from "../../../generated/PL_010f_v1.04/nfe.ts";
import { serialize } from "../../runtime/serialize.ts";
import { decode } from "../../runtime/decode.ts";
import { validateTree } from "../../runtime/validate.ts";
import { parseXml } from "../../runtime/xml.ts";
export const run = (x: string) => { const t = parseXml(x); return [validateTree(TNFe, t), serialize(TNFe, "NFe", decode(TNFe, t))]; };
