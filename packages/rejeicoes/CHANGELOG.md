# @sinete/rejeicoes

## 0.4.0

### Minor Changes

- cc09d66: Contribuinte exclusivo do IBS/CBS (NT 2026.007 v1.10). O `montarNfe` confere antes de assinar a nota sem IE do emitente: NFC-e até o fim de 2032 (rejeição 156), emitente sem CNPJ (157), IEST informada (158), ICMS no item fora da devolução e do `tpNFCredito` 03 (161) e item sem o grupo IBS/CBS (162); a falta de ICMS e ISSQN deixa de ser ocorrência nessa nota. O catálogo do `@sinete/rejeicoes` ganha as 30 rejeições novas da NT (156 a 188), e a `vigencia.json` do `@sinete/schemas` passa a citar a v1.10.
- e6c8f28: NF-e com DANFE Simplificado Tipo 2 (`tpImp` 6, NT 2026.002 v1.11): o `montarNfe` gera o `infNFeSupl` com o QR Code versão 3 na URL da NFC-e da UF, recusa a versão 2 (672) e aceita a contingência off-line (`tpEmis` 9) nela; a chave de acesso passa a aceitar `tpEmis` 9 no modelo 55. O `@sinete/sefaz-sim` deixa de recusar o `infNFeSupl` da NF-e (393, que saiu da NT), exige o QR Code na NF-e Tipo 2 (394) e confere a versão (672). O catálogo do `@sinete/rejeicoes` ganha o 672 (ZX02-220), e o `campoVolatil` do emissor acompanha.

### Patch Changes

- eb06ce6: Dica da rejeição 327 (RV I08-140) alinhada à NT 2026.009 v1.00 (homologação e produção até 17/09/2026) e à NT 2025.002 v1.52: os CFOP 1.949 e 2.949 passam a valer em qualquer devolução, sem a condição de destinatário não contribuinte que a dica ainda pedia, e a regra também cobre a nota de crédito de retorno por recusa na entrega (tpNFCredito 03 e 06). A `orientacao` para quem emite muda junto.

## 0.3.0

### Minor Changes

- 5547ca1: Campo opcional `orientacao` nas entradas do catálogo da NF-e e do MDF-e e no `DicaRejeicao`: texto para quem emite a nota (produtor, contador, atendente), em uma ou duas frases sem termo de integração, com o que aconteceu e o que mudar na nota, no cadastro ou junto à SEFAZ. `causaProvavel` e `comoCorrigir` continuam sendo o texto para quem integra. `dicaRejeicao`, `dicaRejeicaoMdfe` e os `completar*` passam a levar a `orientacao` quando a entrada tem.
  
  Entram 59 das 92 rejeições curadas da NF-e e 12 das 15 do MDF-e: só as que quem emite resolve na nota, no cadastro ou na SEFAZ. Falha do sistema emissor (schema, assinatura, certificado da conexão, chave e dígito, cálculo de totais e tributos, duplicidade por reenvio, consumo indevido) fica sem `orientacao`. O catálogo da NFS-e não muda.
- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.

### Patch Changes

- 395f19c: Curadoria (`causaProvavel`, `comoCorrigir` e `referencia`) para quatro rejeições frequentes de produtor rural e de quem opera com benefício fiscal de ICMS: 327 (CFOP que não é de devolução em nota de devolução, RV I08-140), 930 (CST com benefício fiscal sem `cBenef`, RV N12-84 e N12-85), 931 (`cBenef` que não corresponde ao CST, RV I05f-20, N12-88 e N12-94) e 946 (`cBenef` inexistente ou fora de vigência na UF, RV N12-98), todas conferidas no texto do MOC 7.0 Anexo I. O catálogo passa a ter 92 códigos com curadoria.
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/core@0.3.0

## 0.2.0

### Minor Changes

