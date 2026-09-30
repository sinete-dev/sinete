/** Contrato mínimo de um simulador para os adaptadores de transporte (em processo e HTTPS). */

import type { PedidoSim, RespostaSim } from './sim.ts';

/** Atende um pedido HTTP já lido: o `SefazSim` da NF-e e o `NfseSim` da NFS-e. */
export interface TratadorSim {
  atender(pedido: PedidoSim): Promise<RespostaSim>;
}
