---
'@sinete/transport': minor
---

Primeira versão do @sinete/transport: `Transport` com identidade TLS plugável (`pem` em processo; `helper`, `external` e `pkcs11` como interface do ADR 0005), Node e Bun sobre `node:https` (renegociação, CBC, `sigalgs`, conferência do certificado local), Deno sobre `Deno.createHttpClient` com recusa tipada dos hosts incompatíveis, endpoints de NF-e, MDF-e e NFS-e Nacional e perfis TLS por host como dados, SOAP 1.2, `HostPolicy` com allowlist e erros tipados a partir dos alertas TLS e respostas HTTP observados.
