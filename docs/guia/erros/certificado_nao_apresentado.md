# `certificado_nao_apresentado`: o servidor pediu o certificado e não recebeu

O servidor encerrou a conexão TLS, o protocolo que protege a comunicação, com um alerta que o sinete classifica como certificado de cliente não apresentado: 40 (`handshake_failure`), 42 (`bad_certificate`) ou 116 (`certificate_required`, no TLS 1.3). Essa classificação não garante que o certificado estava ausente, especialmente no alerta 40. O erro é um `TransportError` de `@sinete/transport`, que estende `ErroSinete`, com `code: 'certificado_nao_apresentado'`. Decida pelo `code`, usando `ehErroSinete(e, 'certificado_nao_apresentado')` de `@sinete/core`, nunca pela mensagem.

## Causa

O transporte pode ter sido criado sem identidade TLS, com a identidade errada, ou o ambiente de execução pode não ter conseguido apresentar o certificado quando o servidor o pediu. Esse pedido pode ocorrer numa renegociação, quando o servidor solicita uma nova negociação TLS depois da requisição.

O alerta 40 é ambíguo: a SEFAZ, Secretaria da Fazenda, pode enviá-lo quando o certificado está ausente ou não é aceito, mas ele também aparece quando cliente e servidor não conseguem usar uma cifra ou versão de TLS em comum. `detalhes.alert` traz o nome do alerta em minúsculas, como `handshake_failure`.

## Correção

Crie o transporte com a identidade TLS correspondente ao certificado. Para um A1 em arquivo PFX, use `pemIdentity` de `@sinete/transport` e passe o resultado na opção `identity` de `createTransport`. O emissor de `@sinete/emissor` configura essa identidade automaticamente a partir do certificado informado.

Para A3 em token PKCS#11, A3 em nuvem de um Prestador de Serviço de Confiança (PSC) ou chave não exportável, use o helper `sinete-signer`, distribuído no pacote npm `@sinete/signer`, com o cliente de `@sinete/transport/signer`. Passe a propriedade `tlsIdentity` da identidade aberta no helper à opção `identity` do transporte.

Para diagnosticar um A1, rode `npx sinete doctor --pfx arquivo.pfx --uf XX`, substituindo `XX` pela sigla do estado. O comando verifica a negociação TLS com o autorizador de NF-e, Nota Fiscal Eletrônica, daquele estado e informa se o certificado de cliente foi carregado. O ambiente padrão é homologação; use `--ambiente producao` para verificar produção. Se o servidor só pedir o certificado numa renegociação depois da requisição, acrescente `--status` para enviar uma consulta de status do serviço: a negociação inicial sozinha não comprova a aceitação do certificado.

## Armadilha

O código `certificado_recusado` identifica outros alertas de recusa do certificado, mas `certificado_nao_apresentado` não descarta uma recusa, especialmente no alerta 40. Trocar de certificado não resolve se ele nem foi enviado. Confira a identidade configurada e `detalhes.alert` antes de decidir a correção.
