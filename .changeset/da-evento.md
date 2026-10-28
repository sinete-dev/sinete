---
"@sinete/da": minor
"sinete": minor
---

Subpath novo `@sinete/da/evento` (e `sinete/da/evento`) com `daEvento(xml, opcoes)`: o documento auxiliar de qualquer evento registrado, por uma chamada só. A raiz escolhe a família (`procEventoNFe` ou `procEventoMDFe`) e o `tpEvento` os campos. Na NF-e e na NFC-e: CC-e (110110, o mesmo documento do `dacce`), cancelamento (110111, com o protocolo de autorização e a justificativa) e cancelamento por substituição (110112, também com a chave da NFC-e substituta). No MDF-e: cancelamento (110111), encerramento (110112, com a data, a UF e o código IBGE do município) e inclusão de condutor (110114, com o nome e o CPF). As opções `nfe` e `mdfe`, opcionais, dão o emitente e a linha do documento. O evento precisa trazer o retorno de registro do mesmo pedido (cStat 135, 136 ou 155 na NF-e; 135, 134 ou 136 no MDF-e). Tipo sem documento auxiliar, evento não registrado e documento de outra chave ou da outra família lançam `ErroDa` com `evento_incompativel`; outra raiz, `documento_inesperado`. O `dacce` não muda: o DACCE sai byte a byte igual.
