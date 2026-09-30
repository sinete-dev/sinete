# Referência: `@sinete/emissor`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/emissor/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/emissor/x` é `sinete/emissor/x`.

## `@sinete/emissor`

`@sinete/emissor`: a camada que emite, retoma e cancela documentos com estado entre chamadas (ADR 0010).

A raiz tem o que é comum aos documentos e não importa nenhum pacote de documento: o desfecho normalizado, o `TransmissaoStore` (bytes assinados gravados antes do envio, trava entre processos), a política dos bytes, `criarEmissor` com o perfil de um documento, `retomarPendentes` para o job e o pool de emissores por certificado. Cada documento tem um subpath que importa o seu pacote: `@sinete/emissor/nfe` (`criarEmissorNfe`), `/mdfe` e `/nfse`. O adaptador em memória está em `@sinete/emissor/memoria` e a suíte de contrato do store em `@sinete/emissor/contrato`.

### Funções

- `abrirCertificado`: Abre o PFX (fora da validade, `ErroCertificado`) e devolve o certificado aberto. Os bytes não ficam guardados. `abrirCertificado(certificado: CertificadoA1, opcoes?: AbrirCertificadoOpcoes): Promise<CertificadoAberto>`
- `criarEmissor`: Abre o PFX (ou usa o certificado aberto) e devolve o emissor. Nada vai à rede até a primeira operação que precisa dela; o certificado fora da validade é recusado aqui (`ErroCertificado`). `criarEmissor<Entrada, Cliente, P, B>(perfil: PerfilDocumento<Entrada, Cliente, P, B>, opcoes: EmissorOpcoes<P, B>): Promise<Emissor<Entrada, Cliente, P, B>>`
- `criarPoolDeEmissores`: Cria o pool. `E` é qualquer emissor do pacote (ou qualquer coisa com `fechar`); `C`, o certificado que `criar` recebe (padrão: `CertificadoA1`). `criarPoolDeEmissores<E extends { fechar(): Promise<void>; }, C = CertificadoA1>(opcoes: PoolOpcoes<E, C>): PoolDeEmissores<E, C>`
- `destinoDosBytes`: Política dos bytes (ADR 0010, decisão 3): decidido (autorizado ou denegado) grava o documento e conclui; já guardado conclui; pendente e divergente mantêm; recusado descarta, menos quando o `cStat` está entre os indefinidos do documento (`indefinido`, da tabela de cada perfil), que mantêm. `destinoDosBytes(d: Desfecho, indefinido: (cStat: string) => boolean): DestinoDosBytes`
- `retomarPendentes`: Roda uma execução da retomada automática e devolve o resumo. `retomarPendentes(opcoes: RetomadaOpcoes): Promise<ResumoRetomada>`
- `semResposta`: O erro é de um envio que pode ter chegado (veja `SEM_RESPOSTA`). `semResposta(e: unknown): boolean`

### Classes

- `ErroRecusaRepetida` (estende `ErroSinete<'recusa_repetida'>`): A SEFAZ recusou de vez o mesmo conteúdo deste documento, com a mesma rejeição, o limite de vezes dentro da janela (`detalhes`: `cStat`, `xMotivo`, `recusadaEm`, `primeiraEm`, `vezes`, `limite`, `janelaMs`).
- `ErroTransmissaoEmAndamento` (estende `ErroSinete<'transmissao_em_andamento'>`): Outro processo (ou outra chamada) tem a trava deste documento em vigor: está transmitindo agora. Nada foi à SEFAZ. Tente de novo depois; se o outro processo morreu, a trava vence sozinha no prazo.
- `ErroTransmissaoJaGravada` (estende `ErroSinete<'transmissao_ja_gravada'>`): Já há bytes gravados para o documento: gravar outros por cima criaria um segundo documento para o mesmo número. Retome com os gravados.
- `ErroTravaPerdida` (estende `ErroSinete<'trava_perdida'>`): A trava venceu e pode ter sido assumida por outro processo: quem a perdeu não grava, não descarta e não guarda o desfecho. O outro processo retoma pelos bytes gravados.

### Interfaces

