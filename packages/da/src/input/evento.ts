/**
 * Eventos da NF-e lidos do `procEventoNFe`: a Carta de Correção (110110) para o DACCE e o cancelamento (110111) ou
 * o cancelamento por substituição da NFC-e (110112) para o carimbo de nota cancelada. O envelope é o do PL_010d
 * (NT 2026.004); o `detEvento` de cada tipo vem do módulo do próprio evento.
 */

import { procEventoNFeElement as cancElement } from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import { procEventoNFeElement as cancSubstElement } from '@sinete/schemas/nfe/evento-cancelamento-substituicao/PL_010d';
import { procEventoNFeElement as cceElement } from '@sinete/schemas/nfe/evento-cce/PL_010d';
import { ErroDa } from '../errors.ts';
import type { Rec } from './xml.ts';
import { decodeAs, parse, str } from './xml.ts';

export interface EventoView {
  readonly tpEvento: string;
  readonly chNFe: string;
  readonly cOrgao: string;
  readonly tpAmb: string;
  readonly autor: string;
  readonly dhEvento: string;
  readonly nSeqEvento: string;
  readonly det: Rec;
  readonly ret?: {
    readonly cStat: string;
    readonly xMotivo: string;
    readonly nProt: string;
    readonly dhRegEvento: string;
  };
}

/**
 * Lê um `procEventoNFe` do tipo pedido. O `tpEvento` escolhe o módulo do `detEvento`;
 * evento de outro tipo é `evento_incompativel`.
 */
export function readEvento(xml: string, tipos: readonly string[]): EventoView {
  const doc = parse(xml);
  // O envelope é o mesmo nos três módulos: a primeira leitura só descobre o tipo, que escolhe o módulo do detEvento.
  const envelope = decodeAs<Rec>(doc, [cancElement as never], 'procEventoNFe').value;
  const tp = str((envelope.evento as Rec | undefined)?.infEvento as Rec | undefined, 'tpEvento');
  const element = tp === '110110' ? cceElement : tp === '110112' ? cancSubstElement : cancElement;
  const value = element === cancElement ? envelope : decodeAs<Rec>(doc, [element as never], 'procEventoNFe').value;
  const inf = ((value.evento as Rec | undefined)?.infEvento ?? {}) as Rec;
  const tpEvento = str(inf, 'tpEvento') ?? '';
  if (!tipos.includes(tpEvento)) {
    throw new ErroDa('evento_incompativel', `evento ${tpEvento || 'sem tipo'} não é ${tipos.join(' nem ')}`, {
      detalhes: { tpEvento, esperado: tipos },
    });
  }
  const ret = ((value.retEvento as Rec | undefined)?.infEvento ?? undefined) as Rec | undefined;
  return {
    tpEvento,
    chNFe: str(inf, 'chNFe') ?? '',
    cOrgao: str(inf, 'cOrgao') ?? '',
    tpAmb: str(inf, 'tpAmb') ?? '',
    autor: str(inf, 'CNPJ') ?? str(inf, 'CPF') ?? '',
    dhEvento: str(inf, 'dhEvento') ?? '',
    nSeqEvento: str(inf, 'nSeqEvento') ?? '',
    det: (inf.detEvento ?? {}) as Rec,
    ...(ret
      ? {
          ret: {
            cStat: str(ret, 'cStat') ?? '',
            xMotivo: str(ret, 'xMotivo') ?? '',
            nProt: str(ret, 'nProt') ?? '',
            dhRegEvento: str(ret, 'dhRegEvento') ?? '',
          },
        }
      : {}),
  };
}
