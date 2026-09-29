# Referência: `@sinete/core`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/core/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/core/x` é `sinete/core/x`.

## `@sinete/core`

`@sinete/core`: a base de todos os pacotes do sinete.

Erros tipados, desfechos discriminados da SEFAZ, relógio injetável, logger estruturado, ambiente e tabela de UFs. Sem dependências e sem API de runtime: roda igual em Node, Bun, Deno e no browser.

### Funções

- `ambienteOfTpAmb`: `ambienteOfTpAmb(tpAmb: string): Ambiente`
- `authorized`: `authorized<T>(status: SefazStatus, value: T): Authorized<T>`
- `criarRotuloDoCaminho`: Cria a função de rótulo de um documento: `Grupo, Campo` quando os dois são conhecidos (`Item 2, Descrição do produto`), só um deles quando falta o outro, e o `padrao` da tabela quando nenhum casa. `criarRotuloDoCaminho(tabela: TabelaDeRotulos): (path: string) => string`
- `denied`: `denied<D>(status: SefazStatus, value: D): Denied<D>`
- `err`: `err<E>(error: E): { readonly ok: false; readonly error: E; }`
- `fixedClock`: Relógio parado num instante. Para testes e para reprocessar um documento com o horário original. `fixedClock(at: Instant): Clock`
- `formatarVerProc`: Identificação do aplicativo emissor com a versão do pacote. `verProc` (NF-e, MDF-e) e `verAplic` (NFS-e) são o mesmo formato no leiaute: texto livre de 1 a 20 caracteres, sem espaço nas pontas (`TString`/`TSVerAplic`). `formatarVerProc(nome: string, versao: string): string`
- `formatDateTimeOffset`: Formata no padrão `TDateTimeUTC` dos leiautes (`AAAA-MM-DDThh:mm:ss±hh:mm`), no deslocamento pedido em minutos (`-180` para Brasília). O deslocamento vem do chamador, porque ele depende do local do emitente e não da máquina. `formatDateTimeOffset(date: Date, offsetMinutes: number): string`
- `isAmbiente`: `isAmbiente(value: unknown): value is Ambiente`
- `isAuthorized`: `isAuthorized<T, D>(o: SefazOutcome<T, D>): o is Authorized<T>`
- `isCStat`: Confere o formato lexical do `cStat`: 3 ou 4 dígitos, como o `TStat` do XSD, ou `E` e 4 dígitos, o código de erro da NFS-e Nacional (Anexo I e Anexo II do leiaute, coluna "CÓD. ERRO"). `isCStat(value: unknown): value is string`
- `isCUf`: `isCUf(value: unknown): value is CUf`
- `isDenied`: `isDenied<T, D>(o: SefazOutcome<T, D>): o is Denied<D>`
- `isPending`: `isPending<T, D>(o: SefazOutcome<T, D>): o is Pending`
- `isRejected`: `isRejected<T, D>(o: SefazOutcome<T, D>): o is Rejected`
- `isSineteError`: Confere se `value` é um `SineteError`, inclusive vindo de outra cópia do pacote. Com `code`, confere também o código. `isSineteError(value: unknown, code?: string): value is SineteError`
- `isUf`: `isUf(value: unknown): value is Uf`
- `manualClock`: `manualClock(start: Instant): ManualClock`
- `matchOutcome`: `matchOutcome<T, D, R>(o: SefazOutcome<T, D>, handlers: OutcomeHandlers<T, D, R>): R`
- `memoryLogger`: `memoryLogger(): MemoryLogger`
- `normalizarCaminho`: Leva o caminho à forma com pontos e índice a partir de zero. `normalizarCaminho(path: string): string`
- `ok`: `ok<T>(value: T): { readonly ok: true; readonly value: T; }`
- `paginaDoErro`: Página de um código de erro na documentação embarcada, relativa à pasta `docs/` do pacote `sinete` ou do `@sinete/emissor` (`node_modules/sinete/docs/erros/<code>.md`). O `bun run check` confere que todo código lançado pelos pacotes tem a página. `paginaDoErro(code: string): string`
- `pending`: `pending(status: SefazStatus, options?: { ref?: string; retryAfterMs?: number; }): Pending`
- `rejected`: `rejected(status: SefazStatus, hint?: RejectionHint): Rejected`
- `timeContext`: `timeContext(clocks: { readonly emissao: Clock; readonly fatoGerador?: Clock; }): TimeContext`
- `tpAmbOf`: `tpAmbOf(ambiente: Ambiente): TpAmb`
- `ufByCUf`: Informações da UF pelo código IBGE (`'35'`), ou `undefined` se o código não existe. `ufByCUf(cUF: string): UfInfo | undefined`
- `ufBySigla`: Informações da UF pela sigla, ou `undefined` se a sigla não existe. `ufBySigla(sigla: string): UfInfo | undefined`
- `unwrapAuthorized`: Devolve o valor autorizado ou lança `SefazError` com o código do desfecho e o `cStat` oficial. `unwrapAuthorized<T, D>(o: SefazOutcome<T, D>): T`