- `AbrirCertificadoOpcoes`: Membros: `relogio`, `completarCadeia`.
- `CertificadoA1`: Certificado A1 como arquivo e senha. Membros: `pfx`, `senha`.
- `CertificadoAberto`: Certificado já aberto: o signer dos documentos, o titular e a identidade do mTLS. Membros: `assinador`, `titular`, `identidade`.
- `ContextoEmissor`: O que o perfil recebe do emissor: certificado aberto, relógio e o transporte do certificado. Membros: `ambiente`, `relogio`, `assinador`, `titular`, `logger`, `timeoutMs`, `transporte()`.
- `ContingenciaAplicada`: O que entra na nota em contingência. Membros: `desde`, `xJust`.
- `ContingenciaDoPerfil`: O que o perfil de um documento com contingência automática oferece ao emissor. Hoje, só o da NF-e (55 e 65). `C` é o contexto do emissor; o módulo não depende dele. Membros: `escopo()`, `dosBytes()`, `aplicar()`, `offline()`, `sondar()`, `sondarSvc()`, `falha()`, `svcDesativada()`.
- `ContingenciaDosBytes`: O que os bytes assinados dizem da contingência (pela chave de acesso). Membros: `escopo`, `emContingencia`, `offline`.
- `ContingenciaOpcoes`: Opções da contingência automática. Desligada por padrão. Membros: `automatica`, `limiteFalhas`, `janelaMs`, `sondaMs`, `xJust`.
- `DesfechoAutorizado` (estende `DesfechoBase`): A SEFAZ autorizou estes bytes. `proc` é o documento com o protocolo, com os bytes gravados dentro. Membros: `tipo`, `cStat`, `xMotivo`, `proc`, `protocolo`, `situacaoAtual`, `bruto`.
- `DesfechoDenegado` (estende `DesfechoBase`): Uso denegado (só NF-e): o número fica consumido e o documento existe na SEFAZ. Membros: `tipo`, `cStat`, `xMotivo`, `conteudo`, `proc`, `protocolo`, `xml`, `bruto`.
- `DesfechoDivergente` (estende `DesfechoBase`): A SEFAZ tem outro documento no número destes bytes: a mesma chave com outro conteúdo (o `digVal` não confere) ou outra chave (539, E0014). Membros: `tipo`, `chaveRegistrada`, `conteudo`, `cStat`, `xMotivo`, `situacaoAtual`, `proc`, `bruto`.
- `DesfechoJaGuardado` (estende `DesfechoBase`): O integrador já guardou o documento destes bytes (o gancho `jaGuardado` respondeu sim): a transmissão caiu entre guardar e apagar a gravação. A gravação foi apagada sem ir à SEFAZ. Membros: `tipo`.
- `DesfechoPendente` (estende `DesfechoBase`): Ninguém sabe ainda o que a SEFAZ fez com estes bytes. Eles ficam gravados; `retomar` continua depois. Membros: `tipo`, `motivo`, `cStat`, `xMotivo`, `nRec`, `causa`, `anterior`, `bruto`.
- `DesfechoRecusado` (estende `DesfechoBase`): A SEFAZ recusou estes bytes. Se o `cStat` está entre os indefinidos do documento (a duplicidade que a consulta não resolveu, por exemplo), os bytes ficam gravados; nos outros, são descartados (`destinoDosBytes`). Membros: `tipo`, `cStat`, `xMotivo`, `dica`, `bruto`.
- `DocumentoAssinado`: Documento montado e assinado. `id` é a chave de acesso, ou o Id da DPS na NFS-e. Membros: `id`, `xml`.
- `Emissor`: Membros: `tipo`, `titular`, `emitir()`, `assinar()`, `retomar()`, `cliente`, `fechar()`.
- `EmissorOpcoes` (estende `GuardaOpcoes<P, B>`): Membros: `pfx`, `senha`, `certificado`, `ambiente`, `store`, `trava`, `situacaoPosterior`, `recusaRepetida`, `contingencia`, `aoMudarContingencia`, `relogio`, `logger`, `timeoutMs`, `transporte`.
- `EmissorRetomavel`: O que a retomada precisa de um emissor: só `retomar`, que não monta. Qualquer emissor do pacote serve. Membros: `retomar()`.
- `EmitirOpcoes` (estende `GuardaOpcoes<P, B>`): Membros: `meta`, `reenviarRecusado`.
- `EntradaPreparada`: O que `preparar` devolve: a entrada e os dados do integrador gravados com os bytes (vale sobre `EmitirOpcoes.meta`). Membros: `entrada`, `meta`.
- `EscopoContingencia`: O autorizador normal de um documento, modelo e UF: cada um entra e sai da contingência sozinho. Membros: `documento`, `modelo`, `uf`.
- `EstadoContingencia`: Contingência de um autorizador (ADR 0013), pelo relógio do banco: desde quando, por quê e a última consulta de status (a sonda que decide a volta). Membros: `desde`, `motivo`, `sondadaEm`, `fimDaSvc`.
- `FiltroPendentes`: Seleção da retomada automática. Durações, medidas pelo relógio do banco. Membros: `idadeMaximaMs`, `paradaHaMs`, `intervaloDepoisDoAlertaMs`, `limite`.
- `GravacaoTransmissao`: O que o emissor grava. Membros: `xml`, `id`, `meta`.
- `GuardaOpcoes`: Como o integrador guarda o documento: no emissor (padrão de todas as chamadas) ou em cada chamada. Membros: `aoDecidir`, `jaGuardado`.
- `PerfilDocumento`: O que muda de um documento para outro. `enviar` nunca monta: recebe os bytes gravados, espera o recibo quando houver, resolve a duplicidade e o envio sem resposta pela consulta, e devolve o desfecho normalizado. Só lança o que não é da SEFAZ nem da rede (configuração, política do transporte, bug). Membros: `tipo`, `indefinido()`, `transitorio()`, `conteudoParaRecusa()`, `recusaPorCampoVolatil()`, `contingencia`, `criarCliente()`, `assinar()`, `enviar()`.
- `PoliticaRetomada`: Membros: `idadeMaximaMs`, `paradaHaMs`, `lote`, `prazoMs`, `alertarDepoisDe`, `intervaloDepoisDoAlertaMs`.
- `PoolDeEmissores`: Membros: `usar()`, `fechar()`.
- `PoolOpcoes`: Membros: `criar`, `chave`, `validadeMs`, `maximo`, `relogio`.
- `Recusa`: O que o emissor lembra de uma recusa definitiva: o resumo dos bytes recusados e o que a SEFAZ respondeu. Membros: `digest`, `cStat`, `xMotivo`.
- `RecusaRegistrada` (estende `Recusa`): Recusa lembrada, pelo relógio do banco: a última da sequência (`recusadaEm`) e quantas vezes a mesma recusa (mesmo `digest` e mesmo `cStat`) voltou desde a primeira dela (`primeiraEm`). Membros: `recusadaEm`, `vezes`, `primeiraEm`.
- `RecusaRepetidaOpcoes`: Barreira contra reenviar a mesma nota recusada. Membros: `janelaMs`, `limite`.
- `RegistroTransmissao`: Bytes gravados de um documento, com a contagem da retomada automática. Membros: `tipo`, `ref`, `xml`, `id`, `gravacao`, `assinadoEm`, `meta`, `tentativas`, `ultimaTentativaEm`, `alertadoEm`.
- `ResumoRetomada`: Membros: `candidatas`, `desfechos`, `alertas`, `adiadas`.
- `RetomadaOpcoes`: Membros: `store`, `usarEmissor`, `politica`, `deveRetomar`, `aoAlertar`, `aoDecidir`, `jaGuardado`, `relogio`.
- `RetomarOpcoes` (estende `GuardaOpcoes<P, B>`): Opções de `retomar`. Membros: `gravacao`.
- `Sonda`: Resultado da consulta de status do autorizador normal: 107 é em operação; 108, 109 ou sem resposta, fora. Membros: `emOperacao`, `detalhe`.
- `TransmissaoStore`: Membros: `travar()`, `renovar()`, `soltar()`, `ler()`, `gravar()`, `descartar()`, `concluir()`, `listarPendentes()`, `registrarTentativa()`, `registrarRecusa()`, `recusaRecente()`, `registrarFalhaDoAutorizador()`, `contingenciaAtiva()`, `entrarEmContingencia()`, `sairDaContingencia()`, `reservarSonda()`, `marcarFimDaSvc()`.
- `Trava`: Trava de um documento. `token` identifica o dono: renovar, soltar, descartar e concluir só valem com ele. Membros: `tipo`, `ref`, `token`.
- `TravaOpcoes`: Membros: `prazoMs`, `renovarACadaMs`.

