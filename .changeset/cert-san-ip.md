---
'@sinete/cert': minor
---

`SubjectAltNames` ganha `ipAddresses`: os `iPAddress` do SAN, IPv4 com pontos e IPv6 na forma curta da RFC 5952. O cliente do `sinete-signer` usa o campo para conferir, no modo `message`, que o certificado do servidor cobre o endereço quando o destino é um IP. Quem monta um `SubjectAltNames` à mão precisa incluir o campo.
