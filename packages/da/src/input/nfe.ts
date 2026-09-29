/**
 * NF-e (modelo 55) e NFC-e (modelo 65) lidas do `nfeProc` autorizado, ou do `NFe` assinado quando o documento
 * auxiliar sai antes da autorização (contingência). Leitura pelo PL_010f, o mais novo: ele cobre os grupos de IBS/CBS
 * (NT 2025.002) e o decoder tolerante aceita documentos de PL anteriores.
 */

import type {
  TEnderEmi,
  TEndereco,
  TLocal,
  TNFe,
  TNFe_infNFe,
  TNFe_infNFe_det,
  TNfeProc,
} from '@sinete/schemas/nfe/PL_010f';
import { NFeElement, nfeProcElement } from '@sinete/schemas/nfe/PL_010f';
import { DanfeError } from '../errors.ts';
import type { Rec } from './xml.ts';
import { choice, decodeAs, parse, str, vista } from './xml.ts';

export interface EnderecoView {
  readonly xLgr: string;
  readonly nro: string;
  readonly xCpl: string;
  readonly xBairro: string;
  readonly xMun: string;
  readonly UF: string;
  readonly CEP: string;
  readonly fone: string;
  readonly xPais: string;
}

export interface ItemView {
  readonly nItem: string;
  readonly cProd: string;
  readonly cEAN: string;
  readonly xProd: string;
  readonly NCM: string;
  /** CST com a origem na frente (`000`) ou CSOSN (`0102`), como impresso no DANFE. */
  readonly cst: string;
  readonly CFOP: string;
  readonly uCom: string;
  readonly qCom: string;
  readonly vUnCom: string;
  readonly uTrib: string;
  readonly qTrib: string;
  readonly vUnTrib: string;
  readonly vProd: string;
  readonly vDesc: string;
  readonly vFrete: string;
  readonly vSeg: string;
  readonly vOutro: string;
  readonly vBC: string;
  readonly vICMS: string;
  readonly pICMS: string;
  readonly vBCST: string;
  readonly vICMSST: string;
  readonly vIPI: string;
  readonly pIPI: string;
  readonly vTotTrib: string;
  readonly infAdProd: string;
}

export interface IbsCbsTotView {
  readonly vBCIBSCBS: string;
  readonly vIBSUF: string;
  readonly vIBSMun: string;
  readonly vIBS: string;
  readonly vCBS: string;
  /** Total do Imposto Seletivo (`ISTot/vIS`), quando houver. */
  readonly vIS: string;
  /** Total da NF-e com IBS, CBS e IS (`vNFTot`), quando informado. */
  readonly vNFTot: string;
}

export interface NotaView {
  readonly chave: string;
  readonly mod: string;
  readonly serie: string;
  readonly nNF: string;
  readonly dhEmi: string;
  readonly dhSaiEnt: string;
  readonly tpNF: string;
  readonly tpImp: string;
  readonly tpEmis: string;
  readonly tpAmb: string;
  readonly natOp: string;
  readonly indPres: string;
  readonly emit: {
    readonly xNome: string;
    readonly xFant: string;
    readonly doc: string;
    readonly IE: string;
    readonly IEST: string;
    readonly IM: string;
    readonly ender: EnderecoView;
  };
  readonly dest?: {
    readonly xNome: string;
    readonly doc: string;
    readonly tipoDoc: 'CNPJ' | 'CPF' | 'idEstrangeiro' | '';
    readonly IE: string;
    readonly ender?: EnderecoView;
  };
  readonly retirada?: LocalView;
  readonly entrega?: LocalView;
  readonly itens: readonly ItemView[];
  readonly tot: Readonly<Record<string, string>>;
  readonly issqn?: { readonly vServ: string; readonly vBC: string; readonly vISS: string };
  readonly ibscbs?: IbsCbsTotView;
  readonly transp: {
    readonly modFrete: string;
    readonly xNome: string;
    readonly doc: string;
    readonly IE: string;
    readonly xEnder: string;
    readonly xMun: string;
    readonly UF: string;
    readonly placa: string;
    readonly placaUF: string;
    readonly RNTC: string;
    readonly vol: readonly Readonly<Record<'qVol' | 'esp' | 'marca' | 'nVol' | 'pesoL' | 'pesoB', string>>[];
  };
  readonly fat?: { readonly nFat: string; readonly vOrig: string; readonly vDesc: string; readonly vLiq: string };
  readonly dup: readonly { readonly nDup: string; readonly dVenc: string; readonly vDup: string }[];
  readonly pag: readonly { readonly tPag: string; readonly xPag: string; readonly vPag: string }[];
  readonly vTroco: string;
  readonly infAdFisco: string;
  readonly infCpl: string;
  readonly prot?: { readonly nProt: string; readonly dhRecbto: string; readonly cStat: string };
  readonly qrCode: string;
  readonly urlChave: string;
}

export interface LocalView {
  readonly doc: string;
  readonly xNome: string;
  readonly IE: string;
  readonly ender: EnderecoView;
}

