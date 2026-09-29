---
'@sinete/nfse': minor
---

Primeira versão do `@sinete/nfse`, NFS-e Nacional (leiaute 1.01). Traz:

- a DPS tipada (`DpsInput`) com prestador, tomador, intermediário, serviço (cTribNac e NBS), valores, ISSQN e a classificação do IBS/CBS da NT 004;
- `buildDps`, que monta com validação estrita no XSD vigente e já inclui a declaração UTF-8 exigida pela Sefin (E1229), e `signDps`, que assina por splice;
- os pedidos de cancelamento e de análise fiscal;
- o cliente REST com mTLS do próprio emitente (`createNfseClient`): emissão síncrona e substituição, consultas por chave e por Id da DPS, registro e consulta de eventos e DANFSe do ADN;
- parâmetros municipais (convênio, alíquotas, histórico, regimes especiais, retenções e benefício) com cache trocável;
- `resolverEmissaoSemResposta`, para envio sem resposta.

A rejeição é desfecho (`NfseRejeicao`, com todos os códigos e a dica do catálogo do `@sinete/rejeicoes/nfse`), não exceção.
