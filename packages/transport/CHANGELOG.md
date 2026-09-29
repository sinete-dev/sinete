# @sinete/transport

## 0.1.0

### Minor Changes

- 515861a: A API de geração do DANFSe do ADN, suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026), sai dos dados e do simulador. Mudança de API: `NfseApi` do `@sinete/transport` não tem mais `'danfse'`, e o `nfseEndpoint` não resolve mais essa base; no `@sinete/sefaz-sim`, `NFSE_SIM_PREFIXOS` perde a chave `danfse`, `NfseRota` perde a rota `'danfse'` e o `GET /danfse/{chave}` passa a responder 404. O DANFSe v2 sai do XML da NFS-e pelo `@sinete/da/nfse`.
- 515861a: Novo código `servico_nao_oferecido` (`ServicoNaoOferecidoError`) para o serviço que a tabela oficial de web services não lista para a UF ou o ambiente, como a consulta cadastro de uma UF que a SVRS não atende nesse serviço. Antes esses casos saíam como `config_invalida`, que continua valendo só para defeito de integração. `details` traz `autorizador`, `servico`, `ambiente` e, quando informada, a `uf`.
- 515861a: Primeira versão do @sinete/transport: `Transport` com identidade TLS plugável (`pem` em processo; `helper`, `external` e `pkcs11` como interface do ADR 0005), Node e Bun sobre `node:https` (renegociação, CBC, `sigalgs`, conferência do certificado local), Deno sobre `Deno.createHttpClient` com recusa tipada dos hosts incompatíveis, endpoints de NF-e, MDF-e e NFS-e Nacional e perfis TLS por host como dados, SOAP 1.2, `HostPolicy` com allowlist e erros tipados a partir dos alertas TLS e respostas HTTP observados.
- 515861a: Endpoints da NFC-e (modelo 65) como dados: autorizadores próprios (AM, GO, MG, MS, MT, PR, RS, SP) e a SVRS para as demais UFs, em produção e homologação, da relação de serviços da SVRS e da página da SEF/MG. Novos `nfceEndpoint`, `nfceAutorizadorDaUf` e `nfceConsultaUrls` (QR Code e consulta por chave onde a tabela oficial os publica), `DocumentoFiscal` ganha `nfce`, e os hosts da NFC-e entram em `allEndpoints` e `ambienteHosts`.
- 515861a: Novo subpath `@sinete/transport/signer` (e `sinete/transport/signer`): cliente do helper nativo `sinete-signer` para certificado A3 em token PKCS#11, A3 em nuvem de PSC, OpenBao Transit e `CryptoKey` não exportável. `startSigner` sobe o binário, `connectSigner` conecta no socket Unix, `connectSignerChannel` fala o protocolo sobre qualquer canal; `openRemote` aplica a política do dono da chave e `openPkcs11` devolve também o `documentSigner`, que assina XML pelo `dfe.sign` validado pelo helper; `certificadoAberto` monta o certificado que o `@sinete/emissor` aceita. Falhas do helper viram os `TransportError` de sempre (`classifyHelperFailure`) ou o novo `SignerError` (`signer_indisponivel`, `signer_protocolo`, `assinatura_tls_recusada`, `assinatura_tls_expirou`, `pkcs11_falhou`, `assinatura_documento_recusada`). `TlsInfo` ganha `signatures`.
  
  Mudança incompatível: `TlsIdentity` fica com `pem` e `helper`. Os tipos `external` e `pkcs11`, que só lançavam `UnsupportedError`, saíram; use `openRemote` e `openPkcs11`, que devolvem a identidade `helper`. `TlsSignContext.purpose` passa a ser `'tls12-client-certificate-verify'`, o valor do protocolo.
- 515861a: A SVC não oferece a inutilização (NT 2013.007 v1.03, item 04.5): `nfeEndpoint` com `contingencia: 'svc'` recusa `NfeInutilizacao` com `servico_nao_oferecido` também na SVC-AN, que o portal lista no quadro dela, com a NT como `source` do erro. Os dados registram a exclusão em `nfe.svcSemServicos`, e o builder a aplica sobre a tabela do portal.

### Patch Changes

- 515861a: A consulta cadastro de toda UF autorizada pela SVRS volta a ir para a SVRS. O `nfeEndpoint` recusava as UFs fora da linha de consulta cadastro do portal (DF, CE e outras), mas o serviço da SVRS responde por elas: em produção respondeu consultas do DF com 259 e 264. A UF que a SVRS não atender responde com a rejeição dela, como desfecho.
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/cert@0.1.0
  - @sinete/core@0.1.0
