# @sinete/ibs-cbs-dados

Dados oficiais do IBS e da CBS, versionados e com proveniência: CST, cClassTrib (tratamentos, reduções, alíquotas fixas, vínculo com cada DF-e, fundamentação na LC 214/2025, tudo com vigência), cCredPres, expressões de cálculo, aplicabilidade de NCM e NBS por anexo, atores, tipos de DF-e, redutor de compras governamentais e transferência da CBS. Extraído do SQLite da Calculadora offline da RFB e do IT 2025.002, fixados por hash (ADR 0007). Puro: roda em Node, Bun, Deno e no browser.

Status: pré-alfa, API instável até a 1.0.

```ts
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';

const ds = datasetEmbarcado();
ds.versaoDoConteudo; // '2026.09+V0059+v1.60+v1.60#f88dd50fda2b'
const at = ds.em('2026-10-10'); // visão na data do fato gerador
const rice = at.classTrib('200003');
at.reducao(rice!, 'CBS'); // '100'
at.ncmAplicavel(rice!, '10063021').resultado; // 'sim'
```

## Versões

O pacote é versionado pelo mês dos dados, `AAAA.M.patch` (`2026.9.1`), independente do código dos outros pacotes. `manifest.json` diz de onde veio cada tabela: fontes com URL, versão e sha256 (zip da Calculadora, `calculadora.tar.gz`, `.db`, `diff_id` da camada da imagem, planilhas do IT), `sha256DoDataset` sobre o JSON canônico de todas as tabelas e sha256 e contagem por tabela. `versaoDoConteudo` resume isso numa string curta, que vai em todo cálculo e em toda determinação, para reprocessar um documento com os dados da época.

## Carga em runtime

`@sinete/ibs-cbs-dados/embarcado` embarca o dataset. Para atualizar dados sem atualizar código, obtenha outro bundle (arquivo, URL) e passe por `conferirDataset` (confere os hashes do manifesto com WebCrypto) antes do `carregarDataset`. Bundle com `versaoDoFormato` diferente de `VERSAO_DO_FORMATO_DOS_DADOS` é recusado.

| Erro | `code` | Quando |
|---|---|---|
| `ErroDadosIbsCbs` | `ibscbs_dados_invalidos` | bundle sem manifest ou tabela, hash que não confere, vínculo para cClassTrib inexistente, data fora de `AAAA-MM-DD` |
| `ErroDadosIbsCbs` | `ibscbs_dados_versao_incompativel` | `versaoDoFormato` que este código não lê |

## Visão por data (`ConteudoTributario`)

`dataset.em(data)` só enxerga registros vigentes na data do fato gerador. A aplicabilidade de NCM e NBS (`ncmAplicavel`, `nbsAplicavel`) reproduz a tabela-verdade da Calculadora (`sim`, `nao`, `sem-restricao` para código sem anexo, `incompleta` para código curto) e diz qual vínculo e qual exceção decidiram; foi conferida contra `/ncm-aplicavel` e `/nbs-aplicavel`. `porAtores` filtra cClassTrib pelo par de atores com a mesma regra do `/por-atores`.

## Diff entre versões

`compararDatasets(a, b)` compara por `chave` estável e classifica cada mudança (fim de vigência, indicador de grupo, DF-e, redução ou alíquota, expressão de cálculo, texto); `formatarDiferenca` gera o texto do PR de atualização. A linha de comando fica em `tools/ibs-cbs-dados/diff.ts`.

## Atualizar os dados

`bun tools/ibs-cbs-dados/extract.ts` (veja `tools/ibs-cbs-dados/README.md`). O zip, a imagem e os JARs da Calculadora nunca entram no repo nem no pacote: só os fatos normativos extraídos, com a fonte.
