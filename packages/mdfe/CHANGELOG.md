# @sinete/mdfe

## 0.2.0

### Minor Changes

- 2bd9b9a: `NfeClient` e `MdfeClient` aceitam `signal` em todo método que vai à rede, no padrão do `NfseClient`. Na NF-e, `consultar`, `cancelar`, `cancelarPorSubstituicao`, `cartaCorrecao`, `manifestar`, `inutilizar` e `consultarCadastro` ganham `opcoes?: OpcoesEnvio` no fim, e `statusServico` (`StatusServicoOpcoes`) e `distribuicaoDFe` recebem o `signal` no objeto de opções que já tinham. No MDF-e, `statusServico`, `consultar`, `consultarNaoEncerrados` e os eventos ganham `opcoes?: OpcoesEnvio`, e `AutorizarOpcoes` passa a ser o mesmo tipo. Os dois pacotes exportam `OpcoesEnvio`. A mudança é compatível: o parâmetro novo é opcional.
- 2a46db6: Acompanham a fase 2 do ADR 0015 (`@sinete/cert`, `@sinete/transport`, runtime do `@sinete/schemas`, `@sinete/ibs-cbs-dados` e `@sinete/ibs-cbs` com nomes em português). Os tipos desses pacotes que estes recebem e devolvem mudam, e o código de quem os usa muda junto; a tabela completa está nos changesets de cada pacote da fase. Nomes destes pacotes que também mudam:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | `CertificadoAberto` (`@sinete/emissor`) | `signer` | `assinador` |
  | `syntheticCertificate(...).tlsIdentity` (`@sinete/sefaz-sim`) | `{ kind: 'pem', certChain, key }` | `{ tipo: 'pem', cadeia, chave }`, a forma da `IdentidadeTls` |
  | `simTransport` (`@sinete/sefaz-sim`) | `runtime: 'custom'` | `runtime: 'personalizada'` |
