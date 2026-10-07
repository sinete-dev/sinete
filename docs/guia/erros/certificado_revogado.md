# `certificado_revogado`: a AC revogou o certificado

O servidor recebeu o certificado de cliente e o recusou durante a negociação TLS, que estabelece a conexão segura, porque a autoridade certificadora (AC) que o emitiu o revogou (alerta 44, `certificate_revoked`). O transporte lança um `ErroTransporte` de `@sinete/transport`, que herda de `ErroSinete`, com `code: 'certificado_revogado'` e `detalhes.alerta` igual a `certificate_revoked`. Trate o erro pelo `code`, usando `ehErroSinete(e, 'certificado_revogado')` de `@sinete/core`, nunca pela mensagem.

## Causa

O titular ou a AC pediu a revogação do certificado (troca de certificado, perda ou suspeita de comprometimento da chave, mudança de dados da empresa), e o servidor consultou a lista de certificados revogados (LCR) da AC antes de aceitar a conexão. A revogação vale a partir da publicação na LCR, mesmo com o certificado ainda dentro da validade.

## Correção

Emita um certificado novo com a AC e troque a identidade configurada. Se a empresa acabou de renovar o certificado, confira se o sistema ainda carrega o arquivo antigo, que pode ter sido revogado na emissão do novo.

## Armadilha

Repetir a chamada ou trocar de autorizador não resolve: a revogação é do certificado, e todo servidor que consulta a LCR vai recusá-lo. O `abrirPfx` não consulta a LCR, então um PFX revogado abre sem erro e só falha na conexão. Quem trata todas as recusas de certificado juntas pode comparar o prefixo `certificado_` do `code`, que também cobre [`certificado_recusado`](certificado_recusado.md) e [`certificado_expirado`](certificado_expirado.md). No Bun, com o servidor em TLS 1.3, esta recusa chega como [`conexao_recusada`](conexao_recusada.md), sem o alerta: o Bun não o entrega.
