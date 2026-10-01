# Referência: `@sinete/core`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/core/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/core/x` é `sinete/core/x`.

## `@sinete/core`

`@sinete/core`: a base de todos os pacotes do sinete.

Erros tipados, desfechos discriminados da SEFAZ, relógio injetável, logger estruturado, ambiente e tabela de UFs. Sem dependências e sem API de runtime: roda igual em Node, Bun, Deno e no browser.

### Funções

- `ambienteDoTpAmb`: `ambienteDoTpAmb(tpAmb: string): Ambiente`
- `autorizado`: `autorizado<T, D>(o: ResultadoSefaz<T, D>): o is Autorizado<T>`
- `contextoDeTempo`: `contextoDeTempo(clocks: { readonly emissao: Relogio; readonly fatoGerador?: Relogio; }): ContextoDeTempo`
- `criarAutorizado`: `criarAutorizado<T>(resposta: StatusSefaz, valor: T): Autorizado<T>`
- `criarDenegado`: `criarDenegado<D>(resposta: StatusSefaz, valor: D): Denegado<D>`
- `criarPendente`: `criarPendente(resposta: StatusSefaz, opcoes?: { referencia?: string; aguardarMs?: number; }): Pendente`
- `criarRecusado`: `criarRecusado(resposta: StatusSefaz, dica?: DicaRejeicao): Recusado`
- `criarRotuloDoCaminho`: Cria a função de rótulo de um documento: `Grupo, Campo` quando os dois são conhecidos (`Item 2, Descrição do produto`), só um deles quando falta o outro, e o `padrao` da tabela quando nenhum casa. `criarRotuloDoCaminho(tabela: TabelaDeRotulos): (caminho: string) => string`
- `denegado`: `denegado<T, D>(o: ResultadoSefaz<T, D>): o is Denegado<D>`
- `ehAmbiente`: `ehAmbiente(valor: unknown): valor is Ambiente`
- `ehCStat`: Confere o formato lexical do `cStat`: 3 ou 4 dígitos, como o `TStat` do XSD, ou `E` e 4 dígitos, o código de erro da NFS-e Nacional (Anexo I e Anexo II do leiaute, coluna "CÓD. ERRO"). `ehCStat(valor: unknown): valor is string`
- `ehCUf`: `ehCUf(valor: unknown): valor is CUf`
- `ehErroSinete`: Confere se `valor` é um `ErroSinete`, inclusive vindo de outra cópia do pacote. Com `code`, confere também o código. `ehErroSinete(valor: unknown, code?: string): valor is ErroSinete`
- `ehUf`: `ehUf(valor: unknown): valor is Uf`
- `exigirAutorizado`: Devolve o valor autorizado ou lança `ErroSefaz` com o código do desfecho e o `cStat` oficial. `exigirAutorizado<T, D>(o: ResultadoSefaz<T, D>): T`
- `falha`: `falha<E>(erro: E): { readonly ok: false; readonly erro: E; }`
- `formatarDataHoraComFuso`: Formata no padrão `TDateTimeUTC` dos leiautes (`AAAA-MM-DDThh:mm:ss±hh:mm`), no deslocamento pedido em minutos (`-180` para Brasília). O deslocamento vem do chamador, porque ele depende do local do emitente e não da máquina. `formatarDataHoraComFuso(data: Date, deslocamentoMin: number): string`
- `formatarVerProc`: Identificação do aplicativo emissor com a versão do pacote. `verProc` (NF-e, MDF-e) e `verAplic` (NFS-e) são o mesmo formato no leiaute: texto livre de 1 a 20 caracteres, sem espaço nas pontas (`TString`/`TSVerAplic`). `formatarVerProc(nome: string, versao: string): string`
- `loggerEmMemoria`: `loggerEmMemoria(): LoggerEmMemoria`
- `normalizarCaminho`: Leva o caminho à forma com pontos e índice a partir de zero. `normalizarCaminho(caminho: string): string`
- `ok`: `ok<T>(valor: T): { readonly ok: true; readonly valor: T; }`
- `paginaDoErro`: Página de um código de erro na documentação embarcada, relativa à pasta `docs/` do pacote `sinete` ou do `@sinete/emissor` (`node_modules/sinete/docs/erros/<code>.md`). O `bun run check` confere que todo código lançado pelos pacotes tem a página. `paginaDoErro(code: string): string`
- `pendente`: `pendente<T, D>(o: ResultadoSefaz<T, D>): o is Pendente`
- `recusado`: `recusado<T, D>(o: ResultadoSefaz<T, D>): o is Recusado`
- `relogioFixo`: Relógio parado num instante. Para testes e para reprocessar um documento com o horário original. `relogioFixo(instante: InstanteInformado): Relogio`
- `relogioManual`: `relogioManual(inicio: InstanteInformado): RelogioManual`
- `tpAmbDoAmbiente`: `tpAmbDoAmbiente(ambiente: Ambiente): TpAmb`
- `tratarResultado`: `tratarResultado<T, D, R>(o: ResultadoSefaz<T, D>, tratadores: TratadoresDeResultado<T, D, R>): R`
- `ufPorCUf`: Informações da UF pelo código IBGE (`'35'`), ou `undefined` se o código não existe. `ufPorCUf(cUF: string): UnidadeFederativa | undefined`
- `ufPorSigla`: Informações da UF pela sigla, ou `undefined` se a sigla não existe. `ufPorSigla(sigla: string): UnidadeFederativa | undefined`