### Classes

- `ConfigError` (estende `SineteError<'config_invalida'>`): Configuração inválida passada pelo chamador (opção ausente, valor fora do domínio, data inválida).
- `ProtocolError` (estende `SineteError<'resposta_invalida'>`): A resposta recebida não segue o leiaute esperado (XML malformado, grupo obrigatório ausente, cStat inválido).
- `SefazError` (estende `SineteError<SefazErrorCode>`): Lançado por `unwrapAuthorized` quando o desfecho não é autorização. Carrega `cStat` e `xMotivo` oficiais. Membros: `cStat`, `xMotivo`, `toJSON()`.
- `ServicoNaoOferecidoError` (estende `SineteError<'servico_nao_oferecido'>`): O autorizador não oferece o serviço pedido para a UF ou o ambiente, segundo a tabela oficial de web services (ex.: a Distribuição DF-e da NFC-e, um serviço que o autorizador pedido não tem naquele ambiente).
- `SineteError` (estende `string = string> extends Error`): Base de todos os erros do sinete. Membros: `code`, `details`, `docs`, `toJSON()`.
- `TimeoutError` (estende `SineteError<'tempo_esgotado'>`): Uma operação passou do prazo configurado. Membros: `timeoutMs`.
- `UnsupportedError` (estende `SineteError<'nao_suportado'>`): A runtime ou o ambiente não suporta o recurso pedido (ex.: o transporte do Deno para um host com renegociação).
- `ValidationError` (estende `SineteError<'validacao_falhou'>`): Dado recusado pela validação local, antes de chegar à SEFAZ. Traz todas as ocorrências, não só a primeira. Membros: `issues`, `toJSON()`.

### Interfaces

- `Authorized` (estende `SefazStatus`): Documento ou evento autorizado; `value` traz o protocolo e o que mais o pacote do documento devolver. Membros: `status`, `value`.
- `Clock`: Fonte de tempo. Cada chamada devolve uma instância nova de `Date`, que o chamador pode alterar sem efeito. Membros: `now()`.
- `DataSigner` (estende `SignerBase`): Membros: `kind`, `sign()`.
- `DataSource`: Membros: `title`, `url`, `retrievedAt`.
- `Denied` (estende `SefazStatus`): Uso denegado (irregularidade do emitente ou do destinatário). Diferente da rejeição, a denegação é registrada na SEFAZ e o número fica consumido; `value` traz o protocolo de denegação. Membros: `status`, `value`.
- `DigestSigner` (estende `SignerBase`): Membros: `kind`, `signDigestInfo()`.
- `GrupoDeCaminho`: Um grupo de caminhos: o `padrao` casa com o começo do caminho normalizado, e `rotulo` recebe os índices capturados já somados de um (o primeiro item é o 1). Grupo que se repete sem índice no XSD (um item só) chega com o índice ausente: `rotulo` recebe `1`. Membros: `padrao`, `rotulo`.
- `LogEntry`: Membros: `level`, `msg`, `fields`.
- `Logger`: Membros: `debug()`, `info()`, `warn()`, `error()`, `child()`.
- `ManualClock` (estende `Clock`): Relógio de teste controlado à mão. Membros: `set()`, `advance()`.
- `MemoryLogger` (estende `Logger`): Logger que guarda as entradas em memória, para asserções em teste. Membros: `entries`, `clear()`.
- `OutcomeHandlers`: Tratadores exaustivos: o compilador exige os quatro desfechos. Membros: `authorized()`, `rejected()`, `denied()`, `pending()`.
- `Pending` (estende `SefazStatus`): A SEFAZ recebeu e ainda não processou (lote em processamento, recibo a consultar). Membros: `status`, `ref`, `retryAfterMs`.
- `Rejected` (estende `SefazStatus`): Recusado pela SEFAZ; o documento não existe para o fisco e pode ser corrigido e reenviado. Membros: `status`, `hint`.
- `RejectionHint`: Diagnóstico de uma rejeição, preenchido pelo `@sinete/rejeicoes` quando o `cStat` está no catálogo. Membros: `probableCause`, `suggestedFix`, `source`.
- `SefazStatus`: Status oficial devolvido pela SEFAZ. Membros: `cStat`, `xMotivo`.
- `SerializedError`: Forma do erro em `JSON.stringify`, para log estruturado. Membros: `name`, `code`, `message`, `docs`, `details`, `cause`.
- `SignContext`: O que acompanha o pedido de assinatura de um documento, para quem assina fora do processo conferir o que assina (o helper `sinete-signer`, por exemplo, confere o autor de um evento no elemento). Quem assina localmente ignora. Membros: `id`, `referenced`.
- `SineteErrorOptions`: Membros: `cause`, `details`.
- `TabelaDeRotulos`: Membros: `grupos`, `campos`, `padrao`.
- `TimeContext`: Os dois relógios de uma operação fiscal. Membros: `emissao`, `fatoGerador`.
- `UfInfo`: Membros: `sigla`, `cUF`, `nome`, `regiao`.
- `UfTableInfo`: Metadados da tabela: versão (data da revisão), formato e fontes. Membros: `schemaVersion`, `version`, `sources`.
- `ValidationIssue`: Uma ocorrência de validação local, com o caminho do campo (`infNFe.emit.CNPJ`, `[3].cUF`). Membros: `path`, `code`, `message`, `origem`.

