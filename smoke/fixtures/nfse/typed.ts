// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Ocorrencia } from '@sinete/core';
import type {
  ResultadoMontagemDps,
  CacheParametros,
  DadosDps,
  ClienteNfse,
  ResultadoNfse,
  NfseGerada,
  ResolucaoEnvio,
} from '@sinete/nfse';
import { cacheEmMemoria, TIPOS_EVENTO } from '@sinete/nfse';

const entrada: DadosDps = {
  serie: '1',
  nDPS: '1',
  cLocEmi: '3550308',
  prestador: { CNPJ: '11222333000181', regTrib: { opSimpNac: '3', regEspTrib: '0' } },
  servico: { local: { cLocPrestacao: '3550308' }, cTribNac: '01.01.01', xDescServ: 'Serviço' },
  valores: { vServ: '10.00' },
  tributacao: { issqn: { tribISSQN: '1', tpRetISSQN: '1' } },
};
// @ts-expect-error tribISSQN só aceita os códigos do leiaute
const errada: DadosDps = { ...entrada, tributacao: { issqn: { tribISSQN: '9', tpRetISSQN: '1' } } };
declare const r: ResultadoMontagemDps;
declare const client: ClienteNfse;
declare const desfecho: ResultadoNfse<NfseGerada>;
declare const resolucao: ResolucaoEnvio;
if (!r.ok) {
  const issues: readonly Ocorrencia[] = r.ocorrencias;
  void issues;
}
if (desfecho.tipo === 'recusado') {
  const codigos: readonly string[] = desfecho.erros.map((e) => e.codigo);
  void codigos;
}
const cache: CacheParametros = cacheEmMemoria(10);
const cancelamento: '101101' = TIPOS_EVENTO.cancelamento;
if (resolucao.acao === 'reenviar') {
  const bytes: string = resolucao.dpsAssinada;
  void bytes;
}
void [entrada, errada, client, resolucao, cache, cancelamento];
