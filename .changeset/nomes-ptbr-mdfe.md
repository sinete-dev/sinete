---
'@sinete/mdfe': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Mudanças de comportamento:

- `montarMdfe` passa a ser assíncrona e devolve `Promise<ResultadoMontagemMdfe>`, como a `montarNfe` e a `montarDps` (ADR 0009, emenda de 30/set/2026). Quem chamava sem `await` passa a receber uma `Promise`.
- O `Decimal` próprio do pacote fica em inglês (ADR 0015, exceção 3).

Nomes exportados:

| Antigo | Novo |
|---|---|
| `BuildMdfeOptions` | `MontarMdfeOpcoes` |
| `BuildMdfeResult` | `ResultadoMontagemMdfe` |
| `BuiltMdfe` | `MdfeMontado` |
| `buildMdfe` | `montarMdfe` |
| `signMdfe` | `assinarMdfe` |
| `DecimalFormat` | `FormatoDecimal` |
| `MdfeIssueCode` | `CodigoOcorrenciaMdfe` |
| `MDFE_ISSUE_CODES` | `CODIGOS_OCORRENCIA_MDFE` |
| `MdfeInput` | `DadosMdfe` |
| `AutorizacaoOutcome` | `ResultadoAutorizacao` |
| `ConsultaOutcome` | `ResultadoConsulta` |
| `EventoOutcome` | `ResultadoEvento` |
| `MdfeClient` | `ClienteMdfe` |
| `MdfeClientOptions` | `ClienteMdfeOpcoes` |
| `OpcoesEnvio` | `EnvioOpcoes` |
| `createMdfeClient` | `criarClienteMdfe` |
| `gunzipBase64` | `descomprimirGzipBase64` |
| `gzipBase64` | `comprimirGzipBase64` |
| `sliceElement` | `recortarElemento` |
| `offsetDaUf` | `deslocamentoDaUf` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `pagamentosDoLeiaute` | `@retorno.issues` | `@retorno.ocorrencias` |
| `MontarMdfeOpcoes` | `time` | `tempo` |
| `MontarMdfeOpcoes`, `ClienteMdfeOpcoes` | `offsetMinutes` | `deslocamentoMin` |
| `MontarMdfeOpcoes` | `random` | `aleatorio` |
| `ResultadoMontagemMdfe` | `value` | `valor` |
| `ResultadoMontagemMdfe` | `issues` | `ocorrencias` |
| `assinaturaQrCode`, `assinarMdfe`, `ClienteMdfeOpcoes` | `signer` | `assinador` |
| `montarMdfe` | `input` | `entrada` |
| `montarMdfe`, `ClienteMdfe` | `options` | `opcoes` |
| `comQrCode`, `assinarMdfe` | `built` | `manifesto` |
| `comQrCode`, `qrCodeMdfe` | `sign` | `assinatura` |
| `pagamentosDoLeiaute`, `rotuloDoCaminho` | `path` | `caminho` |
| `FormatoDecimal` | `name` | `nome` |
| `FormatoDecimal` | `intDigits` | `digitosInteiros` |
| `FormatoDecimal` | `nonZero` | `naoNulo` |
| `dec` | `input` | `valor` |
| `sum` | `values` | `valores` |
| `DocumentoAssinado`, `recortarElemento` | `doc` | `documento` |
| `ClienteMdfeOpcoes` | `transport` | `transporte` |
| `ClienteMdfeOpcoes` | `clock` | `relogio` |
| `ResolucaoEnvio` | `outcome` | `resultado` |
| `criarClienteMdfe` | `options` | `opcoesDoCliente` |
| `comprimirGzipBase64` | `text` | `texto` |
| `recuperarEventoRegistrado`, `resolverEnvioSemResposta` | `client` | `cliente` |
| `recortarElemento` | `parentDefaultNs` | `nsPadraoDoPai` |
