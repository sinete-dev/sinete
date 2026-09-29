// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { DanfeErrorCode, Doc, FitStats, Op, Page } from '@sinete/da';
import type { DanfeOptions, FormatoDanfe } from '@sinete/da/nfe';
import { dacce } from '@sinete/da/cce';
import type { DamdfeOptions } from '@sinete/da/mdfe';
import { damdfe } from '@sinete/da/mdfe';
import type { DanfceOptions } from '@sinete/da/nfce';
import { danfce } from '@sinete/da/nfce';
import { danfe } from '@sinete/da/nfe';
import type { DanfseOptions } from '@sinete/da/nfse';
import { danfse } from '@sinete/da/nfse';
import { toHtml, toPdf, toSvg } from '@sinete/da';

const opts: DanfeOptions = { formato: 'paisagem', canhoto: false, ibsCbs: true, largura: 80, cancelamento: true };
const doc: Doc = danfe('<nfeProc/>', opts);
const page: Page | undefined = doc.pages[0];
const ops: readonly Op[] = page?.ops ?? [];
const pdf: Uint8Array = toPdf(doc, { compress: false });
const html: string = toHtml(doc);
const svg: string = page ? toSvg(page, doc) : '';
const stats: FitStats = doc.stats;
const f: FormatoDanfe = 'simplificado-tipo2';
const code: DanfeErrorCode = 'campo_ausente';
const m: Doc = damdfe('<mdfeProc/>', { documentos: true, cancelado: false });
const c: Doc = dacce('<procEventoNFe/>', { nfe: '<nfeProc/>' });
const nfceOpts: DanfceOptions = { largura: 58, cancelamento: true };
const nc: Doc = danfce('<nfeProc/>', nfceOpts);
const mOpts: DamdfeOptions = { documentos: false };
const sOpts: DanfseOptions = { cancelamento: true, canhoto: false, nomeMunicipio: (c) => (c ? undefined : '') };
const ns: Doc = danfse('<NFSe/>', sOpts);
// @ts-expect-error formato fora da lista
const bad: FormatoDanfe = 'a5';
void [ops, pdf, html, svg, stats, f, code, m, c, nc, mOpts, ns, bad];
