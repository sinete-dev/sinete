# Como gerar DANFE, DANFC-e, DAMDFE, DACCe e o DANFSe

O `@sinete/da` gera documentos auxiliares a partir do XML, em PDF ou em HTML com uma `<svg>` por página. No pacote `sinete`, os imports ficam em `sinete/da/...`. A geração é determinística: o mesmo XML, com as mesmas opções, gera os mesmos bytes em Node, Bun, Deno e no navegador, sem navegador automatizado, fonte embutida nem dependência nativa. Cada documento tem um caminho de importação próprio, para carregar apenas os leiautes necessários.

| Documento | Import | Entrada |
|---|---|---|
| DANFE, documento auxiliar da Nota Fiscal Eletrônica (NF-e), em retrato, paisagem, Simplificado, Etiqueta ou Simplificado Tipo 2 | `danfe` de `sinete/da/nfe` | `nfeProc`, XML da nota com o protocolo, ou `NFe` sem protocolo, com a marca correspondente à situação |
| DANFC-e, documento auxiliar da Nota Fiscal de Consumidor Eletrônica (NFC-e), em bobina | `danfce` de `sinete/da/nfce`, ou `danfe` de `sinete/da/nfe` | `nfeProc` da NFC-e, ou `NFe` sem protocolo em contingência |
| DAMDFE, documento auxiliar do Manifesto Eletrônico de Documentos Fiscais (MDF-e) | `damdfe` de `sinete/da/mdfe` | `mdfeProc`, XML do manifesto com o protocolo, ou `MDFe` assinado em contingência |
| DACCe, documento auxiliar da Carta de Correção Eletrônica (CC-e) | `dacce` de `sinete/da/cce` | `procEventoNFe` da CC-e, XML do evento com o retorno do registro; a nota é opcional |
| DANFSe v2, documento auxiliar da Nota Fiscal de Serviço Eletrônica (NFS-e) Nacional | `danfse` de `sinete/da/nfse` | `NFSe` autorizado pela Secretaria de Finanças Nacional (Sefin Nacional), com a Declaração de Prestação de Serviços (DPS) dentro |

## Pelo emissor

Os emissores de NF-e e de MDF-e geram o PDF diretamente do campo `proc`, que contém o XML com o protocolo de autorização no resultado de `emitir`:

```ts
import { createNfeEmissor } from 'sinete/emissor/nfe';

const nfe = await createNfeEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const d = await nfe.emitir('pedido-42', nota);
if (d.tipo === 'autorizado') await guardarPdf('pedido-42', await nfe.pdf(d.proc, { formato: 'paisagem' }));
```

`pdfCancelado(proc, procEvento)` gera o mesmo documento com a marca de cancelado e o protocolo do evento de cancelamento. O `@sinete/da` é uma dependência opcional do tipo `peerDependency` do `@sinete/emissor`: o pacote `sinete` já o inclui; com os pacotes avulsos, instale `@sinete/da`. Em Node e Bun, o emissor o importa na primeira chamada; sem o pacote nem um módulo fornecido pela opção `da`, `pdf()` lança `ConfigError`. No navegador e no Deno, importe o módulo de forma estática e passe-o na opção `da`:

```ts
import * as da from 'sinete/da/nfe';
import { createNfeEmissor } from 'sinete/emissor/nfe';

const nfe = await createNfeEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir, da });
```

## Direto do XML

```ts
import { damdfe } from 'sinete/da/mdfe';
import { danfe, toHtml, toPdf } from 'sinete/da/nfe';
import { danfse } from 'sinete/da/nfse';

const doc = danfe(nfeProc, { logo: pngOuJpeg, cancelamento: procEventoCancelamento });
const pdf: Uint8Array = toPdf(doc); // PDF 1.4, determinístico
const html: string = toHtml(doc); // pronto para window.print()

const damdfePdf = toPdf(damdfe(mdfeProc, { documentos: true }));
const danfsePdf = toPdf(danfse(nfseXml));
```

- **Formato.** Sem `formato`, o modelo 65 (NFC-e) sai como DANFC-e, e o modelo 55 (NF-e) segue o `tpImp`, campo que indica o formato de impressão: 2 para paisagem, 3 para Simplificado, 6 para Simplificado Tipo 2 e os demais valores para retrato. Um formato que não se aplica ao modelo lança `DanfeError` com código `formato_incompativel`.
- **Marcas.** Na emissão normal, sem protocolo de autorização: "SEM VALOR FISCAL". NF-e ou NFC-e denegada, isto é, com o uso negado pelo fisco: "DENEGADA", com o motivo e o protocolo de denegação. Sem protocolo, a marca "EMITIDA EM CONTINGÊNCIA" aparece nas formas de emissão em formulário de segurança (`tpEmis` 2 ou 5), na emissão off-line (`tpEmis` 9) ou no Evento Prévio de Emissão em Contingência (EPEC, `tpEmis` 4) com o protocolo informado em `epec.nProt`. Na Sefaz Virtual de Contingência (SVC) ou no EPEC sem esse registro, a ausência de protocolo resulta em "SEM VALOR FISCAL". No DAMDFE em contingência (`tpEmis` 2), a marca é "EMISSÃO EM CONTINGÊNCIA". As marcas de contingência incluem "PENDENTE DE AUTORIZAÇÃO". Em homologação, ambiente de testes, "SEM VALOR FISCAL" acompanha as outras marcas. O cancelamento tem precedência sobre as marcas de situação: "CANCELADA" na NF-e e na NFC-e, "CANCELADO" no MDF-e. Ele pode vir do evento, pela opção `cancelamento` na NF-e e na NFC-e ou `cancelado` no MDF-e, ou do `cStat`, código de situação gravado no protocolo: 101, 151 ou 155 na NF-e e na NFC-e; 101 no MDF-e. As regras e suas fontes, incluindo o Manual de Orientação do Contribuinte (MOC) 7.0, Anexo II e Visão Geral, estão no registro de decisão arquitetural ADR 0006 do sinete.
- **IBS/CBS no DANFE A4.** A implementação adota um quadro provisório para o Imposto sobre Bens e Serviços (IBS), a Contribuição sobre Bens e Serviços (CBS) e o Imposto Seletivo (IS). A referência usada pelo código, a Nota Técnica (NT) 2025.002 v1.51, item 9, descreve o leiaute com os novos tributos como "em estudo". Os totais do grupo W03, incluindo `IBSCBSTot`, `ISTot` e `vNFTot`, aparecem num quadro próprio abaixo do cálculo do imposto quando há `IBSCBSTot` ou `ISTot`; `ibsCbs: false` suprime esse quadro.
- **Logotipo.** PNG ou JPEG; outro formato lança `DanfeError` com código `imagem_invalida`.
- **Texto fora do CP1252.** O PDF usa as fontes padrão com a codificação WinAnsi (CP1252): um caractere fora desse repertório perde o diacrítico, quando isso permite representá-lo, ou vira `?`.

