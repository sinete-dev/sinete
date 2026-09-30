---
'@sinete/schemas': patch
---

`XsdRegexError` passa a estender `ErroNaoSuportado` (`code: 'nao_suportado'`, com o `pattern` em `detalhes`), como todo erro lançado pelo sinete. Antes estendia `Error` direto e escapava de `ehErroSinete`.
