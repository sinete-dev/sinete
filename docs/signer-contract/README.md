# Contrato do signer (`docs/signer-contract/`)

Contrato versionado do protocolo NDJSON entre o cliente TS (`@sinete/transport/signer`) e o helper `sinete-signer` (`helpers/signer-tls/`).

- `PROTOCOL.md`: a parte normativa (canal, frames, métodos, garantias, códigos de erro).
- `PROTOCOL_VERSION`: a versão que vai no `v` de todo frame.
- `schema/frame.schema.json`: JSON Schema (2020-12) de cada frame; os resultados, que dependem do método, ficam em `$defs/<metodo>Result`.
- `fixtures/`: conversas de exemplo (`frames`, cada um com `from` e, na resposta, `of` com o método), e `guard.json`, os casos da guarda de hosts.

Não é pacote npm: é especificação de protocolo, sem código para publicar, e quem a consome são o helper e o cliente, os dois neste repositório (ADR 0008, decisão 4).

## Quem testa contra o contrato

- `packages/transport/test/signer-contract.test.ts` valida todo frame das fixtures contra o schema, reproduz as conversas contra o cliente TS e roda os casos de `guard.json` contra a `politicaDeHostsPermitidos`.
- `helpers/signer-tls/internal/server/contract_test.go` reproduz as conversas contra o helper (hello, erros, ciclo de vida) e confere que os resultados dele passam pelo mesmo formato; `internal/policy/policy_test.go` roda os casos de `guard.json` contra a guarda do helper.

Mudou o protocolo: atualize `PROTOCOL.md`, o schema e as fixtures na mesma PR, e suba `PROTOCOL_VERSION` se a mudança for incompatível.
