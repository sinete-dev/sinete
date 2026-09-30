# @sinete/core

## 0.2.0

### Minor Changes

- ae8ab90: Nomes da API pública em português (ADR 0015, fase 1). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `ambienteOfTpAmb` | `ambienteDoTpAmb` |
  | `isAmbiente` | `ehAmbiente` |
  | `tpAmbOf` | `tpAmbDoAmbiente` |
  | `Clock` | `Relogio` |
  | `Instant` | `InstanteInformado` |
  | `ManualClock` | `RelogioManual` |
  | `TimeContext` | `ContextoDeTempo` |
  | `fixedClock` | `relogioFixo` |
  | `formatDateTimeOffset` | `formatarDataHoraComFuso` |
  | `manualClock` | `relogioManual` |
  | `systemClock` | `relogioDoSistema` |
  | `timeContext` | `contextoDeTempo` |
  | `CoreErrorCode` | `CodigoErroCore` |
  | `ErrorDetails` | `DetalhesDoErro` |
  | `SefazErrorCode` | `CodigoErroSefaz` |
  | `SerializedError` | `ErroSerializado` |
  | `SineteErrorOptions` | `ErroSineteOpcoes` |
  | `ValidationIssue` | `Ocorrencia` |
  | `ConfigError` | `ErroDeConfiguracao` |
  | `isSineteError` | `ehErroSinete` |
  | `ProtocolError` | `ErroRespostaInvalida` |
  | `SefazError` | `ErroSefaz` |
  | `ServicoNaoOferecidoError` | `ErroServicoNaoOferecido` |
  | `SineteError` | `ErroSinete` |
  | `TimeoutError` | `ErroDeTempoEsgotado` |
  | `UnsupportedError` | `ErroNaoSuportado` |
  | `ValidationError` | `ErroDeValidacao` |
  | `LogEntry` | `EntradaDeLog` |
  | `LogFields` | `CamposDeLog` |
  | `LogLevel` | `NivelDeLog` |
  | `MemoryLogger` | `LoggerEmMemoria` |
  | `memoryLogger` | `loggerEmMemoria` |
  | `noopLogger` | `loggerSilencioso` |
  | `Authorized` | `Autorizado` |
  | `Denied` | `Denegado` |
  | `OutcomeHandlers` | `TratadoresDeResultado` |
  | `Pending` | `Pendente` |
  | `Rejected` | `Recusado` |
  | `RejectionHint` | `DicaRejeicao` |
  | `Result` | `Resultado` |
  | `SefazOutcome` | `ResultadoSefaz` |
  | `SefazOutcomeStatus` | `TipoResultadoSefaz` |
  | `SefazStatus` | `StatusSefaz` |
  | `authorized` | `criarAutorizado` |
  | `denied` | `criarDenegado` |
  | `pending` | `criarPendente` |
  | `rejected` | `criarRecusado` |
  | `isAuthorized` | `autorizado` |
  | `isDenied` | `denegado` |
  | `isPending` | `pendente` |
  | `isRejected` | `recusado` |
  | `isCStat` | `ehCStat` |
  | `matchOutcome` | `tratarResultado` |
  | `unwrapAuthorized` | `exigirAutorizado` |
  | `err` | `falha` |
  | `DataSigner` | `AssinadorDeDados` |
  | `DigestSigner` | `AssinadorDeDigest` |
  | `SignatureHash` | `HashDaAssinatura` |
  | `SignContext` | `ContextoDaAssinatura` |
  | `Signer` | `Assinador` |
  | `SignerKind` | `TipoAssinador` |
  | `DataSource` | `FonteDeDados` |
  | `UfInfo` | `UnidadeFederativa` |
  | `UfTableInfo` | `DescricaoTabelaUfs` |
  | `UF_TABLE` | `TABELA_UFS` |
  | `isCUf` | `ehCUf` |
  | `isUf` | `ehUf` |
  | `ufByCUf` | `ufPorCUf` |
  | `ufBySigla` | `ufPorSigla` |
  | `C14nOptions` | `C14nOpcoes` |
  | `escapeC14nAttribute` | `escaparAtributoC14n` |
  | `escapeC14nText` | `escaparTextoC14n` |
  | `VerifyExpectation` | `AssinaturaEsperada` |
  | `VerifyFailed` | `ConferenciaInvalida` |
  | `VerifyFailure` | `MotivoFalhaConferencia` |
  | `VerifyResult` | `ResultadoConferencia` |
  | `VerifySuccess` | `ConferenciaValida` |
  | `findSignatures` | `encontrarAssinaturas` |
  | `verifySignature` | `conferirAssinatura` |
  | `XMLDSIG_ALGORITHMS` | `ALGORITMOS_XMLDSIG` |
  | `base64Decode` | `decodificarBase64` |
  | `base64Encode` | `codificarBase64` |
  | `spkiFromCertificate` | `extrairSpki` |
  | `XmlErrorCode` | `CodigoErroXml` |
  | `XmlSignatureFailure` | `MotivoFalhaAssinaturaXml` |
  | `XmlError` | `ErroXml` |
  | `XmlSignatureError` | `ErroAssinaturaXml` |
  | `XmlAttribute` | `AtributoXml` |
  | `XmlDocument` | `DocumentoXml` |
  | `XmlElement` | `ElementoXml` |
  | `XmlNode` | `NoXml` |
  | `XmlProcessingInstruction` | `InstrucaoDeProcessamentoXml` |
  | `XmlText` | `TextoXml` |
  | `attributeOf` | `atributoDe` |
  | `childElements` | `elementosFilhos` |
  | `descendants` | `descendentes` |
  | `firstChild` | `primeiroFilho` |
  | `inScopeNamespaces` | `namespacesEmEscopo` |
  | `parseXml` | `lerXml` |
  | `textOf` | `textoDe` |
  | `PreparedSignature` | `AssinaturaPreparada` |
  | `PrepareOptions` | `PrepararAssinaturaOpcoes` |
  | `assembleSignature` | `montarAssinatura` |
  | `prepareSignature` | `prepararAssinatura` |
  | `SHA1_DIGEST_INFO_PREFIX` | `PREFIXO_DIGEST_INFO_SHA1` |
  | `signedInfoDigestInfo` | `digestInfoDoSignedInfo` |
  | `signPrepared` | `assinarPreparada` |
  | `signXml` | `assinarXml` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `Relogio` | `now` | `agora` |
  | `RelogioManual` | `set` | `ajustar` |
  | `RelogioManual` | `advance` | `avancar` |
  | `ErroSineteOpcoes` | `details` | `detalhes` |
  | `ErroSerializado` | `docs` | `pagina` |
  | `ErroSerializado` | `details` | `detalhes` |
  | `ErroSinete` | `details` | `detalhes` |
  | `ErroSinete` | `docs` | `pagina` |
  | `Ocorrencia` | `path` | `caminho` |
  | `Ocorrencia` | `message` | `mensagem` |
  | `ErroDeValidacao` | `issues` | `ocorrencias` |
  | `EntradaDeLog` | `level` | `nivel` |
  | `EntradaDeLog` | `msg` | `mensagem` |
  | `EntradaDeLog` | `fields` | `campos` |
  | `LoggerEmMemoria` | `entries` | `entradas` |
  | `LoggerEmMemoria` | `clear` | `limpar` |
  | `DicaRejeicao` | `probableCause` | `causaProvavel` |
  | `DicaRejeicao` | `suggestedFix` | `comoCorrigir` |
  | `DicaRejeicao` | `source` | `fonte` |
  | `ResultadoSefaz` | `status` | `tipo` |
  | `Autorizado`, `Denegado` | `value` | `valor` |
  | `Recusado` | `hint` | `dica` |
  | `Pendente` | `ref` | `referencia` |
  | `Pendente` | `retryAfterMs` | `aguardarMs` |
  | `criarPendente` (opções) | `ref` | `referencia` |
  | `criarPendente` (opções) | `retryAfterMs` | `aguardarMs` |
  | `TratadoresDeResultado` | `authorized` | `autorizado` |
  | `TratadoresDeResultado` | `rejected` | `recusado` |
  | `TratadoresDeResultado` | `denied` | `denegado` |
  | `TratadoresDeResultado` | `pending` | `pendente` |
  | `Resultado` | `value` | `valor` |
  | `Resultado` | `error` | `erro` |
  | `ok` (retorno) | `value` | `valor` |
  | `falha` (retorno) | `error` | `erro` |
  | `SignerBase` | `certificateDer` | `certificadoDer` |
  | `ContextoDaAssinatura` | `referenced` | `referenciado` |
  | `AssinadorDeDados`, `AssinadorDeDigest` | `kind` | `tipo` |
  | `AssinadorDeDados` | `sign` | `assinar` |
  | `AssinadorDeDigest` | `signDigestInfo` | `assinarDigestInfo` |
  | `FonteDeDados` | `title` | `titulo` |
  | `FonteDeDados` | `retrievedAt` | `coletadoEm` |
  | `DescricaoTabelaUfs` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoTabelaUfs` | `version` | `versao` |
  | `DescricaoTabelaUfs` | `sources` | `fontes` |
  | `C14nOpcoes` | `exclude` | `excluir` |
  | `AssinaturaEsperada` | `element` | `elemento` |
  | `ConferenciaValida` | `element` | `elemento` |
  | `ConferenciaValida` | `document` | `documento` |
  | `ConferenciaValida` | `certificateDer` | `certificadoDer` |
  | `ConferenciaValida` | `signatureAlgorithm` | `algoritmoDeAssinatura` |
  | `ConferenciaValida` | `digestAlgorithm` | `algoritmoDeDigest` |
  | `ConferenciaInvalida` | `failure` | `motivo` |
  | `ConferenciaInvalida` | `detail` | `detalhe` |
  | `ConferenciaInvalida` | `signedInfoValid` | `signedInfoValido` |
  | `ErroXml` | `offset` | `posicao` |
  | `ErroAssinaturaXml` | `reason` | `motivo` |
  | `AtributoXml`, `ElementoXml` | `name` | `nome` |
  | `AtributoXml`, `ElementoXml` | `prefix` | `prefixo` |
  | `AtributoXml`, `TextoXml` | `value` | `valor` |
  | `NoXml` | `type` | `tipo` |
  | `NoXml` | `start` | `inicio` |
  | `NoXml` | `end` | `fim` |
  | `ElementoXml`, `MutableElement` | `attributes` | `atributos` |
  | `ElementoXml`, `MutableElement` | `children` | `filhos` |
  | `ElementoXml` | `parent` | `pai` |
  | `ElementoXml` | `openEnd` | `fimDaAbertura` |
  | `ElementoXml` | `contentEnd` | `fimDoConteudo` |
  | `ElementoXml` | `selfClosing` | `autoFechado` |
  | `InstrucaoDeProcessamentoXml` | `target` | `alvo` |
  | `InstrucaoDeProcessamentoXml` | `data` | `dados` |
  | `DocumentoXml` | `source` | `texto` |
  | `DocumentoXml` | `root` | `raiz` |
  | `AssinaturaPreparada` | `template` | `modelo` |
  | `AssinaturaPreparada` | `placeholder` | `marcador` |
  | `AssinaturaPreparada` | `insertedAt` | `inseridaEm` |
  | `AssinaturaPreparada` | `referenced` | `referenciado` |
  | `PrepararAssinaturaOpcoes` | `certificateDer` | `certificadoDer` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ResultadoSefaz` | `'authorized'` | `'autorizado'` |
  | `ResultadoSefaz` | `'rejected'` | `'recusado'` |
  | `ResultadoSefaz` | `'denied'` | `'denegado'` |
  | `ResultadoSefaz` | `'pending'` | `'pendente'` |
  | `AssinadorDeDados` | `'data'` | `'dados'` |
  | `TipoAssinador` | `'data'` | `'dados'` |
  | `MotivoFalhaConferencia` | `'parse'` | `'leitura'` |
  | `NoXml` | `'element'` | `'elemento'` |
  | `NoXml` | `'text'` | `'texto'` |
  | `NoXml` | `'pi'` | `'instrucao'` |
  | `MotivoFalhaAssinaturaXml` | `'placeholder-no-documento'` | `'marcador-no-documento'` |
  | `MotivoFalhaAssinaturaXml` | `'placeholder-ausente'` | `'marcador-ausente'` |
  | `ErroSinete` | `'SineteError'` | `'ErroSinete'` |
  | `ErroDeConfiguracao` | `'ConfigError'` | `'ErroDeConfiguracao'` |
  | `ErroDeValidacao` | `'ValidationError'` | `'ErroDeValidacao'` |
  | `ErroNaoSuportado` | `'UnsupportedError'` | `'ErroNaoSuportado'` |
  | `ErroServicoNaoOferecido` | `'ServicoNaoOferecidoError'` | `'ErroServicoNaoOferecido'` |
  | `ErroDeTempoEsgotado` | `'TimeoutError'` | `'ErroDeTempoEsgotado'` |
  | `ErroRespostaInvalida` | `'ProtocolError'` | `'ErroRespostaInvalida'` |
  | `ErroSefaz` | `'SefazError'` | `'ErroSefaz'` |
  | `ErroXml` | `'XmlError'` | `'ErroXml'` |
  | `ErroAssinaturaXml` | `'XmlSignatureError'` | `'ErroAssinaturaXml'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/ufs.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/ufs.json` | `version` | `versao` |
  | `data/ufs.json` | `sources` | `fontes` |
  | `data/ufs.json` | `title` | `titulo` |
  | `data/ufs.json` | `retrievedAt` | `coletadoEm` |
  | `data/ie.json` | `title` | `titulo` |
  | `data/ie.json` | `retrievedAt` | `coletadoEm` |
  | `data/rejeicoes.json` | `title` | `titulo` |
  | `data/rejeicoes.json` | `retrievedAt` | `coletadoEm` |
  | `data/rejeicoes-mdfe.json` | `title` | `titulo` |
  | `data/rejeicoes-mdfe.json` | `retrievedAt` | `coletadoEm` |
  | `data/nfse-erros.json` | `title` | `titulo` |
  | `data/nfse-erros.json` | `retrievedAt` | `coletadoEm` |
  | `data/cstat.json` | `probableCause` | `causaProvavel` |
  | `data/cstat.json` | `suggestedFix` | `comoCorrigir` |
  | `data/cstat.json` | `source` | `fonte` |
  
  Também mudam nesta versão:
  
  - Chaves de `detalhes`: `issues` → `ocorrencias` (`ErroDeValidacao`), `reason` → `motivo` e `offset` → `posicao` (`ErroXml`, `ErroAssinaturaXml`), `instant` → `instante` (relógios), `offsetMinutes` → `deslocamentoMin` (`formatarDataHoraComFuso`), `status` → `tipo` (`ErroSefaz`).
  - A mensagem do `ErroXml` diz `(posição N)`.
  - Parâmetros: `criarAutorizado(resposta, valor)`, `criarRecusado(resposta, dica?)`, `criarDenegado(resposta, valor)`, `criarPendente(resposta, opcoes?)`, `tratarResultado(o, tratadores)`, `ok(valor)`, `falha(erro)`, `eh*(valor)`, `lerXml(texto)`, `relogioManual(inicio)`, `c14n(el, opcoes?)`, `assinarXml(xml, opcoes, assinador)`.
  - `src/data/ufs.json`: `notes` → `notas`.
  - `ProtocolError` virou `ErroRespostaInvalida` (o `code` continua `resposta_invalida`), e `SineteError.docs` virou `ErroSinete.pagina`. Os métodos e níveis do `Logger` (`debug`, `info`, `warn`, `error`, `child`) ficam em inglês (exceção 3 do ADR 0015).