### Tipos

- `AoDecidir`: Guarda o documento decidido (autorizado ou denegado) no sistema do integrador. `type AoDecidir<P = unknown, B = unknown> = (registro: RegistroTransmissao, desfecho: DesfechoDecidido<P, B>, trava: Trava) => void | Promise<void>`
- `CodigoErroEmissor`: Códigos lançados pelas classes do `@sinete/emissor` (`contrato_violado` é da suíte de `@sinete/emissor/contrato`). `type CodigoErroEmissor = 'transmissao_em_andamento' | 'trava_perdida' | 'transmissao_ja_gravada' | 'recusa_repetida' | 'contrato_violado'`
- `ConteudoRegistrado`: O que o `digVal` do protocolo diz dos bytes gravados. `confere`: é o DigestValue deles. `sem-digval`: o protocolo não o traz (é opcional no leiaute, e há autorizador que o omite). `difere`: a SEFAZ registrou outro conteúdo com a mesma chave. `type ConteudoRegistrado = 'confere' | 'sem-digval' | 'difere'`
- `ContingenciaStore`: Os seis métodos da contingência do store. `type ContingenciaStore = Required<Pick<TransmissaoStore, 'registrarFalhaDoAutorizador' | 'contingenciaAtiva' | 'entrarEmContingencia' | 'sairDaContingencia' | 'reservarSonda' | 'marcarFimDaSvc'>>`
- `Desfecho`: Desfecho de `emitir` e `retomar`. `P` é o protocolo do documento; `B`, o desfecho bruto do pacote do documento. `type Desfecho<P = unknown, B = unknown> = DesfechoAutorizado<P, B> | DesfechoDenegado<P, B> | DesfechoRecusado<B> | DesfechoPendente<B> | DesfechoDivergente<B> | DesfechoJaGuardado`
- `DesfechoDecidido`: Desfecho que decide o documento: ele existe na SEFAZ e o integrador o guarda (`aoDecidir`). `type DesfechoDecidido<P = unknown, B = unknown> = DesfechoAutorizado<P, B> | DesfechoDenegado<P, B>`
- `DesfechoEvento`: Desfecho de um evento pelo emissor (`cancelar`). `recuperado: true` quando o evento veio da consulta, depois de um pedido sem resposta ou recusado por duplicidade: a SEFAZ já o tinha registrado.
- `DesfechoRetomada`: Como terminou cada gravação selecionada.
- `DestinoDosBytes`: O que fazer com os bytes gravados depois de um desfecho. `type DestinoDosBytes = 'concluir' | 'manter' | 'descartar'`
- `Instante`: Instante no tempo, como os relógios do `@sinete/core` o devolvem (o tipo `Date`, sem tocar no global). `type Instante = ReturnType<Relogio['agora']>`
- `JaGuardado`: O integrador já guardou o documento destes bytes? Consultado com a trava, quando há bytes gravados, antes de ir à SEFAZ. `type JaGuardado = (registro: RegistroTransmissao) => boolean | Promise<boolean>`
- `ModoEnvio`: `primeiro`: os bytes acabaram de ser gravados e nunca saíram. `retomada`: podem ter chegado à SEFAZ. `type ModoEnvio = 'primeiro' | 'retomada'`
- `MotivoPendencia`: Por que os bytes ficaram pendentes: `type MotivoPendencia = 'sem-resposta' | 'consulta-indefinida' | 'lote-em-processamento' | 'contingencia'`
- `MudancaContingencia`: Aviso ao integrador: o escopo entrou em contingência, saiu dela, ou o autorizador normal está fora e a SVC não está ativada para a UF (`svc-indisponivel`: as notas seguem em emissão normal e ficam pendentes; repete a cada consulta da SVC, uma por `sondaMs`).
- `PrepararEntrada`: Prepara a entrada só quando for montar: chamada com a trava, e só sem bytes gravados. Serve para conferir que o documento ainda pode ser emitido e para ler do banco o que vai na montagem, sem esse trabalho (ou essa recusa) numa retomada, que ignora a entrada. `type PrepararEntrada<Entrada> = () => Promise<EntradaPreparada<Entrada>>`
- `SituacaoPosterior`: Situação do documento autorizado que mudou fora deste fluxo. `encerrado` só existe no MDF-e. `type SituacaoPosterior = 'cancelado' | 'encerrado'`
- `SondaSvc`: Situação da SVC da UF pela consulta de status nela (NT 2013.007 v1.03, item 04.7, regras K05.1 a K05.3): `ativa` (107), `desativando` (113, com o instante em que deixa de atender a UF, `undefined` se o `xMotivo` não o diz), `desativada` (114) ou `indisponivel` (sem resposta ou outro código).
- `TipoDocumento`: Documentos que o emissor conhece. Cada um tem um subpath: `@sinete/emissor/nfe`, `/mdfe`, `/nfse`. `type TipoDocumento = 'nfe' | 'mdfe' | 'nfse'`

