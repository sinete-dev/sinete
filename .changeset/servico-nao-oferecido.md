---
'@sinete/core': minor
'@sinete/transport': minor
---

Novo código `servico_nao_oferecido` (`ServicoNaoOferecidoError`) para o serviço que a tabela oficial de web services não lista para a UF ou o ambiente, como a consulta cadastro de uma UF que a SVRS não atende nesse serviço. Antes esses casos saíam como `config_invalida`, que continua valendo só para defeito de integração. `details` traz `autorizador`, `servico`, `ambiente` e, quando informada, a `uf`.