### Classes

- `ErroDeConfiguracao` (estende `ErroSinete<'config_invalida'>`): Configuração inválida passada pelo chamador (opção ausente, valor fora do domínio, data inválida).
- `ErroDeTempoEsgotado` (estende `ErroSinete<'tempo_esgotado'>`): Uma operação passou do prazo configurado. Membros: `timeoutMs`.
- `ErroDeValidacao` (estende `ErroSinete<'validacao_falhou'>`): Dado recusado pela validação local, antes de chegar à SEFAZ. Traz todas as ocorrências, não só a primeira. Membros: `ocorrencias`, `toJSON()`.
- `ErroNaoSuportado` (estende `ErroSinete<'nao_suportado'>`): A runtime ou o ambiente não suporta o recurso pedido (ex.: o transporte do Deno para um host com renegociação).
- `ErroRespostaInvalida` (estende `ErroSinete<'resposta_invalida'>`): A resposta recebida não segue o leiaute esperado (XML malformado, grupo obrigatório ausente, cStat inválido).
- `ErroSefaz` (estende `ErroSinete<CodigoErroSefaz>`): Lançado por `exigirAutorizado` quando o desfecho não é autorização. Carrega `cStat` e `xMotivo` oficiais. Membros: `cStat`, `xMotivo`, `toJSON()`.
- `ErroServicoNaoOferecido` (estende `ErroSinete<'servico_nao_oferecido'>`): O autorizador não oferece o serviço pedido para a UF ou o ambiente, segundo a tabela oficial de web services (ex.: a Distribuição DF-e da NFC-e, um serviço que o autorizador pedido não tem naquele ambiente).
- `ErroSinete` (estende `string = string> extends Error`): Base de todos os erros do sinete. Membros: `code`, `detalhes`, `pagina`, `toJSON()`.

### Interfaces

