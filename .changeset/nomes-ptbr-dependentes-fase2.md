---
'@sinete/nfe': minor
'@sinete/mdfe': minor
'@sinete/nfse': minor
'@sinete/da': minor
'@sinete/emissor': minor
'@sinete/sefaz-sim': minor
'@sinete/cli': minor
'sinete': minor
---

Acompanham a fase 2 do ADR 0015 (`@sinete/cert`, `@sinete/transport`, runtime do `@sinete/schemas`, `@sinete/ibs-cbs-dados` e `@sinete/ibs-cbs` com nomes em português). Os tipos desses pacotes que estes recebem e devolvem mudam, e o código de quem os usa muda junto; a tabela completa está nos changesets de cada pacote da fase. Nomes destes pacotes que também mudam:

| Onde aparece | Antigo | Novo |
|---|---|---|
| `CertificadoAberto` (`@sinete/emissor`) | `signer` | `assinador` |
| `syntheticCertificate(...).tlsIdentity` (`@sinete/sefaz-sim`) | `{ kind: 'pem', certChain, key }` | `{ tipo: 'pem', cadeia, chave }`, a forma da `IdentidadeTls` |
| `simTransport` (`@sinete/sefaz-sim`) | `runtime: 'custom'` | `runtime: 'personalizada'` |
