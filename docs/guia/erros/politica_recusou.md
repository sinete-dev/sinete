# `politica_recusou`: a política de hosts recusou o envio

O envio foi recusado antes de abrir uma conexão de rede. O erro é um `PolicyError` (`@sinete/transport`), derivado de `ErroSinete`, com `code: 'politica_recusou'`. Ele pode vir da `HostPolicy`, a política que controla os destinos permitidos e pode conferir o ambiente do documento, ou de verificações do transporte e do cliente. Decida pelo `code` (`ehErroSinete(e, 'politica_recusou')`, com `ehErroSinete` de `@sinete/core`), nunca pela mensagem.

## Causa

O pedido ia para um host fora da lista permitida ou para uma porta não permitida. Se a política confere o `tpAmb`, campo que identifica o ambiente (`1` para produção e `2` para homologação), ela também recusa valores diferentes do esperado no corpo. A ausência desse campo em um pedido POST causa a recusa quando a política exige sua presença. O transporte também lança este erro se a URL contém credenciais ou se o cabeçalho `Host` difere do host da URL.

No MDF-e (Manifesto Eletrônico de Documentos Fiscais), o documento vai comprimido, e o próprio cliente confere o `tpAmb` antes do envio. Se o campo estiver ausente ou diferente do ambiente do cliente, ele lança `PolicyError`. Na NFS-e (Nota Fiscal de Serviço Eletrônica), a DPS (Declaração de Prestação de Serviços) também vai comprimida e tem o ambiente conferido pelo cliente, mas essa divergência lança `ErroDeConfiguracao`, com `code: 'config_invalida'`.

## Correção

Confira o `ambiente` do emissor ou do cliente e o `tpAmb` do documento. Quando o sinete monta o documento, o campo é preenchido a partir do ambiente informado na montagem, que deve ser o mesmo usado no envio. Confira também o host e a porta de destino, remova credenciais da URL e corrija qualquer cabeçalho `Host` divergente. Se a política exige `tpAmb` no corpo, verifique se essa exigência é adequada à operação e ao formato enviado.

Para apontar para um simulador ou adicionar uma autoridade certificadora (AC) de teste, personalize o transporte pela opção `transporte` do emissor. Ela recebe uma função que cria o transporte a partir das opções padrão. Mantenha a política no transporte de produção.

## Armadilha

Nunca desligue a política para "destravar" um envio. A conferência de destinos e de ambiente, junto das verificações dos clientes para documentos comprimidos, impede o envio de um documento de produção ao ambiente de homologação ou de um documento de homologação ao ambiente de produção.
