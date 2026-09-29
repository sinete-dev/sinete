---
'@sinete/nfe': minor
---

NFC-e (modelo 65) na montagem: padrões do modelo (`indPres` 1, `indFinal` 1, `tpImp` 4), destinatário opcional com as regras de entrega a domicílio e do limite de R$ 10.000,00, pagamento obrigatório com troco, grupos vedados, contingência off-line (`tpEmis` 9) e o `infNFeSupl` com o QR Code versão 3 (padrão) ou versão 2 com CSC, com os endereços por UF e ambiente em tabela versionada. Novos: `assinaturaQrCode`, `comQrCode`, `TipoPagamento.PAGAMENTO_POSTERIOR` (tPag 91), `urlsNfce`, `XPROD_HOMOLOGACAO_NFCE`, `NFCE_LIMITE_SEM_DESTINATARIO`, as opções `qrCode`, `urlQrCode` e `urlChave`, e `mod` e `nfce` no `BuiltNfe`. Códigos de ocorrência novos: `grupo_vedado`, `pagamento_invalido` e `qrcode_invalido`.
