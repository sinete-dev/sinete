/** Leitura de `data/cstat.json`: os códigos que o emissor trata de forma própria em cada documento. */

import tabela from './data/cstat.json' with { type: 'json' };
import type { TipoDocumento } from './desfecho.ts';

export interface CodigosDoDocumento {
  /** Duplicidade no envio: a consulta decide. */
  readonly duplicidade: ReadonlySet<string>;
  /** Recusa que mantém os bytes: a duplicidade que a consulta não resolveu e o lote em processamento. */
  readonly indefinido: ReadonlySet<string>;
  /** Resposta a um pedido de evento que pode já estar registrado: a consulta confirma. */
  readonly eventoJaRegistrado: ReadonlySet<string>;
  /** Recusa do serviço, não da nota (paralisado, erro não catalogado): não barra o reenvio dos mesmos bytes. */
  readonly transitorio: ReadonlySet<string>;
  /**
   * Recusa que pode ser corrigida só no que muda sozinho a cada montagem (data e hora de emissão, código numérico da
   * chave, assinatura, QR Code): a barreira da recusa repetida compara os bytes dela, não o conteúdo.
   */
  readonly campoVolatil: ReadonlySet<string>;
  /** Serviço paralisado (108, 109): falha do autorizador na contingência automática (ADR 0013). */
  readonly paralisado: ReadonlySet<string>;
}

/**
 * Status do evento da NFS-e recuperado pela consulta: a Sefin registra o evento sem código de situação, e o
 * `@sinete/nfse` usa esta convenção no desfecho do registro.
 */
export const eventoRegistradoNfse: { readonly cStat: string; readonly xMotivo: string } = {
  cStat: tabela.nfse.eventoRegistrado.cStat,
  xMotivo: tabela.nfse.eventoRegistrado.xMotivo,
};

/**
 * Códigos da SVC da NF-e (NT 2013.007 v1.03, item 04.7): `desativando` (113) na consulta de status e `desativada` (114)
 * na consulta de status e na autorização.
 */
export const codigosSvc: { readonly desativando: ReadonlySet<string>; readonly desativada: ReadonlySet<string> } = {
  desativando: new Set(tabela.svc.desativando),
  desativada: new Set(tabela.svc.desativada),
};

export function codigosDe(tipo: TipoDocumento): CodigosDoDocumento {
  const t = tabela[tipo];
  return {
    duplicidade: new Set(t.duplicidade),
    indefinido: new Set([...t.duplicidade, ...t.loteEmProcessamento]),
    eventoJaRegistrado: new Set(t.eventoJaRegistrado),
    transitorio: new Set(t.transitorio),
    campoVolatil: new Set(t.campoVolatil),
    paralisado: new Set(t.paralisado),
  };
}
