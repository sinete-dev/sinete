# Por que o autorizador sai do documento e da chave

No sinete, o endereço de autorização de uma NF-e (Nota Fiscal Eletrônica) sai do próprio documento, sem uma UF fixa no emissor. A chave de acesso identifica a unidade federativa (UF) pelo código `cUF` e a forma de emissão pelo campo `tpEmis`. Na contingência, usada quando o serviço normal está indisponível, esse campo também identifica a Sefaz Virtual de Contingência (SVC). A autorização, a consulta, o cancelamento e a consulta do recibo acompanhada da nota assinada seguem essas informações. A decisão está no registro de decisão arquitetural ADR 0010 do sinete e na implementação do `NfeClient` do `@sinete/nfe`.

## O problema de uma UF fixa

Um emissor configurado com "UF: SP" erra em dois casos que aparecem em produção:

- **Contingência que acaba.** A nota autorizada na SVC (`tpEmis` 6 para SVC-AN, 7 para SVC-RS; Manual de Orientação do Contribuinte, MOC 7.0, campo B22) deve ser consultada e cancelada na SVC que a autorizou, mesmo depois de o serviço normal da UF voltar (Nota Técnica 2013.007). Um emissor que manda tudo para o autorizador normal da UF consulta no lugar errado, recebe "não consta" e pode reenviar a operação como uma nova nota.
- **Retomada depois da troca de configuração.** O documento gravado ontem, com a contingência ligada, é retomado hoje com ela desligada. O endereço certo é o correspondente à forma de emissão registrada no documento assinado, que continua nos bytes gravados.

Os dois casos podem levar à duplicação da operação: consulta no autorizador errado, interpretação de "não consta" como ausência de autorização e emissão de uma nova nota para a mesma operação.

## A regra

- **A chave decide.** `autorizar`, `consultar`, `cancelar` e `consultarRecibo` com a nota assinada vão ao autorizador da chave: o autorizador da UF indicada por `cUF` ou, com `tpEmis` 6 ou 7, a SVC correspondente.
- **Exceções do próprio leiaute.** A carta de correção vai sempre ao autorizador normal da UF, porque a SVC só recebe o evento de cancelamento (Nota Técnica 2013.007). A inutilização de números não utilizados vai sempre ao autorizador normal da UF. A manifestação do destinatário, que registra sua posição sobre a operação, vai ao Ambiente Nacional, com o código do órgão receptor `cOrgao` igual a 91. A NFC-e (Nota Fiscal de Consumidor Eletrônica) usa sua própria tabela de endereços de serviço, que em várias UFs aponta para um host diferente do usado pela NF-e, e não tem SVC.
- **O que não parte de um documento** usa as opções do cliente conforme o serviço. O status do serviço e o recibo consultado sem a nota usam `uf` e, para NF-e, `contingencia`. A inutilização usa `uf`, mas ignora `contingencia`. A distribuição de documentos fiscais vai ao Ambiente Nacional e usa `uf` como padrão para `cUFAutor`, o código da UF do interessado, quando esse campo não é informado no pedido.
- **Um emissor atende todas as UFs do certificado.** Como o emissor de NF-e não fixa a UF de autorização, ele pode ser reutilizado para as UFs atendidas pelo certificado, dentro do mesmo ambiente. O pool guarda emissores por certificado, sem precisar separá-los por UF. A chave padrão do pool identifica o certificado, mas não inclui o ambiente: mantenha pools separados para produção e homologação ou forneça uma chave que também identifique o ambiente.

## E o ambiente

O ambiente segue a mesma ideia de conferir o que está nos bytes. O transporte padrão do emissor permite apenas os hosts do ambiente configurado e confere os campos `tpAmb` presentes no corpo antes de abrir a conexão. Esse campo identifica produção (`1`) ou homologação (`2`), o ambiente de testes. Uma divergência é recusada com `ErroPolitica` (`politica_recusou`).

No MDF-e (Manifesto Eletrônico de Documentos Fiscais) e na NFS-e (Nota Fiscal de Serviço Eletrônica) Nacional, o conteúdo enviado viaja comprimido, e a política do transporte não consegue inspecioná-lo. Por isso, os próprios clientes conferem o ambiente antes do envio. O cliente de MDF-e recusa um documento com `tpAmb` divergente usando `ErroPolitica` (`politica_recusou`). O cliente de NFS-e faz essa conferência na DPS (Declaração de Prestação de Serviços, enviada para gerar a nota) e no pedido de registro de evento, mas lança `ErroDeConfiguracao` (`config_invalida`). Com essas verificações e o transporte padrão do emissor, o envio de um documento de produção por um cliente de homologação é barrado, assim como o caminho inverso.

## Veja também

- [Contingência](../como-fazer/contingencia.md).
- Erro [`politica_recusou`](../erros/politica_recusou.md).
- Referência: [`@sinete/nfe`](../referencia/nfe.md) e [`@sinete/transport`](../referencia/transport.md).
