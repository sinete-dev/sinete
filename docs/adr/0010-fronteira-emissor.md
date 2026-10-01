# ADR 0010: fronteira entre os pacotes de documento e o `@sinete/emissor`

- Status: aceito
- Data: 27/set/2026
- Complementa o [ADR 0008](0008-divisao-de-pacotes.md), com um quinto critério de divisão, e revê a decisão 3 do [ADR 0009](0009-verbos-e-caminho-curto.md), que pôs os emissores curtos dentro de cada pacote de documento.
- 01/out/2026, na política de estabilidade ([ADR 0016](0016-politica-de-estabilidade.md)): `consultar` dos emissores (`EmissorNfe.consultar`, `EmissorMdfe.consultar`, `EmissorNfse.consultar`) é passagem direta do `cliente.consultar` do documento, com o mesmo tipo de retorno, por decisão, e fica assim na 1.0. O desfecho do emissor descreve o que aconteceu com bytes gravados de uma transmissão; a consulta descreve a situação de uma chave na SEFAZ (autorizada, cancelada, não consta), sem bytes gravados nem trava. Devolver `Desfecho` misturaria os dois, e um tipo próprio de consulta no emissor repetiria o do cliente sem acrescentar política. O método existe para quem só tem o emissor à mão não precisar descer ao `cliente`.

## Contexto

O integrador em produção, único consumidor até aqui, não usa o `createNfeEmissor` nem o `createMdfeEmissor`. Ele monta a própria orquestração sobre a API completa (`createNfeClient`, `createMdfeClient`, `resolverEnvioSemResposta`): bytes assinados gravados com trava entre processos, recibo assíncrono, retomada por job, autorizador pela chave, cache de clientes por certificado, cancelamento com recuperação. É algo na ordem de mil linhas, e mais da metade é genérico: qualquer emissor multi-tenant e com mais de um processo precisa refazer.

A comparação achou cinco pontos em que o emissor curto do sinete se comportava diferente da orquestração do integrador em produção, e nos cinco o integrador estava certo: o `pending` do lote recebido (103) e o da consulta indecisa usavam o mesmo campo `ref` com significados diferentes; o autorizador vinha fixo das opções do emissor em vez de sair do documento e da chave; a nota cancelada fora do fluxo voltava da retomada como autorização comum; o abort depois de o pedido sair não contava como envio sem resposta; e o `MdfeClient.autorizar` não conferia o `tpAmb` do MDF-e, que vai comprimido onde a política do transporte não enxerga. Os cinco foram corrigidos nos pacotes de documento (branch `feat/emissor-fundacao`).

Os cinco têm a mesma causa: dois lugares de orquestração que evoluíram separados. Dentro do repositório, o risco se repetiria entre o emissor do `@sinete/nfe`, o do `@sinete/mdfe` e o do `@sinete/nfse`, que já eram três cópias da mesma política com diferenças de protocolo.

Nada foi publicado no npm, e o integrador em produção não usa o emissor curto: mudar o lugar e o contrato dele não quebra ninguém.

## Decisões

### 1. Um pacote novo, `@sinete/emissor`, pelo critério 5

O ADR 0008 lista quatro critérios para um pacote existir. Aplicados à camada de orquestração:

1. **Dependência pesada** não vale: a trava é uma interface, e o adaptador de referência em memória não pesa nada.
2. **Ritmo de release** não vale: a camada acompanha os pacotes de documento.
3. **Runtime** vale fraco: a orquestração com trava, renovação por timer e job é de servidor, enquanto `assinar` roda no browser (ADR 0009). Sozinho, não justificaria um pacote.
4. **Público próprio** não vale no sentido "instala só isto": quem usa o emissor sempre usa um pacote de documento.

O que separa é outro argumento, o mesmo que o ADR 0008 usou para tirar o IBS/CBS do `@sinete/nfe`: a camada compõe vários pacotes de documento. Dentro do `@sinete/nfe`, a retomada genérica faria a NF-e depender do MDF-e e da NFS-e; em cada pacote, haveria três cópias da mesma política, que é o que produziu as divergências. Fica registrado como critério novo, para não virar precedente de pacote sem critério:

