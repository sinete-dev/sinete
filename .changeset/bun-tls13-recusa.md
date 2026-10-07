---
"sinete": patch
"@sinete/emissor": patch
---

Documentação embarcada: no Bun, com o servidor em TLS 1.3, a recusa do certificado de cliente vencido ou revogado chega como `conexao_recusada`, porque o Bun não entrega o alerta TLS (Node e Deno entregam e classificam como `certificado_expirado` ou `certificado_revogado`). As páginas de `conexao_recusada`, `certificado_expirado` e `certificado_revogado` registram a ressalva.
