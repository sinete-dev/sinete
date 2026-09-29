# @sinete/signer

O binário nativo `sinete-signer` da sua plataforma (ADR 0005 e ADR 0014), para certificado A3 em token, A3 em nuvem de PSC, chave em OpenBao Transit ou `CryptoKey` não exportável: o helper termina o mTLS com a SEFAZ usando uma chave que ele não guarda.

O binário vem de um pacote `@sinete/signer-<os>-<cpu>` que o npm, o Bun e o pnpm instalam só na plataforma certa (`optionalDependencies` com `os` e `cpu`), sem script de instalação e sem download fora do registry. Quem usa só A1 em Node ou Bun não precisa deste pacote.

```ts sem-checagem
import { startSigner } from '@sinete/signer';
import { createTransport } from '@sinete/transport';

const signer = await startSigner({ ambientes: ['homologacao'], pkcs11: true });
const a3 = await signer.openPkcs11({ module: '/usr/lib/libfabricante.so', token: 'meu-token', label: 'certificado', pin: pedirPin });
const transport = createTransport({ identity: a3.tlsIdentity });
```

Com `binary` ou com a variável do sabor definida (`SINETE_SIGNER_BIN`, ou `SINETE_SIGNER_P11_BIN` com `pkcs11: true`), o `startSigner` usa esse binário e dispensa o pacote da plataforma: é o caminho de quem instala com `--omit=optional` e usa o binário da release.

O guia completo está na documentação embarcada do `sinete`: `docs/como-fazer/certificado-a3.md`.
