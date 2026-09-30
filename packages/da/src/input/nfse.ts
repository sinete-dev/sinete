/**
 * NFS-e Nacional lida do XML autorizado: o `NFSe` que a Sefin Nacional devolve, com a DPS dentro. O pacote de
 * esquemas (1.01 de 20260209 ou de 20260727, com CNPJ alfanumérico) sai da tabela de vigências do `@sinete/schemas`
 * pela data e pelo ambiente da própria DPS (`dhEmi` e `tpAmb`), como manda o ADR 0002 para documento recebido, e não
 * de tentativa. Os dois módulos têm a mesma forma; a visão abaixo só lê campos, então vale para os dois.
 */

import { relogioFixo } from '@sinete/core';
import type { ElementoXml } from '@sinete/core/xml';
import { primeiroFilho, textoDe } from '@sinete/core/xml';
import type { ElementoRaiz } from '@sinete/schemas';
import { selecionarPl } from '@sinete/schemas';
import * as v20260209 from '@sinete/schemas/nfse/1.01-20260209';
import * as v20260727 from '@sinete/schemas/nfse/1.01-20260727';
import { DanfeError } from '../errors.ts';
import type { Rec } from './xml.ts';
import { decodeAs, parse, str, vista } from './xml.ts';

const NS = 'http://www.sped.fazenda.gov.br/nfse';
const ANTIGO = 'nfse/1.01-20260209';

const MODULOS: Readonly<
  Record<string, { readonly NFSeElement: ElementoRaiz<unknown>; readonly eventoElement: ElementoRaiz<unknown> }>
> = {
  'nfse/1.01-20260209': v20260209 as never,
  'nfse/1.01-20260727': v20260727 as never,
};

export interface EnderecoNfseView {
  /** Código IBGE do município (endereço nacional). */
  readonly cMun: string;
  readonly CEP: string;
  /** Endereço no exterior: código do país, código postal, cidade e estado/província. */
  readonly cPais: string;
  readonly cEndPost: string;
  readonly xCidade: string;
  readonly xEstProvReg: string;
  readonly xLgr: string;
  readonly nro: string;
  readonly xCpl: string;
  readonly xBairro: string;
}

export interface PessoaNfseView {
  readonly CNPJ: string;
  readonly CPF: string;
  readonly NIF: string;
  readonly IM: string;
  readonly xNome: string;
  readonly fone: string;
  readonly email: string;
  readonly end?: EnderecoNfseView;
}

