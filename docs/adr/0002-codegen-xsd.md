# 0002. Codegen a partir dos XSD oficiais (tipos, serializer ordenado, decoder e validador)

Status: proposta (spike S1, 25/set/2026). Código descartável em `spikes/s1-codegen/`.

## Contexto

O princípio 3 do plano manda gerar do XSD os tipos, a ordem dos elementos e as restrições, sem nada escrito à mão onde o schema decide. A pergunta do S1: existe ferramenta TypeScript que faça isso bem, ou precisamos de gerador próprio? E como tratar `xs:choice`, `xs:sequence`, restrições e vários pacotes de liberação (PL) convivendo?

A ordem importa por dois motivos. A SEFAZ rejeita por schema qualquer elemento fora de ordem, e o digest da assinatura é calculado sobre o C14N de `infNFe`, então o serializer precisa produzir exatamente os bytes que depois serão assinados (princípio 2).

Entradas usadas, todas artefatos públicos, com URL e sha256 em `spikes/s1-codegen/xsd/<PL>/SOURCE.md`:

- **PL_010f_v1.04** (NT 2025.002 v1.50 e NT 2026.007 v1.00, publicado em 31/08/2026, o vigente no portal da NF-e).
- **PL_010e_v1.02** (NT 2025.002 v1.40, 10/07/2026), para testar duas versões lado a lado.
- **PL_009q** (NT 2025.001, 19/05/2025), o último antes da reforma tributária (sem IBS/CBS).
- **PL_MDFe_300b_NT012025** (MDF-e 3.00b, o zip se chama 1.04 e a pasta interna 1.05), como segundo documento.

A cópia de `leiauteNFe_v4.00.xsd` que o integrador em produção herdou de uma distribuição de terceiros não bate byte a byte com nenhum PL oficial baixado (fica a 102 linhas de diff do 010e). Serviu só de comparação, e reforça que o repo deve guardar os XSD oficiais com hash em vez de herdar cópias de terceiros.

Corpus local (dados pessoais, fora do repo, aqui só agregados): 2.115 nfeProc próprias (uma plataforma emissora), 1.500 nfeProc de terceiros (muitos ERPs) e 372 mdfeProc.

## O que o XSD da NF-e exige do gerador

Levantamento do PL_010f: 1.163 `xs:element`, 368 `xs:simpleType`, 190 `xs:complexType` (a maioria anônima e aninhada até 8 níveis), 28 `xs:choice`, 565 enumerações, 89 patterns distintos, `minLength`/`maxLength`/`length`, 240 `whiteSpace="preserve"`, 2 `xs:unique`, `xs:element ref="ds:Signature"` com import do xmldsig (que usa `simpleContent/extension`, `base64Binary`, `anyURI`, `ID` e atributos `fixed`). Três armadilhas apareceram só ao processar os arquivos de verdade:

- **Include camaleão.** `DFeTiposBasicos_v1.00.xsd` (grupos de IBS/CBS, compartilhado entre DF-e) não tem `targetNamespace` e é incluído pelo leiaute da NF-e, então herda o namespace de quem inclui. Resolver nomes sem tratar isso quebra (`TCompraGov` não encontrado).
- **Grupo repetível.** `TProtNFe/infProt` tem `xs:sequence maxOccurs="5"` com `cMsg`,`xMsg`. E `imposto` declara `IPI` duas vezes, em ramos diferentes do mesmo `choice`, com o mesmo tipo.
- **`xs:any`.** Na NF-e não aparece; no MDF-e o `infModal` é `xs:any processContents="skip"` e o conteúdo (rodo, aéreo, aquaviário, ferroviário) vem de outro XSD. Eventos (`detEvento`) e distribuição DF-e seguem o mesmo padrão.

Os identificadores de campo do MOC (B09, E03a etc.) **não** estão no `xs:documentation`: só 1 dos 915 textos de documentação do leiaute começa com um ID. Se quisermos o ID no JSDoc e nas mensagens de erro, ele vem de uma tabela separada extraída do MOC.

## Opções com evidência

### Ferramentas existentes

Todas rodadas sobre o PL_010f (reprodução em `spikes/s1-codegen/eval-tools/run.sh`).

