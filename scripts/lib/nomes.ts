/**
 * Nomes que o repositório não cita: o sistema do primeiro integrador em produção, pelo nome ou pela sigla. O texto fala
 * do papel ("o integrador em produção", "o primeiro consumidor"). As expressões são montadas por partes para que este
 * arquivo e o teste não casem com elas.
 */
import { $ } from 'bun';
import { root } from './workspace.ts';

const MOTIVO = 'o repositório cita o integrador pelo papel, não pelo nome do sistema dele';

export const NOMES_PROIBIDOS: readonly RegExp[] = [
  new RegExp(['fazenda', 'nota'].join('[\\s_.-]*'), 'i'),
  new RegExp(`\\b${'F'}${'N'}\\b`),
];

/** Pastas e arquivos conferidos: tudo que é versionado, menos os spikes (capturas brutas de referência). */
export const ESCOPO: readonly string[] = [
  'packages',
  'smoke',
  'scripts',
  'tools',
  'docs',
  '.changeset',
  '.github',
  '*.md',
  'package.json',
];

export interface Ocorrencia {
  readonly arquivo: string;
  readonly linha: number;
  readonly trecho: string;
  readonly motivo: string;
}

/** Ocorrências dos nomes proibidos num texto. */
export function nomesNoTexto(arquivo: string, texto: string): Ocorrencia[] {
  const out: Ocorrencia[] = [];
  for (const [i, l] of texto.split('\n').entries()) {
    for (const re of NOMES_PROIBIDOS) {
      const m = re.exec(l);
      if (m) out.push({ arquivo, linha: i + 1, trecho: m[0], motivo: MOTIVO });
    }
  }
  return out;
}

/** Ocorrências em todos os arquivos versionados do escopo. */
export async function nomesNoRepositorio(): Promise<Ocorrencia[]> {
  const lista = await $`git ls-files -z -- ${ESCOPO}`.cwd(root).text();
  const out: Ocorrencia[] = [];
  for (const arquivo of lista.split('\0').filter(Boolean)) {
    const f = Bun.file(`${root}/${arquivo}`);
    if (!(await f.exists())) continue;
    const bytes = new Uint8Array(await f.arrayBuffer());
    // Binários (PDF, certificado DER, imagem) ficam de fora: o nome só aparece em texto.
    if (bytes.includes(0)) continue;
    out.push(...nomesNoTexto(arquivo, new TextDecoder().decode(bytes)));
  }
  return out;
}
