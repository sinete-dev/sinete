---
'@sinete/ibs-cbs': minor
---

Primeira versão do `@sinete/ibs-cbs`, o motor do IBS e da CBS agnóstico de documento, com a raiz reexportando tudo e um subpath por parte:

- `@sinete/ibs-cbs/aliquotas`: alíquotas nominais e de referência do IBS e da CBS por data de fato gerador, cada uma `official` (com dispositivo legal e fonte), `user-provided` (com motivo) ou `unknown`, e `RateUnknownError` em vez de zero quando a alíquota ainda não foi publicada. 2026 com as alíquotas de teste; IBS de 0,05% + 0,05% em 2027 e 2028 pela LC 214/2025; CBS de 2027 em diante desconhecida.
- `@sinete/ibs-cbs/calcular`: cálculo puro e determinístico do IBS e da CBS a partir de CST e cClassTrib, com as expressões de tratamento do dataset, 8 casas internas e HALF_EVEN como a Calculadora da RFB, saída nos grupos da NT 2025.002 (`gIBSCBS`, `gRed`, `gDif`, `gDevTrib`, `gTribRegular`, `gTribCompraGov`, crédito presumido, estorno, transferência, ajuste de competência) e totais `IBSCBSTot`, compra governamental com a redistribuição do art. 473, alíquotas simuladas marcadas e erros tipados; monofasia, Imposto Seletivo e alíquotas combinadas lançam `UnsupportedRegimeError`.
- `@sinete/ibs-cbs/validar`: regras de validação da NT 2025.002-RTC v1.51 para NF-e e NFC-e (UB12-10 a UB133-10 e somas W) como funções puras com id, cStat, modelos, implantação por ambiente e fonte, `validate` com os dois relógios e `documentFromRoc` para conferir a saída do `@sinete/ibs-cbs/calcular`.
- `@sinete/ibs-cbs/determinar`: `constrain` reduz os cClassTrib de cada item pelas restrições oficiais (vigência, DF-e, tipo de nota, nomenclatura, anexos de NCM e NBS, atores) com o motivo e a fonte de cada exclusão; `determine` soma regras legais com fonte, respostas do usuário e resolvedores assíncronos plugáveis, e devolve cada decisão com proveniência; `toClassified` monta a entrada do `@sinete/ibs-cbs/calcular`.
