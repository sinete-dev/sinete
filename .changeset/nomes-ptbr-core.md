---
'@sinete/core': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 1). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

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
