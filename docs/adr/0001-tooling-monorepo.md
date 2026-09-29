# ADR 0001: tooling do monorepo, build e release

- Status: proposto (revisão 1)
- Data: 25/set/2026
- Spike: S0 (`spikes/s0-tooling/`, código descartável)

## Histórico de revisões

- **Revisão 0 (25/set/2026):** recomendava pnpm workspaces + tsdown + changesets, com o Bun só como runtime de teste. Motivo: era a única combinação em que `changeset publish` funcionava sem script próprio.
- **Revisão 1 (25/set/2026), esta:** o dono do projeto fixou um requisito novo: **o Bun é a runtime e a toolchain do projeto** (gerenciador de pacotes, scripts, testes, dev), e o que se publica são bundles consumíveis por Node, Deno e browsers. O pnpm saiu. Refiz a parte de publicação, build e testes sobre bun workspaces (`a-bun/` e a variante nova `a-bun-bunbuild/`). O que mudou está marcado com **[rev. 1]**. Continuam valendo as decisões de ESM puro, `engines`, formato de pacote, JSR adiado, Biome e opções de TS; a evidência da revisão 0 sobre pnpm fica abaixo como registro.

- **Complemento (26/set/2026):** os critérios de quando algo vira pacote ou subpath, a reorganização dos pacotes (IBS/CBS, documentos auxiliares, `@sinete/core/xml`) e o guarda-chuva `sinete` estão no [ADR 0008](0008-divisao-de-pacotes.md). O que este ADR decide sobre formato de pacote, build, smoke e release vale para todos eles; o guarda-chuva acrescenta a trava de versão exata no `release.ts`. Os pacotes `@sinete/xml` e `@sinete/cli` citados abaixo são os de brinquedo do spike.

## Contexto

O plano da fase 1 exige que os pacotes `@sinete/*` rodem em Node, Bun e Deno sem binário nativo, e no browser onde fizer sentido (princípio 5). O S0 precisava provar publicação com ESM e `.d.ts`, `exports` condicionais, versionamento com changelog e testes do pacote empacotado nas três runtimes. Nenhum repo da org publica pacote hoje.

Montei um monorepo de brinquedo com o formato real: `@sinete/core` (TS puro, sem deps, com o subpath `./runtime` exportando condição `node` e `default`), `@sinete/xml` (depende de core, com import só de tipo de `Clock` atravessando pacotes) e `@sinete/cli` (bin `sinete`, depende dos dois; os ranges internos usam de propósito `workspace:*`, `workspace:^` e `workspace:~`). Publiquei em verdaccios locais descartáveis (só em 127.0.0.1, storage dentro do spike, `@sinete/*` sem proxy para o npmjs) e consumi de projetos novos.

Versões medidas: node 20.20.2, 22.9.0, 22.23.3, 24.13.0 e 26.3.1 (via fnm), bun 1.4.2, deno 2.9.1, npm 11.16.0, tsdown 0.23.0 (rolldown 1.2.11), TypeScript 7.0.2, @changesets/cli 3.0.3, publint 0.3.24, @arethetypeswrong/cli 0.18.5, Biome 2.5.14, vitest 5.0.2, Playwright 1.63.0 (Chromium 153), esbuild 0.28.2, verdaccio 6.10.4. Na revisão 0 também pnpm 10.2.0 e 12.6.0.

## Opções avaliadas com evidência

### [rev. 1] Publicação a partir de bun workspaces

Duas rotas, as duas verificadas no verdaccio com `workspace:*`, `workspace:^` e `workspace:~`:

