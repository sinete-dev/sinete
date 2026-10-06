---
"@sinete/nfse": minor
"sinete": minor
---

`rotuloDoCaminho(caminho)` na NFS-e, como o da NF-e e o do MDF-e (ADR 0011): o caminho de uma ocorrência da DPS vira texto para quem preencheu a nota (`tomador.CNPJ` vira `Tomador, CNPJ`; `/DPS/infDPS/valores/vDedRed/documentos/docDedRed[2]/vDedutivelRedutivel` vira `Documento de dedução 2, Valor dedutível ou redutível`), com `Dados da DPS` quando nem o grupo nem o campo são conhecidos. Aceita os caminhos da `DadosDps`, os do documento montado com pontos e os do validador de XSD, que na DPS incluem a raiz `DPS`.
