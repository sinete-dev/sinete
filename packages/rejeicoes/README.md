# @sinete/rejeicoes

Catálogo versionado das rejeições e denegações da SEFAZ para NF-e e NFC-e: código (`cStat` de 3 ou 4 dígitos), mensagem oficial, modelos, regra de validação de origem, categoria e, nos códigos mais comuns, causa provável e correção. Sem dependências além do `@sinete/core` e sem API de runtime: roda em Node (`^20.19.0 || >=22.12.0`), Bun, Deno e no browser.

Status: pré-alfa, API instável até a 1.0.

```ts
import { criarRecusado } from '@sinete/core';
import { completarRecusado, rejeicaoPorCodigo } from '@sinete/rejeicoes';

rejeicaoPorCodigo('1037');
// { codigo: '1037', mensagem: 'Alíquota da CBS inválida [nItem: 999]', categoria: 'reforma',
//   regras: [{ documento: 'nt2025002', id: 'UB56-10' }, ...], causaProvavel: '...', comoCorrigir: '...' }

const r = completarRecusado(criarRecusado({ cStat: '204', xMotivo: 'Rejeição: Duplicidade de NF-e' }));
r.dica; // { causaProvavel, comoCorrigir, fonte: 'MOC 7.0 Anexo I, RV 2B08-20' }, sem orientacao: 204 é reenvio do sistema
```

## API

- `rejeicaoPorCodigo(cStat)`: a entrada do catálogo ou `undefined`.
- `REJEICOES`: todas as entradas em ordem numérica; `TABELA_REJEICOES`: versão e documentos de origem (URL no Portal da NF-e e sha256 do PDF).
- `dicaRejeicao(cStat)`: o `DicaRejeicao` do core, só para códigos com curadoria; traz a `orientacao` quando a entrada tem. `causaProvavel` e `comoCorrigir` são para quem integra; a `orientacao` é o que vai para a tela de quem emite.
- `completarRecusado(desfecho)` e `completarResultado(desfecho)`: preenchem a `dica` de um desfecho `recusado` sem sobrescrever uma `dica` existente.

## Entrada do catálogo

| Campo | Conteúdo |
|---|---|
| `codigo` | `cStat` como no XML |
| `efeito` | `rejeicao` ou `denegacao` (301, 302 e 303: o número fica consumido) |
| `mensagem` | mensagem oficial sem o prefixo "Rejeição:", com os marcadores do documento; `mensagens` quando o documento dá mais de uma para o mesmo código (640, 641, 701, 721) |
| `modelos` | `55` e/ou `65`, das regras em que o código aparece; sem regra localizada, os dois |
| `fonte` | documento e tabela ou regra de origem (`MOC 7.0 Anexo I, tabela 4.4.2`, `NT 2025.002 v1.40, regra UB13-10`) |
| `regras` | todas as regras de validação que emitem o código, com o documento |
| `categoria` | `schema`, `assinatura`, `certificado`, `cadastro`, `regra-negocio`, `duplicidade` ou `reforma` |
| `causaProvavel`, `comoCorrigir`, `referencia` | curadoria manual, sempre com a regra citada; ausente nos demais códigos |
| `orientacao` | texto para quem emite a nota (produtor, contador, atendente): uma ou duas frases, sem termo de integração, com o que aconteceu e o que mudar na nota, no cadastro ou junto à SEFAZ; só nos códigos curados em que a correção está na mão de quem emite (falhas do sistema emissor, como schema, assinatura, duplicidade por reenvio e cálculo, ficam sem ela) |

## De onde vem

`src/data/rejeicoes.json` é gerado por [`tools/rejeicoes-data`](../../tools/rejeicoes-data/README.md) a partir do MOC 7.0 Anexo I (tabelas 4.4.2 e 4.4.3 e corpo das regras de validação) e da NT 2025.002 v1.40 (regras da reforma tributária, faixa 1000 em diante), mais os códigos de outras NT que a curadoria lista em `adicionais` (853 da NT 2025.001 v1.03, 836 da NT 2024.003 v1.10) e os códigos da NFC-e que só as tabelas de mensagens da NT 2025.001 v1.03 (QR Code versão 3) e da NT 2023.002 v1.01 (lote de uma NFC-e) trazem, com o sha256 de cada PDF conferido e a linha da regra achada no texto. A categoria é uma heurística sobre a mensagem, corrigida à mão na curadoria quando precisa. Não edite o JSON à mão: mude a curadoria ou o builder e gere de novo.

## MDF-e (`@sinete/rejeicoes/mdfe`)

