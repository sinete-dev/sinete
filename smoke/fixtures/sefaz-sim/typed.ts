// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Clock } from '@sinete/core';
import type { AutorizacaoContext, SefazSim, SimFault, SimRule, SyntheticCertificate } from '@sinete/sefaz-sim';
import { createSefazSim, DEFAULT_RULES, simTransport, syntheticCertificate } from '@sinete/sefaz-sim';

export async function usar(clock: Clock): Promise<number> {
  const ac: SyntheticCertificate = await syntheticCertificate({ clock, role: 'ac' });
  const serie: SimRule<AutorizacaoContext> = {
    id: 'serie-9',
    source: 'teste',
    check: (ctx) => (ctx.nfe.serie === '9' ? { cStat: '503' } : undefined),
  };
  const sim: SefazSim = createSefazSim({
    clock,
    uf: 'SP',
    rules: { ...DEFAULT_RULES, autorizacao: [serie, ...DEFAULT_RULES.autorizacao] },
  });
  const fault: SimFault = { kind: 'drop', phase: 'after' };
  sim.injectFault(fault, { servico: 'NFeAutorizacao' });
  // @ts-expect-error serviço fora do portal
  sim.path('NfeInexistente');
  const t = simTransport(sim, { clientCertificate: ac.der });
  return t.capabilities.renegotiation ? 1 : 0;
}
