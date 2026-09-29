---
'@sinete/nfe': patch
---

`sliceElement` só leva para a raiz da fatia os prefixos cuja declaração está fora dela: um prefixo declarado num ancestral e redeclarado dentro do recorte deixava de ganhar uma declaração a mais, que mudava o C14N inclusivo de um irmão assinado no envelope.
