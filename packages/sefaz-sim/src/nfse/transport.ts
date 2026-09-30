/**
 * Redireciona ao simulador da NFS-e os pedidos que um cliente (o `@sinete/nfse`) resolveu pelos dados de endpoints do
 * `@sinete/transport`: a base de cada API (`nfseEndpoint`) vira `baseUrl` + o prefixo da API no simulador, e o resto
 * do caminho segue igual. Pedido sem `endpoint`, de outro documento ou fora da base da API é `ConfigError`: nada
 * escapa para a Sefin ou o ADN reais.
 */

import { ErroDeConfiguracao } from '@sinete/core';
import type { EndpointRef, NfseApi, Transport, TransportRequest, TransportResponse } from '@sinete/transport';
import { NFSE_SIM_PREFIXOS } from './sim.ts';

export function redirectNfseToSim(transport: Transport, baseUrl: string): Transport {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new ErroDeConfiguracao(`baseUrl do simulador precisa ser https: ${baseUrl}`);
  return {
    capabilities: transport.capabilities,
    send(request: TransportRequest): Promise<TransportResponse> {
      const ep = request.endpoint;
      if (ep === undefined || ep.documento !== 'nfse' || !Object.hasOwn(NFSE_SIM_PREFIXOS, ep.servico)) {
        return Promise.reject(new ErroDeConfiguracao(`o simulador da NFS-e não atende este pedido: ${request.url}`));
      }
      const raiz = ep.url.replace(/\/+$/, '');
      if (!request.url.startsWith(raiz)) {
        return Promise.reject(new ErroDeConfiguracao(`URL fora da base da API ${ep.servico}: ${request.url}`));
      }
      const url = `${base.origin}${NFSE_SIM_PREFIXOS[ep.servico as NfseApi]}${request.url.slice(raiz.length)}`;
      const endpoint: EndpointRef = {
        ...ep,
        url: `${base.origin}${NFSE_SIM_PREFIXOS[ep.servico as NfseApi]}`,
        host: base.hostname,
        tls: undefined,
      };
      return transport.send({ ...request, url, endpoint });
    },
    close: (): Promise<void> => transport.close(),
  };
}
