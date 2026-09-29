---
'@sinete/nfse': minor
---

Quebra, para os verbos serem os mesmos da NF-e e do MDF-e: `NfseClient.emitir` passa a `autorizar` e `consultarNfse` a `consultar`, com as mesmas assinaturas; `resolverEmissaoSemResposta` passa a `resolverEnvioSemResposta`, e o resultado (`ResolucaoEnvio`, antes `ResolucaoEmissao`) usa `acao` em vez de `situacao`, traz o `outcome` na conclusão, a `dpsAssinada` no reenvio e o caso novo `divergente`, quando a NFS-e do Id tem outra DPS (DigestValue diferente dos bytes gravados). O emissor de poucas linhas (`createNfseEmissor`) está no `@sinete/emissor/nfse`.
