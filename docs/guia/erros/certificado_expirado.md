# `certificado_expirado`: o certificado já venceu

O certificado passou do fim da validade. O mesmo `code` sai de dois lugares, e nos dois o remédio é renovar o certificado. Trate o erro pelo `code`, usando `ehErroSinete(e, 'certificado_expirado')` de `@sinete/core`, nunca pela mensagem.

- **Na abertura do PFX** (o arquivo que contém o certificado e a chave privada): `abrirPfx` compara a validade com o relógio fornecido e lança um `ErroCertificado` (`@sinete/cert`).
- **Na conexão TLS**, a negociação que estabelece a conexão segura com a SEFAZ: o servidor recusa o certificado de cliente com o alerta 45 (`certificate_expired`), e o transporte lança um `ErroTransporte` (`@sinete/transport`) com `detalhes.alerta` igual a `certificate_expired`. Acontece quando o certificado chega ao servidor sem passar pela conferência do `abrirPfx`: identidade montada com `identidadePem`, token A3, ou um PFX aberto antes do vencimento num processo que continuou rodando.

## Causa

O certificado A1 venceu (em geral, vale um ano), ou o relógio passado ao sinete está adiantado. Na conexão TLS, quem decide é o relógio do servidor: o certificado venceu na data dele, mesmo que o relógio local diga outra coisa. Quando recebem o PFX e a senha, os emissores recusam o certificado vencido durante a criação, antes de qualquer envio. Essa verificação ocorre na abertura do PFX; fornecer um certificado já aberto não repete essa verificação.

## Correção

Renove o certificado com a autoridade certificadora (AC) e substitua o PFX. Para diagnóstico, `abrirPfx(pfx, { senha, relogio, aceitarVencido: true })` abre o arquivo mesmo com o certificado vencido e retorna `validade: 'expirado'`. Essa propriedade registra a validade no instante da abertura. A Secretaria da Fazenda (SEFAZ) recusa assinaturas e conexões TLS, usadas na comunicação segura, com certificado vencido.

## Armadilha

Não use `aceitarVencido` para emitir: a opção permite diagnóstico e reprocessamento, mas não torna o certificado válido para envio. Confira também o relógio: um `relogioManual` de `@sinete/core`, usado em testes e esquecido num ambiente real com uma data posterior ao vencimento, produz este erro mesmo que o certificado ainda esteja válido na data real. No Bun, com o servidor em TLS 1.3, esta recusa chega como [`conexao_recusada`](conexao_recusada.md), sem o alerta: o Bun não o entrega.
