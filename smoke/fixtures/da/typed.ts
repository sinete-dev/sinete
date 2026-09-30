// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { CodigoErroDa, Documento, EstatisticasDeEncaixe, Op, Pagina } from '@sinete/da';
import type { DanfeOpcoes, FormatoDanfe } from '@sinete/da/nfe';
import { dacce } from '@sinete/da/cce';
import type { DamdfeOpcoes } from '@sinete/da/mdfe';
import { damdfe } from '@sinete/da/mdfe';
import type { DanfceOpcoes } from '@sinete/da/nfce';
import { danfce } from '@sinete/da/nfce';
import { danfe } from '@sinete/da/nfe';
import type { DanfseOpcoes } from '@sinete/da/nfse';
import { danfse } from '@sinete/da/nfse';
import { gerarHtml, gerarPdf, gerarSvg } from '@sinete/da';

const opts: DanfeOpcoes = { formato: 'paisagem', canhoto: false, ibsCbs: true, largura: 80, cancelamento: true };
const doc: Documento = danfe('<nfeProc/>', opts);
const page: Pagina | undefined = doc.paginas[0];
const ops: readonly Op[] = page?.ops ?? [];
const pdf: Uint8Array = gerarPdf(doc, { comprimir: false });
const html: string = gerarHtml(doc);
const svg: string = page ? gerarSvg(page, doc) : '';
const stats: EstatisticasDeEncaixe = doc.estatisticas;
const f: FormatoDanfe = 'simplificado-tipo2';
const code: CodigoErroDa = 'campo_ausente';
const m: Documento = damdfe('<mdfeProc/>', { documentos: true, cancelado: false });
const c: Documento = dacce('<procEventoNFe/>', { nfe: '<nfeProc/>' });
const nfceOpts: DanfceOpcoes = { largura: 58, cancelamento: true };
const nc: Documento = danfce('<nfeProc/>', nfceOpts);
const mOpts: DamdfeOpcoes = { documentos: false };
const sOpts: DanfseOpcoes = { cancelamento: true, canhoto: false, nomeMunicipio: (c) => (c ? undefined : '') };
const ns: Documento = danfse('<NFSe/>', sOpts);
// @ts-expect-error formato fora da lista
const bad: FormatoDanfe = 'a5';
void [ops, pdf, html, svg, stats, f, code, m, c, nc, mOpts, ns, bad];
