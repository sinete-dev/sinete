# `servico_nao_oferecido`: o autorizador não oferece esse serviço

O serviço pedido não está disponível para aquela UF (estado ou Distrito Federal), aquele autorizador ou aquele ambiente, segundo os dados oficiais incorporados ao sinete. O autorizador é o sistema fiscal responsável pelo atendimento da solicitação. O erro é uma instância de `ServicoNaoOferecidoError` (`@sinete/core`), que estende `SineteError` com `code: 'servico_nao_oferecido'`. Decida pelo `code`, usando `isSineteError(e, 'servico_nao_oferecido')`, nunca pela mensagem.

## Causa

A tabela de serviços usada pelo sinete não contém o serviço para o autorizador e o ambiente selecionados. Isso ocorre ao pedir Distribuição DF-e (distribuição de documentos fiscais eletrônicos) para NFC-e (Nota Fiscal de Consumidor Eletrônica), ao consultar o cadastro pela NFC-e onde a tabela não publica esse serviço ou ao selecionar explicitamente um autorizador que não o oferece naquele ambiente.

Também ocorre ao pedir inutilização de numeração de NF-e (Nota Fiscal Eletrônica) à SVC (Sefaz Virtual de Contingência, usada como alternativa ao autorizador normal). A SVC não oferece esse serviço, mesmo quando o portal oficial lista uma URL para ele. O sinete considera essa restrição ao montar sua tabela.

A consulta de cadastro da NF-e de uma UF atendida pela SVRS (Sefaz Virtual do Rio Grande do Sul) segue para a SVRS quando se usa o autorizador normal da UF, mesmo que ela não apareça na relação específica de consulta de cadastro. Se a SVRS não atender aquela UF, a rejeição vem na resposta do serviço.

`details` traz `autorizador`, `servico`, `ambiente`, `uf` quando informada e `source`, que identifica a fonte oficial consultada. Para a inutilização na SVC, `source` indica a nota técnica que estabelece a restrição.

## Correção

Confira em `details` qual serviço, autorizador e ambiente foram selecionados. Alterar os dados do documento não disponibiliza um serviço ausente. Se a operação puder continuar sem ele, trate a indisponibilidade como uma situação esperada. Quando o serviço faltante for uma consulta, peça os dados a quem preenche em vez de mostrar erro.

Se o pedido for de inutilização na SVC, use o autorizador normal da UF. Se um autorizador tiver sido escolhido explicitamente, confira se ele é adequado ao serviço pedido.

Se a SEFAZ (Secretaria da Fazenda) passou a oferecer o serviço, atualize os pacotes `@sinete/*` para a versão que incorpora a tabela nova.

## Armadilha

Não trate como falha de rede nem repita a mesma chamada: com os mesmos parâmetros e a mesma tabela, ela falha novamente. Não confunda com `config_invalida`, que indica um problema de configuração, como uma opção obrigatória ausente ou uma UF inválida. `servico_nao_oferecido` indica que o serviço não está disponível na combinação selecionada, segundo os dados oficiais usados pelo sinete.
