# @sinete/emissor

## 0.2.0

### Minor Changes

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
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
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

### Patch Changes

- Updated dependencies [2bd9b9a]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [84080ad]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [84080ad]
- Updated dependencies [84080ad]
- Updated dependencies [84080ad]
- Updated dependencies [2a46db6]
  - @sinete/nfe@0.2.0
  - @sinete/mdfe@0.2.0
  - @sinete/cert@0.2.0
  - @sinete/core@0.2.0
  - @sinete/da@0.2.0
  - @sinete/nfse@0.2.0
  - @sinete/transport@0.2.0

## 0.1.0

### Minor Changes

- 515861a: A documentação de uso vai no pacote, em `docs/` (`node_modules/sinete/docs/`, `node_modules/@sinete/emissor/docs/`): tutorial da primeira NF-e em homologação contra a SEFAZ simulada, guias de como fazer (store em SQL com a suíte de contrato, retomada, contingência, cancelamento, CC-e, MDF-e com encerramento, NFS-e, IBS/CBS, browser com transmissão no servidor, documentos auxiliares, ocorrências de validação), explicações, a referência gerada dos tipos, uma página por código de erro e o bloco do `AGENTS.md`.
- 515861a: A API do emissor depois da migração do primeiro integrador (ADR 0010, decisão 6):
  
  - `aoDecidir` e o novo `jaGuardado` valem por chamada (`OpcoesEmitir`, `OpcoesRetomar`, `OpcoesRetomada`) e ficam opcionais no emissor; sem `aoDecidir` em nenhum lugar, `emitir` e `retomar` lançam `ConfigError` antes de travar.
  - `emitir(ref, preparar)`: a entrada pode ser uma função chamada com a trava, só sem bytes gravados, que devolve a entrada e o `meta` gravado com os bytes.
  - NF-e e MDF-e aceitam a montagem de um documento: `{ nfe, montagem }` e `{ mdfe, montagem }`, por cima da montagem do emissor.
  - `jaGuardado(registro)`: com bytes gravados, o emissor pergunta antes de ir à SEFAZ se o documento já foi guardado; se sim, apaga a gravação e devolve o desfecho novo `ja-guardado`.
  - `situacaoPosterior: 'divergente'` devolve o documento cancelado ou encerrado fora do fluxo como `divergente` (com `situacaoAtual` e `proc`) e mantém os bytes.
  - `DesfechoPendente.anterior` traz o `cStat` e o `xMotivo` da duplicidade que levou à consulta quando a consulta não decidiu.
  - `certificado` (um `CertificadoAberto`: signer, titular e identidade do mTLS) no lugar de `pfx` e `senha`; `abrirCertificado(cert, { completarCadeia })` abre como o emissor abriria. O pool aceita qualquer tipo de certificado com a opção `chave`, e `CertificadoA1` passa a sair de `certificado.ts`.
- 515861a: Contingência automática da NF-e e da NFC-e (ADR 0013), desligada por padrão: `contingencia: { automatica: true, limiteFalhas, janelaMs, sondaMs, xJust }` e `aoMudarContingencia`. Depois de `limiteFalhas` falhas do autorizador normal na janela (sem resposta, 108 ou 109), a NF-e consulta o status na SVC da UF e só entra com 107, a SVC ativada pela SEFAZ de origem (NT 2013.007 v1.03, item 04.7); com 114, 113 ou sem resposta, não entra, avisa `svc-indisponivel` e guarda a resposta por `sondaMs` para todas as réplicas. Em contingência, a NF-e nova sai na SVC da UF (tpEmis 6 ou 7) e sai dela com 107 no autorizador normal, 114 na SVC (na sonda ou na autorização) ou na hora do 113. A NFC-e, que não tem SVC, entra na off-line (tpEmis 9) com o status do autorizador normal sem 107 e é gravada sem envio (`pendente` com `motivo: 'contingencia'`). Bytes já gravados nunca mudam de tipo de emissão. O `TransmissaoStore` ganha seis métodos opcionais (`registrarFalhaDoAutorizador`, `contingenciaAtiva`, `entrarEmContingencia`, `sairDaContingencia`, `reservarSonda`, `marcarFimDaSvc`) para o estado entre processos, implementados no store em memória e conferidos pela suíte de contrato (`contingencia: false` pula os casos); sem eles, o estado fica na memória do processo. A recusa 114 é transitória para a barreira da recusa repetida.
- 515861a: O DANFSe passa a ser gerado localmente, pelo `@sinete/da/nfse`, porque a API de geração do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026) e responde 404.
  
  Mudança de API no emissor de NFS-e (`@sinete/emissor/nfse`): `pdf(chave)`, que pedia o PDF ao ADN e devolvia `Promise<Uint8Array | undefined>`, virou `pdf(nfse, opcoes?)`, que recebe o XML da NFS-e (o `proc` do desfecho autorizado), gera o DANFSe v2 sem ir à rede e devolve `Promise<Uint8Array>`. Novos: `pdfCancelado(nfse, evento, opcoes?)`, com a marca de cancelada ou substituída pelo evento registrado, e `pdfPorChave(chave, opcoes?)`, que consulta a NFS-e e os eventos de cancelamento na Sefin e gera com a marca (`undefined` se a Sefin não conhece a chave). A opção `da` aceita o módulo `@sinete/da/nfse`, como nos emissores de NF-e e MDF-e.
  
  Remoção no `@sinete/nfse`: o `NfseClient` não tem mais o `obterDanfse`. Quem o chamava gera o DANFSe com `danfse` de `@sinete/da/nfse` a partir do XML da NFS-e.
