# @sinete/nfe

## 0.1.0

### Minor Changes

- 515861a: `nfeAssinadaDoProc(xml)` e `mdfeAssinadoDoProc(xml)`: o documento assinado de dentro do `nfeProc` ou do `mdfeProc` guardado (ou o próprio documento), como fatia do texto. Os namespaces que a raiz herdava do envelope são declarados nela, porque `consultar`, `resolverEnvioSemResposta` e a retomada recusam raiz sem `xmlns` próprio; o C14N do elemento assinado não muda, então a assinatura confere dentro e fora do proc. Sem documento assinado, `ConfigError`.
- 515861a: Protocolo sem `digVal` (opcional no leiaute) deixa de prender a gravação. A denegação (110, 301, 302, 303) é decisão sobre a chave: na resposta do envio e na consulta, o emissor devolve `denegado`, definitivo, mesmo sem `digVal`, com `conteudo` (`confere`, `sem-digval` ou `difere`), os bytes gravados em `xml` e o `proc` só quando o `digVal` confere (`proc` passa a ser opcional no `DesfechoDenegado`). A autorização sem `digVal` nem na consulta vira `divergente` com `conteudo: 'sem-digval'`, com os bytes mantidos e alerta na primeira retomada, em vez de `pendente` para sempre; o mesmo vale para o MDF-e. No `@sinete/nfe` e no `@sinete/mdfe`, o `resolverEnvioSemResposta` ganha a ação `sem-prova` e, na NF-e, conclui a denegação com qualquer conteúdo, dizendo qual em `conteudo`. O `@sinete/sefaz-sim` ganha `setProtocoloSemDigVal` para reproduzir o caso.
- 515861a: O autorizador sai do documento e da chave, não das opções do cliente. `autorizar` vai à UF do cUF da NF-e assinada; `autorizar`, `consultar`, `cancelar`, `cancelarPorSubstituicao` e `consultarRecibo` com a nota seguem o tpEmis da chave (6 SVC-AN, 7 SVC-RS), seja qual for a contingência de agora; a CC-e vai sempre à UF. Antes, a nota assinada em SVC e retomada depois do fim da contingência ia à UF, e a nota normal enviada por um cliente em contingência ia ao SVC. O fuso dos eventos passa a ser o da UF da chave.
  
  `NfeClientOptions.uf` fica opcional: vale só para os serviços sem documento (status, inutilização, recibo sem a nota, `cUFAutor` padrão da distribuição), que lançam `ConfigError` sem ela. A nota em SVC sai da montagem (`NfeInput.contingencia`), e um cliente atende todas as UFs do certificado.
  
  Quebra: `NfeClientOptions.contingencia` deixa de valer para autorização, consulta e eventos.