5. **Camada que compõe vários pacotes de documento.** A parte orquestra dois ou mais pacotes de documento com a mesma política (estado entre chamadas, persistência, trava, retomada), e mantê-la dentro de um deles faria esse pacote depender dos outros ou obrigaria a copiar a política em cada um.

O critério não cobre utilitário que só um documento usa, nem código que dois documentos compartilham sem política (esse vai para o `@sinete/core` ou para um subpath).

### 2. Peers opcionais e um subpath por documento

Um pacote que depende dos três documentos faria quem só emite NF-e instalar MDF-e e NFS-e. A saída é a do `@sinete/da` no ADR 0009:

- `@sinete/nfe`, `@sinete/mdfe` e `@sinete/nfse` são `peerDependencies` opcionais (`peerDependenciesMeta`) do `@sinete/emissor`.
- Cada documento tem um subpath que importa o seu pacote de forma estática: `@sinete/emissor/nfe`, `@sinete/emissor/mdfe`, `@sinete/emissor/nfse`. O subpath se lê como o que é ("emissor de NF-e").
- A raiz do `@sinete/emissor` fica só com o comum (`TransmissaoStore`, trava, retomada, pool, tipos de desfecho) e não importa nenhum documento.
- Um teste de subpath, como o `test/subpaths.test.ts` do `@sinete/da`, confere no fonte que a raiz não leva nenhum documento e que cada subpath só leva o seu; a smoke confere o mesmo no tarball.
- O guarda-chuva `sinete` ganha `sinete/emissor/nfe` e afins pelo `scripts/umbrella.ts`, como qualquer pacote coberto.

Medido na smoke (Deno 2.9.1, tarballs num verdaccio local, 27/set/2026), o import estático de peer opcional no Deno com `npm:` funciona com uma condição: sem `node_modules`, o Deno só materializa a peer opcional que está no grafo estático do app. `import { createNfeEmissor } from 'npm:@sinete/emissor/nfe'` sozinho falha na resolução com `Could not find package '@sinete/nfe' from referrer .../@sinete/emissor/.../dist/nfe.js`; basta o app importar `npm:@sinete/nfe` em qualquer ponto do grafo (antes ou depois do emissor), e declarar o pacote só no `imports` do `deno.json`, sem importá-lo, não basta. Com `package.json` e `node_modules` (o Deno no modo de compatibilidade), a resolução é a do Node e o especificador nu funciona. A raiz e o `/memoria` não precisam de peer nenhuma. Sem o `@sinete/da`, o `pdf()` pede o pacote com `ConfigError` no Deno como no Node. A regra está no README do `@sinete/emissor`, e a smoke confere os três casos: o emissor com a peer importada pelo app, o consumidor sem o `@sinete/da` e o `@sinete/emissor/nfe` sem o `@sinete/nfe` no grafo (aceita o erro de resolução com o nome do pacote ou a resolução; qualquer outro desfecho reprova).

### 3. Regra da fronteira

**Fica nos pacotes de documento** o protocolo e as primitivas sem estado: uma chamada à SEFAZ, ou uma leitura, com resposta tipada e sem política.

- cliente, montagem, assinatura, `resolverEnvioSemResposta` com `acao`, `aguardarRecibo`;
- o autorizador pela chave e pelo documento no `NfeClient`, o `tpAmb` conferido no `MdfeClient.autorizar` e o `cancelado` do transporte tratado como envio sem resposta;
- `recuperarEventoRegistrado(client, chave, tpEvento)`, que lê da consulta o evento que a SEFAZ já tem e nunca infere pelo cStat 573 ou 580;
- `nfeAssinadaDoProc` e `mdfeAssinadoDoProc`, `pagamentoIgualTotal` na montagem da NF-e, `vICMSUFDest` e `vFCPUFDest` na porta do IBS/CBS e `gTribRegular` na classificação;
- no `@sinete/da`, o `damdfe` aceitando o `procEventoMDFe` em `cancelado`.

**Vai para o `@sinete/emissor`** o que precisa de estado entre chamadas, relógio de negócio ou decisão sobre o que fazer com os bytes:

