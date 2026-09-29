# Referência: `@sinete/da`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/da/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/da/x` é `sinete/da/x`.

## `@sinete/da`

`@sinete/da`: documentos auxiliares dos DF-e a partir do XML autorizado (ADR 0006). A raiz tem o que é comum a todos (renderizadores, modelo do documento, códigos de barras e erros); cada documento está no próprio subpath, para que quem importa um não leve ao bundle o layout dos outros: `@sinete/da/nfe` (DANFE), `@sinete/da/nfce` (DANFE NFC-e), `@sinete/da/mdfe` (DAMDFE) e `@sinete/da/cce` (DACCE).

O layout é uma função pura do XML para um `Doc` (páginas de operações em mm); `toPdf` e `toHtml`/`toSvg` só desenham. A mesma entrada gera os mesmos bytes em Node, Bun, Deno e no browser: sem data de criação, sem fonte embutida, sem dependência nativa.

### Funções

- `code128C`: Larguras (em módulos) de Start C, dados, dígito verificador módulo 103 (MOC 2.1) e Stop, começando por barra. Exige quantidade par de dígitos. `code128C(digits: string): number[]`
- `code128Chave`: Código de barras da chave de acesso, numérica ou com CNPJ alfanumérico (NT 2025.001 v1.00, seção 6): começa em Start C e codifica pares de dígitos; num caractere que não forma par de dígitos, troca para o subconjunto A (código 101) e segue caractere a caractere; volta ao C (código 99) quando o que resta até a próxima letra é um número par de dígitos, de 4 ou mais, ou o par final. `code128Chave(chave: string): number[]`
- `qrMatrix`: Matriz de módulos do QR Code de `text` (true = escuro), sem a zona de silêncio. `qrMatrix(text: string, options?: QrOptions): boolean[][]`
- `toHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `toHtml(doc: Doc): string`
- `toPdf`: Serializa o `Doc` num PDF 1.4. `toPdf(doc: Doc, options?: PdfOptions): Uint8Array`
- `toSvg`: Uma página como SVG autocontido, em mm. Passe o `doc` para que os logotipos entrem como data URI. `toSvg(page: Page, doc?: Doc): string`

### Classes

- `DanfeError` (estende `SineteError<DanfeErrorCode>`)

### Interfaces

- `BarsOp`: Código de barras: larguras alternadas barra/espaço, em módulos, começando por barra. Horizontal por padrão, com barras de altura `h` a partir de (`x`, `y`); `vertical` empilha as barras de cima para baixo, com comprimento `h`. Membros: `t`, `x`, `y`, `h`, `module`, `widths`, `vertical`.
- `CommonOptions`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `Doc`: Membros: `title`, `pages`, `images`, `stats`.
- `DocImage`: Imagem decodificada o bastante para os backends: JPEG vai inteiro (DCTDecode), PNG vai em amostras. Membros: `format`, `bytes`, `width`, `height`.
- `FitStats`: Contadores de encaixe de texto de um documento, para medir o layout no corpus. Membros: `reduzidos`, `quebrados`, `cortados`.
- `ImageOp`: Imagem (logotipo) já encaixada no retângulo; `ref` aponta para `Doc.images`. Membros: `t`, `x`, `y`, `w`, `h`, `ref`.
- `LineOp`: Membros: `t`, `x1`, `y1`, `x2`, `y2`, `w`, `dash`, `gray`.
- `Page`: Membros: `w`, `h`, `ops`.
- `PdfOptions`: Membros: `compress`, `info`.
- `QrOp`: QR Code: matriz de módulos escuros, desenhada num quadrado de lado `size` (sem a zona de silêncio). Membros: `t`, `x`, `y`, `size`, `modules`.
- `QrOptions`: Membros: `ecc`, `mask`.
- `RectOp`: Retângulo: contorno com `stroke` (espessura em mm) e/ou preenchimento em cinza (`fill`, 0 = preto, 1 = branco). Membros: `t`, `x`, `y`, `w`, `h`, `stroke`, `fill`, `dash`.
- `TextOp`: Texto de uma linha já medido. `y` é a linha de base; `w` é a largura calculada pelas métricas AFM (o HTML usa em `textLength`, então a posição não depende da fonte que o browser encontrar). `rot` gira em graus, anti-horário, em torno de (`x`, `y`). Membros: `t`, `x`, `y`, `s`, `font`, `size`, `w`, `gray`, `rgb`, `rot`.

### Tipos

- `DanfeErrorCode`: Códigos estáveis dos erros do `@sinete/da`.
- `FontName`: Fontes padrão do PDF (Adobe Core 14), usadas com `WinAnsiEncoding` e sem embutir. `type FontName = 'Times-Roman' | 'Times-Bold' | 'Helvetica' | 'Helvetica-Bold'`
- `Op`: `type Op = RectOp | LineOp | TextOp | BarsOp | QrOp | ImageOp`
- `QrEcc`: QR Code (ISO/IEC 18004:2015) em modo byte, versões 1 a 40, escrito da norma: codificação, Reed-Solomon sobre GF(256) com o polinômio 0x11D, padrões de função, posicionamento em zigue-zague, as oito máscaras com a penalidade da seção 7.8.3 e as informações de formato e de versão com BCH. `type QrEcc = 'L' | 'M' | 'Q' | 'H'`

## `@sinete/da/nfe`

`@sinete/da/nfe`: DANFE da NF-e (modelo 55) a partir do XML autorizado, nos formatos do MOC 7.0 e da NT 2026.003: retrato, paisagem, Simplificado, Simplificado - Etiqueta e Simplificado Tipo 2. O `danfe` também aceita a NFC-e (modelo 65), para quem imprime os dois modelos pela mesma chamada: a bobina já está aqui por causa do Tipo 2, então isso não custa nada ao bundle. Quem só imprime NFC-e usa `@sinete/da/nfce`, que não carrega os layouts A4 e Simplificado. Os renderizadores (`toPdf`, `toHtml`, `toSvg`) são reexportados aqui para bastar um import.

### Funções

- `danfe`: DANFE de NF-e (modelo 55) ou NFC-e (modelo 65) a partir do `nfeProc` (ou do `NFe` em contingência). `danfe(xml: string, options?: DanfeOptions): Doc`
- `toHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `toHtml(doc: Doc): string`
- `toPdf`: Serializa o `Doc` num PDF 1.4. `toPdf(doc: Doc, options?: PdfOptions): Uint8Array`
- `toSvg`: Uma página como SVG autocontido, em mm. Passe o `doc` para que os logotipos entrem como data URI. `toSvg(page: Page, doc?: Doc): string`

