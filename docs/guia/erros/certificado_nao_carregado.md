# `certificado_nao_carregado`: a identidade não entrou no contexto TLS

Depois do handshake, a negociação que estabelece a conexão TLS segura, o socket não tinha certificado local ou tinha um certificado diferente do configurado na identidade do transporte. O erro é uma instância de `ErroTransporte` (`@sinete/transport`), que estende `ErroSinete`, com `code: 'certificado_nao_carregado'`. Decida pelo `code`, usando `ehErroSinete(e, 'certificado_nao_carregado')` de `@sinete/core`, nunca pela mensagem.

## Causa

A identidade não foi aplicada à conexão. Uma possível causa é o reaproveitamento de um socket de outro contexto TLS. Em Node e Bun, o transporte do sinete com identidade PEM confere o certificado local do socket depois do handshake, inclusive quando o socket é reaproveitado do pool de conexões. Se a runtime não expuser o certificado local, a verificação fica inconclusiva: `tls.certificadoLocalCarregado` fica `undefined` na resposta, sem lançar esse erro.

## Correção

Crie um transporte por certificado (o pool de emissores faz isso) e, se usar um transporte personalizado, não compartilhe o `https.Agent` com código que usa outro certificado. O transporte padrão já cria um agente próprio por identidade PEM. Se o erro acontecer com ele, abra uma issue para investigar o defeito, informando a runtime e as versões dela e do sinete.

## Armadilha

Não use `NODE_EXTRA_CA_CERTS` nem um agente global para tentar corrigir esse erro. `NODE_EXTRA_CA_CERTS` configura certificados de autoridades certificadoras confiáveis, não a identidade do cliente. O sinete combina as raízes de confiança por `https.Agent`, sem alterar a configuração global do processo, e mantém o certificado e a chave da identidade nesse agente para isolar as conexões de cada transporte.
