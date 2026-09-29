---
'@sinete/cli': minor
---

Primeira versão do @sinete/cli com `sinete doctor`: abre o PFX (senha por variável de ambiente ou prompt sem eco), confere identidade, validade e cadeia ICP-Brasil, mede o relógio contra o `Date` do servidor e faz só o handshake TLS com o endpoint, com a consulta de status apenas sob `--status`. Nunca mostra material de chave.