- os emissores curtos (`emitir`, `assinar`, `retomar`, `consultar`, `cancelar`, `pdf`);
- persistência e trava (`TransmissaoStore`), o adaptador de referência em memória e uma suíte de contrato para quem implementa em SQL;
- a política dos bytes: decidido (autorizado ou denegado: grava e conclui), indefinido (204, 539, 103, 105: mantém) e recusado (descarta); ver o ajuste 5 abaixo;
- recibo assíncrono e resolução do envio sem resposta dentro de `emitir` e `retomar`;
- cancelamento com recuperação (sem `nProt`, 573, 580), usando a primitiva do documento;
- regeração do PDF com a marca de cancelado (só o render; guardar é do integrador);
- `retomarPendentes` para o job, sem agendador;
- pool de emissores por certificado.

Na dúvida, a pergunta é: a função precisa lembrar de algo entre duas chamadas, ou decidir por quem chama o que fazer com o documento? Se sim, é do emissor. Se é uma leitura ou uma chamada à SEFAZ com desfecho tipado, é do documento.

### 4. Os emissores curtos se mudam, com `TransmissaoStore` obrigatório

`createNfeEmissor`, `createMdfeEmissor` e `createNfseEmissor` saem dos pacotes de documento e vão para os subpaths do `@sinete/emissor`. Dois lugares de orquestração é exatamente o que produziu as divergências; manter o emissor com `aoAssinar` no `@sinete/nfe` e outro com `store` no pacote novo repetiria o problema dentro do repositório.

- **`TransmissaoStore` no lugar do `aoAssinar`.** O `store` é obrigatório, como o `aoAssinar` era (ADR 0009, decisão 3). O `aoAssinar` garante que os bytes existem antes do envio, mas não resolve a trava entre processos, a renovação, o fencing antes de gravar o desfecho, nem o ciclo de vida da gravação; é justamente o que deixa o integrador achar que está coberto. Não fica como segundo modo.
- **Sem `uf` fixa.** Com o autorizador saindo do documento e da chave (já feito no `NfeClient`), um emissor por certificado e ambiente atende todas as UFs, que é o que o pool precisa.
- **Desfecho próprio.** O ADR 0009 queria o desfecho do emissor igual ao `SefazOutcome` do resto da lib. Com bytes gravados, `pendente` (com o motivo e o que é a referência) e `divergente` são estados que o `SefazOutcome` não tem, e a situação posterior do documento (cancelado ou encerrado fora do fluxo) precisa de um campo. O emissor passa a ter um desfecho normalizado entre os documentos, com o desfecho bruto de cada um junto, e deixa de lançar `DocumentoDivergenteError` para o que é um estado dos bytes gravados. Sem outro uso, a classe sai do `@sinete/core`.
- **Sem alias.** Pela mesma regra do ADR 0009: nada foi publicado e o integrador em produção não usa o emissor. O README de cada pacote de documento passa a abrir apontando para o `@sinete/emissor/<doc>`, e quem chega pelo guarda-chuva `sinete` continua com uma dependência só.

O custo é o que o ADR 0009 queria evitar: quem chega pelo npm instala dois pacotes em vez de um (`@sinete/emissor` e `@sinete/nfe`). É pequeno perto de manter duas orquestrações.

### 5. Ajustes na implementação

A implementação (branch `feat/emissor-pacote`) seguiu as decisões acima e a análise que as originou, com estes desvios:

