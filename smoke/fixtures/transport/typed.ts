// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { EndpointRef, HostPolicy, TlsIdentity, Transport, TransportCapabilities, TransportErrorCode } from '@sinete/transport';
import { allowlistPolicy, createTransport, nfeEndpoint } from '@sinete/transport';

export async function usar(identity: TlsIdentity): Promise<number> {
  const policy: HostPolicy = allowlistPolicy({ hosts: ['homologacao.nfe.fazenda.sp.gov.br'], tpAmb: '2' });
  const endpoint: EndpointRef = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
  const t: Transport = createTransport({ identity, policy });
  const caps: TransportCapabilities = t.capabilities;
  const code: TransportErrorCode = 'certificado_recusado';
  // @ts-expect-error serviço fora do portal
  nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeInexistente' });
  const r = await t.send({ url: endpoint.url, endpoint, body: '<x/>' });
  return caps.renegotiation && code ? r.status : 0;
}
