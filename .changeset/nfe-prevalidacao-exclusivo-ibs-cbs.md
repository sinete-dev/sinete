---
"@sinete/nfe": minor
"@sinete/rejeicoes": minor
"@sinete/schemas": patch
"@sinete/emissor": patch
"sinete": minor
---

Contribuinte exclusivo do IBS/CBS (NT 2026.007 v1.10). O `montarNfe` confere antes de assinar a nota sem IE do emitente: NFC-e até o fim de 2032 (rejeição 156), emitente sem CNPJ (157), IEST informada (158), ICMS no item fora da devolução e do `tpNFCredito` 03 (161) e item sem o grupo IBS/CBS (162); a falta de ICMS e ISSQN deixa de ser ocorrência nessa nota. O catálogo do `@sinete/rejeicoes` ganha as 30 rejeições novas da NT (156 a 188), e a `vigencia.json` do `@sinete/schemas` passa a citar a v1.10.
