---
'@sinete/da': minor
'sinete': minor
---

`@sinete/da`: `daEvento` ganha a opção `nomeMunicipio`, a mesma do `danfse`. No encerramento do MDF-e (110112), o `evEncMDFe` só traz o código IBGE do município (`cMun`); com a opção, o documento mostra o nome que ela devolve em "MUNICÍPIO DO ENCERRAMENTO". Sem a opção, ou quando ela devolve `undefined`, a linha continua com o código IBGE, como antes.
