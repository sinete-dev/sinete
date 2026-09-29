/**
 * Cliente do laboratório para rodar o transporte fora do Bun: `node client.ts '<json>'` ou
 * `deno run -A client.ts '<json>'`. Imprime o resultado em JSON. Só fala com 127.0.0.1.
 */
import type { LabClientInput } from './client-core.ts';
import { runLabClient } from './client-core.ts';

const input = JSON.parse(process.argv[2] ?? '{}') as LabClientInput;
console.log(JSON.stringify(await runLabClient(input)));
