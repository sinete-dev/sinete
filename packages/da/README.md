# Documentos auxiliares: DANFE, DANFC-e, DAMDFE, DACCe, DANFSe

`@sinete/da`: os documentos auxiliares dos DF-e a partir do XML autorizado, em PDF e em HTML/SVG. DANFE da NF-e (retrato, paisagem, Simplificado, Simplificado - Etiqueta e Simplificado Tipo 2), DANFC-e (o DANFE NFC-e), DAMDFE, DACCe e DANFSe v2 da NFS-e Nacional; o DACTE entra aqui quando chegar. Roda em Node (`^20.19.0 || >=22.12.0`), Bun, Deno e no browser, sem browser headless, sem fonte embutida e sem dependência nativa. A mesma entrada gera os mesmos bytes em qualquer runtime.

Status: pré-alfa, API instável até a 1.0.

## Um subpath por documento

| Entrada | O que tem |
|---|---|
| `@sinete/da/nfe` | `danfe`: DANFE da NF-e em todos os formatos; aceita também a NFC-e, para quem imprime os dois modelos pela mesma chamada |
| `@sinete/da/nfce` | `danfce`: só o DANFE NFC-e, sem os layouts A4 e Simplificado |
| `@sinete/da/mdfe` | `damdfe`: DAMDFE, sem nenhum layout nem schema da NF-e |
| `@sinete/da/cce` | `dacce`: DACCe da Carta de Correção |
| `@sinete/da/nfse` | `danfse`: DANFSe v2 da NFS-e Nacional, sem nenhum layout nem schema da NF-e |
| `@sinete/da` | o que é comum: `toPdf`, `toHtml`, `toSvg`, o modelo `Doc`, `DanfeError`, CODE-128 e QR Code |

Cada subpath reexporta os renderizadores, então um import basta. Quem importa só `@sinete/da/mdfe` ou `@sinete/da/nfse` não leva ao bundle o layout nem o schema da NF-e: `test/subpaths.test.ts` confere isso no fonte e a smoke confere no pacote publicado, com o `@sinete/schemas` dentro do bundle. Raiz e subpaths saem do mesmo build com splitting, então `DanfeError` é uma classe só por qualquer caminho.

```ts
import { danfe, toHtml, toPdf } from '@sinete/da/nfe';
import { dacce } from '@sinete/da/cce';
import { damdfe } from '@sinete/da/mdfe';
import { danfce } from '@sinete/da/nfce';
import { danfse } from '@sinete/da/nfse';

const doc = danfe(nfeProcXml); // formato pelo XML: modelo 65 é NFC-e; no 55, pelo tpImp
const pdf: Uint8Array = toPdf(doc); // PDF 1.4, determinístico
const html: string = toHtml(doc); // uma <svg> por página, pronta para window.print()

danfe(nfeProcXml, { formato: 'paisagem', logo: pngOuJpeg, cancelamento: procEventoCancelamentoXml });
danfce(nfceProcXml, { largura: 58, via: 'estabelecimento' }); // ou danfe(nfceProcXml, { ... })
dacce(procEventoCceXml, { nfe: nfeProcXml });
damdfe(mdfeProcXml, { documentos: true, cancelado: procEventoMDFeCancelamentoXml });
danfse(nfseXml, { cancelamento: eventoCancelamentoNfseXml, canhoto: false });
```

Até a reorganização dos pacotes (ADR 0008), era o `@sinete/danfe`, com tudo na raiz.

## Formatos

| `formato` | Documento | Origem do leiaute |
|---|---|---|
| `retrato` | DANFE A4 retrato, folhas soltas | MOC 7.0, Anexo II, 3.8.1 e Anexo III.02 |
| `paisagem` | DANFE A4 paisagem, folhas soltas | MOC 7.0, Anexo II, 3.8.2 e Anexo III.04 |
| `simplificado` | DANFE Simplificado (`tpImp` 3) | MOC 7.0, Anexo II, 3.11 |
| `etiqueta` | DANFE Simplificado - Etiqueta | MOC 7.0, Anexo II, 3.12 (NT 2020.004) |
| `simplificado-tipo2` | DANFE Simplificado Tipo 2 (`tpImp` 6) | NT 2026.003 v1.00 e NT 2026.002 v1.10 |
| `nfce` ou `danfce()` | DANFE NFC-e (modelo 65) | Manual do DANFE NFC-e e QR Code; divisões iguais às da NT 2026.003 |
| `dacce()` | DACCE (evento 110110) | convenção de mercado: o MOC não define leiaute |
| `damdfe()` | DAMDFE, modais rodoviário, aéreo, aquaviário e ferroviário | MOC MDF-e 3.00a, Anexo II |
| `danfse()` | DANFSe v2, A4 retrato numa página | NT SE/CGNFS-e 008/2026 v1.02, Anexo I e tabela do 2.4.5 |