export interface NfseView {
  /** Chave de acesso: o `Id` sem o prefixo "NFS" (NT 008/2026, 2.4.5). */
  readonly chave: string;
  readonly modulo: string;
  readonly nNFSe: string;
  readonly dhProc: string;
  readonly cStat: string;
  readonly ambGer: string;
  readonly xLocEmi: string;
  readonly xLocPrestacao: string;
  readonly cLocIncid: string;
  readonly xLocIncid: string;
  readonly xTribNac: string;
  readonly xTribMun: string;
  readonly xOutInf: string;
  readonly emit: PessoaNfseView & { readonly UF: string };
  /** Valores calculados pela Sefin (`infNFSe/valores`). */
  readonly valores: Readonly<
    Record<'vCalcDR' | 'tpBM' | 'vCalcBM' | 'vBC' | 'pAliqAplic' | 'vISSQN' | 'vTotalRet' | 'vLiq', string>
  >;
  /** Grupo IBS/CBS gerado pela Sefin (`infNFSe/IBSCBS`), quando existe. */
  readonly ibscbs?: {
    readonly cLocalidadeIncid: string;
    readonly xLocalidadeIncid: string;
    readonly valores: Readonly<
      Record<
        | 'vBC'
        | 'vCalcReeRepRes'
        | 'pIBSUF'
        | 'pRedAliqUF'
        | 'pAliqEfetUF'
        | 'pIBSMun'
        | 'pRedAliqMun'
        | 'pAliqEfetMun'
        | 'pCBS'
        | 'pRedAliqCBS'
        | 'pAliqEfetCBS',
        string
      >
    >;
    readonly tot: Readonly<Record<'vTotNF' | 'vIBSTot' | 'vIBSUF' | 'vIBSMun' | 'vCBS', string>>;
  };
  readonly dps: {
    readonly tpAmb: string;
    readonly dhEmi: string;
    readonly serie: string;
    readonly nDPS: string;
    readonly dCompet: string;
    readonly tpEmit: string;
    readonly cLocEmi: string;
    readonly chSubstda: string;
    readonly prest: PessoaNfseView & {
      readonly opSimpNac: string;
      readonly regApTribSN: string;
      readonly regEspTrib: string;
    };
    readonly toma?: PessoaNfseView;
    readonly interm?: PessoaNfseView;
    readonly serv: {
      readonly cLocPrestacao: string;
      readonly cPaisPrestacao: string;
      readonly cTribNac: string;
      readonly cTribMun: string;
      readonly xDescServ: string;
      readonly cNBS: string;
      readonly cObra: string;
      readonly inscImobFisc: string;
      readonly idAtvEvt: string;
      readonly idDocTec: string;
      readonly docRef: string;
      readonly xPed: string;
      readonly xItemPed: readonly string[];
      readonly xInfComp: string;
    };
    readonly valores: Readonly<
      Record<
        | 'vServ'
        | 'vDescIncond'
        | 'vDescCond'
        | 'vDR'
        | 'tribISSQN'
        | 'cPaisResult'
        | 'tpImunidade'
        | 'tpSusp'
        | 'nProcesso'
        | 'vRedBCBM'
        | 'tpRetISSQN'
        | 'vRetCP'
        | 'vRetIRRF'
        | 'vRetCSLL'
        | 'vPis'
        | 'vCofins'
        | 'tpRetPisCofins',
        string
      >
    >;
    /** Totais aproximados dos tributos (Lei 12.741/2012): valores, percentuais, percentual do SN ou indicador. */
    readonly totTrib: Readonly<
      Record<
        | 'vTotTribFed'
        | 'vTotTribEst'
        | 'vTotTribMun'
        | 'pTotTribFed'
        | 'pTotTribEst'
        | 'pTotTribMun'
        | 'pTotTribSN'
        | 'indTotTrib',
        string
      >
    >;
    readonly ibscbs?: {
      readonly finNFSe: string;
      readonly cIndOp: string;
      readonly indDest: string;
      readonly dest?: PessoaNfseView;
      readonly inscImobFisc: string;
      readonly CST: string;
      readonly cClassTrib: string;
    };
  };
}

function rec(v: unknown): Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : {};
}

function s(r: Rec, k: string): string {
  return str(r, k) ?? '';
}

function pick<K extends string>(r: Rec, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, s(r, k)])) as Record<K, string>;
}

function endereco(v: unknown): EnderecoNfseView | undefined {
  if (v === undefined) return undefined;
  const e = rec(v);
  const nac = rec(e.endNac);
  const ext = rec(e.endExt);
  return {
    cMun: s(nac, 'cMun'),
    CEP: s(nac, 'CEP'),
    cPais: s(ext, 'cPais'),
    cEndPost: s(ext, 'cEndPost'),
    xCidade: s(ext, 'xCidade'),
    xEstProvReg: s(ext, 'xEstProvReg'),
    ...pick(e, ['xLgr', 'nro', 'xCpl', 'xBairro'] as const),
  };
}

function pessoa(v: unknown): PessoaNfseView | undefined {
  if (v === undefined) return undefined;
  const p = rec(v);
  const end = endereco(p.end);
  return {
    ...pick(p, ['CNPJ', 'CPF', 'NIF', 'IM', 'xNome', 'fone', 'email'] as const),
    ...(end ? { end } : {}),
  };
}