### Tipos

- `Ambiente`: Ambiente SEFAZ. No XML ele aparece como `tpAmb` (`1` produção, `2` homologação); na API do sinete ele é sempre nomeado, para que um `2` perdido não mande nota de teste para produção nem o contrário. `type Ambiente = 'producao' | 'homologacao'`
- `CoreErrorCode`: Códigos lançados pelas classes do `@sinete/core`. Os outros pacotes declaram os próprios. `type CoreErrorCode = 'config_invalida' | 'validacao_falhou' | 'nao_suportado' | 'servico_nao_oferecido' | 'tempo_esgotado' | 'resposta_invalida' | SefazErrorCode`
- `CUf`: Código IBGE da UF, na forma lexical do leiaute (tipo `TCodUfIBGE`). `type CUf = '11' | '12' | '13' | '14' | '15' | '16' | '17' | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28' | '29' | '31' | '32' | '33' | '35' | '41' | '42' | '43' | '50' | '51' | '52' | '53'`
- `ErrorDetails`: Detalhes estruturados do erro, serializáveis e sem segredo (nunca PIN, chave ou certificado). `type ErrorDetails = Readonly<Record<string, unknown>>`
- `Instant`: Instante aceito pelos relógios de teste: `Date`, epoch em milissegundos ou texto ISO 8601 com fuso. `type Instant = Date | number | string`
- `LogFields`: `type LogFields = Readonly<Record<string, unknown>>`
- `LogLevel`: Logger estruturado e injetável. `type LogLevel = 'debug' | 'info' | 'warn' | 'error'`
- `OrigemOcorrencia`: De onde vem uma ocorrência (ADR 0011): - `entrada`: conferência feita sobre a entrada do domínio (`NfeInput`, `MdfeInput`, `DpsInput`), antes de montar o documento. `type OrigemOcorrencia = 'entrada' | 'montagem'`
- `Regiao`: `type Regiao = 'N' | 'NE' | 'SE' | 'S' | 'CO'`
- `Result`: Resultado genérico para operações locais que podem falhar sem exceção (parse tolerante, validação). `type Result<T, E = Error> = { readonly ok: true; readonly value: T; } | { readonly ok: false; readonly error: E; }`
- `SefazErrorCode`: Códigos do `SefazError`, um por desfecho não autorizado. `type SefazErrorCode = 'sefaz_rejeitou' | 'sefaz_denegou' | 'sefaz_pendente'`
- `SefazOutcome`: Desfecho de uma chamada à SEFAZ. `D` é o tipo do valor na denegação, por padrão o mesmo da autorização. `type SefazOutcome<T, D = T> = Authorized<T> | Rejected | Denied<D> | Pending`
- `SefazOutcomeStatus`: `type SefazOutcomeStatus = SefazOutcome<unknown>['status']`
- `SignatureHash`: Hash aceito pelos leiautes de DF-e; SHA-256 fica para leiautes futuros e para o TLS. `type SignatureHash = 'SHA-1' | 'SHA-256'`
- `Signer`: `type Signer = DataSigner | DigestSigner`
- `SignerKind`: Contrato de quem assina. O core nunca vê a chave: entrega bytes e recebe bytes (ADR 0003). `type SignerKind = 'data' | 'digest'`
- `TpAmb`: Valor lexical de `tpAmb` no leiaute (`TAmb`). `type TpAmb = '1' | '2'`
- `Uf`: Sigla de UF (tipo `TUf` do leiaute, sem `EX`). `type Uf = 'AC' | 'AL' | 'AM' | 'AP' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA' | 'MG' | 'MS' | 'MT' | 'PA' | 'PB' | 'PE' | 'PI' | 'PR' | 'RJ' | 'RN' | 'RO' | 'RR' | 'RS' | 'SC' | 'SE' | 'SP' | 'TO'`

