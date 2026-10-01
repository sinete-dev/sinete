# 0007. Dados RTC versionados e oráculo diferencial a partir da Calculadora offline

Status: aceita (spike S7, 25/set/2026; implementada no M1, 26/set/2026). O código do spike em `spikes/s7-calculadora/` é referência descartável; o que vale está em `tools/ibs-cbs-dados`, `tools/ibs-cbs-oraculo`, `packages/ibs-cbs` e `packages/ibs-cbs-dados` (seção "Implementação" no fim).

Revisão de 01/out/2026 (V0059): o `codigo-fonte-backend.zip` da V0058 em diante não publica mais as migrações Flyway e traz o próprio `calculadora-pro.db`, igual ao do rootfs. A decisão 3 (dois caminhos independentes) só vale até a V0057; daí em diante o segundo caminho confere os dois arquivos publicados entre si (`segundoCaminho` em `tools/ibs-cbs-dados/sources.json`), Perde-se a verificação de que a base distribuída é a que as migrações publicadas geram; continua a conferência do extrator contra a API `dados-abertos` do contêiner, feita pelo oráculo, que lê a mesma base.

Revisão de 26/set/2026 (ADR 0008): os pacotes `rtc-data`, `rtc-rates`, `rtc-engine`, `rtc-rules` e `rtc-determine` viraram `@sinete/ibs-cbs-dados` e `@sinete/ibs-cbs` (subpaths `/aliquotas`, `/calcular`, `/validar` e `/determinar`), e os códigos de erro `rtc_*` viraram `ibscbs_*`. O texto do spike abaixo mantém os nomes da época.

## Contexto

O desenho de IBS/CBS (`~/.local/state/novo-dfe/research/ibscbs-design.md`) propõe um pacote `rtc-data` só com dados oficiais versionados e um motor `rtc-engine` puro, testado contra a Calculadora de Tributos da RFB como oráculo. Duas perguntas abertas: se o módulo offline dá para rodar localmente fixado por hash, e se ele serve ao mesmo tempo de fonte reproduzível do dataset e de oráculo. O FAQ da Calculadora (v1.4, itens 3.1 a 3.4) diz que não há API pública de integração e que o caminho oficial é o módulo offline.

Ambiente: macOS arm64, Docker Desktop, Bun 1.4.2, sqlite3 do sistema.

## O que o artefato oficial é, de fato

- Página: `piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/calculadora-offline` (SPA Angular). O botão chama `GET /api/calculadora/download/url?platform=default`, que devolve `https://obs-13820-calcpr-apr.obsv3.br-df-1.hcs.serpro.gov.br/calculadora.zip` (bucket OBS do Serpro, sem autenticação).
- `calculadora.zip`: 346.174.581 bytes, Last-Modified 10/09/2026, sha256 `f451c390...cb68e`. Hashes de tudo em `spikes/s7-calculadora/pin.json`.
- Conteúdo: `calculadora.tar.gz` (rootfs, não imagem OCI), **`codigo-fonte-backend.zip` e `codigo-fonte-simples-nacional.zip`** (Java 21, Spring Boot 3.5.7, com as migrações Flyway), `scripts-python-exemplo.zip`, scripts de instalação para Linux e Windows (WSL).
- O rootfs é Alpine 3.24.1 x86_64 com Temurin 21.0.12 (musl), três JARs (`api-regime-geral` na 8080, `api-split-payment-simplificado` na 8081, `api-simples-nacional` na 8082), nginx com a UI na 80, e o banco `calculadora/calculadora/db/calculadora-pro.db` (SQLite, 4,7 MB, aberto `mode=ro`).
- Instala com `docker import` (não `docker load`). Por isso **não existe digest de registry**: o Image ID muda a cada import (campo `created`). O que é estável é o `diff_id` da camada, que é o sha256 do tar descomprimido (`sha256:36c2a33a...ee6b`, conferido). Fixação correta: sha256 do zip + diff_id da camada + sha256 do `.db`.
- Versão: `/dados-abertos/versao` no offline devolve `versaoDb V0057` (03/09/2026, "Remoção de alíquotas da monofasia") e `versaoApp` igual ao nome de um branch (`demanda-5451861-cofis-43411-delete-aliquotas-ficticias`); a online devolve a mesma `V0057` com `versaoApp 1.5.1-b9fa97a7`. O próprio `/versao/status` do offline admite `aplicacaoAtualizada: false`. Ou seja, a base de dados é a mesma, o build do app não.
- Execução medida: `docker run -d --name sinete-s7-calc --platform linux/amd64 -p 127.0.0.1:18080:8080 ... -w /calculadora <img> bash start.sh`. API respondendo em 23 s sob emulação amd64 no Mac; 1,5 a 1,7 GiB de RAM com as três JVMs e 200 threads; imagem importada com 908 MB. Throughput sequencial do harness: 400 operações em 16,6 s (cerca de 40 ms por chamada, emulado). Não testei rodar só o `api-regime-geral.jar` numa JVM arm64 nativa, que deve cortar memória e tempo.
- Chamada de saída: só `/versao/status` consulta a online (`VERSAO_OFFLINE_URL`, padrão `consumo.tributos.gov.br/.../versao`). Nada no caminho de cálculo ou de dados abertos sai para a rede. Em CI, apontar a variável para um endereço inválido.
- Cuidados: o `3-desinstalar.sh` oficial faz `docker rm -vf $(docker ps -aq --filter name=calculadora)` e `docker rmi` por `reference=calculadora*`, que atinge qualquer contêiner ou imagem de outro projeto com "calculadora" no nome. O `2-executar.sh` publica a porta 80 do host. Não usar os scripts oficiais; subir com nome e portas próprios.

