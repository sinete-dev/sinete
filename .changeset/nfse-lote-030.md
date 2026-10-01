---
'@sinete/nfse': minor
'sinete': minor
---

**Quebra: `resolverEnvioSemResposta` devolve `indefinida` em vez de lançar.** `ResolucaoEnvio` ganha o caso `{ acao: 'indefinida', motivo, chaveAcesso? }`, como o resolvedor da NF-e e do MDF-e: a consulta respondeu sem decidir. Sai quando a DPS consta como processada e a NFS-e da chave não é encontrada (antes, `ErroRespostaInvalida` "a NFS-e não foi encontrada"), quando a NFS-e da chave é de outra DPS (antes, `ErroRespostaInvalida` "não corresponde à DPS"), e quando o envio voltou E0014 e a consulta não acha a DPS (antes, `reenviar`, que voltaria E0014 de novo). Um `switch` sobre `acao` precisa do caso novo (ou de um `default`, ADR 0016). Erros do transporte e respostas fora do contrato da própria consulta continuam lançando.

A assinatura passa a ser `resolverEnvioSemResposta(cliente, dpsAssinada, anterior?, opcoes?)`: `anterior` é o desfecho do envio (`ResultadoNfse<NfseGerada>`), usado para reconhecer a E0014, e `opcoes.signal` vai às consultas. Chamadas com dois argumentos continuam valendo.

**`ClienteNfse.opcoes`** (aditivo): as opções da criação, com o mesmo formato de `ClienteNfe.opcoes` e `ClienteMdfe.opcoes`. `ambiente` e `parametros` continuam.