- 515861a: Quebra: `NfeClient.consultarProtocolo` passa a se chamar `consultar`, com a mesma assinatura, o mesmo nome do MDF-e e da NFS-e. `AutorizarOpcoes` ganha `signal`. O emissor de poucas linhas (`createNfeEmissor`) está no `@sinete/emissor/nfe`, e o `@sinete/nfe` não tem mais o `@sinete/da` como peer dependency.
- 515861a: `IbsCbsNotaRequest` ganha `emissao`, o instante do `dhEmi`, para a calculadora saber quais regras de validação da NT 2025.002 já estão implantadas no ambiente.
- 515861a: IBS/CBS calculado por padrão: sem `options.ibsCbs`, o `buildNfe` usa o `ibsCbsCalculator()`, sobre o `@sinete/ibs-cbs`, com o dataset do `@sinete/ibs-cbs-dados` importado sob demanda (`import()` dinâmico na primeira nota classificada, `carregarDatasetEmbarcado()` para adiantar), as alíquotas oficiais e os grupos conferidos pelas regras da NT 2025.002. `ibsCbsCalculator(options)` troca dataset, alíquotas, base, regras e fuso; local da operação pelo `cMunFGIBS`, destino ou emitente (`localDaOperacao`). Base sem `vBC` (a UB16-10 ainda não tem regra), crédito presumido sem o grupo pronto, erro de classificação, regime não suportado, alíquota desconhecida e violação de regra voltam como ocorrências no caminho do item (`ibscbs_base_ausente`, `ibscbs_nao_suportado`, `ibscbs_redutor_divergente`, `ibscbs_regra_nt`). A porta `IbsCbsCalculator` continua para trocar a calculadora. Sai o código `ibscbs_sem_calculadora`. O subpath `@sinete/nfe/ibs-cbs` reexporta o motor e o leitor do dataset, para quem emite NF-e não precisar importar os pacotes do IBS/CBS.
- 515861a: Primeira versão do @sinete/nfe (NF-e modelo 55): modelo de entrada tipado, montagem no PL vigente com derivados e totais (ICMSTot, ISSQNtot, IBSCBSTot, vItem, vNFTot) em decimal exato e modo de arredondamento por família, chave e cNF, contingência, responsável técnico com hashCSRT, validação estrita contra o schema antes de assinar e assinatura por splice. Porta `IbsCbsCalculator` para o IBS/CBS. Serviços sobre o `@sinete/transport`: status, autorização síncrona e assíncrona com política de recibo, consulta protocolo, cancelamento, CC-e, manifestação no AN, cancelamento por substituição, inutilização, consulta cadastro, Distribuição DF-e com docZip e roteamento SVC-AN e SVC-RS, com `nfeProc` e `procEventoNFe` montados por splice e resolução de envio sem resposta (204, 217, 539).
- 515861a: Documento modelo 65 usa a tabela da NFC-e do `@sinete/transport` (a opção `nfceEndpoint` passa a sobrepor, e sem ela a operação não é mais recusada), sempre no autorizador normal, também com o cliente em contingência SVC. O cancelamento por substituição monta e valida o `detEvento` pelo schema oficial do e110112. A inutilização recusa emitente CPF e a série 910 a 969 antes de enviar (NT 2018.001 v1.10, itens 6.1 e 6.2), em vez de mandar `000` + CPF no campo CNPJ.
- 515861a: NFC-e (modelo 65) na montagem: padrões do modelo (`indPres` 1, `indFinal` 1, `tpImp` 4), destinatário opcional com as regras de entrega a domicílio e do limite de R$ 10.000,00, pagamento obrigatório com troco, grupos vedados, contingência off-line (`tpEmis` 9) e o `infNFeSupl` com o QR Code versão 3 (padrão) ou versão 2 com CSC, com os endereços por UF e ambiente em tabela versionada. Novos: `assinaturaQrCode`, `comQrCode`, `TipoPagamento.PAGAMENTO_POSTERIOR` (tPag 91), `urlsNfce`, `XPROD_HOMOLOGACAO_NFCE`, `NFCE_LIMITE_SEM_DESTINATARIO`, as opções `qrCode`, `urlQrCode` e `urlChave`, e `mod` e `nfce` no `BuiltNfe`. Códigos de ocorrência novos: `grupo_vedado`, `pagamento_invalido` e `qrcode_invalido`.
- 515861a: `BuildNfeOptions.pagamentoIgualTotal`: o `vPag` do único `detPag` passa a ser o `vNF` calculado na mesma montagem, sem montar a nota duas vezes para descobrir o total. Nenhum, mais de um `detPag` ou `tPag` 90 dão a ocorrência nova `pagamento_igual_total`. Serve também no emissor do `@sinete/emissor/nfe`, pela opção `montagem`.
- 515861a: Porta do IBS/CBS: `IbsCbsItemRequest` leva `vICMSUFDest` e `vFCPUFDest` (ICMS e FCP de partilha para a UF de destino, zero sem o grupo), para a função `base` da calculadora deduzi-los sem que quem emite os passe por fora. A classificação do item (`ClassificacaoIbsCbs`) e o pedido aceitam `gTribRegular: { CSTReg, cClassTribReg }`, que a calculadora padrão passa ao motor: os cClassTrib que exigem a tributação regular (550001 e afins) deixam de precisar do grupo pronto.
  
  Quebra: quem monta um `IbsCbsItemRequest` à mão (dublê de teste de uma calculadora) precisa dos dois campos novos.
- 515861a: A montagem confere regras da SEFAZ que só dependem do documento e voltavam como rejeição (ADR 0012), com `origem: 'entrada'`: série de emitente CNPJ de 0 a 889 (RV C02-30 e B26-10, rejeições 503 e 244), CST 50 ou 51 com destinatário contribuinte isento fora das exceções (RV N12-80, 529), duplicata sem vencimento ou vencendo antes da emissão (Y09-20, 900) ou da parcela anterior (Y09-30, 850) e parcela única vencendo na emissão (NT 2025.001 v1.03, Y09-40, 853). Novo `conferirEmitenteDoCertificado` (RV F03 e F03A) e o código `emitente_difere_do_certificado`. O cliente recusa, antes de enviar, o autor explícito de cancelamento, cancelamento por substituição e CC-e diferente do emitente da chave (`autor_difere_do_emitente`, RV P12-44, 574).
- 515861a: Pré-validação do destinatário (grupo E do MOC 7.0 Anexo I, ADR 0012): destinatário estrangeiro (E03a-10, E03a-20, E03a-30, E03a-60), nome em produção e endereço na NF-e (E04-10, E05-10), município da UF do destinatário (E10-20), `idDest` contra as UFs com as exceções da regra (E12-30 a E12-60), país no exterior (E14-30), indicador da IE no exterior e para não contribuinte (E16a-20, E16a-40), IE no exterior (E17-40) e Suframa fora da área incentivada (E18-30), com `origem: 'entrada'`; as citações da E17-20 e da E17-30 foram corrigidas. O catálogo ganhou dicas curadas para 720, 721, 925, 372, 724, 726, 275, 772, 773, 926, 790, 728, 792 e 251, e a do 232 foi revista.
- 515861a: `NfeClient.statusServico({ mod: '65' })` consulta o status do autorizador da NFC-e, que em várias UFs é outro host que o da NF-e.
- 515861a: Ocorrências de validação classificadas pela fase em que nasceram (ADR 0011): `ValidationIssue.origem` é `entrada` quando a conferência foi sobre a entrada do domínio (o `path` é da entrada e corrigir o valor ali resolve) e `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD e o PL, chave gerada, grupo IBS/CBS da calculadora, regras da NT). `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem; o campo é opcional no tipo, então quem constrói ocorrências fora do sinete não quebra. A calculadora de IBS/CBS pode marcar a origem das próprias ocorrências; sem marca, entram como `montagem`.
  
  `rotuloDoCaminho(path)` no `@sinete/nfe` e no `@sinete/mdfe` dá o rótulo em português do caminho de uma ocorrência (`Item 2, Descrição do produto`, `Condutor 1, CPF`), para os caminhos da entrada e do documento montado, inclusive os do validador de XSD. O mecanismo fica no `@sinete/core` (`normalizarCaminho`, `criarRotuloDoCaminho`) para os outros documentos.
