// @sinete/signer: o binário do sinete-signer da plataforma, pelo pacote @sinete/signer-<os>-<cpu> que o npm instala
// entre as optionalDependencies (ADR 0014), e o iniciarSigner do @sinete/transport/signer já apontando para ele.
import { createRequire } from 'node:module';
import process from 'node:process';
import { ErroSigner } from '@sinete/transport';
import { iniciarSigner as iniciar } from '@sinete/transport/signer';

const require = createRequire(import.meta.url);

/** Pacote e arquivo do binário desta plataforma. */
export function pacoteDoSigner(opcoes = {}) {
  const pacote = `@sinete/signer-${process.platform}-${process.arch}`;
  const arquivo = `bin/sinete-signer${opcoes.pkcs11 ? '-p11' : ''}${process.platform === 'win32' ? '.exe' : ''}`;
  return { pacote, arquivo };
}

/** Caminho absoluto do binário desta plataforma. Sem o pacote da plataforma, `signer_indisponivel`. */
export function binarioDoSigner(opcoes = {}) {
  const { pacote, arquivo } = pacoteDoSigner(opcoes);
  try {
    return require.resolve(`${pacote}/${arquivo}`);
  } catch (cause) {
    throw new ErroSigner(
      'signer_indisponivel',
      `${pacote} não está instalado ou não traz ${arquivo}: instale sem --no-optional (ou --omit=optional), ou use o binário da release com ${opcoes.pkcs11 ? 'SINETE_SIGNER_P11_BIN' : 'SINETE_SIGNER_BIN'}`,
      { cause },
    );
  }
}

/**
 * `iniciarSigner` do @sinete/transport/signer com o binário desta plataforma. `binario` e a variável do sabor
 * (`SINETE_SIGNER_BIN` ou `SINETE_SIGNER_P11_BIN`) vêm antes do pacote da plataforma, como no @sinete/transport.
 */
export function iniciarSigner(opcoes) {
  const pkcs11 = opcoes.pkcs11 === true;
  const fromEnv = process.env[pkcs11 ? 'SINETE_SIGNER_P11_BIN' : 'SINETE_SIGNER_BIN'];
  return iniciar({ ...opcoes, binario: opcoes.binario ?? (fromEnv ? fromEnv : binarioDoSigner({ pkcs11 })) });
}