1. **A interface do store recebe durações, não instantes.** A análise tinha `listarPendentes({ assinadosDesde, paradosAntesDe })` com datas calculadas no processo, o que contradiz a regra do relógio do banco da própria análise. `FiltroPendentes` tem `idadeMaximaMs`, `paradaHaMs` e `intervaloDepoisDoAlertaMs`, e o adaptador compara com o `NOW()` do banco, como já fazia com o `prazoMs` da trava. A pendência do relógio do banco fica resolvida na interface e documentada em `src/store.ts` e no README.
2. **`RegistroTransmissao.gravacao`.** A contagem de tentativas e o alerta são de uma gravação, não do documento: depois de um descarte, o mesmo `ref` pode ser gravado de novo, e a retomada que termina tarde não pode contar tentativa na gravação nova. `registrarTentativa` confere a `gravacao` e devolve `registrada: false` quando ela já saiu.
3. **`usarEmissor(registro, fn)` no lugar de `emissorPara(registro)`.** O pool empresta por escopo (`pool.usar(cert, fn)`), para só fechar o transporte depois do último empréstimo e sem `AsyncLocalStorage`; um `emissorPara` que devolve o emissor não diria quando o empréstimo acaba.
4. **O desfecho usa `id`, não `chave`.** Na NFS-e o que o emissor conhece antes da resposta é o Id da DPS; o nome é o mesmo do `RegistroTransmissao`.
5. **Recusado com cStat indefinido mantém os bytes.** A decisão 3 separa indefinido de recusado, mas a duplicidade que nem a consulta nem o reenvio resolveram (o reenvio volta 204 de novo, por exemplo) chega como `recusado` com o `cStat` da SEFAZ, que é o que o integrador precisa ver. `destinoDosBytes(d, perfil.indefinido)` mantém os bytes quando o `cStat` está na lista de indefinidos do documento (duplicidade e lote em processamento, em `src/data/cstat.json`), como a lista equivalente do integrador em produção. Descartar ali liberaria o número com um documento possivelmente autorizado na SEFAZ.
6. **`situacaoAtual` conclui por padrão.** O documento que a consulta acha cancelado ou encerrado fora do fluxo é `autorizado` com `situacaoAtual`, vai para o `aoDecidir` e os bytes são concluídos: o integrador guarda o documento com a situação certa e decide o que mais fazer. Quem não guarda como ativo um documento que a SEFAZ já cancelou escolhe `situacaoPosterior: 'divergente'` (decisão 6).
7. **Cancelamento da NFS-e sem `recuperarEventoRegistrado`.** O `@sinete/nfse` não tem a primitiva; o emissor confirma o cancelamento sem resposta, ou recusado com E0840 (o equivalente do 573 da NF-e, na lista `eventoJaRegistrado` do `src/data/cstat.json`), pelo `consultarEventos` do cliente, com o tipo do evento e a sequência 1 (a Sefin real não atende a consulta sem os dois, ADR 0004, rodada 4). Sem o e101101 na consulta, a E0840 continua `recusado`, porque o evento vinculado é outro (a substituição, por exemplo). Se ela for útil fora do emissor, sobe para o `@sinete/nfse` com o mesmo nome dos outros documentos.
8. **O `@sinete/da` continua importado sob demanda ou injetado.** A decisão 2 fala em import estático para os pacotes de documento, e é o que os subpaths fazem. O `@sinete/da` é peer opcional só para o `pdf()` e segue o ADR 0009: import em runtime em Node e Bun, módulo passado na opção `da` no Deno e no browser.

### 6. O que a migração do primeiro integrador mudou

A migração do integrador em produção (28/set/2026) usou o emissor como a decisão 5 o deixou e precisou de seis contornos, que somaram mais código do que tiraram. Cada um virou mudança no emissor, ainda em 0.x:

