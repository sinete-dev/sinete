---
"@sinete/nfe": minor
"@sinete/sefaz-sim": minor
"sinete": minor
---

NF-e com DANFE Simplificado Tipo 2 (`tpImp` 6) sob as regras da NFC-e que a NT 2026.002 v1.11 estende a ela (homologação desde 01/07/2026, produção desde 03/08/2026). O `montarNfe` passa a recusar na entrada, com o caminho do campo, `origem: 'entrada'` e a rejeição na mensagem, o que antes só a SEFAZ recusava: `dhSaiEnt` (B10-10, 705), `tpNF` 0 (B11-10, 706), `idDest` diferente de 1 (B11a-10, 707), `finNFe` diferente de 1 (B25-20, 715), `indFinal` 0 (B25a-10, 716), `indPres` fora de 1, 4 e 5 (B25b-20, 717), nota referenciada (BA01-10, 708), `emitente.IEST` (C18-10, 718), destinatário ausente na entrega a domicílio (E01-20, 787), os grupos de item, transporte, cobrança, compra e cana que a NFC-e não tem, e duas regras novas para a NFC-e e a Tipo 2: local de retirada (F01-10, 669) e item fora do total, `indTot` 0 (I17b-10, 774).

Os padrões mudam na Tipo 2: sem `indPres`, sai 1 (era 9, que a SEFAZ recusa com 717); sem `idDest`, sai 1 mesmo com o consumidor em outra UF (era 2, recusado com 707). Em homologação, a descrição do primeiro item da Tipo 2 é a literal da I04-10, como na NFC-e. O local de entrega (G01-10, 670) não é conferido: a NT o marca como implementação futura. A mensagem das regras da NFC-e na Tipo 2 começa por "NF-e com DANFE Simplificado Tipo 2" em vez de "NFC-e".

O simulador recusa a NF-e Tipo 2 com 706, 707, 715, 716 e 717, como a NFC-e.
