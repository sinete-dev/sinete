---
'@sinete/mdfe': minor
---

Quebra: `MdfeClient.autorizar(mdfeAssinado, signal)` passa a `autorizar(mdfeAssinado, { signal })`, com o tipo `AutorizarOpcoes`, como na NF-e e na NFS-e. O emissor de poucas linhas (`createMdfeEmissor`) está no `@sinete/emissor/mdfe`, e o `@sinete/mdfe` não tem mais o `@sinete/da` como peer dependency.
