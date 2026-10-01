# ADR 0008: critérios de divisão de pacotes e a reorganização de 26/set/2026

- Status: aceito
- Data: 26/set/2026
- Complementa o [ADR 0001](0001-tooling-monorepo.md), que decide formato de pacote, build e release, mas não quando algo vira pacote.

## Contexto

O repositório chegou a 19 diretórios em `packages/`: 18 pacotes publicáveis e o marcador `signer-contract`. Cinco eram o IBS/CBS (`rtc-data`, `rtc-rates`, `rtc-engine`, `rtc-rules`, `rtc-determine`), sempre usados juntos; `xml` era uma dependência de todo pacote de documento sem público próprio; `danfe` juntava num índice só o DANFE, o DANFE NFC-e, o DAMDFE e o DACCE. Cada pacote a mais custa uma versão para coordenar, um trusted publisher no npm, um changelog, uma linha no `package.json` de quem usa e mais uma chance de duas versões incompatíveis no mesmo `node_modules`.

Nada estava publicado no npm e o único consumidor é o integrador em produção, então renomear e juntar não quebra ninguém. É o momento mais barato para fixar a regra.

## Critérios

Um pacote separado só existe quando pelo menos um destes vale. Sem nenhum, a parte vira subpath de um pacote existente.

1. **Dependência pesada.** A parte traz uma dependência de runtime ou um volume de dados que parte dos usuários não quer carregar: `node-forge` no `@sinete/cert`, `fflate` no `@sinete/da`, os ~2 MB de JSON do dataset no `@sinete/ibs-cbs-dados`.
2. **Ritmo de release diferente.** A parte muda por um motivo que não é o código dos vizinhos: o dataset do IBS/CBS muda com a Calculadora da RFB e é versionado pelo mês dos dados (`AAAA.M.patch`); o catálogo de rejeições muda com o MOC e as NT.
3. **Runtime diferente.** A parte só roda, ou só faz sentido, num runtime: a CLI é só Node, o transporte tem entradas por condição (`node`, Deno, browser), o simulador da SEFAZ é ferramenta de teste.
4. **Uso avulso com público próprio.** Alguém instala só essa parte, sem o resto: um ERP que só valida CNPJ e IE, um PDV que só calcula IBS/CBS, um sistema que só imprime DANFE de notas recebidas.

O [ADR 0010](0010-fronteira-emissor.md) acrescenta o critério 5, camada que compõe vários pacotes de documento, para o `@sinete/emissor`.

Reduzir bundle não é critério de pacote. O que decide o que vai para o bundle é o subpath: cada subpath é uma entrada do `exports`, sai do mesmo build com `splitting: true` (ADR 0001), e o `sideEffects: false` deixa o bundler cortar o resto. Dentro de um pacote, uma classe de erro é uma só por qualquer subpath; entre pacotes, depende de o `node_modules` não ter duas cópias.

## Decisões

### 1. IBS/CBS: `@sinete/ibs-cbs` e `@sinete/ibs-cbs-dados`

`rtc-rates`, `rtc-engine`, `rtc-rules` e `rtc-determine` viram um pacote, `@sinete/ibs-cbs`, com a raiz reexportando tudo e um subpath por parte, nomeado pelo que faz: `/aliquotas`, `/calcular`, `/validar` e `/determinar`. Nenhum critério separava as quatro: têm o mesmo público, o mesmo ritmo, nenhuma dependência pesada, e se usam juntas (o cálculo precisa das alíquotas; a determinação usa as tabelas das regras e monta a entrada do cálculo; as regras conferem a saída do cálculo). As alíquotas mudam por lei, com ritmo diferente do motor, mas são uma tabela pequena que muda raramente e sempre exige código junto; o ritmo que justifica pacote é o do dataset.

`rtc-data` vira `@sinete/ibs-cbs-dados`, separado pelos critérios 1 e 2: é o volume de dados, é versionado pelo mês dos dados, e pode ser trocado em runtime por um bundle de outra origem (`loadDataset` depois de `verifyDataset`). O subpath `./bundled` continua separado da raiz, para quem carrega dados de fora não levar o JSON, e a NF-e continua importando-o por `import()` dinâmico na primeira nota classificada.

**Por que o IBS/CBS não mora dentro do `@sinete/nfe`.** O motor é agnóstico de documento: recebe uma operação classificada e devolve os grupos `IBSCBS` e `IBSCBSTot`, que o CT-e, a NFCom, a NFS-e e os outros DF-e da reforma também levam (critério 4, reuso por outros documentos). E tem público avulso: ERP e PDV que classificam itens, simulam carga tributária ou conferem nota recebida, sem emitir NF-e (critério 4). Dentro do `@sinete/nfe`, o CT-e dependeria do pacote da NF-e para calcular um tributo, e o ERP instalaria a emissão da NF-e para simular uma alíquota. A cola específica da NF-e (local da operação, base, conversão para o leiaute) continua em `packages/nfe/src/rtc.ts`.

