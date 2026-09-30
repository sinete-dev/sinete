---
'@sinete/validators': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 1). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Nomes exportados:

| Antigo | Novo |
|---|---|
| `caepfCheckDigits` | `calcularDvCaepf` |
| `formatCaepf` | `formatarCaepf` |
| `isValidCaepf` | `caepfValido` |
| `parseCaepf` | `lerCaepf` |
| `ChaveAcessoParts` | `PartesChaveAcesso` |
| `ChaveParseOptions` | `LerChaveAcessoOpcoes` |
| `buildChaveAcesso` | `montarChaveAcesso` |
| `chaveAcessoCheckDigit` | `calcularDvChaveAcesso` |
| `formatChaveAcesso` | `formatarChaveAcesso` |
| `isValidChaveAcesso` | `chaveAcessoValida` |
| `parseChaveAcesso` | `lerChaveAcesso` |
| `cnpjCheckDigits` | `calcularDvCnpj` |
| `formatCnpj` | `formatarCnpj` |
| `isAlphanumericCnpj` | `cnpjAlfanumerico` |
| `isValidCnpj` | `cnpjValido` |
| `parseCnpj` | `lerCnpj` |
| `ParseOptions` | `LerOpcoes` |
| `cpfCheckDigits` | `calcularDvCpf` |
| `formatCpf` | `formatarCpf` |
| `isValidCpf` | `cpfValido` |
| `parseCpf` | `lerCpf` |
| `IeCheck` | `CalculoDvIe` |
| `IeParseOptions` | `LerIeOpcoes` |
| `IeRange` | `FaixaIe` |
| `IeTableInfo` | `DescricaoTabelaIe` |
| `IeUfRule` | `RegraIeUf` |
| `IeVariant` | `VarianteIe` |
| `completeIe` | `completarIe` |
| `formatIe` | `formatarIe` |
| `IE_TABLE` | `TABELA_IE` |
| `ieCheckDigits` | `calcularDvIe` |
| `ieRule` | `regraIe` |
| `isIeIsento` | `ieIsenta` |
| `isValidIe` | `ieValida` |
| `parseIe` | `lerIe` |
| `ValidationIssueCode` | `CodigoOcorrencia` |
| `VALIDATION_ISSUE_CODES` | `CODIGOS_OCORRENCIA` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `ChaveAcesso` | `layout` | `leiaute` |
| `LerChaveAcessoOpcoes` | `checkEmitente` | `conferirEmitente` |
| `LerChaveAcessoOpcoes` | `clock` | `relogio` |
| `LerChaveAcessoOpcoes` | `layout` | `leiaute` |
| `CNPJ_ALFANUMERICO_VIGENCIA` | `source` | `fonte` |
| `LerOpcoes` | `path` | `caminho` |
| `FaixaIe` | `slice` | `posicoes` |
| `FaixaIe` | `min` | `minimo` |
| `FaixaIe` | `max` | `maximo` |
| `FaixaIe` | `add` | `acrescimo` |
| `FaixaIe` | `map` | `troca` |
| `CalculoDvIe` | `at` | `posicao` |
| `CalculoDvIe` | `over` | `posicoesSomadas` |
| `CalculoDvIe` | `weights` | `pesos` |
| `CalculoDvIe` | `mod` | `modulo` |
| `CalculoDvIe` | `result` | `resultado` |
| `CalculoDvIe` | `map` | `troca` |
| `CalculoDvIe` | `digitSum` | `somarAlgarismos` |
| `CalculoDvIe` | `times` | `multiplicador` |
| `CalculoDvIe` | `add` | `acrescimo` |
| `CalculoDvIe` | `ranges` | `faixas` |
| `VarianteIe` | `length` | `tamanho` |
| `VarianteIe` | `pattern` | `padrao` |
| `VarianteIe` | `mask` | `mascara` |
| `VarianteIe` | `legacy` | `legado` |
| `VarianteIe` | `checks` | `digitosVerificadores` |
| `RegraIeUf` | `sources` | `fontes` |
| `RegraIeUf` | `notes` | `notas` |
| `RegraIeUf` | `variants` | `variantes` |
| `DescricaoTabelaIe` | `schemaVersion` | `versaoDoFormato` |
| `DescricaoTabelaIe` | `version` | `versao` |
| `DescricaoTabelaIe` | `sources` | `fontes` |
| `InscricaoEstadual` | `kind` | `tipo` |
| `InscricaoEstadual` | `value` | `valor` |
| `InscricaoEstadual` | `formatted` | `formatada` |
| `InscricaoEstadual` | `variant` | `variante` |
| `InscricaoEstadual` | `legacy` | `legado` |
| `LerIeOpcoes` | `allowIsento` | `aceitarIsento` |
| `LerIeOpcoes` | `allowLegacy` | `aceitarLegado` |

Valores de união literal e textos:

| Tipo | Antigo | Novo |
|---|---|---|
| `CalculoDvIe` | `'complement'` | `'complemento'` |
| `CalculoDvIe` | `'remainder'` | `'resto'` |

Chaves dos JSON de dados:

| Arquivo | Antigo | Novo |
|---|---|---|
| `data/ie.json` | `schemaVersion` | `versaoDoFormato` |
| `data/ie.json` | `version` | `versao` |
| `data/ie.json` | `sources` | `fontes` |
| `data/ie.json` | `notes` | `notas` |
| `data/ie.json` | `variants` | `variantes` |
| `data/ie.json` | `length` | `tamanho` |
| `data/ie.json` | `pattern` | `padrao` |
| `data/ie.json` | `mask` | `mascara` |
| `data/ie.json` | `legacy` | `legado` |
| `data/ie.json` | `checks` | `digitosVerificadores` |
| `data/ie.json` | `at` | `posicao` |
| `data/ie.json` | `over` | `posicoesSomadas` |
| `data/ie.json` | `weights` | `pesos` |
| `data/ie.json` | `mod` | `modulo` |
| `data/ie.json` | `result` | `resultado` |
| `data/ie.json` | `map` | `troca` |
| `data/ie.json` | `digitSum` | `somarAlgarismos` |
| `data/ie.json` | `times` | `multiplicador` |
| `data/ie.json` | `add` | `acrescimo` |
| `data/ie.json` | `ranges` | `faixas` |
| `data/ie.json` | `slice` | `posicoes` |
| `data/ie.json` | `min` | `minimo` |
| `data/ie.json` | `max` | `maximo` |

Valores dos JSON de dados:

| Arquivo | Antigo | Novo |
|---|---|---|
| `data/ie.json` | `'complement'` | `'complemento'` |
| `data/ie.json` | `'remainder'` | `'resto'` |

Também mudam nesta versão:

- Parâmetros: `lerX(entrada, opcoes?)`, `formatarX(valor)`, `calcularDvIe(valor, calculo)`, `montarChaveAcesso(partes)`, `completarIe(base, uf, idDaVariante?)`.
- `src/data/ie.json`: as chaves seguem a tabela acima, e o `notes` do topo virou `notas`.
