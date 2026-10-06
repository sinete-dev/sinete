---
"@sinete/ibs-cbs": patch
---

`validar` deixa de aplicar a UB14-40 (cClassTrib 620005 só em nota de crédito, rejeição 1057), que a NT 2025.002 v1.52 removeu: a tabela de regras do grupo UB14 passa da UB14-30 para a UB14-50, e o histórico de alterações da NT não registra a remoção. Com a regra, o pacote recusava localmente uma nota que a SEFAZ aceita na v1.52 (homologação até 05/10/2026, produção até 03/11/2026). A rejeição 1057 continua no catálogo do `@sinete/rejeicoes`, porque a produção pode aplicá-la até a v1.52 entrar. As regras do validador passam a citar a v1.52 (as demais regras implementadas têm o mesmo código de rejeição nas duas versões), e a faixa da monofasia não suportada passa a `UB85a-10 a UB104`, como a v1.52 a numera.
