/**
 * Pedido de registro de evento (`pedRegEvento`, Anexo II): montagem validada no XSD vigente e assinatura por splice.
 *
 * O sinete monta o cancelamento (e101101) e a solicitação de análise fiscal para cancelamento (e101103), que são os
 * eventos do próprio emitente. O cancelamento por substituição (e105102) não é pedido pelo contribuinte: a Sefin o
 * registra sozinha quando recebe uma DPS com o grupo `subst` (ver `ClienteNfse.substituir`).
 */

import type { Ambiente, Assinador, Ocorrencia, Relogio } from '@sinete/core';
import { ErroDeConfiguracao, formatarVerProc, tpAmbDoAmbiente } from '@sinete/core';
import { assinarXml } from '@sinete/core/xml';
import { ErroSerializacao, serializarRaiz } from '@sinete/schemas';
import type { TCInfPedReg, TSCodJustAnaliseFiscalCanc, TSCodJustCanc } from '@sinete/schemas/nfse/1.01-20260727';
import { DECLARACAO_XML, dataHora, validarNoSchema } from './build.ts';
import type { InscricaoFederal } from './codigos.ts';
import { idPedidoEvento, lerChaveNfse, TIPOS_EVENTO } from './codigos.ts';
import { leiauteVigente, VERSAO_LEIAUTE } from './leiaute.ts';
import { VERSAO_PACOTE } from './versao-gerada.ts';

export interface PedidoEventoOpcoes {
  readonly ambiente: Ambiente;
  /** Relógio de emissão: `dhEvento` e escolha do leiaute. */
  readonly relogio: Relogio;
  /** Versão do aplicativo (`verAplic`, até 20 caracteres). Padrão `sinete <versão do @sinete/nfse>` (`formatarVerProc`). */
  readonly verAplic?: string;
  /** Fuso do `dhEvento` em minutos. Padrão -180. */
  readonly deslocamentoMin?: number;
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

export type ResultadoPedidoEvento =
  | { readonly ok: true; readonly valor: PedidoEventoMontado }
  | { readonly ok: false; readonly ocorrencias: readonly Ocorrencia[] };

type Detalhe = Pick<TCInfPedReg, 'e101101'> | Pick<TCInfPedReg, 'e101103'>;

function montar(
  chave: string,
  autor: InscricaoFederal,
  tpEvento: string,
  detalhe: Detalhe,
  options: PedidoEventoOpcoes,
): ResultadoPedidoEvento {
  try {
    lerChaveNfse(chave);
  } catch (e) {
    return { ok: false, ocorrencias: [{ caminho: 'chave', code: 'chave_invalida', mensagem: (e as Error).message }] };
  }
  const verAplic = options.verAplic ?? formatarVerProc('sinete', VERSAO_PACOTE);
  if (verAplic.length === 0 || verAplic.length > 20)
    throw new ErroDeConfiguracao('verAplic precisa ter de 1 a 20 caracteres');
  const { vigencia, leiaute } = leiauteVigente(options.ambiente, options.relogio);
  const id = idPedidoEvento(chave, tpEvento);
  const inf = {
    Id: id,
    tpAmb: tpAmbDoAmbiente(options.ambiente),
    verAplic,
    dhEvento: dataHora(options.relogio, options.deslocamentoMin),
    chNFSe: chave,
    ...(autor.CNPJ !== undefined ? { CNPJAutor: autor.CNPJ } : { CPFAutor: autor.CPF }),
    ...detalhe,
  } as TCInfPedReg;
  let corpo: string;
  try {
    corpo = serializarRaiz(leiaute.pedRegEventoElement, { versao: VERSAO_LEIAUTE, infPedReg: inf });
  } catch (e) {
    if (!(e instanceof ErroSerializacao)) throw e;
    return { ok: false, ocorrencias: [{ caminho: e.caminho, code: 'schema', mensagem: e.message }] };
  }
  const xml = DECLARACAO_XML + corpo;
  const schema = validarNoSchema(leiaute.pedRegEventoElement, xml);
  if (schema.length > 0) return { ok: false, ocorrencias: schema };
  return { ok: true, valor: { xml, id, chave, tpEvento, modulo: vigencia.modulo } };
}

/** Pedido de cancelamento da NFS-e (e101101). */
export function montarPedidoCancelamento(p: CancelamentoPedido, opcoes: PedidoEventoOpcoes): ResultadoPedidoEvento {
  return montar(
    p.chave,
    p.autor,
    TIPOS_EVENTO.cancelamento,
    { e101101: { xDesc: 'Cancelamento de NFS-e', cMotivo: p.cMotivo, xMotivo: p.xMotivo } },
    opcoes,
  );
}

/** Pedido de análise fiscal para cancelamento (e101103). */
export function montarPedidoAnaliseFiscal(p: AnaliseFiscalPedido, opcoes: PedidoEventoOpcoes): ResultadoPedidoEvento {
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
    opcoes,
  );
}

/** Assina o pedido (Reference para o `infPedReg`). A string devolvida é a que vai para a Sefin. */
export async function assinarPedidoEvento(pedido: PedidoEventoMontado, assinador: Assinador): Promise<string> {
  return assinarXml(pedido.xml, { id: pedido.id }, assinador);
}
