# `certificado_ausente_ou_recusado`: recusa do certificado sem distinguir ausência de recusa

O servidor recusou a conexão ou a requisição sem indicar se faltou o certificado ou se ele não foi aceito. O transporte usa esse código para respostas HTTP 403, como as do servidor IIS, e para a falha `bad record mac`, observada no Ambiente de Dados Nacional (ADN) em TLS 1.3, o protocolo de segurança da conexão. O erro é uma instância de `TransportError` (`@sinete/transport`), que estende `ErroSinete`, com `code: 'certificado_ausente_ou_recusado'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'certificado_ausente_ou_recusado')` de `@sinete/core`, nunca pela mensagem. A conversão de HTTP 403 nesse erro é habilitada por padrão e pode ser desativada com `rejectOn403: false` nas opções do transporte.

## Causa

Nos servidores que pedem o certificado por renegociação, isto é, depois de estabelecer a conexão TLS inicial, a ausência ou recusa pode chegar como HTTP 403 em vez de um alerta TLS. Isso ocorre em servidores de São Paulo (SP), Bahia (BA), SEFAZ Virtual do Ambiente Nacional (SVAN), Ambiente Nacional (AN) e Secretaria de Finanças Nacional (Sefin Nacional). Na Nota Fiscal de Serviço Eletrônica Nacional (NFS-e Nacional), o 403 também pode ocorrer quando o transporte apresenta o certificado de outro contribuinte: a Sefin exige na conexão TLS o mesmo certificado que assina a Declaração de Prestação de Serviços (DPS).

## Correção

Confira se o transporte recebeu a identidade TLS correta, se o certificado está válido e se sua cadeia de certificação está completa. Para um certificado A1 em arquivo PFX/P12, rode `npx sinete doctor --pfx arquivo.pfx --uf XX --status`, substituindo `XX` pela sigla do estado. O comando consulta o status do serviço da Nota Fiscal Eletrônica (NF-e), permitindo verificar a aceitação do certificado nos servidores que só o pedem depois da requisição. O ambiente padrão é homologação; use `--ambiente producao` para verificar produção. É preciso enviar uma requisição para verificar essa aceitação; o `doctor --status` é uma forma de fazer isso.

Na NFS-e Nacional, configure o transporte com o certificado do prestador, o mesmo usado para assinar a DPS. O `doctor --status` só consulta status de NF-e e de Manifesto Eletrônico de Documentos Fiscais (MDF-e), portanto não faz essa verificação para NFS-e. Para certificados A3, inclusive token PKCS#11 ou certificado em nuvem com chave não exportável, use o helper `sinete-signer`, disponível no pacote npm `@sinete/signer`, com o cliente `@sinete/transport/signer`, e verifique a aceitação por uma requisição ao serviço.

## Armadilha

Um handshake TLS bem-sucedido, isto é, a negociação inicial da conexão segura, não prova que o servidor aceitou o certificado nesses servidores: ele só é pedido depois, quando a requisição HTTP é enviada.