**Quem emite NF-e não importa o `@sinete/ibs-cbs`.** O `@sinete/nfe` calcula por padrão (`ibsCbsCalculator`) e ganha o subpath `@sinete/nfe/ibs-cbs`, que reexporta o motor inteiro e o leitor do dataset. É subpath, e não a raiz do `@sinete/nfe`, porque os dois pacotes exportam nomes iguais com significados próprios (`Decimal`, `dec`, `sum`, `RoundingMode`).

Nos identificadores públicos, o prefixo `rtc` sai: `IbsCbsDataset`, `IbsCbsDataError`, `IbsCbsDataErrorCode`, `ibsCbsCalculator`, `IbsCbsCalculatorOptions`, e os códigos de erro `rtc_*` viram `ibscbs_*` com o mesmo significado (o `@sinete/nfe` já usava `ibscbs_*` nas próprias ocorrências). O ADR 0007 mantém o nome do arquivo e os nomes da época do spike, com uma nota. Ferramentas e workflow acompanham: `tools/ibs-cbs-dados`, `tools/ibs-cbs-oraculo`, `.github/workflows/ibs-cbs-oraculo.yml`, `SINETE_IBS_CBS_CACHE`.

### 2. Documentos auxiliares: `@sinete/da`, um subpath por documento

`@sinete/danfe` vira `@sinete/da` com `/nfe` (DANFE retrato, paisagem, Simplificado, Etiqueta e Tipo 2), `/nfce` (DANFC-e), `/mdfe` (DAMDFE) e `/cce` (DACCe), e a raiz fica com o comum: `toPdf`, `toHtml`, `toSvg`, o modelo `Doc`, `DanfeError` e os códigos de barras. Continua um pacote só porque os documentos compartilham o escritor de PDF, as métricas das fontes, o CODE-128 e o QR Code, e uma versão só garante que o DANFE e o DAMDFE saem do mesmo renderizador. Continua separado do `@sinete/nfe` e do `@sinete/mdfe` pelos critérios 1 (`fflate`) e 4 (imprimir DANFE de nota recebida, sem emitir). O nome curto cobre o DACTE e o DANFSe local quando chegarem, sem mais um pacote.

O `danfe` de `/nfe` continua aceitando a NFC-e: a bobina já está lá por causa do Tipo 2, então isso não custa nada ao bundle, e quem imprime os dois modelos segue com uma chamada. O `/nfce` existe para o PDV que só imprime NFC-e. Para que um subpath não leve os dados de outro, `data/leiaute.ts` foi dividido em comum, A4, bobina e MDF-e.

Medido (Bun 1.4.2, `Bun.build --target=browser --minify`, pacotes publicados dentro do bundle, 26/set/2026):

| Import | Tamanho | gzip | Marcas da NF-e no bundle |
|---|---|---|---|
| `damdfe` de `@sinete/da/mdfe` | 89,6 KB | 32,6 KB | nenhuma |
| `danfe` de `@sinete/da/nfe` | 164,0 KB | 49,9 KB | layout A4, Simplificado, bobina e schema PL_010f |
| antes: `damdfe` da raiz do `@sinete/danfe` | 89,6 KB | 32,6 KB | nenhuma |

A tabela mostra o que o subpath resolve e o que não resolve. Um bundler com tree shaking já cortava o layout da NF-e de quem importava só o `damdfe` da raiz antiga, porque o pacote tem `sideEffects: false`; o bundle ficou igual. O ganho está onde não há tree shaking: no Node, que carrega o grafo inteiro da entrada (importar a raiz antiga levava 30 a 36 ms e 6,5 MB de heap; `@sinete/da/mdfe`, 19 a 25 ms e 5,5 MB), no Deno, no `import` direto de CDN no browser e em bundlers que não confiam no `sideEffects`. E a garantia deixa de depender do bundler: `test/subpaths.test.ts` confere no fonte que cada entrada só contém as marcas do próprio documento, e a smoke confere o mesmo no pacote publicado.

### 3. `@sinete/xml` vira `@sinete/core/xml`

Nenhum critério valia: sem dependência (o core continua sem dependências), mesmo ritmo, mesmo runtime, e todo pacote de documento usa. Público avulso existe em tese (quem quer XMLDSig no perfil dos DF-e sem o resto), mas esse público já instala o core, que tem zero dependências. Como subpath, o `XmlError` sai do mesmo build que o `SineteError`, sem risco de duas cópias do core.

### 4. `signer-contract` vai para `docs/signer-contract/`

É especificação de protocolo (schema e fixtures do NDJSON entre o cliente TS e o helper Go), sem código para publicar. Quem consome o contrato são o helper e o cliente, os dois neste repositório.

### 5. Guarda-chuva `sinete`

