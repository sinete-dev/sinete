# tools/xsd-codegen

Gerador de código dos XSD oficiais (XSD, IR JSON, módulo TS) que alimenta o `@sinete/schemas`, mais as checagens locais sobre o corpus. Workspace privado, nunca publicado; roda no Bun e pode usar Node e console.

## Decisões (ADR 0002)

- `XSD -> IR -> módulo TS`: o módulo exporta, com o mesmo identificador, o tipo TS e o descritor de runtime; toda exportação tem anotação explícita (`isolatedDeclarations`).
- Os XSD ficam em `xsd/<doc>/<pacote>/`, byte a byte como no zip oficial, com `SOURCE.md` (título, publicação, página, URL de download, sha256 do zip e de cada arquivo). O gerador confere os sha256 antes de gerar.
- Quais módulos existem, de quais arquivos, com quais raízes, ligações de `xs:any` e trocas de tipo é dado revisado em `src/modules.ts`.
- Construção fora do subconjunto suportado aborta a geração (`unsupported`), e pattern que o tradutor de regex não cobre também: nada some em silêncio. A exceção é dado revisado: elemento declarado sem tipo (que o XSD faz `xs:anyType`) listado em `untypedAsText` vira texto (hoje só o `tpAmb` do `TRetMDFe`).
- Correção de XSD oficial é dado revisado e visível: `patches` troca o pattern de um tipo simples (com o pattern oficial, o usado e o motivo), vai para `schema.ajustes` e para o cabeçalho do módulo gerado, e um patch que não casa aborta a geração. `replaceImports` troca um `xs:import` por outra cópia oficial (o xmldsig de 09/02/2026 da NFS-e tem DOCTYPE, que o parser recusa), e `opaqueElements` gera um elemento como `$any` (a `ds:Signature` da NFS-e, cujo XSD do W3C usa construções fora do subconjunto).
- Em nome global repetido entre pacotes (os eventos juntam o envelope do PL_010d com o `e110111` de outro pacote), vale o primeiro carregado, que é o pacote do envelope, o mais novo.

## Uso

```sh
bun run --cwd tools/xsd-codegen gen      # regenera ir/, packages/schemas/src/{nfe,mdfe,nfse} e packages/schemas/package.json#exports
bun run --cwd tools/xsd-codegen check    # só confere (é o que o teste do @sinete/schemas roda no CI)
bun tools/xsd-codegen/src/diff.ts nfe/PL_010e nfe/PL_010f   # diff semântico entre duas IRs
```

## NT nova

1. Baixe o zip oficial para `xsd/<doc>/<pacote>/` sem alterar nada e escreva o `SOURCE.md` no formato dos outros (o gerador lê a linha `Arquivo baixado`, a linha `Download` e a lista de sha256).
2. Acrescente ou ajuste a entrada em `src/modules.ts` e a vigência em `packages/schemas/src/data/vigencia.json`, com a fonte (NT e cronograma).
3. `gen`, depois revise o diff semântico da IR (`diff.ts`) e o diff do TS gerado.
4. Rode as checagens do corpus (abaixo) antes de abrir a PR. PL novo é `minor` do `@sinete/schemas`; os módulos existentes não mudam.

## Checagens locais no corpus

O corpus tem dado pessoal e fiscal: fica em `~/.local/state/sinete/corpus/` (ou `SINETE_CORPUS`), nunca entra no repo e os scripts não rodam no CI. Eles imprimem só agregados (contagens, códigos e caminhos de schema), nunca conteúdo, nome de arquivo ou chave, e gravam o resultado em `~/.local/state/sinete/results/`.

- `bun src/corpus-check/roundtrip.ts`: parse, decodificação, serialização canônica do elemento assinado e comparação com o original (bytes, C14N e SHA-1 contra o `DigestValue`), mais o validador.
- `bun src/corpus-check/oracle.ts`: veredito do validador contra `xmllint --schema` por documento, e depois contra mutações de documentos válidos (remover, duplicar e trocar elementos, alterar texto), com PRNG de semente fixa. Eventos e MDF-e são conferidos em duas etapas, como a SEFAZ faz (envelope e depois `detEvento` ou modal pelo schema próprio).

### Divergência conhecida do libxml2

O libxml2 (2.9.13 do macOS e 2.15.3 do Homebrew) aceita valores que não casam com o pattern `[A-Z]{2,3}[0-9]{4}|[A-Z0-9]{7}` do `TPlaca` do MDF-e: `ZZZZZZZZZ` (9 caracteres) valida, embora nenhuma alternativa aceite mais de 7. Sozinho, `[A-Z0-9]{7}` recusa corretamente; o erro aparece na combinação com a repetição contada da primeira alternativa. O validador segue a spec (regex ancorada) e recusa. É a única classe de divergência encontrada nas mutações (6 de 2.700). Não sabemos se o autorizador usa libxml2; vale conferir em homologação.