function ender(e: TEnderEmi | TEndereco | TLocal | undefined): EnderecoView {
  const r = (e ?? {}) as Rec;
  return {
    xLgr: str(r, 'xLgr') ?? '',
    nro: str(r, 'nro') ?? '',
    xCpl: str(r, 'xCpl') ?? '',
    xBairro: str(r, 'xBairro') ?? '',
    xMun: str(r, 'xMun') ?? '',
    UF: str(r, 'UF') ?? '',
    CEP: str(r, 'CEP') ?? '',
    fone: str(r, 'fone') ?? '',
    xPais: str(r, 'xPais') ?? '',
  };
}

function local(l: TLocal): LocalView {
  const r = l as Rec;
  return {
    doc: str(r, 'CNPJ') ?? str(r, 'CPF') ?? '',
    xNome: str(r, 'xNome') ?? '',
    IE: str(r, 'IE') ?? '',
    ender: ender(l),
  };
}

function item(d: TNFe_infNFe_det): ItemView {
  const p = (d.prod ?? {}) as Rec;
  const imp = (d.imposto ?? {}) as Rec;
  const icms = choice(imp.ICMS);
  const ipi = (imp.IPI ?? {}) as Rec;
  const ipiTrib = (ipi.IPITrib ?? {}) as Rec;
  const cst = str(icms, 'CST') ?? str(icms, 'CSOSN') ?? '';
  return {
    nItem: d.nItem,
    cProd: str(p, 'cProd') ?? '',
    cEAN: str(p, 'cEAN') ?? '',
    xProd: str(p, 'xProd') ?? '',
    NCM: str(p, 'NCM') ?? '',
    cst: cst ? `${str(icms, 'orig') ?? ''}${cst}` : '',
    CFOP: str(p, 'CFOP') ?? '',
    uCom: str(p, 'uCom') ?? '',
    qCom: str(p, 'qCom') ?? '',
    vUnCom: str(p, 'vUnCom') ?? '',
    uTrib: str(p, 'uTrib') ?? '',
    qTrib: str(p, 'qTrib') ?? '',
    vUnTrib: str(p, 'vUnTrib') ?? '',
    vProd: str(p, 'vProd') ?? '',
    vDesc: str(p, 'vDesc') ?? '',
    vFrete: str(p, 'vFrete') ?? '',
    vSeg: str(p, 'vSeg') ?? '',
    vOutro: str(p, 'vOutro') ?? '',
    vBC: str(icms, 'vBC') ?? '',
    vICMS: str(icms, 'vICMS') ?? '',
    pICMS: str(icms, 'pICMS') ?? '',
    vBCST: str(icms, 'vBCST') ?? '',
    vICMSST: str(icms, 'vICMSST') ?? '',
    vIPI: str(ipiTrib, 'vIPI') ?? '',
    pIPI: str(ipiTrib, 'pIPI') ?? '',
    vTotTrib: str(imp, 'vTotTrib') ?? '',
    infAdProd: d.infAdProd ?? '',
  };
}

