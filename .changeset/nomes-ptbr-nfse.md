---
'@sinete/nfse': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Mudanças de comportamento:

- `montarDps` passa a ser assíncrona e devolve `Promise<ResultadoMontagemDps>`, como a `montarNfe` e a `montarMdfe` (ADR 0009, emenda de 30/set/2026). O `ErroDeConfiguracao` de um `verAplic` inválido vira rejeição da `Promise`.
- `ttl` é traduzido: `validadeMs`, `validadeNaoEncontradoMs` e `validadeParametrosMs`.
- `detalhes` do `ErroRespostaInvalida` de uma rejeição fora do formato do Anexo I: `httpStatus` → `statusHttp`.

Nomes exportados:

| Antigo | Novo |
|---|---|
| `BuildDpsOptions` | `MontarDpsOpcoes` |
| `BuildDpsResult` | `ResultadoMontagemDps` |
| `buildDps` | `montarDps` |
| `signDps` | `assinarDps` |
| `NfseClient` | `ClienteNfse` |
| `NfseClientOptions` | `ClienteNfseOpcoes` |
| `OpcoesEnvio` | `EnvioOpcoes` |
| `createNfseClient` | `criarClienteNfse` |
| `parseChaveNfse` | `lerChaveNfse` |
| `PedidoEventoOptions` | `PedidoEventoOpcoes` |
| `PedidoEventoResult` | `ResultadoPedidoEvento` |
| `buildPedidoAnaliseFiscal` | `montarPedidoAnaliseFiscal` |
| `buildPedidoCancelamento` | `montarPedidoCancelamento` |
| `signPedidoEvento` | `assinarPedidoEvento` |
| `gunzipBase64` | `descomprimirGzipBase64` |
| `gzipBase64` | `comprimirGzipBase64` |
| `DpsInput` | `DadosDps` |
| `ParametrosOptions` | `ParametrosOpcoes` |
| `createParametrosMunicipais` | `criarParametrosMunicipais` |
| `NfseMensagem` | `MensagemNfse` |
| `NfseOutcome` | `ResultadoNfse` |
| `NfseRejeicao` | `RejeicaoNfse` |
| `formatValor` | `formatarValor` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `MontarDpsOpcoes` | `time` | `tempo` |
| `MontarDpsOpcoes`, `PedidoEventoOpcoes` | `offsetMinutes` | `deslocamentoMin` |
| `ResultadoMontagemDps`, `ResultadoPedidoEvento` | `value` | `valor` |
| `ResultadoMontagemDps`, `ResultadoPedidoEvento`, `formatarValor` | `issues` | `ocorrencias` |
| `montarDps` | `input` | `entrada` |
| `montarDps`, `montarPedidoAnaliseFiscal`, `montarPedidoCancelamento` | `options` | `opcoes` |
| `assinarDps`, `ClienteNfseOpcoes`, `assinarPedidoEvento` | `signer` | `assinador` |
| `ClienteNfseOpcoes`, `ParametrosOpcoes` | `transport` | `transporte` |
| `ClienteNfseOpcoes`, `PedidoEventoOpcoes`, `ParametrosOpcoes` | `clock` | `relogio` |
| `ResolucaoEnvio` | `outcome` | `resultado` |
| `criarClienteNfse` | `options` | `opcoesDoCliente` |
| `resolverEnvioSemResposta` | `client` | `cliente` |
| `inscricaoId` | `doc` | `documento` |
| `comprimirGzipBase64` | `text` | `texto` |
| `CacheParametros` | `get` | `obter` |
| `CacheParametros` | `set` | `gravar` |
| `CacheParametros` | `clear` | `limpar` |
| `ParametrosOpcoes` | `ttlMs` | `validadeMs` |
| `ParametrosOpcoes` | `ttlNaoEncontradoMs` | `validadeNaoEncontradoMs` |
| `RejeicaoNfse` | `httpStatus` | `statusHttp` |
| `formatarValor` | `path` | `caminho` |
| `ClienteNfseOpcoes` | `ttlParametrosMs` | `validadeParametrosMs` |
