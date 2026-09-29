---
'@sinete/sefaz-sim': minor
---

Primeira versão do @sinete/sefaz-sim: SEFAZ simulada com estado e relógio injetado para testes. Atende os web services da NF-e 4.00 com os nomes reais dos WSDL (status, autorização síncrona e assíncrona com recibo, consulta de recibo e de protocolo, eventos de cancelamento, cancelamento por substituição, CC-e e manifestação no AN, inutilização, consulta cadastro e distribuição de DF-e com docZip), valida na ordem da SEFAZ (schema oficial, assinatura, certificado do transmissor e regras de negócio plugáveis com a origem no MOC 7.0), gera protocolos e recibos determinísticos, simula paralisação, contingência SVC, atraso, queda e falta de resposta depois de processar, e roda em processo (`simTransport`) ou como servidor HTTPS com mTLS (`startSefazSimServer`). Traz certificados sintéticos (AC, e-CNPJ, e-CPF e servidor) gerados na hora.
