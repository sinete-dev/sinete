# Versionamento e publicação

Decidido no [ADR 0001](adr/0001-tooling-monorepo.md). Resumo operacional.

## Versionar

1. Cada PR que muda comportamento publicado traz um changeset (`bunx changeset`).
2. Para cortar versão: `bun run version`, que roda `changeset version` (bump e `CHANGELOG.md`), `bun scripts/versao-gerada.ts` (atualiza o `verProc`/`verAplic` embutido de `@sinete/nfe`, `@sinete/mdfe` e `@sinete/nfse` com a versão nova) **e** `bun install` (atualiza o `bun.lock`). O lock e os `src/versao-gerada.ts` vão no mesmo commit. Sem o `bun install`, o `bun pm pack` reescreveria `workspace:` com a versão velha gravada no lock; o `scripts/release.ts` barra esse caso antes de publicar. Sem o `bun scripts/versao-gerada.ts`, o `versão do verProc/verAplic em sincronia` do `bun run check` barra o release.
3. Commit e PR da versão; merge no `main`.

## Publicar

1. No commit mergeado, `bun run release:tag` (`changeset git-tag`) cria uma tag `@sinete/<pacote>@<versão>` por pacote com versão nova, e `sinete@<versão>` para o guarda-chuva. `git push --tags`.
2. A tag dispara o job `release` do CI: build, `scripts/release.ts` (`bun pm pack`, travas no tarball, `npm publish <tgz> --provenance`) com trusted publishing via OIDC. O script pula o que já está publicado, então é seguro relançar e é seguro que várias tags disparem vários runs.

`changeset publish` e `bun publish` não são usados: o primeiro publica `workspace:` literal num repo bun, o segundo não faz OIDC nem provenance e ignora `publishConfig.registry`.

Fora do CI, `scripts/release.ts` só aceita o npmjs com `--dry-run`. A smoke usa o mesmo script contra um verdaccio efêmero.

## O guarda-chuva `sinete`

O `sinete` (ADR 0008) depende de cada `@sinete/*` com `workspace:*`, que o `bun pm pack` troca pela versão exata; o `scripts/release.ts` barra o tarball que não levar exatamente a versão atual. O changesets sobe o guarda-chuva em patch sozinho sempre que um pacote dele sobe (`updateInternalDependencies: patch`). Quando um `@sinete/*` sobe minor ou major, o changeset do PR sobe o `sinete` no mesmo nível, para a versão do guarda-chuva dizer a mesma coisa que a do pacote. A primeira versão real precisa ser maior que `0.0.0`, o marcador já publicado no npm: o changeset inicial é minor (`0.1.0`).

## Antes do primeiro release

- O job `release` só roda com o repositório público **e** a variável de repositório `SINETE_RELEASE_ENABLED` igual a `true`, no environment `npm`.
- Reservar os nomes que ainda não existem no npmjs: `bun scripts/reservar-nomes.ts` lista o que falta e, com `--publicar`, publica um marcador `0.0.0` de cada um, à mão, com a conta dona do escopo (pede o OTP a cada pacote). O npm só aceita configurar trusted publisher em pacote que já existe, então sem esta etapa o primeiro release pelo OIDC falha. Cobre os pacotes públicos do workspace e os do sinete-signer (`@sinete/signer` e os seis `@sinete/signer-<os>-<cpu>`). O `sinete` já foi reservado assim.
- Configurar um trusted publisher no npmjs para cada pacote, inclusive o `sinete` (repositório `sinete-dev/sinete`, workflow `ci.yml`, environment `npm`; para os do sinete-signer, o workflow que os publicar). Isso não dá para testar localmente: validar no primeiro release real (pendência do ADR 0001).
