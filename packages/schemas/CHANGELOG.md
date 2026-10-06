# @sinete/schemas

## 0.3.0

### Minor Changes

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

- cc09d66: Contribuinte exclusivo do IBS/CBS (NT 2026.007 v1.10). O `montarNfe` confere antes de assinar a nota sem IE do emitente: NFC-e até o fim de 2032 (rejeição 156), emitente sem CNPJ (157), IEST informada (158), ICMS no item fora da devolução e do `tpNFCredito` 03 (161) e item sem o grupo IBS/CBS (162); a falta de ICMS e ISSQN deixa de ser ocorrência nessa nota. O catálogo do `@sinete/rejeicoes` ganha as 30 rejeições novas da NT (156 a 188), e a `vigencia.json` do `@sinete/schemas` passa a citar a v1.10.

## 0.2.1

### Patch Changes

- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/core@0.3.0

## 0.2.0

### Minor Changes

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
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar. Só o runtime muda: os tipos gerados dos XSD ficam com os nomes do schema.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `DecodeIssue` | `OcorrenciaDecodificacao` |
  | `DecodeIssueCode` | `CodigoOcorrenciaDecodificacao` |
  | `Decoded` | `Decodificado` |
  | `decode` | `decodificar` |
  | `decodeRoot` | `decodificarRaiz` |
  | `decodeXml` | `decodificarXml` |
  | `RootElement` | `ElementoRaiz` |
  | `SchemaModuleInfo` | `DescricaoModuloSchema` |
  | `SchemaPatch` | `AjusteDoSchema` |
  | `SchemaSource` | `FonteDoSchema` |
  | `ValueOf` | `ValorDe` |
  | `isComplexType` | `ehComplexType` |
  | `isElementParticle` | `ehElementParticle` |
  | `isWildcard` | `ehWildcard` |
  | `SchemaIssue` | `OcorrenciaSchema` |
  | `ValidationCode` | `CodigoValidacao` |
  | `assertValid` | `exigirValido` |
  | `checkSimple` | `conferirTipoSimples` |
  | `compareCalendar` | `compararCalendario` |
  | `compareDecimal` | `compararDecimal` |
  | `validate` | `validar` |
  | `validateRoot` | `validarRaiz` |
  | `serialize` | `serializar` |
  | `serializeRoot` | `serializarRaiz` |
  | `XsdRegexError` | `ErroRegexXsd` |
  | `compileXsdRegex` | `compilarRegexXsd` |
  | `xsdRegexToJs` | `regexXsdParaJs` |
  | `SchemasErrorCode` | `CodigoErroSchemas` |
  | `SerializeError` | `ErroSerializacao` |
  | `VigenciaError` | `ErroVigencia` |
  | `VigenciaEntry` | `EntradaDeVigencia` |
  | `Instant` | `Instante` |
  | `cmpInstant` | `compararInstantes` |
  | `validateElement` | `validarElemento` |
  | `decodeCT` | `decodificarComplexType` |
  | `decodeSimple` | `decodificarSimpleType` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ErroSerializacao` | `constructor.path` | `constructor.caminho` |
  | `ErroSerializacao`, `ErroVigencia` | `constructor.options` | `constructor.opcoes` |
  | `ErroRegexXsd` | `constructor.pattern` | `constructor.padrao` |
  | `decodificarXml`, `decodificarRaiz`, `serializarRaiz`, `exigirValido`, `validarRaiz` | `root` | `raiz` |
  | `ErroSerializacao`, `conferirTipoSimples` | `path` | `caminho` |
  | `Decodificado`, `serializar`, `serializarRaiz` | `value` | `valor` |
  | `Decodificado` | `issues` | `ocorrencias` |
  | `decodificar` | `source` | `texto` |
  | `decodificarRaiz` | `doc` | `documento` |
  | `ElementoRaiz`, `serializar` | `name` | `nome` |
  | `ElementoRaiz` | `type` | `tipo` |
  | `compilarRegexXsd`, `regexXsdParaJs` | `src` | `padrao` |
  | `serializar` | `inheritedNs` | `nsHerdado` |
  | `conferirTipoSimples` | `raw` | `bruto` |
  | `conferirTipoSimples` | `out` | `saida` |
  | `DescricaoModuloSchema` | `patches` | `ajustes` |
  Também mudam nesta versão:
  
  - Chaves de `detalhes`: `path` → `caminho` (`ErroSerializacao`), `pattern` → `padrao` (`ErroRegexXsd`).
  - Os módulos gerados descrevem cada raiz como `{ nome, ns, tipo }` e o módulo como `DescricaoModuloSchema`.

### Patch Changes

- d824983: `XsdRegexError` passa a estender `ErroNaoSuportado` (`code: 'nao_suportado'`, com o `pattern` em `detalhes`), como todo erro lançado pelo sinete. Antes estendia `Error` direto e escapava de `ehErroSinete`.
- Updated dependencies [ae8ab90]
  - @sinete/core@0.2.0

## 0.1.0

### Minor Changes

- 515861a: Novo módulo `nfe/evento-cancelamento-substituicao/PL_010d`: o evento 110112 (cancelamento por substituição da NFC-e) com o `detEvento` do e110112_v1.00.xsd oficial (Evento_CancSubst_v1.01, NT 2018.004) ligado ao envelope genérico do PL_010d, e a família `nfe/evento-cancelamento-substituicao` na tabela de vigências.
- 515861a: Primeira versão: módulos gerados dos XSD oficiais (NF-e PL_010f e PL_010e, MDF-e 3.00b, eventos, inutilização, consultas, status do serviço e distribuição de DF-e) com serializer canônico, decoder tolerante, validador estrito e tabela de vigências que escolhe o PL por data e ambiente.
- 515861a: MDF-e 3.00b: `retMDFe` (retorno da recepção síncrona) no `mdfe/3.00b` e dois módulos novos do mesmo pacote de liberação, `mdfe/eventos/3.00b` (`eventoMDFe`, `retEventoMDFe` e `procEventoMDFe`, com o `detEvento` ligado aos sete schemas de evento) e `mdfe/servicos/3.00b` (status, consulta situação e consulta não encerrados), com vigência na tabela.
- 515861a: Novos módulos `nfse/1.01-20260209` e `nfse/1.01-20260727`, gerados dos XSD oficiais da NFS-e Nacional (DPS, NFSe, pedRegEvento e evento) com sha256 conferido, e a família `nfse` na tabela de vigências.
  
  - **Correção do TSSerieDPS.** O XSD de 09/02/2026 declara `^0{0,4}\d{1,5}$`, e em regex de XSD `^` e `$` são literais. A correção vem registrada em `schema.patches`, com o pattern oficial, o usado e o motivo (tipo `SchemaPatch`).
  - **Assinatura.** A `ds:Signature` é opaca (`$any`).
  - **Classes de caracteres.** O tradutor de regex de XSD passa a aceitar `\S` e `\D` dentro de classe de caracteres positiva.

### Patch Changes

- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/core@0.1.0
