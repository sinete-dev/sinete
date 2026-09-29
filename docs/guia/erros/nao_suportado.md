# `nao_suportado`: a runtime não suporta o que foi pedido

O ambiente de execução (Node, Bun, Deno ou browser), também chamado de runtime, ou o pacote instalado não consegue fazer o que foi pedido. O erro é representado por `UnsupportedError` (`@sinete/core`), um `SineteError` com `code: 'nao_suportado'`. Identifique-o pelo `code`, usando `isSineteError(e, 'nao_suportado')`, nunca pela mensagem.

## Causa

Os casos incluem:

- Criar o transporte no browser: o `fetch` não permite fornecer o certificado de cliente pela API, e a entrada padrão do `@sinete/transport` recusa a operação para evitar um envio sem mTLS, a autenticação por certificados tanto do cliente quanto do servidor.
- Usar o transporte do Deno com identidade `pem` diante de um host da SEFAZ (Secretaria da Fazenda) que pede o certificado por renegociação TLS, uma nova negociação de segurança durante a conexão, ou exige algoritmos criptográficos que a biblioteca TLS do Deno, rustls, não suporta. O erro é `TransportUnsupportedError`, com `details.host`, `details.reasons` e `details.alternative`.
- Usar o transporte do Bun com identidade `pem` num host que só oferece DHE, um mecanismo de troca de chaves não suportado por esse transporte, como o de Goiás em produção nos perfis do pacote.
- Usar o transporte do Deno com identidade `pem` e `unknownHosts: 'refuse'` para um host sem perfil TLS nos dados do sinete.
- Criar o transporte do Deno sem que `Deno.createHttpClient` esteja disponível.
- Usar `trust: 'system'` no transporte em processo quando a runtime não oferece `tls.getCACertificates`, necessário para carregar os certificados de confiança do sistema.
- Executar uma operação de compressão ou descompressão sem `CompressionStream` ou `DecompressionStream`, respectivamente, na runtime.
- Selecionar uma vigência que aponta para um módulo de leiaute que o pacote instalado não conhece.

Certificados A3 e chaves não exportáveis já são suportados pelo helper nativo `sinete-signer`, disponível pelo pacote npm `@sinete/signer`, com cliente em `@sinete/transport/signer`. A identidade TLS usada pelo transporte nesse caso é `kind: 'helper'`; `external` e `pkcs11` não são variantes atuais de `TlsIdentity`.

## Correção

Ajuste o ambiente, o transporte ou a versão instalada conforme a causa. Para transmissão no browser, mova a operação para o servidor ([como usar no browser](../como-fazer/browser.md)).

Para incompatibilidades TLS no Deno, consulte `details.host` para identificar o servidor e `details.reasons` para entender as exigências incompatíveis. `details.alternative` traz uma orientação de alternativa; confira se ela atende ao motivo informado. Node ou Bun atendem aos hosts que exigem renegociação, mas, se o host só oferece DHE, use Node ou o helper `sinete-signer`. Para certificados A3 em token via PKCS#11, a interface de acesso ao dispositivo, A3 em nuvem de um PSC (Prestador de Serviço de Confiança) ou outras chaves não exportáveis, siga [como usar certificado A3 e chave fora do processo](../como-fazer/certificado-a3.md).

Se o Deno recusou um host sem perfil TLS e você pretende acessar esse endpoint próprio, configure `unknownHosts: 'allow'`. Se falta `Deno.createHttpClient`, execute no Deno ou use o transporte da runtime escolhida. Se falta `tls.getCACertificates` com `trust: 'system'`, use uma versão do Node que ofereça essa API. Para compressão e descompressão, use uma runtime que disponibilize a API exigida pela operação.

Se o leiaute é desconhecido, atualize os pacotes `@sinete/*` envolvidos, ou o `sinete`, para a versão que inclui o pacote de liberação (PL) vigente, isto é, os leiautes e as regras fiscais aplicáveis ao período.

## Armadilha

Não troque o transporte por um `fetch` comum para "funcionar" no browser: ele não usa a identidade TLS fornecida ao sinete. A SEFAZ pode recusar a conexão por falta do certificado, ou o envio pode ocorrer sem a autenticação do cliente esperada para aquele host. Esse erro indica uma limitação de suporte; repetir a chamada sem corrigir a causa produz a mesma falha.
