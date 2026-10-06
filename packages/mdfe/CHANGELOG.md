# @sinete/mdfe

## 0.4.0

### Minor Changes

- 2b724ae: MDF-e do modal aéreo. `DadosMdfe` passa a ser a união `DadosMdfeRodoviario | DadosMdfeAereo` (com `CamposMdfe` para os campos comuns): quem passa `rodoviario` continua compilando, mas quem lê `dados.rodoviario` de um `DadosMdfe` precisa estreitar para `DadosMdfeRodoviario`. O grupo `aereo` (nac, matr, nVoo, cAerEmb, cAerDes, dVoo) monta `modal` 2, e o CT-e ganha `entregaParcial` (corte de voo, `infEntregaParcial`). As regras do Anexo I que só valem no rodoviário (percurso F90, seguro F91 a F93, produto predominante F54/F55 e as do veículo) deixam de valer no aéreo; F23 (705) recusa o carregamento posterior fora do rodoviário e F34 (702) a entrega parcial fora do aéreo. Entrada sem modal ou com dois vira ocorrência (`campo_obrigatorio` em `rodoviario`, `combinacao_invalida` em `aereo`), não exceção. `rotuloDoCaminho` ganha os rótulos do aéreo, e `infMDFe.infModal` sozinho passa de "Transporte rodoviário" para "Modal".
  
  No `@sinete/sefaz-sim`, a recepção do MDF-e aplica F23 (705) e F34 (702).
- 61b48f6: MDF-e do modal aquaviário, o último dos quatro. `DadosMdfe` ganha o caso `DadosMdfeAquaviario`, com o grupo `aquaviario` (irin, tpEmb, cEmbar, xEmbar, nViag, cPrtEmb, cPrtDest, prtTrans, tpNav, `terminaisCarregamento` e `terminaisDescarregamento` até 5, `comboio` até 30, `unidadesCargaVazias`, `unidadesTransporteVazias` e o `MMSI` opcional da NT 2025.001), que monta `modal` 3. Como nos outros modais, as regras do rodoviário não se aplicam, F23 (705) e F34 (702) seguem o modal. Lista acima do limite do leiaute é `campo_invalido` no grupo. O MDF-e transportado (`infMDFeTransp`, F43 a F49) fica para a #57. `rotuloDoCaminho` ganha os rótulos de terminais, comboio e unidades vazias.
  
  No `@sinete/sefaz-sim`, a recepção do MDF-e aplica F43 (647) e F44 (648) ao MDF-e transportado (`infMDFeTransp`).
- ae8028e: MDF-e do modal ferroviário. `DadosMdfe` ganha o caso `DadosMdfeFerroviario`, com o grupo `ferroviario` (`trem` com xPref, dhTrem, xOri e xDest; `vagoes` com pesoBC, pesoR, tpVag, serie, nVag, nSeq e TU), que monta `modal` 4; `qVag` sai da contagem dos vagões e os pesos saem com três casas. Como no aéreo, as regras do Anexo I que só valem no rodoviário não se aplicam, F23 (705) recusa o carregamento posterior e F34 (702) a entrega parcial do CT-e. Lista de vagões vazia é `campo_obrigatorio` em `ferroviario.vagoes`. `rotuloDoCaminho` ganha os rótulos do trem e dos vagões (`Vagão 2, Número do vagão`).
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

- 23c1c08: `resolverEnvioSemResposta(cliente, mdfeAssinado, anterior?, opcoes?)` e `recuperarEventoRegistrado(cliente, chave, tpEvento, opcoes?)` aceitam `opcoes?: EnvioOpcoes` no fim e repassam o `signal` à consulta, como os métodos do `ClienteMdfe`. Compatível.
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
