---
'@sinete/core': minor
---

`DataSigner.sign` recebe um terceiro argumento opcional, `SignContext` (`id` e `referenced`, o elemento referenciado canonicalizado), e `PreparedSignature` ganha `referenced`. Quem assina fora do processo pode conferir o que assina: o `documentSigner` do `@sinete/transport/signer` manda o elemento ao helper, que confere o autor do evento (manifestação do destinatário). Signers existentes, que ignoram o argumento, seguem funcionando.
