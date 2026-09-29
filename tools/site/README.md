# @sinete/tool-site

Site de documentação do sinete (Starlight), previsto para `sinete.fazer.ai`. Nada aqui é publicado por enquanto.

A fonte única é `docs/guia/`, a mesma pasta que vai nos tarballs do `sinete` e do `@sinete/emissor`. O conteúdo do site nunca é escrito à mão: `scripts/sync.ts` gera `src/content/docs/` (fora do git) a cada `dev` e `build`, tirando o `# H1` para o `title` do frontmatter, reescrevendo os links `x.md` para as rotas do site e ordenando a barra lateral pela ordem do `index.md`.

```sh
bun run --cwd tools/site dev       # sincroniza e sobe o servidor de desenvolvimento
bun run --cwd tools/site build     # sincroniza, gera dist/ e valida os links (starlight-links-validator)
bun run --cwd tools/site preview   # serve o dist/
```

O build também gera `llms.txt`, `llms-full.txt`, `llms-small.txt` e um arquivo por seção em `_llms-txt/` (`starlight-llms-txt`). O build do site não faz parte do `bun run check`.