### Licença e termos

Não há arquivo LICENSE, NOTICE nem cabeçalho de licença no zip, nos fontes ou no `pom.xml`, e não achei termos de uso na página. O FAQ diz que "todo o código-fonte da Calculadora está disponível publicamente, podendo ser livremente utilizado e adaptado pelas empresas" (itens 3.1, 3.2, 4.3), o que é uma declaração de política, não uma licença. Consequência para o projeto: não redistribuir o zip, a imagem nem os JARs (que também embarcam dependências de terceiros com licenças próprias); o CI baixa da URL oficial e confere o sha256. O dataset `rtc-data` contém fatos normativos extraídos de tabelas públicas do governo, com proveniência explícita; isso é o que publicamos.

## Mapa da API (OpenAPI em `/api/api-docs`)

A API do offline é idêntica à da online, exceto pelo `/versao/status` a mais (diff dos dois OpenAPI: só `VersaoOfflineOutput`). Para cada necessidade:

| Necessidade | Endpoint | Observação |
|---|---|---|
| cClassTrib com semântica | `GET /dados-abertos/classificacoes-tributarias/cbs-ibs?data=` e `/cbs-ibs/class-trib/{c}` | tipoAliquota, nomenclatura, pRed por tributo, flags de crédito, DF-e aceitos, tpRBSN. **Sem vigência, sem ind_gCredPresOper, gMono*, gEstornoCred, anexo** |
| Validade por DF-e | `GET /classificacoes-tributarias/cbs-ibs/{siglaDfe}/{c}` | exigeGrupoTributacaoRegular, permiteDiferimento, possibilidadeCreditoPresumido (derivados de TRTR_IN_EXIGE_GRUPO_DESONERACAO, SITR_IND_GDIF, CLTR_IND_GCREDPRESOPER) |
| CST | `GET /situacoes-tributarias/cbs-ibs?data=&siglaDfe=` | só código, descrição e cClassTrib aninhados. **Os indicadores de grupo da CST (gIBSCBS, gRed, gDif, gTransfCred, gCredPresIBSZFM, gAjusteCompet) não saem na API** |
| NCM aplicável | `GET /classificacoes-tributarias/ncm-aplicavel?cClassTrib=&ncm=&dataOcorrenciaFatoGerador=` | só par a par; não há lista |
| NBS aplicável | `GET /nbs-aplicaveis?cClassTrib=&data=`, `/nbs-aplicavel`, `/nfse/situacoes-classificacoes-tributarias?nbs=` | |
| Alíquotas | `GET /aliquota-uniao`, `/aliquota-uf?codigoUf=`, `/aliquota-municipio?codigoMunicipio=` | 2026 = referência (CBS 0,9, IBS UF 0,1, Mun 0). Tabela ALIQUOTA_PADRAO por ente está vazia; 2027+ dá 404 |
| Reduções, redutor, transferências | `pRed` no cClassTrib; `/redutores-compra-governamental`; `/transferencias-cbs`, `/transferencias-ibs` | |
| Atores | `/ator/grupos`, `/classificacoes-tributarias/cbs-ibs/por-atores` | |
| Cálculo regime geral | `POST /calculadora/regime-geral` | resposta já no formato dos grupos do XML (ROC) |
| XML | `GET /xml/generate` lista tipos; `POST /xml/generate?tipo=nfe` recebe o ROC; `POST /xml/validate` | NF-e/NFC-e em **NT v1.36**, CT-e/BP-e em v1.14a. A NT vigente da NF-e é v1.51, então o XML gerado não serve de referência de leiaute |
| Simples Nacional | API separada na 8082 (`/calculadora/simples-nacional/atividades`) | fora do regime geral |

