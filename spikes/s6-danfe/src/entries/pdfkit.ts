import PDFKit from "pdfkit"; import { danfe } from "../layout/danfe.ts"; import { toPdfKit } from "../backends/others.ts";
export const render = (xml: string) => toPdfKit(danfe(xml), PDFKit);