function view(n: Rec, modulo: string): NfseView {
  const inf = rec(n.infNFSe);
  const emit = rec(inf.emit);
  const ender = rec(emit.enderNac);
  const infDps = rec(rec(inf.DPS).infDPS);
  const prest = rec(infDps.prest);
  const reg = rec(prest.regTrib);
  const serv = rec(infDps.serv);
  const locPrest = rec(serv.locPrest);
  const cServ = rec(serv.cServ);
  const obra = rec(serv.obra);
  const compl = rec(serv.infoCompl);
  const val = rec(infDps.valores);
  const trib = rec(val.trib);
  const tribMun = rec(trib.tribMun);
  const exig = rec(tribMun.exigSusp);
  const tribFed = rec(trib.tribFed);
  const piscofins = rec(tribFed.piscofins);
  const totTrib = rec(trib.totTrib);
  const dIbs = infDps.IBSCBS === undefined ? undefined : rec(infDps.IBSCBS);
  const gIbs = rec(rec(rec(dIbs?.valores).trib).gIBSCBS);
  const nIbs = inf.IBSCBS === undefined ? undefined : rec(inf.IBSCBS);
  const nVal = rec(nIbs?.valores);
  const nTot = rec(nIbs?.totCIBS);
  const gIBS = rec(nTot.gIBS);
  const itens = rec(compl.gItemPed).xItemPed;
  return {
    chave: s(inf, 'Id').replace(/^NFS/, ''),
    modulo,
    ...pick(inf, [
      'nNFSe',
      'dhProc',
      'cStat',
      'ambGer',
      'xLocEmi',
      'xLocPrestacao',
      'cLocIncid',
      'xLocIncid',
      'xTribNac',
      'xTribMun',
      'xOutInf',
    ] as const),
    emit: {
      ...pick(emit, ['CNPJ', 'CPF', 'IM', 'xNome', 'fone', 'email'] as const),
      NIF: '',
      UF: s(ender, 'UF'),
      end: {
        cMun: s(ender, 'cMun'),
        CEP: s(ender, 'CEP'),
        cPais: '',
        cEndPost: '',
        xCidade: '',
        xEstProvReg: '',
        ...pick(ender, ['xLgr', 'nro', 'xCpl', 'xBairro'] as const),
      },
    },
    valores: pick(rec(inf.valores), [
      'vCalcDR',
      'tpBM',
      'vCalcBM',
      'vBC',
      'pAliqAplic',
      'vISSQN',
      'vTotalRet',
      'vLiq',
    ] as const),
    ...(nIbs
      ? {
          ibscbs: {
            ...pick(nIbs, ['cLocalidadeIncid', 'xLocalidadeIncid'] as const),
            valores: {
              ...pick(nVal, ['vBC', 'vCalcReeRepRes'] as const),
              ...pick(rec(nVal.uf), ['pIBSUF', 'pRedAliqUF', 'pAliqEfetUF'] as const),
              ...pick(rec(nVal.mun), ['pIBSMun', 'pRedAliqMun', 'pAliqEfetMun'] as const),
              ...pick(rec(nVal.fed), ['pCBS', 'pRedAliqCBS', 'pAliqEfetCBS'] as const),
            },
            tot: {
              vTotNF: s(nTot, 'vTotNF'),
              vIBSTot: s(gIBS, 'vIBSTot'),
              vIBSUF: s(rec(gIBS.gIBSUFTot), 'vIBSUF'),
              vIBSMun: s(rec(gIBS.gIBSMunTot), 'vIBSMun'),
              vCBS: s(rec(nTot.gCBS), 'vCBS'),
            },
          },
        }
      : {}),
    dps: {
      ...pick(infDps, ['tpAmb', 'dhEmi', 'serie', 'nDPS', 'dCompet', 'tpEmit', 'cLocEmi'] as const),
      chSubstda: s(rec(infDps.subst), 'chSubstda'),
      prest: {
        ...(pessoa(prest) as PessoaNfseView),
        ...pick(reg, ['opSimpNac', 'regApTribSN', 'regEspTrib'] as const),
      },
      ...(infDps.toma === undefined ? {} : { toma: pessoa(infDps.toma) as PessoaNfseView }),
      ...(infDps.interm === undefined ? {} : { interm: pessoa(infDps.interm) as PessoaNfseView }),
      serv: {
        ...pick(locPrest, ['cLocPrestacao', 'cPaisPrestacao'] as const),
        ...pick(cServ, ['cTribNac', 'cTribMun', 'xDescServ', 'cNBS'] as const),
        ...pick(obra, ['cObra', 'inscImobFisc'] as const),
        idAtvEvt: s(rec(serv.atvEvento), 'idAtvEvt'),
        ...pick(compl, ['idDocTec', 'docRef', 'xPed', 'xInfComp'] as const),
        xItemPed: (Array.isArray(itens) ? itens : itens === undefined ? [] : [itens]).filter(
          (x): x is string => typeof x === 'string',
        ),
      },
      valores: {
        vServ: s(rec(val.vServPrest), 'vServ'),
        ...pick(rec(val.vDescCondIncond), ['vDescIncond', 'vDescCond'] as const),
        vDR: s(rec(val.vDedRed), 'vDR'),
        ...pick(tribMun, ['tribISSQN', 'cPaisResult', 'tpImunidade', 'tpRetISSQN'] as const),
        ...pick(exig, ['tpSusp', 'nProcesso'] as const),
        vRedBCBM: s(rec(tribMun.BM), 'vRedBCBM'),
        ...pick(tribFed, ['vRetCP', 'vRetIRRF', 'vRetCSLL'] as const),
        ...pick(piscofins, ['vPis', 'vCofins', 'tpRetPisCofins'] as const),
      },
      totTrib: {
        ...pick(rec(totTrib.vTotTrib), ['vTotTribFed', 'vTotTribEst', 'vTotTribMun'] as const),
        ...pick(rec(totTrib.pTotTrib), ['pTotTribFed', 'pTotTribEst', 'pTotTribMun'] as const),
        ...pick(totTrib, ['pTotTribSN', 'indTotTrib'] as const),
      },
      ...(dIbs
        ? {
            ibscbs: {
              ...pick(dIbs, ['finNFSe', 'cIndOp', 'indDest'] as const),
              ...(dIbs.dest === undefined ? {} : { dest: pessoa(dIbs.dest) as PessoaNfseView }),
              inscImobFisc: s(rec(dIbs.imovel), 'inscImobFisc'),
              ...pick(gIbs, ['CST', 'cClassTrib'] as const),
            },
          }
        : {}),
    },
  };
}

