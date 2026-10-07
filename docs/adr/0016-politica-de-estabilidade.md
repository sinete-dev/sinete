# ADR 0016: política de estabilidade e o que a 1.0 promete

- Status: aceito
- Data: 01/out/2026
- Emenda: 01/out/2026, a pendência da faixa do `@sinete/ibs-cbs-dados` foi resolvida (seção 6, "Faixa aberta").
- Complementa o [ADR 0001](0001-tooling-monorepo.md) (versões independentes por pacote, changesets), o [ADR 0008](0008-divisao-de-pacotes.md) (pacotes e subpaths), o [ADR 0010](0010-fronteira-emissor.md) (desfecho do emissor), o [ADR 0011](0011-origem-e-rotulo-das-ocorrencias.md) (`origem` e caminho das ocorrências) e o [ADR 0015](0015-nomes-em-portugues.md) (nomes da API pública).

## Contexto

Todos os pacotes estão em 0.x. O README da raiz diz "mudanças na API até a 1.0", e nenhum documento diz o que a 1.0 promete. A 0.2.0 levou quase todas as quebras de nome e de forma que o inventário da API achou (idioma, tipos de opções, montadores assíncronos, `tipo` do resultado do core, `ErroDa`, `pdf` tipado, `DesfechoEvento`), e o 0.3.0 leva as que sobraram e dependem só de nós. Depois disso, a pergunta que falta é qual mudança, numa versão 1.x, exige major.

Sem essa regra escrita, três situações viram debate a cada vez:

- **Caso novo numa união.** `ja-guardado` e `contingencia` entraram no desfecho do emissor em 0.x sem discussão. Depois da 1.0, um caso novo quebra o `switch` exaustivo de quem compila com `never` no fim, e não há regra dizendo se isso é minor ou major.
- **Dado que muda por norma.** Rejeições, endpoints, tabela de vigências, cadeia ICP-Brasil, dados do IBS/CBS mudam quando o órgão publica, não quando o sinete quer. O integrador compara `code` e `caminho` de ocorrência como chave de tabela; um PL novo muda o que a montagem produz a partir de uma data.
- **Parte que ainda não assentou.** O cliente do `sinete-signer` espera o ADR 0014, o motor do IBS/CBS espera a norma da base de cálculo, e o perfil de documento do emissor ganha gancho a cada ADR. Congelar o pacote inteiro por causa de um subpath atrasa a 1.0 de tudo o mais; congelar o subpath junto obriga a major a cada mudança dele.

O `@sinete/ibs-cbs-dados` tem um problema próprio: é versionado pelo mês dos dados (`2026.9.2`), e um `1.0.0` seria menor que qualquer versão já publicada.

## Opções

1. **Semver puro, sem exceções.** Todo caso novo de união e todo subpath contam como API; qualquer mudança que quebre a compilação de alguém é major. Simples de enunciar, mas transforma em major cada rejeição nova de que o emissor precise e cada evolução do perfil, e empurra a 1.0 dos pacotes estáveis para depois do mais instável.
2. **Uniões fechadas e um `tratar*` exaustivo como contrato.** Quem trata tudo pelo helper do sinete nunca quebra, e caso novo é major para quem escreve `switch`. Contradiz o que já acontece (os casos que entraram em 0.x vieram por necessidade do protocolo), e o helper exaustivo só esconde o problema: o caso novo precisa de um tratador novo de qualquer jeito.
3. **Semver com regras escritas para uniões abertas, dados com fonte e subpaths experimentais.** O que este ADR decide.

## Decisão

A opção 3.

### 1. O que o semver cobre

Numa versão 1.x de um pacote, só major remove, renomeia ou muda de forma incompatível o que segue. Acrescentar é minor; corrigir sem mudar o contrato é patch.