### Constantes

- `AMBIENTES`: `AMBIENTES: readonly Ambiente[]`
- `noopLogger`: Logger que descarta tudo. É o padrão quando o chamador não injeta um. `noopLogger: Logger`
- `systemClock`: Relógio do sistema. Use só na borda da aplicação; bibliotecas recebem o `Clock` de fora. `systemClock: Clock`
- `UF_TABLE`: `UF_TABLE: UfTableInfo`
- `UFS`: As 27 UFs, na ordem do código IBGE. `UFS: readonly UfInfo[]`

## `@sinete/core/xml`

`@sinete/core/xml`: parser XML estrito com offsets, C14N 1.0 inclusivo e XMLDSig no perfil dos DF-e.

Sem DOM e sem dependências de runtime; a criptografia é a WebCrypto de `globalThis.crypto`, então roda igual em Node, Bun, Deno e browser. A assinatura insere texto por splice e nunca reserializa o documento (ADR 0003).

### Funções

- `assembleSignature`: Fase 3: troca o placeholder pelo `SignatureValue`. Nada mais no texto muda. `assembleSignature(prepared: PreparedSignature, signatureValue: Uint8Array): string`
- `attributeOf`: Valor do atributo sem namespace com o nome local dado. `attributeOf(el: XmlElement, local: string): string | undefined`
- `base64Decode`: Decodifica base64 ignorando whitespace (o `X509Certificate` e o `SignatureValue` costumam vir quebrados). `base64Decode(s: string): Uint8Array<ArrayBuffer>`
- `base64Encode`: Codifica em base64 numa linha só, sem quebra (forma usada pela SEFAZ). `base64Encode(u: Uint8Array): string`
- `c14n`: C14N 1.0 inclusivo, sem comentários, do elemento `apex` e seus descendentes. `c14n(apex: XmlElement, options?: C14nOptions): string`
- `childElements`: Filhos que são elementos, na ordem do documento. `childElements(el: XmlElement): XmlElement[]`
- `descendants`: O elemento e todos os descendentes, em ordem de documento. `descendants(el: XmlElement): Generator<XmlElement, void, undefined>`
- `escapeC14nAttribute`: Escape de valor de atributo do C14N: `&`, `<`, `"`, TAB, LF e CR. `escapeC14nAttribute(s: string): string`
- `escapeC14nText`: Escape de nó de texto do C14N: `&`, `<`, `>` e CR. `escapeC14nText(s: string): string`
- `findSignatures`: Todos os `Signature` do XMLDSig no documento, em ordem de documento. `findSignatures(doc: XmlDocument): XmlElement[]`
- `firstChild`: Primeiro filho direto com o nome local (e o namespace, quando informado). `firstChild(el: XmlElement, local: string, ns?: string): XmlElement | undefined`
- `inScopeNamespaces`: Namespaces em escopo no elemento, incluindo os declarados nos ancestrais (o mais próximo vence). `inScopeNamespaces(el: XmlElement): Map<string, string>`
- `parseXml`: Lê `source` como XML 1.0 bem formado com namespaces. A string não é alterada e fica em `document.source`. Lança `XmlError` (`xml_malformado`) com o offset do problema. `parseXml(source: string): XmlDocument`
- `prepareSignature`: Fase 1: calcula o digest e insere o `<Signature>` com placeholder, sem tocar no resto do texto. `prepareSignature(xml: string, options: PrepareOptions): Promise<PreparedSignature>`
- `signedInfoDigestInfo`: Monta o DigestInfo DER (prefixo SHA-1 + hash) do `SignedInfo`, entrada do modo `digest`. `signedInfoDigestInfo(prepared: PreparedSignature): Promise<Uint8Array>`
- `signPrepared`: Fase 2: pede a assinatura RSA PKCS#1 v1.5 com SHA-1 ao signer, no modo dele. `signPrepared(prepared: PreparedSignature, signer: Signer): Promise<Uint8Array>`
- `signXml`: As três fases de uma vez: prepara com o certificado do signer, assina e monta. `signXml(xml: string, options: { readonly id: string; }, signer: Signer): Promise<string>`
- `spkiFromCertificate`: Extrai o `SubjectPublicKeyInfo` (DER) de um certificado X.509 em DER (RFC 5280, 4.1). `spkiFromCertificate(der: Uint8Array): Uint8Array<ArrayBuffer>`
- `textOf`: Texto direto do elemento (só os nós de texto filhos, sem descer nos elementos). `textOf(el: XmlElement): string`
- `verifySignature`: Verifica a assinatura que referencia `expected.id`. Aceita a string XML ou um documento já parseado por `parseXml`. Nunca lança por causa do documento: toda falha volta como `VerifyFailed` com categoria. `verifySignature(xml: string | XmlDocument, expected: VerifyExpectation): Promise<VerifyResult>`

