---
'@sinete/mdfe': minor
'sinete': minor
---

`resolverEnvioSemResposta(cliente, mdfeAssinado, anterior?, opcoes?)` e `recuperarEventoRegistrado(cliente, chave, tpEvento, opcoes?)` aceitam `opcoes?: EnvioOpcoes` no fim e repassam o `signal` à consulta, como os métodos do `ClienteMdfe`. Compatível.