- `AssinadorDeDados` (estende `SignerBase`): Membros: `tipo`, `assinar()`.
- `AssinadorDeDigest` (estende `SignerBase`): Membros: `tipo`, `assinarDigestInfo()`.
- `Autorizado` (estende `StatusSefaz`): Documento ou evento autorizado; `valor` traz o protocolo e o que mais o pacote do documento devolver. Membros: `tipo`, `valor`.
- `ContextoDaAssinatura`: O que acompanha o pedido de assinatura de um documento, para quem assina fora do processo conferir o que assina (o helper `sinete-signer`, por exemplo, confere o autor de um evento no elemento). Quem assina localmente ignora. Membros: `id`, `referenciado`.
- `ContextoDeTempo`: Os dois relógios de uma operação fiscal. Membros: `emissao`, `fatoGerador`.
- `Denegado` (estende `StatusSefaz`): Uso denegado (irregularidade do emitente ou do destinatário). Diferente da rejeição, a denegação é registrada na SEFAZ e o número fica consumido; `valor` traz o protocolo de denegação. Membros: `tipo`, `valor`.
- `DescricaoTabelaUfs`: Metadados da tabela: versão (data da revisão), formato e fontes. Membros: `versaoDoFormato`, `versao`, `fontes`.
- `DicaRejeicao`: Diagnóstico de uma rejeição, preenchido pelo `@sinete/rejeicoes` quando o `cStat` está no catálogo. Membros: `causaProvavel`, `comoCorrigir`, `fonte`, `orientacao`.
- `EntradaDeLog`: Membros: `nivel`, `mensagem`, `campos`.
- `ErroSerializado`: Forma do erro em `JSON.stringify`, para log estruturado. Membros: `name`, `code`, `message`, `pagina`, `detalhes`, `cause`.
- `ErroSineteOpcoes`: Membros: `cause`, `detalhes`.
- `FonteDeDados`: Membros: `titulo`, `url`, `coletadoEm`.
- `GrupoDeCaminho`: Um grupo de caminhos: o `padrao` casa com o começo do caminho normalizado, e `rotulo` recebe os índices capturados já somados de um (o primeiro item é o 1). Grupo que se repete sem índice no XSD (um item só) chega com o índice ausente: `rotulo` recebe `1`. Membros: `padrao`, `rotulo`.
- `Logger`: Membros: `debug()`, `info()`, `warn()`, `error()`, `child()`.
- `LoggerEmMemoria` (estende `Logger`): Logger que guarda as entradas em memória, para asserções em teste. Membros: `entradas`, `limpar()`.
- `Ocorrencia`: Uma ocorrência de validação local, com o caminho do campo (`infNFe.emit.CNPJ`, `[3].cUF`). Membros: `caminho`, `code`, `mensagem`, `origem`.
- `Pendente` (estende `StatusSefaz`): A SEFAZ recebeu e ainda não processou (lote em processamento, recibo a consultar). Membros: `tipo`, `referencia`, `aguardarMs`.
- `Recusado` (estende `StatusSefaz`): Recusado pela SEFAZ; o documento não existe para o fisco e pode ser corrigido e reenviado. Membros: `tipo`, `dica`.
- `Relogio`: Fonte de tempo. Cada chamada devolve uma instância nova de `Date`, que o chamador pode alterar sem efeito. Membros: `agora()`.
- `RelogioManual` (estende `Relogio`): Relógio de teste controlado à mão. Membros: `ajustar()`, `avancar()`.
- `StatusSefaz`: Status oficial devolvido pela SEFAZ. Membros: `cStat`, `xMotivo`.
- `TabelaDeRotulos`: Membros: `grupos`, `campos`, `padrao`.
- `TratadoresDeResultado`: Tratadores exaustivos: o compilador exige os quatro desfechos. Membros: `autorizado()`, `recusado()`, `denegado()`, `pendente()`.
- `UnidadeFederativa`: Membros: `sigla`, `cUF`, `nome`, `regiao`.

### Tipos