### Offline x online

Seis consultas de amostra (versão, lista de cClassTrib na data, CST por NF-e, alíquota da União, NCM aplicável, filtro por atores) devolveram respostas idênticas, ignorando `ambiente` e `versaoApp`. Não comparei `regime-geral` offline x online, para não usar a online como serviço de cálculo.

## Achado que muda o desenho do extrator

A API `dados-abertos` é uma projeção com perdas das tabelas: sem vigência (`dIniVig`/`dFimVig`), sem os indicadores de grupo da CST e parte dos da cClassTrib, sem lista de NCM aplicável. Reconstruir vigências por varredura de datas na API seria aproximado (granularidade da grade) e ainda não traria os indicadores. O SQLite embarcado tem tudo, com vigência explícita, e é pequeno.

Mais forte: **o SQLite é reconstruível a partir do código-fonte publicado no mesmo zip**. `scripts/rebuild-db.sh` aplica `beforeMigrate.sql` + `B0001` + `V0002..V00NN` com o sqlite3 do sistema. Para V0057, as 53 tabelas de conteúdo ficam idênticas às do `.db` embarcado (comparação por hash das linhas ordenadas, `scripts/dbcompare.sh`); só as datas de build em `VERSAO_BASE_DADO` diferem. Dois detalhes descobertos no caminho: o `.db` distribuído foi gerado **sem** o `afterMigrate-pro.sql` (que zeraria alíquotas de IS fictícias; o offline carrega IS ad valorem como 5,27%, 9,78% etc. a partir de 2027), e é preciso desligar a checagem de FK durante a reconstrução (o Flyway roda cada migração em transação, onde `PRAGMA foreign_keys` é ignorado). Isso também dá, de graça, qualquer versão anterior da base (V0056 etc.) para diff e regressão.

As regras de cálculo também são dados: `TRATAMENTO_TRIBUTARIO` tem 43 tratamentos com expressões (`aliquota*(1-percentualReducao)*(1-pRedutorCompraGov/100)`, `baseCalculo*aliquotaEfetiva`, diferimento `tributoCalculado*1.00`...), avaliadas em JEXL com BigDecimal, 8 casas internas e **HALF_EVEN** no fim de cada expressão e na serialização (`ArredondamentoUtils`, citando LC 214 art. 349 §14).

## Decisão

1. **Fonte do `rtc-data`: o SQLite do artefato oficial fixado por hash**, extraído por `src/extract.ts` para JSON normalizado (chaves ordenadas, decimais como string, sem timestamp dentro das tabelas) com `manifest.json` (fonte, versaoDb, dataVersaoDb, versaoApp, URL, sha256 do zip, do tar.gz e do `.db`, diff_id, sha256 e contagem por arquivo). A data de coleta vai em `collected.json`, fora do hash. Tabelas da v1 do schema: `cst`, `classTrib` (com tratamentos, reduções, alíquotas fixas, DF-e e fundamentação, todos com vigência), `treatments` (expressões), `rates`, `ncmApplicability`, `nbsApplicability`, `nfseNbsClassTrib`, `actors`, `dfeTypes`.
2. **A API do container vira verificação cruzada**, não fonte: `src/crosscheck.ts` projeta o dataset em sete datas de 2026 a 2033 e compara com a API. Resultado: 0 divergências em cClassTrib (164 códigos em 01/01/2026, 161 depois) e CST em todas as datas.
3. **Build reproduzível do dataset por dois caminhos independentes**: SQLite embarcado e SQLite reconstruído das migrações Flyway produzem o mesmo `datasetSha256` (`75d1fbbb...`, e extrações repetidas também). No CI, os dois caminhos rodam e a divergência falha o build.
4. **Oráculo: o mesmo container, fixado**, com o harness diferencial e um ledger de divergências conhecidas versionado.
5. **A online só é usada para detectar versão nova** (`/dados-abertos/versao`, uma chamada por dia) e para a URL de download. Nenhuma dependência de produção nem de CI na online.

