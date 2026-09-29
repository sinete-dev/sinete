# @sinete/ibs-cbs-dados

Dados oficiais do IBS e da CBS, versionados e com proveniência: CST, cClassTrib (tratamentos, reduções, alíquotas fixas, vínculo com cada DF-e, fundamentação na LC 214/2025, tudo com vigência), cCredPres, expressões de cálculo, aplicabilidade de NCM e NBS por anexo, atores, tipos de DF-e, redutor de compras governamentais e transferência da CBS. Extraído do SQLite da Calculadora offline da RFB e do IT 2025.002, fixados por hash (ADR 0007). Puro: roda em Node, Bun, Deno e no browser.

Status: pré-alfa, API instável até a 1.0.

```ts
import { bundledDataset } from '@sinete/ibs-cbs-dados/bundled';

const ds = bundledDataset();
ds.contentVersion; // '2026.09+V0057+v1.60+v1.60#2ec26a84383c'
const at = ds.at('2026-10-10'); // visão na data do fato gerador
const rice = at.classTrib('200003');
at.reduction(rice!, 'CBS'); // '100'
at.applicableNcm(rice!, '10063021').result; // 'yes'
```

## Versões

O pacote é versionado pelo mês dos dados, `AAAA.M.patch` (`2026.9.1`), independente do código dos outros pacotes. `manifest.json` diz de onde veio cada tabela: fontes com URL, versão e sha256 (zip da Calculadora, `calculadora.tar.gz`, `.db`, `diff_id` da camada da imagem, planilhas do IT), `datasetSha256` sobre o JSON canônico de todas as tabelas e sha256 e contagem por tabela. `contentVersion` resume isso numa string curta, que vai em todo cálculo e em toda determinação, para reprocessar um documento com os dados da época.

## Carga em runtime

`@sinete/ibs-cbs-dados/bundled` embarca o dataset. Para atualizar dados sem atualizar código, obtenha outro bundle (arquivo, URL) e passe por `verifyDataset` (confere os hashes do manifest com WebCrypto) antes do `loadDataset`. Bundle com `dataSchemaVersion` diferente de `DATA_SCHEMA_VERSION` é recusado.

| Erro | `code` | Quando |
|---|---|---|
| `IbsCbsDataError` | `ibscbs_dados_invalidos` | bundle sem manifest ou tabela, hash que não confere, vínculo para cClassTrib inexistente, data fora de `AAAA-MM-DD` |
| `IbsCbsDataError` | `ibscbs_dados_versao_incompativel` | `dataSchemaVersion` que este código não lê |

## Visão por data (`TaxContent`)

`dataset.at(data)` só enxerga registros vigentes na data do fato gerador. A aplicabilidade de NCM e NBS (`applicableNcm`, `applicableNbs`) reproduz a tabela-verdade da Calculadora (`yes`, `no`, `not-restricted` para código sem anexo, `incomplete` para código curto) e diz qual vínculo e qual exceção decidiram; foi conferida contra `/ncm-aplicavel` e `/nbs-aplicavel`. `byActors` filtra cClassTrib pelo par de atores com a mesma regra do `/por-atores`.

## Diff entre versões

`diffDatasets(a, b)` compara por `key` estável e classifica cada mudança (fim de vigência, indicador de grupo, DF-e, redução ou alíquota, expressão de cálculo, texto); `formatDiff` gera o texto do PR de atualização. A linha de comando fica em `tools/ibs-cbs-dados/diff.ts`.

## Atualizar os dados

`bun tools/ibs-cbs-dados/extract.ts` (veja `tools/ibs-cbs-dados/README.md`). O zip, a imagem e os JARs da Calculadora nunca entram no repo nem no pacote: só os fatos normativos extraídos, com a fonte.