- `Ambiente`: Ambiente SEFAZ. No XML ele aparece como `tpAmb` (`1` produção, `2` homologação); na API do sinete ele é sempre nomeado, para que um `2` perdido não mande nota de teste para produção nem o contrário. `type Ambiente = 'producao' | 'homologacao'`
- `Assinador`: `type Assinador = AssinadorDeDados | AssinadorDeDigest`
- `CamposDeLog`: `type CamposDeLog = Readonly<Record<string, unknown>>`
- `CodigoErroCore`: Códigos lançados pelas classes do `@sinete/core`. Os outros pacotes declaram os próprios. `type CodigoErroCore = 'config_invalida' | 'validacao_falhou' | 'nao_suportado' | 'servico_nao_oferecido' | 'tempo_esgotado' | 'resposta_invalida' | CodigoErroSefaz`
- `CodigoErroSefaz`: Códigos do `ErroSefaz`, um por desfecho não autorizado. `type CodigoErroSefaz = 'sefaz_rejeitou' | 'sefaz_denegou' | 'sefaz_pendente'`
- `CUf`: Código IBGE da UF, na forma lexical do leiaute (tipo `TCodUfIBGE`). `type CUf = '11' | '12' | '13' | '14' | '15' | '16' | '17' | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28' | '29' | '31' | '32' | '33' | '35' | '41' | '42' | '43' | '50' | '51' | '52' | '53'`
- `DetalhesDoErro`: Detalhes estruturados do erro, serializáveis e sem segredo (nunca PIN, chave ou certificado). `type DetalhesDoErro = Readonly<Record<string, unknown>>`
- `HashDaAssinatura`: Hash aceito pelos leiautes de DF-e; SHA-256 fica para leiautes futuros e para o TLS. `type HashDaAssinatura = 'SHA-1' | 'SHA-256'`
- `InstanteInformado`: Instante aceito pelos relógios de teste: `Date`, epoch em milissegundos ou texto ISO 8601 com fuso. `type InstanteInformado = Date | number | string`
- `NivelDeLog`: Logger estruturado e injetável. `type NivelDeLog = 'debug' | 'info' | 'warn' | 'error'`
- `OrigemOcorrencia`: De onde vem uma ocorrência (ADR 0011): - `entrada`: conferência feita sobre a entrada do domínio (`DadosNfe`, `DadosMdfe`, `DadosDps`), antes de montar o documento. `type OrigemOcorrencia = 'entrada' | 'montagem'`
- `Regiao`: `type Regiao = 'N' | 'NE' | 'SE' | 'S' | 'CO'`
- `Resultado`: Resultado genérico para operações locais que podem falhar sem exceção (parse tolerante, validação). `type Resultado<T, E = Error> = { readonly ok: true; readonly valor: T; } | { readonly ok: false; readonly erro: E; }`
- `ResultadoSefaz`: Desfecho de uma chamada à SEFAZ. `D` é o tipo do valor na denegação, por padrão o mesmo da autorização. `type ResultadoSefaz<T, D = T> = Autorizado<T> | Recusado | Denegado<D> | Pendente`
- `TipoAssinador`: Contrato de quem assina. O core nunca vê a chave: entrega bytes e recebe bytes (ADR 0003). `type TipoAssinador = 'dados' | 'digest'`
- `TipoResultadoSefaz`: `type TipoResultadoSefaz = ResultadoSefaz<unknown>['tipo']`
- `TpAmb`: Valor lexical de `tpAmb` no leiaute (`TAmb`). `type TpAmb = '1' | '2'`
- `Uf`: Sigla de UF (tipo `TUf` do leiaute, sem `EX`). `type Uf = 'AC' | 'AL' | 'AM' | 'AP' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA' | 'MG' | 'MS' | 'MT' | 'PA' | 'PB' | 'PE' | 'PI' | 'PR' | 'RJ' | 'RN' | 'RO' | 'RR' | 'RS' | 'SC' | 'SE' | 'SP' | 'TO'`

### Constantes

- `AMBIENTES`: `AMBIENTES: readonly Ambiente[]`
- `loggerSilencioso`: Logger que descarta tudo. É o padrão quando o chamador não injeta um. `loggerSilencioso: Logger`
- `relogioDoSistema`: Relógio do sistema. Use só na borda da aplicação; bibliotecas recebem o `Relogio` de fora. `relogioDoSistema: Relogio`
- `TABELA_UFS`: `TABELA_UFS: DescricaoTabelaUfs`
- `UFS`: As 27 UFs, na ordem do código IBGE. `UFS: readonly UnidadeFederativa[]`

## `@sinete/core/xml`

`@sinete/core/xml`: parser XML estrito com offsets, C14N 1.0 inclusivo e XMLDSig no perfil dos DF-e.

Sem DOM e sem dependências de runtime; a criptografia é a WebCrypto de `globalThis.crypto`, então roda igual em Node, Bun, Deno e browser. A assinatura insere texto por splice e nunca reserializa o documento (ADR 0003).

