# `certificado_expirado`: o certificado já venceu

O certificado do arquivo PFX, que contém o certificado e a chave privada, passou do fim da validade segundo o relógio fornecido a `openPfx`. A função lança um `CertError` (`@sinete/cert`), que é um `SineteError` com `code: 'certificado_expirado'`. Trate o erro pelo `code`, usando `isSineteError(e, 'certificado_expirado')` de `@sinete/core`, nunca pela mensagem.

## Causa

O certificado A1 venceu (em geral, vale um ano), ou o relógio passado ao sinete está adiantado. Quando recebem o PFX e a senha, os emissores recusam o certificado vencido durante a criação, antes de qualquer envio. Essa verificação ocorre na abertura do PFX; fornecer um certificado já aberto não repete essa verificação.

## Correção

Renove o certificado com a autoridade certificadora (AC) e substitua o PFX. Para diagnóstico, `openPfx(pfx, { password, clock, allowExpired: true })` abre o arquivo mesmo com o certificado vencido e retorna `validity: 'expirado'`. Essa propriedade registra a validade no instante da abertura. A Secretaria da Fazenda (SEFAZ) recusa assinaturas e conexões TLS, usadas na comunicação segura, com certificado vencido.

## Armadilha

Não use `allowExpired` para emitir: a opção permite diagnóstico e reprocessamento, mas não torna o certificado válido para envio. Confira também o relógio: um `manualClock` de `@sinete/core`, usado em testes e esquecido num ambiente real com uma data posterior ao vencimento, produz este erro mesmo que o certificado ainda esteja válido na data real.
