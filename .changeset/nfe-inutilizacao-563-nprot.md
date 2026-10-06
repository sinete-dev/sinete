---
"@sinete/nfe": minor
"sinete": minor
---

`inutilizar` devolve no 563 o protocolo da faixa já inutilizada. Não existe consulta de inutilização na NF-e 4.00, então reenviar a mesma faixa depois de uma resposta perdida é o único caminho para guardar o `nProt` que valeu, e até aqui o desfecho só trazia `cStat` e `xMotivo`. O 563 continua `recusado` (a resposta não é a homologação e não monta `procInutNFe`); quando o `retInutNFe` traz `nProt`, o desfecho ganha `anterior: { nProt, retInutNFe }` (tipos novos `RecusadoInutilizacao` e `InutilizacaoAnterior`; `ResultadoInutilizacao` passa a usar o primeiro no caso `recusado`). Fonte: MOC 7.0 Visão Geral, tabela 5-12, regra I07.

Mudança de comportamento: um 563 com `nProt` cuja faixa (`ano`, `CNPJ`, `mod`, `serie`, `nNFIni`, `nNFFin`) não é a pedida passa a lançar `ErroRespostaInvalida` (`resposta_invalida`), a mesma conferência que o 102 já fazia. Antes voltava como `recusado` 563, e quem lia o 563 como "a faixa já estava homologada" não tinha como notar que a resposta era de outra faixa. O 563 sem `nProt` e as demais rejeições seguem como `recusado`, sem `anterior`.