| Ferramenta | Versão, licença, atividade | Resultado no NF-e |
|---|---|---|
| cxsd | 0.1.1, MIT, parada desde 2022 | Gera `.d.ts` e tabela de parser (cxml). Só lê por HTTP (recusa `file://`), depende do pacote `request` descontinuado. Propriedades em ordem alfabética nos tipos; o `choice` de ICMS vira 20 propriedades **obrigatórias** ao mesmo tempo; patterns e tamanhos somem (só enum de tipo nomeado). Sem serializer. |
| @kie-tools/xml-parser-ts-codegen | 10.2.0, Apache 2.0, ativa (abr/2026) | Único com metadados de ordem e builder, feito para BPMN/DMN. Exige prefixo `xsd:` (NF-e usa `xs:`); depois de renomear, aborta em `restriction base="TString"` (restrição sobre simpleType próprio, o padrão central da NF-e). O README avisa que anônimos só até profundidade 2. |
| @asyncapi/modelina (entrada XSD) | 5.10.1, Apache 2.0, ativa | 122 interfaces, sem runtime. Perde a opcionalidade (tudo obrigatório), renomeia campos (`cNf`, `TnFe`), `retirada: string` no lugar de `TLocal`, sem os grupos de ICMS. |
| xsd-ts | 0.0.36, MIT, 2024 | Ignora `xs:include` (só segue `import`), então não resolve `tiposBasico`. Falha. |
| xgen (Go, gera TS) | commit de set/2026, BSD | Roda em 3,4 s. Nomes em PascalCase (`CUF` para `cUF`, sem volta para o XML), `any` para os simpleTypes anônimos, choices achatados, sem runtime. |
| xsdata (Python, só referência de desenho) | 0.7 s, 659 KB de Python | Modela bem: `choice` vira campo composto com união de tipos, restrições como metadados de campo, serializer genérico que percorre os metadados. É o desenho que adotamos em TS. |

Nenhuma entrega o que o princípio 3 pede em TS: tipos fiéis + serializer em ordem + restrições + choice + versões. As que têm runtime não têm restrições; as que têm tipos perdem ordem ou opcionalidade.

### Gerador próprio (protótipo)

`XSD -> IR (JSON) -> um módulo TS por documento e PL`. O módulo exporta, com o mesmo identificador, o **tipo** TS e o **descritor** de runtime (`CT<T>` com tipo fantasma), então `serialize(TNFe, "NFe", valor)` infere o tipo do valor. Serializer, decoder e validador são genéricos (runtime inteiro com parser XML e C14N em cerca de 670 linhas, sem dependências) e percorrem o descritor na ordem do XSD. Gerador em cerca de 600 linhas; gera cada PL em 8 a 15 ms.

Decisões de modelagem testadas:

- **Valores simples como string lexical**, inclusive decimais (`"123.40"`). Nenhuma conversão para number, então nada se perde em formatação. Enumerações viram união de literais (`indIEDest: "1" | "2" | "9"`).
- **`xs:choice` como união discriminada com exclusividade** (`{ CNPJ: string; CPF?: never; idEstrangeiro?: never } | ...`). Verificado com `@ts-expect-error`: CNPJ e CPF juntos não compilam, enumeração inválida não compila.
- **Nomes estáveis**: tipo nomeado mantém o nome do XSD; anônimo recebe o caminho (`TNFe.infNFe.det.imposto` vira `TNFe_infNFe_det_imposto`). Nome estável é o que torna o diff entre PLs legível.
- **Grupo repetível** vira arrays zipados por índice; nome repetido com o mesmo tipo vira uma propriedade só (o gerador aborta se o tipo for diferente).
- **`xs:any`** entra por uma tabela de ligação declarada como dado (`infModal -> rodo | aereo | aquav | ferrov`), revisada junto com o XSD. Sem ligação, o gerador lista o ponto em `unsupported` em vez de ignorar.
- **Patterns XSD traduzidos para RegExp JS** com âncora implícita e flag `u` (`\d` vira `\p{Nd}`, `\s` vira `[ \t\n\r]`); construções não implementadas (`\i`, `\c`, subtração de classe, blocos `\p{Is...}`) abortam a geração.
- **Serializer emite forma canônica**: sem declaração XML, sem espaços, atributos ordenados, tags de abertura e fechamento (nunca `<x/>`), escape do C14N. A string gerada já é o C14N do elemento, exceto pelo `xmlns` herdado que o C14N acrescenta no ápice do subconjunto assinado.

