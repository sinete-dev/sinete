---
"@sinete/mdfe": minor
"sinete": minor
---

MDF-e do modal ferroviário. `DadosMdfe` ganha o caso `DadosMdfeFerroviario`, com o grupo `ferroviario` (`trem` com xPref, dhTrem, xOri e xDest; `vagoes` com pesoBC, pesoR, tpVag, serie, nVag, nSeq e TU), que monta `modal` 4; `qVag` sai da contagem dos vagões e os pesos saem com três casas. Como no aéreo, as regras do Anexo I que só valem no rodoviário não se aplicam, F23 (705) recusa o carregamento posterior e F34 (702) a entrega parcial do CT-e. Lista de vagões vazia é `campo_obrigatorio` em `ferroviario.vagoes`. `rotuloDoCaminho` ganha os rótulos do trem e dos vagões (`Vagão 2, Número do vagão`).
