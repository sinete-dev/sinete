---
'@sinete/core': minor
'@sinete/nfe': minor
'@sinete/mdfe': minor
'@sinete/nfse': minor
'sinete': minor
---

Ocorrências de validação classificadas pela fase em que nasceram (ADR 0011): `ValidationIssue.origem` é `entrada` quando a conferência foi sobre a entrada do domínio (o `path` é da entrada e corrigir o valor ali resolve) e `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD e o PL, chave gerada, grupo IBS/CBS da calculadora, regras da NT). `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem; o campo é opcional no tipo, então quem constrói ocorrências fora do sinete não quebra. A calculadora de IBS/CBS pode marcar a origem das próprias ocorrências; sem marca, entram como `montagem`.

`rotuloDoCaminho(path)` no `@sinete/nfe` e no `@sinete/mdfe` dá o rótulo em português do caminho de uma ocorrência (`Item 2, Descrição do produto`, `Condutor 1, CPF`), para os caminhos da entrada e do documento montado, inclusive os do validador de XSD. O mecanismo fica no `@sinete/core` (`normalizarCaminho`, `criarRotuloDoCaminho`) para os outros documentos.