| | (a) `bun publish` por pacote | (b) `bun pm pack` + `npm publish <tgz>` |
|---|---|---|
| Reescrita de `workspace:` | sim: `@sinete/cli@0.1.2` com `^` e `~` reescritos | sim: `@sinete/cli@0.1.1` com `{"@sinete/core":"^0.2.0","@sinete/xml":"~0.1.1"}` e `@sinete/xml@0.1.1` com `"0.2.0"` |
| `--access`, `--tag`, `--dry-run` | sim (há também `--tolerate-republish`) | sim |
| Provenance | não existe flag `--provenance` no `bun publish --help` do 1.4.2 | `npm publish --provenance`, automático com trusted publishing |
| Trusted publishing (OIDC) | não: o binário do bun 1.4.2 não contém `ACTIONS_ID_TOKEN_REQUEST` nem nenhum endpoint de OIDC; só lê token (`NPM_CONFIG_TOKEN`, `_authToken`). Mesma conclusão de oven-sh/bun#22423 | sim, npm 11.5.1 ou mais novo |
| Respeita `publishConfig.registry` | **não**: o dry run mostrou `Registry: https://registry.npmjs.org/` com `publishConfig.registry` apontando para o verdaccio | sim |
| Ordem entre pacotes, pular versão já publicada | script nosso | script nosso |

O achado sobre `publishConfig.registry` saiu de um incidente do próprio spike: rodei `bun publish` confiando no `publishConfig` e o bun tentou publicar `@sinete/core@0.3.0` no npmjs com o token falso do spike. O npmjs recusou (`'@sinete/core@0.3.0' does not exist in this registry`), e conferi depois que `@sinete/core`, `@sinete/xml` e `@sinete/cli` continuam em 404 no npmjs, então nada vazou. Na prática isso significa que o `bun publish` vai para o registry padrão, a menos que se passe `--registry` ou se configure `.npmrc` ou `bunfig.toml`.

**A armadilha que vale para as duas rotas:** o bun reescreve `workspace:` com a versão gravada no `bun.lock`, não com a versão atual do `package.json`. Depois de um `changeset version` sem `bun install`, o `bun publish` publicou `@sinete/xml@0.1.2` com `"@sinete/core": "0.2.0"` quando o core já era 0.3.0 (o pacote foi para o registry apontando para a versão errada). `bun install --frozen-lockfile` não pega isso: passou com o lock desatualizado. Rodar `bun install` depois do `changeset version` resolveu (`^0.3.0` e `~0.1.2` corretos).

**Escolha: rota (b).** É a única com OIDC e provenance, que são o padrão esperado para uma lib de assinatura fiscal. O script `spikes/s0-tooling/a-bun/scripts/release.ts` (cerca de 110 linhas, roda no Bun) faz:

1. lê os workspaces do `package.json` raiz e ordena topologicamente;
2. pula pacote privado ou versão já publicada (consulta ao registry);
3. **fase 1:** `bun pm pack` de todos os pendentes e duas travas no tarball: nenhum `workspace:` restante, e todo range interno precisa aceitar a versão atual do pacote irmão (`Bun.semver.satisfies`). Com o lock velho ele abortou com `@sinete/xml@0.1.3: @sinete/core@0.3.0 no tarball não aceita a versão atual 0.4.0; rode bun install` e **não publicou nada**, nem o core, que não tinha dependências;
4. **fase 2:** `npm publish <tgz> --access public --tag <tag>`, com `--provenance` quando `GITHUB_ACTIONS=true`, e `--dry-run` repassado.

Medido: primeira execução publicou 3 pacotes; a segunda pulou os 3 (`já publicado`), então o script é idempotente e pode ser relançado depois de uma falha parcial.

### [rev. 1] Versionamento com changesets em bun workspaces

`changeset version` funciona limpo com bun workspaces: ele só lê e escreve `package.json` e `CHANGELOG.md`. Medido em 0,22 s; core minor bumpou xml e cli em patch com `updateInternalDependencies: patch`; roda também sob `bun --bun`. `changeset publish` fica **proibido** no repo, porque num repo bun ele cai no npm e publica `workspace:^` literal (medido na revisão 0: `@sinete/cli@0.5.1` quebrado). O fluxo fica:

