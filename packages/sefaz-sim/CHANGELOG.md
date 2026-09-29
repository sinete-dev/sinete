# @sinete/sefaz-sim

## 0.1.0

### Minor Changes

- 515861a: Protocolo sem `digVal` (opcional no leiaute) deixa de prender a gravação. A denegação (110, 301, 302, 303) é decisão sobre a chave: na resposta do envio e na consulta, o emissor devolve `denegado`, definitivo, mesmo sem `digVal`, com `conteudo` (`confere`, `sem-digval` ou `difere`), os bytes gravados em `xml` e o `proc` só quando o `digVal` confere (`proc` passa a ser opcional no `DesfechoDenegado`). A autorização sem `digVal` nem na consulta vira `divergente` com `conteudo: 'sem-digval'`, com os bytes mantidos e alerta na primeira retomada, em vez de `pendente` para sempre; o mesmo vale para o MDF-e. No `@sinete/nfe` e no `@sinete/mdfe`, o `resolverEnvioSemResposta` ganha a ação `sem-prova` e, na NF-e, conclui a denegação com qualquer conteúdo, dizendo qual em `conteudo`. O `@sinete/sefaz-sim` ganha `setProtocoloSemDigVal` para reproduzir o caso.
- 515861a: A API de geração do DANFSe do ADN, suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026), sai dos dados e do simulador. Mudança de API: `NfseApi` do `@sinete/transport` não tem mais `'danfse'`, e o `nfseEndpoint` não resolve mais essa base; no `@sinete/sefaz-sim`, `NFSE_SIM_PREFIXOS` perde a chave `danfse`, `NfseRota` perde a rota `'danfse'` e o `GET /danfse/{chave}` passa a responder 404. O DANFSe v2 sai do XML da NFS-e pelo `@sinete/da/nfse`.
- 515861a: Ativação da SVC por UF (NT 2013.007 v1.03): `setAtivacaoSvc(ativacao, uf?)` com `ativa` (107 no status da SVC), `desativando` até uma hora (113, com a data e a hora no `xMotivo`, e a autorização ainda aceita) ou `inativa` (114 no status e na autorização, regras C03.2, GB02.2 e K05.1). Com a SVC desligada, o simulador responde 114 em vez de HTTP 503, e o retorno e a consulta da SVC continuam atendendo. `setContingencia` segue ligando a UF em 108 com a SVC ativada, e desfaz o ajuste por UF.
- 515861a: Primeira versão do @sinete/sefaz-sim: SEFAZ simulada com estado e relógio injetado para testes. Atende os web services da NF-e 4.00 com os nomes reais dos WSDL (status, autorização síncrona e assíncrona com recibo, consulta de recibo e de protocolo, eventos de cancelamento, cancelamento por substituição, CC-e e manifestação no AN, inutilização, consulta cadastro e distribuição de DF-e com docZip), valida na ordem da SEFAZ (schema oficial, assinatura, certificado do transmissor e regras de negócio plugáveis com a origem no MOC 7.0), gera protocolos e recibos determinísticos, simula paralisação, contingência SVC, atraso, queda e falta de resposta depois de processar, e roda em processo (`simTransport`) ou como servidor HTTPS com mTLS (`startSefazSimServer`). Traz certificados sintéticos (AC, e-CNPJ, e-CPF e servidor) gerados na hora.
- 515861a: Novo `redirectToSim(transport, baseUrl)`: envolve um `Transport` e manda ao simulador os pedidos que um cliente de documento resolveu pelos dados de endpoints (NF-e e NFC-e), trocando só a URL pelo caminho do autorizador simulado (`simAutorizadorOf`), e recusa pedido sem endpoint. O 110112 passa a ser validado pelo e110112 oficial (só `tpAutor` 1; outro autor é 493), e a inutilização ganha a regra I02a da NT 2018.001 (266 para série 910 a 969).
- 515861a: MDF-e 3.00b no simulador: `MDFeStatusServico`, `MDFeRecepcaoSinc` (área de dados em GZip e Base64), `MDFeConsulta`, `MDFeConsNaoEnc` e `MDFeRecepcaoEvento` (cancelamento, encerramento, inclusão de condutor, inclusão de DF-e e pagamento da operação), com estado próprio e as regras do MOC do MDF-e: duplicidade (204 e 539), não encerrados (611, 686, 462, 662), prazo de cancelamento, encerramento e cancelamento que mudam a situação, contingência off-line e emissão normal atrasada (228), QR Code e as regras J e K dos eventos. Novas opções `prazoCancelamentoMdfeHoras`, `tamanhoMaximoMdfe` e `regrasMdfeDesligadas`, `setParalisacaoMdfe`, `inspect.mdfe`, `MDFE_SERVICES`; o `redirectToSim` passa a aceitar os pedidos do MDF-e. Também as regras da NT 2024.001 (518, 519, 523 e o encerramento pelo transportador terceiro, J09 e K11), com a área de dados compactada lida aos pedaços e recusada com 214 ao passar do limite.
- 515861a: Autorização da NFC-e (modelo 65): regras da identificação (706, 709, 710, 711, 715 a 717), do QR Code (393, 394, 396 a 398, 444, 445, 474, 583, com a assinatura da versão 3 off-line conferida), lote de uma NFC-e só (126) e rejeição 781 no lugar da denegação.
- 515861a: A consulta de eventos da NFS-e simulada segue a Sefin real (produção restrita, 28/09/2026): 405 em `GET /sefin/nfse/{chave}/eventos`, 404 com página HTML em `.../eventos/{tipo}`, 200 em `.../eventos/{tipo}/{seq}` com `eventos[]` (`chaveAcesso`, `tipoEvento`, `numeroPedidoRegistroEvento`, `dataHoraRecebimento`, `arquivoXml` em base64 do gzip em base64) e 404 com `{}` sem o evento. `EventoNfseRegistro` ganha `recebidoEm`.
- 515861a: NFS-e Nacional simulada (`createNfseSim`): Sefin e ADN com estado e relógio injetado, atendidos pelo `simTransport` em processo e pelo novo `startSimServer` genérico em HTTPS com mTLS. `redirectNfseToSim` troca a base de cada API pelo simulador.
  
  - **Recepção.** Na ordem do Anexo I: certificado do canal, base64, gzip, declaração UTF-8, prefixo de namespace e schema do leiaute vigente, depois a assinatura (E0714 a E0718).
  - **Regras de negócio como dado** (`NFSE_REGRAS_PADRAO`), com a fonte na planilha: E0006, E0015, E0037, E0038, E1270, E0014, E0042, E0046, E0312, E0617 e, nos eventos, E1845, E1831, E0840 e E0822.
  - **NFS-e gerada.** Traz a DPS embutida byte a byte e a assinatura da Sefin simulada.
  - **Substituição.** Registra o e105102 na NFS-e substituída.
  - **Outras rotas.** Cancelamento e análise fiscal, consultas, parametrização municipal e um DANFSe de teste.
  - **Falhas injetáveis por rota.**
- 515861a: Novo `syntheticPfx(certificado, senha, { chain })`: o PFX de um certificado sintético (PBE com 3DES, a AC como intermediária), para testar quem recebe o certificado como arquivo e senha, como os emissores do `@sinete/emissor`. O node-forge entra como dependência, o mesmo leitor do `@sinete/cert`.

### Patch Changes

- 515861a: A consulta cadastro do MT no simulador segue o MT de verdade: exige `nfeDadosMsg` dentro de `consultaCadastro` e responde com `consultaCadastroResult` dentro de `nfeResultMsg`. As outras UFs aceitam as duas formas e respondem na forma recebida.
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
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/cert@0.1.0
  - @sinete/transport@0.1.0
  - @sinete/core@0.1.0
  - @sinete/rejeicoes@0.1.0
  - @sinete/schemas@0.1.0
  - @sinete/validators@0.1.0
