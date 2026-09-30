---
'@sinete/rejeicoes': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 1). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Nomes exportados:

| Antigo | Novo |
|---|---|
| `RejeicaoCategory` | `CategoriaRejeicao` |
| `REJEICAO_CATEGORIES` | `CATEGORIAS_REJEICAO` |
| `RejeicaoRule` | `RegraRejeicao` |
| `RejeicaoSource` | `FonteRejeicao` |
| `RejeicoesTableInfo` | `DescricaoTabelaRejeicoes` |
| `REJEICOES_TABLE` | `TABELA_REJEICOES` |
| `rejeicaoByCode` | `rejeicaoPorCodigo` |
| `rejectionHint` | `dicaRejeicao` |
| `enrichRejected` | `completarRecusado` |
| `enrichOutcome` | `completarResultado` |
| `REJEICOES_MDFE_TABLE` | `TABELA_REJEICOES_MDFE` |
| `rejeicaoMdfeByCode` | `rejeicaoMdfePorCodigo` |
| `rejectionHintMdfe` | `dicaRejeicaoMdfe` |
| `enrichRejectedMdfe` | `completarRecusadoMdfe` |
| `enrichOutcomeMdfe` | `completarResultadoMdfe` |
| `NfseErrosTableInfo` | `DescricaoTabelaErrosNfse` |
| `NFSE_ERROS_TABLE` | `TABELA_ERROS_NFSE` |
| `nfseErroByCode` | `nfseErroPorCodigo` |
| `nfseRejectionHint` | `dicaRejeicaoNfse` |
| `enrichNfseRejected` | `completarRecusadoNfse` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `RegraRejeicao` | `doc` | `documento` |
| `Rejeicao` | `code` | `codigo` |
| `Rejeicao` | `effect` | `efeito` |
| `Rejeicao` | `message` | `mensagem` |
| `Rejeicao` | `messages` | `mensagens` |
| `Rejeicao` | `source` | `fonte` |
| `Rejeicao` | `rules` | `regras` |
| `Rejeicao` | `category` | `categoria` |
| `RejeicaoMdfe` | `code` | `codigo` |
| `RejeicaoMdfe` | `effect` | `efeito` |
| `RejeicaoMdfe` | `message` | `mensagem` |
| `RejeicaoMdfe` | `messages` | `mensagens` |
| `RejeicaoMdfe` | `source` | `fonte` |
| `RejeicaoMdfe` | `rules` | `regras` |
| `RejeicaoMdfe` | `category` | `categoria` |
| `FonteRejeicao` | `citation` | `citacao` |
| `DescricaoTabelaRejeicoes` | `schemaVersion` | `versaoDoFormato` |
| `DescricaoTabelaRejeicoes` | `version` | `versao` |
| `DescricaoTabelaRejeicoes` | `sources` | `fontes` |
| `DescricaoTabelaErrosNfse` | `schemaVersion` | `versaoDoFormato` |
| `DescricaoTabelaErrosNfse` | `version` | `versao` |
| `DescricaoTabelaErrosNfse` | `sources` | `fontes` |
| `NfseErroRegra` | `doc` | `documento` |
| `NfseErro` | `code` | `codigo` |

Chaves dos JSON de dados:

| Arquivo | Antigo | Novo |
|---|---|---|
| `data/rejeicoes.json` | `schemaVersion` | `versaoDoFormato` |
| `data/rejeicoes.json` | `version` | `versao` |
| `data/rejeicoes.json` | `sources` | `fontes` |
| `data/rejeicoes.json` | `citation` | `citacao` |
| `data/rejeicoes.json` | `code` | `codigo` |
| `data/rejeicoes.json` | `effect` | `efeito` |
| `data/rejeicoes.json` | `message` | `mensagem` |
| `data/rejeicoes.json` | `messages` | `mensagens` |
| `data/rejeicoes.json` | `source` | `fonte` |
| `data/rejeicoes.json` | `rules` | `regras` |
| `data/rejeicoes.json` | `category` | `categoria` |
| `data/rejeicoes.json` | `doc` | `documento` |
| `data/rejeicoes-mdfe.json` | `schemaVersion` | `versaoDoFormato` |
| `data/rejeicoes-mdfe.json` | `version` | `versao` |
| `data/rejeicoes-mdfe.json` | `sources` | `fontes` |
| `data/rejeicoes-mdfe.json` | `citation` | `citacao` |
| `data/rejeicoes-mdfe.json` | `code` | `codigo` |
| `data/rejeicoes-mdfe.json` | `effect` | `efeito` |
| `data/rejeicoes-mdfe.json` | `message` | `mensagem` |
| `data/rejeicoes-mdfe.json` | `messages` | `mensagens` |
| `data/rejeicoes-mdfe.json` | `source` | `fonte` |
| `data/rejeicoes-mdfe.json` | `rules` | `regras` |
| `data/rejeicoes-mdfe.json` | `category` | `categoria` |
| `data/rejeicoes-mdfe.json` | `doc` | `documento` |
| `data/nfse-erros.json` | `schemaVersion` | `versaoDoFormato` |
| `data/nfse-erros.json` | `version` | `versao` |
| `data/nfse-erros.json` | `sources` | `fontes` |
| `data/nfse-erros.json` | `citation` | `citacao` |
| `data/nfse-erros.json` | `code` | `codigo` |
| `data/nfse-erros.json` | `doc` | `documento` |

Também mudam nesta versão:

- Parâmetros: `nfseErroPorCodigo(codigo)`, `dicaRejeicaoNfse(codigo)` e `completar*(desfecho)`.
- `src/data/*.json`: as chaves seguem a tabela acima, e `notes` e `generatedBy` do topo viraram `notas` e `geradoPor`.