### Constantes

- `POLITICA_RETOMADA_PADRAO`: `POLITICA_RETOMADA_PADRAO: PoliticaRetomada`

## `@sinete/emissor/nfe`

`@sinete/emissor/nfe`: o emissor de NF-e (`criarEmissorNfe`) e o perfil da NF-e (`perfilNfe`).

Importa o `@sinete/nfe` (peer dependency) de forma estática; a raiz do `@sinete/emissor` não o importa.

O envio espera o recibo quando a SEFAZ responde 103 (mesmo no envio síncrono), no envio e no reenvio; trata o envio sem resposta (timeout, conexão caída, resposta fora do leiaute, abort depois de o pedido sair) e a duplicidade (204, 539) pela consulta da chave com os mesmos bytes; reenvia os mesmos bytes uma vez quando a nota não consta (217); vai sempre ao autorizador do documento e da chave (cUF e, em SVC, o tpEmis), então um emissor atende todas as UFs do certificado.

### Funções

- `criarEmissorNfe`: Abre o PFX e devolve o emissor de NF-e. Nada vai à rede até a primeira operação que precisa dela; o certificado fora da validade é recusado aqui (`ErroCertificado`). `criarEmissorNfe(opcoes: EmissorNfeOpcoes): Promise<EmissorNfe>`
- `perfilNfe`: Perfil da NF-e para o `criarEmissor` da raiz. `perfilNfe(opcoes?: PerfilNfeOpcoes): PerfilDocumento<EntradaNfe, ClienteNfe, ProtocoloNfe, BrutoNfe>`

