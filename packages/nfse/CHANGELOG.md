# @sinete/nfse

## 0.4.0

### Minor Changes

- c3cbf86: `recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento = 1, opcoes?)` na NFS-e, como na NF-e e no MDF-e: depois de um pedido de evento sem resposta, ou recusado com E0840, consulta o evento na Sefin e devolve `{ registrado: true, evento }` ou `{ registrado: false }`, sem concluir pelo código do pedido (a E0840 também sai com a substituição vinculada). Falha de rede, resposta fora do contrato e `signal` cancelado lançam, como no `consultarEventos`. A sequência é parâmetro com padrão 1 porque a Sefin só atende a consulta com o tipo e a sequência, e o cancelamento é sempre a 1. Quem usava o `ClienteNfse` sem o emissor não tinha como recuperar um cancelamento cujo retorno se perdeu. O `@sinete/emissor` passa a usar a primitiva no cancelamento da NFS-e, com o mesmo desfecho de antes.
- dd913dd: `rotuloDoCaminho(caminho)` na NFS-e, como o da NF-e e o do MDF-e (ADR 0011): o caminho de uma ocorrência da DPS vira texto para quem preencheu a nota (`tomador.CNPJ` vira `Tomador, CNPJ`; `/DPS/infDPS/valores/vDedRed/documentos/docDedRed[2]/vDedutivelRedutivel` vira `Documento de dedução 2, Valor dedutível ou redutível`), com `Dados da DPS` quando nem o grupo nem o campo são conhecidos. Aceita os caminhos da `DadosDps`, os do documento montado com pontos e os do validador de XSD, que na DPS incluem a raiz `DPS`.
- dec66f5: Texto e tamanho conferidos na entrada do MDF-e e da DPS, como na NF-e (ADR 0011, revisão de 06/10). É quebra do `caminho`, da `origem` e do `code` dessas ocorrências:
  
  | Caso | Antes | Depois |
  |---|---|---|
  | MDF-e, texto fora do tipo do leiaute (longo, curto, espaço nas pontas, caractere fora do `TString`) | `schema`, `origem: 'montagem'`, caminho do XSD (`/infMDFe/emit/xNome`), mensagem do validador | `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`emitente.xNome`), mensagem para quem preenche (`no máximo 60 caracteres (tem 61)`) |
  | MDF-e, caractere que o XML não representa | `campo_invalido`, `origem: 'montagem'`, caminho do documento montado (`infMDFe.prodPred.xProd`) | `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`produtoPredominante.xProd`), em qualquer texto da entrada, inclusive os que a montagem transforma (`emitente.endereco.CEP`) |
  | DPS, texto fora do tipo do leiaute | `schema`, `origem: 'montagem'`, caminho do XSD (`/DPS/infDPS/subst/xMotivo`) | `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`substituicao.xMotivo`), também dentro de prestador, tomador, intermediário e dos grupos do serviço (`tomador.end.xLgr`) |
  | DPS, caractere que o XML não representa | `caractere_invalido`, `origem: 'montagem'`, caminho `/` (o documento inteiro) | `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`ibsCbs.refNFSe[1]`) |
  
  O texto das opções do montador (o `respTec` das opções e o `verProc` do MDF-e, o `verAplic` da DPS) continua conferido na montagem, como antes, e os campos que a montagem transforma (telefone, CEP e placa no MDF-e; série e código de tributação nacional na DPS) seguem aceitos como antes.
  
  `@sinete/schemas` exporta o motor da conferência (`conferirTextos`, `CampoDeTexto`, `TextoRecusado`, `textoXmlValido` e `camposSemElemento`), que saiu do `@sinete/nfe`. Na NF-e, o comportamento é o mesmo; a única diferença é a mensagem de um tipo de formato (só dígitos, um código), que passa a ser `formato não aceito` em vez de apontar um caractere. `rotuloDoCaminho` do MDF-e e da NFS-e ganhou os campos novos (`Responsável técnico, Contato`, `Informações adicionais, Informações de interesse do fisco`, `IBS/CBS, NFS-e referenciada`).

### Patch Changes

- Updated dependencies [adb6148]
- Updated dependencies [cc09d66]
- Updated dependencies [e6c8f28]
- Updated dependencies [eb06ce6]
- Updated dependencies [dec66f5]
- Updated dependencies [30d6381]
  - @sinete/validators@0.3.0
  - @sinete/rejeicoes@0.4.0
  - @sinete/schemas@0.3.0
  - @sinete/transport@0.3.0

## 0.3.0

### Minor Changes