- ae8ab90: Nomes da API pública em português (ADR 0015, fase 1). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `RejeicaoCategory` | `CategoriaRejeicao` |
  | `REJEICAO_CATEGORIES` | `CATEGORIAS_REJEICAO` |
  | `RejeicaoRule` | `RegraRejeicao` |
  | `RejeicaoSource` | `FonteRejeicao` |
  | `RejeicoesTableInfo` | `DescricaoTabelaRejeicoes` |
  | `REJEICOES_TABLE` | `TABELA_REJEICOES` |
  | `rejeicaoByCode` | `rejeicaoPorCodigo` |
  | `rejectionHint` | `dicaRejeicao` |
  | `enrichRejected` | `completarRecusado` |
  | `enrichOutcome` | `completarResultado` |
  | `REJEICOES_MDFE_TABLE` | `TABELA_REJEICOES_MDFE` |
  | `rejeicaoMdfeByCode` | `rejeicaoMdfePorCodigo` |
  | `rejectionHintMdfe` | `dicaRejeicaoMdfe` |
  | `enrichRejectedMdfe` | `completarRecusadoMdfe` |
  | `enrichOutcomeMdfe` | `completarResultadoMdfe` |
  | `NfseErrosTableInfo` | `DescricaoTabelaErrosNfse` |
  | `NFSE_ERROS_TABLE` | `TABELA_ERROS_NFSE` |
  | `nfseErroByCode` | `nfseErroPorCodigo` |
  | `nfseRejectionHint` | `dicaRejeicaoNfse` |
  | `enrichNfseRejected` | `completarRecusadoNfse` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `RegraRejeicao` | `doc` | `documento` |
  | `Rejeicao` | `code` | `codigo` |
  | `Rejeicao` | `effect` | `efeito` |
  | `Rejeicao` | `message` | `mensagem` |
  | `Rejeicao` | `messages` | `mensagens` |
  | `Rejeicao` | `source` | `fonte` |
  | `Rejeicao` | `rules` | `regras` |
  | `Rejeicao` | `category` | `categoria` |
  | `RejeicaoMdfe` | `code` | `codigo` |
  | `RejeicaoMdfe` | `effect` | `efeito` |
  | `RejeicaoMdfe` | `message` | `mensagem` |
  | `RejeicaoMdfe` | `messages` | `mensagens` |
  | `RejeicaoMdfe` | `source` | `fonte` |
  | `RejeicaoMdfe` | `rules` | `regras` |
  | `RejeicaoMdfe` | `category` | `categoria` |
  | `FonteRejeicao` | `citation` | `citacao` |
  | `DescricaoTabelaRejeicoes` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoTabelaRejeicoes` | `version` | `versao` |
  | `DescricaoTabelaRejeicoes` | `sources` | `fontes` |
  | `DescricaoTabelaErrosNfse` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoTabelaErrosNfse` | `version` | `versao` |
  | `DescricaoTabelaErrosNfse` | `sources` | `fontes` |
  | `NfseErroRegra` | `doc` | `documento` |
  | `NfseErro` | `code` | `codigo` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/rejeicoes.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/rejeicoes.json` | `version` | `versao` |
  | `data/rejeicoes.json` | `sources` | `fontes` |
  | `data/rejeicoes.json` | `citation` | `citacao` |
  | `data/rejeicoes.json` | `code` | `codigo` |
  | `data/rejeicoes.json` | `effect` | `efeito` |
  | `data/rejeicoes.json` | `message` | `mensagem` |
  | `data/rejeicoes.json` | `messages` | `mensagens` |
  | `data/rejeicoes.json` | `source` | `fonte` |
  | `data/rejeicoes.json` | `rules` | `regras` |
  | `data/rejeicoes.json` | `category` | `categoria` |
  | `data/rejeicoes.json` | `doc` | `documento` |
  | `data/rejeicoes-mdfe.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/rejeicoes-mdfe.json` | `version` | `versao` |
  | `data/rejeicoes-mdfe.json` | `sources` | `fontes` |
  | `data/rejeicoes-mdfe.json` | `citation` | `citacao` |
  | `data/rejeicoes-mdfe.json` | `code` | `codigo` |
  | `data/rejeicoes-mdfe.json` | `effect` | `efeito` |
  | `data/rejeicoes-mdfe.json` | `message` | `mensagem` |
  | `data/rejeicoes-mdfe.json` | `messages` | `mensagens` |
  | `data/rejeicoes-mdfe.json` | `source` | `fonte` |
  | `data/rejeicoes-mdfe.json` | `rules` | `regras` |
  | `data/rejeicoes-mdfe.json` | `category` | `categoria` |
  | `data/rejeicoes-mdfe.json` | `doc` | `documento` |
  | `data/nfse-erros.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/nfse-erros.json` | `version` | `versao` |
  | `data/nfse-erros.json` | `sources` | `fontes` |
  | `data/nfse-erros.json` | `citation` | `citacao` |
  | `data/nfse-erros.json` | `code` | `codigo` |
  | `data/nfse-erros.json` | `doc` | `documento` |
  
  Também mudam nesta versão:
  
  - Parâmetros: `nfseErroPorCodigo(codigo)`, `dicaRejeicaoNfse(codigo)` e `completar*(desfecho)`.
  - `src/data/*.json`: as chaves seguem a tabela acima, e `notes` e `generatedBy` do topo viraram `notas` e `geradoPor`.

### Patch Changes

- Updated dependencies [ae8ab90]
  - @sinete/core@0.2.0

## 0.1.0

### Minor Changes

- 515861a: Causa provável e correção para mais 29 códigos, escolhidos pelas rejeições reais de um integrador em produção (entre eles 203, 266, 108, 503, 244, 529, 900, 853, 574, 690, 221 e 805), e dica do 656 revista. Os códigos 853 (NT 2025.001 v1.03, RV Y09-40) e 836 (NT 2024.003 v1.10, RV ZF05-10) entram no catálogo pelas `adicionais` da curadoria, com as duas NT em `REJEICOES_TABLE.sources`.
- 515861a: Primeira versão: catálogo de 814 rejeições e denegações da NF-e e da NFC-e (MOC 7.0 Anexo I e NT 2025.002 v1.40) com mensagem oficial, regra de origem, categoria e diagnóstico curado dos códigos mais comuns, e enriquecimento do desfecho `rejected` do core.
- 515861a: Catálogo do MDF-e (modelo 58) numa entrada própria, `@sinete/rejeicoes/mdfe`: 217 códigos das regras de validação do MOC MDF-e 3.00b (Anexo I e Visão Geral) e das NT 2024.001 v1.02, 2024.002 v1.01, 2025.001 v1.03 e 2026.001 v1.00, com mensagem oficial, regra de origem e curadoria de causa e correção nos bloqueios mais comuns (não encerrados, duplicidade, percurso, prazo de cancelamento). Os códigos colidem com os da NF-e com outro significado, por isso o catálogo é separado.
- 515861a: Catálogo com os códigos que só as tabelas de mensagens da NT 2025.001 v1.03 e da NT 2023.002 v1.01 trazem: QR Code da NFC-e versão 3 (444, 445, 474, 583), lote com mais de uma NFC-e (126, 961), processo de emissão (957) e os demais da NT 2025.001 (300, 452, 797), com a regra de validação e os modelos de cada um.
- 515861a: Novo subpath `@sinete/rejeicoes/nfse`: catálogo dos 496 códigos de erro da NFS-e Nacional (`E0312`, `E1229`...) gerado das planilhas oficiais do Anexo I v1.01 (20260209) e do Anexo II v1.01 (20260122), com sha256 conferido. Cada código traz a mensagem oficial, o nível (1 leiaute, 2 geral, 3 parametrização municipal), as regras de origem com aba, linha e caminho do campo, a categoria e, nos mais comuns, causa provável e correção. `nfseErroByCode`, `NFSE_ERROS`, `NFSE_ERROS_TABLE`, `nfseRejectionHint` e `enrichNfseRejected`.

### Patch Changes

- 515861a: Pré-validação do destinatário (grupo E do MOC 7.0 Anexo I, ADR 0012): destinatário estrangeiro (E03a-10, E03a-20, E03a-30, E03a-60), nome em produção e endereço na NF-e (E04-10, E05-10), município da UF do destinatário (E10-20), `idDest` contra as UFs com as exceções da regra (E12-30 a E12-60), país no exterior (E14-30), indicador da IE no exterior e para não contribuinte (E16a-20, E16a-40), IE no exterior (E17-40) e Suframa fora da área incentivada (E18-30), com `origem: 'entrada'`; as citações da E17-20 e da E17-30 foram corrigidas. O catálogo ganhou dicas curadas para 720, 721, 925, 372, 724, 726, 275, 772, 773, 926, 790, 728, 792 e 251, e a do 232 foi revista.
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/core@0.1.0
