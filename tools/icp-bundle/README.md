# tools/icp-bundle

Gera `packages/cert/src/data/icp-brasil.json` a partir do `ACcompactado.zip` do ITI, com o SHA-512 conferido contra o `hashsha512.txt` oficial. A seleção (raízes v5, v10, v11, v12 e intermediárias SSL vistas nos servidores DF-e, conferidas por SHA-256) está em `selecao.json`.

```sh
bun tools/icp-bundle/build-bundle.ts --retrieved-at 2026-09-25          # baixa do ITI
bun tools/icp-bundle/build-bundle.ts --retrieved-at 2026-09-25 --check  # só confere o arquivo versionado
```

Workspace privado (ADR 0001); precisa do `unzip` no PATH. Atualizar o bundle é release minor do `@sinete/cert`.