- 23c1c08: **Quebra: `resolverEnvioSemResposta` devolve `indefinida` em vez de lançar.** `ResolucaoEnvio` ganha o caso `{ acao: 'indefinida', motivo, chaveAcesso? }`, como o resolvedor da NF-e e do MDF-e: a consulta respondeu sem decidir. Sai quando a DPS consta como processada e a NFS-e da chave não é encontrada (antes, `ErroRespostaInvalida` "a NFS-e não foi encontrada"), quando a NFS-e da chave é de outra DPS (antes, `ErroRespostaInvalida` "não corresponde à DPS"), e quando o envio voltou E0014 e a consulta não acha a DPS (antes, `reenviar`, que voltaria E0014 de novo). Um `switch` sobre `acao` precisa do caso novo (ou de um `default`, ADR 0016). Erros do transporte e respostas fora do contrato da própria consulta continuam lançando.
  
  A assinatura passa a ser `resolverEnvioSemResposta(cliente, dpsAssinada, anterior?, opcoes?)`: `anterior` é o desfecho do envio (`ResultadoNfse<NfseGerada>`), usado para reconhecer a E0014, e `opcoes.signal` vai às consultas. Chamadas com dois argumentos continuam valendo.
  
  **`ClienteNfse.opcoes`** (aditivo): as opções da criação, com o mesmo formato de `ClienteNfe.opcoes` e `ClienteMdfe.opcoes`. `ambiente` e `parametros` continuam.
- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.

### Patch Changes

- Updated dependencies [395f19c]
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/rejeicoes@0.3.0
  - @sinete/core@0.3.0
  - @sinete/schemas@0.2.1
  - @sinete/transport@0.2.1
  - @sinete/validators@0.2.1

## 0.2.0

### Minor Changes

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
  
  - `montarDps` passa a ser assíncrona e devolve `Promise<ResultadoMontagemDps>`, como a `montarNfe` e a `montarMdfe` (ADR 0009, emenda de 30/set/2026). O `ErroDeConfiguracao` de um `verAplic` inválido vira rejeição da `Promise`.
  - `ttl` é traduzido: `validadeMs`, `validadeNaoEncontradoMs` e `validadeParametrosMs`.
  - `detalhes` do `ErroRespostaInvalida` de uma rejeição fora do formato do Anexo I: `httpStatus` → `statusHttp`.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `BuildDpsOptions` | `MontarDpsOpcoes` |
  | `BuildDpsResult` | `ResultadoMontagemDps` |
  | `buildDps` | `montarDps` |
  | `signDps` | `assinarDps` |
  | `NfseClient` | `ClienteNfse` |
  | `NfseClientOptions` | `ClienteNfseOpcoes` |
  | `OpcoesEnvio` | `EnvioOpcoes` |
  | `createNfseClient` | `criarClienteNfse` |
  | `parseChaveNfse` | `lerChaveNfse` |
  | `PedidoEventoOptions` | `PedidoEventoOpcoes` |
  | `PedidoEventoResult` | `ResultadoPedidoEvento` |
  | `buildPedidoAnaliseFiscal` | `montarPedidoAnaliseFiscal` |
  | `buildPedidoCancelamento` | `montarPedidoCancelamento` |
  | `signPedidoEvento` | `assinarPedidoEvento` |
  | `gunzipBase64` | `descomprimirGzipBase64` |
  | `gzipBase64` | `comprimirGzipBase64` |
  | `DpsInput` | `DadosDps` |
  | `ParametrosOptions` | `ParametrosOpcoes` |
  | `createParametrosMunicipais` | `criarParametrosMunicipais` |
  | `NfseMensagem` | `MensagemNfse` |
  | `NfseOutcome` | `ResultadoNfse` |
  | `NfseRejeicao` | `RejeicaoNfse` |
  | `formatValor` | `formatarValor` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `MontarDpsOpcoes` | `time` | `tempo` |
  | `MontarDpsOpcoes`, `PedidoEventoOpcoes` | `offsetMinutes` | `deslocamentoMin` |
  | `ResultadoMontagemDps`, `ResultadoPedidoEvento` | `value` | `valor` |
  | `ResultadoMontagemDps`, `ResultadoPedidoEvento`, `formatarValor` | `issues` | `ocorrencias` |
  | `montarDps` | `input` | `entrada` |
  | `montarDps`, `montarPedidoAnaliseFiscal`, `montarPedidoCancelamento` | `options` | `opcoes` |
  | `assinarDps`, `ClienteNfseOpcoes`, `assinarPedidoEvento` | `signer` | `assinador` |
  | `ClienteNfseOpcoes`, `ParametrosOpcoes` | `transport` | `transporte` |
  | `ClienteNfseOpcoes`, `PedidoEventoOpcoes`, `ParametrosOpcoes` | `clock` | `relogio` |
  | `ResolucaoEnvio` | `outcome` | `resultado` |
  | `criarClienteNfse` | `options` | `opcoesDoCliente` |
  | `resolverEnvioSemResposta` | `client` | `cliente` |
  | `inscricaoId` | `doc` | `documento` |
  | `comprimirGzipBase64` | `text` | `texto` |
  | `CacheParametros` | `get` | `obter` |
  | `CacheParametros` | `set` | `gravar` |
  | `CacheParametros` | `clear` | `limpar` |
  | `ParametrosOpcoes` | `ttlMs` | `validadeMs` |
  | `ParametrosOpcoes` | `ttlNaoEncontradoMs` | `validadeNaoEncontradoMs` |
  | `RejeicaoNfse` | `httpStatus` | `statusHttp` |
  | `formatarValor` | `path` | `caminho` |
  | `ClienteNfseOpcoes` | `ttlParametrosMs` | `validadeParametrosMs` |

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
