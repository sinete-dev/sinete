// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { EndpointResolvido, PoliticaDeHosts, IdentidadeTls, Transporte, CapacidadesDoTransporte, CodigoErroTransporte } from '@sinete/transport';
import { politicaDeHostsPermitidos, criarTransporte, nfeEndpoint } from '@sinete/transport';

export async function usar(identity: IdentidadeTls): Promise<number> {
  const policy: PoliticaDeHosts = politicaDeHostsPermitidos({ hosts: ['homologacao.nfe.fazenda.sp.gov.br'], tpAmb: '2' });
  const endpoint: EndpointResolvido = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
  const t: Transporte = criarTransporte({ identidade: identity, politica: policy });
  const caps: CapacidadesDoTransporte = t.capacidades;
  const code: CodigoErroTransporte = 'certificado_recusado';
  // @ts-expect-error serviço fora do portal
  nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeInexistente' });
  const r = await t.enviar({ url: endpoint.url, endpoint, corpo: '<x/>' });
  return caps.renegociacao && code ? r.status : 0;
}
