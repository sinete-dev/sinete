---
"@sinete/transport": minor
"sinete": minor
---

Dois códigos novos em `CodigoErroTransporte`: `certificado_expirado` (alerta TLS 45, `certificate_expired`) e `certificado_revogado` (alerta 44, `certificate_revoked`), com a mensagem e a dica de cada um, no transporte em processo e no helper `sinete-signer`. O alerta continua em `detalhes.alerta`.

Caso novo de união aberta (ADR 0016, seção 2): `certificado_recusado` deixa de cobrir os alertas 44 e 45 e fica com os alertas 43, 46, 48 e 49. Quem comparava `code === 'certificado_recusado'` para dizer "certificado não aceito" passa a receber os dois códigos novos nesses casos; quem compara o prefixo `certificado_` não muda. O `certificado_expirado` é o mesmo `code` que o `@sinete/cert` já usa para o PFX vencido na abertura, e a página `docs/guia/erros/certificado_expirado.md` passa a cobrir os dois.
