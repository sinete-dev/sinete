# Referência: `@sinete/da`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/da/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/da/x` é `sinete/da/x`.

## `@sinete/da`

`@sinete/da`: documentos auxiliares dos DF-e a partir do XML autorizado (ADR 0006). A raiz tem o que é comum a todos (renderizadores, modelo do documento, códigos de barras e erros); cada documento está no próprio subpath, para que quem importa um não leve ao bundle o layout dos outros: `@sinete/da/nfe` (DANFE), `@sinete/da/nfce` (DANFE NFC-e), `@sinete/da/mdfe` (DAMDFE) e `@sinete/da/cce` (DACCE).

O layout é uma função pura do XML para um `Documento` (páginas de operações em mm); `gerarPdf` e `gerarHtml`/`gerarSvg` só desenham. A mesma entrada gera os mesmos bytes em Node, Bun, Deno e no browser: sem data de criação, sem fonte embutida, sem dependência nativa.

### Funções

- `code128C`: Larguras (em módulos) de Start C, dados, dígito verificador módulo 103 (MOC 2.1) e Stop, começando por barra. Exige quantidade par de dígitos. `code128C(digitos: string): number[]`
- `code128Chave`: Código de barras da chave de acesso, numérica ou com CNPJ alfanumérico (NT 2025.001 v1.00, seção 6): começa em Start C e codifica pares de dígitos; num caractere que não forma par de dígitos, troca para o subconjunto A (código 101) e segue caractere a caractere; volta ao C (código 99) quando o que resta até a próxima letra é um número par de dígitos, de 4 ou mais, ou o par final. `code128Chave(chave: string): number[]`
- `gerarHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `gerarHtml(documento: Documento): string`
- `gerarPdf`: Serializa o `Documento` num PDF 1.4. `gerarPdf(documento: Documento, opcoes?: PdfOpcoes): Uint8Array`
- `gerarSvg`: Uma página como SVG autocontido, em mm. Passe o `documento` para que os logotipos entrem como data URI. `gerarSvg(pagina: Pagina, documento?: Documento): string`
- `matrizQr`: Matriz de módulos do QR Code de `texto` (true = escuro), sem a zona de silêncio. `matrizQr(texto: string, opcoes?: QrOpcoes): boolean[][]`

### Classes

- `ErroDa` (estende `ErroSinete<CodigoErroDa>`)

### Interfaces

- `DaOpcoes`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `Documento`: Membros: `titulo`, `paginas`, `imagens`, `estatisticas`.
- `EstatisticasDeEncaixe`: Contadores de encaixe de texto de um documento, para medir o layout no corpus. Membros: `reduzidos`, `quebrados`, `cortados`.
- `ImagemDoDocumento`: Imagem decodificada o bastante para os backends: JPEG vai inteiro (DCTDecode), PNG vai em amostras. Membros: `formato`, `bytes`, `largura`, `altura`.
- `OpBarras`: Código de barras: larguras alternadas barra/espaço, em módulos, começando por barra. Horizontal por padrão, com barras de altura `h` a partir de (`x`, `y`); `vertical` empilha as barras de cima para baixo, com comprimento `h`. Membros: `t`, `x`, `y`, `h`, `modulo`, `larguras`, `vertical`.
- `OpImagem`: Imagem (logotipo) já encaixada no retângulo; `imagem` aponta para `Documento.imagens`. Membros: `t`, `x`, `y`, `w`, `h`, `imagem`.
- `OpLinha`: Membros: `t`, `x1`, `y1`, `x2`, `y2`, `w`, `tracejado`, `cinza`.
- `OpQr`: QR Code: matriz de módulos escuros, desenhada num quadrado de lado `tamanho` (sem a zona de silêncio). Membros: `t`, `x`, `y`, `tamanho`, `modulos`.
- `OpRetangulo`: Retângulo: contorno com `contorno` (espessura em mm) e/ou preenchimento em cinza (`preenchimento`, 0 = preto, 1 = branco). Membros: `t`, `x`, `y`, `w`, `h`, `contorno`, `preenchimento`, `tracejado`.
- `OpTexto`: Texto de uma linha já medido. `y` é a linha de base; `w` é a largura calculada pelas métricas AFM (o HTML usa em `textLength`, então a posição não depende da fonte que o browser encontrar). `rotacao` gira em graus, anti-horário, em torno de (`x`, `y`). Membros: `t`, `x`, `y`, `s`, `fonte`, `tamanho`, `w`, `cinza`, `rgb`, `rotacao`.
- `Pagina`: Membros: `w`, `h`, `ops`.
- `PdfOpcoes`: Membros: `comprimir`, `informacoes`.
- `QrOpcoes`: Membros: `nivelDeCorrecao`, `mascara`.

### Tipos

- `CodigoErroDa`: Códigos estáveis dos erros do `@sinete/da`.
- `NivelCorrecaoQr`: QR Code (ISO/IEC 18004:2015) em modo byte, versões 1 a 40, escrito da norma: codificação, Reed-Solomon sobre GF(256) com o polinômio 0x11D, padrões de função, posicionamento em zigue-zague, as oito máscaras com a penalidade da seção 7.8.3 e as informações de formato e de versão com BCH. `type NivelCorrecaoQr = 'L' | 'M' | 'Q' | 'H'`
- `NomeDaFonte`: Fontes padrão do PDF (Adobe Core 14), usadas com `WinAnsiEncoding` e sem embutir. `type NomeDaFonte = 'Times-Roman' | 'Times-Bold' | 'Helvetica' | 'Helvetica-Bold'`
- `Op`: `type Op = OpRetangulo | OpLinha | OpTexto | OpBarras | OpQr | OpImagem`

## `@sinete/da/nfe`

`@sinete/da/nfe`: DANFE da NF-e (modelo 55) a partir do XML autorizado, nos formatos do MOC 7.0 e da NT 2026.003: retrato, paisagem, Simplificado, Simplificado - Etiqueta e Simplificado Tipo 2. O `danfe` também aceita a NFC-e (modelo 65), para quem imprime os dois modelos pela mesma chamada: a bobina já está aqui por causa do Tipo 2, então isso não custa nada ao bundle. Quem só imprime NFC-e usa `@sinete/da/nfce`, que não carrega os layouts A4 e Simplificado. Os renderizadores (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.

### Funções

- `danfe`: DANFE de NF-e (modelo 55) ou NFC-e (modelo 65) a partir do `nfeProc` (ou do `NFe` em contingência). `danfe(xml: string, opcoes?: DanfeOpcoes): Documento`
- `gerarHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `gerarHtml(documento: Documento): string`
- `gerarPdf`: Serializa o `Documento` num PDF 1.4. `gerarPdf(documento: Documento, opcoes?: PdfOpcoes): Uint8Array`
- `gerarSvg`: Uma página como SVG autocontido, em mm. Passe o `documento` para que os logotipos entrem como data URI. `gerarSvg(pagina: Pagina, documento?: Documento): string`

