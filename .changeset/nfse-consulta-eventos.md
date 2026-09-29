---
'@sinete/nfse': minor
---

Quebra, pelo que a Sefin real respondeu na produção restrita em 28/09/2026: `consultarEventos(chave, filtro)` exige `{ tpEvento, nSeqEvento }` (tipo `FiltroEventos`, exportado), porque a Sefin responde 405 sem o tipo e 404 sem a sequência; sem os dois, `ConfigError` antes do envio. A resposta real traz `eventos[].arquivoXml` em base64 do gzip em base64, que o cliente agora decodifica nas duas camadas (os campos `...XmlGZipB64` continuam lidos como reserva). O 404 do caminho completo, com qualquer corpo, é lista vazia; item sem documento, resposta 200 sem eventos e evento de outra NFS-e são `ProtocolError`.