Os códigos do MDF-e colidem com os da NF-e com outro significado (611 e 686 são bloqueios por MDF-e não encerrado; 220 é o prazo de 24 horas do cancelamento do MDF-e), então o catálogo do modelo 58 é outro e mora numa entrada própria, que quem não emite MDF-e não carrega: `rejeicaoMdfePorCodigo`, `REJEICOES_MDFE`, `TABELA_REJEICOES_MDFE`, `dicaRejeicaoMdfe`, `completarRecusadoMdfe` e `completarResultadoMdfe`, com a mesma forma de entrada (`modelos` é `['58']` e todo código é rejeição, porque o MDF-e não tem denegação).

`src/data/rejeicoes-mdfe.json` é gerado por `tools/rejeicoes-data/mdfe.ts`. O MDF-e não tem tabela consolidada como a 4.4.2: o catálogo é a união das regras de validação do MOC MDF-e 3.00b (Anexo I, grupo F; Visão Geral, grupos A a K e consumo indevido) e das NT 2024.001 v1.02, 2024.002 v1.01, 2025.001 v1.03 e 2026.001 v1.00 (a NT 2023.001 só desliga regras e não traz código novo). Código que aparece em regras com textos diferentes traz todos em `mensagens` (o 684 do MOC e o da NT 2026.001; o 524 e o 525, que a NT 2024.001 usa no encerramento por terceiro e a 2024.002 na prestação parcial).

Fora do catálogo por ora: os `cStat` de sucesso e processamento (tabela 4.4.1 da NF-e; no MDF-e, 100, 101, 132, 135 e afins), as rejeições de CT-e e as NT da NF-e posteriores à 2025.002 v1.40, fora os códigos avulsos de `adicionais`.

## NFS-e Nacional (`@sinete/rejeicoes/nfse`)

A NFS-e Nacional não usa `cStat` numérico: a Sefin e o ADN respondem com uma lista de erros com código `E` e 4 dígitos (`E0312`) e descrição. O subpath `@sinete/rejeicoes/nfse` cataloga esses códigos, e no desfecho `recusado` do core o código vai no `cStat` (o `ehCStat` aceita as duas formas).

```ts
import { criarRecusado } from '@sinete/core';
import { completarRecusadoNfse, nfseErroPorCodigo } from '@sinete/rejeicoes/nfse';

nfseErroPorCodigo('E0312');
// { codigo: 'E0312', mensagem: 'O código de tributação nacional informado não está administrado...', nivel: '3',
//   categoria: 'parametrizacao-municipal', regras: [{ documento: 'anexo-i', aba: 'RN DPS_NFS-e', linha: '317',
//   caminho: 'NFSe/infNFSe/DPS/infDPS/serv/cServ/cTribNac', nivel: '3', regra: '...' }], causaProvavel: '...' }

completarRecusadoNfse(criarRecusado({ cStat: 'E1229', xMotivo: 'Xml não está utilizando codificação UTF-8.' })).dica;
```

- `nfseErroPorCodigo(codigo)` (aceita espaço e minúscula), `NFSE_ERROS` (em ordem de código), `TABELA_ERROS_NFSE` (versão e planilhas de origem com URL e sha256), `NFSE_ERRO_CATEGORIAS`.
- `dicaRejeicaoNfse(codigo)` e `completarRecusadoNfse(desfecho)`, como os equivalentes da NF-e.

| Campo | Conteúdo |
|---|---|
| `codigo` | código de erro, `E` e 4 dígitos |
| `mensagem` | coluna "MSG. ERRO" da planilha, com espaços normalizados; `mensagens` quando o mesmo código aparece com textos diferentes (E1570) |
| `nivel` | menor nível entre as regras: 1 consistência do leiaute, 2 regra geral, 3 parametrização do município; ausente nas regras de recepção |
| `regras` | cada regra que emite o código: anexo, aba, linha (coluna #), caminho do campo no XML, nível e o texto da regra |
| `categoria` | `recepcao`, `schema`, `assinatura`, `certificado`, `cadastro`, `parametrizacao-municipal`, `regra-negocio`, `duplicidade`, `evento` ou `reforma` |
| `fonte` | anexo, versão e aba da primeira regra |
| `causaProvavel`, `comoCorrigir`, `referencia` | curadoria manual (E1229, E0312, assinatura, certificado, área de dados, versão e duplicidade), com a linha da planilha citada |

O catálogo da NFS-e ainda não tem `orientacao`: a curadoria dele é outra (planilhas, chave `entradas`) e cobre sobretudo falhas do sistema emissor.

`src/data/nfse-erros.json` é gerado por `tools/rejeicoes-data/nfse.ts` das planilhas do Anexo I v1.01 (20260209: abas RN_RECEPCAO_DPS e RN DPS_NFS-e) e do Anexo II v1.01 (20260122: aba RN EVENTO_PED.REG.EVENTO), da Documentação Atual do Portal NFS-e. São 496 códigos. Os códigos de sucesso da NFS-e (`cStat` 100, 101, 102 dentro do XML da nota) não entram: são status, não erro.

## Licença

Apache-2.0.