- ae8ab90: Acompanham a fase 1 do ADR 0015 (`@sinete/core`, `@sinete/validators` e `@sinete/rejeicoes` com nomes em português). Nenhum nome próprio destes pacotes muda nesta fase, mas os tipos do core que eles recebem e devolvem mudam, e o código de quem os usa muda junto. Os mais visíveis:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | desfecho dos clientes (`ResultadoSefaz`, antes `SefazOutcome`) | `status: 'authorized' \| 'rejected' \| 'denied' \| 'pending'` | `tipo: 'autorizado' \| 'recusado' \| 'denegado' \| 'pendente'` |
  | desfecho autorizado ou denegado | `value` | `valor` |
  | desfecho recusado | `hint` (`probableCause`, `suggestedFix`, `source`) | `dica` (`causaProvavel`, `comoCorrigir`, `fonte`) |
  | desfecho pendente | `ref`, `retryAfterMs` | `referencia`, `aguardarMs` |
  | erros (`ErroSinete`, antes `SineteError`) | `details`, `docs` | `detalhes`, `pagina` |
  | ocorrências (`Ocorrencia`, antes `ValidationIssue`) | `path`, `message` | `caminho`, `mensagem` |
  | `ErroDeValidacao` (antes `ValidationError`) | `issues` | `ocorrencias` |
  | assinador (`Assinador`, antes `Signer`) | `kind: 'data' \| 'digest'`, `sign`, `signDigestInfo`, `certificateDer` | `tipo: 'dados' \| 'digest'`, `assinar`, `assinarDigestInfo`, `certificadoDer` |
  | relógio (`Relogio`, antes `Clock`) | `now()` | `agora()` |
  | resultado local (`Resultado`, antes `Result`) | `value`, `error` | `valor`, `erro` |
  
  A tabela completa de cada pacote da fase está nos changesets do `@sinete/core`, do `@sinete/validators` e do `@sinete/rejeicoes`.
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - `montarMdfe` passa a ser assíncrona e devolve `Promise<ResultadoMontagemMdfe>`, como a `montarNfe` e a `montarDps` (ADR 0009, emenda de 30/set/2026). Quem chamava sem `await` passa a receber uma `Promise`.
  - O `Decimal` próprio do pacote fica em inglês (ADR 0015, exceção 3).
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `BuildMdfeOptions` | `MontarMdfeOpcoes` |
  | `BuildMdfeResult` | `ResultadoMontagemMdfe` |
  | `BuiltMdfe` | `MdfeMontado` |
  | `buildMdfe` | `montarMdfe` |
  | `signMdfe` | `assinarMdfe` |
  | `DecimalFormat` | `FormatoDecimal` |
  | `MdfeIssueCode` | `CodigoOcorrenciaMdfe` |
  | `MDFE_ISSUE_CODES` | `CODIGOS_OCORRENCIA_MDFE` |
  | `MdfeInput` | `DadosMdfe` |
  | `AutorizacaoOutcome` | `ResultadoAutorizacao` |
  | `ConsultaOutcome` | `ResultadoConsulta` |
  | `EventoOutcome` | `ResultadoEvento` |
  | `MdfeClient` | `ClienteMdfe` |
  | `MdfeClientOptions` | `ClienteMdfeOpcoes` |
  | `OpcoesEnvio` | `EnvioOpcoes` |
  | `createMdfeClient` | `criarClienteMdfe` |
  | `gunzipBase64` | `descomprimirGzipBase64` |
  | `gzipBase64` | `comprimirGzipBase64` |
  | `sliceElement` | `recortarElemento` |
  | `offsetDaUf` | `deslocamentoDaUf` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `pagamentosDoLeiaute` | `@retorno.issues` | `@retorno.ocorrencias` |
  | `MontarMdfeOpcoes` | `time` | `tempo` |
  | `MontarMdfeOpcoes`, `ClienteMdfeOpcoes` | `offsetMinutes` | `deslocamentoMin` |
  | `MontarMdfeOpcoes` | `random` | `aleatorio` |
  | `ResultadoMontagemMdfe` | `value` | `valor` |
  | `ResultadoMontagemMdfe` | `issues` | `ocorrencias` |
  | `assinaturaQrCode`, `assinarMdfe`, `ClienteMdfeOpcoes` | `signer` | `assinador` |
  | `montarMdfe` | `input` | `entrada` |
  | `montarMdfe`, `ClienteMdfe` | `options` | `opcoes` |
  | `comQrCode`, `assinarMdfe` | `built` | `manifesto` |
  | `comQrCode`, `qrCodeMdfe` | `sign` | `assinatura` |
  | `pagamentosDoLeiaute`, `rotuloDoCaminho` | `path` | `caminho` |
  | `FormatoDecimal` | `name` | `nome` |
  | `FormatoDecimal` | `intDigits` | `digitosInteiros` |
  | `FormatoDecimal` | `nonZero` | `naoNulo` |
  | `dec` | `input` | `valor` |
  | `sum` | `values` | `valores` |
  | `DocumentoAssinado`, `recortarElemento` | `doc` | `documento` |
  | `ClienteMdfeOpcoes` | `transport` | `transporte` |
  | `ClienteMdfeOpcoes` | `clock` | `relogio` |
  | `ResolucaoEnvio` | `outcome` | `resultado` |
  | `criarClienteMdfe` | `options` | `opcoesDoCliente` |
  | `comprimirGzipBase64` | `text` | `texto` |
  | `recuperarEventoRegistrado`, `resolverEnvioSemResposta` | `client` | `cliente` |
  | `recortarElemento` | `parentDefaultNs` | `nsPadraoDoPai` |

### Patch Changes

- Updated dependencies [4a3d258]
- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
- Updated dependencies [2a46db6]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [d824983]
  - @sinete/validators@0.2.0
  - @sinete/core@0.2.0
  - @sinete/transport@0.2.0
  - @sinete/schemas@0.2.0
  - @sinete/rejeicoes@0.2.0

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
