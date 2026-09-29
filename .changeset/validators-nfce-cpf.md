---
'@sinete/validators': minor
---

`parseChaveAcesso` no modo emissão aceita a NFC-e de emitente pessoa física nas séries 920 a 969 (NT 2023.002 v1.01, itens 2.1 e 4.1) e recusa a faixa 910 a 919, que é da NFA-e emitida no site do Fisco. Antes, toda NFC-e com CPF na chave era recusada pela RV C02a-04 do MOC 7.0, que a NT substituiu.
