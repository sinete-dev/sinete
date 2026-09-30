import type { ConexaoSigner, IniciarSignerOpcoes } from '@sinete/transport/signer';

export declare function pacoteDoSigner(opcoes?: { readonly pkcs11?: boolean }): { pacote: string; arquivo: string };
export declare function binarioDoSigner(opcoes?: { readonly pkcs11?: boolean }): string;
export declare function iniciarSigner(opcoes: IniciarSignerOpcoes): Promise<ConexaoSigner>;