### Classes

- `ErroDa` (estende `ErroSinete<CodigoErroDa>`)

### Interfaces

- `BobinaOpcoes` (estende `DaOpcoes`): Membros: `largura`, `via`, `qrLateral`.
- `DanfeA4Opcoes` (estende `DaOpcoes`): Membros: `canhoto`, `ibsCbs`, `colunasSt`, `epec`, `fonteItens`.
- `DanfeOpcoes` (estende `DanfeA4Opcoes, Omit<BobinaOpcoes, 'largura'>, Omit<SimplificadoOpcoes, 'largura' | 'epec'>`): Membros: `formato`, `largura`, `cancelamento`.
- `DaOpcoes`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `Documento`: Membros: `titulo`, `paginas`, `imagens`, `estatisticas`.
- `PdfOpcoes`: Membros: `comprimir`, `informacoes`.
- `SimplificadoOpcoes` (estende `DaOpcoes`): Membros: `largura`, `epec`.

### Tipos

- `CodigoErroDa`: Códigos estáveis dos erros do `@sinete/da`.
- `FormatoDanfe`: Formato do documento auxiliar: - `retrato` e `paisagem`: DANFE A4 (MOC 7.0, Anexo II, 3.8.1 e 3.8.2); - `simplificado` e `etiqueta`: DANFE Simplificado e Simplificado - Etiqueta (3.11 e 3.12); - `simplificado-tipo2`: DANFE Simplificado Tipo 2 da NF-e (NT 2026.003); - `nfce`: DANFE NFC-e (modelo 65), o mesmo do `danfce` de `@sinete/da/nfce`. `type FormatoDanfe = 'retrato' | 'paisagem' | 'simplificado' | 'etiqueta' | 'simplificado-tipo2' | 'nfce'`

## `@sinete/da/nfce`

