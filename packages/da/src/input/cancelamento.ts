/** Cancelamento da NF-e ou da NFC-e para o carimbo, a partir do `procEventoNFe` do evento ou de `true`. */

import { ErroDa } from '../errors.ts';
import type { Cancelamento } from '../layout/marcas.ts';
import { readEvento } from './evento.ts';
import type { NotaView } from './nfe.ts';

/** Eventos de cancelamento registrados: 135 (vinculado), 136 (não vinculado) e 155 (fora de prazo). */
const REGISTRADO = new Set(['135', '136', '155']);

/**
 * NF-e ou NFC-e cancelada: o `procEventoNFe` do cancelamento (110111) ou do cancelamento por substituição (110112), que
 * dá o protocolo ao carimbo, ou `true` para carimbar sem protocolo.
 */
export function cancelamentoNfe(nota: NotaView, c: string | true | undefined): Cancelamento | undefined {
  if (c === undefined) return undefined;
  if (c === true) return {};
  const ev = readEvento(c, ['110111', '110112']);
  if (ev.chNFe !== nota.chave) {
    throw new ErroDa('evento_incompativel', 'o cancelamento é de outra NF-e', {
      detalhes: { chave: nota.chave, chaveEvento: ev.chNFe },
    });
  }
  if (!ev.ret || !REGISTRADO.has(ev.ret.cStat)) {
    throw new ErroDa('evento_incompativel', 'cancelamento sem retorno de evento registrado', {
      detalhes: { cStat: ev.ret?.cStat ?? '' },
    });
  }
  return { nProt: ev.ret.nProt, dhRegEvento: ev.ret.dhRegEvento };
}
