/**
 * Pedido de registro de evento (`pedRegEvento`, Anexo II): montagem validada no XSD vigente e assinatura por splice.
 *
 * O sinete monta o cancelamento (e101101) e a solicitação de análise fiscal para cancelamento (e101103), que são os
 * eventos do próprio emitente. O cancelamento por substituição (e105102) não é pedido pelo contribuinte: a Sefin o
 * registra sozinha quando recebe uma DPS com o grupo `subst` (ver `NfseClient.substituir`).
 */

import type { Ambiente, Clock, Signer, ValidationIssue } from '@sinete/core';
import { ConfigError, formatarVerProc, tpAmbOf } from '@sinete/core';
import { signXml } from '@sinete/core/xml';
import { SerializeError, serializeRoot } from '@sinete/schemas';
import type { TCInfPedReg, TSCodJustAnaliseFiscalCanc, TSCodJustCanc } from '@sinete/schemas/nfse/1.01-20260727';
import { DECLARACAO_XML, dataHora, validarNoSchema } from './build.ts';
import type { InscricaoFederal } from './codigos.ts';
import { idPedidoEvento, parseChaveNfse, TIPOS_EVENTO } from './codigos.ts';
import { leiauteVigente, VERSAO_LEIAUTE } from './leiaute.ts';
import { VERSAO_PACOTE } from './versao-gerada.ts';

export interface PedidoEventoOptions {
  readonly ambiente: Ambiente;
  /** Relógio de emissão: `dhEvento` e escolha do leiaute. */
  readonly clock: Clock;
  /** Versão do aplicativo (`verAplic`, até 20 caracteres). Padrão `sinete <versão do @sinete/nfse>` (`formatarVerProc`). */
  readonly verAplic?: string;
  /** Fuso do `dhEvento` em minutos. Padrão -180. */
  readonly offsetMinutes?: number;
}

/** Cancelamento (e101101): 1 erro na emissão, 2 serviço não prestado, 9 outros; motivo com 15 a 255 caracteres. */
export interface CancelamentoPedido {
  readonly chave: string;
  readonly autor: InscricaoFederal;
  readonly cMotivo: TSCodJustCanc;
  readonly xMotivo: string;
}

/** Solicitação de análise fiscal para cancelamento (e101103), quando o prazo de cancelamento do município passou. */
export interface AnaliseFiscalPedido {
  readonly chave: string;
  readonly autor: InscricaoFederal;
  readonly cMotivo: TSCodJustAnaliseFiscalCanc;
  readonly xMotivo: string;
}

export interface PedidoEventoMontado {
  readonly xml: string;
  /** Id do `infPedReg` (`PRE` + chave + código do evento). */
  readonly id: string;
  readonly chave: string;
  readonly tpEvento: string;
  readonly modulo: string;
}

export type PedidoEventoResult =
  | { readonly ok: true; readonly value: PedidoEventoMontado }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

type Detalhe = Pick<TCInfPedReg, 'e101101'> | Pick<TCInfPedReg, 'e101103'>;

function montar(
  chave: string,
  autor: InscricaoFederal,
  tpEvento: string,
  detalhe: Detalhe,
  options: PedidoEventoOptions,
): PedidoEventoResult {
  try {
    parseChaveNfse(chave);
  } catch (e) {
    return { ok: false, issues: [{ path: 'chave', code: 'chave_invalida', message: (e as Error).message }] };
  }
  const verAplic = options.verAplic ?? formatarVerProc('sinete', VERSAO_PACOTE);
  if (verAplic.length === 0 || verAplic.length > 20) throw new ConfigError('verAplic precisa ter de 1 a 20 caracteres');
  const { vigencia, leiaute } = leiauteVigente(options.ambiente, options.clock);
  const id = idPedidoEvento(chave, tpEvento);
  const inf = {
    Id: id,
    tpAmb: tpAmbOf(options.ambiente),
    verAplic,
    dhEvento: dataHora(options.clock, options.offsetMinutes),
    chNFSe: chave,
    ...(autor.CNPJ !== undefined ? { CNPJAutor: autor.CNPJ } : { CPFAutor: autor.CPF }),
    ...detalhe,
  } as TCInfPedReg;
  let corpo: string;
  try {
    corpo = serializeRoot(leiaute.pedRegEventoElement, { versao: VERSAO_LEIAUTE, infPedReg: inf });
  } catch (e) {
    if (!(e instanceof SerializeError)) throw e;
    return { ok: false, issues: [{ path: e.path, code: 'schema', message: e.message }] };
  }
  const xml = DECLARACAO_XML + corpo;
  const schema = validarNoSchema(leiaute.pedRegEventoElement, xml);
  if (schema.length > 0) return { ok: false, issues: schema };
  return { ok: true, value: { xml, id, chave, tpEvento, modulo: vigencia.modulo } };
}

/** Pedido de cancelamento da NFS-e (e101101). */
export function buildPedidoCancelamento(p: CancelamentoPedido, options: PedidoEventoOptions): PedidoEventoResult {
  return montar(
    p.chave,
    p.autor,
    TIPOS_EVENTO.cancelamento,
    { e101101: { xDesc: 'Cancelamento de NFS-e', cMotivo: p.cMotivo, xMotivo: p.xMotivo } },
    options,
  );
}

/** Pedido de análise fiscal para cancelamento (e101103). */
export function buildPedidoAnaliseFiscal(p: AnaliseFiscalPedido, options: PedidoEventoOptions): PedidoEventoResult {
  return montar(
    p.chave,
    p.autor,
    TIPOS_EVENTO.solicitacaoAnaliseFiscal,
    {
      e101103: {
        xDesc: 'Solicitação de Análise Fiscal para Cancelamento de NFS-e',
        cMotivo: p.cMotivo,
        xMotivo: p.xMotivo,
      },
    },
    options,
  );
}

/** Assina o pedido (Reference para o `infPedReg`). A string devolvida é a que vai para a Sefin. */
export async function signPedidoEvento(pedido: PedidoEventoMontado, signer: Signer): Promise<string> {
  return signXml(pedido.xml, { id: pedido.id }, signer);
}