### Interfaces

- `CancelamentoNfeEmissor`: Pedido de cancelamento do emissor. Sem `nProt`, o emissor o tira da consulta da chave. Membros: `chave`, `xJust`, `nProt`, `autor`.
- `EmissorNfe` (estende `Emissor<EntradaNfe, ClienteNfe, ProtocoloNfe, BrutoNfe>`): Membros: `consultar()`, `cancelar()`, `cartaCorrecao()`, `pdf()`, `pdfCancelado()`.
- `EmissorNfeOpcoes` (estende `EmissorOpcoes<ProtocoloNfe, BrutoNfe>, PerfilNfeOpcoes`): Membros: `da`.
- `ModuloDanfe`: O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/nfe` serve como está. Membros: `danfe()`, `gerarPdf()`.
- `NotaComMontagem`: A nota com opções de montagem só dela, por cima das do emissor: a data de emissão que o sistema do integrador já fixou, o pagamento igual ao total, uma exigência relaxada para este emitente. Membros: `nfe`, `montagem`.
- `PdfNfeOpcoes`: Opções do `pdf` da NF-e: as do `danfe` do `@sinete/da/nfe`. Membros: `logo`, `formato`, `largura`, `canhoto`, `ibsCbs`, `colunasSt`, `epec`, `fonteItens`, `via`, `qrLateral`, `cancelamento`.
- `PerfilNfeOpcoes`: Membros: `uf`, `recibo`, `montagem`, `cliente`.
- `ProtocoloDoEvento`: Protocolo e data de registro de um evento (o EPEC do DANFE, o cancelamento do DAMDFE). Membros: `nProt`, `dhRegEvento`.

### Tipos

- `BrutoNfe`: De onde sai o desfecho da NF-e: a autorização (ou o recibo) ou a consulta da chave. `type BrutoNfe = ResultadoAutorizacao | ResultadoConsulta`
- `DesfechoCancelamentoNfe`: Desfecho do `cancelar` da NF-e: o evento, ou a consulta que o recuperou. `type DesfechoCancelamentoNfe = DesfechoEvento<EventoRegistrado, ResultadoEvento | ResultadoConsulta>`
- `DesfechoCartaCorrecaoNfe`: Desfecho da `cartaCorrecao` da NF-e: o evento, ou a consulta que o recuperou. `type DesfechoCartaCorrecaoNfe = DesfechoEvento<EventoRegistrado, ResultadoEvento | ResultadoConsulta>`
- `DesfechoNfe`: Desfecho de `emitir` e `retomar` da NF-e. `type DesfechoNfe = Desfecho<ProtocoloNfe, BrutoNfe>`
- `EntradaNfe`: A entrada do emissor de NF-e: a nota, ou a nota com a montagem dela. `type EntradaNfe = DadosNfe | NotaComMontagem`
- `FormatoPdfNfe`: Formato do DANFE; sem ele, sai do XML (modelo 65 é `nfce`; no 55, o `tpImp`). `type FormatoPdfNfe = 'retrato' | 'paisagem' | 'simplificado' | 'etiqueta' | 'simplificado-tipo2' | 'nfce'`
- `MontagemNfe`: Opções da montagem além do ambiente (relógio da emissão, IBS/CBS, arredondamento, responsável técnico). `type MontagemNfe = Omit<Partial<MontarNfeOpcoes>, 'ambiente'>`

## `@sinete/emissor/mdfe`

`@sinete/emissor/mdfe`: o emissor de MDF-e (`criarEmissorMdfe`) e o perfil do MDF-e (`perfilMdfe`).

Importa o `@sinete/mdfe` (peer dependency) de forma estática; a raiz do `@sinete/emissor` não o importa.

Mesma política da NF-e, com as diferenças do protocolo: a recepção é síncrona (sem recibo), não há denegação, e a consulta pode achar o MDF-e já cancelado ou encerrado fora deste fluxo (`situacaoAtual`). O autorizador é único (SVRS), e o `ClienteMdfe` confere o `tpAmb` do MDF-e antes do envio, porque ele vai comprimido onde a política do transporte não enxerga.

### Funções

- `criarEmissorMdfe`: Abre o PFX e devolve o emissor de MDF-e. Nada vai à rede até a primeira operação que precisa dela; o certificado fora da validade é recusado aqui (`ErroCertificado`). `criarEmissorMdfe(opcoes: EmissorMdfeOpcoes): Promise<EmissorMdfe>`
- `perfilMdfe`: Perfil do MDF-e para o `criarEmissor` da raiz. `perfilMdfe(opcoes?: PerfilMdfeOpcoes): PerfilDocumento<EntradaMdfe, ClienteMdfe, ProtocoloMdfe, BrutoMdfe>`

### Interfaces

- `CancelamentoMdfeEmissor`: Pedido de cancelamento do emissor. Sem `nProt`, o emissor o tira da consulta da chave. Membros: `chave`, `xJust`, `nProt`.
- `EmissorMdfe` (estende `Emissor<EntradaMdfe, ClienteMdfe, ProtocoloMdfe, BrutoMdfe>`): Membros: `consultar()`, `cancelar()`, `encerrar()`, `pdf()`, `pdfCancelado()`.
- `EmissorMdfeOpcoes` (estende `EmissorOpcoes<ProtocoloMdfe, BrutoMdfe>, PerfilMdfeOpcoes`): Membros: `da`.
- `ManifestoComMontagem`: O manifesto com opções de montagem só dele (a data de emissão que o integrador fixou), por cima das do emissor. Membros: `mdfe`, `montagem`.
- `ModuloDamdfe`: O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/mdfe` serve como está. Membros: `damdfe()`, `gerarPdf()`.
- `PdfMdfeOpcoes`: Opções do `pdf` do MDF-e: as do `damdfe` do `@sinete/da/mdfe`. Membros: `logo`, `documentos`, `cancelado`.
- `PerfilMdfeOpcoes`: Membros: `montagem`, `cliente`.
- `ProtocoloDoEvento`: Protocolo e data de registro de um evento (o EPEC do DANFE, o cancelamento do DAMDFE). Membros: `nProt`, `dhRegEvento`.

