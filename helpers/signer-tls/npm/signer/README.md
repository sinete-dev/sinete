# @sinete/signer

O binário nativo `sinete-signer` da sua plataforma (ADR 0005 e ADR 0014), para certificado A3 em token, A3 em nuvem de PSC, chave em OpenBao Transit ou `CryptoKey` não exportável: o helper termina o mTLS com a SEFAZ usando uma chave que ele não guarda.

O binário vem de um pacote `@sinete/signer-<os>-<cpu>` que o npm, o Bun e o pnpm instalam só na plataforma certa (`optionalDependencies` com `os` e `cpu`), sem script de instalação e sem download fora do registry. Quem usa só A1 em Node ou Bun não precisa deste pacote.

```ts sem-checagem
import { iniciarSigner } from '@sinete/signer';
import { criarTransporte } from '@sinete/transport';

const signer = await iniciarSigner({ ambientes: ['homologacao'], pkcs11: true });
const a3 = await signer.abrirPkcs11({ modulo: '/usr/lib/libfabricante.so', token: 'meu-token', rotulo: 'certificado', pin: pedirPin });
const transporte = criarTransporte({ identidade: a3.identidadeTls });
```

Com `binario` ou com a variável do sabor definida (`SINETE_SIGNER_BIN`, ou `SINETE_SIGNER_P11_BIN` com `pkcs11: true`), o `iniciarSigner` usa esse binário e dispensa o pacote da plataforma: é o caminho de quem instala com `--omit=optional` e usa o binário da release.

O guia completo está na documentação embarcada do `sinete`: `docs/como-fazer/certificado-a3.md`.
