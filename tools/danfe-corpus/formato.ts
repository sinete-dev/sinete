/**
 * Nome do formato para as estatísticas do corpus. O título do `Documento` traz a chave de acesso, que tem o CNPJ do emitente
 * (e letras, com o CNPJ alfanumérico): o nome sai de uma lista fechada e nunca do título, para que nenhum identificador
 * chegue à saída, que é só de agregados.
 */

/** Do mais específico ao mais geral: "DANFE Simplificado Tipo 2" antes de "DANFE Simplificado", que vem antes de "DANFE". */
const FORMATOS = [
  'DANFE NFC-e',
  'DANFE Simplificado Tipo 2',
  'DANFE Simplificado',
  'DACCE',
  'DAMDFE',
  'DANFE',
] as const;

export function formatoDe(title: string): string {
  return FORMATOS.find((f) => title === f || title.startsWith(`${f} `)) ?? 'outro';
}

/**
 * Marca d'água do documento para as estatísticas: o texto da marca traz o protocolo, então sai só o nome da lista
 * fechada, pela primeira linha da marca (a maior). As marcas são os textos girados entre 0 e 90 graus.
 */
const MARCAS = [
  ['DENEGADA', 'denegada'],
  ['SEM VALOR FISCAL', 'sem-valor-fiscal'],
  ['EMITIDA EM CONTINGÊNCIA', 'contingencia'],
  ['EMISSÃO EM CONTINGÊNCIA', 'contingencia'],
  ['CANCELADA', 'cancelada'],
  ['CANCELADO', 'cancelada'],
] as const;

export function marcaDe(doc: {
  readonly paginas: readonly { readonly ops: readonly { t: string; s?: string; rotacao?: number }[] }[];
}): string {
  const primeira = doc.paginas[0]?.ops.find(
    (o) => o.t === 'texto' && o.rotacao !== undefined && o.rotacao > 0 && o.rotacao < 90,
  );
  if (!primeira) return 'nenhuma';
  return MARCAS.find(([texto]) => primeira.s === texto)?.[1] ?? 'outra';
}
