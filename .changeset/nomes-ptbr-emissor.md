---
'@sinete/emissor': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Mudanças de comportamento:

- `cartaCorrecao` (NF-e) e `encerrar` (MDF-e) devolvem um `DesfechoEvento` (`DesfechoCartaCorrecaoNfe`, `DesfechoEncerramentoMdfe`), como o `cancelar`, em vez do `ResultadoEvento` cru do cliente. Sem resposta, ou com a duplicidade de evento (573 ou 580 na NF-e, 631 no MDF-e), o emissor consulta a chave: a CC-e da mesma sequência e com o mesmo texto, ou o encerramento no mesmo município, volta como `registrado` com `recuperado: true`; outra correção na sequência, ou encerramento em outro município, volta como `recusado`; sem o evento na consulta depois de um pedido sem resposta, `pendente`. Quem testava `tipo === 'autorizado'` e lia `valor.procEventoNFe` passa a testar `tipo === 'registrado'` e ler `procEvento`.
- As opções do PDF são tipadas: `PdfNfeOpcoes`, `PdfMdfeOpcoes` e `PdfNfseOpcoes` espelham `DanfeOpcoes`, `DamdfeOpcoes` e `DanfseOpcoes` do `@sinete/da` sem exigir o pacote para compilar (um teste de tipos confere que continuam iguais). `pdfCancelado` e `pdfPorChave` não aceitam a opção da marca, que vem do evento. Antes eram `object`.
- O `eventoRecusado` de um cancelamento repassa a `dica` do catálogo, que se perdia.
- O `name` das classes de erro passa a ser o nome delas em português (`ErroTravaPerdida`, `ErroTransmissaoEmAndamento`, `ErroTransmissaoJaGravada`, `ErroRecusaRepetida`, `ErroContratoViolado`).
- `cliente` das opções dos emissores omite `transporte`, `assinador` e `relogio` (antes o `Omit` citava os nomes antigos e não omitia nada).

Nomes exportados:

| Antigo | Novo |
|---|---|
| `OpcoesAbrirCertificado` | `AbrirCertificadoOpcoes` |
| `OpcoesContingencia` | `ContingenciaOpcoes` |
| `ContratoVioladoError` | `ErroContratoViolado` |
| `OpcoesContrato` | `ContratoOpcoes` |
| `createEmissor` | `criarEmissor` |
| `OpcoesEmissor` | `EmissorOpcoes` |
| `OpcoesEmitir` | `EmitirOpcoes` |
| `OpcoesGuarda` | `GuardaOpcoes` |
| `OpcoesRecusaRepetida` | `RecusaRepetidaOpcoes` |
| `OpcoesRetomar` | `RetomarOpcoes` |
| `OpcoesTrava` | `TravaOpcoes` |
| `EmissorErrorCode` | `CodigoErroEmissor` |
| `RecusaRepetidaError` | `ErroRecusaRepetida` |
| `TransmissaoEmAndamentoError` | `ErroTransmissaoEmAndamento` |
| `TransmissaoJaGravadaError` | `ErroTransmissaoJaGravada` |
| `TravaPerdidaError` | `ErroTravaPerdida` |
| `createMdfeEmissor` | `criarEmissorMdfe` |
| `MdfeEmissorOptions` | `EmissorMdfeOpcoes` |
| `MdfeEmissor` | `EmissorMdfe` |
| `OpcoesPerfilMdfe` | `PerfilMdfeOpcoes` |
| `createNfeEmissor` | `criarEmissorNfe` |
| `NfeEmissorOptions` | `EmissorNfeOpcoes` |
| `NfeEmissor` | `EmissorNfe` |
| `OpcoesPerfilNfe` | `PerfilNfeOpcoes` |
| `createNfseEmissor` | `criarEmissorNfse` |
| `NfseEmissorOptions` | `EmissorNfseOpcoes` |
| `NfseEmissor` | `EmissorNfse` |
| `OpcoesPerfilNfse` | `PerfilNfseOpcoes` |
| `createBancoMemoria` | `criarBancoMemoria` |
| `createMemoriaStore` | `criarMemoriaStore` |
| `OpcoesMemoria` | `MemoriaOpcoes` |
| `OpcoesPool` | `PoolOpcoes` |
| `createPoolDeEmissores` | `criarPoolDeEmissores` |
| `OpcoesRetomada` | `RetomadaOpcoes` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `ContingenciaDoPerfil` | `aplicar.ctx` | `aplicar.contexto` |
| `ContingenciaDoPerfil` | `sondar.ctx` | `sondar.contexto` |
| `ContingenciaDoPerfil` | `sondarSvc.ctx` | `sondarSvc.contexto` |
| `PerfilDocumento` | `criarCliente.ctx` | `criarCliente.contexto` |
| `PerfilDocumento` | `assinar.ctx` | `assinar.contexto` |
| `ErroRecusaRepetida`, `ErroTransmissaoEmAndamento`, `ErroTransmissaoJaGravada`, `ErroTravaPerdida` | `constructor.options` | `constructor.opcoes` |
| `PoolOpcoes` | `criar.cert` | `criar.certificado` |
| `PoolOpcoes` | `chave.cert` | `chave.certificado` |
| `PoolDeEmissores` | `usar.cert` | `usar.certificado` |
| `ModuloDanfe`, `ModuloDamdfe`, `ModuloDanfse` | `toPdf.doc` | `gerarPdf.documento` |
| `AbrirCertificadoOpcoes`, `ContextoEmissor`, `EmissorOpcoes`, `PoolOpcoes`, `RetomadaOpcoes`, `MemoriaOpcoes` | `clock` | `relogio` |
| `abrirCertificado` | `cert` | `certificado` |
| `DesfechoEvento`, `DesfechoRecusado` | `hint` | `dica` |
| `ContextoEmissor` | `signer` | `assinador` |
| `PoolOpcoes` | `ttlMs` | `validadeMs` |
| `ModuloDanfe`, `ModuloDamdfe`, `ModuloDanfse` | `toPdf` | `gerarPdf` |
