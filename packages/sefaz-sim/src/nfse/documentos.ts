/**
 * Documentos que a Sefin simulada gera: a chave de acesso, a NFS-e (com a DPS recebida embutida byte a byte e a
 * assinatura da Sefin) e o evento (com o pedido recebido embutido). Os valores do ISSQN e do IBS/CBS são contas
 * simples do simulador, em centavos inteiros e arredondamento meio para cima, e não pretendem reproduzir o cálculo
 * da Sefin; o que se testa com eles é o caminho do documento, não a apuração.
 */

import type { Signer } from '@sinete/core';
import { base64Decode, base64Encode, signXml } from '@sinete/core/xml';
import { serialize } from '@sinete/schemas';
import type {
  TCDPS,
  TCEmitente,
  TCInfNFSe,
  TCPedRegEvt,
  TCRTCIBSCBS,
  TCValoresNFSe,
} from '@sinete/schemas/nfse/1.01-20260727';
import {
  TCDPS as TCDPSDesc,
  TCInfEvento,
  TCInfNFSe as TCInfNFSeDesc,
  TCPedRegEvt as TCPedRegEvtDesc,
} from '@sinete/schemas/nfse/1.01-20260727';
import type { AliquotasIbsCbsSim, ContribuinteNfseSim } from './dados.ts';
import { ufDoMunicipio } from './dados.ts';

export const NFSE_NS = 'http://www.sped.fazenda.gov.br/nfse';

/**
 * DV da chave: módulo 11 com pesos de 2 a 9 da direita para a esquerda, como na chave da NF-e. O Anexo I não publica
 * o algoritmo; o simulador usa este e o `@sinete/nfse` não confere o DV.
 */