### Tipos

- `BrutoMdfe`: De onde sai o desfecho do MDF-e: a autorização ou a consulta da chave. `type BrutoMdfe = ResultadoAutorizacao | ResultadoConsulta`
- `DesfechoCancelamentoMdfe`: Desfecho do `cancelar` do MDF-e: o evento, ou a consulta que o recuperou. `type DesfechoCancelamentoMdfe = DesfechoEvento<EventoRegistrado, ResultadoEvento | ResultadoConsulta>`
- `DesfechoEncerramentoMdfe`: Desfecho do `encerrar` do MDF-e: o evento, ou a consulta que o recuperou. `type DesfechoEncerramentoMdfe = DesfechoEvento<EventoRegistrado, ResultadoEvento | ResultadoConsulta>`
- `DesfechoMdfe`: Desfecho de `emitir` e `retomar` do MDF-e. Nunca `denegado`. `type DesfechoMdfe = Desfecho<ProtocoloMdfe, BrutoMdfe>`
- `EntradaMdfe`: A entrada do emissor de MDF-e: o manifesto, ou o manifesto com a montagem dele. `type EntradaMdfe = DadosMdfe | ManifestoComMontagem`
- `MontagemMdfe`: Opções da montagem além do ambiente (relógio da emissão, contingência off-line, responsável técnico). `type MontagemMdfe = Omit<Partial<MontarMdfeOpcoes>, 'ambiente'>`

