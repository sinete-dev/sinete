import { jsPDF } from "jspdf"; import { danfe } from "../layout/danfe.ts"; import { toJsPdf } from "../backends/others.ts";
export const render = (xml: string) => toJsPdf(danfe(xml), jsPDF);
