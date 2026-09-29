---
'@sinete/nfe': minor
---

Primeira versão do @sinete/nfe (NF-e modelo 55): modelo de entrada tipado, montagem no PL vigente com derivados e totais (ICMSTot, ISSQNtot, IBSCBSTot, vItem, vNFTot) em decimal exato e modo de arredondamento por família, chave e cNF, contingência, responsável técnico com hashCSRT, validação estrita contra o schema antes de assinar e assinatura por splice. Porta `IbsCbsCalculator` para o IBS/CBS. Serviços sobre o `@sinete/transport`: status, autorização síncrona e assíncrona com política de recibo, consulta protocolo, cancelamento, CC-e, manifestação no AN, cancelamento por substituição, inutilização, consulta cadastro, Distribuição DF-e com docZip e roteamento SVC-AN e SVC-RS, com `nfeProc` e `procEventoNFe` montados por splice e resolução de envio sem resposta (204, 217, 539).