### Classes

- `DanfeError` (estende `SineteError<DanfeErrorCode>`)

### Interfaces

- `BobinaOptions` (estende `CommonOptions`): Membros: `largura`, `via`, `qrLateral`.
- `CommonOptions`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `DanfeA4Options` (estende `CommonOptions`): Membros: `canhoto`, `ibsCbs`, `colunasSt`, `epec`, `fonteItens`.
- `DanfeOptions` (estende `DanfeA4Options, Omit<BobinaOptions, 'largura'>, Omit<SimplificadoOptions, 'largura' | 'epec'>`): Membros: `formato`, `largura`, `cancelamento`.
- `Doc`: Membros: `title`, `pages`, `images`, `stats`.
- `PdfOptions`: Membros: `compress`, `info`.
- `SimplificadoOptions` (estende `CommonOptions`): Membros: `largura`, `epec`.

### Tipos

- `DanfeErrorCode`: Códigos estáveis dos erros do `@sinete/da`.
- `FormatoDanfe`: Formato do documento auxiliar: - `retrato` e `paisagem`: DANFE A4 (MOC 7.0, Anexo II, 3.8.1 e 3.8.2); - `simplificado` e `etiqueta`: DANFE Simplificado e Simplificado - Etiqueta (3.11 e 3.12); - `simplificado-tipo2`: DANFE Simplificado Tipo 2 da NF-e (NT 2026.003); - `nfce`: DANFE NFC-e (modelo 65), o mesmo do `danfce` de `@sinete/da/nfce`. `type FormatoDanfe = 'retrato' | 'paisagem' | 'simplificado' | 'etiqueta' | 'simplificado-tipo2' | 'nfce'`

## `@sinete/da/nfce`

`@sinete/da/nfce`: DANFE NFC-e (modelo 65) em bobina, a partir do XML autorizado (MOC 7.0, Anexo II, e NT 2026.003). Não carrega os layouts A4 e Simplificado da NF-e. Os renderizadores (`toPdf`, `toHtml`, `toSvg`) são reexportados aqui para bastar um import.

### Funções

