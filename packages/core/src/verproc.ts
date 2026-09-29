/**
 * Identificação do aplicativo emissor com a versão do pacote. `verProc` (NF-e, MDF-e) e `verAplic` (NFS-e) são o
 * mesmo formato no leiaute: texto livre de 1 a 20 caracteres, sem espaço nas pontas (`TString`/`TSVerAplic`).
 *
 * `formatarVerProc` monta `"<nome> <versão>"` e corta a versão até caber no limite, para nunca montar um valor fora
 * do schema mesmo com uma versão longa (prerelease, metadado de build). Se nem o nome sozinho couber, corta o texto
 * inteiro; o corte nunca deixa espaço na ponta.
 */

const LIMITE = 20;

export function formatarVerProc(nome: string, versao: string): string {
  const texto = versao.length === 0 ? nome : `${nome} ${versao}`;
  if (texto.length <= LIMITE) return texto;
  const espacoParaVersao = LIMITE - nome.length - 1;
  const cortado = espacoParaVersao > 0 ? `${nome} ${versao.slice(0, espacoParaVersao)}` : texto.slice(0, LIMITE);
  return cortado.trimEnd();
}
