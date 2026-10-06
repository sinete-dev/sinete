---
"@sinete/mdfe": minor
"@sinete/sefaz-sim": minor
"sinete": minor
---

MDF-e do modal aéreo. `DadosMdfe` passa a ser a união `DadosMdfeRodoviario | DadosMdfeAereo` (com `CamposMdfe` para os campos comuns): quem passa `rodoviario` continua compilando, mas quem lê `dados.rodoviario` de um `DadosMdfe` precisa estreitar para `DadosMdfeRodoviario`. O grupo `aereo` (nac, matr, nVoo, cAerEmb, cAerDes, dVoo) monta `modal` 2, e o CT-e ganha `entregaParcial` (corte de voo, `infEntregaParcial`). As regras do Anexo I que só valem no rodoviário (percurso F90, seguro F91 a F93, produto predominante F54/F55 e as do veículo) deixam de valer no aéreo; F23 (705) recusa o carregamento posterior fora do rodoviário e F34 (702) a entrega parcial fora do aéreo. Entrada sem modal ou com dois vira ocorrência (`campo_obrigatorio` em `rodoviario`, `combinacao_invalida` em `aereo`), não exceção. `rotuloDoCaminho` ganha os rótulos do aéreo, e `infMDFe.infModal` sozinho passa de "Transporte rodoviário" para "Modal".

No `@sinete/sefaz-sim`, a recepção do MDF-e aplica F23 (705) e F34 (702).
