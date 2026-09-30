// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { Relogio } from '@sinete/core';
import type { ContextoAutorizacao, SefazSim, FalhaSim, RegraSim, CertificadoSintetico } from '@sinete/sefaz-sim';
import { criarSefazSim, REGRAS_PADRAO, transporteSim, certificadoSintetico } from '@sinete/sefaz-sim';

export async function usar(clock: Relogio): Promise<number> {
  const ac: CertificadoSintetico = await certificadoSintetico({ relogio: clock, papel: 'ac' });
  const serie: RegraSim<ContextoAutorizacao> = {
    id: 'serie-9',
    fonte: 'teste',
    conferir: (ctx) => (ctx.nfe.serie === '9' ? { cStat: '503' } : undefined),
  };
  const sim: SefazSim = criarSefazSim({
    relogio: clock,
    uf: 'SP',
    regras: { ...REGRAS_PADRAO, autorizacao: [serie, ...REGRAS_PADRAO.autorizacao] },
  });
  const fault: FalhaSim = { tipo: 'derrubar', fase: 'depois' };
  sim.injetarFalha(fault, { servico: 'NFeAutorizacao' });
  // @ts-expect-error serviço fora do portal
  sim.caminho('NfeInexistente');
  const t = transporteSim(sim, { certificadoDoCliente: ac.der });
  return t.capacidades.renegociacao ? 1 : 0;
}