function view(nfe: TNFe, proc: TNfeProc | undefined): NotaView {
  const inf: TNFe_infNFe = nfe.infNFe;
  const ide = inf.ide as Rec;
  const emit = inf.emit as Rec;
  const dest = inf.dest as Rec | undefined;
  const tot = inf.total;
  const transp: Partial<TNFe_infNFe['transp']> = inf.transp ?? {};
  const transporta = (transp.transporta ?? {}) as Rec;
  const veic = (transp.veicTransp ?? {}) as Rec;
  const ibs = tot.IBSCBSTot;
  const destDoc = dest ? (str(dest, 'CNPJ') ?? str(dest, 'CPF') ?? str(dest, 'idEstrangeiro')) : undefined;
  const destTipo = !dest
    ? ''
    : str(dest, 'CNPJ') !== undefined
      ? 'CNPJ'
      : str(dest, 'CPF') !== undefined
        ? 'CPF'
        : str(dest, 'idEstrangeiro') !== undefined
          ? 'idEstrangeiro'
          : '';
  const infProt = proc?.protNFe?.infProt;
  const cobr = inf.cobr;
  return {
    chave: (inf.Id ?? '').replace(/^NFe/, ''),
    mod: str(ide, 'mod') ?? '',
    serie: str(ide, 'serie') ?? '',
    nNF: str(ide, 'nNF') ?? '',
    dhEmi: str(ide, 'dhEmi') ?? '',
    dhSaiEnt: str(ide, 'dhSaiEnt') ?? '',
    tpNF: str(ide, 'tpNF') ?? '',
    tpImp: str(ide, 'tpImp') ?? '',
    tpEmis: str(ide, 'tpEmis') ?? '',
    tpAmb: str(ide, 'tpAmb') ?? '',
    natOp: str(ide, 'natOp') ?? '',
    indPres: str(ide, 'indPres') ?? '',
    emit: {
      xNome: str(emit, 'xNome') ?? '',
      xFant: str(emit, 'xFant') ?? '',
      doc: str(emit, 'CNPJ') ?? str(emit, 'CPF') ?? '',
      IE: str(emit, 'IE') ?? '',
      IEST: str(emit, 'IEST') ?? '',
      IM: str(emit, 'IM') ?? '',
      ender: ender(inf.emit.enderEmit),
    },
    ...(dest
      ? {
          dest: {
            xNome: str(dest, 'xNome') ?? '',
            doc: destDoc ?? '',
            tipoDoc: destTipo,
            IE: str(dest, 'IE') ?? '',
            ...(inf.dest?.enderDest ? { ender: ender(inf.dest.enderDest) } : {}),
          },
        }
      : {}),
    ...(inf.retirada ? { retirada: local(inf.retirada) } : {}),
    ...(inf.entrega ? { entrega: local(inf.entrega) } : {}),
    itens: (inf.det ?? []).map(item),
    tot: Object.fromEntries(Object.entries(tot.ICMSTot).filter((e): e is [string, string] => typeof e[1] === 'string')),
    ...(tot.ISSQNtot
      ? { issqn: { vServ: tot.ISSQNtot.vServ ?? '', vBC: tot.ISSQNtot.vBC ?? '', vISS: tot.ISSQNtot.vISS ?? '' } }
      : {}),
    ...(ibs || tot.ISTot
      ? {
          ibscbs: {
            vBCIBSCBS: ibs?.vBCIBSCBS ?? '',
            vIBSUF: ibs?.gIBS?.gIBSUF?.vIBSUF ?? '',
            vIBSMun: ibs?.gIBS?.gIBSMun?.vIBSMun ?? '',
            vIBS: ibs?.gIBS?.vIBS ?? '',
            vCBS: ibs?.gCBS?.vCBS ?? '',
            vIS: tot.ISTot?.vIS ?? '',
            vNFTot: tot.vNFTot ?? '',
          },
        }
      : {}),
    transp: {
      modFrete: transp.modFrete ?? '',
      xNome: str(transporta, 'xNome') ?? '',
      doc: str(transporta, 'CNPJ') ?? str(transporta, 'CPF') ?? '',
      IE: str(transporta, 'IE') ?? '',
      xEnder: str(transporta, 'xEnder') ?? '',
      xMun: str(transporta, 'xMun') ?? '',
      UF: str(transporta, 'UF') ?? '',
      placa: str(veic, 'placa') ?? '',
      placaUF: str(veic, 'UF') ?? '',
      RNTC: str(veic, 'RNTC') ?? '',
      vol: (transp.vol ?? []).map((v) => ({
        qVol: v.qVol ?? '',
        esp: v.esp ?? '',
        marca: v.marca ?? '',
        nVol: v.nVol ?? '',
        pesoL: v.pesoL ?? '',
        pesoB: v.pesoB ?? '',
      })),
    },
    ...(cobr?.fat
      ? {
          fat: {
            nFat: cobr.fat.nFat ?? '',
            vOrig: cobr.fat.vOrig ?? '',
            vDesc: cobr.fat.vDesc ?? '',
            vLiq: cobr.fat.vLiq ?? '',
          },
        }
      : {}),
    dup: (cobr?.dup ?? []).map((d) => ({ nDup: d.nDup ?? '', dVenc: d.dVenc ?? '', vDup: d.vDup })),
    pag: (inf.pag?.detPag ?? []).map((p) => ({ tPag: p.tPag, xPag: p.xPag ?? '', vPag: p.vPag })),
    vTroco: inf.pag?.vTroco ?? '',
    infAdFisco: inf.infAdic?.infAdFisco ?? '',
    infCpl: inf.infAdic?.infCpl ?? '',
    // Com cStat e sem nProt (retorno de rejeição), o protocolo fica, para a situação saber que não houve autorização.
    ...(infProt?.nProt || infProt?.cStat
      ? { prot: { nProt: infProt.nProt ?? '', dhRecbto: infProt.dhRecbto ?? '', cStat: infProt.cStat ?? '' } }
      : {}),
    qrCode: nfe.infNFeSupl?.qrCode ?? '',
    urlChave: nfe.infNFeSupl?.urlChave ?? '',
  };
}

/** Lê o `nfeProc` (ou o `NFe` ainda sem protocolo) para o modelo de visualização dos layouts. */
export function readNota(xml: string): NotaView {
  const doc = parse(xml);
  const { root, value } = decodeAs<TNfeProc | TNFe>(
    doc,
    [nfeProcElement as never, NFeElement as never],
    'nfeProc ou NFe',
  );
  const proc = root === 'nfeProc' ? (value as TNfeProc) : undefined;
  const nfe = proc ? proc.NFe : (value as TNFe);
  if (!nfe?.infNFe?.ide || !nfe.infNFe.emit || !nfe.infNFe.total?.ICMSTot) {
    throw new DanfeError('campo_ausente', 'NF-e sem infNFe, ide, emit ou total');
  }
  return vista('NF-e', () => view(nfe, proc));
}
