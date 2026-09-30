# Referência: `@sinete/schemas`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/schemas/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/schemas/x` é `sinete/schemas/x`.

## `@sinete/schemas`

`@sinete/schemas`: runtime genérico dos módulos gerados dos XSD oficiais (ADR 0002).

Os módulos de cada documento e pacote de liberação ficam em subpaths (`@sinete/schemas/nfe/PL_010f`, `@sinete/schemas/mdfe/3.00b`, `@sinete/schemas/nfe/evento-cancelamento/PL_010d`...) e exportam, com o mesmo identificador, o tipo TS e o descritor de cada tipo complexo, mais os elementos raiz (`nfeProcElement`). Este ponto de entrada traz o que percorre os descritores: serializer canônico, decoder tolerante, validador estrito e a tabela de vigências.

### Funções

- `compararCalendario`: Ordem parcial do XSD: com fuso nos dois (ou em nenhum) a comparação é direta; com fuso em só um, o outro vale por qualquer fuso de -14:00 a +14:00, e se o resultado muda nesse intervalo a comparação é indeterminada (`NaN`). `compararCalendario(b: string, x: string, y: string): number`
- `compararDecimal`: Compara dois decimais lexicais válidos sem passar por `number` (sem perda de precisão). `compararDecimal(a: string, b: string): number`
- `compilarRegexXsd`: Compila um pattern do XSD. `compilarRegexXsd(padrao: string): RegExp`
- `conferirTipoSimples`: Confere um valor simples contra o tipo. Empilha as ocorrências em `saida`. `conferirTipoSimples(t: SimpleType, bruto: string, caminho: string, saida: OcorrenciaSchema[]): void`
- `decodificar`: Decodifica o elemento `el` como o tipo `ct`. Nunca lança por causa do conteúdo. `decodificar<T>(ct: ComplexType<T>, el: ElementoXml, texto?: string): Decodificado<T>`
- `decodificarRaiz`: Decodifica um documento parseado pela raiz esperada. Raiz com outro nome ou namespace vira ocorrência. `decodificarRaiz<T>(raiz: ElementoRaiz<T>, documento: DocumentoXml): Decodificado<T>`
- `decodificarXml`: Parse estrito (`@sinete/core/xml`) seguido da decodificação tolerante pela raiz. Lança `ErroXml` só se o XML for malformado. `decodificarXml<T>(raiz: ElementoRaiz<T>, xml: string | DocumentoXml): Decodificado<T>`
- `ehComplexType`: `ehComplexType(t: ComplexType | SimpleType): t is ComplexType`
- `ehElementParticle`: `ehElementParticle(p: Particle): p is ElementParticle`
- `ehWildcard`: `ehWildcard(p: Particle): p is WildcardParticle`
- `exigirValido`: Como `validarRaiz`, mas lança `ErroDeValidacao` (`validacao_falhou`) com todas as ocorrências. `exigirValido<T>(raiz: ElementoRaiz<T>, xml: string | DocumentoXml): void`
- `maxOccurs`: `maxOccurs(p: Particle): number`
- `minOccurs`: `minOccurs(p: Particle): number`
- `regexXsdParaJs`: `regexXsdParaJs(padrao: string): string`
- `selecionarPl`: O módulo vigente para a família no instante do relógio e no ambiente dados: a entrada de início mais recente que não passa da data. `selecionarPl(familia: FamiliaSchema, ambiente: Ambiente, relogio: Relogio): EntradaDeVigencia`
- `serializar`: Serializa `valor` como o elemento `nome` do tipo `ct`. `nsHerdado` é o namespace default já em escopo onde a string vai ser inserida (vazio para documento novo, que então recebe `xmlns`). `serializar<T>(ct: ComplexType<T>, nome: string, valor: T, nsHerdado?: string): string`
- `serializarRaiz`: Serializa um documento a partir do elemento raiz, com o `xmlns` do namespace dele. `serializarRaiz<T>(raiz: ElementoRaiz<T>, valor: T): string`
- `validar`: Valida o elemento `el` como o tipo `ct`. Lista vazia = válido. `validar(ct: ComplexType, el: ElementoXml): OcorrenciaSchema[]`
- `validarRaiz`: Valida um documento (string ou já parseado) pela raiz esperada. Lança `ErroXml` se o XML for malformado. `validarRaiz<T>(raiz: ElementoRaiz<T>, xml: string | DocumentoXml): OcorrenciaSchema[]`

