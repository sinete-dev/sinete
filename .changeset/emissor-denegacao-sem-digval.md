---
'@sinete/emissor': minor
'@sinete/nfe': minor
'@sinete/mdfe': minor
'@sinete/sefaz-sim': minor
---

Protocolo sem `digVal` (opcional no leiaute) deixa de prender a gravação. A denegação (110, 301, 302, 303) é decisão sobre a chave: na resposta do envio e na consulta, o emissor devolve `denegado`, definitivo, mesmo sem `digVal`, com `conteudo` (`confere`, `sem-digval` ou `difere`), os bytes gravados em `xml` e o `proc` só quando o `digVal` confere (`proc` passa a ser opcional no `DesfechoDenegado`). A autorização sem `digVal` nem na consulta vira `divergente` com `conteudo: 'sem-digval'`, com os bytes mantidos e alerta na primeira retomada, em vez de `pendente` para sempre; o mesmo vale para o MDF-e. No `@sinete/nfe` e no `@sinete/mdfe`, o `resolverEnvioSemResposta` ganha a ação `sem-prova` e, na NF-e, conclui a denegação com qualquer conteúdo, dizendo qual em `conteudo`. O `@sinete/sefaz-sim` ganha `setProtocoloSemDigVal` para reproduzir o caso.