### Funções

- `assinarPreparada`: Fase 2: pede a assinatura RSA PKCS#1 v1.5 com SHA-1 ao assinador, no modo dele. `assinarPreparada(preparada: AssinaturaPreparada, assinador: Assinador): Promise<Uint8Array>`
- `assinarXml`: As três fases de uma vez: prepara com o certificado do assinador, assina e monta. `assinarXml(xml: string, opcoes: { readonly id: string; }, assinador: Assinador): Promise<string>`
- `atributoDe`: Valor do atributo sem namespace com o nome local dado. `atributoDe(el: ElementoXml, local: string): string | undefined`
- `c14n`: C14N 1.0 inclusivo, sem comentários, do elemento `apex` e seus descendentes. `c14n(apex: ElementoXml, opcoes?: C14nOpcoes): string`
- `codificarBase64`: Codifica em base64 numa linha só, sem quebra (forma usada pela SEFAZ). `codificarBase64(u: Uint8Array): string`
- `conferirAssinatura`: Verifica a assinatura que referencia `expected.id`. Aceita a string XML ou um documento já parseado por `lerXml`. Nunca lança por causa do documento: toda falha volta como `ConferenciaInvalida` com categoria. `conferirAssinatura(xml: string | DocumentoXml, expected: AssinaturaEsperada): Promise<ResultadoConferencia>`
- `decodificarBase64`: Decodifica base64 ignorando whitespace (o `X509Certificate` e o `SignatureValue` costumam vir quebrados). `decodificarBase64(s: string): Uint8Array<ArrayBuffer>`
- `descendentes`: O elemento e todos os descendentes, em ordem de documento. `descendentes(el: ElementoXml): Generator<ElementoXml, void, undefined>`
- `digestInfoDoSignedInfo`: Monta o DigestInfo DER (prefixo SHA-1 + hash) do `SignedInfo`, entrada do modo `digest`. `digestInfoDoSignedInfo(preparada: AssinaturaPreparada): Promise<Uint8Array>`
- `elementosFilhos`: Filhos que são elementos, na ordem do documento. `elementosFilhos(el: ElementoXml): ElementoXml[]`
- `encontrarAssinaturas`: Todos os `Signature` do XMLDSig no documento, em ordem de documento. `encontrarAssinaturas(documento: DocumentoXml): ElementoXml[]`
- `escaparAtributoC14n`: Escape de valor de atributo do C14N: `&`, `<`, `"`, TAB, LF e CR. `escaparAtributoC14n(s: string): string`
- `escaparTextoC14n`: Escape de nó de texto do C14N: `&`, `<`, `>` e CR. `escaparTextoC14n(s: string): string`
- `extrairSpki`: Extrai o `SubjectPublicKeyInfo` (DER) de um certificado X.509 em DER (RFC 5280, 4.1). `extrairSpki(der: Uint8Array): Uint8Array<ArrayBuffer>`
- `lerXml`: Lê `texto` como XML 1.0 bem formado com namespaces. A string não é alterada e fica em `documento.texto`. Lança `ErroXml` (`xml_malformado`) com o offset do problema. `lerXml(texto: string): DocumentoXml`
- `montarAssinatura`: Fase 3: troca o marcador pelo `SignatureValue`. Nada mais no texto muda. `montarAssinatura(preparada: AssinaturaPreparada, valorDaAssinatura: Uint8Array): string`
- `namespacesEmEscopo`: Namespaces em escopo no elemento, incluindo os declarados nos ancestrais (o mais próximo vence). `namespacesEmEscopo(el: ElementoXml): Map<string, string>`
- `prepararAssinatura`: Fase 1: calcula o digest e insere o `<Signature>` com placeholder, sem tocar no resto do texto. `prepararAssinatura(xml: string, opcoes: PrepararAssinaturaOpcoes): Promise<AssinaturaPreparada>`
- `primeiroFilho`: Primeiro filho direto com o nome local (e o namespace, quando informado). `primeiroFilho(el: ElementoXml, local: string, ns?: string): ElementoXml | undefined`
- `textoDe`: Texto direto do elemento (só os nós de texto filhos, sem descer nos elementos). `textoDe(el: ElementoXml): string`

