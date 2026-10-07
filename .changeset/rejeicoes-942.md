---
"@sinete/rejeicoes": patch
"sinete": patch
---

Rejeição 942 da NF-e no catálogo: "IE do local de retirada não cadastrada", modelo 55, regra 5AF15-10 da NT 2026.007 v1.10 (seção 5.8, consulta ao CCC com `tpEmis` diferente de 3). O gerador ignorava o código por estar fora da faixa nova da NT (156 a 188); é o código que a SEFAZ já usava para a mesma situação, e a regra irmã da entrega (5BG15-10) já estava no catálogo como 171.
