# Referência: `@sinete/schemas`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/schemas/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/schemas/x` é `sinete/schemas/x`.

## `@sinete/schemas`

`@sinete/schemas`: runtime genérico dos módulos gerados dos XSD oficiais (ADR 0002).

Os módulos de cada documento e pacote de liberação ficam em subpaths (`@sinete/schemas/nfe/PL_010f`, `@sinete/schemas/mdfe/3.00b`, `@sinete/schemas/nfe/evento-cancelamento/PL_010d`...) e exportam, com o mesmo identificador, o tipo TS e o descritor de cada tipo complexo, mais os elementos raiz (`nfeProcElement`). Este ponto de entrada traz o que percorre os descritores: serializer canônico, decoder tolerante, validador estrito e a tabela de vigências.

### Funções

- `assertValid`: Como `validateRoot`, mas lança `ValidationError` (`validacao_falhou`) com todas as ocorrências. `assertValid<T>(root: RootElement<T>, xml: string | XmlDocument): void`
- `checkSimple`: Confere um valor simples contra o tipo. Empilha as ocorrências em `out`. `checkSimple(t: SimpleType, raw: string, path: string, out: SchemaIssue[]): void`
- `compareCalendar`: Ordem parcial do XSD: com fuso nos dois (ou em nenhum) a comparação é direta; com fuso em só um, o outro vale por qualquer fuso de -14:00 a +14:00, e se o resultado muda nesse intervalo a comparação é indeterminada (`NaN`). `compareCalendar(b: string, x: string, y: string): number`
- `compareDecimal`: Compara dois decimais lexicais válidos sem passar por `number` (sem perda de precisão). `compareDecimal(a: string, b: string): number`
- `compileXsdRegex`: Compila um pattern do XSD. `compileXsdRegex(src: string): RegExp`
- `decode`: Decodifica o elemento `el` como o tipo `ct`. Nunca lança por causa do conteúdo. `decode<T>(ct: ComplexType<T>, el: XmlElement, source?: string): Decoded<T>`
- `decodeRoot`: Decodifica um documento parseado pela raiz esperada. Raiz com outro nome ou namespace vira ocorrência. `decodeRoot<T>(root: RootElement<T>, doc: XmlDocument): Decoded<T>`
- `decodeXml`: Parse estrito (`@sinete/core/xml`) seguido do decode tolerante pela raiz. Lança `XmlError` só se o XML for malformado. `decodeXml<T>(root: RootElement<T>, xml: string | XmlDocument): Decoded<T>`
- `isComplexType`: `isComplexType(t: ComplexType | SimpleType): t is ComplexType`
- `isElementParticle`: `isElementParticle(p: Particle): p is ElementParticle`
- `isWildcard`: `isWildcard(p: Particle): p is WildcardParticle`
- `maxOccurs`: `maxOccurs(p: Particle): number`
- `minOccurs`: `minOccurs(p: Particle): number`
- `selecionarPl`: O módulo vigente para a família no instante do relógio e no ambiente dados: a entrada de início mais recente que não passa da data. `selecionarPl(familia: FamiliaSchema, ambiente: Ambiente, relogio: Clock): VigenciaEntry`
- `serialize`: Serializa `value` como o elemento `name` do tipo `ct`. `inheritedNs` é o namespace default já em escopo onde a string vai ser inserida (vazio para documento novo, que então recebe `xmlns`). `serialize<T>(ct: ComplexType<T>, name: string, value: T, inheritedNs?: string): string`
- `serializeRoot`: Serializa um documento a partir do elemento raiz, com o `xmlns` do namespace dele. `serializeRoot<T>(root: RootElement<T>, value: T): string`
- `validate`: Valida o elemento `el` como o tipo `ct`. Lista vazia = válido. `validate(ct: ComplexType, el: XmlElement): SchemaIssue[]`
- `validateRoot`: Valida um documento (string ou já parseado) pela raiz esperada. Lança `XmlError` se o XML for malformado. `validateRoot<T>(root: RootElement<T>, xml: string | XmlDocument): SchemaIssue[]`
- `xsdRegexToJs`: `xsdRegexToJs(src: string): string`

### Classes

- `SerializeError` (estende `SineteError<'serializacao_invalida'>`): O objeto não tem a forma do tipo gerado (campo simples que não é string, grupo repetido desalinhado). Membros: `path`.
- `VigenciaError` (estende `SineteError<'pl_sem_vigencia'>`): Nenhum pacote de liberação da tabela de vigências cobre a data e o ambiente pedidos.
- `XsdRegexError` (estende `Error`): Tradução de expressão regular do XSD (XML Schema Part 2, apêndice F) para RegExp do JavaScript com flag `u`.

### Interfaces

