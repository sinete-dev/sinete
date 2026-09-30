/** MDF-e lido do `mdfeProc` autorizado (ou do `MDFe` em contingência) pelo PL 3.00b (NT 2025.001). */

import type { mdfeProc, TMDFe } from '@sinete/schemas/mdfe/3.00b';
import { MDFeElement, mdfeProcElement } from '@sinete/schemas/mdfe/3.00b';
import { ErroDa } from '../errors.ts';
import type { EnderecoView } from './nfe.ts';
import type { Rec } from './xml.ts';
import { decodeAs, parse, str, vista } from './xml.ts';

export interface MdfeView {
  readonly chave: string;
  readonly serie: string;
  readonly nMDF: string;
  readonly dhEmi: string;
  readonly tpEmis: string;
  readonly tpAmb: string;
  readonly modal: string;
  readonly UFIni: string;
  readonly UFFim: string;
  readonly emit: {
    readonly xNome: string;
    readonly xFant: string;
    readonly doc: string;
    readonly IE: string;
    readonly ender: EnderecoView;
  };
  readonly tot: {
    readonly qCTe: string;
    readonly qNFe: string;
    readonly qMDFe: string;
    readonly vCarga: string;
    readonly cUnid: string;
    readonly qCarga: string;
  };
  readonly prot?: { readonly nProt: string; readonly dhRecbto: string; readonly cStat: string };
  readonly qrCode: string;
  readonly RNTRC: string;
  readonly veiculos: readonly { readonly placa: string; readonly RNTRC: string; readonly UF: string }[];
  readonly condutores: readonly { readonly CPF: string; readonly xNome: string }[];
  readonly valePed: readonly { readonly CNPJForn: string; readonly pagador: string; readonly nCompra: string }[];
  readonly aereo?: Readonly<Record<'nac' | 'matr' | 'nVoo' | 'cAerEmb' | 'cAerDes' | 'dVoo', string>>;
  readonly aquav?: Readonly<Record<'irin' | 'tpEmb' | 'cEmbar' | 'xEmbar' | 'nViag' | 'cPrtEmb' | 'cPrtDest', string>>;
  readonly ferrov?: Readonly<Record<'xPref' | 'dhTrem' | 'xOri' | 'xDest' | 'qVag', string>>;
  readonly docs: readonly {
    readonly tipo: 'CT-e' | 'NF-e' | 'MDF-e';
    readonly chave: string;
    readonly xMunDescarga: string;
    readonly unidTransp: string;
    readonly unidCarga: string;
  }[];
  readonly infAdFisco: string;
  readonly infCpl: string;
}

const TP_UNID_TRANSP: Readonly<Record<string, string>> = {
  '1': 'Rodoviário Tração',
  '2': 'Rodoviário Reboque',
  '3': 'Navio',
  '4': 'Balsa',
  '5': 'Aeronave',
  '6': 'Vagão',
  '7': 'Outros',
};

const TP_UNID_CARGA: Readonly<Record<string, string>> = {
  '1': 'Container',
  '2': 'ULD',
  '3': 'Pallet',
  '4': 'Outros',
};

function rec(v: unknown): Rec {
  return typeof v === 'object' && v !== null ? (v as Rec) : {};
}

function list(v: unknown): Rec[] {
  return Array.isArray(v) ? v.map(rec) : [];
}

function pick<K extends string>(r: Rec, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, str(r, k) ?? ''])) as Record<K, string>;
}