### Classes

- `ErroAssinaturaXml` (estende `ErroSinete<'xmldsig_falhou'>`): A assinatura não pôde ser montada (Id ausente ou duplicado, template corrompido, signer devolveu vazio). Membros: `motivo`.
- `ErroXml` (estende `ErroSinete<'xml_malformado'>`): O texto não é XML 1.0 bem formado com namespaces, ou usa algo que o parser recusa de propósito (DTD, entidade externa). `posicao` é a posição (em unidades UTF-16 da string) onde o problema foi detectado. Membros: `posicao`.

### Interfaces

- `AssinaturaEsperada`: Membros: `id`, `elemento`.
- `AssinaturaPreparada`: Membros: `modelo`, `marcador`, `inseridaEm`, `signedInfo`, `digestValue`, `referenciado`, `id`.
- `AtributoXml`: Membros: `nome`, `prefixo`, `local`, `ns`, `valor`.
- `C14nOpcoes`: Membros: `excluir`.
- `ConferenciaInvalida`: Membros: `ok`, `motivo`, `detalhe`, `signedInfoValido`.
- `ConferenciaValida`: Membros: `ok`, `id`, `elemento`, `documento`, `certificadoDer`, `algoritmoDeAssinatura`, `algoritmoDeDigest`.
- `DocumentoXml`: Membros: `texto`, `raiz`, `ids`.
- `ElementoXml`: Membros: `tipo`, `nome`, `prefixo`, `local`, `ns`, `atributos`, `namespaces`, `filhos`, `pai`, `inicio`, `fimDaAbertura`, `fimDoConteudo`, `fim`, `autoFechado`.
- `InstrucaoDeProcessamentoXml`: Instrução de processamento dentro do elemento raiz. Membros: `tipo`, `alvo`, `dados`, `inicio`, `fim`.
- `PrepararAssinaturaOpcoes`: Membros: `id`, `certificadoDer`.
- `TextoXml`: Texto (inclusive CDATA) já com fim de linha normalizado e referências resolvidas. Trechos vizinhos são unidos. Membros: `tipo`, `valor`, `inicio`, `fim`.

### Tipos

- `CodigoErroXml`: Códigos lançados por este pacote. `type CodigoErroXml = 'xml_malformado' | 'xmldsig_falhou'`
- `MotivoFalhaAssinaturaXml`: Motivo de uma falha ao preparar ou montar uma assinatura. `type MotivoFalhaAssinaturaXml = 'id-ausente' | 'id-duplicado' | 'referencia-na-raiz' | 'marcador-no-documento' | 'marcador-ausente' | 'assinatura-vazia'`
- `MotivoFalhaConferencia`: Categoria de uma verificação que falhou.
- `NoXml`: `type NoXml = ElementoXml | TextoXml | InstrucaoDeProcessamentoXml`
- `ResultadoConferencia`: `type ResultadoConferencia = ConferenciaValida | ConferenciaInvalida`

### Constantes

- `ALGORITMOS_XMLDSIG`: URIs de algoritmo usadas pelo perfil SEFAZ. `ALGORITMOS_XMLDSIG: { readonly c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'; readonly envelopedSignature: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'; readonly rsaSha1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'; r…`
- `PREFIXO_DIGEST_INFO_SHA1`: Prefixo DER do DigestInfo SHA-1 (RFC 8017, 9.2, nota 1). `PREFIXO_DIGEST_INFO_SHA1: Uint8Array`
- `XML_NS`: Namespace fixo do prefixo `xml` (Namespaces in XML 1.0, seção 3). `XML_NS = "http://www.w3.org/XML/1998/namespace"`
- `XMLDSIG_NS`: Namespace do XMLDSig. `XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#"`
- `XMLNS_NS`: Namespace reservado das declarações `xmlns`. `XMLNS_NS = "http://www.w3.org/2000/xmlns/"`
