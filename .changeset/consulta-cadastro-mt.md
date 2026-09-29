---
'@sinete/nfe': patch
---

A consulta cadastro do MT volta a funcionar. O MT pede a mensagem dentro do elemento da operação do WSDL (`<consultaCadastro><nfeDadosMsg>`) e respondia 215 (falha no schema) ao corpo só com `nfeDadosMsg`. O envelope por autorizador fica em `data/servicos.json` (`envelopeNoAutorizador`), com a fonte.