- `AttributeDecl`: Membros: `a`, `t`, `r`, `f`.
- `ComplexType`: Tipo complexo. `T` é um parâmetro fantasma que carrega o tipo TS gerado. Membros: `id`, `ns`, `a`, `c`, `tx`, `aa`, `__t`.
- `Decoded`: Membros: `value`, `issues`.
- `DecodeIssue` (estende `ValidationIssue`): Membros: `code`.
- `ElementParticle`: Partícula elemento. Membros: `e`, `t`, `n`, `x`, `ns`, `u`.
- `GroupParticle`: Grupo `sequence` (`s`) ou `choice` (`c`). Membros: `g`, `i`, `n`, `x`.
- `RootElement`: Elemento global que pode ser raiz de um documento. Membros: `name`, `ns`, `type`.
- `SchemaIssue` (estende `ValidationIssue`): Membros: `code`.
- `SchemaModuleInfo`: Membros: `subpath`, `documento`, `pl`, `fontes`, `patches`.
- `SchemaPatch`: Correção de um pattern do XSD oficial que nenhum validador conforme aceita (o arquivo oficial não muda). Membros: `tipo`, `de`, `para`, `motivo`.
- `SchemaSource`: Proveniência de um módulo gerado: de qual pacote oficial saiu cada schema. Membros: `pacote`, `arquivo`, `sha256`, `url`.
- `SimpleType`: Tipo simples: base embutida do XSD mais as facetas acumuladas na cadeia de derivação. Membros: `b`, `p`, `e`, `l`, `mn`, `mx`, `td`, `fd`, `mi`, `ma`, `me`, `mxe`, `ws`, `nm`.
- `VigenciaEntry`: Membros: `modulo`, `pl`, `homologacao`, `producao`, `fonte`.
- `WildcardParticle`: `xs:any processContents="skip"` de qualquer namespace. O conteúdo fica como XML bruto em `$any`. Membros: `w`, `n`, `x`.

### Tipos

- `DecodeIssueCode`: Códigos das ocorrências do decoder. `type DecodeIssueCode = 'elemento_desconhecido' | 'atributo_desconhecido' | 'whitespace_descartado' | 'texto_inesperado' | 'elemento_em_tipo_simples' | 'namespace_divergente' | 'raiz_inesperada'`
- `FamiliaSchema`: Família de documento na tabela de vigências (um teste confere que bate com as chaves do JSON).
- `Particle`: `type Particle = ElementParticle | GroupParticle | WildcardParticle`
- `SchemasErrorCode`: Códigos lançados por este pacote. `type SchemasErrorCode = 'serializacao_invalida' | 'pl_sem_vigencia'`
- `ValidationCode`: Códigos das ocorrências do validador.
- `ValueOf`: Valor tipado de um `ComplexType`. `type ValueOf<C> = C extends ComplexType<infer T> ? T : never`

### Constantes

- `VIGENCIAS`: A tabela inteira, como dado. `VIGENCIAS: Readonly<Record<FamiliaSchema, readonly VigenciaEntry[]>>`
- `VIGENCIAS_ATUALIZADAS_EM`: Data de atualização da tabela. `VIGENCIAS_ATUALIZADAS_EM: string`

## `@sinete/schemas/nfe/PL_010f`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/PL_010f.d.ts`.

## `@sinete/schemas/nfe/PL_010e`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/PL_010e.d.ts`.

## `@sinete/schemas/mdfe/3.00b`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/mdfe/3.00b.d.ts`.

## `@sinete/schemas/mdfe/eventos/3.00b`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/mdfe/eventos/3.00b.d.ts`.

## `@sinete/schemas/mdfe/servicos/3.00b`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/mdfe/servicos/3.00b.d.ts`.

## `@sinete/schemas/nfe/evento-cancelamento/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/evento-cancelamento/PL_010d.d.ts`.

## `@sinete/schemas/nfe/evento-cce/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/evento-cce/PL_010d.d.ts`.

## `@sinete/schemas/nfe/evento-cancelamento-substituicao/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/evento-cancelamento-substituicao/PL_010d.d.ts`.

## `@sinete/schemas/nfe/evento-confirmacao-operacao/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/evento-confirmacao-operacao/PL_010d.d.ts`.

## `@sinete/schemas/nfe/evento-ciencia-operacao/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/evento-ciencia-operacao/PL_010d.d.ts`.

## `@sinete/schemas/nfe/evento-desconhecimento-operacao/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/evento-desconhecimento-operacao/PL_010d.d.ts`.

## `@sinete/schemas/nfe/evento-operacao-nao-realizada/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/evento-operacao-nao-realizada/PL_010d.d.ts`.

## `@sinete/schemas/nfe/inutilizacao/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/inutilizacao/PL_010d.d.ts`.

## `@sinete/schemas/nfe/consulta-protocolo/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/consulta-protocolo/PL_010d.d.ts`.

## `@sinete/schemas/nfe/consulta-cadastro/PL_010d`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/consulta-cadastro/PL_010d.d.ts`.

## `@sinete/schemas/nfe/status-servico/PL_009q`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/status-servico/PL_009q.d.ts`.

## `@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfe/dist-dfe/PL_NFeDistDFe_104.d.ts`.

## `@sinete/schemas/nfse/1.01-20260209`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfse/1.01-20260209.d.ts`.

## `@sinete/schemas/nfse/1.01-20260727`

Código gerado do XSD oficial: um tipo e um descritor por tipo complexo, com o nome do schema, os elementos raiz e `schema` com a proveniência. Os tipos estão em `node_modules/@sinete/schemas/dist/nfse/1.01-20260727.d.ts`.
