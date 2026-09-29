---
'@sinete/transport': minor
'sinete': minor
---

Novo subpath `@sinete/transport/signer` (e `sinete/transport/signer`): cliente do helper nativo `sinete-signer` para certificado A3 em token PKCS#11, A3 em nuvem de PSC, OpenBao Transit e `CryptoKey` não exportável. `startSigner` sobe o binário, `connectSigner` conecta no socket Unix, `connectSignerChannel` fala o protocolo sobre qualquer canal; `openRemote` aplica a política do dono da chave e `openPkcs11` devolve também o `documentSigner`, que assina XML pelo `dfe.sign` validado pelo helper; `certificadoAberto` monta o certificado que o `@sinete/emissor` aceita. Falhas do helper viram os `TransportError` de sempre (`classifyHelperFailure`) ou o novo `SignerError` (`signer_indisponivel`, `signer_protocolo`, `assinatura_tls_recusada`, `assinatura_tls_expirou`, `pkcs11_falhou`, `assinatura_documento_recusada`). `TlsInfo` ganha `signatures`.

Mudança incompatível: `TlsIdentity` fica com `pem` e `helper`. Os tipos `external` e `pkcs11`, que só lançavam `UnsupportedError`, saíram; use `openRemote` e `openPkcs11`, que devolvem a identidade `helper`. `TlsSignContext.purpose` passa a ser `'tls12-client-certificate-verify'`, o valor do protocolo.
