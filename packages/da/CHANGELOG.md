# @sinete/da

## 0.2.0

### Minor Changes

- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - O `name` do `ErroDa` passa a ser `'ErroDa'`.
  - `detalhes` dos erros: `ecc` → `nivelDeCorrecao` (QR Code grande demais) e `use` → `usar` (DANFE NFC-e de um modelo 55).
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `DanfeError` | `ErroDa` |
  | `DanfeErrorCode` | `CodigoErroDa` |
  | `QrEcc` | `NivelCorrecaoQr` |
  | `QrOptions` | `QrOpcoes` |
  | `qrMatrix` | `matrizQr` |
  | `BobinaOptions` | `BobinaOpcoes` |
  | `CommonOptions` | `DaOpcoes` |
  | `DacceOptions` | `DacceOpcoes` |
  | `DamdfeOptions` | `DamdfeOpcoes` |
  | `DanfeA4Options` | `DanfeA4Opcoes` |
  | `DanfseOptions` | `DanfseOpcoes` |
  | `SimplificadoOptions` | `SimplificadoOpcoes` |
  | `DanfceOptions` | `DanfceOpcoes` |
  | `DanfeOptions` | `DanfeOpcoes` |
  | `BarsOp` | `OpBarras` |
  | `Doc` | `Documento` |
  | `DocImage` | `ImagemDoDocumento` |
  | `FitStats` | `EstatisticasDeEncaixe` |
  | `FontName` | `NomeDaFonte` |
  | `ImageOp` | `OpImagem` |
  | `LineOp` | `OpLinha` |
  | `Page` | `Pagina` |
  | `QrOp` | `OpQr` |
  | `RectOp` | `OpRetangulo` |
  | `TextOp` | `OpTexto` |
  | `toHtml` | `gerarHtml` |
  | `toSvg` | `gerarSvg` |
  | `PdfOptions` | `PdfOpcoes` |
  | `toPdf` | `gerarPdf` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ErroDa` | `constructor.options` | `constructor.opcoes` |
  | `code128C` | `digits` | `digitos` |
  | `QrOpcoes` | `ecc` | `nivelDeCorrecao` |
  | `QrOpcoes` | `mask` | `mascara` |
  | `matrizQr` | `text` | `texto` |
  | `matrizQr`, `gerarPdf`, `danfe`, `danfce`, `damdfe` e mais 2 | `options` | `opcoes` |
  | `OpBarras` | `module` | `modulo` |
  | `OpBarras` | `widths` | `larguras` |
  | `Documento` | `title` | `titulo` |
  | `Documento` | `pages` | `paginas` |
  | `Documento` | `images` | `imagens` |
  | `Documento` | `stats` | `estatisticas` |
  | `ImagemDoDocumento` | `format` | `formato` |
  | `ImagemDoDocumento` | `width` | `largura` |
  | `ImagemDoDocumento` | `height` | `altura` |
  | `OpImagem` | `ref` | `imagem` |
  | `OpLinha`, `OpRetangulo` | `dash` | `tracejado` |
  | `OpLinha`, `OpTexto` | `gray` | `cinza` |
  | `OpQr`, `OpTexto` | `size` | `tamanho` |
  | `OpQr` | `modules` | `modulos` |
  | `OpRetangulo` | `stroke` | `contorno` |
  | `OpRetangulo` | `fill` | `preenchimento` |
  | `OpTexto` | `font` | `fonte` |
  | `OpTexto` | `rot` | `rotacao` |
  | `gerarHtml`, `gerarSvg`, `gerarPdf` | `doc` | `documento` |
  | `gerarSvg` | `page` | `pagina` |
  | `PdfOpcoes` | `compress` | `comprimir` |
  | `PdfOpcoes` | `info` | `informacoes` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `OpBarras` | `'bars'` | `'barras'` |
  | `OpImagem` | `'image'` | `'imagem'` |
  | `OpLinha` | `'line'` | `'linha'` |
  | `OpRetangulo` | `'rect'` | `'retangulo'` |
  | `OpTexto` | `'text'` | `'texto'` |
- 2a46db6: Acompanham a fase 2 do ADR 0015 (`@sinete/cert`, `@sinete/transport`, runtime do `@sinete/schemas`, `@sinete/ibs-cbs-dados` e `@sinete/ibs-cbs` com nomes em português). Os tipos desses pacotes que estes recebem e devolvem mudam, e o código de quem os usa muda junto; a tabela completa está nos changesets de cada pacote da fase. Nomes destes pacotes que também mudam:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | `CertificadoAberto` (`@sinete/emissor`) | `signer` | `assinador` |
  | `syntheticCertificate(...).tlsIdentity` (`@sinete/sefaz-sim`) | `{ kind: 'pem', certChain, key }` | `{ tipo: 'pem', cadeia, chave }`, a forma da `IdentidadeTls` |
  | `simTransport` (`@sinete/sefaz-sim`) | `runtime: 'custom'` | `runtime: 'personalizada'` |
- ae8ab90: Acompanham a fase 1 do ADR 0015 (`@sinete/core`, `@sinete/validators` e `@sinete/rejeicoes` com nomes em português). Nenhum nome próprio destes pacotes muda nesta fase, mas os tipos do core que eles recebem e devolvem mudam, e o código de quem os usa muda junto. Os mais visíveis:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | desfecho dos clientes (`ResultadoSefaz`, antes `SefazOutcome`) | `status: 'authorized' \| 'rejected' \| 'denied' \| 'pending'` | `tipo: 'autorizado' \| 'recusado' \| 'denegado' \| 'pendente'` |
  | desfecho autorizado ou denegado | `value` | `valor` |
  | desfecho recusado | `hint` (`probableCause`, `suggestedFix`, `source`) | `dica` (`causaProvavel`, `comoCorrigir`, `fonte`) |
  | desfecho pendente | `ref`, `retryAfterMs` | `referencia`, `aguardarMs` |
  | erros (`ErroSinete`, antes `SineteError`) | `details`, `docs` | `detalhes`, `pagina` |
  | ocorrências (`Ocorrencia`, antes `ValidationIssue`) | `path`, `message` | `caminho`, `mensagem` |
  | `ErroDeValidacao` (antes `ValidationError`) | `issues` | `ocorrencias` |
  | assinador (`Assinador`, antes `Signer`) | `kind: 'data' \| 'digest'`, `sign`, `signDigestInfo`, `certificateDer` | `tipo: 'dados' \| 'digest'`, `assinar`, `assinarDigestInfo`, `certificadoDer` |
  | relógio (`Relogio`, antes `Clock`) | `now()` | `agora()` |
  | resultado local (`Resultado`, antes `Result`) | `value`, `error` | `valor`, `erro` |
  
  A tabela completa de cada pacote da fase está nos changesets do `@sinete/core`, do `@sinete/validators` e do `@sinete/rejeicoes`.

### Patch Changes

- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
- Updated dependencies [2a46db6]
- Updated dependencies [d824983]
  - @sinete/core@0.2.0
  - @sinete/schemas@0.2.0

## 0.1.0

### Minor Changes

- 515861a: O `cancelado` do `damdfe` aceita o `procEventoMDFe` do cancelamento (110111), lido pelo schema de eventos do MDF-e: o protocolo e a data do evento vão ao carimbo, como o `procEventoNFe` no `cancelamento` do `danfe`. Evento de outro MDF-e, de outro tipo ou sem retorno registrado (135, 134 ou 136) é `evento_incompativel`. O objeto `{ nProt, dhRegEvento }` e o `true` continuam valendo, com a mesma saída.
- 515861a: Primeira versão do `@sinete/da` (documentos auxiliares), com um subpath por documento (`/nfe`, `/nfce`, `/mdfe`, `/cce`) e o comum na raiz: DANFE retrato e paisagem (com canhoto, fatura, ISSQN, quadro de IBS/CBS/IS, contingência FS-DA e EPEC), DANFE Simplificado, Etiqueta e Simplificado Tipo 2, DANFE NFC-e, DACCE e DAMDFE, a partir do XML autorizado lido pelo `@sinete/schemas`, em PDF determinístico e HTML/SVG, com logotipo PNG/JPEG, marcas de homologação, contingência e cancelamento, CODE-128C e QR Code próprios.
- 515861a: Marca os documentos sem valor fiscal em todos os formatos do DANFE e no DAMDFE: "SEM VALOR FISCAL" quando falta o protocolo de autorização na emissão normal (prévia, XML sem protocolo, SVC sem protocolo, EPEC sem o registro do evento) e "DENEGADA", com o motivo da tabela 4.4.3 do MOC e o protocolo de denegação, nos cStat 110, 301, 302 e 303. A contingência com a autorização por vir continua valendo e passa a ser marcada com "EMITIDA EM CONTINGÊNCIA" ("EMISSÃO EM CONTINGÊNCIA" no DAMDFE), e o protocolo só aparece como de autorização quando o cStat é 100 ou 150.
- 515861a: Novo subpath `@sinete/da/nfse` (e `sinete/da/nfse`): `danfse` gera o DANFSe v2 da NFS-e Nacional pela NT SE/CGNFS-e 008/2026 v1.02, em PDF e HTML, a partir do `NFSe` autorizado nos pacotes de esquemas 1.01 de 20260209 e de 20260727. A4 retrato numa página só, QR Code da consulta pública com a chave, "NFS-e SEM VALIDADE JURÍDICA" em produção restrita e marcas d'água de cancelada e substituída pelo evento registrado (`cancelamento`, `substituicao`) ou por `true`; canhoto opcional e `nomeMunicipio` para os endereços. O `TextOp` do modelo ganha `rgb`, opcional, para o texto em cor que a NT pede; os outros documentos não mudam.

### Patch Changes

- 515861a: A NF-e e a NFC-e cujo `protNFe` traz cStat de cancelamento (101, 151 ou o 155 do evento fora de prazo), como gravam os sistemas que importam a nota, saem com o carimbo "CANCELADA" e o número do protocolo no campo do protocolo de autorização, e não mais como "SEM VALOR FISCAL". O `procEventoNFe` de cancelamento, quando passado, continua prevalecendo no carimbo, com o protocolo do evento. No DAMDFE, o `protMDFe` com cStat 101 sai "CANCELADO" e o 132 (encerrado) sai como autorizado, com o protocolo e sem marca.
- 515861a: DANFE NFC-e e DANFE Simplificado Tipo 2 de emitente pessoa física: o cabeçalho diz "CPF:" no lugar de "CNPJ:" (Manual de Padrões Técnicos do DANFE NFC-e e QR Code 6.0, 3.1.1). A saída com emitente CNPJ não muda.
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/core@0.1.0
  - @sinete/schemas@0.1.0
