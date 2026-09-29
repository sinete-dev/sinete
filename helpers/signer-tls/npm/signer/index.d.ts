import type { SignerConnection, StartSignerOptions } from '@sinete/transport/signer';

export declare function signerPackage(options?: { readonly pkcs11?: boolean }): { pkg: string; file: string };
export declare function signerBinary(options?: { readonly pkcs11?: boolean }): string;
export declare function startSigner(options: StartSignerOptions): Promise<SignerConnection>;
