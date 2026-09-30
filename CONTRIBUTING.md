# Contribuindo com o sinete

Obrigado pelo interesse. O sinete é o core open source de documentos fiscais eletrônicos brasileiros (NF-e, MDF-e, NFS-e Nacional) em TypeScript, sob Apache-2.0. Este guia está em português; há um resumo em inglês no fim.

## Regras que não se negociam

1. **Implementar a partir das especificações oficiais**: Manual de Orientação do Contribuinte (MOC), Notas Técnicas, schemas XSD, manuais e APIs da NFS-e Nacional, tabelas publicadas pelos órgãos fazendários.
2. **Nunca copiar, traduzir ou adaptar código de projetos LGPL ou GPL**, nem de projetos sem licença. Ler código de terceiros para entender um comportamento da SEFAZ não autoriza reproduzir a solução: descreva o comportamento, confirme na especificação ou em homologação, e implemente do zero.
3. **Registrar a origem de cada regra.** Toda regra fiscal, validação, código de rejeição, endpoint ou tabela entra com a fonte: item do MOC, número e versão da NT, regra de validação (ex.: `NT 2025.002 v1.50, RV UB12-10`), URL oficial e data de coleta. Em código, num comentário junto da regra; em dados, no campo `source` do arquivo. A revisão de toda PR confere a origem.
4. **Dados reais nunca entram no repositório.** Nada de certificado (PFX, P12, chave privada), XML autorizado de contribuinte real, CPF, CNPJ de terceiros ou corpus. Fixtures são sintéticas ou anonimizadas. O `bun run check` barra os casos mais comuns (`scripts/check-no-secrets.ts`), mas a responsabilidade é de quem envia.

Os invariantes técnicos (assinar a string final, dados como dados, relógio injetado, erro tipado) estão no [CLAUDE.md](CLAUDE.md) e nos [ADRs](docs/adr/).

## DCO: assinatura dos commits