## `@sinete/emissor/nfse`

`@sinete/emissor/nfse`: o emissor da NFS-e Nacional (`criarEmissorNfse`) e o perfil da NFS-e (`perfilNfse`).

Importa o `@sinete/nfse` (peer dependency) de forma estática; a raiz do `@sinete/emissor` não o importa.

Diferenças que vêm do protocolo: a chave da NFS-e só existe depois da geração, então o `id` dos bytes gravados é o Id da DPS; a Sefin não tem pendência de lote nem denegação (o desfecho é gerada, recusada, pendente por falta de resposta ou divergente); a duplicidade é a E0014, conferida pela consulta da DPS. O PDF é o DANFSe v2 gerado aqui pelo `@sinete/da/nfse` (NT SE/CGNFS-e 008/2026), porque a API de geração do ADN foi suspensa em 03/08/2026. A substituição é uma DPS com o grupo `substituicao`, enviada pelo mesmo caminho: a Sefin gera a nova NFS-e e registra sozinha o cancelamento por substituição da anterior.

### Funções

- `criarEmissorNfse`: Abre o PFX e devolve o emissor da NFS-e. Nada vai à rede até a primeira operação que precisa dela; o certificado fora da validade é recusado aqui (`ErroCertificado`). `criarEmissorNfse(opcoes: EmissorNfseOpcoes): Promise<EmissorNfse>`
- `perfilNfse`: Perfil da NFS-e para o `criarEmissor` da raiz. `perfilNfse(opcoes?: PerfilNfseOpcoes): PerfilDocumento<DadosDps, ClienteNfse, NfseGerada, BrutoNfse>`

### Interfaces

- `EmissorNfse` (estende `Emissor<DadosDps, ClienteNfse, NfseGerada, BrutoNfse>`): Membros: `substituir()`, `consultar()`, `cancelar()`, `pdf()`, `pdfCancelado()`, `pdfPorChave()`.
- `EmissorNfseOpcoes` (estende `EmissorOpcoes<NfseGerada, BrutoNfse>, PerfilNfseOpcoes`): Membros: `da`.
- `ModuloDanfse`: O que o emissor precisa do `@sinete/da`: o módulo `@sinete/da/nfse` serve como está. Membros: `danfse()`, `gerarPdf()`.
- `PdfNfseOpcoes`: Opções do `pdf` da NFS-e: as do `danfse` do `@sinete/da/nfse`. Membros: `cancelamento`, `substituicao`, `canhoto`, `nomeMunicipio`.
- `PerfilNfseOpcoes`: Membros: `montagem`, `cliente`.

### Tipos

