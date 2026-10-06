---
"@sinete/nfe": minor
"@sinete/validators": patch
"@sinete/sefaz-sim": minor
"@sinete/rejeicoes": minor
"@sinete/emissor": patch
"sinete": minor
---

NF-e com DANFE Simplificado Tipo 2 (`tpImp` 6, NT 2026.002 v1.11): o `montarNfe` gera o `infNFeSupl` com o QR Code versão 3 na URL da NFC-e da UF, recusa a versão 2 (672) e aceita a contingência off-line (`tpEmis` 9) nela; a chave de acesso passa a aceitar `tpEmis` 9 no modelo 55. O `@sinete/sefaz-sim` deixa de recusar o `infNFeSupl` da NF-e (393, que saiu da NT), exige o QR Code na NF-e Tipo 2 (394) e confere a versão (672). O catálogo do `@sinete/rejeicoes` ganha o 672 (ZX02-220), e o `campoVolatil` do emissor acompanha.
