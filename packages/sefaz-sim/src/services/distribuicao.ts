/**
 * Distribuição de DF-e de interesse do Ambiente Nacional (MOC 7.0 Visão Geral, item 5.7): NSU sequencial e sem
 * lacunas por CNPJ/CPF interessado, lotes de até 50 documentos compactados em gzip e base64 no `docZip`.
 *
 * Quem recebe o quê (item 5.7.7, figura 5-8): o destinatário recebe o resumo (`resNFe`) na autorização e a NF-e
 * completa (`procNFe`) depois de uma manifestação que não seja desconhecimento; os eventos do emitente chegam ao
 * destinatário como `procEventoNFe` depois da manifestação e como `resEvento` antes; o emitente recebe os eventos do
 * destinatário; `autXML` e transportador recebem a NF-e e os eventos completos. A NF-e não vai para o próprio emitente.
 */

import { codificarBase64 } from '@sinete/core/xml';
import { serializarRaiz } from '@sinete/schemas';
import type {
  retDistDFeInt,
  retDistDFeInt_loteDistDFeInt_docZip,
} from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import { distDFeIntElement, retDistDFeIntElement } from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import { lerCnpj, lerCpf } from '@sinete/validators';
import type { RequestContext, Status } from '../context.ts';
import { dh, prelude, status, verAplic } from '../context.ts';
import { nfeProcXml, procEventoXml, resEventoXml, resNFeXml } from '../docs.ts';
import { chaveRejection } from '../rules.ts';
import type { DistDoc, EventoRecord, NfeRecord, SimState } from '../state.ts';
import { docBase, docKey } from '../state.ts';
import { at, documento, text } from '../xmlutil.ts';

const PROC_NFE = 'procNFe_v4.00.xsd';
const RES_NFE = 'resNFe_v1.01.xsd';
const PROC_EVENTO = 'procEventoNFe_v1.00.xsd';
const RES_EVENTO = 'resEvento_v1.01.xsd';
const MANIFESTACOES = new Set(['210200', '210210', '210220', '210240']);

/**
 * Acesso à NF-e completa: `autXML` e transportador desde a autorização; o destinatário depois da primeira manifestação
 * que não seja desconhecimento. Quem é destinatário e também `autXML` ou transportador tem acesso completo desde o
 * início, e cada documento chega uma vez só.
 */
function completoPara(nfe: NfeRecord, key: string): boolean {
  const { dest, terceiros } = papeis(nfe);
  return terceiros.includes(key) || (key === dest && nfe.liberadaAoDestinatario);
}

/**
 * Quem recebe a NF-e pela distribuição: destinatário e terceiros (`autXML`, transportador), nunca o próprio emitente
 * (H17), mesmo que ele apareça num desses papéis.
 */
function papeis(nfe: NfeRecord): { readonly dest: string | undefined; readonly terceiros: readonly string[] } {
  const emit = docKey(nfe.emitente);
  const dest = docKey(nfe.destinatario);
  return { dest: dest === emit ? undefined : dest, terceiros: nfe.terceiros.filter((t) => t !== emit) };
}

/** Autorização ou denegação: resumo para o destinatário, NF-e completa para `autXML` e transportador. */
export function distribuirAutorizacao(state: SimState, nfe: NfeRecord): void {
  // A distribuição de DF-e é só da NF-e (modelo 55, tabela 5-29 H12); a NFC-e não entra em fila nenhuma.
  if (nfe.mod !== '55') return;
  const { dest, terceiros } = papeis(nfe);
  if (dest !== undefined && !completoPara(nfe, dest)) state.distribuir(dest, RES_NFE, resNFeXml(nfe), nfe.chave);
  for (const t of terceiros) state.distribuir(t, PROC_NFE, nfeProcXml(nfe, nfe.prot), nfe.chave);
}

/** Evento registrado: distribui conforme o autor (emitente ou destinatário). */
export function distribuirEvento(state: SimState, evento: EventoRecord, nfe: NfeRecord): void {
  if (nfe.mod !== '55') return;
  const { dest, terceiros } = papeis(nfe);
  const emit = docKey(nfe.emitente) as string;
  const proc = procEventoXml(evento);
  if (MANIFESTACOES.has(evento.tpEvento)) {
    state.distribuir(emit, PROC_EVENTO, proc, nfe.chave);
    if (evento.tpEvento !== '210220' && dest !== undefined && !nfe.liberadaAoDestinatario) {
      const jaTinha = completoPara(nfe, dest);
      nfe.liberadaAoDestinatario = true;
      if (!jaTinha) state.distribuir(dest, PROC_NFE, nfeProcXml(nfe, nfe.prot), nfe.chave);
    }
    return;
  }
  if (dest !== undefined && !terceiros.includes(dest)) {
    if (completoPara(nfe, dest)) state.distribuir(dest, PROC_EVENTO, proc, nfe.chave);
    else state.distribuir(dest, RES_EVENTO, resEventoXml(evento), nfe.chave);
  }
  for (const t of terceiros) state.distribuir(t, PROC_EVENTO, proc, nfe.chave);
}

const nsu = (n: number): string => String(n).padStart(15, '0');

