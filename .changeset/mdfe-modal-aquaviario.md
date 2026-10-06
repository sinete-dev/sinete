---
"@sinete/mdfe": minor
"sinete": minor
---

MDF-e do modal aquaviário, o último dos quatro. `DadosMdfe` ganha o caso `DadosMdfeAquaviario`, com o grupo `aquaviario` (irin, tpEmb, cEmbar, xEmbar, nViag, cPrtEmb, cPrtDest, prtTrans, tpNav, `terminaisCarregamento` e `terminaisDescarregamento` até 5, `comboio` até 30, `unidadesCargaVazias`, `unidadesTransporteVazias` e o `MMSI` opcional da NT 2025.001), que monta `modal` 3. Como nos outros modais, as regras do rodoviário não se aplicam, F23 (705) e F34 (702) seguem o modal. Lista acima do limite do leiaute é `campo_invalido` no grupo. O MDF-e transportado (`infMDFeTransp`, F43 a F49) fica para a #57. `rotuloDoCaminho` ganha os rótulos de terminais, comboio e unidades vazias.
