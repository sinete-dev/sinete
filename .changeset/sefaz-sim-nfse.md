---
'@sinete/sefaz-sim': minor
---

NFS-e Nacional simulada (`createNfseSim`): Sefin e ADN com estado e relógio injetado, atendidos pelo `simTransport` em processo e pelo novo `startSimServer` genérico em HTTPS com mTLS. `redirectNfseToSim` troca a base de cada API pelo simulador.

- **Recepção.** Na ordem do Anexo I: certificado do canal, base64, gzip, declaração UTF-8, prefixo de namespace e schema do leiaute vigente, depois a assinatura (E0714 a E0718).
- **Regras de negócio como dado** (`NFSE_REGRAS_PADRAO`), com a fonte na planilha: E0006, E0015, E0037, E0038, E1270, E0014, E0042, E0046, E0312, E0617 e, nos eventos, E1845, E1831, E0840 e E0822.
- **NFS-e gerada.** Traz a DPS embutida byte a byte e a assinatura da Sefin simulada.
- **Substituição.** Registra o e105102 na NFS-e substituída.
- **Outras rotas.** Cancelamento e análise fiscal, consultas, parametrização municipal e um DANFSe de teste.
- **Falhas injetáveis por rota.**
