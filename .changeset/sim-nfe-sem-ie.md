---
"@sinete/sefaz-sim": minor
"sinete": minor
---

O simulador segue a NT 2026.007 v1.10 para a NF-e sem IE do emitente (contribuinte exclusivo do IBS/CBS): a C17-10 foi excluída e a 229 deixa de sair. A NF-e sem IE é autorizada quando o simulador faz o papel da SVRS, decidido pela UF configurada nos dados de endpoints do `@sinete/transport`, inclusive de outra UF (sem 410 no lote nem 226 na B02-10), e a consulta dela responde ali; fora da SVRS ela é recusada com 166 (C17-11). A NFC-e sem IE é recusada com 156 (C17-42). A IE zerada passa de 229 para 209.