function view(m: TMDFe, proc: mdfeProc | undefined): MdfeView {
  const inf = rec(m.infMDFe);
  const ide = rec(inf.ide);
  const emit = rec(inf.emit);
  const e = rec(emit.enderEmit);
  const tot = rec(inf.tot);
  const modal = rec(inf.infModal);
  const rodo = rec(modal.rodo);
  const antt = rec(rodo.infANTT);
  const tracao = rec(rodo.veicTracao);
  const infProt = rec(rec(proc?.protMDFe).infProt);
  const veic = (v: Rec): { placa: string; RNTRC: string; UF: string } => ({
    placa: str(v, 'placa') ?? '',
    RNTRC: str(rec(v.prop), 'RNTRC') ?? str(antt, 'RNTRC') ?? '',
    UF: str(v, 'UF') ?? '',
  });
  const docs: MdfeView['docs'][number][] = [];
  for (const mun of list(rec(inf.infDoc).infMunDescarga)) {
    const xMunDescarga = str(mun, 'xMunDescarga') ?? '';
    const add = (tipo: 'CT-e' | 'NF-e' | 'MDF-e', key: string, arr: unknown): void => {
      for (const d of list(arr)) {
        const ut = list(d.infUnidTransp)[0] ?? {};
        const uc = list(ut.infUnidCarga)[0] ?? {};
        docs.push({
          tipo,
          chave: str(d, key) ?? '',
          xMunDescarga,
          unidTransp: TP_UNID_TRANSP[str(ut, 'tpUnidTransp') ?? ''] ?? '',
          unidCarga: TP_UNID_CARGA[str(uc, 'tpUnidCarga') ?? ''] ?? '',
        });
      }
    };
    add('CT-e', 'chCTe', mun.infCTe);
    add('NF-e', 'chNFe', mun.infNFe);
    add('MDF-e', 'chMDFe', mun.infMDFeTransp);
  }
  const aereo = modal.aereo ? rec(modal.aereo) : undefined;
  const aquav = modal.aquav ? rec(modal.aquav) : undefined;
  const trem = modal.ferrov ? rec(rec(modal.ferrov).trem) : undefined;
  const adic = rec(inf.infAdic);
  return {
    chave: (str(inf, 'Id') ?? '').replace(/^MDFe/, ''),
    serie: str(ide, 'serie') ?? '',
    nMDF: str(ide, 'nMDF') ?? '',
    dhEmi: str(ide, 'dhEmi') ?? '',
    tpEmis: str(ide, 'tpEmis') ?? '',
    tpAmb: str(ide, 'tpAmb') ?? '',
    modal: str(ide, 'modal') ?? '',
    UFIni: str(ide, 'UFIni') ?? '',
    UFFim: str(ide, 'UFFim') ?? '',
    emit: {
      xNome: str(emit, 'xNome') ?? '',
      xFant: str(emit, 'xFant') ?? '',
      doc: str(emit, 'CNPJ') ?? str(emit, 'CPF') ?? '',
      IE: str(emit, 'IE') ?? '',
      ender: {
        xLgr: str(e, 'xLgr') ?? '',
        nro: str(e, 'nro') ?? '',
        xCpl: str(e, 'xCpl') ?? '',
        xBairro: str(e, 'xBairro') ?? '',
        xMun: str(e, 'xMun') ?? '',
        UF: str(e, 'UF') ?? '',
        CEP: str(e, 'CEP') ?? '',
        fone: str(e, 'fone') ?? '',
        xPais: '',
      },
    },
    tot: pick(tot, ['qCTe', 'qNFe', 'qMDFe', 'vCarga', 'cUnid', 'qCarga'] as const),
    // Com cStat e sem nProt (retorno de rejeição), o protocolo fica, para a situação saber que não houve autorização.
    ...(str(infProt, 'nProt') || str(infProt, 'cStat')
      ? {
          prot: {
            nProt: str(infProt, 'nProt') ?? '',
            dhRecbto: str(infProt, 'dhRecbto') ?? '',
            cStat: str(infProt, 'cStat') ?? '',
          },
        }
      : {}),
    qrCode: str(rec(m.infMDFeSupl), 'qrCodMDFe') ?? '',
    RNTRC: str(antt, 'RNTRC') ?? '',
    veiculos: modal.rodo ? [veic(tracao), ...list(rodo.veicReboque).map(veic)] : [],
    condutores: list(tracao.condutor).map((c) => ({ CPF: str(c, 'CPF') ?? '', xNome: str(c, 'xNome') ?? '' })),
    valePed: list(rec(antt.valePed).disp).map((d) => ({
      CNPJForn: str(d, 'CNPJForn') ?? '',
      pagador: str(d, 'CNPJPg') ?? str(d, 'CPFPg') ?? '',
      nCompra: str(d, 'nCompra') ?? '',
    })),
    ...(aereo ? { aereo: pick(aereo, ['nac', 'matr', 'nVoo', 'cAerEmb', 'cAerDes', 'dVoo'] as const) } : {}),
    ...(aquav
      ? { aquav: pick(aquav, ['irin', 'tpEmb', 'cEmbar', 'xEmbar', 'nViag', 'cPrtEmb', 'cPrtDest'] as const) }
      : {}),
    ...(trem ? { ferrov: pick(trem, ['xPref', 'dhTrem', 'xOri', 'xDest', 'qVag'] as const) } : {}),
    docs,
    infAdFisco: str(adic, 'infAdFisco') ?? '',
    infCpl: str(adic, 'infCpl') ?? '',
  };
}

/** Lê o `mdfeProc` (ou o `MDFe` ainda sem protocolo) para o modelo de visualização do DAMDFE. */
export function readMdfe(xml: string): MdfeView {
  const doc = parse(xml);
  const { root, value } = decodeAs<mdfeProc | TMDFe>(
    doc,
    [mdfeProcElement as never, MDFeElement as never],
    'mdfeProc ou MDFe',
  );
  const proc = root === 'mdfeProc' ? (value as mdfeProc) : undefined;
  const m = proc ? proc.MDFe : (value as TMDFe);
  if (!m?.infMDFe) throw new ErroDa('campo_ausente', 'MDF-e sem infMDFe');
  return vista('MDF-e', () => view(m, proc));
}