Um pacote sem escopo, `sinete` (o marcador `sinete@0.0.0` já está no npm), só com subpaths: `sinete/<pacote>[/<subpath>]` reexporta `@sinete/<pacote>[/<subpath>]`. Serve a quem prefere uma dependência só.

- **Sem entrada raiz.** Um índice com tudo puxaria o dataset do IBS/CBS, os schemas e os layouts em runtimes sem tree shaking, e os nomes colidem entre pacotes (`Decimal`, `validate`). `import 'sinete'` não resolve de propósito; a smoke confere.
- **Versões fixadas.** As dependências são `workspace:*`, que o `bun pm pack` troca pela versão exata, e o `scripts/release.ts` barra o tarball que não levar exatamente a versão atual. Uma versão do `sinete` é um conjunto que passou junto pela smoke. O changesets sobe o guarda-chuva em patch sozinho quando um pacote dele sobe; minor e major pedem changeset do `sinete` no mesmo nível (`docs/release.md`).
- **O bin `sinete`** é a CLI do `@sinete/cli`, pelo subpath novo `@sinete/cli/bin`. Quem instala o `sinete` e o `@sinete/cli` no mesmo projeto fica com um só link em `node_modules/.bin` (o npm não falha, medido com npm 11), e os dois são a mesma CLI.
- **Fora:** o `@sinete/sefaz-sim` (ferramenta de teste, não deve entrar na instalação de produção) e o `runDoctor` programático, que continua no `@sinete/cli`.
- **Gerado.** `scripts/umbrella.ts` escreve o `package.json` e os módulos de `src/` a partir do `exports` dos pacotes cobertos; `bun run check` roda com `--check` e falha fora de sincronia. A fixture da smoke precisa citar todo subpath publicado. O guarda-chuva fica fora do lint do JSR, que exige escopo.

## Resultado

| Pacote | Critério | Subpaths |
|---|---|---|
| `@sinete/core` | base de todos, sem dependências | `/xml` |
| `@sinete/schemas` | código gerado grande, ritmo dos PL e das NT | um por schema e PL |
| `@sinete/cert` | 1 (`node-forge`) e 4 | |
| `@sinete/transport` | 3 (condição `node`, Deno, browser) | |
| `@sinete/validators` | 4 | |
| `@sinete/rejeicoes` | 2 e 4 | `/mdfe`, `/nfse` |
| `@sinete/nfe` | 4, ritmo das NT da NF-e | `/ibs-cbs` |
| `@sinete/mdfe` | 4, ritmo das NT do MDF-e | |
| `@sinete/nfse` | 4, ritmo da NFS-e Nacional | |
| `@sinete/ibs-cbs` | 4 (outros DF-e, ERP, PDV) | `/aliquotas`, `/calcular`, `/validar`, `/determinar` |
| `@sinete/ibs-cbs-dados` | 1 e 2 | `/bundled` |
| `@sinete/da` | 1 (`fflate`) e 4 | `/nfe`, `/nfce`, `/mdfe`, `/cce` |
| `@sinete/cli` | 3 (Node, `bin`) | `/bin` |
| `@sinete/sefaz-sim` | 3 (ferramenta de teste) | |
| `sinete` | guarda-chuva | um por subpath acima, sem raiz |

São doze bibliotecas, as duas ferramentas e o guarda-chuva.

## Consequências

- Mapa de imports para quem usava os nomes antigos: `@sinete/xml` → `@sinete/core/xml`; `@sinete/rtc-data` → `@sinete/ibs-cbs-dados`; `@sinete/rtc-rates`, `rtc-engine`, `rtc-rules`, `rtc-determine` → `@sinete/ibs-cbs/aliquotas`, `/calcular`, `/validar`, `/determinar` (ou a raiz, ou `@sinete/nfe/ibs-cbs`); `@sinete/danfe` → `@sinete/da/nfe`, `/nfce`, `/mdfe`, `/cce` para as funções e `@sinete/da` para o comum. Quem trata erro pelo `code` troca `rtc_*` por `ibscbs_*`.
- Parte nova vira subpath por padrão; pacote novo precisa citar o critério no PR.
- O guarda-chuva cresce sozinho com os `exports` dos pacotes cobertos; pacote novo entra na lista de `scripts/umbrella.ts` e na fixture da smoke.
- A tag `sinete@<versão>` também dispara o job de release, e o `sinete` precisa de trusted publisher próprio no npm.

## Pendências

- Medir o ganho do subpath no Deno e no `import` de CDN no browser, que é onde ele aparece (a tabela acima só mediu o Node e um bundler com tree shaking).
- Decidir se o `DanfeError` ganha um nome neutro (`DaError`) antes da 1.0, agora que o pacote cobre o DAMDFE e o DACCe. *Revisão (01/10/2026): resolvida na 0.2.0, já com os nomes do [ADR 0015](0015-nomes-em-portugues.md): `ErroDa` e `CodigoErroDa` (`packages/da/src/errors.ts`, tabela no `packages/da/CHANGELOG.md`).*
