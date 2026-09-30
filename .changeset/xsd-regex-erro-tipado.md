---
'@sinete/schemas': patch
---

`XsdRegexError` passa a estender `UnsupportedError` (`code: 'nao_suportado'`, com o `pattern` em `details`), como todo erro lançado pelo sinete. Antes estendia `Error` direto e escapava de `isSineteError`.