### Classes

- `XmlError` (estende `SineteError<'xml_malformado'>`): O texto não é XML 1.0 bem formado com namespaces, ou usa algo que o parser recusa de propósito (DTD, entidade externa). `offset` é a posição (em unidades UTF-16 da string) onde o problema foi detectado. Membros: `offset`.
- `XmlSignatureError` (estende `SineteError<'xmldsig_falhou'>`): A assinatura não pôde ser montada (Id ausente ou duplicado, template corrompido, signer devolveu vazio). Membros: `reason`.

### Interfaces

- `C14nOptions`: Membros: `exclude`.
- `PreparedSignature`: Membros: `template`, `placeholder`, `insertedAt`, `signedInfo`, `digestValue`, `referenced`, `id`.
- `PrepareOptions`: Membros: `id`, `certificateDer`.
- `VerifyExpectation`: Membros: `id`, `element`.
- `VerifyFailed`: Membros: `ok`, `failure`, `detail`, `signedInfoValid`.
- `VerifySuccess`: Membros: `ok`, `id`, `element`, `document`, `certificateDer`, `signatureAlgorithm`, `digestAlgorithm`.
- `XmlAttribute`: Membros: `name`, `prefix`, `local`, `ns`, `value`.
- `XmlDocument`: Membros: `source`, `root`, `ids`.
- `XmlElement`: Membros: `type`, `name`, `prefix`, `local`, `ns`, `attributes`, `namespaces`, `children`, `parent`, `start`, `openEnd`, `contentEnd`, `end`, `selfClosing`.
- `XmlProcessingInstruction`: Instrução de processamento dentro do elemento raiz. Membros: `type`, `target`, `data`, `start`, `end`.
- `XmlText`: Texto (inclusive CDATA) já com fim de linha normalizado e referências resolvidas. Trechos vizinhos são unidos. Membros: `type`, `value`, `start`, `end`.

### Tipos

- `VerifyFailure`: Categoria de uma verificação que falhou.
- `VerifyResult`: `type VerifyResult = VerifySuccess | VerifyFailed`
- `XmlErrorCode`: Códigos lançados por este pacote. `type XmlErrorCode = 'xml_malformado' | 'xmldsig_falhou'`
- `XmlNode`: `type XmlNode = XmlElement | XmlText | XmlProcessingInstruction`
- `XmlSignatureFailure`: Motivo de uma falha ao preparar ou montar uma assinatura. `type XmlSignatureFailure = 'id-ausente' | 'id-duplicado' | 'referencia-na-raiz' | 'placeholder-no-documento' | 'placeholder-ausente' | 'assinatura-vazia'`

### Constantes

- `SHA1_DIGEST_INFO_PREFIX`: Prefixo DER do DigestInfo SHA-1 (RFC 8017, 9.2, nota 1). `SHA1_DIGEST_INFO_PREFIX: Uint8Array`
- `XML_NS`: Namespace fixo do prefixo `xml` (Namespaces in XML 1.0, seção 3). `XML_NS = "http://www.w3.org/XML/1998/namespace"`
- `XMLDSIG_ALGORITHMS`: URIs de algoritmo usadas pelo perfil SEFAZ. `XMLDSIG_ALGORITHMS: { readonly c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'; readonly envelopedSignature: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'; readonly rsaSha1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'; r…`
- `XMLDSIG_NS`: Namespace do XMLDSig. `XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#"`
- `XMLNS_NS`: Namespace reservado das declarações `xmlns`. `XMLNS_NS = "http://www.w3.org/2000/xmlns/"`