## DANFSe

Conforme a NT SE/CGNFS-e 008/2026, item 1, adotada pela implementação, a API de geração do DANFSe do Ambiente de Dados Nacional (ADN) foi suspensa em 03/08/2026. O DANFSe v2 é gerado localmente pelo `@sinete/da/nfse`, a partir do `NFSe` que a Sefin Nacional devolve na emissão ou na consulta.

```ts
import { danfse, toPdf } from 'sinete/da/nfse';

const pdf = toPdf(danfse(nfseXml, { canhoto: false }));
const cancelada = toPdf(danfse(nfseXml, { cancelamento: eventoCancelamentoXml }));
const substituida = toPdf(danfse(nfseXml, { substituicao: eventoSubstituicaoXml }));
```

- **Leiaute.** Segue o Anexo I da NT 008/2026 v1.02, em A4 retrato e numa única página (item 2.2). A descrição do serviço e as informações complementares dividem a altura disponível; quando não cabem, terminam em reticências. A linha dos tributos aproximados, prevista na Lei 12.741/2012, não é cortada. O pacote de esquemas XML, versão 1.01 de 20260209 ou de 20260727, é selecionado pela data e pelo ambiente da DPS.
- **Marcas.** Em produção restrita, o ambiente de testes identificado por `tpAmb` 2, aparece "NFS-e SEM VALIDADE JURÍDICA" em vermelho no cabeçalho (item 2.4.3). Notas canceladas e substituídas recebem marca d'água (itens 2.5.1 e 2.5.2), mas o XML da NFS-e não muda depois do cancelamento. Passe o XML do `evento` registrado pela Sefin: `cancelamento` aceita e101101, e105104 ou e305101; `substituicao` aceita e105102. As duas opções também aceitam `true` para aplicar a marca sem fornecer o evento. Um evento de outro tipo ou de outra chave, ou as duas marcas solicitadas juntas, lança `DanfeError` com código `evento_incompativel`.
- **Nome dos municípios.** O gerador aproveita os nomes presentes no XML para os municípios de emissão, prestação e incidência, incluindo a localidade de incidência de IBS/CBS quando informada. Nos endereços nacionais, usa esses nomes quando o código coincide. Para os demais municípios, imprime o código do Instituto Brasileiro de Geografia e Estatística (IBGE) e a sigla do estado (UF), a menos que você forneça o nome pela opção `nomeMunicipio: (codigo) => nome`.
- **Pelo emissor de NFS-e.** `pdf(d.proc)` gera o DANFSe a partir do XML do resultado autorizado, sem acesso à rede. `pdfCancelado(nfse, evento)` aplica "CANCELADA" ou "SUBSTITUÍDA", conforme o evento registrado; para um cancelamento, use o campo `xml` do resultado confirmado de `cancelar`. Para quem não guardou o XML, `pdfPorChave(chave)` consulta a NFS-e e os eventos de cancelamento e substituição na Sefin, na sequência 1, e aplica a marca encontrada. São até cinco consultas; se a Sefin não conhecer a chave, o retorno é `undefined`. O `@sinete/da` é carregado como nos outros emissores: no navegador e no Deno, importe `sinete/da/nfse` de forma estática e passe o módulo na opção `da`.

## Armadilhas

- **Guardar só o PDF.** O documento fiscal é o XML (`nfeProc`, `mdfeProc`, `NFSe` ou o XML do evento registrado); o PDF pode ser gerado novamente quando necessário.
- **XML reserializado.** O `@sinete/da` lê o XML com um decodificador tolerante e gera o documento auxiliar, mas você deve guardar a string autorizada original, sem reformatá-la.
- **Evento de outro documento.** `pdfCancelado` e `dacce`, quando recebe a nota na opção `nfe`, recusam eventos de outra chave com o código `evento_incompativel`; cabe à aplicação decidir se mantém o PDF antigo.

## Veja também

- [Cancelamento](cancelamento.md) e [carta de correção](carta-de-correcao.md).
- Referência: [`@sinete/da`](../referencia/da.md).
