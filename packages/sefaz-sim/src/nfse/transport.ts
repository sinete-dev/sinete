/**
 * Redireciona ao simulador da NFS-e os pedidos que um cliente (o `@sinete/nfse`) resolveu pelos dados de endpoints do
 * `@sinete/transport`: a base de cada API (`nfseEndpoint`) vira `urlBase` + o prefixo da API no simulador, e o resto
 * do caminho segue igual. Pedido sem `endpoint`, de outro documento ou fora da base da API é `ErroDeConfiguracao`: nada
 * escapa para a Sefin ou o ADN reais.
 */

import { ErroDeConfiguracao } from '@sinete/core';
import type { EndpointResolvido, NfseApi, PedidoTransporte, RespostaTransporte, Transporte } from '@sinete/transport';
import { NFSE_SIM_PREFIXOS } from './sim.ts';

export function redirecionarNfseParaSim(transporte: Transporte, urlBase: string): Transporte {
  const base = new URL(urlBase);
  if (base.protocol !== 'https:') throw new ErroDeConfiguracao(`urlBase do simulador precisa ser https: ${urlBase}`);
  return {
    capacidades: transporte.capacidades,
    enviar(request: PedidoTransporte): Promise<RespostaTransporte> {
      const ep = request.endpoint;
      if (ep === undefined || ep.documento !== 'nfse' || !Object.hasOwn(NFSE_SIM_PREFIXOS, ep.servico)) {
        return Promise.reject(new ErroDeConfiguracao(`o simulador da NFS-e não atende este pedido: ${request.url}`));
      }
      const raiz = ep.url.replace(/\/+$/, '');
      if (!request.url.startsWith(raiz)) {
        return Promise.reject(new ErroDeConfiguracao(`URL fora da base da API ${ep.servico}: ${request.url}`));
      }
      const url = `${base.origin}${NFSE_SIM_PREFIXOS[ep.servico as NfseApi]}${request.url.slice(raiz.length)}`;
      const endpoint: EndpointResolvido = {
        ...ep,
        url: `${base.origin}${NFSE_SIM_PREFIXOS[ep.servico as NfseApi]}`,
        host: base.hostname,
        tls: undefined,
      };
      return transporte.enviar({ ...request, url, endpoint });
    },
    fechar: (): Promise<void> => transporte.fechar(),
  };
}
