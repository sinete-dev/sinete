---
'@sinete/rejeicoes': minor
'@sinete/core': minor
'sinete': minor
---

Campo opcional `orientacao` nas entradas do catálogo da NF-e e do MDF-e e no `DicaRejeicao`: texto para quem emite a nota (produtor, contador, atendente), em uma ou duas frases sem termo de integração, com o que aconteceu e o que mudar na nota, no cadastro ou junto à SEFAZ. `causaProvavel` e `comoCorrigir` continuam sendo o texto para quem integra. `dicaRejeicao`, `dicaRejeicaoMdfe` e os `completar*` passam a levar a `orientacao` quando a entrada tem.

Entram 59 das 92 rejeições curadas da NF-e e 12 das 15 do MDF-e: só as que quem emite resolve na nota, no cadastro ou na SEFAZ. Falha do sistema emissor (schema, assinatura, certificado da conexão, chave e dígito, cálculo de totais e tributos, duplicidade por reenvio, consumo indevido) fica sem `orientacao`. O catálogo da NFS-e não muda.