function texto(el: ElementoXml | undefined, ...caminho: string[]): string {
  let e = el;
  for (const k of caminho) e = e ? primeiroFilho(e, k, NS) : undefined;
  return e ? textoDe(e).trim() : '';
}

/**
 * Módulo de schema pela data e pelo ambiente da DPS (ADR 0002, decisão 6). A data que decide é a da emissão da DPS;
 * documento de antes da primeira vigência registrada (leiaute 1.00) ou sem data legível é lido pelo pacote mais
 * antigo, que o decoder tolerante aceita.
 */
function modulo(dps: ElementoXml | undefined): string {
  const tpAmb = texto(dps, 'tpAmb');
  const dhEmi = texto(dps, 'dhEmi');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dhEmi)) return ANTIGO;
  try {
    return selecionarPl('nfse', tpAmb === '1' ? 'producao' : 'homologacao', relogioFixo(dhEmi)).modulo;
  } catch {
    return ANTIGO;
  }
}

/** Lê o `NFSe` autorizado (com a DPS dentro) para o modelo de visualização do DANFSe. */
export function readNfse(xml: string): NfseView {
  const doc = parse(xml);
  const inf = primeiroFilho(doc.raiz, 'infNFSe', NS);
  const dps = inf ? primeiroFilho(primeiroFilho(inf, 'DPS', NS) ?? inf, 'infDPS', NS) : undefined;
  const m = modulo(dps);
  const mod = MODULOS[m] ?? v20260209;
  const { value } = decodeAs<Rec>(doc, [mod.NFSeElement as never], 'NFSe');
  if (!value.infNFSe) throw new DanfeError('campo_ausente', 'NFS-e sem infNFSe');
  return vista('NFS-e', () => view(value, m));
}

/** Evento registrado de uma NFS-e que marca o DANFSe: o grupo do evento e a chave. */
export interface EventoNfseView {
  readonly tipo: string;
  readonly chNFSe: string;
}

/**
 * Lê o `evento` registrado pela Sefin (com o `pedRegEvento` dentro) e confere o tipo. O envelope do evento tem a
 * mesma forma nos dois pacotes de esquemas e só a chave e o nome do grupo são lidos, então basta o módulo mais novo,
 * cujos patterns aceitam também a chave com CNPJ alfanumérico: `tipos` são os nomes dos grupos
 * aceitos (`e101101`, `e105102`...). O pedido sem registro (`pedRegEvento` sozinho) não prova o evento e é
 * `documento_inesperado`; o evento de outro tipo é `evento_incompativel`.
 */
export function readEventoNfse(xml: string, tipos: readonly string[]): EventoNfseView {
  const doc = parse(xml);
  const { value } = decodeAs<Rec>(doc, [v20260727.eventoElement as never], 'evento da NFS-e');
  const ped = rec(rec(rec(rec(value.infEvento).pedRegEvento).infPedReg));
  const tipo = Object.keys(ped).find((k) => /^e\d{6}$/.test(k)) ?? '';
  if (!tipos.includes(tipo)) {
    throw new DanfeError('evento_incompativel', `evento ${tipo || 'sem tipo'} não é ${tipos.join(' nem ')}`, {
      detalhes: { tipo, esperado: tipos },
    });
  }
  return { tipo, chNFSe: s(ped, 'chNFSe') };
}