### Round-trip no corpus

Para cada nfeProc: parse, decode para o objeto tipado, serialize de `infNFe`, e três comparações: bytes iguais ao `infNFe` original, igual ao C14N do original, e SHA-1 do C14N da nossa saída igual ao `DigestValue` da assinatura. O C14N usado confere o digest original em 3.594 dos 3.601 documentos assinados (os 7 restantes foram reformatados depois de assinados).

| | NF-e próprias | NF-e de terceiros | MDF-e |
|---|---|---|---|
| Documentos | 2.115 | 1.500 | 372 |
| Digest original confere | 2.108 | 1.486 | 371 |
| **Digest da nossa serialização confere** | **2.108 (100%)** | **1.486 (100%)** | **371 (100%)** |
| Igual ao C14N do original | 2.108 | 1.487 | 371 |
| Byte a byte igual ao original | 725 (34,3%) | 331 (22,1%) | 0 |

Categorias de toda divergência byte a byte:

- **Ordem dos atributos** `versao` antes de `Id` no `infNFe`/`infMDFe` (1.383 próprias, 1.099 de terceiros, 371 MDF-e). Equivalente no C14N, que ordena `Id` antes de `versao`. Os emissores se dividem entre as duas ordens, então nenhuma regra fixa reproduz os dois; a canônica é a única defensável.
- **Tag autofechada** `<x/>` (61 de terceiros). Equivalente no C14N.
- **Whitespace entre tags** (7 de terceiros). XML indentado depois da assinatura; o digest do próprio original também não confere. O decoder registra `whitespace-dropped`.
- **Documento não conforme** (6 de terceiros, sem assinatura): `Id`, `versao`, `nItem` e `xCampo` gravados como elementos em vez de atributos, provável conversão JSON para XML de algum ERP. O decoder aponta `unknown-element` com o caminho.
- **Ordem de elementos** (7 próprias gravadas com `protNFe` mas sem `Signature`, provavelmente remontadas pela plataforma, com `vOutro` fora de ordem em `ICMSTot`). O serializer corrige a ordem, que é o comportamento desejado, e o validador aponta as duas falhas.
- Decimais, elementos vazios e namespace: **zero** divergências. `&amp;`, `&gt;`, `&quot;`, CR literal e aspas simples no original também não geraram nenhuma divergência semântica.

### Validador estrutural contra o libxml2

O mesmo descritor alimenta um validador (modelo de conteúdo com ordem, ocorrência e choice, atributos e facets). Oráculo: `xmllint --schema` do libxml2 sobre `nfeProc` inteiro.

| PL | Documentos | Veredito igual ao xmllint |
|---|---|---|
| PL_010f | 3.615 | 3.615 (3.594 válidos, 21 inválidos nos dois) |
| PL_009q | 3.615 | 3.615 (738 inválidos nos dois, 697 por `IBSCBS`, que não existe no 009q) |
| MDF-e 3.00b | 372 | 372 |

O oráculo achou um bug real na primeira rodada: `length` de `base64Binary` conta octetos decodificados, não caracteres (`hashCSRT`, 2 notas). Corrigido. Todas as 2.108 próprias com assinatura íntegra validam no PL_010f, e o mesmo vale para as 1.486 de terceiros. As 21 inválidas são as 7 próprias sem `Signature`, as 7 de terceiros reindentadas depois de assinadas (o whitespace entrou em `infCpl`), as 6 não conformes e 1 de terceiros sem `Signature`.

### Tempo por nota (média de 8,4 KB, 3.615 notas, macOS arm64)

| µs por nota | Bun 1.4.2 | Node 26.3.1 | Deno 2.9.1 |
|---|---|---|---|
| tokenizar | 19,7 | 22,8 | 24,0 |
| parse até objeto tipado | 41,3 | 41,2 | 42,1 |
| serializar NFe | 20,0 | 24,5 | 24,5 |
| validar estrutura e facets | 121,7 | 108,9 | 110,4 |
| C14N de infNFe | 30,0 | 46,6 | 42,2 |