1. **`aoDecidir` e `jaGuardado` por chamada.** O emissor vive no pool, um por certificado, e o `aoDecidir` fixo na criação obrigava o integrador a manter um registro em memória de quem guarda cada documento, e a recusar a segunda transmissão do mesmo documento no processo para o registro não se confundir. `OpcoesEmitir`, `OpcoesRetomar` e `OpcoesRetomada` aceitam `aoDecidir` e `jaGuardado`, que valem sobre os do emissor; no emissor, os dois ficam opcionais, e sem `aoDecidir` em nenhum lugar a chamada lança `ConfigError` antes de travar. A concorrência entre transmissões volta a ser só da trava do store.
2. **A entrada preparada com a trava.** O `meta` ia nas opções de `emitir`, antes da montagem, mas o que o integrador grava com os bytes (o número, as datas, os ids dos itens) só existe depois de preparar o documento, e preparar antes da trava fazia o trabalho, e a recusa de um documento que não é mais rascunho, também nas retomadas, que ignoram a entrada. `emitir` aceita no lugar da entrada uma função (`PrepararEntrada`) que o emissor chama com a trava, só sem bytes gravados, e que devolve a entrada e o `meta`. Junto, a NF-e e o MDF-e aceitam a montagem de um documento (`{ nfe, montagem }`, `{ mdfe, montagem }`) por cima da do emissor: a data de emissão que o integrador já fixou, o pagamento igual ao total, uma exigência relaxada para um emitente.
3. **`situacaoPosterior: 'divergente'`.** O ajuste 6 continua o padrão; a opção devolve o documento cancelado ou encerrado fora do fluxo como `divergente`, com `situacaoAtual` e o `proc`, e mantém os bytes, sem o integrador reescrever o desfecho no perfil.
4. **A recusa anterior na pendência.** Quando a duplicidade (204, 539; E0014 na NFS-e) leva à consulta e a consulta não decide, o `pendente` perdia o `cStat` da SEFAZ. `DesfechoPendente.anterior` traz o `cStat` e o `xMotivo` da recusa.
5. **Certificado aberto.** O emissor só aceitava PFX e senha e abria o arquivo de novo a cada emissor, sem a cadeia completada que o integrador já mandava no mTLS. `OpcoesEmissor.certificado` recebe um `CertificadoAberto` (signer, titular e identidade do mTLS), `abrirCertificado` abre como o emissor abriria (com `completarCadeia`), e o pool aceita qualquer tipo de certificado com a opção `chave`.
6. **`jaGuardado`.** Se o processo cai entre o `aoDecidir` e o `concluir`, a retomada consultava a SEFAZ de novo; com o documento cancelado nesse meio tempo, a gravação voltava com `situacaoAtual` e, no integrador que a trata como divergente, nunca saía. O gancho é consultado com a trava, antes de ir à SEFAZ; se o documento já foi guardado, a gravação sai e o desfecho é `ja-guardado`, um tipo novo que `destinoDosBytes` conclui sem `aoDecidir`.

O `TransmissaoStore` não mudou, e a suíte de contrato também não. O cancelamento com recuperação (sem `nProt`, 573, 580) já estava no emissor e passou a ser o do integrador.

### 7. Protocolo sem `digVal`: a denegação é da chave, a autorização precisa de prova

Um integrador em produção recebeu NF-e denegadas (302) com o `protNFe` sem `digVal`. O `digVal` é opcional no protocolo (`TProtNFe/infProt/digVal` e `TProtMDFe/infProt/digVal`, minOccurs 0 nos XSD do PL_010 e do MDF-e 3.00b), e o perfil da NF-e só concluía autorizada ou denegada com o `nfeProc`, que o cliente só monta quando o `digVal` confere. A denegação caía na consulta, a consulta também não montava o `nfeProc`, e o desfecho virava `pendente` com `consulta-indefinida`: a gravação nunca saía e a retomada repetia a consulta até a idade máxima. A autorização sem `digVal` tinha o mesmo buraco, na NF-e e no MDF-e.

