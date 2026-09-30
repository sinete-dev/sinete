// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { SituacaoDaVerificacao, DoctorOpcoes, RelatorioDoDoctor } from '@sinete/cli';
import { rodarDoctor } from '@sinete/cli';

export async function diagnosticar(pfx: Uint8Array, password: string): Promise<SituacaoDaVerificacao[]> {
  const options: DoctorOpcoes = { pfx, senha: password, uf: 'SP', ambiente: 'homologacao' };
  const report: RelatorioDoDoctor = await rodarDoctor(options);
  // @ts-expect-error UF fora do leiaute
  await rodarDoctor({ pfx, senha: password, uf: 'XX' });
  return report.verificacoes.map((c) => c.situacao);
}