## 0.1.0

### Minor Changes

- 515861a: O `cStat` de um `SefazOutcome` aceita também os códigos de erro da NFS-e Nacional (`E` seguido de 4 dígitos, como `E0312`), além dos 3 ou 4 dígitos da NF-e.
- 515861a: `SineteError` ganha `docs`, o caminho da página do código na documentação embarcada (`erros/<code>.md`, relativo a `node_modules/sinete/docs/`), como propriedade própria e no `toJSON`; `paginaDoErro(code)` monta o caminho.
- 515861a: `DataSigner.sign` recebe um terceiro argumento opcional, `SignContext` (`id` e `referenced`, o elemento referenciado canonicalizado), e `PreparedSignature` ganha `referenced`. Quem assina fora do processo pode conferir o que assina: o `documentSigner` do `@sinete/transport/signer` manda o elemento ao helper, que confere o autor do evento (manifestação do destinatário). Signers existentes, que ignoram o argumento, seguem funcionando.
- 515861a: Novo subpath `@sinete/core/xml` (antes o pacote `@sinete/xml`): parser XML estrito com offsets, C14N 1.0 inclusivo, verificação XMLDSig que exige o Id esperado e devolve falha discriminada, e assinatura em três fases por splice com o Signer do core nos modos data e digest. O core continua sem dependências.
- 515861a: Ocorrências de validação classificadas pela fase em que nasceram (ADR 0011): `ValidationIssue.origem` é `entrada` quando a conferência foi sobre a entrada do domínio (o `path` é da entrada e corrigir o valor ali resolve) e `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD e o PL, chave gerada, grupo IBS/CBS da calculadora, regras da NT). `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem; o campo é opcional no tipo, então quem constrói ocorrências fora do sinete não quebra. A calculadora de IBS/CBS pode marcar a origem das próprias ocorrências; sem marca, entram como `montagem`.
  
  `rotuloDoCaminho(path)` no `@sinete/nfe` e no `@sinete/mdfe` dá o rótulo em português do caminho de uma ocorrência (`Item 2, Descrição do produto`, `Condutor 1, CPF`), para os caminhos da entrada e do documento montado, inclusive os do validador de XSD. O mecanismo fica no `@sinete/core` (`normalizarCaminho`, `criarRotuloDoCaminho`) para os outros documentos.
- 515861a: Novo código `servico_nao_oferecido` (`ServicoNaoOferecidoError`) para o serviço que a tabela oficial de web services não lista para a UF ou o ambiente, como a consulta cadastro de uma UF que a SVRS não atende nesse serviço. Antes esses casos saíam como `config_invalida`, que continua valendo só para defeito de integração. `details` traz `autorizador`, `servico`, `ambiente` e, quando informada, a `uf`.

### Patch Changes

- 515861a: O `verProc` padrão da NF-e e do MDF-e, e o `verAplic` padrão da NFS-e (DPS e pedidos de evento), passam de `sinete` para `sinete <versão do pacote>`, montado pelo novo `formatarVerProc` do `@sinete/core` e cortado com segurança se passar dos 20 caracteres do leiaute. A versão de cada pacote é embutida no build (`src/versao-gerada.ts`, gerado a partir do `package.json` por `scripts/versao-gerada.ts`), nunca lida em runtime. `options.verProc`/`options.verAplic` informado continua prevalecendo, como antes.