1. **A denegação é decisão sobre a chave.** Pelo MOC 7.0 (Anexo I, tabela 4.4.3, códigos 110, 301, 302 e 303; regras 1C17-40, 5E17-40 e 5E17-60), a NF-e denegada fica registrada e o número não pode ser reaproveitado nem inutilizado, qualquer que seja o conteúdo. Na resposta ao envio destes bytes e na consulta que devolve a chave denegada, o desfecho é `denegado`, definitivo, mesmo sem `digVal`: vai para o `aoDecidir` e os bytes são concluídos pela política da decisão 3.
2. **O desfecho diz o que o `digVal` prova.** `DesfechoDenegado.conteudo` é `confere` (o `proc` é o `nfeProc` destes bytes), `sem-digval` ou `difere` (a SEFAZ denegou a chave com outro conteúdo). O `proc` passa a ser opcional e só vem com `confere`, para nenhum `nfeProc` juntar um protocolo a bytes que ele não prova; o desfecho leva os bytes gravados em `xml` e o protocolo em `protocolo.protNFe`, que é o que o integrador guarda sem `proc`. Com `difere`, o número continua denegado (tratar como `divergente` manteria os bytes de um número que nunca mais será autorizado), mas o integrador precisa saber que o documento registrado não é o dele. Na resposta direta ao envio, o `digVal` diferente continua `ProtocolError` do cliente (`resposta_invalida`), que o emissor trata como envio sem resposta: a consulta decide, e a denegação volta com `difere`.
3. **Autorização sem prova não é dada como nossa.** Autorizada sem `digVal` na resposta, o emissor consulta a chave, como antes. Sem `digVal` também na consulta, a resolução do pacote do documento é `sem-prova` (acao nova do `resolverEnvioSemResposta` da NF-e e do MDF-e), e o emissor devolve `divergente` com `conteudo: 'sem-digval'` e mantém os bytes. `divergente` porque é o estado que já significa "a SEFAZ tem uma decisão sobre este número que o emissor não reconcilia com estes bytes, e tentar de novo não resolve": a retomada alerta na primeira tentativa e segue com uma tentativa por `intervaloDepoisDoAlertaMs` até a idade máxima, sem loop, e se o autorizador passar a mandar o `digVal`, a tentativa seguinte prova o conteúdo e guarda. O integrador resolve antes baixando o XML autorizado, conferindo e guardando, e o `jaGuardado` apaga a gravação. Um tipo novo de desfecho foi descartado: repetiria a política do `divergente` e obrigaria todo `switch` do integrador a mudar por um caso raro. `DesfechoDivergente.conteudo` (`difere` ou `sem-digval`) distingue os casos da mesma chave; ausente, a SEFAZ tem outra chave no número.
4. **Situação sem protocolo continua indefinida.** A consulta que diz denegada (ou autorizada) sem `protNFe` não dá ao integrador o que guardar: segue `indefinida`, e a pendência é a de sempre.

O `@sinete/sefaz-sim` ganhou `setProtocoloSemDigVal('denegacao' | 'todos', onde)`, que tira o `digVal` das respostas da autorização, da consulta ou das duas, para os testes do emissor reproduzirem o caso.

### 8. `signal` no emissor (0.3.0)

Os clientes dos documentos aceitam `signal` em toda chamada que vai à rede; o emissor e os resolvedores não aceitavam, e quem queria um prazo próprio para `emitir` (a requisição HTTP do usuário, o desligamento do processo) não tinha como parar. O `signal` entra como opção (`EnvioOpcoes`, o mesmo formato do dos clientes) em `emitir`, `retomar`, `substituir` (NFS-e), `consultar`, `cancelar`, `cartaCorrecao`, `encerrar` e `pdfPorChave`, em `retomarPendentes`, e no `opcoes?` do fim de `resolverEnvioSemResposta` e `recuperarEventoRegistrado` dos três documentos.

O abort tem dois lados, separados pelo momento em que os bytes são gravados, porque é ali que a política dos bytes (decisão 3) passa a valer:

1. **Antes de gravar, lança.** Sinal já disparado na chamada, ou disparado na preparação, na montagem ou na assinatura: `emitir` lança o `ErroTransporte` com `code: 'cancelado'`, nada é gravado, e a trava, se já foi tomada, é solta no `finally` (se o `soltar` falhar, ela vence no prazo, como em qualquer erro). A conferência é feita também logo antes do `gravar`, o último ponto em que o abort não deixa rastro. O mesmo vale para `retomar` com bytes de antes da chamada, disparado antes do envio: lança e os bytes ficam como estavam. O sinal é conferido de novo depois de cada espera que antecede o envio (o `jaGuardado` do integrador, a consulta da contingência off-line): abortado durante o `jaGuardado`, a gravação não é concluída nem apagada.
2. **Depois de gravar, é envio sem resposta.** O abort cancela a requisição em curso (o transporte lança `cancelado`, que o `semResposta` já tratava como envio que pode ter chegado), e o perfil não começa outra chamada à rede: nem a consulta que resolveria o envio, nem o reenvio. O desfecho é `pendente` com `motivo: 'sem-resposta'` e o `cancelado` em `causa`; os bytes ficam (`manter`, com a conferência da trava de sempre), a trava é solta no fim, e `retomar` ou a retomada automática continuam com os mesmos bytes. O abort na espera do recibo (103), que rejeita com o `reason` do sinal, vira o mesmo `cancelado`. Com o sinal disparado, a `causa` é sempre o `cancelado`, mesmo quando o envio já tinha esgotado o tempo e o abort chegou na consulta de recuperação.