Sem `formato`, o modelo 65 vai para `nfce` e o 55 segue o `tpImp`: 2 paisagem, 3 simplificado, 6 Tipo 2, o resto retrato. Formato que não se aplica ao modelo é `formato_incompativel`.

## O que cada documento cobre

- **DANFE A4**: canhoto (suprimível; na paisagem, na lateral), cabeçalho com logotipo opcional, campos variáveis por forma de emissão (protocolo; FS-IA e FS-DA com o segundo código de barras "Dados da NF-e" de 36 dígitos; EPEC com o protocolo do evento em `epec`), destinatário, locais de retirada e entrega quando existem, fatura e duplicatas em grade de até três linhas (o excesso vai para as informações complementares), cálculo do imposto, quadro de IBS/CBS/IS, transportador, produtos com as colunas na ordem do MOC (colunas de ST quando algum item tem ST), ISSQN quando existe, dados adicionais. Folhas adicionais repetem o cabeçalho e continuam itens e informações complementares com as mesmas colunas; "FOLHA x/y" em todas.
- **IBS/CBS/IS**: o DANFE A4 com os novos tributos "está em estudo" (NT 2025.002 v1.51, item 9). Até a publicação, os totais do grupo W03 (`IBSCBSTot`, `ISTot`, `vNFTot`) saem num quadro próprio abaixo do cálculo do imposto; `ibsCbs: false` suprime. Na NFC-e e no Tipo 2, a divisão III-A da NT 2026.003.
- **Marcas** (ADR 0006, decisão 14), atrás do conteúdo (MOC 3.10.1), em todos os formatos e no DAMDFE:
  - sem protocolo de autorização na emissão normal (prévia, XML sem `protNFe`, SVC sem protocolo, EPEC sem o protocolo do evento em `epec`, cStat que não é de autorização): "SEM VALOR FISCAL", também no corpo do documento;
  - denegada (cStat 110, 301, 302 e 303): "DENEGADA", com o motivo da tabela 4.4.3 do Anexo I e o protocolo de denegação, que vai no campo do protocolo com o título "PROTOCOLO DE DENEGAÇÃO DE USO";
  - contingência com a autorização por vir (FS-IA, FS-DA, off-line, EPEC registrado): "EMITIDA EM CONTINGÊNCIA" e "Pendente de autorização" (no DAMDFE, "EMISSÃO EM CONTINGÊNCIA"), sem "SEM VALOR FISCAL", porque o documento vale;
  - homologação: "SEM VALOR FISCAL" somado ao que houver;
  - cancelamento: "CANCELADA", com o protocolo do `procEventoNFe` 110111 ou 110112, que precisa ser da mesma chave e registrado. Tem precedência sobre as outras.
  - cancelada pelo protocolo (ADR 0006, decisão 15): `protNFe` com cStat 101, 151 ou 155, como gravam os sistemas que importam a nota, sai "CANCELADA", sem "SEM VALOR FISCAL", com o `nProt` no campo do protocolo de autorização. Se o evento de cancelamento também for passado, o carimbo é o do evento, com o protocolo dele.
  - O MDF-e não tem denegação (MOC MDF-e 3.00b, Visão Geral, 4.2.6): `protMDFe` com cStat 101 sai "CANCELADO", com 132 (encerrado) sai como autorizado, e com qualquer outro diferente de 100 sai como sem protocolo. O `cancelado` do `damdfe` aceita o `procEventoMDFe` do cancelamento (110111, da mesma chave e com retorno 135, 134 ou 136), que dá o protocolo e a data do evento ao carimbo, como o `procEventoNFe` no DANFE; o objeto `{ nProt, dhRegEvento }` e o `true` continuam valendo.