- 515861a: Protocolo sem `digVal` (opcional no leiaute) deixa de prender a gravação. A denegação (110, 301, 302, 303) é decisão sobre a chave: na resposta do envio e na consulta, o emissor devolve `denegado`, definitivo, mesmo sem `digVal`, com `conteudo` (`confere`, `sem-digval` ou `difere`), os bytes gravados em `xml` e o `proc` só quando o `digVal` confere (`proc` passa a ser opcional no `DesfechoDenegado`). A autorização sem `digVal` nem na consulta vira `divergente` com `conteudo: 'sem-digval'`, com os bytes mantidos e alerta na primeira retomada, em vez de `pendente` para sempre; o mesmo vale para o MDF-e. No `@sinete/nfe` e no `@sinete/mdfe`, o `resolverEnvioSemResposta` ganha a ação `sem-prova` e, na NF-e, conclui a denegação com qualquer conteúdo, dizendo qual em `conteudo`. O `@sinete/sefaz-sim` ganha `setProtocoloSemDigVal` para reproduzir o caso.
- 515861a: Primeira versão do `@sinete/emissor` (ADR 0010), a camada que emite, retoma e cancela DF-e com estado entre chamadas. Na raiz, sem importar nenhum pacote de documento: o `TransmissaoStore` (bytes assinados gravados antes do envio, trava entre processos com prazo e renovação medidos pelo relógio do banco, fencing antes de guardar o desfecho), o desfecho normalizado (`autorizado`, `denegado`, `recusado`, `pendente` com o motivo, `divergente`) com a política dos bytes por cStat (`destinoDosBytes`), `createEmissor(perfil, opcoes)`, `retomarPendentes` para o job (lote, prazo, alerta único, flag por registro) e `createPoolDeEmissores` por certificado. Um emissor por documento nos subpaths `/nfe` (`createNfeEmissor`: recibo 103, autorizador pela chave, cancelamento com recuperação, CC-e, DANFE e DANFE cancelado), `/mdfe` (`createMdfeEmissor`: idem, com `encerrar` e DAMDFE) e `/nfse` (`createNfseEmissor`: `substituir`, cancelamento confirmado pelos eventos, DANFSe do ADN); `emitir(ref, entrada)` recebe o id do integrador, e os pacotes de documento e o `@sinete/da` são peer dependencies opcionais. `/memoria` traz o adaptador em memória e `/contrato` a suíte de contrato para quem implementa o store no próprio banco.
- 515861a: A barreira da recusa repetida passa a contar (ADR 0012): a mesma recusa (mesmo conteúdo e mesmo `cStat`) volta à SEFAZ até o limite dentro da janela, e só a tentativa seguinte lança `RecusaRepetidaError`. Novo `recusaRepetida.limite`, 3 por padrão (a 4ª tentativa igual não sai); a janela conta desde a primeira recusa da sequência. Assim o reenvio depois de resolver a causa fora da nota (o credenciamento do emitente, 203) passa sem `reenviarRecusado`. Quebra para quem implementou o store: `registrarRecusa` recebe `janelaMs` e conta a sequência numa instrução atômica (mesma recusa dentro da janela soma 1, outra ou a janela vencida recomeça em 1), `recusaRecente` filtra pela primeira da sequência e `RecusaRegistrada` ganha `vezes` e `primeiraEm`; o guia `store-sql.md` traz a tabela com as colunas novas. `details` do erro ganha `primeiraEm`, `vezes` e `limite`. A suíte de contrato ganha os casos da conta.
- 515861a: Barreira da recusa repetida (ADR 0012): com um `TransmissaoStore` que implementa os novos métodos opcionais `registrarRecusa` e `recusaRecente`, o emissor lembra o SHA-256 dos bytes descartados por uma recusa da SEFAZ e lança `RecusaRepetidaError` (`recusa_repetida`), antes de gravar e sem ir à SEFAZ, quando a mesma `ref` montaria os mesmos bytes dentro da janela (1 hora por padrão, `recusaRepetida: { janelaMs }` ou `false`). Evita o bloqueio por consumo indevido (rejeição 656). A nota corrigida e a retomada de bytes gravados nunca são barradas; a recusa do serviço (108, 109, 999) não conta; `emitir(ref, entrada, { reenviarRecusado: true })` envia depois de uma correção fora da nota. O store em memória implementa os dois métodos; store com um só lança `ConfigError`. A suíte de contrato ganha três casos, incluídos por padrão: o adaptador sem os métodos passa `recusas: false`. `PerfilDocumento` ganha `transitorio` opcional.
  
  O emissor da NF-e confere o certificado antes de assinar: sem CNPJ nem CPF, `ConfigError` (rejeição 282); emitente de outro CNPJ-base ou CPF, `ValidationError` com `emitente_difere_do_certificado` (213, 227).

