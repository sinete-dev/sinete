# tools/transport-data

Gera os dados versionados do `@sinete/transport`:

- `endpoints`: `packages/transport/src/data/endpoints.json`, das páginas oficiais (portal nacional da NF-e de produção e homologação, portal DF-e da SVRS para o MDF-e e para a NFC-e, página de web services da NFC-e da SEF/MG) e das bases da NFS-e Nacional. `--raw <dir>` reproduz uma coleta salva; `--nfce-retrieved-at` registra a data da coleta da NFC-e quando ela é outra.
- NFC-e: a relação da SVRS traz os autorizadores próprios (AM, GO, MS, MT, PR, RS, SP) e a SVRS, sem MG, que publica tabela própria. Nenhuma das duas lista as UFs por autorizador: a UF sem autorizador próprio nelas autoriza na SVRS (`regraDoMapaDeUfs` no JSON). URLs do QR Code e da consulta por chave só entram onde a tabela oficial de web services as publica (hoje só MG); as da página da ENCAT ficam de fora, porque são texto livre com datas de transição.
- NF-e: a inutilização sai do quadro da SVC-AN e da SVC-RS mesmo quando o portal a lista, porque a SVC não a oferece (NT 2013.007 v1.03, item 04.5); a exclusão fica em `nfe.svcSemServicos`, com a fonte.
- `perfis`: `packages/transport/src/data/tls-profiles.json`, do `summary.json` da sondagem TLS (hoje a do `spikes/s2-tls/`; depois a do `tools/sefaz-probe`).

```sh
bun tools/transport-data/build.ts endpoints --retrieved-at 2026-09-25 [--nfce-retrieved-at 2026-09-26] [--raw dir]
bun tools/transport-data/build.ts perfis --summary spikes/s2-tls/out/summary.json --probed-at 2026-09-25
```

Workspace privado (ADR 0001). Mudança nos dados é release minor do `@sinete/transport`.