- **Nomes exportados de cada entrada do `exports`**: funções, classes, tipos, constantes, e as propriedades e os parâmetros desses tipos. A entrada é a unidade: um nome exportado por `@sinete/nfe` e por `@sinete/nfe/ibs-cbs` conta duas vezes. Parâmetro novo opcional e propriedade nova opcional na entrada são minor; propriedade nova num tipo que o integrador implementa (`TransmissaoStore`, `CalculadoraIbsCbs`, `Logger`) só é minor se for opcional.
- **Os subpaths**: tirar ou renomear um subpath é major; acrescentar é minor. As condições do `exports` (`node`, `default`, `types`) são detalhe de empacotamento e podem mudar em minor se a resolução do mesmo especificador continuar funcionando nos runtimes suportados.
- **O `code` dos erros** (`ErroSinete.code`) e a classe que o lança. É o contrato estável que o ADR 0015 já citava: quem trata erro compara o `code`. A `message` não é contrato. Os campos de `detalhes` que a página do erro em `docs/guia/erros/` documenta são contrato aditivo (campo novo é minor; tirar é major).
- **O `code` das ocorrências** (`Ocorrencia.code`, as listas `CodigoOcorrencia*`).
- **O `caminho` das ocorrências.** O integrador usa o caminho como chave da tabela de rótulos e das listas de campos que a aplicação preenche sozinha (ADR 0011). O formato (pontos e índice a partir de zero na entrada e no documento montado; barras e índice a partir de um no validador de XSD) e o caminho que cada conferência produz são contrato: a mesma regra sobre a mesma entrada continua saindo no mesmo caminho. Conferência nova, com caminho novo, é minor.
- **A `origem` das ocorrências.** Uma conferência que passa de `montagem` para `entrada` (ou o contrário) muda o que o filtro do integrador mostra à pessoa: é major. Ocorrência nova nasce com a `origem` da fase em que é conferida.
- **Os casos de cada união literal** (valores de `tipo`, `acao`, `motivo`, `situacao`, `code`), com a regra da seção 2.
- **Dados de catálogo e tabelas**, com a regra da seção 3.
- **PL e schemas**, com a regra da seção 4.

Fica fora: o texto das mensagens (`message`, `xMotivo` montado pelo sinete, `mensagem` das ocorrências, `orientacao` e `comoCorrigir` das dicas), a ordem das ocorrências dentro da lista, o que não está no `exports` (`dist/` por caminho, `src/`), os pacotes de ferramenta (`@sinete/sefaz-sim`, `@sinete/cli`), cujo uso é de teste e diagnóstico, e o desempenho.

### 2. Uniões de desfecho e de código são abertas

`Desfecho`, `DesfechoEvento`, `MotivoPendencia`, `SituacaoPosterior` (emissor), `ResultadoSefaz` (core), `ResolucaoEnvio` (NF-e, MDF-e e NFS-e), `OrigemOcorrencia` e as uniões de códigos (`CodigoErroCore`, `CodigoErroTransporte`, `CodigoErroSigner`, `CodigoErroEmissor`, `CodigoErroDa`, `CodigoOcorrencia*` e as demais `CodigoErro*`) são **abertas**: caso novo entra em minor.

- O caso novo vem de fora (uma situação do protocolo que o sinete ainda não distinguia, um alerta TLS novo, uma rejeição que o emissor precisa tratar à parte). Fechar a união faria cada um desses virar major, e o histórico em 0.x mostra que eles aparecem.
- Quem integra trata a união com `switch` e um `default`, que cai no tratamento mais conservador do contexto (no emissor: manter os bytes e alertar, como `pendente`). O guia mostra sempre assim. Quem prefere o `switch` exaustivo com `never` aceita que um minor quebre a própria compilação, e é a compilação que avisa onde tratar o caso novo: o comportamento em runtime não muda para os casos que já existiam.
- O caso novo vem documentado no changeset do pacote, na seção de cada união, com o que ele significa e qual caso antigo deixa de cobrir a situação (por exemplo: "`indefinida` passa a ser devolvido onde antes `resolverEnvioSemResposta` lançava `ErroRespostaInvalida`").
- Um caso já existente nunca muda de significado em minor. Se a situação que ele cobria se divide em duas, o caso antigo fica com a parte que manteve o significado e o novo leva a outra.
- Os helpers que tratam uma união inteira (`tratarResultado` do core) ganham o tratador do caso novo como opcional, com o comportamento sem ele descrito no JSDoc e no changeset. Tratador obrigatório novo seria major.

### 3. Dados de catálogo e tabelas

