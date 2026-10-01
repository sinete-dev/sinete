---
'@sinete/ibs-cbs': patch
'@sinete/nfe': patch
---

A dependência do `@sinete/ibs-cbs-dados` passa de `^2026.9.2` para `>=2026.9.2`: o pacote de dados tem versão de calendário, e a faixa com `^` não aceitaria o dataset de 2027 nos pacotes já publicados. A compatibilidade passa a ser conferida pelo formato: `calcular`, `validar`, `restringir` e `determinar` do `@sinete/ibs-cbs` recusam com `ibscbs_dados_versao_incompativel` um dataset cujo `versaoDoFormato` não é o que este motor lê, mesmo que o pacote de dados instalado aceite o formato dele (ADR 0016, seção 6).
