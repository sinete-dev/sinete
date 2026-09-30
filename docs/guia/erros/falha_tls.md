# `falha_tls`: outra falha de TLS

A conexão TLS, que protege a comunicação com o servidor, falhou sem que o sinete identificasse uma causa com código mais específico. Pode haver incompatibilidade de versão, cifra (conjunto de algoritmos criptográficos) ou negociação inicial da conexão, chamada handshake. O erro é um `ErroTransporte` (`@sinete/transport`), que estende `ErroSinete` e tem `code: 'falha_tls'`. Decida pelo `code`, usando `ehErroSinete(e, 'falha_tls')` de `@sinete/core`, nunca pela mensagem. Esse código, sozinho, não garante que o certificado esteja correto.

## Causa

O servidor pode exigir um recurso que o ambiente de execução (runtime) não oferece, como a troca de chaves DHE no Bun, ou pode ter ocorrido um erro de protocolo. Quando a incompatibilidade já consta no perfil TLS do host, o transporte a recusa antes da conexão com `nao_suportado`. Em `falha_tls`, `detalhes.host` identifica o servidor; `detalhes.alerta` e `detalhes.codigoDoSistema` trazem o alerta TLS e o código do sistema quando disponíveis. Nas falhas relatadas pelo helper `sinete-signer`, `detalhes.mensagemDoHelper` traz a mensagem do helper e `detalhes.etapa` pode indicar a etapa da falha.

## Correção

Para diagnosticar uma conexão com certificado A1, rode `npx sinete doctor --pfx arquivo.pfx --uf XX`, substituindo `XX` pela sigla da UF (estado) desejada. O comando usa homologação por padrão; acrescente `--ambiente producao` se a falha ocorrer em produção. Use `--endpoint URL` para testar um endereço específico. Se o handshake funcionar, o diagnóstico mostra protocolo e cifra negociados.

Execute o diagnóstico na mesma runtime da aplicação. O comando com `npx` usa Node; para Bun, use `bunx --bun sinete doctor --pfx arquivo.pfx --uf XX`. Se a falha for uma limitação do transporte da runtime, use Node, cujas capacidades cobrem os requisitos dos perfis TLS medidos que acompanham o sinete. Para conexões com certificado A3 ou chave não exportável pelo `sinete-signer`, examine os detalhes da falha do helper: o diagnóstico com `--pfx` testa uma conexão A1, e trocar a runtime da aplicação não altera o TLS executado pelo helper.

## Armadilha

No caso de incompatibilidade com o perfil TLS do host, `nao_suportado` indica que o sinete recusou a operação antes de abrir o socket, pois a runtime não oferece os recursos exigidos. Em `falha_tls`, houve uma tentativa de conexão e a falha não recebeu um código mais específico. Além disso, o alerta `handshake_failure` é classificado como `certificado_nao_apresentado`, embora também possa indicar falta de acordo sobre cifra ou versão.
