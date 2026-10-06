# tools/cfop-data

Gera `packages/validators/src/data/cfop.json` (`indicadoresCfop` e `TABELA_CFOP` do `@sinete/validators`) a partir da planilha oficial da Tabela de CFOP do Portal da NF-e (Documentos, Diversos), listada em `sources.json` com URL e sha256. Workspace privado, nunca publicado.

```sh
bun tools/cfop-data/build.ts --xlsx <planilha>            # grava o JSON
bun tools/cfop-data/build.ts --xlsx <planilha> --check    # só confere se o JSON versionado é o gerado
```

Requer `unzip` (o leitor de xlsx é o do `tools/ibs-cbs-dados`). O sha256 da planilha é conferido antes da leitura, e a planilha não entra no repositório: trocar de versão é mudar `sources.json` (título, URL, sha256, data) no mesmo commit que o JSON gerado.

Por CFOP, o JSON guarda o início e o fim de vigência e os nove indicadores na ordem de `indicadores`, um algarismo cada, como estão na planilha (o `indComb` tem 0, 1 e 2). A descrição do CFOP fica na planilha. O builder recusa CFOP fora do formato, repetido, sem início de vigência ou com indicador que não seja um algarismo.

Achado na versão de 04/09/2026 (IT 2023.002 v2.10): 72 CFOP com `indExcIBSCBS` 1, enquanto o texto do IT 2023.002 v2.00 fala em 84.