- `bun run version` = `changeset version && bun install` (o `bun install` atualiza o `bun.lock`, que vai no mesmo commit);
- `bun run release` = `bun run build && bun scripts/release.ts && changeset git-tag`.

`changeset git-tag` não foi exercitado no spike, porque exige um commit e o spike não commita. Ele só lê versões de `package.json`, então o risco é baixo, mas fica em Pendências.

### [rev. 1] Build: tsdown sob Bun contra `Bun.build` + `tsc`

Variante nova `a-bun-bunbuild/`: cada pacote tem um `build.ts` de cerca de 10 linhas que chama `Bun.build` (ESM, `sourcemap: 'linked'`, `packages: 'external'`, `external: ['node:*']`, `splitting: true`, `target: 'browser'` para os pacotes puros e `'node'` para a CLI), e depois `tsc -p tsconfig.build.json` com `emitDeclarationOnly` e `declarationMap`.

| | tsdown sob node (`bun run`) | tsdown sob Bun (`bun --bun run`) | `Bun.build` + `tsc` |
|---|---|---|---|
| Build limpo dos 3 pacotes (6 execuções) | 0,30 a 0,32 s | 0,19 a 0,26 s | 0,16 a 0,19 s |
| Pacote sintético de 176.400 linhas (3 execuções) | 1,43 a 1,63 s | 1,03 a 1,08 s | 0,41 a 0,45 s |
| Saída JS | idêntica entre node e Bun (`diff -r` vazio) | idem | equivalente, sem os comentários JSDoc (que ficam no `.d.ts`) |
| `.d.ts` | um arquivo por entrada, rollup via oxc | idem | um `.d.ts` por arquivo fonte (401 no sintético), com JSDoc e declaration map para `../src` |
| sourcemap com `sourcesContent` | sim | sim | sim |
| publint `--strict` e attw `--profile esm-only` | ok | ok | ok nos 3 tarballs |
| Consumo em Node, Deno e Chromium | ok (rev. 0) | idem | ok (smoke abaixo, 17/17) |
| Dependência extra | tsdown 0.x (rolldown, oxc) | idem | nenhuma além do TypeScript |

Duas armadilhas medidas no `Bun.build` que o `build.ts` precisa fixar:

- Sem `splitting: true`, uma classe usada por duas entradas vai duplicada para dentro de cada bundle (`class Shared` aparece uma vez em `a.js` e outra em `b.js`); com `splitting` fica num chunk compartilhado. Com erro tipado por `instanceof`, isso é o mesmo problema do dual package hazard, então `splitting: true` é obrigatório.
- `node:crypto` numa entrada `*.node.ts` precisa de `external: ['node:*']` para caber numa única chamada com `target: 'browser'`. Assim as três entradas do core saem de uma chamada só e podem compartilhar chunks.

**Escolha: `Bun.build` + `tsc`.** É o mais rápido nas duas escalas, tira uma dependência 0.x da cadeia de release e fica dentro da toolchain Bun que o requisito pede. O `.d.ts` por arquivo em vez de rollup não mudou nada para os consumidores medidos (tsc nodenext, bundler e `deno check` passaram). O tsdown continua como plano B viável: roda sob Bun com saída idêntica.

### [rev. 1] Testes: `bun test` e smoke entre runtimes

- **Unitários com `bun test`** no fonte (`packages/*/test/*.test.ts`, importando `../src/index.ts`): 6 testes em 17 ms de parede. Os testes cobrem as duas entradas de runtime (`runtime.ts` e `runtime.node.ts`) importando os arquivos diretamente, porque o Bun resolveria a condição `node`.
- **Smoke entre runtimes** em `spikes/s0-tooling/a-bun-bunbuild/smoke/run.ts`, rodando no Bun. Ele sobe um verdaccio efêmero numa porta aleatória, guarda o PID e mata esse PID no `finally`. Depois publica com o próprio `scripts/release.ts` e instala os tarballs num consumidor novo com `npm install`. Por último, verifica com asserções (não só imprime):
  - Node `import` e `require`, por versão;
  - o bin `sinete doctor`;
  - `tsc` nodenext no consumidor;
  - Deno `run` e `check` via `npm:`, e o bin da CLI via `npm:@sinete/cli`;
  - `bun build --target=browser` do consumidor sem nenhum `node:`;
  - **Chromium real via Playwright rodando sob o Bun**, com o bundle servido pelo `Bun.serve`: a condição resolvida foi `default`, `randomId` veio do Web Crypto e `instanceof SineteError` funcionou.