### Classes

- `ErroRegexXsd` (estende `ErroNaoSuportado`): Construção de regex do XSD que o tradutor não implementa: `nao_suportado`, com o `padrao` em `detalhes`.
- `ErroSerializacao` (estende `ErroSinete<'serializacao_invalida'>`): O objeto não tem a forma do tipo gerado (campo simples que não é string, grupo repetido desalinhado). Membros: `caminho`.
- `ErroVigencia` (estende `ErroSinete<'pl_sem_vigencia'>`): Nenhum pacote de liberação da tabela de vigências cobre a data e o ambiente pedidos.

### Interfaces

- `AjusteDoSchema`: Correção de um pattern do XSD oficial que nenhum validador conforme aceita (o arquivo oficial não muda). Membros: `tipo`, `de`, `para`, `motivo`.
- `AttributeDecl`: Membros: `a`, `t`, `r`, `f`.
- `ComplexType`: Tipo complexo. `T` é um parâmetro fantasma que carrega o tipo TS gerado. Membros: `id`, `ns`, `a`, `c`, `tx`, `aa`, `__t`.
- `Decodificado`: Membros: `valor`, `ocorrencias`.
- `DescricaoModuloSchema`: Membros: `subpath`, `documento`, `pl`, `fontes`, `ajustes`.
- `ElementoRaiz`: Elemento global que pode ser raiz de um documento. Membros: `nome`, `ns`, `tipo`.
- `ElementParticle`: Partícula elemento. Membros: `e`, `t`, `n`, `x`, `ns`, `u`.
- `EntradaDeVigencia`: Membros: `modulo`, `pl`, `homologacao`, `producao`, `fonte`.
- `FonteDoSchema`: Proveniência de um módulo gerado: de qual pacote oficial saiu cada schema. Membros: `pacote`, `arquivo`, `sha256`, `url`.
- `GroupParticle`: Grupo `sequence` (`s`) ou `choice` (`c`). Membros: `g`, `i`, `n`, `x`.
- `OcorrenciaDecodificacao` (estende `Ocorrencia`): Membros: `code`.
- `OcorrenciaSchema` (estende `Ocorrencia`): Membros: `code`.
- `SimpleType`: Tipo simples: base embutida do XSD mais as facetas acumuladas na cadeia de derivação. Membros: `b`, `p`, `e`, `l`, `mn`, `mx`, `td`, `fd`, `mi`, `ma`, `me`, `mxe`, `ws`, `nm`.
- `WildcardParticle`: `xs:any processContents="skip"` de qualquer namespace. O conteúdo fica como XML bruto em `$any`. Membros: `w`, `n`, `x`.

### Tipos

- `CodigoErroSchemas`: Códigos lançados por este pacote. `type CodigoErroSchemas = 'serializacao_invalida' | 'pl_sem_vigencia'`
- `CodigoOcorrenciaDecodificacao`: Códigos das ocorrências do decoder. `type CodigoOcorrenciaDecodificacao = 'elemento_desconhecido' | 'atributo_desconhecido' | 'whitespace_descartado' | 'texto_inesperado' | 'elemento_em_tipo_simples' | 'namespace_divergente' | 'raiz_inesperada'`
- `CodigoValidacao`: Códigos das ocorrências do validador.
- `FamiliaSchema`: Família de documento na tabela de vigências (um teste confere que bate com as chaves do JSON).
- `Particle`: `type Particle = ElementParticle | GroupParticle | WildcardParticle`
- `ValorDe`: Valor tipado de um `ComplexType`. `type ValorDe<C> = C extends ComplexType<infer T> ? T : never`

### Constantes

- `VIGENCIAS`: A tabela inteira, como dado. `VIGENCIAS: Readonly<Record<FamiliaSchema, readonly EntradaDeVigencia[]>>`
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