- `danfce`: DANFE NFC-e a partir do `nfeProc` (ou do `NFe` emitido em contingência off-line) do modelo 65. `danfce(xml: string, options?: DanfceOptions): Doc`
- `toHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `toHtml(doc: Doc): string`
- `toPdf`: Serializa o `Doc` num PDF 1.4. `toPdf(doc: Doc, options?: PdfOptions): Uint8Array`
- `toSvg`: Uma página como SVG autocontido, em mm. Passe o `doc` para que os logotipos entrem como data URI. `toSvg(page: Page, doc?: Doc): string`

### Classes

- `DanfeError` (estende `SineteError<DanfeErrorCode>`)

### Interfaces

- `BobinaOptions` (estende `CommonOptions`): Membros: `largura`, `via`, `qrLateral`.
- `CommonOptions`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `DanfceOptions` (estende `BobinaOptions`): Membros: `cancelamento`.
- `Doc`: Membros: `title`, `pages`, `images`, `stats`.
- `PdfOptions`: Membros: `compress`, `info`.

### Tipos

- `DanfeErrorCode`: Códigos estáveis dos erros do `@sinete/da`.

## `@sinete/da/mdfe`

`@sinete/da/mdfe`: DAMDFE a partir do XML autorizado do MDF-e (MOC MDF-e 3.00a, Anexo II). Não carrega nenhum layout nem schema da NF-e. Os renderizadores (`toPdf`, `toHtml`, `toSvg`) são reexportados aqui para bastar um import.

### Funções

- `damdfe`: DAMDFE a partir do `mdfeProc` (ou do `MDFe` em contingência). `damdfe(xml: string, options?: DamdfeOptions): Doc`
- `toHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `toHtml(doc: Doc): string`
- `toPdf`: Serializa o `Doc` num PDF 1.4. `toPdf(doc: Doc, options?: PdfOptions): Uint8Array`
- `toSvg`: Uma página como SVG autocontido, em mm. Passe o `doc` para que os logotipos entrem como data URI. `toSvg(page: Page, doc?: Doc): string`

### Classes

- `DanfeError` (estende `SineteError<DanfeErrorCode>`)

### Interfaces

- `CommonOptions`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `DamdfeOptions` (estende `CommonOptions`): Membros: `documentos`, `cancelado`.
- `Doc`: Membros: `title`, `pages`, `images`, `stats`.
- `PdfOptions`: Membros: `compress`, `info`.

### Tipos

- `DanfeErrorCode`: Códigos estáveis dos erros do `@sinete/da`.

## `@sinete/da/cce`

`@sinete/da/cce`: DACCE, o documento auxiliar da Carta de Correção Eletrônica da NF-e. Os renderizadores (`toPdf`, `toHtml`, `toSvg`) são reexportados aqui para bastar um import.

### Funções

- `dacce`: DACCE a partir do `procEventoNFe` da Carta de Correção (110110). `dacce(xmlEvento: string, options?: DacceOptions): Doc`
- `toHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `toHtml(doc: Doc): string`
- `toPdf`: Serializa o `Doc` num PDF 1.4. `toPdf(doc: Doc, options?: PdfOptions): Uint8Array`
- `toSvg`: Uma página como SVG autocontido, em mm. Passe o `doc` para que os logotipos entrem como data URI. `toSvg(page: Page, doc?: Doc): string`

### Classes

- `DanfeError` (estende `SineteError<DanfeErrorCode>`)

### Interfaces

- `CommonOptions`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `DacceOptions` (estende `CommonOptions`): Membros: `nfe`.
- `Doc`: Membros: `title`, `pages`, `images`, `stats`.
- `PdfOptions`: Membros: `compress`, `info`.

### Tipos

- `DanfeErrorCode`: Códigos estáveis dos erros do `@sinete/da`.

## `@sinete/da/nfse`

`@sinete/da/nfse`: DANFSe v2, o documento auxiliar da NFS-e Nacional, a partir do XML autorizado (o `NFSe` que a Sefin Nacional devolve, com a DPS dentro), pela NT SE/CGNFS-e 008/2026 v1.02. A API de geração do DANFSe do ADN foi suspensa em 03/08/2026 (NT 008/2026, 1), e o documento passou a ser gerado pelo emissor. Não carrega nenhum layout nem schema da NF-e ou do MDF-e. Os renderizadores (`toPdf`, `toHtml`, `toSvg`) são reexportados aqui para bastar um import.

### Funções

- `danfse`: DANFSe a partir do `NFSe` autorizado. `danfse(xml: string, options?: DanfseOptions): Doc`
- `toHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `toHtml(doc: Doc): string`
- `toPdf`: Serializa o `Doc` num PDF 1.4. `toPdf(doc: Doc, options?: PdfOptions): Uint8Array`
- `toSvg`: Uma página como SVG autocontido, em mm. Passe o `doc` para que os logotipos entrem como data URI. `toSvg(page: Page, doc?: Doc): string`

### Classes

- `DanfeError` (estende `SineteError<DanfeErrorCode>`)

### Interfaces

- `DanfseOptions`: Membros: `cancelamento`, `substituicao`, `canhoto`, `nomeMunicipio`.
- `Doc`: Membros: `title`, `pages`, `images`, `stats`.
- `PdfOptions`: Membros: `compress`, `info`.

### Tipos

- `DanfeErrorCode`: Códigos estáveis dos erros do `@sinete/da`.
