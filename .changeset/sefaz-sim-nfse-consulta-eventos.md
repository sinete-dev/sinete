---
'@sinete/sefaz-sim': minor
---

A consulta de eventos da NFS-e simulada segue a Sefin real (produção restrita, 28/09/2026): 405 em `GET /sefin/nfse/{chave}/eventos`, 404 com página HTML em `.../eventos/{tipo}`, 200 em `.../eventos/{tipo}/{seq}` com `eventos[]` (`chaveAcesso`, `tipoEvento`, `numeroPedidoRegistroEvento`, `dataHoraRecebimento`, `arquivoXml` em base64 do gzip em base64) e 404 com `{}` sem o evento. `EventoNfseRegistro` ganha `recebidoEm`.