- 515861a: `recuperarEventoRegistrado(client, chave, tpEvento)`: consulta a chave e devolve o evento que a SEFAZ registrou (o `procEventoNFe` ou `procEventoMDFe` da consulta, com `nProt`, `dhRegEvento` e o retorno), para o pedido de evento que ficou sem resposta ou voltou 573 ou 580 (no MDF-e, duplicidade de evento). Só dá o evento como registrado quando o retorno diz 135, 136 ou 155 (MDF-e: 135, 134 ou 136) para a mesma chave e o mesmo tipo no pedido e no retorno; entre vários do mesmo tipo, o de maior sequência. Nunca infere pelo `cStat` do pedido. `registrado: false` traz a consulta, que pode ter sido só indecisa.

### Patch Changes

- 515861a: A consulta cadastro do MT volta a funcionar. O MT pede a mensagem dentro do elemento da operação do WSDL (`<consultaCadastro><nfeDadosMsg>`) e respondia 215 (falha no schema) ao corpo só com `nfeDadosMsg`. O envelope por autorizador fica em `data/servicos.json` (`envelopeNoAutorizador`), com a fonte.
- 515861a: A pré-validação deixa de recusar o CST 51 em operação interna com destinatário CPF isento (RV N12-80, exceção 3 a critério da UF) e deixa de conferir localmente o vencimento das duplicatas pelas RV Y09-20 e Y09-30: as notas autorizadas de um integrador em produção mostraram UF que não aplica essas regras. A Y09-40 (853) continua.
- 515861a: `resolverEnvioSemResposta` devolve `divergente` quando a consulta da chave responde 561, 562 ou 613 (a numeração tem outra NF-e), com a chave registrada extraída do `xMotivo` quando vier. Antes o desfecho era `indefinida`, e a retomada de bytes cujo número já tinha outra chave só alertava depois de várias tentativas.
- 515861a: `sliceElement` só leva para a raiz da fatia os prefixos cuja declaração está fora dela: um prefixo declarado num ancestral e redeclarado dentro do recorte deixava de ganhar uma declaração a mais, que mudava o C14N inclusivo de um irmão assinado no envelope.
- 515861a: A consulta cadastro da SEFAZ-MG volta a funcionar. A MG devolve o `retConsCad` sem o namespace da NF-e (ele herda o do WSDL) e declara o namespace só nos filhos; o cliente recusava a resposta com `resposta_invalida`. Agora aceita o elemento de retorno fora do namespace quando todos os filhos estão no da NF-e, e registra `nfe.soap.retorno_fora_do_namespace` no log.
- 515861a: O `verProc` padrão da NF-e e do MDF-e, e o `verAplic` padrão da NFS-e (DPS e pedidos de evento), passam de `sinete` para `sinete <versão do pacote>`, montado pelo novo `formatarVerProc` do `@sinete/core` e cortado com segurança se passar dos 20 caracteres do leiaute. A versão de cada pacote é embutida no build (`src/versao-gerada.ts`, gerado a partir do `package.json` por `scripts/versao-gerada.ts`), nunca lida em runtime. `options.verProc`/`options.verAplic` informado continua prevalecendo, como antes.
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
  - @sinete/transport@0.1.0
  - @sinete/core@0.1.0
  - @sinete/ibs-cbs-dados@2026.9.1
  - @sinete/ibs-cbs@0.1.0
  - @sinete/rejeicoes@0.1.0
  - @sinete/schemas@0.1.0
  - @sinete/validators@0.1.0