`@sinete/da/nfce`: DANFE NFC-e (modelo 65) em bobina, a partir do XML autorizado (MOC 7.0, Anexo II, e NT 2026.003). Não carrega os layouts A4 e Simplificado da NF-e. Os renderizadores (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.

### Funções

- `danfce`: DANFE NFC-e a partir do `nfeProc` (ou do `NFe` emitido em contingência off-line) do modelo 65. `danfce(xml: string, opcoes?: DanfceOpcoes): Documento`
- `gerarHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `gerarHtml(documento: Documento): string`
- `gerarPdf`: Serializa o `Documento` num PDF 1.4. `gerarPdf(documento: Documento, opcoes?: PdfOpcoes): Uint8Array`
- `gerarSvg`: Uma página como SVG autocontido, em mm. Passe o `documento` para que os logotipos entrem como data URI. `gerarSvg(pagina: Pagina, documento?: Documento): string`

### Classes

- `ErroDa` (estende `ErroSinete<CodigoErroDa>`)

### Interfaces

- `BobinaOpcoes` (estende `DaOpcoes`): Membros: `largura`, `via`, `qrLateral`.
- `DanfceOpcoes` (estende `BobinaOpcoes`): Membros: `cancelamento`.
- `DaOpcoes`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `Documento`: Membros: `titulo`, `paginas`, `imagens`, `estatisticas`.
- `PdfOpcoes`: Membros: `comprimir`, `informacoes`.

### Tipos

- `CodigoErroDa`: Códigos estáveis dos erros do `@sinete/da`.

## `@sinete/da/mdfe`

`@sinete/da/mdfe`: DAMDFE a partir do XML autorizado do MDF-e (MOC MDF-e 3.00a, Anexo II). Não carrega nenhum layout nem schema da NF-e. Os renderizadores (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.

### Funções

- `damdfe`: DAMDFE a partir do `mdfeProc` (ou do `MDFe` em contingência). `damdfe(xml: string, opcoes?: DamdfeOpcoes): Documento`
- `gerarHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `gerarHtml(documento: Documento): string`
- `gerarPdf`: Serializa o `Documento` num PDF 1.4. `gerarPdf(documento: Documento, opcoes?: PdfOpcoes): Uint8Array`
- `gerarSvg`: Uma página como SVG autocontido, em mm. Passe o `documento` para que os logotipos entrem como data URI. `gerarSvg(pagina: Pagina, documento?: Documento): string`

### Classes

- `ErroDa` (estende `ErroSinete<CodigoErroDa>`)

### Interfaces

- `DamdfeOpcoes` (estende `DaOpcoes`): Membros: `documentos`, `cancelado`.
- `DaOpcoes`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `Documento`: Membros: `titulo`, `paginas`, `imagens`, `estatisticas`.
- `PdfOpcoes`: Membros: `comprimir`, `informacoes`.

### Tipos

- `CodigoErroDa`: Códigos estáveis dos erros do `@sinete/da`.

## `@sinete/da/cce`

`@sinete/da/cce`: DACCE, o documento auxiliar da Carta de Correção Eletrônica da NF-e. Os renderizadores (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.

### Funções

- `dacce`: DACCE a partir do `procEventoNFe` da Carta de Correção (110110). `dacce(xmlEvento: string, opcoes?: DacceOpcoes): Documento`
- `gerarHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `gerarHtml(documento: Documento): string`
- `gerarPdf`: Serializa o `Documento` num PDF 1.4. `gerarPdf(documento: Documento, opcoes?: PdfOpcoes): Uint8Array`
- `gerarSvg`: Uma página como SVG autocontido, em mm. Passe o `documento` para que os logotipos entrem como data URI. `gerarSvg(pagina: Pagina, documento?: Documento): string`

### Classes

- `ErroDa` (estende `ErroSinete<CodigoErroDa>`)

### Interfaces

- `DacceOpcoes` (estende `DaOpcoes`): Membros: `nfe`.
- `DaOpcoes`: Opções comuns a todos os documentos auxiliares. Membros: `logo`.
- `Documento`: Membros: `titulo`, `paginas`, `imagens`, `estatisticas`.
- `PdfOpcoes`: Membros: `comprimir`, `informacoes`.

### Tipos

- `CodigoErroDa`: Códigos estáveis dos erros do `@sinete/da`.

## `@sinete/da/nfse`

`@sinete/da/nfse`: DANFSe v2, o documento auxiliar da NFS-e Nacional, a partir do XML autorizado (o `NFSe` que a Sefin Nacional devolve, com a DPS dentro), pela NT SE/CGNFS-e 008/2026 v1.02. A API de geração do DANFSe do ADN foi suspensa em 03/08/2026 (NT 008/2026, 1), e o documento passou a ser gerado pelo emissor. Não carrega nenhum layout nem schema da NF-e ou do MDF-e. Os renderizadores (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.

### Funções

- `danfse`: DANFSe a partir do `NFSe` autorizado. `danfse(xml: string, opcoes?: DanfseOpcoes): Documento`
- `gerarHtml`: Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. `gerarHtml(documento: Documento): string`
- `gerarPdf`: Serializa o `Documento` num PDF 1.4. `gerarPdf(documento: Documento, opcoes?: PdfOpcoes): Uint8Array`
- `gerarSvg`: Uma página como SVG autocontido, em mm. Passe o `documento` para que os logotipos entrem como data URI. `gerarSvg(pagina: Pagina, documento?: Documento): string`

### Classes

- `ErroDa` (estende `ErroSinete<CodigoErroDa>`)

### Interfaces

- `DanfseOpcoes`: Membros: `cancelamento`, `substituicao`, `canhoto`, `nomeMunicipio`.
- `Documento`: Membros: `titulo`, `paginas`, `imagens`, `estatisticas`.
- `PdfOpcoes`: Membros: `comprimir`, `informacoes`.

### Tipos

- `CodigoErroDa`: Códigos estáveis dos erros do `@sinete/da`.
