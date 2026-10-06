/**
 * Recuperação de um evento que a Sefin registrou e cuja resposta se perdeu.
 *
 * Um pedido de evento sem resposta (timeout, conexão caída), ou recusado com E0840 (evento já vinculado à NFS-e, Anexo
 * II, aba RN EVENTOSxEVENTOS), pode ter sido registrado. O código sozinho não prova: a E0840 diz que algum evento já
 * está vinculado, que pode ser outro (a substituição, por exemplo). A prova é a consulta dos eventos da chave, com o
 * tipo e a sequência, que é o único caminho que a Sefin atende (ADR 0004, rodada 4).
 */

import type { ClienteNfse, EnvioOpcoes, EventoRegistrado } from './client.ts';

/** Resultado da recuperação: o evento registrado, ou que a consulta não o mostrou. */
export type RecuperacaoEvento =
  | { readonly registrado: true; readonly evento: EventoRegistrado }
  | { readonly registrado: false };

/**
 * Consulta os eventos da chave e devolve o evento `tpEvento`, na sequência `nSeqEvento` (o cancelamento, e101101, é
 * sempre a 1), que a Sefin registrou para ela. Serve depois de um pedido de evento sem resposta ou recusado com E0840:
 * nunca conclua que o evento existe só pelo código do pedido. `registrado: false` quer dizer que a Sefin respondeu sem
 * esse evento; falha de rede, resposta fora do contrato e `opcoes.signal` cancelado lançam, como no `consultarEventos`,
 * e nunca viram `registrado: false`.
 */
export async function recuperarEventoRegistrado(
  cliente: ClienteNfse,
  chave: string,
  tpEvento: string,
  nSeqEvento = 1,
  opcoes?: EnvioOpcoes,
): Promise<RecuperacaoEvento> {
  const eventos = await cliente.consultarEventos(chave, { tpEvento, nSeqEvento }, opcoes);
  const achado = eventos.find(
    (e) => e.chaveAcesso === chave && e.tpEvento === tpEvento && Number(e.nSeqEvento) === nSeqEvento,
  );
  return achado === undefined ? { registrado: false } : { registrado: true, evento: achado };
}