Rejeições (`@sinete/rejeicoes`), endpoints e hosts (`@sinete/transport`), regras de IE por UF (`@sinete/validators`), cadeia ICP-Brasil (`@sinete/cert`), `cStat` de cada perfil do emissor e tabela de vigências (`@sinete/schemas`) são dados com fonte e vigência (invariante "dados como dados"). O formato do dado (os tipos que o expõem) segue a seção 1. O conteúdo segue a fonte oficial:

- **Patch**: corrigir um valor para o que a fonte diz, acrescentar uma rejeição, um endpoint, uma AC, uma dica ou uma `orientacao` de catálogo, atualizar uma data de vigência que o órgão publicou. Quem usa recebe o comportamento que a norma manda, que é o que pediu ao instalar o sinete.
- **Minor**: dado novo que muda a decisão de código (um `cStat` que passa a manter os bytes, uma regra de pré-validação nova que recusa antes do envio, um serviço novo numa tabela), sempre com a fonte no changeset.
- **Nunca sai em patch nem minor** um registro que documentos já emitidos precisam para ser lidos ou consultados: uma rejeição revogada continua no catálogo, marcada com a vigência; um endpoint desligado sai da resolução a partir da data, mas a entrada fica com a data de fim.

### 4. PL e schemas

- **PL novo** entra em minor, como um módulo novo (`@sinete/schemas/nfe/PL_010f` e afins) e uma entrada nova em `vigencia.json`. A partir da data de produção, `selecionarPl` passa a escolhê-lo: a mudança do que a montagem produz vem da norma, com a data registrada, e o changeset a anuncia.
- **PL nunca sai em minor.** Documento recebido e documento emitido antes da troca precisam do PL da data deles (`selecionarPl` com um `relogioFixo` na data do documento). Tirar um PL do pacote é major, e só quando nenhum autorizador o aceita mais e os documentos da época não precisam mais ser validados por ele.
- Estado em 01/10/2026, que corrige o inventário de 29/09: o `PL_010e` é o PL vigente em produção desde 03/08/2026; o `PL_010f` está em homologação desde 01/09/2026 e entra em produção em 03/11/2026 (`packages/schemas/src/data/vigencia.json`). Depois de 03/11/2026 o `PL_010e` continua no pacote, para documentos com data anterior.
- Os tipos gerados de um PL publicado não mudam em minor (são a transcrição do XSD com sha256 fixado); correção de patch do órgão vira módulo novo ou entrada nova, nunca reescrita silenciosa do módulo existente, exceto os `patches` documentados no ADR 0002 para erro do XSD oficial.

### 5. Subpaths experimentais

Um subpath pode ser declarado **experimental**: fica fora da garantia desta política e pode quebrar em minor, sempre com changeset que diga a quebra. Serve para a parte que ainda depende de uma decisão aberta ou de uma norma, sem segurar a 1.0 do resto do pacote.

Como se marca:

- o comentário de módulo da entrada traz `@experimental` e diz por que é experimental e o que falta para sair;
- o README do pacote diz que o subpath é experimental, e a referência gerada do guia (`scripts/docs-gerados.ts`) leva o comentário do módulo, com a marca;
- o guarda-chuva `sinete` herda a marca: `sinete/<pacote>/<subpath>` de um subpath experimental é experimental pelo mesmo motivo;
- uma assinatura de uma entrada estável não usa tipo de uma entrada experimental. Quando uma função de entrada estável só existe para alimentar a experimental (os `perfilNfe`, `perfilMdfe` e `perfilNfse`, que devolvem `PerfilDocumento`), ela própria leva `@experimental` no JSDoc e fica fora da garantia, mesmo morando num subpath estável.

Sair de experimental é minor: o changeset diz que a entrada passou a valer pela política, e a marca sai do comentário, do README e da referência.

Experimentais na data deste ADR:

