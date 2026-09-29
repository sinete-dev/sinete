# 0006. DANFE, DACCE, DAMDFE e DANFSe: um renderizador, saída em PDF e HTML

Status: proposta (spike S6, 25/set/2026), implementada em `@sinete/da` na M5 (26/set/2026) com as decisões 7 a 13 abaixo; a 14 (marcas de documento sem valor fiscal) e a 15 (cancelada pelo cStat do protocolo) entraram depois, no mesmo dia; a 16 (DANFSe v2) entrou em 28/set/2026. Código descartável do spike em `spikes/s6-danfe/`.

## Contexto

`@sinete/da` precisa gerar, a partir do XML autorizado, o DANFE (retrato, paisagem, Simplificado, Simplificado Etiqueta e Simplificado Tipo 2), o DACCE, o DAMDFE e o DANFSe v2, em PDF e em HTML, rodando em Node, Bun, Deno e browser, sem browser headless no servidor. O plano pede paridade visual com o DANFE que o integrador em produção já imprime.

Fontes normativas lidas:

- MOC 7.0 Anexo II (Manual de Especificações Técnicas do DANFE e Código de Barras, 28 págs.). Pontos que decidem o desenho: fonte **Times New Roman ou Courier New** (3.7); tamanhos mínimos de 5 pt para rótulos, 6 pt para itens e informações complementares, 8 a 12 pt no cabeçalho e **10 pt para "demais campos"** (3.7.1 a 3.7.9); margens de 2 a 8 mm (3.6.2); tabela de posição e tamanho de cada campo em cm para A4 retrato e paisagem (3.8.1, 3.8.2); Code-128C com largura mínima de 6 cm, altura mínima de 8 mm e módulo mínimo de 0,2 mm (cap. 2); regras de folhas adicionais (3.5): repetir o cabeçalho, manter as mesmas colunas, e usar o resto só para itens e informações complementares; "FOLHA x/y" em todas as folhas (3.10.2).
- DANFE Simplificado Tipo 2: o leiaute está na **NT 2026.003** (a NT 2026.002 trata da operação). Papel com largura mínima de 56 mm, QR Code de no mínimo 25 x 25 mm, sendo 22 mm de conteúdo e 3 mm de zona de silêncio somando os dois lados (1,5 mm de cada lado; acima de 25 mm, a zona soma 10% do lado), chave em 11 blocos de 4 dígitos, bloco IBS/CBS/IS obrigatório.
- DANFSe v2: NT 008/2026 v1.02 (Arial para rótulos e Microsoft Sans Serif para conteúdo, A4 retrato em página única, QR de no mínimo 15,2 x 15,2 mm apontando para o Portal Nacional, chave de 50 dígitos, marcas d'água de cancelada e substituída, e "NFS-e SEM VALIDADE JURÍDICA" em vermelho no cabeçalho em produção restrita). A API oficial de geração foi desligada em 03/ago/2026, então o DANFSe passou a ser responsabilidade do emissor (decisão 16).
- DAMDFE: o manual do MDF-e exige QR (`infMDFeSupl/qrCodMDFe`) e código de barras da chave.

Nenhum código de terceiros foi lido para o leiaute. O nfe-php/sped-da é LGPL/GPL. O **BrazilFiscalReport também é LGPL-3.0**, então saiu da lista de referências. O leiaute do spike vem só do MOC.

Corpus (local, só agregados): 2.115 NF-e próprias e 1.500 de terceiros, todas `nfeProc` modelo 55. Itens por nota: p99 16 nas próprias e 30 nas de terceiros, máximo 64. `xProd` chega a 120 caracteres, `infAdProd` a 500, e `infCpl` + `infAdFisco` a 4.913 (p99 de 693 a 970). Há até 40 duplicatas numa nota, e 1.605 itens já trazem o grupo IBSCBS. `tpImp` nas notas de terceiros: 1.454 retrato, 38 paisagem, 3 simplificado e 5 sem DANFE. Nenhum arquivo tem caractere fora do Latin-1. Há ainda 300 CC-e, 300 cancelamentos e 488 MDF-e.

Ambiente: Bun 1.4.2, Node 26.3.1, Deno 2.9.1, Chromium 153 (Playwright 1.63), poppler (pdftoppm), zbar 0.23, macOS arm64.

## Opções avaliadas

### (a) Desenhar direto numa biblioteca de PDF

Nas bibliotecas avaliadas, o layout fica preso à API da lib (pdf-lib, pdfkit ou jsPDF), e o HTML exigiria um segundo layout escrito à mão, que diverge com o tempo. Para medir o custo de cada lib, reproduzi nelas o mesmo modelo de páginas da opção (b). O desenho é idêntico, então a diferença é só o custo do backend:

| Backend (mesmo Doc) | básica 1 folha | 64 itens, 2 folhas | textos longos, 3 folhas | Determinístico | Bundle browser (min / gzip), com layout |
|---|---|---|---|---|---|
| **escritor próprio** (fflate) | 0,94 ms, 5,4 KB | 2,65 ms, 13,5 KB | 1,57 ms, 11,1 KB | sim, e mesmo sha256 em Node, Bun, Deno e Chromium | **119 KB / 43 KB** |
| pdf-lib 1.17.1 (MIT, sem release desde 2021) | 6,0 ms, 9,6 KB | 24,6 ms, 34,4 KB | 9,7 ms, 20,7 KB | só com `updateMetadata: false` e datas fixas | 523 KB / 208 KB |
| @cantoo/pdf-lib 2.11.1 (fork mantido) | 5,8 ms, 14,4 KB | 24,1 ms, 61,9 KB | 13,4 ms, 31,5 KB | idem | não medido (equivalente) |
| pdfkit 0.20.2 | 5,0 ms, 6,4 KB | 12,6 ms, 16,1 KB | 9,1 ms, 13,5 KB | só com datas fixas | 609 KB / 241 KB, e **o bundle quebra fora do Node**: `Standard font "Helvetica" is not registered` (lê os AFM com `fs`) |
| jsPDF 4.2.1 | 4,0 ms, 7,4 KB | 14,7 ms, 18,3 KB | 5,8 ms, 16,2 KB | só com data e `fileId` fixos | 882 KB / 276 KB |

Tempos de backend no Bun, média de 50 execuções. Rasterizado a 100 dpi, o mesmo Doc difere em 0,5% dos pixels entre o escritor próprio e pdf-lib/jsPDF (arredondamento de traço) e em 2,1% no pdfkit (linha de base do texto).

### (b) Modelo declarativo e dois backends (escolhida)

Separei o trabalho em três camadas:

1. **Layout**: a função `XML -> Doc` gera páginas com operações já posicionadas em mm (`rect`, `line`, `text` de uma linha com largura calculada, `bars`, `qr`), na mesma convenção de coordenadas do MOC. Todo o layout acontece aqui: quebra de linha, redução de fonte, paginação em dois passos (primeiro distribui itens e informações complementares, depois desenha, porque o total de folhas aparece no cabeçalho). As medidas de texto vêm das tabelas AFM das fontes padrão do PDF (Times, Helvetica, Courier; 5,4 KB gerados de `@pdf-lib/standard-fonts`, MIT), indexadas por WinAnsi.
2. **Backend PDF**: escritor PDF 1.4 próprio de cerca de 80 linhas. Usa as fontes padrão Type1 com `WinAnsiEncoding`, então não embute fonte (Times atende o 3.7 do MOC; Helvetica atende o DANFSe). Comprime com `fflate` (deflate em JS puro, com o mesmo resultado em qualquer runtime, ao contrário do `CompressionStream` ou do zlib nativo). Não grava data nem `/ID`.
3. **Backend HTML**: uma `<svg>` por página, em mm, com `@page` do tamanho do papel. Cada `<text>` leva `textLength` com a largura AFM, então a posição não depende da fonte que o browser encontrar (Times New Roman, Tinos ou Liberation Serif). Impresso pelo Chromium, o HTML bate com o PDF em posição; os 2,2% de pixels diferentes são desenho de glifo (o Chromium embute Times New Roman e o poppler usa o Nimbus no lugar de Times-Roman).

### (c) HTML/CSS impresso por browser headless (só baseline)

Com o Chromium já aberto e o mesmo HTML: 82 a 146 ms por documento, 220 a 354 KB por PDF (subset de fonte embutido), **saída não determinística** entre duas impressões seguidas e 98 ms de launch. Custa de 100 a 150 vezes mais que (b), traz um browser para o servidor e perde o controle da paginação se o layout for CSS de fluxo. Serve só para imprimir no cliente, e aí o HTML de (b) já resolve com `window.print()`.

## Protótipo: DANFE retrato e DACCE sobre o corpus

DANFE retrato A4 (cabeçalho pela tabela 3.8.1 do MOC, variante laser; canhoto; destinatário; duplicatas em grade de 6 por linha que cresce; cálculo do imposto; transportador; itens com 15 colunas na ordem do MOC; ISSQN só quando existe; dados adicionais com "CONTINUA NA PRÓXIMA FOLHA"; folhas adicionais com o cabeçalho completo e as mesmas colunas; marca "SEM VALOR FISCAL" em homologação). São cerca de 290 linhas de layout.

| | NF-e próprias (2.115) | NF-e de terceiros (1.500, todas) |
|---|---|---|
| Crashes | 0 | 0 |
| Folhas | 2.100 com 1, 15 com 2 | 1.419 com 1, 81 com 2 |
| Parse + layout, ms/doc p50 / p95 | 0,37 / 0,98 | 0,48 / 1,71 |
| Backend PDF, ms/doc p50 / p95 | 0,35 / 0,89 | 0,40 / 1,09 |
| Parse + layout + PDF, média ms/doc | 0,86 | 1,18 |
| Backend HTML, ms/doc p50 | 0,10 | 0,12 |
| PDF, KB p50 / máx | 5,1 / 11,6 | 5,3 / 14,6 |
| HTML, KB p50 / máx | 28 / 129 | 29 / 161 |
| Determinismo (2 renders, bytes iguais) | 2.115 | 1.500 |
| Docs com algum campo abaixo do tamanho nominal | 451 | 291 |
| Docs com texto cortado | 0 | 1 (um valor unitário com 10 casas decimais) |

Overflow encontrado e tratado: código do produto com até 60 caracteres e unidade em coluna estreita cortavam na primeira versão (79 notas próprias e 39 de terceiros tinham algum corte). Agora quebram em linhas, como a descrição, e dado fiscal não é mais cortado. Endereço e bairro que não cabem nem em 6 pt vão para duas linhas de 6 pt (15 casos). O `infCpl` longo continua em folha adicional: na fixture de 5.000 caracteres, deu 3 folhas.

Código de barras: 207 DANFEs (fixtures mais uma amostra de 1 a cada 21 próprias e 1 a cada 15 de terceiros) rasterizados a 150 e a 300 dpi e lidos pelo `zbarimg`: **207 de 207** chaves corretas nas duas resoluções. Módulo de 0,267 mm (mínimo 0,2), altura de 10 mm (mínimo 8) e zona de silêncio de 10 módulos.

QR: 40 `qrCodMDFe` reais, uma URL de NFC-e e uma de DANFSe, gerados com `qrcode-generator` (MIT, 5 linhas de adaptador), lidos pelo zbar: 42 de 42 a 25 mm e a 15,2 mm em 150 dpi. A 100 dpi e 15,2 mm, a leitura falha, porque o módulo fica com 1,2 px. Isso é limite de raster e não de geração: impressora térmica de 203 dpi fica acima disso.

DACCE: 300 CC-e do corpus sem crash e sem corte, 0,95 ms p50. O MOC não define leiaute de DACCE, então segui a convenção de mercado. O nome do emitente não está no XML do evento; o DACCE usa o da NF-e quando ela é passada e, sem ela, mostra o CNPJ do autor.

Caracteres: tudo o que está no CP1252 sai como está (acentos, ç, o traço U+2013, aspas curvas, €, •, …). Fora dele, o diacrítico é removido (Ő vira O) e o resto vira `?` (✓, CJK, emoji). No corpus isso não acontece nenhuma vez. Embutir fonte TTF com subset (pdf-lib + fontkit, DejaVu Serif) custa 24 ms e 28 KB por documento (sem subset, 71 ms e 446 KB) e é determinístico. Fica como opção para PDF/A ou texto fora do Latin-1, com uma interface de métricas que o layout já consome.

Runtimes: o bundle de browser do escritor próprio roda sem mudança e gera **o mesmo sha256** em Node 26, Bun 1.4.2, Deno 2.9.1 e dentro do Chromium (5 a 9 ms para a nota de 64 itens com parse). pdf-lib e jsPDF também rodam nas quatro; o pdfkit não roda no bundle de browser sem registrar as fontes.

## Regressão visual

`vr/diff.ts`: PDF, depois `pdftoppm` (100 dpi, cinza, sem antialias), depois `pixelmatch` contra `vr/golden/*.png`. As goldens vêm só de fixtures sintéticas (`src/fixtures.ts` gera NF-e fictícias: básica, 64 itens, textos longos, 40 duplicatas, homologação, caracteres fora do Latin-1; mais uma CC-e sintética). São 10 PNGs, 328 KB, que podem ir para o repo. Sensibilidade medida: deslocar um título em 0,1 mm muda 36 mil pixels, e um espaço a mais no "FOLHA 1/1" centralizado muda 250. Com isso, o critério pode ser zero pixel de diferença. Saídas do corpus e PNGs com dados reais ficam em `.local/` e `out/` (os dois no `.gitignore`).

No CI: pdftoppm fixado (imagem com poppler de versão fixa), golden por backend, e `--update` só por PR revisada. Um segundo nível sem raster compara o `Doc` serializado em JSON (snapshot), que já pega mudança de layout sem depender do poppler.

## Decisão proposta

1. **Modelo declarativo `Doc` (páginas de operações em mm) com dois backends**: um escritor PDF próprio (fontes padrão, WinAnsi, fflate) e HTML/SVG com `textLength`. Browser headless fica fora do servidor.
2. **Layout como dados onde o MOC dá números**: posições e tamanhos do cabeçalho, das margens e dos mínimos de fonte vivem numa tabela com a origem (item do MOC ou NT), no mesmo espírito do princípio 4.
3. **Métricas plugáveis**: AFM das fontes padrão por padrão; fonte embutida (subset via fontkit ou subsetter próprio) como opção, para PDF/A e caracteres fora do WinAnsi.
4. **Code-128C e QR**: Code-128C próprio (cerca de 10 linhas, com a tabela da norma); QR com `qrcode-generator` (MIT) ou implementação própria, validados com zbar no CI.
5. **Datas e textos variáveis entram pelo chamador** (princípio 6): o PDF não grava data de criação, e a mesma entrada gera os mesmos bytes em qualquer runtime.
6. **O XML chega já decodificado** pelo `@sinete/core/xml`/`@sinete/schemas`. O `fast-xml-parser` do spike é andaime e responde por boa parte dos 29 KB gzip do layout.

## Consequências

- `@sinete/da` fica com cerca de 45 KB gzip com o PDF, sem dependência nativa, e roda no browser (pré-visualização e impressão no cliente).
- Cada documento (DANFE nas variantes, DACCE, DAMDFE, DANFSe) é só uma função de layout. Os backends, o Code-128, o QR e a paginação são compartilhados.
- Um escritor PDF próprio é código nosso para manter. O escopo é pequeno (sem fonte embutida, só vetor) e a imagem do logo do emitente é o próximo recurso: JPEG entra como DCTDecode sem decodificar, e PNG exige desfazer o filtro e separar o alfa.
- Paridade com o DANFE do integrador em produção ficou sem medir: não subi o sistema dele e o banco de arquivos não tem PDFs de DANFE. A conformidade foi medida contra as dimensões do MOC.

## Implementação (M5, 26/set/2026)

O pacote `@sinete/da` porta o spike e fecha as pendências que cabiam na M5. Fontes novas lidas: NT 2026.003 v1.00 (leiaute do DANFE Simplificado Tipo 2, com as divisões I a IX, a III-A de IBS/CBS/IS, QR de 25 mm, sendo 22 mm de conteúdo e 3 mm de zona de silêncio somando os dois lados, e papel de 56 mm), NT 2026.002 v1.10 (`tpImp` 6 e `tpEmis` 9) e o MOC MDF-e 3.00a, Anexo II (DAMDFE: modelos por modal, barras de 1,5 a 2,5 cm numa área de 3 x 9 cm, "EMISSÃO EM CONTINGÊNCIA" e "EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL" no lugar do protocolo).

7. **Encaixe de texto: reduzir até 6 pt, depois quebrar.** Resolve a primeira pendência. Todo texto de dado passa por uma regra só: uma linha no tamanho nominal; se não couber, a fonte cai em passos de 0,25 pt até 6 pt (o menor tamanho de conteúdo do MOC, 3.7.7 e 3.7.8); se nem assim couber, quebra em linhas de 6 pt até onde a altura do campo deixa; só então a última linha é cortada com reticências. Trade-off assumido: o MOC pede 10 pt para os "demais campos" (3.7.9) e 12 pt para a razão social (3.7.6), mas chama de sugestão as larguras do 3.8; num campo de uma linha de 8,5 mm, duas linhas de 10 pt não cabem, então quebrar primeiro não resolve o endereço de 60 a 120 caracteres. Reduzir primeiro mantém o dado numa linha legível e deixa a quebra para o que não cabe nem em 6 pt. Colunas numéricas seguem a mesma regra (o valor unitário de 10 casas que cortava no spike agora quebra). `doc.stats` conta só textos de dado (rótulos e títulos fixos ficam de fora).
8. **Quadro de IBS/CBS/IS no DANFE A4 provisório.** A NT 2025.002 v1.51 (item 9) diz que o DANFE com os novos tributos "está em estudo" e não há leiaute publicado. Até lá, os totais do grupo W03 (`vBCIBSCBS`, IBS UF, IBS municipal, IBS, CBS, IS e `vNFTot`) saem num quadro próprio abaixo do cálculo do imposto, suprimível com `ibsCbs: false`. Quando a NT sair, o quadro muda de lugar ou de campos e isso é mudança de layout (goldens novas). Na bobina (NFC-e e Tipo 2) vale a divisão III-A da NT 2026.003.
9. **QR Code próprio, sem dependência.** Em vez do `qrcode-generator`, um codificador da ISO/IEC 18004 em modo byte (UTF-8, versões 1 a 40, quatro níveis). O teste compara a matriz com a do `qrcode-generator` (dependência só de desenvolvimento) na mesma máscara, em todas as faixas de versão e níveis: iguais. O pacote fica com uma dependência só, o `fflate`.
10. **Entrada pelo `@sinete/schemas`.** O `fast-xml-parser` saiu: `nfeProc`/`NFe` pelo PL_010f, `procEventoNFe` pelo PL_010d com o `detEvento` de cada tipo (o envelope decide o módulo) e `mdfeProc`/`MDFe` pelo 3.00b, todos pelo decoder tolerante.
11. **Regressão em dois níveis.** O sha256 do PDF de cada caso sintético fica em `packages/da/test/vr/golden/manifest.json` e é conferido em qualquer máquina (no CI inclusive, que não tem poppler); onde o `pdftoppm` tem a versão gravada no manifesto (26.06.0 hoje), cada página é comparada pixel a pixel com a golden (zero de diferença). Outra versão do poppler desenha glifos diferentes, então o nível de pixels fica de fora em vez de falhar. 41 casos, 46 PNGs, 1,3 MB (eram 24 casos e 0,9 MB antes da decisão 14, e 37 casos e 1,1 MB antes da 15).
12. **Chave com CNPJ alfanumérico: CODE-128 híbrido C/A.** A NT 2025.001 v1.00 (seção 6) mantém o CODE-128C e, no caractere não numérico, troca para o subconjunto A (código 101) e volta ao C (código 99), com DV módulo 103; o exemplo da própria NT (`5225AB83`, DV 30) é teste. `code128Chave` começa em Start C, codifica pares de dígitos, entra no A quando não há par e volta ao C só quando isso encurta o código (4 ou mais dígitos pares até a próxima letra, ou o par final, como no exemplo da NT; ISO/IEC 15417, anexo E); chave só numérica sai idêntica ao CODE-128C (as goldens não mudam). O pior caso (letra e dígito alternados no CNPJ) tem 32 símbolos, 365 módulos: 73 mm de barras mais 4 mm de zona de silêncio no módulo mínimo de 0,2 mm, e cabe em todos os quadros de código de barras (o mais justo, o do DANFE retrato, tem 80 mm; teste confere os 10 módulos de cada lado); a leitura com `zbarimg` exige 300 dpi (a 150 dpi o módulo de 0,24 mm tem 1,4 px). O segundo código do FS-DA mantém as letras do CNPJ do destinatário e calcula o DV pela regra ASCII - 48 da NT (seção 4); a NT não trata do FS-DA, então isso é extrapolação nossa, a rever se sair regra específica.
13. **Excesso de duplicatas vai para as informações complementares.** O XML admite 120 duplicatas e o MOC (3.1.6 e 3.3.2) não diz o que fazer com as que não cabem. A grade da folha 1 tem até três linhas e perde linhas, até uma, se a folha 1 não tiver espaço para ao menos uma linha de item; a última célula avisa quantas ficaram de fora ("+ N DUPLICATAS EM INFORMAÇÕES COMPLEMENTARES"), e as demais entram nas informações complementares depois das do fisco, que já continuam nas folhas adicionais. Sem espaço nem com uma linha de duplicatas, os itens começam na folha 2.

14. **Marcas de documento sem valor fiscal.** A marca sai da situação do documento, decidida pelo protocolo e pela forma de emissão (`situacaoNfe` e `situacaoMdfe` em `layout/marcas.ts`; códigos e textos em `data/leiaute.ts`, com a origem), e vale para o DANFE retrato e paisagem, o Simplificado, a Etiqueta, o Tipo 2, a NFC-e e o DAMDFE. Fontes novas lidas: MOC 7.0, Visão Geral (2.3.1, 2.3.2.1, 5.1.6 e 5.4.2) e Anexo I (tabelas 4.4.1 e 4.4.3); MOC MDF-e 3.00b, Visão Geral (4.2.6, 4.3.6 e 11).
    - **Autorizada**: `protNFe` com cStat 100 ou 150 (Anexo I, tabela 4.4.1); no MDF-e, 100. Sem marca, como antes (em homologação continua o "SEM VALOR FISCAL").
    - **Sem protocolo na emissão normal** (prévia, XML gravado sem `protNFe`): a Visão Geral diz que sem a autorização de uso "não poderá haver o trânsito da mercadoria" (2.3.1) e que, na emissão normal, "os respectivos documentos auxiliares somente podem ser gerados após o contribuinte ter recebido a autorização de uso" (2.3.2.1). O Anexo II só dá texto para a homologação: a frase "SEM VALOR FISCAL" "no quadro Informações Complementares ou em marca d'água destacada" (3). Usamos a mesma frase, nos dois lugares, com uma segunda linha "SEM PROTOCOLO DE AUTORIZAÇÃO DE USO" (o nome do campo 2, 3.9.1); o campo 2 fica vazio. Caem aqui também as formas conclusivas sem protocolo (SVC-AN, SVC-RS e SCAN, que o 3.9.1 trata como a emissão normal), o EPEC sem o protocolo do evento (3.9.3: "Após o registro do EPEC o emissor poderá imprimir o DANFE") e um `protNFe` cujo cStat não é de autorização, de denegação nem de cancelamento (decisão 15), mesmo em contingência (o protocolo presente já é o desfecho; no MDF-e vale o mesmo). Até aqui, o documento sem protocolo só era marcado em homologação.
    - **Contingência com o protocolo por vir**: a regra do MOC é outra. Em FS-IA e FS-DA (3.9.2), no off-line da NFC-e e do Tipo 2 (NT 2026.002, NT 2026.003) e no EPEC já registrado (3.9.3), o documento auxiliar é emitido para acompanhar a mercadoria antes da autorização, então vale e não leva "SEM VALOR FISCAL". O Anexo II, 3 pede a contingência "em destaque, conforme disposto no Anexo IV"; o Anexo IV não está entre as fontes lidas, e o texto é o da NT 2026.003, 3.1.9: "EMITIDA EM CONTINGÊNCIA" e "Pendente de autorização". A marca d'água do A4, que dizia só "CONTINGÊNCIA", passou a usar esse texto (goldens `fsda`, `epec` e `damdfe-contingencia` refeitas). Na bobina o aviso já estava no corpo (divisões I e VII), sem marca d'água, e continua assim.
    - **Denegada**: cStat 110, 301, 302 e 303 (Anexo I, 4.4.1 e 4.4.3; o mesmo conjunto do `@sinete/nfe`, e um teste confere as duas tabelas e os motivos do `@sinete/rejeicoes`). A denegação é gravada com protocolo, mas o "Uso como Doc Fiscal" é "Vedado" (Visão Geral, 5.1.6, tabela 5-4). O Anexo II não trata do DANFE de nota denegada; a marca é "DENEGADA" com o motivo oficial da tabela 4.4.3 em caixa alta (110: "Uso Denegado") e o protocolo, e o mesmo aviso vai nas informações complementares, na área de mensagem fiscal da bobina e no rodapé do simplificado. O campo do protocolo passa a "PROTOCOLO DE DENEGAÇÃO DE USO" ("Protocolo de autorização ou denegação de uso", Visão Geral, 5.4.2, ER08), e não mais "de autorização", em qualquer forma de emissão: na FS-IA e na FS-DA ele toma o lugar da representação dos dados da NF-e no campo 2, e no EPEC o do protocolo do evento.
    - **DAMDFE**: o MOC MDF-e 3.00a, Anexo II, manda o texto no lugar do protocolo: "EMISSÃO EM CONTINGÊNCIA" (2.4) e "EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL", centralizado e em caixa alta (2.5). Para o MDF-e de emissão normal sem protocolo o manual não diz nada; seguimos o 2.5, com "SEM PROTOCOLO DE AUTORIZAÇÃO DE USO - SEM VALOR FISCAL" no mesmo lugar e a marca "SEM VALOR FISCAL". O MDF-e não tem denegação: a validação termina em rejeição ou em autorização de uso (Visão Geral 3.00b, 4.2.6), e os cStat 301 a 303 do MDF-e são rejeições; `protMDFe` com cStat diferente de 100 sai como sem protocolo, nunca como "DENEGADA". A marca da contingência do DAMDFE usa "EMISSÃO EM CONTINGÊNCIA" (Visão Geral 3.00b, 11.1).
    - O carimbo de cancelamento, passado pelo chamador, continua tendo precedência. O DACCE não muda.

15. **Cancelada pelo cStat do protocolo.** A NF-e importada de outro sistema costuma chegar com o `protNFe` reescrito com a situação atual da nota: cStat 101 ("Cancelamento de NF-e homologado") ou 151 ("Cancelamento de NF-e homologado fora de prazo"), da tabela 4.4.1 do MOC 7.0, Anexo I. Um integrador em produção tem 127 notas assim na base dele. Até aqui, esse `protNFe` caía na regra do cStat que não é de autorização (decisão 14) e a nota saía "SEM VALOR FISCAL", sem protocolo, o que diz o contrário do fato: a nota foi autorizada e depois cancelada. Fontes novas lidas: MOC 7.0, Visão Geral, 5.4.2 e 5.9.4; MOC MDF-e 3.00b, Visão Geral, 4.3.6, 6.1.2 e 6.2.2.
    - **O que o cStat diz.** A SEFAZ nunca devolve `protNFe` com 101 ou 151: a consulta da situação (Visão Geral, 5.4.2) devolve o `protNFe` só com 100, 150 ou 110 (ER08) e o cancelamento à parte, no `retCancNFe` (ER09, "se localizada uma NF-e com cStat = 101-cancelado ou 151-cancelado fora de prazo") e no `procEventoNFe` (ER10). O `protNFe` com 101 ou 151 é, portanto, o protocolo de autorização com o cStat da situação atual por cima, e o `nProt` e o `dhRecbto` continuam sendo os da autorização. As 20 notas dessa base que olhei (só agregados) confirmam: o `xMotivo` continua "Autorizado o uso da NF-e" e o `dhRecbto` fica a minutos do `dhEmi`. Entra também o 155 ("Cancelamento homologado fora de prazo", Visão Geral, 5.9.4), que é o cStat do registro do evento e aparece no `protNFe` de quem copia o retorno do evento; o conjunto 101, 151 e 155 é o mesmo do `@sinete/nfe` (`cancelada` em `data/cstat.json`), e um teste confere as duas tabelas.
    - **O que o DANFE mostra.** O Anexo II não trata do DANFE de nota cancelada (a única marca que ele prevê é a de homologação, 3); o carimbo "CANCELADA" é o mesmo do cancelamento pelo evento, que já existia. A nota não é prévia nem denegada, então não leva "SEM VALOR FISCAL" (só em homologação, como qualquer carimbo) nem aviso nas informações complementares. O `nProt` e o `dhRecbto` vão no campo do protocolo com o título de sempre, "PROTOCOLO DE AUTORIZAÇÃO DE USO" (3.9.1, campo 2), porque são os da autorização; o carimbo sai sem linha de protocolo, porque o protocolo do cancelamento não está no XML, e mostrar ali o `nProt` da autorização o faria passar pelo do cancelamento. `protNFe` com cStat de cancelamento e sem `nProt` carimba do mesmo jeito, com o campo vazio: o cStat basta, como na denegação.
    - **As duas fontes.** Com o `procEventoNFe` 110111 ou 110112 passado em `cancelamento`, o carimbo é o do evento, com o protocolo e a data do registro, e o campo do protocolo continua com o `nProt` da autorização. O documento sai idêntico ao da nota com cStat 100 e o mesmo evento: a golden `cancelada-protocolo-evento` tem o mesmo sha256 da `cancelada`.
    - **MDF-e.** Vale o equivalente, com uma diferença. A consulta do MDF-e devolve a situação atual com 100, 101 ou 132 (Visão Geral 3.00b, 4.3.6): 101 depois do cancelamento (6.1.2) e 132 depois do encerramento (6.2.2), e é esse cStat que o sistema que importa o MDF-e grava no `protMDFe`. O 101 sai como o NF-e: carimbo "CANCELADO", o `nProt` no lugar do protocolo, e o `cancelado` passado pelo chamador prevalece. O 132 não é cancelamento: o encerramento é o fim normal do percurso de um MDF-e autorizado, então o DAMDFE sai como autorizado, com o protocolo e sem marca. Até aqui, os dois caíam no "SEM PROTOCOLO DE AUTORIZAÇÃO DE USO - SEM VALOR FISCAL". Os conjuntos batem com os do `@sinete/mdfe` (`cancelado` e `encerrado`).

Corpus local (só agregados, `tools/danfe-corpus`), 4.703 XML:

| | DANFE (3.615 nfeProc) | DANFE cancelada (28) | DACCE (300) | DAMDFE (372) |
|---|---|---|---|---|
| Falhas | 0 | 0 | 1 (`xml_invalido`: `&` sem escape no XML) | 0 |
| Folhas | 3.496 com 1, 115 com 2, 4 com 3 | 27 com 1, 1 com 2 | 1 | 1 |
| Determinismo (2 renders, bytes iguais) | 3.615 | 28 | 299 | 372 |
| Docs com dado reduzido / quebrado / cortado | 1.221 / 155 / 0 | 9 / 0 / 0 | 12 / 5 / 0 | 0 / 0 / 0 |
| Layout + PDF + HTML, ms/doc p50 / p95 | 0,44 / 0,90 | 0,68 / 1,87 | 0,19 / 0,39 | 1,17 / 1,65 |
| `zbarimg` na amostra (1 a cada 20) | CODE-128 181/181 | 1/1 | 11/11 | CODE-128 19/19, QR 19/19 |

Os 26 cortes do primeiro render eram o endereço do emitente numa linha só; passaram a quebrar em duas. Os 3 DANFE Simplificado (`tpImp` 3) do corpus saem no formato simplificado. O corpus não tem NFC-e nem NF-e com `tpImp` 6: esses formatos estão cobertos só pelas fixtures sintéticas. Bundle de browser com o layout, os decoders dos schemas usados e o escritor PDF: 194 KB minificado, 57 KB gzip (o spike media 43 KB sem os decoders).

Marcas (decisão 14), com `--marcas`: todo o corpus é autorizado (3.615 `protNFe` com cStat 100, 372 `protMDFe` com 100), e as 3.615 notas saem sem marca, as 28 canceladas com o carimbo e os 372 DAMDFE sem marca. Para exercitar as marcas com dado real, cada `nfeProc` foi renderizado mais duas vezes, como prévia (o `NFe` sem o protocolo) e como denegada (cStat 302), e cada `mdfeProc` como prévia:

| | DANFE prévia (3.615) | DANFE denegada (3.615) | DAMDFE prévia (372) |
|---|---|---|---|
| Falhas | 0 | 0 | 1 (`documento_inesperado`: o `MDFe` declara o namespace da NF-e e só é lido dentro do `mdfeProc`) |
| Marca | "SEM VALOR FISCAL" em 3.615 | "DENEGADA" em 3.615 | "SEM VALOR FISCAL" em 371 |
| Folhas | 3.490 com 1, 121 com 2, 4 com 3 | 3.490 com 1, 121 com 2, 4 com 3 | 1 |
| Determinismo | 3.615 | 3.615 | 371 |
| Docs com dado reduzido / quebrado / cortado | 1.221 / 155 / 0 | 1.221 / 155 / 0 | 0 / 0 / 0 |
| `zbarimg` na amostra (1 a cada 20) | CODE-128 181/181 | CODE-128 181/181 | CODE-128 19/19, QR 19/19 |

As 6 notas a mais com 2 folhas são o aviso da situação nas informações complementares, que empurra o texto para a folha seguinte.

Cancelada pelo cStat (decisão 15), com `--marcas`: o corpus não tem `protNFe` nem `protMDFe` com cStat de cancelamento, então cada `nfeProc` foi renderizado mais uma vez com o cStat trocado por 101, cada uma das 28 notas com evento de cancelamento com o cStat 101 e o evento juntos, e cada `mdfeProc` com 101 e com 132. As renderizações de antes (DANFE, cancelada pelo evento, DACCE, DAMDFE, prévias e denegadas) saíram iguais às da tabela anterior em falhas, marcas, folhas e encaixe.

| | DANFE cStat 101 (3.615) | cStat 101 e evento (28) | DAMDFE cStat 101 (372) | DAMDFE cStat 132 (372) |
|---|---|---|---|---|
| Falhas | 0 | 0 | 0 | 0 |
| Marca | "CANCELADA" em 3.615 | "CANCELADA" em 28, com o protocolo do evento em 28 | "CANCELADO" em 372 | nenhuma em 372 |
| "SEM VALOR FISCAL" em algum texto | 0 | 0 | 0 | 0 |
| `nProt` do protocolo no documento | 3.615 | 28 | 372 | 372 |
| Folhas | 3.496 com 1, 115 com 2, 4 com 3 | 27 com 1, 1 com 2 | 1 | 1 |
| Determinismo | 3.615 | 28 | 372 | 372 |
| `zbarimg` na amostra (1 a cada 20) | CODE-128 181/181 | 1/1 | CODE-128 19/19, QR 19/19 | CODE-128 19/19, QR 19/19 |

As folhas da nota cancelada pelo cStat são as da autorizada (a prévia e a denegada ganham 6 notas com 2 folhas pelo aviso nas informações complementares, que a cancelada não tem). As 20 notas com cStat 101 da paridade de marcas com o integrador em produção (comparação local, fora do repo) saem todas com "CANCELADA", sem "SEM VALOR FISCAL" e com o `nProt` presente; antes, saíam "SEM VALOR FISCAL", e o DANFE do integrador as marcava como canceladas.

## DANFSe v2 (28/set/2026)

16. **DANFSe v2 no subpath `@sinete/da/nfse`.** A NT SE/CGNFS-e 008/2026 v1.02 (14/07/2026, coletada em 28/09/2026 do portal gov.br/nfse, seção RTC da documentação técnica) diz que a API de geração do DANFSe do ADN "será sobrestada (suspensa) na data de 03 de agosto de 2026" (1) e passa a geração ao software emissor; em 28/09/2026 o ADN respondia 404 em todos os caminhos testados. O documento é só mais uma função de layout (`layout/danfse.ts`) sobre o mesmo `Doc`, os mesmos backends e o mesmo QR; medidas, textos e descrições das opções ficam em `data/leiaute-danfse.ts`, com a origem.
    - **Entrada.** O `NFSe` que a Sefin devolve, com a DPS dentro. O pacote de esquemas (1.01 de 20260209 ou de 20260727, com CNPJ alfanumérico) sai do `selecionarPl` do `@sinete/schemas` pela data e pelo ambiente da DPS (`dhEmi` e `tpAmb`), como no ADR 0002 para documento recebido; antes da primeira vigência ou sem data legível, o pacote mais antigo, que o decoder tolerante aceita. Os dois módulos têm a mesma forma.
    - **Leiaute.** O Anexo I é o modelo obrigatório (2.2.4) e a tabela do 2.4.5 é sugestão (2.1); onde os dois divergem, vale o anexo (o regime de apuração do SN fica na coluna 2, como no desenho, e não na 3, como na tabela). Corpo a 3 mm do papel, em quatro colunas de 50,9 mm; borda de 1 pt a 2 mm do papel (2.2.2 e 2.2.3); divisórias de 0,5 pt; cabeçalho, rótulos de bloco, "Emitente da NFS-e" e "Valor Líquido da NFS-e + IBS/CBS" em cinza de 5% (2.2.3). Rótulos de bloco em 7 pt negrito e caixa alta, de campo em 6 pt negrito, os da identificação em 7 pt, conteúdo em 7 pt normal (2.4.1 a 2.4.4). Arial e Microsoft Sans Serif saem como Helvetica, a fonte padrão do PDF com as métricas da Arial. A logomarca da NFS-e (2.4.3) vai embutida no pacote, reduzida para 480 x 97 px com paleta (4 KB).
    - **Encaixe.** Diferente do DANFE, o conteúdo nunca desce de 7 pt, o mínimo da NT (2.4.3 e 2.4.4, e 2.1: "utilizando-se os tamanhos mínimos de fonte"). Campo que não cabe numa linha termina em reticências, como a NT permite (2.1 e 2.4.5); o mesmo vale para a descrição do serviço e para as informações complementares, que dividem a altura que sobra dos blocos fixos, cada um com o que precisa e o resto ao meio. A linha dos tributos aproximados (Lei 12.741/2012, nota 10) nunca é cortada. Campo sem dado sai com traço (nota 12).
    - **Supressões.** Tomador, destinatário e intermediário ausentes, e ISSQN com `tribISSQN` 4 (não incidência), viram uma faixa de 3,2 mm com a frase da NT (2.3.1 e notas 2 a 4); `indDest` 0 dá "O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO" (2.3.2). As linhas de regime especial e de benefício municipal saem só com algum dado (nota 5), sem contar o regime "Nenhum" (0), que é o padrão do leiaute; a de PIS e COFINS sai até a competência de 2026 (nota 6). O bloco de IBS/CBS não é suprimível (2.3 não o lista) e sai com traço quando a NFS-e não tem o grupo, o que ainda é o caso de quase toda NFS-e de 2026. O canhoto é opcional (`canhoto: false`, 2.3.3), e o espaço dele vai para as informações complementares.
    - **Dados que o XML não tem.** O prestador da DPS emitida por ele mesmo traz só o documento e o regime; nome, inscrição, endereço e contato saem do grupo `emit`, que está no mesmo XML, quando o CNPJ ou o CPF bate (2.1: nada que não conste do arquivo). O nome do município só existe no XML para os municípios de emissão, de prestação e de incidência; os demais saem com o código IBGE e a UF, ou com o nome que o chamador resolve em `nomeMunicipio`. O pacote não carrega a tabela de municípios do IBGE.
    - **Marcas.** Produção restrita (`tpAmb` 2): "NFS-e SEM VALIDADE JURÍDICA" abaixo do título, Arial negrito 9 pt em vermelho sólido (2 e 2.4.3). A NT não pede marca d'água em produção restrita, então não há. Para o vermelho, o `TextOp` ganhou `rgb`, que o PDF desenha com `rg` e o HTML com `fill`; os outros documentos não mudam (goldens iguais). Cancelada e substituída (2.5.1 e 2.5.2): "CANCELADA" ou "SUBSTITUÍDA" em diagonal, normal, cinza K35 (0,65), com no mínimo 50 pt, atrás do conteúdo. O XML da NFS-e não muda depois da autorização, então as duas vêm das opções, como o cancelamento do DANFE: `cancelamento` aceita o `evento` registrado e101101, e105104 ou e305101, e `substituicao` o e105102, ou `true`. Evento de outro tipo, de outra chave ou as duas marcas juntas são `evento_incompativel`; o `pedRegEvento` sem registro é `documento_inesperado`.
    - **Extrapolações.** A NT (2.4.5) só trata o `tpRetPisCofins` 1 (PIS e COFINS somam nas contribuições retidas e zeram o débito de apuração própria; nos demais, a CSLL retida e PIS e COFINS como vieram). Os códigos 3 a 9 do XSD separam os tributos, e a mesma regra vale para cada um que o código retém (`RETENCAO_PIS_COFINS`): o 3 e o 4 saem como o 1, o 5 e o 9 retêm só o PIS, o 6 e o 7 só a COFINS, o 0, o 2 e o 8 nenhum dos dois. Totais aproximados só com `pTotTribSN` (Simples Nacional): "Simples Nacional: x%", porque a nota 10 só prevê federais, estaduais e municipais; com `indTotTrib`, os três com traço. CEP de sete dígitos ganha o zero à esquerda (a Sefin de produção restrita devolveu o CEP do emitente assim em 28/09/2026). O "Indicador de Operação" do bloco IBS/CBS sai pelo código (`cIndOp`), sem descrição, como pede a tabela.
    - **Verificação.** Sete casos novos na regressão visual (os dois pacotes, a produção restrita, o documento mínimo, os textos de 2.000 caracteres, cancelada, substituída e sem canhoto), o QR lido pelo `zbarimg` a 150 e a 300 dpi nos dois pacotes, e uma NFS-e real de produção restrita, emitida e cancelada em 28/09/2026, renderizada e comparada com o Anexo I fora do repositório.

## Pendências

- Resolvido depois da M5: DANFSe v2 (decisão 16).
- Resolvido na M5: regra de encaixe (decisão 7), colunas de ST (entram quando algum item tem ST), paisagem, contingência FS-IA/FS-DA com o segundo código de barras, EPEC (protocolo passado pelo chamador), logotipo PNG/JPEG, carimbo de cancelada, marcas de documento sem protocolo e de nota denegada (decisão 14), nota cancelada pelo cStat do protocolo (decisão 15), quadro de IBS/CBS (provisório, decisão 8), DANFE Simplificado, Etiqueta e Tipo 2, DANFE NFC-e, DAMDFE e valor unitário com muitas casas.
- Leiaute oficial do IBS/CBS no DANFE A4 (NT 2025.002, item 9) quando for publicado.
- DANFSe v2: o leiaute das operações que passaram a ter NFS-e com o IBS e a CBS (NT 007/2026, 3.a), que a NT 008/2026 (1) promete em nota técnica própria; a tabela de municípios do IBGE para os endereços, hoje resolvida pelo chamador. Desde 28/set/2026 o emissor de NFS-e gera o DANFSe localmente (`pdf`, `pdfCancelado`, `pdfPorChave`), e o `obterDanfse` saiu do `@sinete/nfse`.
- Formulário contínuo (Anexos III.03 e III.05) e verso do DANFE (3.4): não implementados.
- Paridade visual com o DANFE do integrador em produção continua sem medir.
- Fonte embutida para PDF/A e texto fora do Latin-1.
- WebKit e Firefox: a smoke roda só no Chromium.

## Como reproduzir

Pacote (M5):

```
bun test packages/da                                   # unidades, layout, QR contra o oráculo, sha256 e pixels
SINETE_VR_UPDATE=1 bun test packages/da/test/vr.test.ts   # regrava goldens e manifesto
bun run build && bun tools/danfe-corpus/check.ts --zbar 20 --marcas   # corpus local, só agregados
```

Spike:

```
cd spikes/s6-danfe && bun install
bun src/corpus-stats.ts        # agregados do corpus
bun src/bench-corpus.ts        # DANFE sobre o corpus inteiro
bun src/fit-report.ts          # reduções e cortes por campo
bun src/bench-dacce.ts         # DACCE sobre as CC-e
bun src/bench-backends.ts      # próprio vs pdf-lib/pdfkit/jsPDF
bun src/bundle-size.ts && node src/runtime-test.mjs && deno run -A src/runtime-test.mjs
bun src/browser-test.ts        # bundle no Chromium + baseline (c)
bun src/barcode-check.ts && bun src/qr-check.ts   # leitura com zbarimg
bun vr/diff.ts [--update]      # regressão visual
```
