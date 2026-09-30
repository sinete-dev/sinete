---
'@sinete/nfe': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Mudanças de comportamento:

- `recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento?)` aceita a sequência: com ela, devolve só o evento dessa sequência (a CC-e de um `nSeqEvento`); sem ela, continua o de maior sequência.
- `DetalhePagamento.card` fica `card`: é o nome do grupo no leiaute (ADR 0015, exceção 1).
- O `Decimal` próprio do pacote fica em inglês, como o do `@sinete/ibs-cbs` (ADR 0015, exceção 3).

Nomes exportados:

| Antigo | Novo |
|---|---|
| `BuildNfeOptions` | `MontarNfeOpcoes` |
| `BuildNfeResult` | `ResultadoMontagemNfe` |
| `BuiltNfe` | `NfeMontada` |
| `buildNfe` | `montarNfe` |
| `signNfe` | `assinarNfe` |
| `DecimalFormat` | `FormatoDecimal` |
| `formatDecimal` | `formatarDecimal` |
| `formatProblem` | `problemaDeFormato` |
| `NfeIssueCode` | `CodigoOcorrenciaNfe` |
| `NFE_ISSUE_CODES` | `CODIGOS_OCORRENCIA_NFE` |
| `NfeInput` | `DadosNfe` |
| `IbsCbsCalculator` | `CalculadoraIbsCbs` |
| `IbsCbsItemRequest` | `PedidoIbsCbsItem` |
| `IbsCbsNotaRequest` | `PedidoIbsCbsNota` |
| `IbsCbsResponse` | `RespostaIbsCbs` |
| `IbsCbsCalculatorOptions` | `CalculadoraIbsCbsOpcoes` |
| `ibsCbsCalculator` | `calculadoraIbsCbs` |
| `AutorizacaoOutcome` | `ResultadoAutorizacao` |
| `ConsultaOutcome` | `ResultadoConsulta` |
| `EventoOutcome` | `ResultadoEvento` |
| `InutilizacaoOutcome` | `ResultadoInutilizacao` |
| `NfeClient` | `ClienteNfe` |
| `NfeClientOptions` | `ClienteNfeOpcoes` |
| `OpcoesEnvio` | `EnvioOpcoes` |
| `Sleep` | `Espera` |
| `createNfeClient` | `criarClienteNfe` |
| `gunzipBase64` | `descomprimirGzipBase64` |
| `sliceElement` | `recortarElemento` |
| `formatDh` | `formatarDh` |
| `offsetDaUf` | `deslocamentoDaUf` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `CalculadoraIbsCbs` | `calcular.request` | `calcular.pedido` |
| `CalculadoraIbsCbsOpcoes` | `regras.rules` | `regras.regras` |
| `CalculadoraIbsCbsOpcoes` | `regras.ignoreActivation` | `regras.ignorarAtivacao` |
| `MontarNfeOpcoes` | `time` | `tempo` |
| `MontarNfeOpcoes`, `ClienteNfeOpcoes`, `formatarDh` | `offsetMinutes` | `deslocamentoMin` |
| `MontarNfeOpcoes` | `random` | `aleatorio` |
| `ResultadoMontagemNfe`, `formatarDecimal`, `problemaDeFormato` | `value` | `valor` |
| `ResultadoMontagemNfe`, `RespostaIbsCbs` | `issues` | `ocorrencias` |
| `assinaturaQrCode`, `comQrCode`, `assinarNfe` | `built` | `nota` |
| `assinaturaQrCode`, `assinarNfe`, `ClienteNfeOpcoes` | `signer` | `assinador` |
| `montarNfe` | `input` | `entrada` |
| `montarNfe`, `calculadoraIbsCbs`, `ClienteNfe` | `options` | `opcoes` |
| `dec` | `input` | `valor` |
| `sum` | `values` | `valores` |
| `FormatoDecimal` | `name` | `nome` |
| `FormatoDecimal` | `minBelowOne` | `minimoAbaixoDeUm` |
| `FormatoDecimal` | `nonZero` | `naoNulo` |
| `FormatoDecimal` | `intDigits` | `digitosInteiros` |
| `formatarDecimal`, `problemaDeFormato` | `format` | `formato` |
| `formatarDecimal` | `mode` | `modo` |
| `rotuloDoCaminho` | `path` | `caminho` |
| `CalculadoraIbsCbsOpcoes` | `rates` | `aliquotas` |
| `CalculadoraIbsCbsOpcoes` | `utcOffsetMinutes` | `deslocamentoMin` |
| `ClienteNfeOpcoes` | `transport` | `transporte` |
| `ClienteNfeOpcoes` | `clock` | `relogio` |
| `ClienteNfeOpcoes` | `sleep` | `esperar` |
| `ClienteNfeOpcoes` | `nfceEndpoint` | `endpointNfce` |
| `criarClienteNfe` | `options` | `opcoesDoCliente` |
| `DocumentoAssinado`, `recortarElemento` | `doc` | `documento` |
| `recortarElemento` | `parentDefaultNs` | `nsPadraoDoPai` |
| `recuperarEventoRegistrado`, `resolverEnvioSemResposta` | `client` | `cliente` |
| `ResolucaoEnvio` | `outcome` | `resultado` |
| `formatarDh` | `date` | `data` |