Tudo abaixo de 0,2 ms por nota; nenhum gargalo perto do custo de rede e assinatura. O validador é o mais lento e ainda tem folga óbvia (regex compilada por descritor, matcher por conjuntos de posições).

### Tamanho e tree-shaking

| | Fonte gerado | JS minificado | gzip |
|---|---|---|---|
| PL_010f, módulo inteiro (tipos, JSDoc, descritores) | 307 KB, 7.125 linhas | 57,5 KB | 10,7 KB |
| MDF-e 3.00b inteiro | 104 KB | 24,8 KB | 5,3 KB |

Bundles reais (bun build e esbuild concordam em 1%):

| Entrada | min | gzip |
|---|---|---|
| parse + decode + serialize da NF-e (PL_010f) | 57 KB | 12,0 KB |
| o mesmo + validador | 61 KB | 13,3 KB |
| só `TEndereco` + serializer | 2,4 KB | 1,2 KB |
| só tipos (`import type`) | 0 | 0 |
| dois PLs no mesmo bundle | 101 KB | 19,1 KB |

Descritores são `const` sem efeito colateral, então quem importa um tipo pequeno leva só o que ele alcança, e PL não importado custa zero. O `tsc` sobre os quatro módulos gerados roda sem erro e sem custo perceptível.

## Decisão proposta

1. **Gerador próprio**, no desenho do protótipo: `XSD -> IR JSON -> módulo TS` com tipos e descritores no mesmo identificador, runtime genérico sem dependências. Nenhuma ferramenta avaliada cobre choice, ordem e restrições em TS; adaptar a do kie-tools custaria mais do que os ~600 linhas do gerador, e ainda teríamos de manter um fork de código feito para BPMN.
2. **Modelo de valores**: strings lexicais, enumerações como união de literais, choice como união exclusiva, nomes estáveis por caminho. Conversão de number e data para string fica nos builders de `@sinete/nfe`, com o número de casas lido do pattern (`TDec_1302` = 2 casas), nunca no serializer.
3. **Serializer emite a forma canônica** e o XMLDSig do S3 assina essa string sem reparsear. O critério de aceitação do serializer passa a ser "digest confere", não "byte a byte igual ao original de outro emissor". Para documentos recebidos, a string original é guardada e nunca reserializada.
4. **Decoder tolerante, validador estrito.** O decode de documento recebido não aborta; devolve o objeto e a lista de ocorrências (elemento desconhecido, whitespace descartado, namespace errado). Emissão sempre passa pelo validador antes de assinar.
5. **Versões lado a lado em `@sinete/schemas`**, com subpath por documento e PL: `@sinete/schemas/nfe/PL_010f`, `@sinete/schemas/mdfe/PL_300b_NT012025`. Cada PL é um módulo autocontido; tree-shaking garante que PL não usado custa zero. Um pacote só, e não um pacote por PL, porque o custo de publicação e de changesets cresceria a cada NT sem ganho de bundle.
6. **PL como dado com vigência.** Uma tabela versionada liga PL a documento, ambiente e datas de vigência em homologação e produção. `@sinete/nfe` escolhe o PL pela data de emissão do relógio injetado (princípio 6) e pelo ambiente, nunca por tentativa. O diff do 010e para o 010f mostra por quê: o 010f removeu `gMonoPadrao`, `gMonoReten`, `gMonoRet` e `gMonoDif` e criou quatro grupos novos em `gIBSCBSMono`, então "o PL mais novo lê tudo" não é garantido.
7. **NT nova vira "regenerar e revisar diff"**: baixar o zip oficial para `xsd/<doc>/<PL>/` com `SOURCE.md` (URL, data, sha256), rodar o gerador, revisar (a) o diff semântico da IR, que lista caminhos adicionados, removidos e com ocorrência (inclusive a de sequence e choice em volta), tipo, facet, ordem dos filhos, namespace, unique, fixed, conteúdo simples ou anyAttribute alterados (010e para 010f, por raiz: 59 adicionados, 23 removidos, 2 alterados, entre eles `emit/IE` que passou a opcional e `vNFTot` que passou a aceitar zero), e (b) o diff do TS gerado; depois rodar round-trip e oráculo no corpus local. O CI confere que a saída regenerada é idêntica à versionada. PL novo é `minor` do `@sinete/schemas`; os módulos de PL existentes não mudam.
8. **Ligações de `xs:any` como dado** revisado junto com o XSD (modais do MDF-e, `detEvento` por tipo de evento, `docZip` da distribuição).