- Resultado com Node 20.20.2, 22.23.3, 24.13.0 e 26.3.1: **17/17 em cerca de 4 s**. Com 22.9.0 incluído: 18/19, e a única falha é `require` com `ERR_REQUIRE_ESM`, que está fora do `engines`. O script também serve para demonstrar essa fronteira.
- Forma do CI em `spikes/s0-tooling/a-bun-bunbuild/ci.example.yml`:
  - job `check`: `bun install --frozen-lockfile`, `biome ci`, `tsc`, `bun test --coverage`, build, publint e attw nos tarballs, e `deno publish --dry-run`;
  - job `smoke`: matriz Node 20.19, 22, 24 e 26 rodando `bun smoke/run.ts`; Deno e Chromium só numa perna, porque não dependem do Node;
  - job `release`: `changesets/action` com `version: bun run version` e `publish: bun run release`, com `id-token: write` e Node 24, cujo npm 11 faz o OIDC.

Registro da revisão 0: vitest 5 roda de fato em Node, Bun (`bun --bun`) e Deno. Ele seria a escolha se a mesma suíte unitária tivesse de rodar nas três runtimes. Com `bun test` como padrão da org, a garantia entre runtimes vem do smoke sobre o artefato publicado, que é o que o consumidor de fato executa.

### ESM puro ou dual com CJS (revisão 0, mantido)

| Node | `import` | `require()` do pacote ESM puro | stderr do `require` |
|---|---|---|---|
| 20.20.2 | ok | ok | vazio |
| 22.9.0 | ok | `ERR_REQUIRE_ESM` (com `--experimental-require-module` funciona, com ExperimentalWarning) | n/a |
| 22.23.3 | ok | ok | vazio |
| 24.13.0 | ok | ok | vazio |
| 26.3.1 | ok | ok | vazio |

Dual package hazard (`consumers/src/hazard.mjs`): com o core ESM puro, `import` e `require` devolvem a mesma classe; com a variante dual (`format: ['esm','cjs']`), `sameClass: false` e `instanceof` falha em todas as versões do Node. A variante dual passa em todos os perfis do attw, mas custa 28% a mais de tarball e quebra o erro tipado (princípio 7). O caminho Bun não mudou nenhum desses números: a smoke da revisão 1 repetiu o mesmo resultado de `require` por versão.

### Condições de export e browser (revisão 0, confirmado na revisão 1)

Node, Bun e Deno resolveram `@sinete/core/runtime` para `node`. `esbuild --platform=browser` (rev. 0), `bun build --target=browser` (rev. 0 e 1) e o Chromium real (rev. 1) ficaram com `default`, sem `node:crypto`. Tipos: `tsc` nodenext e bundler e `deno check` passaram, com um `@ts-expect-error` que só vale se os tipos resolverem. Declaration maps apontam para `src`, que vai no tarball; com `node --enable-source-maps`, o stack aponta para `src/index.ts:11:47`.

### Achados de consumidor (revisão 0, mantidos)

- O Deno 2.9 ignora por padrão versões de npm e JSR com menos de 24 h (`minimumDependencyAge`, 1440 min; confirmado com `--no-config` e desligado com `--minimum-dependency-age=0`).
- O bun guarda o manifesto do registry em cache e não viu uma versão publicada minutos antes até `bun install --no-cache`.

### JSR como segundo alvo (revisão 0, mantido)

