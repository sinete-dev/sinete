import * as lib from "pdf-lib"; import { danfe } from "../layout/danfe.ts"; import { toPdfLib } from "../backends/others.ts";
export const render = (xml: string) => toPdfLib(danfe(xml), lib);
