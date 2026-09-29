---
'@sinete/nfe': patch
---

A pré-validação deixa de recusar o CST 51 em operação interna com destinatário CPF isento (RV N12-80, exceção 3 a critério da UF) e deixa de conferir localmente o vencimento das duplicatas pelas RV Y09-20 e Y09-30: as notas autorizadas de um integrador em produção mostraram UF que não aplica essas regras. A Y09-40 (853) continua.
