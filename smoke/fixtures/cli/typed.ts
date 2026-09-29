// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { CheckStatus, DoctorOptions, DoctorReport } from '@sinete/cli';
import { runDoctor } from '@sinete/cli';

export async function diagnosticar(pfx: Uint8Array, password: string): Promise<CheckStatus[]> {
  const options: DoctorOptions = { pfx, password, uf: 'SP', ambiente: 'homologacao' };
  const report: DoctorReport = await runDoctor(options);
  // @ts-expect-error UF fora do leiaute
  await runDoctor({ pfx, password, uf: 'XX' });
  return report.checks.map((c) => c.status);
}
