/**
 * Recusa do `npm publish` que quer dizer "esta versão já está no registry": 409 de versão já recebida (o registry ainda
 * processa o publish anterior) ou 403 de republicação. Qualquer outra falha continua sendo falha.
 */
export function jaPublicada(stderr: string): boolean {
  return (
    /E409\b[\s\S]*previously staged version|Cannot publish over previously staged version/i.test(stderr) ||
    /E403\b[\s\S]*cannot publish over the previously published versions?/i.test(stderr) ||
    /You cannot publish over the previously published versions?/i.test(stderr)
  );
}
