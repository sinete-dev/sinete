import type { SineteErrorOptions } from '@sinete/core';
import { SineteError } from '@sinete/core';

/**
 * Códigos estáveis do `@sinete/cert`. Os detalhes nunca trazem senha, chave ou o PFX: só metadados públicos do
 * certificado (titular, emissor, validade, fingerprint).
 */
export type CertErrorCode =
  /** O arquivo não é um PKCS#12 legível (truncado, outro formato, base64 errado). */
  | 'pfx_invalido'
  /** A senha não abriu o PFX (MAC não confere). */
  | 'pfx_senha_incorreta'
  /** O PFX usa um algoritmo que o leitor não implementa (ex.: RC2-128). */
  | 'pfx_nao_suportado'
  /** O PFX não tem chave privada. */
  | 'pfx_sem_chave'
  /** Nenhum certificado do PFX corresponde a uma chave privada do PFX. */
  | 'pfx_sem_certificado_da_chave'
  /** O certificado já venceu e o chamador não passou `allowExpired`. */
  | 'certificado_expirado'
  /** O certificado ainda não começou a valer (ou o relógio da máquina está atrasado). */
  | 'certificado_ainda_nao_valido'
  /** O DER do certificado ou da chave não segue X.509/PKCS#8. */
  | 'certificado_invalido'
  /** Algoritmo de chave ou de assinatura fora do escopo (só RSA com PKCS#1 v1.5). */
  | 'algoritmo_nao_suportado';

export class CertError extends SineteError<CertErrorCode> {
  constructor(code: CertErrorCode, message: string, options?: SineteErrorOptions) {
    super(code, message, options);
    this.name = 'CertError';
  }
}