`deno publish --dry-run` de core e xml passou em 0,49 s. A checagem de slow types é mais estrita que `isolatedDeclarations` do TS 7: um retorno inferido de literal passa no tsc e é recusado pelo JSR. O JSR não documenta `exports` condicionais, e o Deno consome o pacote npm sem problema. Conclusão: sem publicação no JSR na fase 1; `deno publish --dry-run` entra no CI como lint.

### Biome (revisão 0, ajustado na revisão 1)

A config de `a-bun/biome.jsonc` fez disparar, num arquivo de sonda com violações de propósito, estas regras:

- `noNodejsModules`, `useNodejsImportProtocol`, `noReExportAll`;
- `nursery/useExplicitType`, que pega o que o TS 7 deixa passar e o JSR recusa;
- `noDefaultExport`, `useImportType`;
- `noRestrictedGlobals` com `Date` negado fora do core;
- `noConsole`, `noProcessGlobal`.

**[rev. 1]** `a-bun-bunbuild/biome.jsonc` acrescenta um override para o tooling do repo (`**/build.ts`, `scripts/**`, `smoke/**`, `**/test/**`), que roda no Bun e pode usar Node e console. Com isso o check fica limpo, só com 1 aviso (`noNonNullAssertion` no smoke). Na 2.5, `"recommended": true` foi substituído por `"preset": "recommended"`.

### TypeScript (revisão 0, ajustado na revisão 1)

Continuam: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `isolatedDeclarations`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `declarationMap`, `module: preserve` com `moduleResolution: bundler`, e imports relativos com `.ts` (`allowImportingTsExtensions`). **[rev. 1]** Com `Bun.build`, o `tsc` passa a emitir os `.d.ts` (`tsconfig.build.json` com `emitDeclarationOnly` e `rootDir: src`), além de fazer o typecheck. `types` inclui `bun` para os testes e scripts.

### Evidência da revisão 0 sobre pnpm (registro)

pnpm 10.2.0 e 12.6.0 com tsdown: `pnpm pack` reescreve `workspace:` e `changeset publish` funciona ponta a ponta. O build levou 0,54 a 0,79 s contra 0,30 a 0,42 s do bun com o mesmo tsdown. Em trusted publishing, o suporte nativo só existe no publish do pnpm 11 ou mais novo. Descartado pelo requisito da revisão 1.

## Decisão proposta

1. **[rev. 1] Bun como gerenciador, runner de scripts e de testes.** Bun workspaces com `bun.lock` versionado; versão do Bun fixada no `package.json` e lida pelo `setup-bun` no CI.
2. **[rev. 1] Build com `Bun.build` + `tsc`.** Um `build.ts` por pacote: ESM, `splitting: true`, `external: ['node:*']`, `packages: 'external'`, sourcemap `linked`, e `.d.ts` com declaration maps emitidos pelo `tsc`. O tsdown fica como plano B.
3. **ESM puro, sem CJS**, com `engines.node: "^20.19.0 || >=22.12.0"`.
4. **Formato de pacote:** `type: module`, `sideEffects: false`, `exports` com `types` primeiro e `./package.json` exposto, condição `node`/`default` só onde há código específico de runtime, `files: ["dist", "src"]`.
5. **[rev. 1] Versionamento:** changesets só para `changeset version` e changelog, sempre seguido de `bun install`. `changeset publish` não é usado.
6. **[rev. 1] Publicação:** `scripts/release.ts` (`bun pm pack` + travas no tarball + `npm publish <tgz>`) com trusted publishing (OIDC) e provenance via npm 11.5.1 ou mais novo. `bun publish` não é usado, porque não faz OIDC nem provenance e ignora `publishConfig.registry`.
7. **[rev. 1] Testes:** `bun test` para os unitários no fonte. `smoke/run.ts` sobre os tarballs publicados num verdaccio efêmero cobre Node (`import`, `require`, bin, tsc) na matriz 20.19, 22, 24 e 26, Deno e Chromium via Playwright.
8. **Gates no CI sobre o tarball:** publint `--strict`, attw `--profile esm-only`, `tsc` e `deno publish --dry-run`.
9. **Biome** com a config de `a-bun-bunbuild/biome.jsonc`.
10. **JSR fica fora da fase 1**, com o código pronto para ele.

