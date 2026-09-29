---
'@sinete/nfe': minor
'sinete': patch
---

A montagem confere regras da SEFAZ que só dependem do documento e voltavam como rejeição (ADR 0012), com `origem: 'entrada'`: série de emitente CNPJ de 0 a 889 (RV C02-30 e B26-10, rejeições 503 e 244), CST 50 ou 51 com destinatário contribuinte isento fora das exceções (RV N12-80, 529), duplicata sem vencimento ou vencendo antes da emissão (Y09-20, 900) ou da parcela anterior (Y09-30, 850) e parcela única vencendo na emissão (NT 2025.001 v1.03, Y09-40, 853). Novo `conferirEmitenteDoCertificado` (RV F03 e F03A) e o código `emitente_difere_do_certificado`. O cliente recusa, antes de enviar, o autor explícito de cancelamento, cancelamento por substituição e CC-e diferente do emitente da chave (`autor_difere_do_emitente`, RV P12-44, 574).