## Consequências

- Mantemos um gerador e um runtime de XML próprios. É código pequeno, mas crítico: a suíte precisa de round-trip no corpus e de concordância com o libxml2 a cada mudança do gerador, rodando localmente, porque o corpus não sai da máquina. No repo entram só fixtures anonimizadas.
- O parser com offsets e o C14N daqui e os do S3 fazem a mesma coisa e devem virar um só em `@sinete/core/xml`.
- Objetos em string exigem helpers de formatação para quem monta nota a partir de números. É o preço de nunca perder um dígito nem uma casa decimal.
- A escolha de PL por vigência obriga a manter a tabela de vigências atualizada. Um PL esquecido faz a emissão usar o schema errado; o `sinete doctor` deve avisar quando o PL mais novo da tabela tiver mais de N dias e o portal listar outro.
- O tipo gerado é grande (307 KB de fonte por PL da NF-e). Não pesa no bundle, mas pesa no pacote npm; aceitável, e a IR JSON (686 KB) não precisa ser publicada.
- Emissores que comparam XML byte a byte com o que outro sistema gerou vão ver diferença de ordem de atributos. Não afeta assinatura nem autorização.

## Pendências

- **IDs do MOC** (B09, E03a...) não estão no XSD. Decidir se extraímos uma tabela campo para ID do MOC para usar em JSDoc e mensagens de erro.
- **Eventos e NFS-e**: gerar `envEvento`/`procEventoNFe` com a ligação de `detEvento` por tipo e rodar round-trip nos 600 eventos do corpus; gerar a DPS da NFS-e Nacional, que tem outro estilo de XSD.
- **Validação de objeto antes de serializar** (hoje o validador roda sobre a árvore). Para emissão, validar o objeto direto evita um parse extra e permite mensagem com caminho tipado.
- **Performance do validador** (~110 µs por nota): cachear o mapa de declarações por tipo e trocar o matcher por conjuntos por um autômato determinístico, já que o XSD garante a Unique Particle Attribution.
- **Tabela de vigências**: levantar as datas de homologação e produção de cada PL desde o 009q e decidir o comportamento quando a data cair fora de toda vigência.
- **`xs:unique`** (`nItem` em `det`, `dia` em `cana`) está na IR mas o validador ainda não confere. *Revisão (01/10/2026): resolvida no M0; o validador confere `xs:unique` e ID único (seção [Implementação no M0](#implementação-no-m0-25set2026), `packages/schemas/src/runtime/validate.ts`).*
- **Diferenças de regex entre motores**: pela spec, `\d` do XSD é `\p{Nd}` (qualquer dígito Unicode), e é o que o libxml2 e o protótipo aplicam. Não sabemos qual motor cada autorizador usa; conferir em homologação se algum rejeita dígito não ASCII que o pattern aceita, e decidir se o validador de emissão deve ser mais estrito que a spec.

## Implementação no M0 (25/set/2026)

O desenho acima virou `tools/xsd-codegen` e `@sinete/schemas`, com o parser e o C14N unificados no `@sinete/core/xml`. O que mudou ou apareceu na implementação:

- **Os serviços não vêm no zip do PL.** O `PL_010f_v1.04` só traz o leiaute da NF-e. Eventos, consulta protocolo, inutilização e consulta cadastro vêm do `PL_010d_v1.03` (CNPJ alfanumérico, o mais recente para eles); o status do serviço só é redistribuído até o `PL_009q`; os `detEvento` de cancelamento, CC-e e manifestação estão em pacotes próprios; o `PL_NFeDistDFe_104` importa o xmldsig sem redistribuí-lo. Tudo fica em `tools/xsd-codegen/xsd/` com `SOURCE.md` e sha256, e o gerador confere os sha256.
- **Eventos em duas etapas, como a SEFAZ.** O envelope genérico tem `detEvento` como `xs:any`; cada tipo de evento é um módulo que troca esse `detEvento` pelo do `e<tpEvento>`, com os tipos básicos do pacote mais novo. `xs:any` sem ligação vira wildcard com o XML bruto em `$any`.
- **Vigências levantadas** (`packages/schemas/src/data/vigencia.json`): PL_010e em produção desde 03/08/2026, PL_010f em homologação desde 01/09/2026 e em produção a partir de 03/11/2026, com a NT de cada data. Fora de toda vigência é `VigenciaError`, nunca tentativa.
- **`xs:unique` e ID único** agora são conferidos pelo validador, e o espaço léxico dos tipos embutidos também.
- **Um bug do libxml2** apareceu nas mutações: o pattern `[A-Z]{2,3}[0-9]{4}|[A-Z0-9]{7}` do `TPlaca` do MDF-e aceita `ZZZZZZZZZ` no xmllint (2.9.13 e 2.15.3). O validador segue a spec e recusa. Fora isso, o veredito é igual ao do xmllint em 100% do corpus e das mutações.
- Continuam pendentes os IDs do MOC (tabela campo para ID) e a NFS-e (feita no M6, abaixo).

## NFS-e Nacional no M6 (26/set/2026)

A pendência da NFS-e virou os módulos `nfse/1.01-20260209` e `nfse/1.01-20260727` (DPS, NFSe, pedRegEvento e evento), gerados dos XSD oficiais com `SOURCE.md` e sha256, sem mudar o desenho. O que apareceu:

- **XSD oficial com erro.** O `TSSerieDPS` de 09/02/2026 declara `^0{0,4}\d{1,5}$`. Em regex de XSD, `^` e `$` são literais, então nenhuma série passa num validador conforme (o spike do ADR 0004 viu isso no libxml2). O gerador ganhou `patches`: a correção é dado em `src/modules.ts`, com o pattern oficial, o usado e o motivo, e sai no `schema.patches` e no cabeçalho do módulo. Um patch que não casa aborta a geração, então uma versão corrigida do XSD obriga a tirar o patch.
- **Outro erro, sem correção.** O `TSChaveNFSe` de 27/07/2026 (`[0-9]{6}([0-9A-Z]{14})[0-9]{30}`) põe o trecho alfanumérico nas posições 7 a 20 da chave, e não nas 10 a 23 da inscrição federal. Com CNPJ numérico nada muda; com CNPJ alfanumérico, uma chave correta pode ser recusada. Fica registrado e o módulo segue o XSD, porque não sabemos o que a Sefin valida.
- **xmldsig.** A cópia do pacote de 09/02/2026 tem DOCTYPE, que o parser recusa; `replaceImports` usa a cópia do pacote de 27/07/2026. O XSD do W3C usa construções fora do subconjunto, e `opaqueElements` gera a `ds:Signature` como `$any`: a assinatura é do `@sinete/core/xml`, não do schema.
- **Regex.** Os patterns da NFS-e usam `\S` e `\D` dentro de classe de caracteres (`[\S ]`). O tradutor passou a aceitar esses escapes negados dentro de classe positiva, trocando a classe por uma alternação; em classe negada eles continuam `unsupported`.
- **Vigência.** Nova família `nfse`. A Documentação Atual do portal ainda lista o pacote de 09/02/2026 como de produção, enquanto a notícia de 28/07/2026 põe o de 27/07/2026 em produção em 10/08/2026; a tabela segue a notícia, com a fonte.

## Reprodução

Em `spikes/s1-codegen/`: `bun src/gen/cli.ts` regenera `generated/<PL>/`; `bun src/gen/diff.ts PL_010e_v1.02 PL_010f_v1.04` mostra o diff semântico; `bun src/bench/roundtrip.ts` (também com `node` e `deno run -A`), `bun src/bench/oracle.ts` e `bun src/bench/roundtrip-mdfe.ts` rodam sobre `~/.local/state/sinete/corpus/` e imprimem só agregados.