## Evidência do harness (`src/oracle/`)

- Gerador determinístico (seed) de operações válidas pelo próprio dataset: cClassTrib vigente e habilitado para o modelo (NF-e 55 ou NFS-e 91), NCM que passa na regra de aplicabilidade, NBS do vínculo NFS-e (`nfseNbsClassTrib`), sem NCM sujeito a IS em 2027+, alíquotas nominais informadas em 2027 e 2028, 30% das bases em bordas de meio centavo, 5% com compra governamental. Pesos maiores para os códigos de produtor rural (000001, 200003, 200014, 200034, 200036, 200038, 410001, 410002, 410004, 410014, 510001, 515001, 550001) e de serviços (011001, 200029, 200040, 200043, 410027, 410999).
- `calculate()` ingênuo (`engine.ts`): avalia as expressões do `treatments` com ponto fixo BigInt, 8 casas HALF_EVEN por expressão, e aplica os indicadores da CST. Não trata monofasia, ajustes, tributação regular, alíquota uniforme setorial nem compra governamental.
- Regra de aplicabilidade NCM reimplementada a partir do dataset (`applicableNcm`, espelhando a tabela-verdade de `NcmAplicavelService`: exceção vigente só é superada por outro vínculo vigente sem nenhuma exceção vigente): **3.000 de 3.000** pares concordam com `/ncm-aplicavel`. Primeira versão errou 20 por um problema de schema: há códigos cClassTrib iguais nas famílias CBS/IBS e IS, e a chave precisa da família.

Resultado, 2 seeds de 400 operações (800 no total):

| | Seed 7 | Seed 99 |
|---|---|---|
| Recusadas pelo oráculo, previstas no ledger (8xx e 620 "não implementado") | 15 | 10 |
| Recusadas fora do ledger | 0 | 2 (NBS fora do anexo: o gerador não aplica ainda a regra de `nbsApplicability` na NFS-e) |
| Fora do escopo do motor ingênuo (tributação regular, uniforme setorial) | 35 | 50 |
| Comparadas | 350 | 338 |
| Concordância, tolerância 0,01 | 345 (98,6%) | 334 (98,8%) |
| Divergências não explicadas pelo ledger | 0 | 0 |
| Igualdade exata ao centavo, motor HALF_EVEN | 345 | 334 |
| Igualdade exata ao centavo, variante HALF_UP | 330 | 317 |

Todas as operações divergentes têm compra governamental: com `gCompraGov` a Calculadora emite `gRed` com `pRedAliq 0` mesmo em CST sem gRed e, em 2027 e 2028, zera o IBS e soma os 0,1 ponto percentual à CBS (ex.: CBS nominal 9,25 com redução de 60% sai com efetiva 3,74 = 9,35 x 0,4). Essa regra está em Java, não no banco. Sem compra governamental, a concordância é 100%.

A diferença entre HALF_UP e HALF_EVEN (5% das operações) é invisível com a tolerância de 0,01 da NT. O harness precisa das duas medidas: tolerância 0,01 para conformidade e igualdade exata para detectar regressão de arredondamento.

## Ledger de divergências conhecidas

