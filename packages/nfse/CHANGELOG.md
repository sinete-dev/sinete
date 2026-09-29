# @sinete/nfse

## 0.1.0

### Minor Changes

- 515861a: O DANFSe passa a ser gerado localmente, pelo `@sinete/da/nfse`, porque a API de geração do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026) e responde 404.
  
  Mudança de API no emissor de NFS-e (`@sinete/emissor/nfse`): `pdf(chave)`, que pedia o PDF ao ADN e devolvia `Promise<Uint8Array | undefined>`, virou `pdf(nfse, opcoes?)`, que recebe o XML da NFS-e (o `proc` do desfecho autorizado), gera o DANFSe v2 sem ir à rede e devolve `Promise<Uint8Array>`. Novos: `pdfCancelado(nfse, evento, opcoes?)`, com a marca de cancelada ou substituída pelo evento registrado, e `pdfPorChave(chave, opcoes?)`, que consulta a NFS-e e os eventos de cancelamento na Sefin e gera com a marca (`undefined` se a Sefin não conhece a chave). A opção `da` aceita o módulo `@sinete/da/nfse`, como nos emissores de NF-e e MDF-e.
  
  Remoção no `@sinete/nfse`: o `NfseClient` não tem mais o `obterDanfse`. Quem o chamava gera o DANFSe com `danfse` de `@sinete/da/nfse` a partir do XML da NFS-e.
- 515861a: Quebra, para os verbos serem os mesmos da NF-e e do MDF-e: `NfseClient.emitir` passa a `autorizar` e `consultarNfse` a `consultar`, com as mesmas assinaturas; `resolverEmissaoSemResposta` passa a `resolverEnvioSemResposta`, e o resultado (`ResolucaoEnvio`, antes `ResolucaoEmissao`) usa `acao` em vez de `situacao`, traz o `outcome` na conclusão, a `dpsAssinada` no reenvio e o caso novo `divergente`, quando a NFS-e do Id tem outra DPS (DigestValue diferente dos bytes gravados). O emissor de poucas linhas (`createNfseEmissor`) está no `@sinete/emissor/nfse`.
- 515861a: Quebra, pelo que a Sefin real respondeu na produção restrita em 28/09/2026: `consultarEventos(chave, filtro)` exige `{ tpEvento, nSeqEvento }` (tipo `FiltroEventos`, exportado), porque a Sefin responde 405 sem o tipo e 404 sem a sequência; sem os dois, `ConfigError` antes do envio. A resposta real traz `eventos[].arquivoXml` em base64 do gzip em base64, que o cliente agora decodifica nas duas camadas (os campos `...XmlGZipB64` continuam lidos como reserva). O 404 do caminho completo, com qualquer corpo, é lista vazia; item sem documento, resposta 200 sem eventos e evento de outra NFS-e são `ProtocolError`.
- 515861a: Primeira versão do `@sinete/nfse`, NFS-e Nacional (leiaute 1.01). Traz:
  
  - a DPS tipada (`DpsInput`) com prestador, tomador, intermediário, serviço (cTribNac e NBS), valores, ISSQN e a classificação do IBS/CBS da NT 004;
  - `buildDps`, que monta com validação estrita no XSD vigente e já inclui a declaração UTF-8 exigida pela Sefin (E1229), e `signDps`, que assina por splice;
  - os pedidos de cancelamento e de análise fiscal;
  - o cliente REST com mTLS do próprio emitente (`createNfseClient`): emissão síncrona e substituição, consultas por chave e por Id da DPS, registro e consulta de eventos e DANFSe do ADN;
  - parâmetros municipais (convênio, alíquotas, histórico, regimes especiais, retenções e benefício) com cache trocável;
  - `resolverEmissaoSemResposta`, para envio sem resposta.
  
  A rejeição é desfecho (`NfseRejeicao`, com todos os códigos e a dica do catálogo do `@sinete/rejeicoes/nfse`), não exceção.
- 515861a: Ocorrências de validação classificadas pela fase em que nasceram (ADR 0011): `ValidationIssue.origem` é `entrada` quando a conferência foi sobre a entrada do domínio (o `path` é da entrada e corrigir o valor ali resolve) e `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD e o PL, chave gerada, grupo IBS/CBS da calculadora, regras da NT). `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem; o campo é opcional no tipo, então quem constrói ocorrências fora do sinete não quebra. A calculadora de IBS/CBS pode marcar a origem das próprias ocorrências; sem marca, entram como `montagem`.
  
  `rotuloDoCaminho(path)` no `@sinete/nfe` e no `@sinete/mdfe` dá o rótulo em português do caminho de uma ocorrência (`Item 2, Descrição do produto`, `Condutor 1, CPF`), para os caminhos da entrada e do documento montado, inclusive os do validador de XSD. O mecanismo fica no `@sinete/core` (`normalizarCaminho`, `criarRotuloDoCaminho`) para os outros documentos.

### Patch Changes

- 515861a: O `verProc` padrão da NF-e e do MDF-e, e o `verAplic` padrão da NFS-e (DPS e pedidos de evento), passam de `sinete` para `sinete <versão do pacote>`, montado pelo novo `formatarVerProc` do `@sinete/core` e cortado com segurança se passar dos 20 caracteres do leiaute. A versão de cada pacote é embutida no build (`src/versao-gerada.ts`, gerado a partir do `package.json` por `scripts/versao-gerada.ts`), nunca lida em runtime. `options.verProc`/`options.verAplic` informado continua prevalecendo, como antes.
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/transport@0.1.0
  - @sinete/core@0.1.0
  - @sinete/rejeicoes@0.1.0
  - @sinete/schemas@0.1.0
  - @sinete/validators@0.1.0