## Consequências

- O toolchain inteiro de dev e CI depende do Bun; o Node só é necessário para o `npm publish` do release (Node 24 no job de release) e como alvo da smoke. Isso também remove a exigência de Node 22.18+ que o tsdown impunha aos contribuidores.
- **[rev. 1]** O release depende de disciplina no lock: `bun run version` precisa rodar `bun install`. O `release.ts` barra lock desatualizado antes de publicar qualquer pacote. `--frozen-lockfile` não barra.
- **[rev. 1]** O `.d.ts` sai por arquivo fonte. Tipos internos aparecem no pacote publicado, mas não ficam importáveis por fora, porque o `exports` só expõe as entradas.
- **[rev. 1]** Os testes unitários rodam só no Bun. Uma diferença de comportamento entre runtimes que não seja exercitada pela smoke passa despercebida até a smoke crescer. A smoke precisa cobrir cada entrada pública e cada condição de export, e crescer junto com os pacotes.
- Consumidor CommonJS em Node anterior a 20.19 ou a 22.12 precisa usar `import()`.
- A documentação precisa avisar usuários Deno sobre o cooldown de 24 h e usuários Bun sobre o cache de manifesto.
- `isolatedDeclarations` e `useExplicitType` obrigam a anotar tipos de retorno na API pública; o codegen do S1 precisa emitir anotações explícitas.

## Pendências

- **Trusted publishing real:** validar `npm publish <tgz>` com OIDC e provenance no primeiro release de verdade, com um trusted publisher configurado por pacote no npmjs. Não dá para testar localmente.
- **[rev. 1] `changeset git-tag` e `changesets/action` com publish customizado:** não exercitados, porque o spike não commita. A action detecta pacotes publicados pela saída do comando de publish para criar GitHub releases; o formato de saída do `release.ts` pode precisar de ajuste.
- **[rev. 1] Chromium no CI Linux:** a smoke com Playwright sob Bun passou no macOS com o Chromium 153 em cache; falta rodar num runner Linux com `playwright install --with-deps`.
- **`lib` e `types` por pacote:** separar os tipos de pacotes puros (sem `@types/node`) das entradas `*.node.ts` no scaffold real.
- **Cooldown de 24 h do Deno:** decidir se a documentação recomenda `minimumDependencyAge.exclude` para `@sinete/*` (suporte por escopo em aberto em denoland/deno#35743).

## Reprodução

Tudo em `spikes/s0-tooling/`:

- `a-bun-bunbuild/`: layout recomendado. `bun run build`, `bun test`, `bun run typecheck`, `bun run version`, `bun run release`, e `VERDACCIO_BIN=... SMOKE_NODE_VERSIONS="20.20.2 22.23.3 24.13.0 26.3.1" bun smoke/run.ts`.
- `a-bun/`: bun workspaces com tsdown e o `scripts/release.ts` original; `a-bun-semver/`: teste de ranges semver puros (revisão 0).
- `b-pnpm/`, `b-pnpm12/`, `c-tsc/`: variantes da revisão 0.
- `split-probe/`: duplicação de classe entre entradas sem `splitting`.
- `big/` com `scripts/gen-big.mjs` e `big/bunbuild.ts`: pacote sintético grande.
- `scripts/bench-build.sh` e `scripts/bench-build-bun.sh`: builds; `scripts/consume.sh`: matriz de consumo da revisão 0; `scripts/bench-tests.sh`: runners.
- `registry/config.yaml`: verdaccio do spike (`registry/bin/node_modules/.bin/verdaccio`).
- `logs/`: saídas brutas, incluindo `build-bench-bun.txt` e `smoke-bun.txt`.
