# ADR 0011: origem e rótulo das ocorrências de validação

- Status: aceito
- Data: 27/set/2026
- Resolve a pendência do [ADR 0010](0010-fronteira-emissor.md) sobre a classificação das ocorrências e o rótulo de caminho em português.
- Revisto em 01/out/2026 (seção [Revisão (01/10)](#revisão-0110)): a NF-e confere o texto e o tamanho dos campos na entrada, e o contrato do `caminho` fica escrito.

## Contexto

Quando a montagem recusa um documento, o sinete devolve (ou lança num `ValidationError`) a lista de `ValidationIssue` com `path`, `code` e `message`. Quem integra precisa decidir, para cada ocorrência, se ela é um dado que a pessoa preencheu e deve corrigir, ou um defeito do integrador ou do sinete, que vai para o log de erros e não para a tela. E precisa mostrar o caminho de um jeito que a pessoa entenda: `itens[1].produto.xProd` não diz nada a quem preencheu a nota.

O integrador em produção, único consumidor até aqui, resolve as duas coisas à mão, com umas 150 linhas por documento: listas de códigos e de prefixos de caminho que contam como dado do usuário, e tabelas de grupos e de campos para montar `Item 2, Descrição do produto`. As duas coisas têm uma parte que só ele sabe (quais campos da entrada a própria aplicação preenche sozinha, como o `cMDF`, o `nMDF` e o `respTec`) e uma parte que é do sinete: em que fase a ocorrência nasceu, e o que significa cada caminho do leiaute.

Dois formatos de caminho convivem: as conferências da entrada e do documento montado usam pontos e índice a partir de zero (`itens[0].produto.xProd`, `infNFe.det[0].prod.xProd`); o validador de XSD usa barras e índice a partir de um, só quando o elemento se repete (`/infNFe/det[2]/prod/xProd`).

## Opções

1. **Nada no sinete.** Cada integrador refaz as listas por código e caminho. É o que existe; as listas quebram em silêncio a cada código novo, e o integrador precisa conhecer a ordem interna do montador para saber o que é do XML.
2. **Um booleano "é do usuário".** O sinete não sabe quais campos o integrador preenche sozinho: o `nMDF` é dado da pessoa num ERP e numeração automática no integrador em produção. A resposta estaria errada para alguém.
3. **A fase em que a ocorrência nasceu (`origem`) e um rótulo por documento (`rotuloDoCaminho`).** O sinete diz o que ele sabe; o integrador cruza com o que só ele sabe.

## Decisão

A opção 3.

### 1. `origem?: 'entrada' | 'montagem'` no `ValidationIssue`

- **`entrada`**: conferência feita sobre a entrada do domínio (`NfeInput`, `MdfeInput`, `DpsInput`), antes de montar. O `path` é um caminho da entrada e corrigir o valor ali resolve.
- **`montagem`**: conferência feita sobre o que o sinete produziu a partir da entrada: o XML serializado contra o XSD e o PL (`schema`, `campo_fora_do_pl`), caractere que o XML não representa (conferido no documento montado, com caminho `infNFe.*`), a chave gerada com o cNF sorteado, as opções do montador (o `tpEmis` do MDF-e), o grupo IBS/CBS devolvido pela calculadora, as regras da NT sobre ele e a alíquota que o pacote não conhece. A causa pode ainda ser um valor da entrada (um texto longo copiado como veio estoura o tamanho no XSD), mas o sinete não sabe qual.

A regra é pela fase, não por código: `schema` no grupo IBSCBS pronto que veio na entrada (`ibsCbs.grupo`) é `entrada`; o mesmo erro no grupo que a calculadora devolveu é `montagem`. A calculadora é uma porta: a ocorrência que ela devolve sem `origem` entra como `montagem`, e a padrão marca como `entrada` o que aponta um valor da nota (classificação não suportada, base ausente, redutor divergente).

O campo é opcional para ser aditivo: quem constrói `ValidationIssue` fora do sinete não quebra. `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem, e o `ValidationError` do emissor leva as ocorrências como vieram. Ausente, a ocorrência não foi classificada (validadores avulsos do `@sinete/validators`, que não sabem em que fase estão).

Uso esperado, que é o que o integrador em produção fazia com as listas:

```ts
const paraAPessoa = issues.filter((i) => i.origem === 'entrada' && !preenchidoPeloSistema(i.path));
```

### 2. `rotuloDoCaminho(path)` em cada pacote de documento

`@sinete/nfe` e `@sinete/mdfe` exportam `rotuloDoCaminho(path): string`, com o mesmo nome nos dois (ADR 0009): `Grupo, Campo` quando os dois são conhecidos (`Condutor 1, CPF`), só um deles quando falta o outro, e `Dados da NF-e` ou `Dados do MDF-e` quando nenhum é. Aceita os dois formatos de caminho e as duas árvores (entrada e documento montado), e numera a partir de um, como a pessoa conta.

O mecanismo (normalizar o caminho, casar o grupo, achar o campo) fica no `@sinete/core` como `normalizarCaminho` e `criarRotuloDoCaminho(tabela)`, para a NFS-e e os documentos novos só trazerem as tabelas. As tabelas ficam no código de cada pacote, não em JSON: não são regra fiscal com fonte e vigência, são texto de interface derivado dos nomes do leiaute.

A NFS-e ainda não tem `rotuloDoCaminho`: a DPS tem outro vocabulário (prestador, tomador, serviço), e nenhum consumidor pediu. Entra quando entrar, com o mesmo nome.

## Consequências

- Aditivo: nenhum tipo muda de forma incompatível e nenhum código de ocorrência muda. Quem compara ocorrências com `toEqual` passa a ver o campo `origem`.
- O integrador em produção pode trocar as listas por código e as tabelas de rótulo pelas do sinete, e fica só com a lista dos campos que ele mesmo preenche e com o formato do erro do GraphQL.
- Montador de documento novo marca a origem pela fase: o coletor de ocorrências (`Issues`) tem `add` (entrada), `montagem` e `classificadas`, que preenche `entrada` no que veio sem.

## Pendências

- `rotuloDoCaminho` da NFS-e.
- ~~Conferir o texto de alguns campos na entrada da NF-e antes de montar~~: feito na [Revisão (01/10)](#revisão-0110).
- A mesma conferência no MDF-e e na DPS, que ainda acusam texto e tamanho só na montagem, com o caminho do XML. Mudar é quebra do `caminho` e da `origem` dessas ocorrências: entra num minor enquanto os pacotes estiverem em 0.x, ou fica como está depois da 1.0 deles.

## Revisão (01/10)

### O que mudou

A pendência dos textos da NF-e foi resolvida no 0.3.0. Antes, um texto que o XML não representa saía como `campo_invalido` com o caminho do documento montado (`infNFe.det[0].prod.xProd`, `origem: 'montagem'`), e um texto fora do tipo do leiaute (longo demais, com espaço nas pontas, com caractere fora do `TString`) saía do validador de XSD como `schema` com o caminho do XSD (`/infNFe/det[1]/prod/xProd`, `origem: 'montagem'`). A causa era sempre um valor que a pessoa digitou, e o integrador precisava traduzir o caminho do XML para o da tela.

O `montarNfe` agora confere na entrada (`src/build/textos.ts`):

- **Caractere fora do XML**, em qualquer texto da entrada: `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`itens[0].produto.xProd`).
- **Tipo do leiaute** nos campos de texto que a montagem copia como vieram (nome, fantasia e endereço do emitente, do destinatário e dos locais de retirada e entrega, e-mail, natureza da operação, código, descrição, unidades e pedido do produto, informação adicional do item, transportador, volumes, fatura, duplicata, descrição do pagamento, informações adicionais e observações, compra): o tipo simples do elemento no PL da montagem (`TString` com o `minLength` e o `maxLength` dele), pelo mesmo `conferirTipoSimples` do validador. Sai `schema`, como saía, com o código do validador na `mensagem` (`tamanho_maximo: tamanho máximo 120 (TString)`), `origem: 'entrada'` e o caminho da entrada.

O limite vem do schema do PL, nunca de um número no código: a tabela do `textos.ts` só liga o campo da entrada ao elemento do `infNFe` que o recebe. Um PL que mude o `maxLength` muda a conferência sem tocar no montador.

Ficam de fora, e continuam como estavam:

- os campos que a montagem troca por um texto fixo em homologação (o nome do destinatário, E04-20, e a descrição do primeiro item da NFC-e, I04-10): o texto informado não vai ao XML de teste;
- o campo que já tem ocorrência de outra conferência da entrada (o nome do destinatário obrigatório em produção, por exemplo) não ganha a segunda;
- os grupos repassados no tipo do schema (`exporta`, `infIntermed`, `cana`, `agropecuario`, `gCred`, `rastro` e afins), as opções da montagem (o `respTec` das opções, o CSC, o QR Code) e os valores que o sinete calcula ou formata: o validador de XSD e a conferência do documento montado continuam acusando esses, com o caminho do XML e `origem: 'montagem'`.

### O contrato do `caminho`

O `caminho` de uma ocorrência é API (ADR 0016): o integrador o usa como chave da tabela de rótulos e da lista dos campos que a aplicação preenche sozinha. Os formatos são três, e a `origem` diz qual esperar:

| Onde a conferência roda | Formato | Exemplo | `origem` |
|---|---|---|---|
| Entrada do domínio (`DadosNfe`, `DadosMdfe`, `DadosDps`) e opções do montador | nomes da entrada, separados por ponto, índice de lista a partir de zero | `itens[0].produto.xProd`, `qrCode.versao` | `entrada` (as opções do montador, `montagem`) |
| Conferências do montador sobre o documento montado | `infNFe.` (ou `infMDFe.`, `infDPS.`) com os nomes do leiaute, ponto, índice a partir de zero | `infNFe.det[0].prod.xProd` | `montagem` |
| Validador de XSD sobre o XML serializado | barras, nomes do leiaute, índice a partir de um só no elemento que se repete | `/infNFe/det[2]/prod/xProd` | `montagem` |

A mesma regra sobre a mesma entrada sai sempre no mesmo caminho e com a mesma `origem`. Mover uma conferência da montagem para a entrada, como esta revisão fez, muda os dois e é quebra: em 0.x, minor com a lista das ocorrências afetadas no changeset; depois da 1.0, major. `rotuloDoCaminho` aceita os três formatos, então a tela que só mostra o rótulo não muda.
