---
'@sinete/da': patch
---

A NF-e e a NFC-e cujo `protNFe` traz cStat de cancelamento (101, 151 ou o 155 do evento fora de prazo), como gravam os sistemas que importam a nota, saem com o carimbo "CANCELADA" e o número do protocolo no campo do protocolo de autorização, e não mais como "SEM VALOR FISCAL". O `procEventoNFe` de cancelamento, quando passado, continua prevalecendo no carimbo, com o protocolo do evento. No DAMDFE, o `protMDFe` com cStat 101 sai "CANCELADO" e o 132 (encerrado) sai como autorizado, com o protocolo e sem marca.