- **DANFSe v2** (ADR 0006, decisão 16): entrada pelo `NFSe` autorizado, com a DPS dentro, nos pacotes de esquemas 1.01 de 20260209 e de 20260727 (escolhido pela data e pelo ambiente da DPS). Página única: descrição do serviço e informações complementares dividem a altura que sobra e terminam em reticências, sem cortar a linha dos tributos aproximados; conteúdo sempre em 7 pt. Blocos sem dados viram a frase da NT, o canhoto é opcional (`canhoto: false`), e o nome dos municípios que o XML não traz vem de `nomeMunicipio`. QR de 15,2 mm com a consulta pública do Portal Nacional. Produção restrita: "NFS-e SEM VALIDADE JURÍDICA" em vermelho no cabeçalho. Cancelada e substituída: marca d'água pelo `evento` registrado (`cancelamento`: e101101, e105104 ou e305101; `substituicao`: e105102) ou por `true`.
- **Logotipo**: PNG (todas as profundidades e tipos de cor, entrelaçado, paleta, transparência) ou JPEG (entra no PDF sem decodificar). Outro formato é `imagem_invalida`.

## Decisões (ADR 0006)

- **Layout como função pura** do XML para um `Doc` (páginas de operações em mm); `toPdf`, `toHtml` e `toSvg` só desenham. O `Doc` é público e serve para inspecionar ou escrever outro backend.
- **Entrada pelo `@sinete/schemas`**: o XML é lido pelo decoder tolerante (PL_010f da NF-e, 3.00b do MDF-e, PL_010d dos eventos, 1.01 da NFS-e), nunca por parse próprio. Elemento desconhecido não impede o documento.
- **Encaixe de texto** (decisão 7): uma linha no tamanho nominal; senão, reduz em passos de 0,25 pt até 6 pt; senão, quebra em linhas de 6 pt até onde a altura deixa; só então corta com reticências. `doc.stats` conta os textos de dado reduzidos, quebrados e cortados.
- **Escritor PDF próprio** com as fontes padrão (Times no DANFE, como pede o MOC 3.7; Helvetica na bobina, no DAMDFE e no DANFSe, no lugar da Arial da NT 008/2026) em WinAnsi. Texto fora do CP1252 perde o diacrítico ou vira `?`.
- **CODE-128 e QR Code próprios**, da norma (ISO/IEC 15417 e 18004), sem dependência. A chave sai em CODE-128C; com CNPJ alfanumérico, no híbrido C/A da NT 2025.001 (`code128Chave`). O QR vai em UTF-8, nível M, com a zona de silêncio dentro do quadrado mínimo de 25 mm.
- Medidas e textos que o MOC e as NTs fixam ficam em `src/data/`, com a origem: `leiaute.ts` com o que é comum e um arquivo por documento (`leiaute-a4.ts`, `leiaute-bobina.ts`, `leiaute-mdfe.ts`, `leiaute-danfse.ts`), para que um subpath não leve os dados de outro.

## Erros

`DanfeError` (`ErroSinete`) com `code`: `xml_invalido`, `documento_inesperado`, `campo_ausente` (ex.: NFC-e sem `infNFeSupl/qrCode`), `evento_incompativel`, `formato_incompativel`, `imagem_invalida`, `codigo_barras_invalido`.

## Testes

- `bun test packages/da`: unidades, layout de todas as fixtures sintéticas (`test/fixtures.ts` e `test/fixtures-nfse.ts`), QR igual ao do `qrcode-generator` na mesma máscara em todas as versões e níveis, leitura com `zbarimg` quando instalado.
- Regressão visual (`test/vr.test.ts`): o sha256 do PDF de cada caso bate com `test/vr/golden/manifest.json` em qualquer máquina; onde o `pdftoppm` tem a versão do manifesto, cada página é rasterizada (100 dpi, cinza, sem antialias) e comparada com a golden pelo `pixelmatch`, com zero pixel de diferença. Para atualizar: `SINETE_VR_UPDATE=1 bun test packages/da/test/vr.test.ts` e revisar as PNGs na PR. As goldens vêm só de fixtures sintéticas.
- `bun packages/da/test/render-local.ts <dir>`: renderiza os casos em PDF, HTML e PNG para olhar.
- Corpus real (local, só agregados): `tools/danfe-corpus`.

## Fora do escopo por enquanto

DANFSe das operações que passaram a ter NFS-e com o IBS e a CBS (a NT 008/2026 promete nota técnica própria), formulário contínuo (Anexos III.03 e III.05), fonte embutida para PDF/A e texto fora do Latin-1.

## Licença

Apache-2.0.
