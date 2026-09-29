# tools/danfe-corpus

Roda o `@sinete/da` sobre um corpus local de XML autorizados (`nfeProc`, `procEventoNFe` de CC-e e de cancelamento, `mdfeProc`) e imprime **só agregados**: documentos por tipo, falhas por código de erro, marcas d'água por tipo, folhas, encaixe de texto (reduzido, quebrado, cortado), determinismo (dois renders, bytes iguais), tempo por documento e tamanho do PDF. Opcionalmente lê o código de barras e o QR Code com o `zbarimg` numa amostra. Nunca imprime chave, nome, CNPJ nem trecho de XML: o corpus tem dado pessoal.

Workspace privado, nunca publicado. O corpus e os renders ficam fora do repositório.

```sh
bun run build
bun tools/danfe-corpus/check.ts [--corpus ~/.local/state/sinete/corpus] [--saida <dir fora do repo>] [--zbar 25] [--marcas]
```

- `--corpus`: diretório com subdiretórios de XML (padrão `~/.local/state/sinete/corpus`). O tipo de cada arquivo sai da raiz do XML, não do nome.
- `--saida`: grava o PDF de cada documento, com nome sequencial, num diretório que precisa ficar fora do repositório.
- `--zbar N`: rasteriza a primeira folha de 1 a cada N documentos (150 dpi, `pdftoppm`) e confere a leitura do CODE-128C da chave e, no DAMDFE e na NFC-e, do QR Code.
- `--marcas`: renderiza também cada `nfeProc` como prévia (o `NFe` sem o protocolo), como denegada (cStat 302) e como cancelada pelo cStat (101), cada nota com evento de cancelamento com o cStat 101 e o evento juntos, e cada `mdfeProc` como prévia, cancelado (101) e encerrado (132). Conta as marcas d'água por tipo (nome de uma lista fechada; o texto da marca, que traz o protocolo, não sai), os documentos com "SEM VALOR FISCAL" em algum texto e, nas variantes de cancelamento, se o `nProt` do protocolo aparece no documento e se o carimbo traz o protocolo do evento (só a contagem; o número não sai). Os PDFs dessas variantes não vão para o `--saida`.