### Patch Changes

- 515861a: A documentação embarcada acompanha a API nova do emissor: guia de como emitir por vários emitentes no mesmo servidor (certificado aberto, pool com `chave`, `aoDecidir` e `jaGuardado` por chamada, entrada preparada), os desfechos `ja-guardado`, `anterior` e `situacaoPosterior` na retomada e na explicação dos bytes, e o bloco do `AGENTS.md` com a entrada preparada e o `abrirCertificado`.
- 515861a: Documentação embarcada: guia "Como emitir NFC-e" (regras do modelo 65, QR Code versões 2 e 3, contingência off-line), a contingência com a NFC-e off-line e o bloco do `AGENTS.md` com a NFC-e e os nomes novos do `sinete/nfe`.
- 515861a: A barreira da recusa repetida compara pelos bytes também as recusas do QR Code da NFC-e que entraram no catálogo (444, 445, 474, 583 e 797), como já fazia com as outras de data, assinatura e QR Code.
- 515861a: A suíte de contrato do `TransmissaoStore` renova a trava a cada terço do prazo, não a cada metade, no caso "renovar estende a trava em vigor": com espera de verdade, o atraso do timer ou do banco reprovava adaptador certo. O caso continua passando do prazo original e reprovando o adaptador que não estende a trava.
- 515861a: O `cancelar` da NFS-e, depois de um pedido sem resposta, consulta o evento com o tipo 101101 e a sequência 1. Antes consultava só pelo tipo, a Sefin real respondia 404 e o emissor devolvia `pendente` mesmo com o cancelamento registrado.
- 515861a: O `cancelar` da NFS-e trata a E0840 (Anexo II v1.01: outro evento já vinculado à NFS-e) como o 573 da NF-e: consulta o e101101 com a sequência 1 e, se o cancelamento já estiver registrado (a resposta do primeiro pedido se perdeu), devolve `registrado` com `recuperado: true`, o XML do evento e a E0840 em `bruto`. Sem o evento na consulta, a E0840 continua `recusado`. O código vem da lista `eventoJaRegistrado` da NFS-e no `data/cstat.json`, conferida contra o catálogo do `@sinete/rejeicoes`.
- 515861a: A barreira da recusa repetida compara o conteúdo da nota, não os bytes: sai da comparação o que muda sozinho entre duas montagens (hora de emissão e de saída, código numérico e dígito da chave, assinatura, grupo suplementar), por `PerfilDocumento.conteudoParaRecusa`. Quem remonta a nota a cada tentativa com a hora de agora também é barrado; a nota corrigida continua passando. A recusa que se corrige num desses campos (toda mensagem do catálogo que fala de data, prazo, chave, assinatura, certificado, QR Code ou CSRT; `campoVolatil` na tabela do emissor) continua comparada pelos bytes.
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
  - @sinete/nfe@0.1.0
  - @sinete/transport@0.1.0
  - @sinete/core@0.1.0
  - @sinete/da@0.1.0
  - @sinete/mdfe@0.1.0
  - @sinete/nfse@0.1.0
