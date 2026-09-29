---
'@sinete/nfe': minor
---

Quebra: `NfeClient.consultarProtocolo` passa a se chamar `consultar`, com a mesma assinatura, o mesmo nome do MDF-e e da NFS-e. `AutorizarOpcoes` ganha `signal`. O emissor de poucas linhas (`createNfeEmissor`) está no `@sinete/emissor/nfe`, e o `@sinete/nfe` não tem mais o `@sinete/da` como peer dependency.