| Subpath | Por quê | Sai quando |
|---|---|---|
| `@sinete/transport/signer` | a forma do cliente e o lançador `@sinete/signer` dependem do [ADR 0014](0014-distribuicao-do-signer.md), ainda proposto | o ADR 0014 for aceito e os binários forem publicados pela release |
| `@sinete/nfe/ibs-cbs` | reexporta o `@sinete/ibs-cbs` inteiro, cuja calculadora espera a norma da base de cálculo (NT 2025.002, UB16-10, "implementação futura") | o `@sinete/ibs-cbs` sair 1.0 |
| `@sinete/emissor/perfil` | `criarEmissor`, `PerfilDocumento`, `ContingenciaDoPerfil` e os tipos que só servem a quem implementa um perfil de documento ganham gancho a cada ADR do emissor (ADR 0012, 0013); quem usa os `criarEmissor<Doc>` não depende deles | o perfil passar um ciclo de minors sem gancho novo, ou um segundo perfil fora do repositório pedir estabilidade |

Os `criarEmissorNfe`, `criarEmissorMdfe` e `criarEmissorNfse` dos subpaths `@sinete/emissor/nfe`, `/mdfe` e `/nfse` são estáveis; os `perfil<Doc>` desses subpaths são experimentais pela regra acima.

### 6. `@sinete/ibs-cbs-dados`: versão de calendário

O pacote segue `AAAA.M.patch` (o mês dos dados) e nunca terá "1.0": a versão diz de quando são os dados, não o que mudou no código. A promessa de estabilidade dele é outra:

- **O formato é o contrato.** `versaoDoFormato` do bundle e `VERSAO_DO_FORMATO_DOS_DADOS` do código dizem qual formato o leitor entende, e bundle de formato diferente é recusado (`ibscbs_dados_versao_incompativel`). Enquanto o formato for o mesmo, os nomes exportados, `ConteudoTributario` e os tipos das tabelas só mudam de forma aditiva, pela seção 1.
- **Quebra sobe o formato.** Mudança incompatível no código ou nas tabelas sobe `VERSAO_DO_FORMATO_DOS_DADOS`, sai num mês novo e é anunciada no changelog como quebra; o `@sinete/ibs-cbs`, que lê o dataset, sobe em major junto quando já estiver em 1.x.
- **Faixa aberta.** Quem depende do pacote declara `workspace:>=2026.9.3`, que o `bun pm pack` publica como `>=2026.9.3`: o dataset de um ano seguinte satisfaz a dependência dos pacotes já publicados. A faixa não protege o formato; quem protege é o motor: o `@sinete/ibs-cbs` guarda o formato que ele lê numa constante própria (`FORMATO_DOS_DADOS_DO_MOTOR`, nunca importada do pacote de dados) e recusa em `calcular`, `validar`, `restringir` e `determinar` o dataset de outro `versaoDoFormato` (`ibscbs_dados_versao_incompativel`). O piso sobe quando o código passar a precisar de um dado que só um dataset mais novo tem (subiu de `2026.9.2` para `2026.9.3` no `@sinete/nfe` e no `@sinete/ibs-cbs` com o release 0.3.0). `scripts/lib/faixa-ibs-cbs-dados.test.ts` confere que a faixa publicada aceita o dataset atual e os dos anos seguintes.
- **Dados mudam pela fonte**, pela seção 3: o pin de uma versão nova da Calculadora ou do IT é patch ou minor do mês, com o diff (`compararDatasets`) no PR, e `versaoDoConteudo` vai em todo cálculo para reprocessar com os dados da época.

### 7. `completarCadeia`: o padrão `false` é o contrato

`abrirCertificado` (`@sinete/emissor`) manda no mTLS a cadeia que veio no PFX; com `completarCadeia: true`, completa com as ACs da ICP-Brasil que o `@sinete/cert` conhece. O padrão `false` é contrato: mudar o padrão para `true` muda o que vai no handshake de todo integrador que não passou a opção, e seria major. Se a produção e uma segunda AC mostrarem que completar deve ser o comportamento normal, o caminho é um modo novo (um valor novo da opção, ou uma opção nova), em minor.

### 8. Pré-1.0 hoje

Enquanto um pacote estiver em 0.x, minor pode quebrar, com três obrigações: changeset `minor` no pacote e no guarda-chuva (`docs/release.md`), a quebra descrita no `CHANGELOG.md` com a tabela do que era e do que ficou (como a da 0.2.0), e a mesma descrição na documentação embarcada da versão. Patch nunca quebra, em 0.x ou depois. As regras das seções 2 a 7 já valem em 0.x como descrição do que cada mudança é; o que muda na 1.0 é que a quebra passa a exigir major.