`src/oracle/ledger.json`, versionado junto do teste e amarrado à versão do oráculo (versaoDb e sha256 do zip). Cada entrada tem `id`, `kind` (engine-gap, oracle-refuses, oracle-trust, oracle-gap), um `match` (campo, cClassTrib, compra governamental, texto de erro do oráculo), motivo, fonte e `expectHits`. Regras: divergência fora do ledger falha; entrada com `expectHits` que não disparou falha (força limpeza quando o oráculo ou o motor mudam). Entradas atuais: compra governamental (regra em código), 8xx e 620 recusados pelo oráculo, IBS em NF-e não validado pelo CGIBS (FAQ 2.1: concordância não prova correção, o segundo oráculo são as RV da NT e a homologação SEFAZ), crédito presumido fora da entrada do `/regime-geral` (sem cCredPres, FAQ 4.2), Simples numa API separada. Monofasia já aparece como recusa desde V0057 (alíquotas removidas).

## Diff entre versões

`src/diff.ts` compara dois datasets por `key` estável (família, código, início de vigência), com caminho de cada campo alterado e classificação da mudança (fim de vigência, início de vigência alterado, indicador de grupo, DF-e, redução/alíquota, expressão de cálculo, texto). Com a V0056 reconstruída das migrações, o diff V0056 para V0057 dá exatamente o que a descrição oficial diz: 18 alíquotas ad rem de monofasia removidas (CBS, IBS UF e IBS Mun para 6 NCM de combustíveis), nenhuma outra tabela alterada. Esse relatório é o corpo do PR de atualização do pacote.

## Consequências

- O extrator lê um schema interno do Serpro, que pode mudar sem aviso. Mitigação: o crosscheck contra a API em várias datas e o build pelos dois caminhos (embarcado e Flyway) quebram na hora, e o schema do nosso JSON é versionado (`dataSchemaVersion`).
- Os valores vêm de colunas `REAL` do SQLite; convertemos pela menor representação decimal do double. Para percentuais com até 4 casas isso é exato na prática; um valor que não caiba vira divergência no crosscheck.
- A imagem é amd64: em Mac arm64 roda emulada (23 s de subida, cerca de 40 ms por chamada). Suficiente para CI e para centenas de milhares de consultas locais. Rodar só o JAR do regime geral numa JVM nativa é a otimização óbvia, não testada.
- O oráculo é um build de branch (`versaoApp` diferente da online) sobre a mesma base. O harness registra `versaoApp` no manifest e trata troca de build como troca de oráculo.
- O XML gerado pela Calculadora está em NT v1.36; a comparação de leiaute fica desligada por gate de versão, como já previa o desenho.
- Regras que vivem em código na Calculadora e não em dado (compra governamental 2027/2028, exceções como o 510001 tratado como "Padrão", o `aliquotaInformada` prevalecendo sobre expressões fixas) precisam ser reimplementadas no `rtc-engine` com fonte legal, e são exatamente o que o harness vai apontar.

## Pendências técnicas

- Aplicar a regra de `nbsApplicability` no gerador e reimplementar `applicable()` para NBS (2 recusas em 800).
- Cobrir tributação regular (gTribRegular) e compra governamental no motor, tirando as entradas do ledger.
- Medir a JVM nativa arm64 só com o `api-regime-geral.jar`.
- Juntar a tabela do IT 2025.002 (planilha) ao dataset e falhar o build em conflito IT x Calculadora, como no desenho §1.2.

## Implementação (M1)

O que mudou do spike para o código mantido:

