# tools/ibs-cbs-dados

Gera o dataset do `@sinete/ibs-cbs-dados` (`packages/ibs-cbs-dados/src/data/`) e a tabela do `@sinete/ibs-cbs/aliquotas` (`packages/ibs-cbs/src/aliquotas/data/rates.json`) a partir do módulo offline da Calculadora da RFB e das planilhas do IT, e compara versões. Workspace privado, nunca publicado. Decisão e evidência em `docs/adr/0007-rtc-dados-e-oraculo.md`.

## Uso

```sh
bun tools/ibs-cbs-dados/extract.ts                   # baixa (ou lê do cache), confere os hashes e grava os JSON
bun tools/ibs-cbs-dados/extract.ts --check           # não grava; falha se o gerado diferir do versionado
bun tools/ibs-cbs-dados/extract.ts --check --verify-layer   # também confere o diff_id da camada da imagem do oráculo
bun tools/ibs-cbs-dados/diff.ts                      # diff semântico: git:HEAD x árvore de trabalho
bun tools/ibs-cbs-dados/diff.ts git:main packages/ibs-cbs-dados/src/data --json
```

Requer `unzip`, `tar`, `gunzip`, `shasum` e `sqlite3`. O cache fica em `$SINETE_IBS_CBS_CACHE` (padrão `~/.cache/sinete/ibs-cbs`); `--calculadora-zip` e `--it-*` apontam para arquivos já baixados.

## Fontes fixadas

`sources.json` fixa a Calculadora (URL, sha256 do zip, do `calculadora.tar.gz`, do `codigo-fonte-backend.zip` e do `.db`, `diff_id` da camada, `versaoDb`, `versaoApp` e o `segundoCaminho`) e as planilhas do IT 2025.002 (cClassTrib e cCredPres) e do IT 2026.002 (alíquotas da CBS). Arquivo com hash diferente falha. Trocar de versão é mudar `sources.json` no mesmo commit que os JSON gerados, com a saída do `diff.ts` no PR. O `diff_id` é `sha256:` mais o sha256 do `calculadora.tar.gz` descomprimido (`gunzip -c calculadora.tar.gz | shasum -a 256`), e o `versaoApp` é o `info.app.version` do `application-offline.yml` de dentro do `api-regime-geral.jar`, o mesmo que o `/dados-abertos/versao` do contêiner devolve. Junto com o pin, o `calculadora` de `tools/ibs-cbs-oraculo/ledger.json` muda e as fixtures do oráculo são regravadas (`--record`), porque os testes conferem a versão delas. O zip, a imagem e os JARs nunca entram no repo.

## Método

1. Extrai as tabelas do SQLite embarcado e, por um segundo caminho, de um SQLite reconstruído das migrações Flyway do código-fonte do mesmo zip. Os dois precisam dar os mesmos JSON (`--skip-flyway` pula, só para desenvolvimento). Desde a V0058 o `codigo-fonte-backend.zip` não traz mais as migrações, só o próprio `.db`; o pin diz isso em `segundoCaminho` (`db-do-codigo-fonte`), e o segundo caminho passa a conferir que o `.db` do código-fonte é o mesmo do rootfs, o que não é uma reconstrução independente.
2. Junta as planilhas do IT e confronta com a Calculadora: divergência fora de `conflicts.json` falha, e entrada de `conflicts.json` que deixou de divergir também. Em conflito o dataset segue a Calculadora; cada entrada diz por que isso não muda cálculo nem XML.
3. Grava JSON canônico (chaves ordenadas, decimais como string), formatado pelo Biome do repo, com `manifest.json` (fontes, hashes, `sha256DoDataset` sobre o JSON canônico). A formatação não muda os hashes.
4. `rates.json` é a curadoria das alíquotas com fonte legal (as de teste de 2026, o IBS de 2027 e 2028 da LC 214/2025, o resto `desconhecida`).

`diff.ts` lê cada lado de um diretório ou de `git:<ref>` e usa o `compararDatasets` do pacote: registros incluídos, removidos e alterados por tabela, com o tipo da mudança.
