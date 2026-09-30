# @sinete/schemas

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