- **Extrator** em `tools/ibs-cbs-dados/extract.ts`, com os dois caminhos (SQLite embarcado e Flyway) e `--check`. Juntou as planilhas do IT 2025.002 v1.60 (cClassTrib e cCredPres) e do IT 2026.002 (alíquotas da CBS), também fixadas por hash; conflito IT x Calculadora fora de `tools/ibs-cbs-dados/conflicts.json` falha o build, e entrada que deixou de divergir também (20 entradas revisadas, nenhuma com efeito em cálculo ou XML). O dataset ganhou `nbsApplicability`, `annexes`, `actorGroups`, `actorClassTrib`, `govPurchaseReducer` e `cbsTransfer`, e perdeu `rates`, que foi para o `@sinete/ibs-cbs/aliquotas` (cadência de lei, não de Calculadora). Versão do pacote pelo mês dos dados (`AAAA.M.patch`). `tools/ibs-cbs-dados/diff.ts` é a linha de comando do diff semântico.
- **Aplicabilidade de NBS** reimplementada como a de NCM e conferida contra `/nbs-aplicavel` (pendência do spike resolvida).
- **Motor** em `@sinete/ibs-cbs/calcular`: tributação regular, compra governamental (redutor e redistribuição do art. 473 a partir de 2027), alíquota uniforme setorial e fixa, diferimento, devolução de tributos, crédito presumido, estorno, transferência, ajuste de competência e crédito presumido da ZFM. Monofasia, Imposto Seletivo e alíquotas combinadas lançam `UnsupportedRegimeError`. Os totais somam os valores de 2 casas (regras W da NT), não os internos.
- **Oráculo** em `tools/ibs-cbs-oraculo`: contêiner com nome único e porta livre em `127.0.0.1`, removido pelo nome; imagem conferida pelo `diff_id`; comparação campo a campo sem tolerância; conferência do dataset contra `dados-abertos` no mesmo passo. Workflow `.github/workflows/ibs-cbs-oraculo.yml` manual e semanal, fora do CI padrão. Os testes unitários usam fixtures gravadas pelo oráculo (`--record`), sintéticas.
- **Ledger** com `kind` `engine-choice` (o motor segue a NT onde a Calculadora não segue), `oracle-gap` (a Calculadora não calcula o grupo), `oracle-refuses` (a Calculadora recusa a entrada). As entradas de compra governamental do spike saíram: o motor reproduz a regra. Resultado com 800 operações (semente 11): 606 iguais, 11 recusadas pelos dois, 183 explicadas pelo ledger, 0 sem explicação; dataset sem diferença.
- **Segundo oráculo** em `@sinete/ibs-cbs/validar`: as regras da NT 2025.002 v1.51 como funções puras; o teste do pacote passa todo caso gravado do oráculo pelo motor e pelas regras.
- **Ligação com a NF-e** no próprio `@sinete/nfe` (`ibsCbsCalculator`, a calculadora padrão do `buildNfe`), não num pacote à parte. Um `@sinete/nfe-rtc` opcional chegou a existir e saiu antes de ser publicado: o grupo IBS/CBS é obrigatório (CRT 3 rejeitado sem ele desde 03/08/2026; Simples e MEI a partir de 04/01/2027), então não há emissor que dispense o motor. O custo do dataset (~2 MB de JSON) fica com quem emite: o `@sinete/nfe` o importa por `import()` dinâmico na primeira nota classificada, e bundles que só leem XML, eventos ou Distribuição DF-e não o levam (números no README do `@sinete/nfe`). A porta `IbsCbsCalculator` continua como ponto de troca, para testes e para quem calcula fora do sinete.

### Pontos em que a NT e a Calculadora não fecham

- Compra governamental a partir de 2027: a fórmula de `pAliqEfet` da NT (UB28-10, UB47-10, UB66-10) não inclui a redistribuição do art. 473 da LC 214/2025; a Calculadora e o motor incluem. O `@sinete/ibs-cbs/validar` acusa esses casos, com nota na regra.
- 200022 e 200024 (tributação regular obrigatória, CST 200 com `gRed` obrigatório): a NT exige `gRed` com o `pRedAliq` da tabela (UB26-20, UB27-10 e análogas); a Calculadora não emite o grupo fora da compra governamental e emite `pRedAliq` 0 dentro dela. O motor segue a NT (`gRed` com o percentual da tabela e alíquota efetiva zero), e a diferença está no ledger (`gred-na-tributacao-regular`).

### Alíquotas

2026 com as alíquotas de teste da LC 214/2025 (CBS 0,9%, IBS da UF 0,1%, municipal 0%). Em 2027 e 2028 o IBS da UF e o municipal são 0,05% cada, fixados na própria LC 214/2025 (art. 344), então entram como `official`; a CBS desses anos é a alíquota de referência do Senado reduzida em 0,1 ponto percentual (art. 347) e fica `unknown` até a resolução. De 2029 em diante tudo é `unknown`. Alíquota desconhecida nunca vira zero: o motor lança `RateUnknownError`, salvo alíquota informada com motivo, que marca o cálculo como simulado.
