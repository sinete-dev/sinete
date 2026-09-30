---
'@sinete/schemas': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar. Só o runtime muda: os tipos gerados dos XSD ficam com os nomes do schema.

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