export function dvChave(base49: string): string {
  let soma = 0;
  let peso = 2;
  for (let i = base49.length - 1; i >= 0; i--) {
    const c = base49.charCodeAt(i) - 48;
    soma += c * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  return String(r < 2 ? 0 : 11 - r);
}

export interface PartesChave {
  readonly cMun: string;
  readonly tpInsc: '1' | '2';
  /** 14 posições (CPF com `000` à esquerda). */
  readonly inscricao: string;
  readonly nNFSe: number;
  readonly anoMes: string;
  readonly cNum: number;
}

/** Chave de 50 posições com o ambiente gerador 2 (Sefin Nacional). */
export function montarChave(p: PartesChave): string {
  const base = `${p.cMun}2${p.tpInsc}${p.inscricao}${String(p.nNFSe).padStart(13, '0')}${p.anoMes}${String(p.cNum).padStart(9, '0')}`;
  return base + dvChave(base);
}

/** Centavos de um decimal lexical com até 2 casas. */
export function centavos(v: string | undefined): bigint {
  if (v === undefined) return 0n;
  const [i = '0', f = ''] = v.split('.');
  return BigInt(i) * 100n + BigInt(f.padEnd(2, '0').slice(0, 2));
}

export function reais(c: bigint): string {
  const s = c.toString().padStart(3, '0');
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** `base * pct / 100`, com `pct` em % de 2 casas, arredondado meio para cima. */
export function porcentagem(base: bigint, pct: string): bigint {
  return (base * centavos(pct) + 5000n) / 10000n;
}

export interface GeracaoNfse {
  readonly chave: string;
  readonly nNFSe: number;
  readonly nDFSe: number;
  readonly dhProc: string;
  readonly dps: TCDPS;
  /** DPS recebida, sem a declaração XML, que entra na NFS-e sem reserialização. */
  readonly dpsXml: string;
  readonly xLocEmi: string;
  readonly xLocPrestacao: string;
  readonly cLocIncid: string | undefined;
  readonly xLocIncid: string | undefined;
  readonly xTribNac: string;
  readonly aliquota: string | undefined;
  /** Documento do emitente da DPS (prestador, tomador ou intermediário, pelo `tpEmit`), o mesmo da chave. */
  readonly documento: { readonly CNPJ?: string; readonly CPF?: string };
  readonly emitente: ContribuinteNfseSim | undefined;
  readonly aliquotasIbsCbs: AliquotasIbsCbsSim;
  readonly signer: Signer;
}

function emitenteDe(g: GeracaoNfse): TCEmitente {
  const inf = g.dps.infDPS;
  const doc = g.documento;
  const cadastro = g.emitente;
  const endereco = cadastro?.endereco ?? {
    xLgr: 'LOGRADOURO DO CADASTRO SIMULADO',
    nro: '1',
    xBairro: 'CENTRO',
    cMun: inf.cLocEmi,
    UF: ufDoMunicipio(inf.cLocEmi) as TCEmitente['enderNac']['UF'],
    CEP: '01001000',
  };
  const base = {
    xNome: cadastro?.xNome ?? `CONTRIBUINTE SIMULADO ${doc.CNPJ ?? doc.CPF ?? ''}`,
    enderNac: endereco,
  };
  return doc.CPF !== undefined ? { CPF: doc.CPF, ...base } : { CNPJ: doc.CNPJ ?? '', ...base };
}

function valoresDe(g: GeracaoNfse): TCValoresNFSe {
  const v = g.dps.infDPS.valores;
  const vServ = centavos(v.vServPrest.vServ);
  const descontos = centavos(v.vDescCondIncond?.vDescIncond);
  const vBC = vServ - descontos;
  const trib = v.trib.tribMun;
  if (g.aliquota === undefined || trib.tribISSQN !== '1')
    return { vLiq: reais(vServ - descontos - centavos(v.vDescCondIncond?.vDescCond)) };
  const vISSQN = porcentagem(vBC, g.aliquota);
  const retido = trib.tpRetISSQN !== '1';
  const vLiq = vServ - descontos - centavos(v.vDescCondIncond?.vDescCond) - (retido ? vISSQN : 0n);
  return {
    vBC: reais(vBC),
    pAliqAplic: g.aliquota,
    vISSQN: reais(vISSQN),
    ...(retido ? { vTotalRet: reais(vISSQN) } : {}),
    vLiq: reais(vLiq),
  };
}

function ibsCbsDe(g: GeracaoNfse, cLoc: string, xLoc: string): TCRTCIBSCBS {
  const a = g.aliquotasIbsCbs;
  const v = g.dps.infDPS.valores;
  const vBC = centavos(v.vServPrest.vServ) - centavos(v.vDescCondIncond?.vDescIncond);
  const vIBSUF = porcentagem(vBC, a.pIBSUF);
  const vIBSMun = porcentagem(vBC, a.pIBSMun);
  const vCBS = porcentagem(vBC, a.pCBS);
  return {
    cLocalidadeIncid: cLoc,
    xLocalidadeIncid: xLoc,
    valores: {
      vBC: reais(vBC),
      uf: { pIBSUF: a.pIBSUF, pAliqEfetUF: a.pIBSUF },
      mun: { pIBSMun: a.pIBSMun, pAliqEfetMun: a.pIBSMun },
      fed: { pCBS: a.pCBS, pAliqEfetCBS: a.pCBS },
    },
    totCIBS: {
      vTotNF: reais(centavos(v.vServPrest.vServ)),
      gIBS: {
        vIBSTot: reais(vIBSUF + vIBSMun),
        gIBSUFTot: { vIBSUF: reais(vIBSUF) },
        gIBSMunTot: { vIBSMun: reais(vIBSMun) },
      },
      gCBS: { vCBS: reais(vCBS) },
    },
  };
}

/** NFS-e assinada pela Sefin simulada. */
export async function gerarNfse(g: GeracaoNfse): Promise<string> {
  // Marcador: o serializer grava uma DPS mínima no lugar e a DPS recebida entra por splice, sem reserializar.
  const marcador: TCDPS = { versao: '1.01', infDPS: g.dps.infDPS };
  const inf: TCInfNFSe = {
    Id: `NFS${g.chave}`,
    xLocEmi: g.xLocEmi,
    xLocPrestacao: g.xLocPrestacao,
    nNFSe: String(g.nNFSe),
    ...(g.cLocIncid === undefined ? {} : { cLocIncid: g.cLocIncid, xLocIncid: g.xLocIncid ?? g.cLocIncid }),
    xTribNac: g.xTribNac,
    verAplic: 'sefaz-sim',
    ambGer: '2',
    tpEmis: '1',
    procEmi: '1',
    cStat: '100',
    dhProc: g.dhProc,
    nDFSe: String(g.nDFSe),
    emit: emitenteDe(g),
    valores: valoresDe(g),
    ...(g.dps.infDPS.IBSCBS === undefined
      ? {}
      : { IBSCBS: ibsCbsDe(g, g.cLocIncid ?? g.dps.infDPS.cLocEmi, g.xLocIncid ?? g.xLocEmi) }),
    DPS: marcador,
  };
  const corpo = serialize(TCInfNFSeDesc, 'infNFSe', inf, NFSE_NS);
  const dpsSerializada = serialize(TCDPSDesc, 'DPS', marcador, NFSE_NS);
  const i = corpo.lastIndexOf(dpsSerializada);
  const infXml = corpo.slice(0, i) + g.dpsXml + corpo.slice(i + dpsSerializada.length);
  const xml = `<NFSe xmlns="${NFSE_NS}" versao="1.01">${infXml}</NFSe>`;
  return signXml(xml, { id: `NFS${g.chave}` }, g.signer);
}

export interface GeracaoEvento {
  readonly id: string;
  readonly nSeqEvento: number;
  readonly nDFSe: number;
  readonly dhProc: string;
  /** Pedido recebido, sem a declaração XML, e a leitura dele. */
  readonly pedidoXml: string;
  readonly pedido: TCPedRegEvt;
  readonly signer: Signer;
}

/** Evento (Anexo II) com o pedido embutido e a assinatura da Sefin simulada. */
export async function gerarEvento(g: GeracaoEvento): Promise<string> {
  const marcador: TCPedRegEvt = { versao: '1.01', infPedReg: g.pedido.infPedReg };
  const corpo = serialize(
    TCInfEvento,
    'infEvento',
    {
      Id: g.id,
      verAplic: 'sefaz-sim',
      ambGer: '2',
      nSeqEvento: String(g.nSeqEvento),
      dhProc: g.dhProc,
      nDFSe: String(g.nDFSe),
      pedRegEvento: marcador,
    },
    NFSE_NS,
  );
  const pedidoSerializado = serialize(TCPedRegEvtDesc, 'pedRegEvento', marcador, NFSE_NS);
  const i = corpo.lastIndexOf(pedidoSerializado);
  const inf = corpo.slice(0, i) + g.pedidoXml + corpo.slice(i + pedidoSerializado.length);
  return signXml(`<evento xmlns="${NFSE_NS}" versao="1.01">${inf}</evento>`, { id: g.id }, g.signer);
}

/** Tira a declaração XML do começo do documento recebido. */
export function semDeclaracao(xml: string): string {
  return xml.replace(/^<\?xml[^?]*\?>/, '');
}

type StreamCtor = new (format: 'gzip') => TransformStream<Uint8Array, Uint8Array>;
const g = globalThis as unknown as Record<'CompressionStream' | 'DecompressionStream', StreamCtor>;

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: TransformStream<Uint8Array, Uint8Array>,
): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function gzipB64(texto: string): Promise<string> {
  return base64Encode(await pipe(new TextEncoder().encode(texto), new g.CompressionStream('gzip')));
}

/** Bytes de dentro de um gzip em base64; `undefined` quando o base64 ou o gzip não valem (E1225, E1226). */
export async function gunzipB64(
  b64: string,
): Promise<
  { readonly ok: true; readonly bytes: Uint8Array } | { readonly ok: false; readonly etapa: 'base64' | 'gzip' }
> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64Decode(b64);
  } catch {
    return { ok: false, etapa: 'base64' };
  }
  try {
    return { ok: true, bytes: await pipe(bytes, new g.DecompressionStream('gzip')) };
  } catch {
    return { ok: false, etapa: 'gzip' };
  }
}
