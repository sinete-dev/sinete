// @sinete/signer: o binário do sinete-signer da plataforma, pelo pacote @sinete/signer-<os>-<cpu> que o npm instala
// entre as optionalDependencies (ADR 0014), e o startSigner do @sinete/transport/signer já apontando para ele.
import { createRequire } from 'node:module';
import process from 'node:process';
import { SignerError } from '@sinete/transport';
import { startSigner as start } from '@sinete/transport/signer';

const require = createRequire(import.meta.url);

/** Pacote e arquivo do binário desta plataforma. */
export function signerPackage(options = {}) {
  const pkg = `@sinete/signer-${process.platform}-${process.arch}`;
  const file = `bin/sinete-signer${options.pkcs11 ? '-p11' : ''}${process.platform === 'win32' ? '.exe' : ''}`;
  return { pkg, file };
}

/** Caminho absoluto do binário desta plataforma. Sem o pacote da plataforma, `signer_indisponivel`. */
export function signerBinary(options = {}) {
  const { pkg, file } = signerPackage(options);
  try {
    return require.resolve(`${pkg}/${file}`);
  } catch (cause) {
    throw new SignerError(
      'signer_indisponivel',
      `${pkg} não está instalado ou não traz ${file}: instale sem --no-optional (ou --omit=optional), ou use o binário da release com ${options.pkcs11 ? 'SINETE_SIGNER_P11_BIN' : 'SINETE_SIGNER_BIN'}`,
      { cause },
    );
  }
}

/**
 * `startSigner` do @sinete/transport/signer com o binário desta plataforma. `binary` e a variável do sabor
 * (`SINETE_SIGNER_BIN` ou `SINETE_SIGNER_P11_BIN`) vêm antes do pacote da plataforma, como no @sinete/transport.
 */
export function startSigner(options) {
  const pkcs11 = options.pkcs11 === true;
  const fromEnv = process.env[pkcs11 ? 'SINETE_SIGNER_P11_BIN' : 'SINETE_SIGNER_BIN'];
  return start({ ...options, binary: options.binary ?? (fromEnv ? fromEnv : signerBinary({ pkcs11 })) });
}
