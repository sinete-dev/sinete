# @sinete/mdfe

## 0.1.0

### Minor Changes

- 515861a: `nfeAssinadaDoProc(xml)` e `mdfeAssinadoDoProc(xml)`: o documento assinado de dentro do `nfeProc` ou do `mdfeProc` guardado (ou o próprio documento), como fatia do texto. Os namespaces que a raiz herdava do envelope são declarados nela, porque `consultar`, `resolverEnvioSemResposta` e a retomada recusam raiz sem `xmlns` próprio; o C14N do elemento assinado não muda, então a assinatura confere dentro e fora do proc. Sem documento assinado, `ConfigError`.
- 515861a: Protocolo sem `digVal` (opcional no leiaute) deixa de prender a gravação. A denegação (110, 301, 302, 303) é decisão sobre a chave: na resposta do envio e na consulta, o emissor devolve `denegado`, definitivo, mesmo sem `digVal`, com `conteudo` (`confere`, `sem-digval` ou `difere`), os bytes gravados em `xml` e o `proc` só quando o `digVal` confere (`proc` passa a ser opcional no `DesfechoDenegado`). A autorização sem `digVal` nem na consulta vira `divergente` com `conteudo: 'sem-digval'`, com os bytes mantidos e alerta na primeira retomada, em vez de `pendente` para sempre; o mesmo vale para o MDF-e. No `@sinete/nfe` e no `@sinete/mdfe`, o `resolverEnvioSemResposta` ganha a ação `sem-prova` e, na NF-e, conclui a denegação com qualquer conteúdo, dizendo qual em `conteudo`. O `@sinete/sefaz-sim` ganha `setProtocoloSemDigVal` para reproduzir o caso.
- 515861a: Quebra: `MdfeClient.autorizar(mdfeAssinado, signal)` passa a `autorizar(mdfeAssinado, { signal })`, com o tipo `AutorizarOpcoes`, como na NF-e e na NFS-e. O emissor de poucas linhas (`createMdfeEmissor`) está no `@sinete/emissor/mdfe`, e o `@sinete/mdfe` não tem mais o `@sinete/da` como peer dependency.
- 515861a: Primeira versão do @sinete/mdfe: MDF-e modelo 58, leiaute 3.00b, modal rodoviário (carga própria, inclusive produtor rural com e-CPF, e prestador de serviço de transporte). `buildMdfe` monta o MDF-e a partir de uma entrada tipada (emitente, veículos de tração e reboque, condutores, CIOT, vale-pedágio, contratantes, pagamento do frete, seguro, produtos perigosos, produto predominante com `infLotacao`, municípios de carregamento e descarregamento, NF-e e CT-e, totais), escolhe o schema pela vigência, gera chave e cMDF, confere as regras do Anexo I antes de serializar (percurso pela tabela de divisas do IBGE com sugestão de caminho, CIOT e NCM por vigência como dado) e valida contra o XSD. `signMdfe` põe o QR Code (com `sign` na contingência off-line de 168 horas) e assina por splice. `createMdfeClient` faz status, autorização síncrona, consulta com conferência do `digVal`, consulta de não encerrados e os eventos de cancelamento, encerramento, inclusão de condutor, inclusão de DF-e e pagamento da operação, com desfechos `SefazOutcome` enriquecidos pelo catálogo do MDF-e do `@sinete/rejeicoes`; `resolverEnvioSemResposta` recupera o protocolo de um envio sem resposta. Regras da NT 2024.001, que não estão no MOC 3.00b: chaves de CT-e e NF-e com mais de 6 meses, cavalo mecânico sem reboque e o encerramento pelo transportador terceiro (`encerrar({ terceiro })`).
- 515861a: Ocorrências de validação classificadas pela fase em que nasceram (ADR 0011): `ValidationIssue.origem` é `entrada` quando a conferência foi sobre a entrada do domínio (o `path` é da entrada e corrigir o valor ali resolve) e `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD e o PL, chave gerada, grupo IBS/CBS da calculadora, regras da NT). `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem; o campo é opcional no tipo, então quem constrói ocorrências fora do sinete não quebra. A calculadora de IBS/CBS pode marcar a origem das próprias ocorrências; sem marca, entram como `montagem`.
  
  `rotuloDoCaminho(path)` no `@sinete/nfe` e no `@sinete/mdfe` dá o rótulo em português do caminho de uma ocorrência (`Item 2, Descrição do produto`, `Condutor 1, CPF`), para os caminhos da entrada e do documento montado, inclusive os do validador de XSD. O mecanismo fica no `@sinete/core` (`normalizarCaminho`, `criarRotuloDoCaminho`) para os outros documentos.
- 515861a: `recuperarEventoRegistrado(client, chave, tpEvento)`: consulta a chave e devolve o evento que a SEFAZ registrou (o `procEventoNFe` ou `procEventoMDFe` da consulta, com `nProt`, `dhRegEvento` e o retorno), para o pedido de evento que ficou sem resposta ou voltou 573 ou 580 (no MDF-e, duplicidade de evento). Só dá o evento como registrado quando o retorno diz 135, 136 ou 155 (MDF-e: 135, 134 ou 136) para a mesma chave e o mesmo tipo no pedido e no retorno; entre vários do mesmo tipo, o de maior sequência. Nunca infere pelo `cStat` do pedido. `registrado: false` traz a consulta, que pode ter sido só indecisa.

### Patch Changes

- 515861a: `MdfeClient.autorizar` confere o `tpAmb` do MDF-e assinado contra o ambiente do cliente e recusa com `PolicyError` (`politica_recusou`, com `tpAmb` e `esperado` nos detalhes) antes do envio. O MDF-e vai em GZip e Base64, onde a `allowlistPolicy` do transporte não enxerga o `tpAmb`; sem a conferência, um MDF-e de produção podia ir à homologação, ou o contrário, sem a trava que a NF-e tem.
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
