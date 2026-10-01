/**
 * `@sinete/emissor/perfil`: `criarEmissor` com o perfil de um documento, para quem compõe o próprio emissor.
 *
 * **Experimental**: fora da garantia de estabilidade (ADR 0016). Cada gancho novo do perfil (`transitorio`,
 * `contingencia`, `conteudoParaRecusa`, que o ADR 0012 e o ADR 0013 acrescentaram) muda um tipo daqui, e quem
 * implementa um perfil próprio pode precisar mudar o código em qualquer versão minor. Para emitir, use a fábrica do
 * documento (`criarEmissorNfe` em `@sinete/emissor/nfe`, `criarEmissorMdfe`, `criarEmissorNfse`), que é estável.
 *
 * Como a raiz, este subpath não importa nenhum pacote de documento.
 *
 * @experimental
 */

export type {
  ContingenciaAplicada,
  ContingenciaDoPerfil,
  ContingenciaDosBytes,
  Sonda,
  SondaSvc,
} from './contingencia.ts';
export type { ContextoEmissor, ModoEnvio, PerfilDocumento } from './emissor.ts';
export { criarEmissor } from './emissor.ts';
