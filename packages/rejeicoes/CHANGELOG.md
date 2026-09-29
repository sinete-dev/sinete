# @sinete/rejeicoes

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
