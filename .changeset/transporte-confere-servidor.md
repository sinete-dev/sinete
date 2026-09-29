---
'@sinete/transport': patch
---

O transporte de Node e Bun fixa `rejectUnauthorized: true` no `https.Agent`. Antes, `NODE_TLS_REJECT_UNAUTHORIZED=0` no processo desligava também a conferência do certificado da SEFAZ feita pelo sinete, que passava a aceitar qualquer servidor.