### 9. Critério para declarar um pacote 1.0

Um pacote sai 1.0 quando as três condições valem:

1. nenhuma quebra conhecida, que dependa só de nós, está aberta para ele (as do inventário da API, revistas em 01/10/2026);
2. a parte que ainda depende de decisão aberta ou de norma está num subpath experimental, ou o pacote espera;
3. o caminho que ele cobre já foi exercitado onde importa (SEFAZ de homologação, ou produção pelo integrador em produção) no ponto em que uma descoberta mudaria a API.

O guarda-chuva `sinete` sai 1.0 por último: ele sobe junto com os pacotes que cobre (seção "O guarda-chuva" de `docs/release.md`), então uma quebra em minor de um pacote ainda em 0.x seria major do `sinete`. Ele espera todos os pacotes cobertos em 1.x, com os subpaths experimentais marcados.

Estado na data deste ADR, para depois do 0.3.0:

| Pacote | Estado | O que falta |
|---|---|---|
| `@sinete/validators` | pode sair 1.0 | nada; o modelo 59 é aditivo |
| `@sinete/rejeicoes` | pode sair 1.0 | nada; o catálogo é dado (seção 3) e `orientacao` entrou opcional |
| `@sinete/core` (`.` e `./xml`) | pode sair 1.0 | nada; o `tipo` do `ResultadoSefaz` está em português desde a 0.2.0 |
| `@sinete/da` | pode sair 1.0 | nada; `ErroDa` resolvido na 0.2.0, o resto é visual ou aditivo |
| `@sinete/cert` | pode sair 1.0 | nada além da seção 7, que fixa o padrão do `completarCadeia` |
| `@sinete/schemas` | pode sair 1.0 | nada além da seção 4; o motor de regex mais estrito que a spec, se vier de homologação, é mudança de validação com changeset |
| `@sinete/transport` | raiz pode sair 1.0 com `./signer` experimental | o ADR 0014 para o `./signer` |
| `@sinete/ibs-cbs` | espera | a norma da base de cálculo do IBS/CBS |
| `@sinete/nfe` | pode sair 1.0 com `./ibs-cbs` experimental | depois do 0.3.0 (caminho e `origem` das ocorrências da entrada) |
| `@sinete/ibs-cbs-dados` | sem 1.0 | segue a seção 6 |
| `@sinete/mdfe` | espera | resposta do WSDL confirmada na SEFAZ real; o modal além do rodoviário é aditivo |
| `@sinete/nfse` | espera | emissão por tomador e o resolvedor revisto no 0.3.0 exercitados na Sefin real |
| `@sinete/emissor` | espera | depois do 0.3.0 (`signal`, perfil no `./perfil` experimental), um segundo integrador, ou um ciclo de minors sem contorno novo |
| `@sinete/sefaz-sim`, `@sinete/cli` | ferramentas | a versão acompanha, sem a garantia da seção 1 |
| `sinete` | por último | todos os pacotes cobertos em 1.x |

## Consequências

- O changeset de um PR que muda `code`, `caminho`, `origem` ou caso de união diz isso em linhas próprias, com o antes e o depois; `docs/release.md` resume a regra para quem escreve o changeset.
- O guia mostra `switch` com `default` sobre desfechos e resoluções; o `default` dos exemplos é o tratamento conservador do contexto.
- Os READMEs do `@sinete/transport` e do `@sinete/nfe` ganham a seção "Experimental" e os módulos `signer` e `ibs-cbs`, o `@experimental`, junto com este ADR; o `@sinete/emissor/perfil` nasce assim no 0.3.0.
- PL não sai em minor; a primeira data em que a pergunta fica concreta é 03/11/2026, e a resposta já está aqui: o `PL_010e` fica.
- Declarar um pacote 1.0 é um PR com changeset `major` (de `0.x` para `1.0.0`) e a linha do pacote nesta tabela atualizada por uma emenda datada no cabeçalho.

## Pendências

- ~~Faixa de dependência do `@sinete/ibs-cbs-dados`~~: resolvida em 01/out/2026 com a faixa aberta (`>=2026.9.2`) e a conferência do formato pelo motor (seção 6).
