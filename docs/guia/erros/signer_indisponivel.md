# `signer_indisponivel`: o helper sinete-signer não está disponível

O cliente do `@sinete/transport/signer` não encontrou o binário, o processo não iniciou ou o canal de comunicação com o helper foi fechado ou recusou a escrita. O helper é o processo auxiliar `sinete-signer`, usado para assinar documentos e estabelecer conexões autenticadas com a chave do certificado. O erro é uma instância de `ErroSigner` (`@sinete/transport`), que estende `ErroSinete` e tem `code: 'signer_indisponivel'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'signer_indisponivel')` de `@sinete/core`, nunca pela mensagem.

## Causa

O `iniciarSigner` de `@sinete/transport/signer` precisa do caminho do binário na opção `binario` ou na variável de ambiente correspondente: `SINETE_SIGNER_BIN` para a versão estática, ou `SINETE_SIGNER_P11_BIN` quando `pkcs11: true`. PKCS#11 é a interface de acesso a tokens criptográficos. Sem um caminho informado, ou com um caminho que não existe, a chamada falha antes de iniciar o processo. O binário não é buscado no `PATH`; caminhos relativos são resolvidos a partir do diretório atual.

O `iniciarSigner` de `@sinete/signer` também aceita essas opções e variáveis, mas, na ausência delas, busca o binário no pacote npm da plataforma. Se esse pacote não estiver instalado ou não contiver o binário solicitado, lança o mesmo erro.

O código também aparece quando o processo não consegue iniciar, quando o helper encerra, por exemplo, por sinal, falta de memória ou falha no módulo PKCS#11, e quando o canal recusa uma escrita. Com `conectarSigner`, aparece tanto na falha de conexão ao socket Unix quanto após o fechamento da conexão. Chamadas em andamento falham quando o canal fecha, assim como novas chamadas feitas pela conexão já fechada.

## Correção

Passe o caminho do binário da plataforma e confira seu SHA-256 com o `SHA256SUMS` da versão. Se usar o `iniciarSigner` de `@sinete/signer`, confira se as dependências opcionais foram instaladas: não use `--no-optional` nem `--omit=optional`. Para PKCS#11, use a versão `-p11` e `iniciarSigner({ pkcs11: true, ... })`. Essa opção só muda a seleção do binário padrão; se informar `binario`, ele precisa apontar para a versão com suporte a PKCS#11.

Se o helper iniciado por `iniciarSigner` encerrou sozinho, confira sua saída de diagnóstico (`stderr`), encaminhada ao `logger` do cliente. Configure um `logger`, pois o padrão não registra mensagens; as linhas comuns chegam ao nível `debug`, e as de auditoria, ao nível `info`. Com `conectarSigner`, consulte os logs do processo ou contêiner que executa o helper.

Uma conexão que caiu não se reconecta automaticamente. Abra outra com `iniciarSigner` ou, se o helper atende em um socket Unix, com `conectarSigner`, depois de verificar se ele está em execução e se o socket está acessível. Abra novamente as identidades, que são as sessões de uso dos certificados e das chaves naquela conexão.

## Armadilha

Não repita o envio de um documento às cegas depois dessa falha: a requisição pode ter chegado à Secretaria da Fazenda (SEFAZ) ou ao serviço fiscal de destino antes de o helper encerrar. O `@sinete/emissor` não inclui `signer_indisponivel` entre os códigos tratados automaticamente como envio sem resposta; esse erro é propagado para quem chamou. Depois de restabelecer a conexão, consulte a situação do documento antes de decidir pelo reenvio, tanto ao usar o emissor quanto ao chamar diretamente o cliente do documento.
