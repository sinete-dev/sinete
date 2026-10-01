---
'@sinete/ibs-cbs-dados': patch
'@sinete/ibs-cbs': patch
---

Dados da Calculadora offline da RFB V0059 (30/09/2026), no lugar da V0057. O mês dos dados continua setembro de 2026, então o `@sinete/ibs-cbs-dados` segue em `2026.9.x`.

- NFS-e: a troca de vínculos NBS x cClassTrib x indicador de operação que a V0057 marcava para 01/10/2026 passa para 03/11/2026 (V0058). Entre 01/10 e 02/11/2026 valem os vínculos de antes; a partir de 03/11/2026, os novos (1.519 vínculos, entre eles os de 820001, 820002, 820003, 820006 e 820007).
- Tratamento `032` (tributação em documento específico, CST 820): `possuiAjuste` passa a `false` (V0059, "Habilitação de 820 para NFSe"). A CST 820 não tem grupo IBS/CBS, então o cálculo do motor não muda.
- CST, cClassTrib, crédito presumido, aplicabilidade de NCM e NBS, atores, redutor de compra governamental e transferência: só a fonte citada muda. Alíquotas: nenhuma mudança; a Calculadora continua sem alíquota de referência da CBS para 2027.
