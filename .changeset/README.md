# Changesets

Cada PR que muda o comportamento publicado de um pacote `@sinete/*` traz um changeset: `bunx changeset` e escolha o pacote e o tipo de versão.

O changesets aqui só versiona e escreve o `CHANGELOG.md` (`bun run version`, que também roda `bun install` para atualizar o `bun.lock`). A publicação é do `scripts/release.ts`; `changeset publish` é proibido no repo (ADR 0001).
