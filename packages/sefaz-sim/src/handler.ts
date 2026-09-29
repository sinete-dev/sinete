/** Contrato mínimo de um simulador para os adaptadores de transporte (em processo e HTTPS). */

import type { SimRequest, SimResult } from './sim.ts';

/** Atende um pedido HTTP já lido: o `SefazSim` da NF-e e o `NfseSim` da NFS-e. */
export interface SimHandler {
  handle(request: SimRequest): Promise<SimResult>;
}
