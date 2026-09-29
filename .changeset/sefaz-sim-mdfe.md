---
'@sinete/sefaz-sim': minor
---

MDF-e 3.00b no simulador: `MDFeStatusServico`, `MDFeRecepcaoSinc` (área de dados em GZip e Base64), `MDFeConsulta`, `MDFeConsNaoEnc` e `MDFeRecepcaoEvento` (cancelamento, encerramento, inclusão de condutor, inclusão de DF-e e pagamento da operação), com estado próprio e as regras do MOC do MDF-e: duplicidade (204 e 539), não encerrados (611, 686, 462, 662), prazo de cancelamento, encerramento e cancelamento que mudam a situação, contingência off-line e emissão normal atrasada (228), QR Code e as regras J e K dos eventos. Novas opções `prazoCancelamentoMdfeHoras`, `tamanhoMaximoMdfe` e `regrasMdfeDesligadas`, `setParalisacaoMdfe`, `inspect.mdfe`, `MDFE_SERVICES`; o `redirectToSim` passa a aceitar os pedidos do MDF-e. Também as regras da NT 2024.001 (518, 519, 523 e o encerramento pelo transportador terceiro, J09 e K11), com a área de dados compactada lida aos pedaços e recusada com 214 ao passar do limite.