- `BrutoNfse`: De onde sai o desfecho da NFS-e: a emissão ou a NFS-e da consulta da DPS. `type BrutoNfse = ResultadoNfse<NfseGerada> | NfseConsultada`
- `CancelamentoNfseEmissor`: Pedido de cancelamento do emissor: o autor, se faltar, é o titular do certificado. `type CancelamentoNfseEmissor = Omit<CancelamentoPedido, 'autor'> & { readonly autor?: InscricaoFederal; }`
- `DesfechoCancelamentoNfse`: Desfecho do `cancelar` da NFS-e. `type DesfechoCancelamentoNfse = DesfechoEvento<EventoRegistrado, ResultadoNfse<EventoRegistrado> | undefined>`
- `DesfechoNfse`: Desfecho de `emitir` e `retomar` da NFS-e. `id` é o Id da DPS; a chave da NFS-e está em `protocolo.chaveAcesso`. `type DesfechoNfse = Desfecho<NfseGerada, BrutoNfse>`
- `MarcaDanfseAutomatica`: Opções do DANFSe quando o emissor põe a marca: a marca sai do evento, não das opções. `type MarcaDanfseAutomatica = Omit<PdfNfseOpcoes, 'cancelamento' | 'substituicao'>`

## `@sinete/emissor/memoria`

`@sinete/emissor/memoria`: `TransmissaoStore` em memória, o adaptador de referência.

**Só para testes e scripts de um processo.** Os bytes gravados vivem na memória do processo: se ele cair depois de a SEFAZ autorizar e antes da resposta chegar, a gravação some junto, e a próxima emissão monta outro documento para o mesmo número. Em produção, implemente o `TransmissaoStore` sobre o banco da aplicação (a trava com prazo na própria linha, comparada com o relógio do banco) e rode a suíte de `@sinete/emissor/contrato` contra ele.

Dois stores criados sobre o mesmo `BancoMemoria` se comportam como dois processos sobre o mesmo banco: é assim que a suíte de contrato e os testes simulam o outro processo e o reinício. O relógio do "banco" é o `relogio` recebido.

### Funções

- `criarBancoMemoria`: Banco vazio. `criarBancoMemoria(): BancoMemoria`
- `criarMemoriaStore`: Cria o store em memória (veja o aviso do módulo: só testes e scripts de um processo). `criarMemoriaStore(opcoes?: MemoriaOpcoes): TransmissaoStore`

### Interfaces

- `BancoMemoria`: O "banco" em memória. Compartilhe entre stores para simular processos sobre o mesmo banco. Membros: `linhas`, `recusas`, `contingencia`, `sequencia`.
- `MemoriaOpcoes`: Membros: `relogio`, `banco`.

## `@sinete/emissor/contrato`

`@sinete/emissor/contrato`: suíte de contrato do `TransmissaoStore`, para quem implementa o adaptador sobre o próprio banco. Um adaptador errado produz nota duplicada (duas travas ao mesmo tempo, bytes que somem num reinício, o dono antigo gravando por cima de quem assumiu); a suíte confere cada um desses casos.

Não depende de runner de teste: devolve casos com `nome` e `rodar`, que lançam `ErroContratoViolado` quando o adaptador falha. No Bun, no Vitest ou no `node:test`:

```ts for (const caso of casosDoContrato({ criar: async () => ({ a: meuStore(db), b: meuStore(db) }) })) { test(caso.nome, caso.rodar, 30_000); } ```

`criar` é chamado uma vez por caso e precisa devolver dois stores sobre o mesmo banco **vazio** (dois processos). Os casos que esperam uma trava vencer usam o relógio de verdade (`esperar`); com o banco medindo o prazo pelo próprio relógio, como deve ser, não há como adiantá-lo. `prazoCurtoMs` é o prazo dessas travas: o padrão (1 s) serve ao MySQL e ao Postgres com `NOW(6)`/`now()`; a suíte inteira leva uns 20 prazos curtos.

### Funções

- `casosDoContrato`: Casos do contrato, na ordem do mais básico ao mais sutil. `casosDoContrato(opcoes: ContratoOpcoes): readonly CasoContrato[]`

### Classes

- `ErroContratoViolado` (estende `ErroSinete<'contrato_violado'>`): O adaptador não cumpriu um item do contrato. `detalhes.caso` diz qual.

### Interfaces

- `AmbienteContrato`: Dois processos sobre o mesmo banco, vazio. Membros: `a`, `b`, `fechar`.
- `CasoContrato`: Membros: `nome`, `rodar()`.
- `ContratoOpcoes`: Membros: `criar`, `prazoCurtoMs`, `esperar`, `recusas`, `contingencia`.