Não há CLA. Toda contribuição é aceita sob o [Developer Certificate of Origin 1.1](https://developercertificate.org/): ao assinar o commit você declara que tem o direito de enviar aquele código sob a licença do projeto. Todo commit precisa da linha `Signed-off-by` com seu nome e e-mail reais:

```sh
git commit -s -m "feat(core): ..."
```

PR com commit sem `Signed-off-by` não é mergeada. Para corrigir commits já feitos: `git rebase --signoff main`.

## Ambiente

- [Bun](https://bun.sh) na versão do campo `packageManager` do `package.json`. É o gerenciador de pacotes, o runner de scripts e de testes.
- Para a smoke: Node (qualquer versão do `engines`) e [Deno](https://deno.com) 2. O verdaccio vem do `VERDACCIO_BIN`, do `PATH` ou, sem nenhum dos dois, a própria smoke o instala na versão fixada em `smoke/.tools/` (fora do git), sem instalação global. O Chromium vem do Playwright (`bunx playwright install chromium`).

```sh
bun install
bun run check          # o mesmo que o job check do CI
bun run ci             # check + smoke dos tarballs em Node, Bun, Deno e Chromium
```

Comandos avulsos: `bun run build`, `bun run typecheck`, `bun test`, `bun run lint`, `bun run format`, `bun run smoke`.

## Fluxo de trabalho

- Uma issue pequena por PR, em branch própria.
- Mensagens no padrão [Conventional Commits](https://www.conventionalcommits.org/), com o pacote como escopo: `feat(nfe): ...`, `fix(core): ...`.
- Mudança de comportamento publicado de um pacote traz um changeset (`bunx changeset`). Veja [docs/release.md](docs/release.md).
- Exemplos em TypeScript nos READMEs e na documentação embarcada compilam contra a API atual: `bun run check:readme` (parte do `bun run check`) confere cada bloco ` ```ts `; trecho que não é para compilar (Deno com `npm:`, pseudocódigo) usa ` ```ts sem-checagem `.
- Teste junto com o código: unitários com `bun test` em `packages/<pacote>/test/`, e fixtures da smoke em `smoke/fixtures/<pacote>/` para toda entrada pública nova.
- Pacote novo ou subpath novo: confira os critérios do [ADR 0008](docs/adr/0008-divisao-de-pacotes.md) (na dúvida, é subpath de um pacote que já existe), rode `bun scripts/umbrella.ts` para o guarda-chuva `sinete` ganhar o subpath e acrescente-o em `smoke/fixtures/sinete/checks.mjs`.
- Decisão de arquitetura nova ou revista vira ADR em `docs/adr/`.

## Documentação embarcada

A documentação de uso fica em `docs/guia/` e vai no tarball do `sinete` e do `@sinete/emissor` como `docs/` (o build copia a pasta). É o que o agente de código do integrador lê, na versão instalada, então ela precisa estar certa na versão que sai:

- Organização Diátaxis: `tutorial/`, `como-fazer/`, `explicacao/`, `referencia/` (gerada) e `erros/`. Toda página escrita à mão entra no `index.md`, e cada uma se sustenta lida sozinha (agentes recuperam pedaços).
- Mudança de comportamento publicado atualiza a página que o descreve na mesma PR. Os exemplos ` ```ts ` da doc compilam no `bun run check` como os dos READMEs (` ```ts continua ` junta o bloco ao anterior; ` ```ts completo ` não ignora nome desconhecido); o tutorial roda de verdade (`packages/emissor/test/tutorial.test.ts`).
- `referencia/`, `erros/index.md`, `packages/cli/src/bloco-agents.ts` e `packages/cli/src/skill-sinete.ts` são gerados: `bun run docs` (build e `scripts/docs-gerados.ts`). O `bun run check` falha fora de sincronia.
- Código de erro novo (`ErroSinete` com `code` novo) precisa de `docs/guia/erros/<code>.md` com as seções Causa, Correção e Armadilha; o `scripts/check-docs.ts` confere nos dois sentidos.
- O bloco do `AGENTS.md` (`docs/guia/bloco-agents.md`) cabe em 8 KB e só cita nomes que a referência gerada conhece.
- A skill `sinete` (`docs/guia/skill-sinete.md`, o `SKILL.md` que o `agents-md` instala em `.claude/skills/` e `.agents/skills/`) só aponta para esta documentação, sem repeti-la; o `check-docs` confere o frontmatter (`name: sinete`, `description` até 1024 caracteres) e a linha `<!-- sinete-skill: ... -->` que a marca como gerada.
- Regras de conteúdo: português com acentuação, sem travessão, um parágrafo por linha, afirmação sobre regra fiscal com a fonte (MOC, NT), exemplos só com CNPJ e CPF de teste do repositório e nada de certificado ou SEFAZ reais. A doc apresenta o sinete pelo que ele faz, sem citar outro projeto como ponto de partida.

## Estilo

- Biome formata e faz o lint (`bun run format`). As regras proíbem builtins do Node e o global `Date` nos pacotes puros.
- API pública com tipos de retorno explícitos (`isolatedDeclarations`).
- Identificadores da API pública em português, com as exceções e o glossário do [ADR 0015](docs/adr/0015-nomes-em-portugues.md): nome oficial como na fonte (`cStat`, `xMotivo`, `cUF`), jargão técnico da lista fechada (`store`, `logger`...) e o que a plataforma fixa; códigos de erro em snake_case, português, sem acento.

---

## Summary in English

The sinete is an Apache-2.0 TypeScript core for Brazilian electronic fiscal documents. Contributions are welcome under these rules:

- **Implement from the official specifications** (MOC, Technical Notes, XSD, NFS-e Nacional manuals). **Never copy, translate or adapt code from LGPL or GPL projects** or from unlicensed code.
- **Record the origin of every rule** (MOC item, Technical Note and version, validation rule id, official URL and date) next to the code or in the data file's `source` field.
- **No real data in the repository**: no certificates or private keys, no real authorized XML, no personal or third-party tax ids, no corpus. Fixtures are synthetic or anonymized.
- **DCO sign-off is required** on every commit (`git commit -s`); there is no CLA.
- Tooling is Bun: `bun install`, then `bun run check` (same as CI) or `bun run ci` (adds the packed-tarball smoke on Node, Bun, Deno and Chromium).
- Conventional Commits with the package as scope, one small issue per PR, and a changeset for any published behavior change.