Alternativas descartadas: lançar também depois de gravar deixaria o integrador sem saber se há bytes a retomar e trataria o abort de um jeito diferente da queda de conexão no mesmo ponto, que já é `pendente`; consultar a chave depois do abort contrariaria o pedido de parar. O abort do chamador não conta como falha do autorizador para a contingência automática (ADR 0013), e as consultas de status da contingência (`sondar` e `sondarSvc` do perfil) recebem o mesmo `signal`: nenhuma começa depois do abort, e a abortada no meio não vale como resposta (o perfil lê a falha da consulta como autorizador fora, o que poria o escopo em contingência por causa do chamador). Na montagem e na retomada, a sonda abortada lança o `cancelado`; depois do envio, ela só para; e na retomada automática a gravação abortada no meio, e as que ficaram, contam em `adiadas`, sem tentativa nem alerta.

Nos eventos (`cancelar`, `cartaCorrecao`, `encerrar`), a regra é a mesma, pelo pedido: abortado antes da chamada, ou na consulta que busca o `nProt`, lança o `cancelado`; abortado com o pedido do evento em curso, o desfecho é `pendente` com `motivo: 'sem-resposta'`, sem a consulta de recuperação, que a próxima chamada faz (o mesmo pedido de novo volta como evento já registrado, e o emissor o recupera pela consulta). `consultar` e `pdfPorChave` só leem: lançam o `cancelado`. O `TransmissaoStore` não recebe o sinal: as operações dele são locais e curtas, e interromper uma delas no meio deixaria a trava ou a gravação num estado que a interface não descreve.

### 9. `criarEmissor` e o perfil num subpath experimental (0.3.0)

`criarEmissor`, `PerfilDocumento`, `ContingenciaDoPerfil` e os tipos que só servem a quem implementa um perfil (`ContextoEmissor`, `ModoEnvio`, `ContingenciaAplicada`, `ContingenciaDosBytes`, `Sonda`, `SondaSvc`) saíram da raiz para `@sinete/emissor/perfil`, marcado como experimental pelo [ADR 0016](0016-politica-de-estabilidade.md): cada gancho novo do perfil muda esses tipos, e quem implementa um perfil próprio pode precisar mudar em minor. Os `criarEmissor<Doc>` dos subpaths de documento seguem estáveis; os `perfil<Doc>` deles devolvem o `PerfilDocumento` e são experimentais como ele.

## Consequências

- O ADR 0008 ganha o critério 5; pacote novo continua precisando citar o critério no PR.
- Os emissores curtos saíram dos pacotes de documento sem alias, com o `aoAssinar` trocado pelo `store` e o `EmissaoOutcome` pelo desfecho normalizado; o `DocumentoDivergenteError` saiu do `@sinete/core`.
- O contrato de testes do `TransmissaoStore` (`@sinete/emissor/contrato`) e a suíte de cada perfil contra o `@sinete/sefaz-sim` são pré-requisito para publicar o `@sinete/emissor`, e entraram com ele. Um adaptador de store errado produz nota duplicada; sem o contrato, o pacote não sai.
- A decisão 6 registra o que a migração do integrador em produção trouxe de volta ao emissor; o próximo integrador que precisar de um contorno segue o mesmo caminho enquanto o pacote estiver em 0.x.
- O integrador em produção migra depois de o deploy com a orquestração própria assentar, em partes que se testam sozinhas: primeiro as primitivas e o pool, depois o `TransmissaoStore` sobre o MySQL de teste, por último a política de envio e o `retomarPendentes`, com os testes de transmissão dele intactos. O que doer na migração volta como mudança no `@sinete/emissor` enquanto ele está em 0.x.

## Pendências

- Nenhuma. A classificação das ocorrências e o rótulo de caminho, que ficaram fora desta fronteira, foram decididos no [ADR 0011](0011-origem-e-rotulo-das-ocorrencias.md).