async function gzipBase64(xml: string): Promise<string> {
  const stream = new Blob([xml]).stream().pipeThrough(new CompressionStream('gzip'));
  return codificarBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

async function docZip(d: DistDoc): Promise<retDistDFeInt_loteDistDFeInt_docZip> {
  return { NSU: nsu(d.nsu), schema: d.schema, $text: await gzipBase64(d.xml) };
}

/** NFeDistribuicaoDFe (nfeDistDFeInteresse), no Ambiente Nacional. */
export async function distribuicao(ctx: RequestContext): Promise<string> {
  const pre = prelude(ctx, { roots: [distDFeIntElement], lote: false });
  const root = pre.doc?.raiz;
  const interessadoDoc = documento(root);
  const interessado = docKey(interessadoDoc) ?? '';
  const fila = ctx.rt.state.distribuicao.get(interessado) ?? [];
  const ret = async (s: Status, ult: number, docs: readonly DistDoc[] = []): Promise<string> => {
    const value: retDistDFeInt = {
      versao: '1.01',
      tpAmb: ctx.rt.config.tpAmb,
      verAplic: verAplic(ctx),
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      dhResp: dh(ctx, ctx.now),
      ultNSU: nsu(ult),
      maxNSU: nsu(fila.length),
      ...(docs.length === 0 ? {} : { loteDistDFeInt: { docZip: await Promise.all(docs.map(docZip)) } }),
    };
    return serializarRaiz(retDistDFeIntElement, value);
  };
  if (!pre.ok) return ret(pre.status, 0);
  // H01 a H05 (MOC 7.0 Visão Geral, tabela 5-29): ambiente, documento válido e raiz do certificado de transmissão.
  if (text(root, 'tpAmb') !== ctx.rt.config.tpAmb) return ret(status('252'), 0);
  if (interessadoDoc.CNPJ !== undefined && !lerCnpj(interessadoDoc.CNPJ).ok) return ret(status('489'), 0);
  if (interessadoDoc.CPF !== undefined && !lerCpf(interessadoDoc.CPF).ok) return ret(status('490'), 0);
  const t = ctx.transmissor;
  if (interessadoDoc.CNPJ !== undefined && t !== undefined && docBase(t) !== docBase(interessadoDoc)) {
    return ret(status('593'), 0);
  }
  if (interessadoDoc.CPF !== undefined && t !== undefined && t.CPF !== interessadoDoc.CPF) {
    return ret(status('472'), 0);
  }
  const ultNSU = text(root, 'distNSU/ultNSU');
  if (ultNSU !== undefined) return distNSU(ctx, interessado, Number(ultNSU), fila, ret);
  const um = text(root, 'consNSU/NSU');
  if (um !== undefined) {
    const n = Number(um);
    if (n > fila.length) return ret(status('589'), n);
    const doc = fila[n - 1];
    return doc === undefined ? ret(status('137'), n) : ret(status('138'), n, [doc]);
  }
  return consChNFe(ctx, interessado, text(at(root, 'consChNFe'), 'chNFe') ?? '', fila, ret);
}

type Ret = (s: Status, ult: number, docs?: readonly DistDoc[]) => Promise<string>;

async function distNSU(
  ctx: RequestContext,
  interessado: string,
  ult: number,
  fila: readonly DistDoc[],
  ret: Ret,
): Promise<string> {
  if (ult > fila.length) return ret(status('589'), ult);
  // Item 5.7.4.4: sem documentos novos, esperar uma hora antes de consultar de novo (5.7.7.1: consumo indevido, 656).
  const vazias = ctx.rt.state.ultimaConsultaVazia;
  const ultimaVazia = vazias.get(interessado);
  if (ult === fila.length) {
    if (ultimaVazia !== undefined && ctx.now - ultimaVazia < ctx.rt.config.intervaloConsumoIndevidoMs) {
      return ret(
        status('656', {
          det: 'Deve ser aguardado 1 hora para efetuar nova solicitação caso não existam mais documentos a serem pesquisados',
        }),
        ult,
      );
    }
    vazias.set(interessado, ctx.now);
    return ret(status('137'), ult);
  }
  vazias.delete(interessado);
  const docs = fila.slice(ult, ult + 50);
  return ret(status('138'), (docs.at(-1) as DistDoc).nsu, docs);
}

async function consChNFe(
  ctx: RequestContext,
  interessado: string,
  chave: string,
  fila: readonly DistDoc[],
  ret: Ret,
): Promise<string> {
  const invalida = chaveRejection(chave, ctx.now, ctx.rt.config.offsetMinutes);
  if (invalida !== undefined) return ret(status(invalida.cStat), 0);
  // H12: a distribuição é só da NF-e, modelo 55.
  if (chave.slice(20, 22) !== '55') return ret(status('618'), 0);
  const nfe = ctx.rt.state.nfes.get(chave);
  if (nfe === undefined) return ret(status('217'), 0);
  // H17: o emitente não recebe a própria NF-e (641), mesmo que se liste em autXML ou como transportador.
  if (interessado === docKey(nfe.emitente)) return ret(status('641'), 0);
  // H16: destinatário, autXML e transportador, pela raiz do CNPJ do interessado.
  const base = interessado.length === 14 ? interessado.slice(0, 8) : interessado;
  const { terceiros } = papeis(nfe);
  const ehDest = docBase(nfe.destinatario) === base;
  const ehTerceiro = terceiros.some((x) => (x.length === 14 ? x.slice(0, 8) : x) === base);
  if (!ehDest && !ehTerceiro) return ret(status(docBase(nfe.emitente) === base ? '641' : '640'), 0);
  if (nfe.situacao === 'cancelada') return ret(status('653'), 0);
  if (nfe.situacao === 'denegada') return ret(status('654'), 0);
  // Mesma regra de acesso da fila (completoPara), aqui pela raiz do CNPJ do interessado.
  const completo = ehTerceiro || nfe.liberadaAoDestinatario;
  const schema = completo ? PROC_NFE : RES_NFE;
  const naFila = fila.findLast((d) => d.chave === chave && d.schema === schema);
  const doc: DistDoc = naFila ?? {
    nsu: 0,
    schema,
    xml: completo ? nfeProcXml(nfe, nfe.prot) : resNFeXml(nfe),
    chave,
  };
  return ret(status('138'), 0, [doc]);
}
