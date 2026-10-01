# sinete

## 0.3.0

### Minor Changes

- 23c1c08: **Quebra: `criarEmissor` e o perfil saem da raiz.** `criarEmissor`, `PerfilDocumento`, `ContingenciaDoPerfil`, `ContextoEmissor`, `ModoEnvio`, `ContingenciaAplicada`, `ContingenciaDosBytes`, `Sonda` e `SondaSvc` passam a sair por `@sinete/emissor/perfil` (e `sinete/emissor/perfil`), subpath experimental, fora da garantia de estabilidade (ADR 0016): um gancho novo do perfil pode mudar esses tipos em minor. Troque `import { criarEmissor } from '@sinete/emissor'` por `import { criarEmissor } from '@sinete/emissor/perfil'`. `criarEmissorNfe`, `criarEmissorMdfe` e `criarEmissorNfse` não mudam e seguem estáveis; `perfilNfe`, `perfilMdfe` e `perfilNfse` continuam nos subpaths de documento, marcados como experimentais.
  
  **`signal` no emissor** (ADR 0010, decisão 8). `EmitirOpcoes` e `RetomarOpcoes` ganham `signal` (`EnvioOpcoes`, exportado pela raiz, o mesmo formato do dos clientes), e `consultar`, `cancelar`, `cartaCorrecao` (NF-e), `encerrar` (MDF-e) e `pdfPorChave` (NFS-e, no tipo novo `PdfPorChaveOpcoes`) aceitam `opcoes?: EnvioOpcoes`. `RetomadaOpcoes.signal` para `retomarPendentes`. Contrato: abortado antes de os bytes serem gravados, `emitir` e `retomar` lançam o `ErroTransporte` com `code: 'cancelado'`, nada é gravado e a trava é solta; abortado depois, a requisição em curso é cancelada, o emissor não consulta nem reenvia, os bytes ficam, a trava é solta e o desfecho é `pendente` com `motivo: 'sem-resposta'` e o `cancelado` em `causa`, para `retomar`. Nos eventos, abortado antes da chamada lança; com o pedido em curso, `pendente` sem a consulta de recuperação. O abort não conta como falha do autorizador para a contingência automática, e as consultas de status da contingência recebem o mesmo `signal` (`ContingenciaDoPerfil.sondar` e `sondarSvc` ganham `opcoes?: EnvioOpcoes`): nenhuma começa depois do abort e a abortada não vale como resposta. Com o sinal disparado, a `causa` da pendência é sempre o `cancelado`; na retomada automática, a gravação abortada e as seguintes contam em `adiadas`. `PerfilDocumento.enviar` recebe o `signal` como quarto parâmetro opcional.
  
  **NFS-e: consulta indecisa é `pendente`.** Com o `resolverEnvioSemResposta` novo do `@sinete/nfse`, a DPS que consta como processada sem a NFS-e encontrada, a NFS-e de outra DPS e a E0014 sem a DPS na consulta voltam como `pendente` com `motivo: 'consulta-indefinida'` (e a E0014 em `anterior`), sem o reenvio que só voltaria E0014 de novo. Antes, o primeiro caso chegava como `resposta_invalida` e virava `pendente` com `motivo: 'sem-resposta'`.
- 23c1c08: `resolverEnvioSemResposta(cliente, mdfeAssinado, anterior?, opcoes?)` e `recuperarEventoRegistrado(cliente, chave, tpEvento, opcoes?)` aceitam `opcoes?: EnvioOpcoes` no fim e repassam o `signal` à consulta, como os métodos do `ClienteMdfe`. Compatível.
- 23c1c08: **Quebra: texto e tamanho dos campos conferidos na entrada** (ADR 0011, revisão de 01/10/2026). O `montarNfe` confere os textos da entrada antes de montar, e as ocorrências abaixo mudam de `caminho` e de `origem`; o texto fora do tipo do leiaute muda também de `code` e de `mensagem`. Quem compara `code` ou `caminho` (lista de códigos que vão para a tela, tabela de rótulos, lista de campos que a aplicação preenche) precisa conferir estes casos:
  
  | Ocorrência | Antes | Agora |
  |---|---|---|
  | caractere que o XML não representa (de controle, substituto solto), em qualquer texto da entrada | `code: 'campo_invalido'`, caminho do documento montado (`infNFe.ide.natOp`, `infNFe.det[0].prod.xProd`), `origem: 'montagem'`, `mensagem: 'texto com caractere não permitido em XML'` | `code: 'campo_invalido'`, caminho da entrada (`natOp`, `itens[0].produto.xProd`), `origem: 'entrada'`, `mensagem: 'caractere não aceito (símbolo ou caractere de controle)'` |
  | texto fora do tipo do leiaute (tamanho, espaço nas pontas, caractere fora do `TString`) nos campos listados abaixo | `code: 'schema'`, caminho do XSD (`/infNFe/ide/natOp`, `/infNFe/det[2]/prod/xProd`), `origem: 'montagem'`, `mensagem` do validador (`tamanho_maximo: tamanho máximo 60 (TString)`, `padrao: valor não casa com o pattern (TString)`) | `code: 'campo_invalido'`, caminho da entrada (`natOp`, `itens[1].produto.xProd`), `origem: 'entrada'`, uma ocorrência por regra violada, com `mensagem` para quem preenche o campo |
  
  As mensagens novas do texto fora do tipo: `no máximo 60 caracteres (tem 70)` (e `no mínimo`, `exatamente`, com o limite do PL), `sem espaço no começo nem no fim`, `caractere não aceito: “€”` (o primeiro caractere recusado, quando é visível), `caractere não aceito (símbolo ou caractere de controle)` (quando não é), `não pode ficar em branco` (só espaços) e, para o que o tipo recusa sem ser um desses casos, `formato não aceito`. A `mensagem` não é contrato (ADR 0016): o `code`, o `caminho` e a `origem` são.
  
  Campos conferidos na entrada: `natOp`; `emitente.xNome`, `xFant` e `endereco.xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`; `destinatario.xNome`, `email` e `endereco.xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`, `xPais`; `retirada` e `entrega` (`xNome`, `xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`, `email`); `itens[n].produto.cProd`, `xProd`, `uCom`, `uTrib`, `xPed`; `itens[n].infAdProd`; `transporte.transportador.xNome`, `xEnder`, `xMun`; `transporte.volumes[n].esp`, `marca`, `nVol`; `cobranca.fatura.nFat`; `cobranca.duplicatas[n].nDup`; `pagamento.detPag[n].xPag`; `informacoesAdicionais.infAdFisco`, `infCpl`, `obsCont[n].xTexto`, `obsFisco[n].xTexto`; `compra.xNEmp`, `xPed`, `xCont`.
  
  O limite vem do tipo do elemento no PL da montagem, não de uma tabela de números. Não mudam e continuam `schema` (ou `campo_invalido` com a mensagem antiga, no caractere fora do XML), com o caminho do XML e `origem: 'montagem'`: o nome do destinatário e, na NFC-e, a descrição do primeiro item em homologação (a montagem os troca pelas literais de teste), os grupos repassados no tipo do schema (`exporta`, `infIntermed`, `cana`, `agropecuario` e afins), as opções da montagem (o `respTec` das opções, o CSC, o QR Code) e os valores calculados. O grupo IBSCBS pronto (`itens[n].impostos.ibsCbs.grupo`) segue `schema` com `origem: 'entrada'`, como antes: é estrutura do leiaute montada pelo integrador, não texto digitado. O campo que já tem ocorrência de outra conferência da entrada não ganha a segunda.
  
  **`signal` nos resolvedores.** `resolverEnvioSemResposta(cliente, nfeAssinada, anterior?, opcoes?)` e `recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento?, opcoes?)` aceitam `opcoes?: EnvioOpcoes` no fim e repassam o `signal` à consulta. Compatível.
- 23c1c08: **Quebra: `resolverEnvioSemResposta` devolve `indefinida` em vez de lançar.** `ResolucaoEnvio` ganha o caso `{ acao: 'indefinida', motivo, chaveAcesso? }`, como o resolvedor da NF-e e do MDF-e: a consulta respondeu sem decidir. Sai quando a DPS consta como processada e a NFS-e da chave não é encontrada (antes, `ErroRespostaInvalida` "a NFS-e não foi encontrada"), quando a NFS-e da chave é de outra DPS (antes, `ErroRespostaInvalida` "não corresponde à DPS"), e quando o envio voltou E0014 e a consulta não acha a DPS (antes, `reenviar`, que voltaria E0014 de novo). Um `switch` sobre `acao` precisa do caso novo (ou de um `default`, ADR 0016). Erros do transporte e respostas fora do contrato da própria consulta continuam lançando.
  
  A assinatura passa a ser `resolverEnvioSemResposta(cliente, dpsAssinada, anterior?, opcoes?)`: `anterior` é o desfecho do envio (`ResultadoNfse<NfseGerada>`), usado para reconhecer a E0014, e `opcoes.signal` vai às consultas. Chamadas com dois argumentos continuam valendo.
  
  **`ClienteNfse.opcoes`** (aditivo): as opções da criação, com o mesmo formato de `ClienteNfe.opcoes` e `ClienteMdfe.opcoes`. `ambiente` e `parametros` continuam.
- 5547ca1: Campo opcional `orientacao` nas entradas do catálogo da NF-e e do MDF-e e no `DicaRejeicao`: texto para quem emite a nota (produtor, contador, atendente), em uma ou duas frases sem termo de integração, com o que aconteceu e o que mudar na nota, no cadastro ou junto à SEFAZ. `causaProvavel` e `comoCorrigir` continuam sendo o texto para quem integra. `dicaRejeicao`, `dicaRejeicaoMdfe` e os `completar*` passam a levar a `orientacao` quando a entrada tem.
  
  Entram 59 das 92 rejeições curadas da NF-e e 12 das 15 do MDF-e: só as que quem emite resolve na nota, no cadastro ou na SEFAZ. Falha do sistema emissor (schema, assinatura, certificado da conexão, chave e dígito, cálculo de totais e tributos, duplicidade por reenvio, consumo indevido) fica sem `orientacao`. O catálogo da NFS-e não muda.
- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.

### Patch Changes

- Updated dependencies [23c1c08]
- Updated dependencies [a3993e7]
- Updated dependencies [1864bb5]
- Updated dependencies [23c1c08]
- Updated dependencies [23c1c08]
- Updated dependencies [23c1c08]
- Updated dependencies [395f19c]
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/emissor@0.3.0
  - @sinete/ibs-cbs@0.2.1
  - @sinete/nfe@0.3.0
  - @sinete/ibs-cbs-dados@2026.9.3
  - @sinete/mdfe@0.3.0
  - @sinete/nfse@0.3.0
  - @sinete/rejeicoes@0.3.0
  - @sinete/core@0.3.0
  - @sinete/cert@0.2.1
  - @sinete/cli@0.2.1
  - @sinete/da@0.2.1
  - @sinete/schemas@0.2.1
  - @sinete/transport@0.2.1
  - @sinete/validators@0.2.1

## 0.2.0

### Minor Changes

- 2bd9b9a: `NfeClient` e `MdfeClient` aceitam `signal` em todo método que vai à rede, no padrão do `NfseClient`. Na NF-e, `consultar`, `cancelar`, `cancelarPorSubstituicao`, `cartaCorrecao`, `manifestar`, `inutilizar` e `consultarCadastro` ganham `opcoes?: OpcoesEnvio` no fim, e `statusServico` (`StatusServicoOpcoes`) e `distribuicaoDFe` recebem o `signal` no objeto de opções que já tinham. No MDF-e, `statusServico`, `consultar`, `consultarNaoEncerrados` e os eventos ganham `opcoes?: OpcoesEnvio`, e `AutorizarOpcoes` passa a ser o mesmo tipo. Os dois pacotes exportam `OpcoesEnvio`. A mudança é compatível: o parâmetro novo é opcional.
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `A1KeyStore` | `CertificadoA1` |
  | `KeyStore` | `Certificado` |
  | `OpenPfxOptions` | `AbrirPfxOpcoes` |
  | `TlsPemMaterial` | `MaterialTlsPem` |
  | `Validity` | `Validade` |
  | `openPfx` | `abrirPfx` |
  | `validityAt` | `validadeEm` |
  | `BuildChainOptions` | `MontarCadeiaOpcoes` |
  | `ChainResult` | `ResultadoCadeia` |
  | `ChainStatus` | `SituacaoCadeia` |
  | `buildChain` | `montarCadeia` |
  | `mayIssue` | `podeEmitir` |
  | `verifyIssuedBy` | `conferirEmitidoPor` |
  | `CertError` | `ErroCertificado` |
  | `CertErrorCode` | `CodigoErroCertificado` |
  | `CertificateInfo` | `CertificadoX509` |
  | `DistinguishedName` | `NomeDistinto` |
  | `DnAttribute` | `AtributoDoNome` |
  | `OtherPublicKey` | `OutraChavePublica` |
  | `RsaPublicKey` | `ChavePublicaRsa` |
  | `certificateToPem` | `pemDoCertificado` |
  | `fingerprintSha256` | `impressaoDigitalSha256` |
  | `namesMatch` | `nomesIguais` |
  | `parseCertificate` | `lerCertificado` |
  | `IcpBundleCertificate` | `CertificadoDoBundleIcp` |
  | `IcpBundleInfo` | `DescricaoBundleIcp` |
  | `icpBrasilCertificates` | `certificadosIcpBrasil` |
  | `icpBrasilTlsPem` | `pemTlsIcpBrasil` |
  | `IcpIdentity` | `IdentidadeIcp` |
  | `icpIdentity` | `identidadeIcp` |
  | `Pkcs12Contents` | `ConteudoPkcs12` |
  | `Pkcs12Reader` | `LeitorPkcs12` |
  | `forgePkcs12Reader` | `leitorPkcs12Forge` |
  | `legacyPasswordVariant` | `senhaNoFormatoLegado` |
  | `base64ToBytes` | `decodificarBase64` |
  | `bytesToBase64` | `codificarBase64` |
  | `derToPem` | `pemDoDer` |
  | `pemToDers` | `dersDoPem` |
  | `createA1Signer` | `criarAssinadorA1` |
  | `digestInfoOf` | `digestInfoDe` |
  | `digestSignerAsDataSigner` | `comoAssinadorDeDados` |
  | `encodeDigestInfo` | `codificarDigestInfo` |
  | `signBytes` | `assinarBytes` |
  | `verifyBytes` | `conferirBytes` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `CertificadoA1` | `tlsPem.options.chain` | `tlsPem.opcoes.cadeia` |
  | `DescricaoBundleIcp` | `source.hashUrl` | `fonte.urlDoHash` |
  | `DescricaoBundleIcp` | `source.retrievedAt` | `fonte.coletadoEm` |
  | `DescricaoBundleIcp` | `source.zipCertificates` | `fonte.certificadosNoZip` |
  | `ErroCertificado` | `constructor.options` | `constructor.opcoes` |
  | `CertificadoA1` | `tlsPem.options` | `tlsPem.opcoes` |
  | `LeitorPkcs12` | `read.password` | `ler.senha` |
  | `CertificadoDoBundleIcp`, `CertificadoA1`, `Certificado` | `kind` | `tipo` |
  | `CertificadoDoBundleIcp` | `file` | `arquivo` |
  | `CertificadoDoBundleIcp` | `keyType` | `tipoDeChave` |
  | `CertificadoDoBundleIcp`, `DescricaoBundleIcp` | `source` | `fonte` |
  | `DescricaoBundleIcp` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoBundleIcp` | `version` | `versao` |
  | `DescricaoBundleIcp` | `excluded` | `excluidos` |
  | `MontarCadeiaOpcoes` | `intermediates` | `intermediarias` |
  | `MontarCadeiaOpcoes` | `anchors` | `ancoras` |
  | `MontarCadeiaOpcoes`, `AbrirPfxOpcoes`, `validadeEm` | `clock` | `relogio` |
  | `MontarCadeiaOpcoes` | `maxDepth` | `profundidadeMaxima` |
  | `ResultadoCadeia` | `status` | `situacao` |
  | `ResultadoCadeia` | `chain` | `cadeia` |
  | `ResultadoCadeia` | `anchor` | `ancora` |
  | `ResultadoCadeia` | `missingIssuer` | `emissorAusente` |
  | `ResultadoCadeia` | `expired` | `vencidos` |
  | `montarCadeia` | `leaf` | `folha` |
  | `montarCadeia`, `abrirPfx` | `options` | `opcoes` |
  | `podeEmitir`, `conferirEmitidoPor` | `issuer` | `emissor` |
  | `podeEmitir` | `below` | `abaixo` |
  | `IdentidadeIcp` | `source` | `origem` |
  | `CertificadoA1`, `Certificado`, `comoAssinadorDeDados`, `assinarBytes` | `signer` | `assinador` |
  | `Certificado` | `certificate` | `certificado` |
  | `Certificado` | `extraCertificates` | `certificadosExtras` |
  | `Certificado` | `identity` | `identidade` |
  | `Certificado` | `validity` | `validade` |
  | `AbrirPfxOpcoes`, `senhaNoFormatoLegado` | `password` | `senha` |
  | `AbrirPfxOpcoes` | `allowExpired` | `aceitarVencido` |
  | `AbrirPfxOpcoes` | `reader` | `leitor` |
  | `MaterialTlsPem` | `certChain` | `cadeia` |
  | `MaterialTlsPem` | `key` | `chave` |
  | `pemDoDer`, `dersDoPem` | `label` | `rotulo` |
  | `ConteudoPkcs12` | `privateKeys` | `chavesPrivadas` |
  | `ConteudoPkcs12` | `certificates` | `certificados` |
  | `LeitorPkcs12` | `name` | `nome` |
  | `LeitorPkcs12` | `read` | `ler` |
  | `criarAssinadorA1` | `certificateDer` | `certificadoDer` |
  | `digestInfoDe`, `assinarBytes`, `conferirBytes` | `data` | `dados` |
  | `conferirBytes` | `signature` | `assinatura` |
  | `CertificadoX509` | `unsupportedCriticalExtensions` | `extensoesCriticasNaoSuportadas` |
  | `CertificadoX509` | `ocspUrls` | `urlsOcsp` |
  | `CertificadoX509` | `caIssuersUrls` | `urlsCaIssuers` |
  | `CertificadoX509` | `crlUrls` | `urlsCrl` |
  | `CertificadoX509` | `publicKey` | `chavePublica` |
  | `NomeDistinto` | `text` | `texto` |
  | `NomeDistinto` | `attributes` | `atributos` |
  | `OutraChavePublica`, `ChavePublicaRsa` | `algorithm` | `algoritmo` |
  | `ChavePublicaRsa` | `modulusHex` | `moduloHex` |
  | `ChavePublicaRsa` | `exponentHex` | `expoenteHex` |
  | `SubjectAltNames` | `dnsNames` | `nomesDns` |
  | `SubjectAltNames` | `ipAddresses` | `enderecosIp` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `CertificadoDoBundleIcp` | `'root'` | `'raiz'` |
  | `CertificadoDoBundleIcp` | `'intermediate'` | `'intermediaria'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/icp-brasil.json` | `file` | `arquivo` |
  | `data/icp-brasil.json` | `keyType` | `tipoDeChave` |
  | `data/icp-brasil.json` | `kind` | `tipo` |
  | `data/icp-brasil.json` | `source` | `fonte` |
  | `data/icp-brasil.json` | `seenOn` | `vistoEm` |
  | `data/icp-brasil.json` | `why` | `motivo` |
  | `data/icp-brasil.json` | `reason` | `motivo` |
  | `data/icp-brasil.json` | `hashUrl` | `urlDoHash` |
  | `data/icp-brasil.json` | `retrievedAt` | `coletadoEm` |
  | `data/icp-brasil.json` | `zipCertificates` | `certificadosNoZip` |
  | `data/icp-brasil.json` | `certificates` | `certificados` |
  | `data/icp-brasil.json` | `excluded` | `excluidos` |
  | `data/icp-brasil.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/icp-brasil.json` | `version` | `versao` |
  Também mudam nesta versão:
  
  - `name` de cada classe de erro é o nome novo da classe (`ErroCertificado`).
  - Chaves de `detalhes`: `certificates` → `certificados`.
  - `src/data/icp-brasil.json`: além das chaves, os valores de `tipo` passam a `raiz` e `intermediaria`, e `versaoDoFormato` sobe para 2.
  - Os campos do certificado com o nome da RFC 5280 (`subject`, `issuer`, `serialNumber`, `notBefore`, `notAfter`, `keyUsage`, `extKeyUsage`, `signatureAlgorithm`) ficam em inglês (exceção 1 do ADR 0015).
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - Flags do `doctor`: `--allow-expired` → `--aceitar-vencido` e `--ca` → `--ac`. Os comandos `doctor` e `agents-md` ficam (nome próprio).
  - Saída JSON do `doctor`: `checks` → `verificacoes`, `status` → `situacao`, `message` → `mensagem`, `details` → `detalhes`, e as chaves dos detalhes em português (`diasRestantes`, `cadeia`, `situacao`, `vencidos`, `desvioSegundos`, `fonte`, `protocolo`, `cifra`, `certificadoDoCliente`, `statusHttp`). `notBefore` e `notAfter` ficam, como na RFC 5280.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `upsertBloco` | `aplicarBloco` |
  | `upsertSkill` | `aplicarSkill` |
  | `CheckStatus` | `SituacaoDaVerificacao` |
  | `DoctorCheck` | `VerificacaoDoDoctor` |
  | `DoctorOptions` | `DoctorOpcoes` |
  | `DoctorReport` | `RelatorioDoDoctor` |
  | `formatCnpj` | `formatarCnpj` |
  | `maskCpf` | `mascararCpf` |
  | `maskCpfs` | `mascararCpfs` |
  | `parseHttpDate` | `lerDataHttp` |
  | `runDoctor` | `rodarDoctor` |
  | `openKeyStore` | `abrirCertificado` |
  | `CliIo` | `EntradaSaidaCli` |
  | `formatReport` | `formatarRelatorio` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `EntradaSaidaCli` | `out.line` | `saida.linha` |
  | `EntradaSaidaCli` | `err.line` | `erro.linha` |
  | `EntradaSaidaCli` | `promptPassword.question` | `pedirSenha.pergunta` |
  | `EntradaSaidaCli` | `readFile.path` | `lerArquivo.caminho` |
  | `EntradaSaidaCli` | `writeFile.path` | `gravarArquivo.caminho` |
  | `EntradaSaidaCli` | `writeFile.text` | `gravarArquivo.texto` |
  | `EntradaSaidaCli` | `doctor.options` | `doctor.opcoes` |
  | `VerificacaoDoDoctor` | `status` | `situacao` |
  | `VerificacaoDoDoctor` | `message` | `mensagem` |
  | `VerificacaoDoDoctor` | `details` | `detalhes` |
  | `DoctorOpcoes` | `password` | `senha` |
  | `DoctorOpcoes` | `extraChainPem` | `cadeiaAdicionalPem` |
  | `DoctorOpcoes` | `extraCaPem` | `acsAdicionaisPem` |
  | `DoctorOpcoes` | `allowExpired` | `aceitarVencido` |
  | `DoctorOpcoes` | `status` | `consultarStatus` |
  | `DoctorOpcoes` | `clockUrl` | `urlDoRelogio` |
  | `DoctorOpcoes` | `clock` | `relogio` |
  | `RelatorioDoDoctor` | `checks` | `verificacoes` |
  | `mascararCpfs` | `text` | `texto` |
  | `lerDataHttp` | `value` | `valor` |
  | `rodarDoctor` | `options` | `opcoes` |
  | `EntradaSaidaCli` | `out` | `saida` |
  | `EntradaSaidaCli` | `err` | `erro` |
  | `EntradaSaidaCli` | `promptPassword` | `pedirSenha` |
  | `EntradaSaidaCli` | `readFile` | `lerArquivo` |
  | `EntradaSaidaCli` | `writeFile` | `gravarArquivo` |
  | `formatarRelatorio` | `report` | `relatorio` |
- ae8ab90: Nomes da API pública em português (ADR 0015, fase 1). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `ambienteOfTpAmb` | `ambienteDoTpAmb` |
  | `isAmbiente` | `ehAmbiente` |
  | `tpAmbOf` | `tpAmbDoAmbiente` |
  | `Clock` | `Relogio` |
  | `Instant` | `InstanteInformado` |
  | `ManualClock` | `RelogioManual` |
  | `TimeContext` | `ContextoDeTempo` |
  | `fixedClock` | `relogioFixo` |
  | `formatDateTimeOffset` | `formatarDataHoraComFuso` |
  | `manualClock` | `relogioManual` |
  | `systemClock` | `relogioDoSistema` |
  | `timeContext` | `contextoDeTempo` |
  | `CoreErrorCode` | `CodigoErroCore` |
  | `ErrorDetails` | `DetalhesDoErro` |
  | `SefazErrorCode` | `CodigoErroSefaz` |
  | `SerializedError` | `ErroSerializado` |
  | `SineteErrorOptions` | `ErroSineteOpcoes` |
  | `ValidationIssue` | `Ocorrencia` |
  | `ConfigError` | `ErroDeConfiguracao` |
  | `isSineteError` | `ehErroSinete` |
  | `ProtocolError` | `ErroRespostaInvalida` |
  | `SefazError` | `ErroSefaz` |
  | `ServicoNaoOferecidoError` | `ErroServicoNaoOferecido` |
  | `SineteError` | `ErroSinete` |
  | `TimeoutError` | `ErroDeTempoEsgotado` |
  | `UnsupportedError` | `ErroNaoSuportado` |
  | `ValidationError` | `ErroDeValidacao` |
  | `LogEntry` | `EntradaDeLog` |
  | `LogFields` | `CamposDeLog` |
  | `LogLevel` | `NivelDeLog` |
  | `MemoryLogger` | `LoggerEmMemoria` |
  | `memoryLogger` | `loggerEmMemoria` |
  | `noopLogger` | `loggerSilencioso` |
  | `Authorized` | `Autorizado` |
  | `Denied` | `Denegado` |
  | `OutcomeHandlers` | `TratadoresDeResultado` |
  | `Pending` | `Pendente` |
  | `Rejected` | `Recusado` |
  | `RejectionHint` | `DicaRejeicao` |
  | `Result` | `Resultado` |
  | `SefazOutcome` | `ResultadoSefaz` |
  | `SefazOutcomeStatus` | `TipoResultadoSefaz` |
  | `SefazStatus` | `StatusSefaz` |
  | `authorized` | `criarAutorizado` |
  | `denied` | `criarDenegado` |
  | `pending` | `criarPendente` |
  | `rejected` | `criarRecusado` |
  | `isAuthorized` | `autorizado` |
  | `isDenied` | `denegado` |
  | `isPending` | `pendente` |
  | `isRejected` | `recusado` |
  | `isCStat` | `ehCStat` |
  | `matchOutcome` | `tratarResultado` |
  | `unwrapAuthorized` | `exigirAutorizado` |
  | `err` | `falha` |
  | `DataSigner` | `AssinadorDeDados` |
  | `DigestSigner` | `AssinadorDeDigest` |
  | `SignatureHash` | `HashDaAssinatura` |
  | `SignContext` | `ContextoDaAssinatura` |
  | `Signer` | `Assinador` |
  | `SignerKind` | `TipoAssinador` |
  | `DataSource` | `FonteDeDados` |
  | `UfInfo` | `UnidadeFederativa` |
  | `UfTableInfo` | `DescricaoTabelaUfs` |
  | `UF_TABLE` | `TABELA_UFS` |
  | `isCUf` | `ehCUf` |
  | `isUf` | `ehUf` |
  | `ufByCUf` | `ufPorCUf` |
  | `ufBySigla` | `ufPorSigla` |
  | `C14nOptions` | `C14nOpcoes` |
  | `escapeC14nAttribute` | `escaparAtributoC14n` |
  | `escapeC14nText` | `escaparTextoC14n` |
  | `VerifyExpectation` | `AssinaturaEsperada` |
  | `VerifyFailed` | `ConferenciaInvalida` |
  | `VerifyFailure` | `MotivoFalhaConferencia` |
  | `VerifyResult` | `ResultadoConferencia` |
  | `VerifySuccess` | `ConferenciaValida` |
  | `findSignatures` | `encontrarAssinaturas` |
  | `verifySignature` | `conferirAssinatura` |
  | `XMLDSIG_ALGORITHMS` | `ALGORITMOS_XMLDSIG` |
  | `base64Decode` | `decodificarBase64` |
  | `base64Encode` | `codificarBase64` |
  | `spkiFromCertificate` | `extrairSpki` |
  | `XmlErrorCode` | `CodigoErroXml` |
  | `XmlSignatureFailure` | `MotivoFalhaAssinaturaXml` |
  | `XmlError` | `ErroXml` |
  | `XmlSignatureError` | `ErroAssinaturaXml` |
  | `XmlAttribute` | `AtributoXml` |
  | `XmlDocument` | `DocumentoXml` |
  | `XmlElement` | `ElementoXml` |
  | `XmlNode` | `NoXml` |
  | `XmlProcessingInstruction` | `InstrucaoDeProcessamentoXml` |
  | `XmlText` | `TextoXml` |
  | `attributeOf` | `atributoDe` |
  | `childElements` | `elementosFilhos` |
  | `descendants` | `descendentes` |
  | `firstChild` | `primeiroFilho` |
  | `inScopeNamespaces` | `namespacesEmEscopo` |
  | `parseXml` | `lerXml` |
  | `textOf` | `textoDe` |
  | `PreparedSignature` | `AssinaturaPreparada` |
  | `PrepareOptions` | `PrepararAssinaturaOpcoes` |
  | `assembleSignature` | `montarAssinatura` |
  | `prepareSignature` | `prepararAssinatura` |
  | `SHA1_DIGEST_INFO_PREFIX` | `PREFIXO_DIGEST_INFO_SHA1` |
  | `signedInfoDigestInfo` | `digestInfoDoSignedInfo` |
  | `signPrepared` | `assinarPreparada` |
  | `signXml` | `assinarXml` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `Relogio` | `now` | `agora` |
  | `RelogioManual` | `set` | `ajustar` |
  | `RelogioManual` | `advance` | `avancar` |
  | `ErroSineteOpcoes` | `details` | `detalhes` |
  | `ErroSerializado` | `docs` | `pagina` |
  | `ErroSerializado` | `details` | `detalhes` |
  | `ErroSinete` | `details` | `detalhes` |
  | `ErroSinete` | `docs` | `pagina` |
  | `Ocorrencia` | `path` | `caminho` |
  | `Ocorrencia` | `message` | `mensagem` |
  | `ErroDeValidacao` | `issues` | `ocorrencias` |
  | `EntradaDeLog` | `level` | `nivel` |
  | `EntradaDeLog` | `msg` | `mensagem` |
  | `EntradaDeLog` | `fields` | `campos` |
  | `LoggerEmMemoria` | `entries` | `entradas` |
  | `LoggerEmMemoria` | `clear` | `limpar` |
  | `DicaRejeicao` | `probableCause` | `causaProvavel` |
  | `DicaRejeicao` | `suggestedFix` | `comoCorrigir` |
  | `DicaRejeicao` | `source` | `fonte` |
  | `ResultadoSefaz` | `status` | `tipo` |
  | `Autorizado`, `Denegado` | `value` | `valor` |
  | `Recusado` | `hint` | `dica` |
  | `Pendente` | `ref` | `referencia` |
  | `Pendente` | `retryAfterMs` | `aguardarMs` |
  | `criarPendente` (opções) | `ref` | `referencia` |
  | `criarPendente` (opções) | `retryAfterMs` | `aguardarMs` |
  | `TratadoresDeResultado` | `authorized` | `autorizado` |
  | `TratadoresDeResultado` | `rejected` | `recusado` |
  | `TratadoresDeResultado` | `denied` | `denegado` |
  | `TratadoresDeResultado` | `pending` | `pendente` |
  | `Resultado` | `value` | `valor` |
  | `Resultado` | `error` | `erro` |
  | `ok` (retorno) | `value` | `valor` |
  | `falha` (retorno) | `error` | `erro` |
  | `SignerBase` | `certificateDer` | `certificadoDer` |
  | `ContextoDaAssinatura` | `referenced` | `referenciado` |
  | `AssinadorDeDados`, `AssinadorDeDigest` | `kind` | `tipo` |
  | `AssinadorDeDados` | `sign` | `assinar` |
  | `AssinadorDeDigest` | `signDigestInfo` | `assinarDigestInfo` |
  | `FonteDeDados` | `title` | `titulo` |
  | `FonteDeDados` | `retrievedAt` | `coletadoEm` |
  | `DescricaoTabelaUfs` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoTabelaUfs` | `version` | `versao` |
  | `DescricaoTabelaUfs` | `sources` | `fontes` |
  | `C14nOpcoes` | `exclude` | `excluir` |
  | `AssinaturaEsperada` | `element` | `elemento` |
  | `ConferenciaValida` | `element` | `elemento` |
  | `ConferenciaValida` | `document` | `documento` |
  | `ConferenciaValida` | `certificateDer` | `certificadoDer` |
  | `ConferenciaValida` | `signatureAlgorithm` | `algoritmoDeAssinatura` |
  | `ConferenciaValida` | `digestAlgorithm` | `algoritmoDeDigest` |
  | `ConferenciaInvalida` | `failure` | `motivo` |
  | `ConferenciaInvalida` | `detail` | `detalhe` |
  | `ConferenciaInvalida` | `signedInfoValid` | `signedInfoValido` |
  | `ErroXml` | `offset` | `posicao` |
  | `ErroAssinaturaXml` | `reason` | `motivo` |
  | `AtributoXml`, `ElementoXml` | `name` | `nome` |
  | `AtributoXml`, `ElementoXml` | `prefix` | `prefixo` |
  | `AtributoXml`, `TextoXml` | `value` | `valor` |
  | `NoXml` | `type` | `tipo` |
  | `NoXml` | `start` | `inicio` |
  | `NoXml` | `end` | `fim` |
  | `ElementoXml`, `MutableElement` | `attributes` | `atributos` |
  | `ElementoXml`, `MutableElement` | `children` | `filhos` |
  | `ElementoXml` | `parent` | `pai` |
  | `ElementoXml` | `openEnd` | `fimDaAbertura` |
  | `ElementoXml` | `contentEnd` | `fimDoConteudo` |
  | `ElementoXml` | `selfClosing` | `autoFechado` |
  | `InstrucaoDeProcessamentoXml` | `target` | `alvo` |
  | `InstrucaoDeProcessamentoXml` | `data` | `dados` |
  | `DocumentoXml` | `source` | `texto` |
  | `DocumentoXml` | `root` | `raiz` |
  | `AssinaturaPreparada` | `template` | `modelo` |
  | `AssinaturaPreparada` | `placeholder` | `marcador` |
  | `AssinaturaPreparada` | `insertedAt` | `inseridaEm` |
  | `AssinaturaPreparada` | `referenced` | `referenciado` |
  | `PrepararAssinaturaOpcoes` | `certificateDer` | `certificadoDer` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ResultadoSefaz` | `'authorized'` | `'autorizado'` |
  | `ResultadoSefaz` | `'rejected'` | `'recusado'` |
  | `ResultadoSefaz` | `'denied'` | `'denegado'` |
  | `ResultadoSefaz` | `'pending'` | `'pendente'` |
  | `AssinadorDeDados` | `'data'` | `'dados'` |
  | `TipoAssinador` | `'data'` | `'dados'` |
  | `MotivoFalhaConferencia` | `'parse'` | `'leitura'` |
  | `NoXml` | `'element'` | `'elemento'` |
  | `NoXml` | `'text'` | `'texto'` |
  | `NoXml` | `'pi'` | `'instrucao'` |
  | `MotivoFalhaAssinaturaXml` | `'placeholder-no-documento'` | `'marcador-no-documento'` |
  | `MotivoFalhaAssinaturaXml` | `'placeholder-ausente'` | `'marcador-ausente'` |
  | `ErroSinete` | `'SineteError'` | `'ErroSinete'` |
  | `ErroDeConfiguracao` | `'ConfigError'` | `'ErroDeConfiguracao'` |
  | `ErroDeValidacao` | `'ValidationError'` | `'ErroDeValidacao'` |
  | `ErroNaoSuportado` | `'UnsupportedError'` | `'ErroNaoSuportado'` |
  | `ErroServicoNaoOferecido` | `'ServicoNaoOferecidoError'` | `'ErroServicoNaoOferecido'` |
  | `ErroDeTempoEsgotado` | `'TimeoutError'` | `'ErroDeTempoEsgotado'` |
  | `ErroRespostaInvalida` | `'ProtocolError'` | `'ErroRespostaInvalida'` |
  | `ErroSefaz` | `'SefazError'` | `'ErroSefaz'` |
  | `ErroXml` | `'XmlError'` | `'ErroXml'` |
  | `ErroAssinaturaXml` | `'XmlSignatureError'` | `'ErroAssinaturaXml'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/ufs.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/ufs.json` | `version` | `versao` |
  | `data/ufs.json` | `sources` | `fontes` |
  | `data/ufs.json` | `title` | `titulo` |
  | `data/ufs.json` | `retrievedAt` | `coletadoEm` |
  | `data/ie.json` | `title` | `titulo` |
  | `data/ie.json` | `retrievedAt` | `coletadoEm` |
  | `data/rejeicoes.json` | `title` | `titulo` |
  | `data/rejeicoes.json` | `retrievedAt` | `coletadoEm` |
  | `data/rejeicoes-mdfe.json` | `title` | `titulo` |
  | `data/rejeicoes-mdfe.json` | `retrievedAt` | `coletadoEm` |
  | `data/nfse-erros.json` | `title` | `titulo` |
  | `data/nfse-erros.json` | `retrievedAt` | `coletadoEm` |
  | `data/cstat.json` | `probableCause` | `causaProvavel` |
  | `data/cstat.json` | `suggestedFix` | `comoCorrigir` |
  | `data/cstat.json` | `source` | `fonte` |
  
  Também mudam nesta versão:
  
  - Chaves de `detalhes`: `issues` → `ocorrencias` (`ErroDeValidacao`), `reason` → `motivo` e `offset` → `posicao` (`ErroXml`, `ErroAssinaturaXml`), `instant` → `instante` (relógios), `offsetMinutes` → `deslocamentoMin` (`formatarDataHoraComFuso`), `status` → `tipo` (`ErroSefaz`).
  - A mensagem do `ErroXml` diz `(posição N)`.
  - Parâmetros: `criarAutorizado(resposta, valor)`, `criarRecusado(resposta, dica?)`, `criarDenegado(resposta, valor)`, `criarPendente(resposta, opcoes?)`, `tratarResultado(o, tratadores)`, `ok(valor)`, `falha(erro)`, `eh*(valor)`, `lerXml(texto)`, `relogioManual(inicio)`, `c14n(el, opcoes?)`, `assinarXml(xml, opcoes, assinador)`.
  - `src/data/ufs.json`: `notes` → `notas`.
  - `ProtocolError` virou `ErroRespostaInvalida` (o `code` continua `resposta_invalida`), e `SineteError.docs` virou `ErroSinete.pagina`. Os métodos e níveis do `Logger` (`debug`, `info`, `warn`, `error`, `child`) ficam em inglês (exceção 3 do ADR 0015).
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - O `name` do `ErroDa` passa a ser `'ErroDa'`.
  - `detalhes` dos erros: `ecc` → `nivelDeCorrecao` (QR Code grande demais) e `use` → `usar` (DANFE NFC-e de um modelo 55).
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `DanfeError` | `ErroDa` |
  | `DanfeErrorCode` | `CodigoErroDa` |
  | `QrEcc` | `NivelCorrecaoQr` |
  | `QrOptions` | `QrOpcoes` |
  | `qrMatrix` | `matrizQr` |
  | `BobinaOptions` | `BobinaOpcoes` |
  | `CommonOptions` | `DaOpcoes` |
  | `DacceOptions` | `DacceOpcoes` |
  | `DamdfeOptions` | `DamdfeOpcoes` |
  | `DanfeA4Options` | `DanfeA4Opcoes` |
  | `DanfseOptions` | `DanfseOpcoes` |
  | `SimplificadoOptions` | `SimplificadoOpcoes` |
  | `DanfceOptions` | `DanfceOpcoes` |
  | `DanfeOptions` | `DanfeOpcoes` |
  | `BarsOp` | `OpBarras` |
  | `Doc` | `Documento` |
  | `DocImage` | `ImagemDoDocumento` |
  | `FitStats` | `EstatisticasDeEncaixe` |
  | `FontName` | `NomeDaFonte` |
  | `ImageOp` | `OpImagem` |
  | `LineOp` | `OpLinha` |
  | `Page` | `Pagina` |
  | `QrOp` | `OpQr` |
  | `RectOp` | `OpRetangulo` |
  | `TextOp` | `OpTexto` |
  | `toHtml` | `gerarHtml` |
  | `toSvg` | `gerarSvg` |
  | `PdfOptions` | `PdfOpcoes` |
  | `toPdf` | `gerarPdf` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ErroDa` | `constructor.options` | `constructor.opcoes` |
  | `code128C` | `digits` | `digitos` |
  | `QrOpcoes` | `ecc` | `nivelDeCorrecao` |
  | `QrOpcoes` | `mask` | `mascara` |
  | `matrizQr` | `text` | `texto` |
  | `matrizQr`, `gerarPdf`, `danfe`, `danfce`, `damdfe` e mais 2 | `options` | `opcoes` |
  | `OpBarras` | `module` | `modulo` |
  | `OpBarras` | `widths` | `larguras` |
  | `Documento` | `title` | `titulo` |
  | `Documento` | `pages` | `paginas` |
  | `Documento` | `images` | `imagens` |
  | `Documento` | `stats` | `estatisticas` |
  | `ImagemDoDocumento` | `format` | `formato` |
  | `ImagemDoDocumento` | `width` | `largura` |
  | `ImagemDoDocumento` | `height` | `altura` |
  | `OpImagem` | `ref` | `imagem` |
  | `OpLinha`, `OpRetangulo` | `dash` | `tracejado` |
  | `OpLinha`, `OpTexto` | `gray` | `cinza` |
  | `OpQr`, `OpTexto` | `size` | `tamanho` |
  | `OpQr` | `modules` | `modulos` |
  | `OpRetangulo` | `stroke` | `contorno` |
  | `OpRetangulo` | `fill` | `preenchimento` |
  | `OpTexto` | `font` | `fonte` |
  | `OpTexto` | `rot` | `rotacao` |
  | `gerarHtml`, `gerarSvg`, `gerarPdf` | `doc` | `documento` |
  | `gerarSvg` | `page` | `pagina` |
  | `PdfOpcoes` | `compress` | `comprimir` |
  | `PdfOpcoes` | `info` | `informacoes` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `OpBarras` | `'bars'` | `'barras'` |
  | `OpImagem` | `'image'` | `'imagem'` |
  | `OpLinha` | `'line'` | `'linha'` |
  | `OpRetangulo` | `'rect'` | `'retangulo'` |
  | `OpTexto` | `'text'` | `'texto'` |
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
- 84080ad: O subpath `/bundled` passa a `/embarcado` (ADR 0015, fase 3): `@sinete/ibs-cbs-dados/embarcado` e `sinete/ibs-cbs-dados/embarcado`. Sem alias: quem importa o subpath antigo troca o caminho ao atualizar.
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
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `ActorClassTribRecord` | `RegistroAtorClassTrib` |
  | `ActorGroupRecord` | `RegistroGrupoDeAtores` |
  | `ActorRecord` | `RegistroAtor` |
  | `ActorRole` | `PapelDoAtor` |
  | `AnnexRecord` | `RegistroAnexo` |
  | `ApplicabilityRecord` | `RegistroAplicabilidade` |
  | `ByTributo` | `PorTributo` |
  | `CbsTransferRecord` | `RegistroTransferenciaCbs` |
  | `ClassTribCredit` | `CreditoClassTrib` |
  | `ClassTribGroups` | `GruposClassTrib` |
  | `ClassTribLegal` | `BaseLegalClassTrib` |
  | `ClassTribRecord` | `RegistroClassTrib` |
  | `CredPresCalculation` | `CalculoCredPres` |
  | `CredPresGroups` | `GruposCredPres` |
  | `CredPresRates` | `AliquotasCredPres` |
  | `CredPresRecord` | `RegistroCredPres` |
  | `CstGroups` | `GruposCst` |
  | `CstRecord` | `RegistroCst` |
  | `DataSource` | `FonteDoDataset` |
  | `DatasetBundle` | `BundleDoDataset` |
  | `DatasetManifest` | `ManifestoDoDataset` |
  | `DatasetTables` | `TabelasDoDataset` |
  | `DfeLink` | `VinculoDfe` |
  | `DfeTypeRecord` | `RegistroTipoDfe` |
  | `Family` | `Familia` |
  | `FixedRateRecord` | `RegistroAliquotaFixa` |
  | `GovPurchaseReducerRecord` | `RegistroRedutorCompraGov` |
  | `Indicator` | `Indicador` |
  | `IsoDate` | `DataIso` |
  | `LegalBasis` | `BaseLegal` |
  | `NfseNbsRecord` | `RegistroNfseNbs` |
  | `Nomenclature` | `Nomenclatura` |
  | `PrefixException` | `ExcecaoDePrefixo` |
  | `RateKind` | `TipoDeAliquota` |
  | `ReductionRecord` | `RegistroReducao` |
  | `SourceId` | `IdDaFonte` |
  | `TableManifest` | `ManifestoDaTabela` |
  | `TableName` | `NomeDaTabela` |
  | `TreatmentExpressions` | `ExpressoesDoTratamento` |
  | `TreatmentFlags` | `IndicadoresDoTratamento` |
  | `TreatmentLink` | `VinculoTratamento` |
  | `TreatmentRecord` | `RegistroTratamento` |
  | `Validity` | `Vigencia` |
  | `ActorFilter` | `FiltroDeAtores` |
  | `ClassTribFilter` | `FiltroClassTrib` |
  | `CredPresInForce` | `CredPresVigente` |
  | `DATA_SCHEMA_VERSION` | `VERSAO_DO_FORMATO_DOS_DADOS` |
  | `IbsCbsDataset` | `DatasetIbsCbs` |
  | `TABLE_NAMES` | `NOMES_DAS_TABELAS` |
  | `TaxContent` | `ConteudoTributario` |
  | `contentVersionOf` | `versaoDoConteudo` |
  | `loadDataset` | `carregarDataset` |
  | `verifyDataset` | `conferirDataset` |
  | `Applicability` | `Aplicabilidade` |
  | `ApplicabilityResult` | `ResultadoAplicabilidade` |
  | `applicability` | `aplicabilidade` |
  | `canonicalJson` | `jsonCanonico` |
  | `canonicalTable` | `tabelaCanonica` |
  | `BRASILIA_OFFSET_MINUTES` | `DESLOCAMENTO_BRASILIA_MIN` |
  | `civilDate` | `dataCivil` |
  | `inForce` | `vigente` |
  | `isIsoDate` | `ehDataIso` |
  | `requireIsoDate` | `exigirDataIso` |
  | `ChangeKind` | `TipoDeMudanca` |
  | `DatasetDiff` | `DiferencaDeDatasets` |
  | `FieldChange` | `MudancaDeCampo` |
  | `RecordChange` | `MudancaDeRegistro` |
  | `TableDiff` | `DiferencaDeTabela` |
  | `changeKind` | `tipoDeMudanca` |
  | `diffDatasets` | `compararDatasets` |
  | `formatDiff` | `formatarDiferenca` |
  | `IbsCbsDataError` | `ErroDadosIbsCbs` |
  | `IbsCbsDataErrorCode` | `CodigoErroDadosIbsCbs` |
  | `BUNDLED_DATASET` | `DATASET_EMBARCADO` |
  | `bundledDataset` | `datasetEmbarcado` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `DatasetIbsCbs` | `at.date` | `em.data` |
  | `ConteudoTributario` | `cst.code` | `cst.codigo` |
  | `ConteudoTributario` | `cst.family` | `cst.familia` |
  | `ConteudoTributario` | `classTrib.code` | `classTrib.codigo` |
  | `ConteudoTributario` | `classTrib.family` | `classTrib.familia` |
  | `ConteudoTributario` | `classTribs.filter` | `classTribs.filtro` |
  | `ConteudoTributario` | `credPres.code` | `credPres.codigo` |
  | `ConteudoTributario` | `byActors.filter` | `porAtores.filtro` |
  | `DiferencaDeDatasets` | `from.dataVersion` | `de.versaoDosDados` |
  | `DiferencaDeDatasets` | `from.sources` | `de.fontes` |
  | `DiferencaDeDatasets` | `to.dataVersion` | `para.versaoDosDados` |
  | `DiferencaDeDatasets` | `to.sources` | `para.fontes` |
  | `ErroDadosIbsCbs` | `constructor.options` | `constructor.opcoes` |
  | `ResultadoAplicabilidade` | `result` | `resultado` |
  | `ResultadoAplicabilidade` | `matched` | `casou` |
  | `ResultadoAplicabilidade` | `excludedBy` | `excluidoPor` |
  | `aplicabilidade` | `links` | `vinculos` |
  | `aplicabilidade`, `RegistroClassTrib`, `RegistroCredPres`, `RegistroCst` | `code` | `codigo` |
  | `aplicabilidade`, `vigente`, `FonteDoDataset` | `date` | `data` |
  | `aplicabilidade` | `fullLength` | `tamanhoCompleto` |
  | `jsonCanonico`, `ehDataIso`, `exigirDataIso` | `value` | `valor` |
  | `tabelaCanonica`, `ManifestoDaTabela` | `records` | `registros` |
  | `FiltroDeAtores` | `supplier` | `fornecedor` |
  | `FiltroDeAtores` | `buyer` | `adquirente` |
  | `FiltroClassTrib`, `RegistroAplicabilidade`, `RegistroClassTrib`, `RegistroCst` | `family` | `familia` |
  | `CredPresVigente` | `record` | `registro` |
  | `DatasetIbsCbs`, `versaoDoConteudo`, `BundleDoDataset` | `manifest` | `manifesto` |
  | `DatasetIbsCbs`, `DiferencaDeDatasets`, `BundleDoDataset`, `ManifestoDoDataset` | `tables` | `tabelas` |
  | `DatasetIbsCbs` | `contentVersion` | `versaoDoConteudo` |
  | `DatasetIbsCbs` | `at` | `em` |
  | `ConteudoTributario` | `asOf` | `dataDeReferencia` |
  | `ConteudoTributario` | `cstOf` | `cstDe` |
  | `ConteudoTributario`, `VinculoTratamento` | `treatment` | `tratamento` |
  | `ConteudoTributario` | `reduction` | `reducao` |
  | `ConteudoTributario` | `fixedRate` | `aliquotaFixa` |
  | `ConteudoTributario` | `allowedIn` | `permitidoEm` |
  | `ConteudoTributario` | `applicableNcm` | `ncmAplicavel` |
  | `ConteudoTributario` | `applicableNbs` | `nbsAplicavel` |
  | `ConteudoTributario` | `byActors` | `porAtores` |
  | `ConteudoTributario`, `RegistroAtorClassTrib` | `actor` | `ator` |
  | `ConteudoTributario`, `RegistroAnexo`, `RegistroClassTrib` | `annex` | `anexo` |
  | `ConteudoTributario` | `dfeType` | `tipoDfe` |
  | `ConteudoTributario`, `TabelasDoDataset` | `govPurchaseReducer` | `redutorCompraGov` |
  | `ConteudoTributario` | `cbsTransferPercent` | `percentualTransferenciaCbs` |
  | `dataCivil` | `instant` | `instante` |
  | `dataCivil` | `offsetMinutes` | `deslocamentoMin` |
  | `vigente`, `RegistroAtorClassTrib`, `RegistroGrupoDeAtores`, `RegistroAtor`, `RegistroAnexo` e mais 14 | `validity` | `vigencia` |
  | `exigirDataIso` | `what` | `oQue` |
  | `DiferencaDeDatasets`, `MudancaDeCampo` | `from` | `de` |
  | `DiferencaDeDatasets`, `MudancaDeCampo` | `to` | `para` |
  | `DiferencaDeDatasets` | `schemaChanged` | `formatoMudou` |
  | `DiferencaDeDatasets` | `unchanged` | `inalteradas` |
  | `MudancaDeCampo`, `tipoDeMudanca` | `path` | `caminho` |
  | `MudancaDeCampo`, `FonteDoDataset` | `kind` | `tipo` |
  | `MudancaDeRegistro`, `RegistroAtorClassTrib`, `RegistroGrupoDeAtores`, `RegistroAtor`, `RegistroAnexo` e mais 9 | `key` | `chave` |
  | `MudancaDeRegistro` | `fields` | `campos` |
  | `DiferencaDeTabela` | `table` | `tabela` |
  | `DiferencaDeTabela` | `added` | `incluidos` |
  | `DiferencaDeTabela` | `removed` | `removidos` |
  | `DiferencaDeTabela` | `changed` | `alterados` |
  | `DiferencaDeTabela` | `kinds` | `tipos` |
  | `formatarDiferenca` | `diff` | `diferenca` |
  | `formatarDiferenca` | `limit` | `limite` |
  | `RegistroAtorClassTrib` | `role` | `papel` |
  | `RegistroAtorClassTrib`, `RegistroAplicabilidade`, `RegistroNfseNbs` | `classTribKey` | `chaveClassTrib` |
  | `RegistroGrupoDeAtores`, `RegistroAtor`, `RegistroAnexo`, `RegistroClassTrib`, `RegistroCredPres` e mais 3 | `description` | `descricao` |
  | `RegistroGrupoDeAtores`, `RegistroAtor` | `order` | `ordem` |
  | `RegistroAtor` | `group` | `grupo` |
  | `RegistroAnexo`, `BaseLegal` | `text` | `texto` |
  | `RegistroAplicabilidade`, `ExcecaoDePrefixo` | `prefix` | `prefixo` |
  | `RegistroAplicabilidade` | `annexItem` | `itemDoAnexo` |
  | `RegistroAplicabilidade` | `exceptions` | `excecoes` |
  | `RegistroTransferenciaCbs` | `percent` | `percentual` |
  | `CreditoClassTrib` | `buyerCbs` | `adquirenteCbs` |
  | `CreditoClassTrib` | `buyerIbs` | `adquirenteIbs` |
  | `CreditoClassTrib` | `presumedSupplier` | `presumidoFornecedor` |
  | `CreditoClassTrib` | `presumedBuyer` | `presumidoAdquirente` |
  | `CreditoClassTrib` | `priorOperation` | `operacaoAnterior` |
  | `BaseLegalClassTrib` | `link` | `url` |
  | `BaseLegalClassTrib` | `basis` | `fundamento` |
  | `RegistroClassTrib`, `ManifestoDaTabela` | `name` | `nome` |
  | `RegistroClassTrib` | `rateKind` | `tipoDeAliquota` |
  | `RegistroClassTrib` | `nomenclature` | `nomenclatura` |
  | `RegistroClassTrib` | `credit` | `credito` |
  | `RegistroClassTrib`, `RegistroCredPres`, `RegistroCst` | `groups` | `grupos` |
  | `RegistroClassTrib`, `TabelasDoDataset` | `treatments` | `tratamentos` |
  | `RegistroClassTrib` | `reductions` | `reducoes` |
  | `RegistroClassTrib` | `fixedRates` | `aliquotasFixas` |
  | `RegistroClassTrib` | `updatedAt` | `atualizadoEm` |
  | `RegistroClassTrib`, `RegistroCredPres`, `RegistroCst`, `ManifestoDoDataset` | `sources` | `fontes` |
  | `CalculoCredPres` | `impediment` | `impedimento` |
  | `RegistroCredPres` | `viaDocument` | `viaDocumento` |
  | `RegistroCredPres` | `viaEvent` | `viaEvento` |
  | `RegistroCredPres` | `deductsFromTax` | `deduzDoTributo` |
  | `RegistroCredPres` | `rates` | `aliquotas` |
  | `RegistroCredPres` | `referencedClassTrib` | `classTribReferenciado` |
  | `RegistroCredPres` | `calculation` | `calculo` |
  | `FonteDoDataset` | `title` | `titulo` |
  | `FonteDoDataset` | `version` | `versao` |
  | `FonteDoDataset` | `notes` | `notas` |
  | `ManifestoDoDataset` | `dataSchemaVersion` | `versaoDoFormato` |
  | `ManifestoDoDataset` | `dataVersion` | `versaoDosDados` |
  | `ManifestoDoDataset` | `knownAt` | `conhecidoEm` |
  | `ManifestoDoDataset` | `datasetSha256` | `sha256DoDataset` |
  | `TabelasDoDataset` | `ncmApplicability` | `aplicabilidadeNcm` |
  | `TabelasDoDataset` | `nbsApplicability` | `aplicabilidadeNbs` |
  | `TabelasDoDataset` | `annexes` | `anexos` |
  | `TabelasDoDataset` | `actorGroups` | `gruposDeAtores` |
  | `TabelasDoDataset` | `actors` | `atores` |
  | `TabelasDoDataset` | `actorClassTrib` | `atorClassTrib` |
  | `TabelasDoDataset` | `dfeTypes` | `tiposDfe` |
  | `TabelasDoDataset` | `cbsTransfer` | `transferenciaCbs` |
  | `RegistroAliquotaFixa` | `rate` | `aliquota` |
  | `BaseLegal` | `short` | `resumo` |
  | `BaseLegal` | `reference` | `referencia` |
  | `RegistroTratamento` | `expr` | `expressao` |
  | `RegistroTratamento` | `flags` | `indicadores` |
  | `Vigencia` | `from` | `inicio` |
  | `Vigencia` | `to` | `fim` |
  | `DiferencaDeDatasets` | `de.datasetSha256` | `de.sha256DoDataset` |
  | `DiferencaDeDatasets` | `para.datasetSha256` | `para.sha256DoDataset` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `Aplicabilidade` | `'yes'` | `'sim'` |
  | `Aplicabilidade` | `'no'` | `'nao'` |
  | `Aplicabilidade` | `'not-restricted'` | `'sem-restricao'` |
  | `Aplicabilidade` | `'incomplete'` | `'incompleta'` |
  | `Indicador` | `'required'` | `'obrigatorio'` |
  | `Indicador` | `'allowed'` | `'permitido'` |
  | `Indicador` | `'forbidden'` | `'vedado'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/classTrib.json`, `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json` e mais 10 | `validity` | `vigencia` |
  | `data/classTrib.json` | `rate` | `aliquota` |
  | `data/classTrib.json` | `treatment` | `tratamento` |
  | `data/classTrib.json` | `reference` | `referencia` |
  | `data/classTrib.json` | `short` | `resumo` |
  | `data/classTrib.json`, `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json` e mais 10 | `text` | `texto` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `from` | `inicio` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `to` | `fim` |
  | `data/classTrib.json` | `buyerCbs` | `adquirenteCbs` |
  | `data/classTrib.json` | `buyerIbs` | `adquirenteIbs` |
  | `data/classTrib.json` | `presumedBuyer` | `presumidoAdquirente` |
  | `data/classTrib.json` | `presumedSupplier` | `presumidoFornecedor` |
  | `data/classTrib.json` | `priorOperation` | `operacaoAnterior` |
  | `data/classTrib.json` | `basis` | `fundamento` |
  | `data/credPres.json` | `impediment` | `impedimento` |
  | `data/manifest.json` | `date` | `data` |
  | `data/manifest.json` | `kind` | `tipo` |
  | `data/manifest.json` | `notes` | `notas` |
  | `data/manifest.json` | `title` | `titulo` |
  | `data/manifest.json` | `version` | `versao` |
  | `data/manifest.json`, `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json` e mais 10 | `name` | `nome` |
  | `data/manifest.json` | `records` | `registros` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `key` | `chave` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `description` | `descricao` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `order` | `ordem` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `group` | `grupo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `annex` | `anexo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `percent` | `percentual` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `code` | `codigo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `family` | `familia` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `credit` | `credito` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `groups` | `grupos` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `fixedRates` | `aliquotasFixas` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `reductions` | `reducoes` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `treatments` | `tratamentos` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `rateKind` | `tipoDeAliquota` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `nomenclature` | `nomenclatura` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `updatedAt` | `atualizadoEm` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `sources` | `fontes` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `actor` | `ator` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `role` | `papel` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `classTribKey` | `chaveClassTrib` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `calculation` | `calculo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `deductsFromTax` | `deduzDoTributo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `rates` | `aliquotas` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `referencedClassTrib` | `classTribReferenciado` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `viaDocument` | `viaDocumento` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `viaEvent` | `viaEvento` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `annexItem` | `itemDoAnexo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `exceptions` | `excecoes` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `prefix` | `prefixo` |
  | `data/manifest.json` | `dataSchemaVersion` | `versaoDoFormato` |
  | `data/manifest.json` | `dataVersion` | `versaoDosDados` |
  | `data/manifest.json` | `datasetSha256` | `sha256DoDataset` |
  | `data/manifest.json` | `knownAt` | `conhecidoEm` |
  | `data/manifest.json` | `tables` | `tabelas` |
  Arquivos de dados renomeados em `src/data/`:
  
  | Antigo | Novo |
  |---|---|
  | `treatments.json` | `tratamentos.json` |
  | `ncmApplicability.json` | `aplicabilidadeNcm.json` |
  | `nbsApplicability.json` | `aplicabilidadeNbs.json` |
  | `annexes.json` | `anexos.json` |
  | `actorGroups.json` | `gruposDeAtores.json` |
  | `actors.json` | `atores.json` |
  | `actorClassTrib.json` | `atorClassTrib.json` |
  | `dfeTypes.json` | `tiposDfe.json` |
  | `govPurchaseReducer.json` | `redutorCompraGov.json` |
  | `cbsTransfer.json` | `transferenciaCbs.json` |
  
  Também mudam nesta versão:
  
  - `VERSAO_DO_FORMATO_DOS_DADOS` (antes `DATA_SCHEMA_VERSION`) sobe para 2: um bundle da 0.1.x é recusado com `ibscbs_dados_versao_incompativel`. Os hashes do `manifest.json` foram recalculados sobre as chaves novas.
  - Os indicadores de grupo passam de `forbidden`, `required` e `allowed` para `vedado`, `obrigatorio` e `permitido`.
  - `name` de cada classe de erro é o nome novo da classe (`ErroDadosIbsCbs`).
  - Chaves de `detalhes`: `dataSchemaVersion` → `versaoDoFormato`, `supported` → `suportada`, `table` → `tabela`, `key` → `chave`, `missing` → `ausentes`, `extra` → `sobrando`, `expected` → `esperado`, `got` → `obtido`, `value` → `valor`.
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `RateUnknownError` | `ErroAliquotaDesconhecida` |
  | `RatesDataError` | `ErroDadosDeAliquotas` |
  | `RATES_SCHEMA_VERSION` | `VERSAO_DO_FORMATO_DAS_ALIQUOTAS` |
  | `RATES_TABLE` | `TABELA_ALIQUOTAS` |
  | `isSimulated` | `ehSimulada` |
  | `officialRates` | `aliquotasOficiais` |
  | `requireRate` | `exigirAliquota` |
  | `withOverrides` | `comAliquotasInformadas` |
  | `IsoDate` | `DataIso` |
  | `NominalRates` | `AliquotasNominais` |
  | `Place` | `Local` |
  | `RATE_TRIBUTOS` | `TRIBUTOS_DAS_ALIQUOTAS` |
  | `Rate` | `Aliquota` |
  | `RateOverride` | `AliquotaInformada` |
  | `RateProvider` | `ProvedorDeAliquotas` |
  | `RateSource` | `FonteDaAliquota` |
  | `RateStatus` | `SituacaoDaAliquota` |
  | `RateTributo` | `TributoDaAliquota` |
  | `RatesTable` | `TabelaDeAliquotas` |
  | `ReferenceRateRecord` | `RegistroAliquotaDeReferencia` |
  | `StandardRateRecord` | `RegistroAliquotaPadrao` |
  | `Validity` | `Vigencia` |
  | `CalculateOptions` | `CalcularOpcoes` |
  | `calculate` | `calcular` |
  | `calculateAt` | `calcularEm` |
  | `ClassificationError` | `ErroClassificacao` |
  | `ClassificationReason` | `MotivoErroClassificacao` |
  | `ExpressionError` | `ErroExpressao` |
  | `UnsupportedRegime` | `RegimeNaoSuportado` |
  | `UnsupportedRegimeError` | `ErroRegimeNaoSuportado` |
  | `EXPRESSION_VARIABLES` | `VARIAVEIS_DAS_EXPRESSOES` |
  | `INTERNAL_SCALE` | `ESCALA_INTERNA` |
  | `Variables` | `Variaveis` |
  | `checkExpression` | `conferirExpressao` |
  | `evaluate` | `avaliar` |
  | `fromPercent` | `dePercentual` |
  | `money` | `dinheiro` |
  | `percent` | `percentual` |
  | `toPercent` | `paraPercentual` |
  | `GovValues` | `ValoresCompraGov` |
  | `REDISTRIBUTION_FROM` | `REDISTRIBUICAO_A_PARTIR_DE` |
  | `enteOf` | `enteDe` |
  | `redistribute` | `redistribuir` |
  | `AppliedRate` | `AliquotaAplicada` |
  | `ClassifiedItem` | `ItemClassificado` |
  | `ClassifiedOperation` | `OperacaoClassificada` |
  | `GovernmentPurchase` | `CompraGovernamental` |
  | `InformedRates` | `AliquotasInformadas` |
  | `OperationPlace` | `LocalDaOperacao` |
  | `PresumedCredit` | `CreditoPresumido` |
  | `PresumedCreditTributo` | `CreditoPresumidoTributo` |
  | `RateOrigin` | `OrigemDaAliquota` |
  | `RegularTaxation` | `TributacaoRegular` |
  | `TraceEntry` | `EntradaDoRastro` |
  | `ZfmPresumedCredit` | `CreditoPresumidoZfm` |
  | `ConstrainOptions` | `RestringirOpcoes` |
  | `ItemConstraints` | `RestricoesDoItem` |
  | `candidateOf` | `candidatoDe` |
  | `constrain` | `restringir` |
  | `constrainAt` | `restringirEm` |
  | `factDate` | `dataDoFato` |
  | `DEFAULT_RESOLVERS` | `RESOLVEDORES_PADRAO` |
  | `DetermineAtOptions` | `DeterminarEmOpcoes` |
  | `DetermineOptions` | `DeterminarOpcoes` |
  | `ItemInput` | `EntradaDoItem` |
  | `OperationInput` | `EntradaDaOperacao` |
  | `askUser` | `perguntarAoUsuario` |
  | `determine` | `determinar` |
  | `determineAt` | `determinarEm` |
  | `fromProfile` | `doPerfil` |
  | `questionId` | `idDaPergunta` |
  | `toClassified` | `paraClassificado` |
  | `uniqueCandidate` | `candidatoUnico` |
  | `DeterminationError` | `ErroDeterminacao` |
  | `DeterminationReason` | `MotivoErroDeterminacao` |
  | `ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR` | `ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE` |
  | `LEGAL_RULES` | `REGRAS_LEGAIS` |
  | `AppliedRule` | `RegraAplicada` |
  | `Candidate` | `Candidato` |
  | `Determination` | `Determinacao` |
  | `Exclusion` | `Exclusao` |
  | `ExclusionReason` | `MotivoDaExclusao` |
  | `ItemDetermination` | `DeterminacaoDoItem` |
  | `ItemFacts` | `FatosDoItem` |
  | `ItemProfile` | `PerfilDoItem` |
  | `LegalOutcome` | `ResultadoRegraLegal` |
  | `LegalRule` | `RegraLegal` |
  | `LegalRuleContext` | `ContextoRegraLegal` |
  | `OperationFacts` | `FatosDaOperacao` |
  | `OperationKind` | `TipoDeOperacao` |
  | `PartyFacts` | `FatosDaParte` |
  | `Provenance` | `Procedencia` |
  | `Question` | `Pergunta` |
  | `QuestionOption` | `OpcaoDaPergunta` |
  | `ResolveContext` | `ContextoDoResolvedor` |
  | `Resolver` | `Resolvedor` |
  | `ResolverOutcome` | `ResultadoDoResolvedor` |
  | `NOT_IMPLEMENTED` | `NAO_IMPLEMENTADAS` |
  | `NT_TABLES` | `TABELAS_NT` |
  | `RULES` | `REGRAS` |
  | `Report` | `Relatar` |
  | `Rule` | `Regra` |
  | `RuleContext` | `ContextoDaRegra` |
  | `Activation` | `Ativacao` |
  | `NotImplemented` | `NaoImplementada` |
  | `NtTables` | `TabelasNt` |
  | `RuleMeta` | `DescricaoDaRegra` |
  | `RulesDocument` | `DocumentoDasRegras` |
  | `RulesItem` | `ItemDasRegras` |
  | `ValidationReport` | `RelatorioDeValidacao` |
  | `Violation` | `Violacao` |
  | `ValidateOptions` | `ValidarOpcoes` |
  | `documentFromRoc` | `documentoDoRoc` |
  | `isActive` | `ativa` |
  | `validate` | `validar` |
  | `ItemResult` | `ResultadoDoItem` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ProvedorDeAliquotas` | `nominal.date` | `nominal.data` |
  | `ProvedorDeAliquotas` | `nominal.place` | `nominal.local` |
  | `ProvedorDeAliquotas` | `reference.date` | `referencia.data` |
  | `ErroDadosDeAliquotas`, `ErroAliquotaDesconhecida`, `ErroClassificacao`, `ErroRegimeNaoSuportado`, `ErroDeterminacao` | `constructor.options` | `constructor.opcoes` |
  | `ErroAliquotaDesconhecida` | `constructor.date` | `constructor.data` |
  | `ErroClassificacao`, `ErroDeterminacao` | `constructor.reason` | `constructor.motivo` |
  | `calcularEm` | `options.rates` | `opcoes.aliquotas` |
  | `calcularEm` | `options.date` | `opcoes.data` |
  | `ErroExpressao` | `constructor.expression` | `constructor.expressao` |
  | `DeterminacaoDoItem` | `decided.candidate` | `decidido.candidato` |
  | `DeterminacaoDoItem` | `decided.provenance` | `decidido.procedencia` |
  | `RegraLegal` | `validity.from` | `vigencia.inicio` |
  | `RegraLegal` | `validity.to` | `vigencia.fim` |
  | `RegraLegal` | `apply.ctx` | `aplicar.contexto` |
  | `Resolvedor` | `resolve.ctx` | `resolver.contexto` |
  | `paraClassificado` | `item.candidate` | `item.candidato` |
  | `TabelasNt` | `source.title` | `fonte.titulo` |
  | `TabelasNt` | `source.version` | `fonte.versao` |
  | `TabelasNt` | `source.published` | `fonte.publicadaEm` |
  | `TabelasNt` | `cbsZeroExcludedNcm.prefixes` | `ncmExcluidosDaCbsZero.prefixos` |
  | `TabelasNt` | `cbsZeroExcludedNcm.allowedWithin` | `ncmExcluidosDaCbsZero.permitidoDentroDe` |
  | `TabelasNt` | `cbsZeroExcludedNcm.note` | `ncmExcluidosDaCbsZero.nota` |
  | `Regra` | `check.ctx` | `conferir.contexto` |
  | `Regra` | `check.report` | `conferir.relatar` |
  | `documentoDoRoc` | `ident.items` | `identificacao.itens` |
  | `Aliquota`, `RegistroAliquotaDeReferencia`, `AliquotaAplicada` | `status` | `situacao` |
  | `Aliquota`, `AliquotaInformada`, `AliquotaAplicada`, `dePercentual`, `dinheiro`, `percentual` | `value` | `valor` |
  | `Aliquota`, `TabelaDeAliquotas`, `RegistroAliquotaDeReferencia`, `RegistroAliquotaPadrao` | `sources` | `fontes` |
  | `Aliquota`, `RegistroAliquotaDeReferencia`, `RegraLegal`, `DescricaoDaRegra` | `note` | `nota` |
  | `Aliquota`, `AliquotaInformada`, `AliquotaAplicada`, `AliquotasInformadas`, `ErroClassificacao` e mais 3 | `reason` | `motivo` |
  | `Aliquota`, `AliquotaInformada`, `RegistroAliquotaDeReferencia`, `RegistroAliquotaPadrao`, `RegraLegal` | `validity` | `vigencia` |
  | `AliquotaInformada`, `OperacaoClassificada`, `EntradaDaOperacao` | `place` | `local` |
  | `AliquotaInformada` | `applies` | `aplicaA` |
  | `AliquotaInformada`, `RegraAplicada`, `Exclusao`, `RegraLegal`, `Procedencia` e mais 3 | `source` | `fonte` |
  | `ProvedorDeAliquotas`, `TabelaDeAliquotas` | `reference` | `referencia` |
  | `FonteDaAliquota`, `RegraLegal`, `DescricaoDaRegra` | `title` | `titulo` |
  | `FonteDaAliquota` | `version` | `versao` |
  | `FonteDaAliquota`, `ErroAliquotaDesconhecida`, `exigirAliquota`, `redistribuir` | `date` | `data` |
  | `TabelaDeAliquotas` | `schemaVersion` | `versaoDoFormato` |
  | `TabelaDeAliquotas` | `dataVersion` | `versaoDosDados` |
  | `TabelaDeAliquotas` | `knownAt` | `conhecidoEm` |
  | `TabelaDeAliquotas` | `standard` | `padrao` |
  | `RegistroAliquotaDeReferencia`, `RegistroAliquotaPadrao`, `exigirAliquota` | `rate` | `aliquota` |
  | `Vigencia` | `from` | `inicio` |
  | `Vigencia` | `to` | `fim` |
  | `ehSimulada`, `CalcularOpcoes`, `RocItem`, `ContextoDaRegra`, `ValidarOpcoes` | `rates` | `aliquotas` |
  | `comAliquotasInformadas` | `overrides` | `informadas` |
  | `AliquotaAplicada` | `origin` | `origem` |
  | `CalcularOpcoes`, `RestringirOpcoes`, `dataDoFato`, `ValidarOpcoes` | `time` | `tempo` |
  | `CalcularOpcoes`, `RestringirOpcoes`, `dataDoFato`, `ValidarOpcoes` | `utcOffsetMinutes` | `deslocamentoMin` |
  | `ItemClassificado` | `quantity` | `quantidade` |
  | `ItemClassificado` | `unit` | `unidade` |
  | `ItemClassificado` | `informedRates` | `aliquotasInformadas` |
  | `ItemClassificado` | `deferral` | `diferimento` |
  | `ItemClassificado` | `taxRefund` | `devolucaoDeTributo` |
  | `ItemClassificado` | `creditTransfer` | `transferenciaDeCredito` |
  | `ItemClassificado` | `competenceAdjustment` | `ajusteDeCompetencia` |
  | `ItemClassificado` | `creditReversal` | `estornoDeCredito` |
  | `ItemClassificado` | `presumedCredit` | `creditoPresumido` |
  | `ItemClassificado` | `zfmCredit` | `creditoZfm` |
  | `ItemClassificado` | `monophase` | `monofasia` |
  | `ItemClassificado` | `selectiveTax` | `impostoSeletivo` |
  | `OperacaoClassificada`, `EntradaDaOperacao` | `governmentPurchase` | `compraGovernamental` |
  | `OperacaoClassificada`, `Roc`, `Determinacao`, `FatosDaOperacao`, `DocumentoDasRegras` | `items` | `itens` |
  | `CreditoPresumido`, `ItemDasRegras` | `usedMovableGood` | `bemMovelUsado` |
  | `CreditoPresumidoTributo` | `conditional` | `condicional` |
  | `Roc`, `Determinacao`, `Procedencia` | `asOf` | `dataDeReferencia` |
  | `Roc`, `RocItem` | `simulated` | `simulado` |
  | `Roc`, `Determinacao`, `Procedencia` | `contentVersion` | `versaoDoConteudo` |
  | `Roc` | `ratesId` | `idDasAliquotas` |
  | `Roc` | `trace` | `rastro` |
  | `EntradaDoRastro` | `field` | `campo` |
  | `EntradaDoRastro` | `inputs` | `entradas` |
  | `EntradaDoRastro` | `result` | `resultado` |
  | `calcular`, `calcularEm`, `Pergunta`, `restringir`, `determinar` e mais 2 | `options` | `opcoes` |
  | `conferirExpressao`, `avaliar` | `expr` | `expressao` |
  | `ErroExpressao` | `expression` | `expressao` |
  | `avaliar` | `vars` | `variaveis` |
  | `redistribuir` | `values` | `valores` |
  | `redistribuir` | `transferFraction` | `fracaoTransferida` |
  | `paraPercentual` | `fraction` | `fracao` |
  | `RegraAplicada`, `Violacao`, `ativa` | `rule` | `regra` |
  | `RegraAplicada`, `ResultadoRegraLegal` | `codes` | `codigos` |
  | `RegraAplicada` | `conflict` | `conflito` |
  | `Candidato`, `Procedencia`, `Resolvedor` | `name` | `nome` |
  | `Candidato`, `FatosDoItem` | `description` | `descricao` |
  | `Candidato` | `link` | `url` |
  | `Candidato` | `requiresRegular` | `exigeRegular` |
  | `Determinacao` | `complete` | `completa` |
  | `DeterminarEmOpcoes`, `DeterminacaoDoItem`, `ValidarOpcoes` | `rules` | `regras` |
  | `DeterminarEmOpcoes` | `resolvers` | `resolvedores` |
  | `DeterminarEmOpcoes`, `ContextoDoResolvedor` | `answers` | `respostas` |
  | `DeterminarEmOpcoes`, `DeterminarOpcoes` | `clock` | `relogio` |
  | `Exclusao` | `detail` | `detalhe` |
  | `RestricoesDoItem`, `DeterminacaoDoItem`, `ContextoDoResolvedor` | `candidates` | `candidatos` |
  | `RestricoesDoItem`, `DeterminacaoDoItem` | `exclusions` | `exclusoes` |
  | `DeterminacaoDoItem` | `decided` | `decidido` |
  | `DeterminacaoDoItem` | `pending` | `pendente` |
  | `FatosDoItem`, `ResultadoRegraLegal`, `FatosDaOperacao`, `ResultadoDoResolvedor` | `kind` | `tipo` |
  | `FatosDoItem` | `referenced` | `referenciado` |
  | `FatosDoItem` | `profile` | `perfil` |
  | `PerfilDoItem` | `decidedBy` | `decididoPor` |
  | `RegraLegal` | `apply` | `aplicar` |
  | `ContextoRegraLegal`, `ContextoDoResolvedor`, `restringir`, `restringirEm`, `determinar`, `determinarEm` | `facts` | `fatos` |
  | `ContextoRegraLegal`, `ContextoDoResolvedor`, `candidatoDe`, `restringirEm`, `determinarEm`, `ContextoDaRegra` | `content` | `conteudo` |
  | `FatosDaOperacao` | `supplier` | `fornecedor` |
  | `FatosDaOperacao` | `buyer` | `adquirente` |
  | `FatosDaParte` | `actors` | `atores` |
  | `Procedencia` | `by` | `por` |
  | `Procedencia` | `at` | `em` |
  | `Procedencia`, `ResultadoDoResolvedor` | `confidence` | `confianca` |
  | `Procedencia`, `ResultadoDoResolvedor` | `evidence` | `evidencia` |
  | `Pergunta` | `text` | `texto` |
  | `OpcaoDaPergunta` | `label` | `rotulo` |
  | `Resolvedor` | `resolve` | `resolver` |
  | `ResultadoDoResolvedor` | `questions` | `perguntas` |
  | `TabelasNt` | `classTribByNoteType` | `classTribPorTipoDeNota` |
  | `TabelasNt` | `ratesByEmissionYear` | `aliquotasPorAnoDeEmissao` |
  | `TabelasNt` | `incentivizedAreas` | `areasIncentivadas` |
  | `TabelasNt` | `cbsZeroExcludedNcm` | `ncmExcluidosDaCbsZero` |
  | `Regra` | `check` | `conferir` |
  | `ContextoDaRegra`, `ativa`, `validar` | `doc` | `documento` |
  | `ContextoDaRegra`, `ativa` | `emission` | `emissao` |
  | `DescricaoDaRegra` | `activation` | `ativacao` |
  | `DocumentoDasRegras` | `referencedEmission` | `emissaoReferenciada` |
  | `DocumentoDasRegras` | `emitMun` | `munEmitente` |
  | `DocumentoDasRegras` | `destMun` | `munDestinatario` |
  | `ItemDasRegras` | `monophasicFuel` | `combustivelMonofasico` |
  | `ValidarOpcoes` | `ignoreActivation` | `ignorarAtivacao` |
  | `RelatorioDeValidacao` | `violations` | `violacoes` |
  | `RelatorioDeValidacao` | `evaluated` | `avaliadas` |
  | `RelatorioDeValidacao` | `inactive` | `inativas` |
  | `RelatorioDeValidacao` | `emissionDate` | `dataDaEmissao` |
  | `RelatorioDeValidacao` | `factDate` | `dataDoFato` |
  | `documentoDoRoc` | `ident` | `identificacao` |
  | `TabelasNt` | `tpNFDebito.code` | `tpNFDebito.codigo` |
  | `TabelasNt` | `tpNFDebito.description` | `tpNFDebito.descricao` |
  | `TabelasNt` | `tpNFCredito.code` | `tpNFCredito.codigo` |
  | `TabelasNt` | `tpNFCredito.description` | `tpNFCredito.descricao` |
  | `TabelasNt` | `aliquotasPorAnoDeEmissao.from` | `aliquotasPorAnoDeEmissao.inicio` |
  | `TabelasNt` | `aliquotasPorAnoDeEmissao.to` | `aliquotasPorAnoDeEmissao.fim` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `AliquotaInformada` | `'reference'` | `'referencia'` |
  | `AliquotaInformada` | `'both'` | `'ambas'` |
  | `SituacaoDaAliquota` | `'official'` | `'oficial'` |
  | `SituacaoDaAliquota` | `'user-provided'` | `'informada'` |
  | `SituacaoDaAliquota` | `'unknown'` | `'desconhecida'` |
  | `OrigemDaAliquota` | `'provider-nominal'` | `'provedor-nominal'` |
  | `OrigemDaAliquota` | `'provider-reference'` | `'provedor-referencia'` |
  | `OrigemDaAliquota` | `'dataset-fixed'` | `'dataset-fixa'` |
  | `OrigemDaAliquota` | `'informed'` | `'informada'` |
  | `OrigemDaAliquota` | `'no-rate'` | `'sem-aliquota'` |
  | `Procedencia` | `'rule'` | `'regra'` |
  | `Procedencia` | `'resolver'` | `'resolvedor'` |
  | `Procedencia` | `'user'` | `'usuario'` |
  | `ResultadoDoResolvedor` | `'decided'` | `'decidido'` |
  | `ResultadoDoResolvedor` | `'ask'` | `'perguntar'` |
  | `ResultadoDoResolvedor` | `'abstain'` | `'abster'` |
  | `ResultadoRegraLegal` | `'restrict'` | `'restringir'` |
  | `ResultadoRegraLegal` | `'none'` | `'nenhum'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `from` | `inicio` |
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `to` | `fim` |
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `note` | `nota` |
  | `aliquotas/data/rates.json` | `rate` | `aliquota` |
  | `aliquotas/data/rates.json` | `sources` | `fontes` |
  | `aliquotas/data/rates.json` | `status` | `situacao` |
  | `aliquotas/data/rates.json` | `validity` | `vigencia` |
  | `aliquotas/data/rates.json` | `date` | `data` |
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `title` | `titulo` |
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `version` | `versao` |
  | `validar/data/nt2025002.json` | `allowedWithin` | `permitidoDentroDe` |
  | `validar/data/nt2025002.json` | `prefixes` | `prefixos` |
  | `validar/data/nt2025002.json` | `published` | `publicadaEm` |
  | `validar/data/nt2025002.json` | `code` | `codigo` |
  | `validar/data/nt2025002.json` | `description` | `descricao` |
  | `aliquotas/data/rates.json` | `dataVersion` | `versaoDosDados` |
  | `aliquotas/data/rates.json` | `knownAt` | `conhecidoEm` |
  | `aliquotas/data/rates.json` | `reference` | `referencia` |
  | `aliquotas/data/rates.json` | `schemaVersion` | `versaoDoFormato` |
  | `aliquotas/data/rates.json` | `standard` | `padrao` |
  | `validar/data/nt2025002.json` | `cbsZeroExcludedNcm` | `ncmExcluidosDaCbsZero` |
  | `validar/data/nt2025002.json` | `classTribByNoteType` | `classTribPorTipoDeNota` |
  | `validar/data/nt2025002.json` | `incentivizedAreas` | `areasIncentivadas` |
  | `validar/data/nt2025002.json` | `ratesByEmissionYear` | `aliquotasPorAnoDeEmissao` |
  | `validar/data/nt2025002.json` | `source` | `fonte` |
  Também mudam nesta versão:
  
  - `src/aliquotas/data/rates.json`: além das chaves, `situacao` passa a `oficial` e `desconhecida`, e `VERSAO_DO_FORMATO_DAS_ALIQUOTAS` (antes `RATES_SCHEMA_VERSION`) sobe para 2.
  - Alíquota informada por `comAliquotasInformadas` sai com `situacao: 'informada'` (antes `status: 'user-provided'`), e a fonte dela é `'usuario'` (antes `'user'`).
  - `name` de cada classe de erro é o nome novo da classe (`ErroClassificacao`, `ErroDeterminacao`, `ErroAliquotaDesconhecida`...).
  - Chaves de `detalhes`: `reason` → `motivo`, `date` → `data`, `expression` → `expressao`.
  - `Candidato` e `BaseLegalClassTrib`: `link` → `url`.
  - Parâmetros: `dec(texto)`, `sum(valores)`.
  - `Decimal` e seus métodos, e o modo `'HALF_EVEN'`, ficam em inglês (exceção 3 do ADR 0015).
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - `montarMdfe` passa a ser assíncrona e devolve `Promise<ResultadoMontagemMdfe>`, como a `montarNfe` e a `montarDps` (ADR 0009, emenda de 30/set/2026). Quem chamava sem `await` passa a receber uma `Promise`.
  - O `Decimal` próprio do pacote fica em inglês (ADR 0015, exceção 3).
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `BuildMdfeOptions` | `MontarMdfeOpcoes` |
  | `BuildMdfeResult` | `ResultadoMontagemMdfe` |
  | `BuiltMdfe` | `MdfeMontado` |
  | `buildMdfe` | `montarMdfe` |
  | `signMdfe` | `assinarMdfe` |
  | `DecimalFormat` | `FormatoDecimal` |
  | `MdfeIssueCode` | `CodigoOcorrenciaMdfe` |
  | `MDFE_ISSUE_CODES` | `CODIGOS_OCORRENCIA_MDFE` |
  | `MdfeInput` | `DadosMdfe` |
  | `AutorizacaoOutcome` | `ResultadoAutorizacao` |
  | `ConsultaOutcome` | `ResultadoConsulta` |
  | `EventoOutcome` | `ResultadoEvento` |
  | `MdfeClient` | `ClienteMdfe` |
  | `MdfeClientOptions` | `ClienteMdfeOpcoes` |
  | `OpcoesEnvio` | `EnvioOpcoes` |
  | `createMdfeClient` | `criarClienteMdfe` |
  | `gunzipBase64` | `descomprimirGzipBase64` |
  | `gzipBase64` | `comprimirGzipBase64` |
  | `sliceElement` | `recortarElemento` |
  | `offsetDaUf` | `deslocamentoDaUf` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `pagamentosDoLeiaute` | `@retorno.issues` | `@retorno.ocorrencias` |
  | `MontarMdfeOpcoes` | `time` | `tempo` |
  | `MontarMdfeOpcoes`, `ClienteMdfeOpcoes` | `offsetMinutes` | `deslocamentoMin` |
  | `MontarMdfeOpcoes` | `random` | `aleatorio` |
  | `ResultadoMontagemMdfe` | `value` | `valor` |
  | `ResultadoMontagemMdfe` | `issues` | `ocorrencias` |
  | `assinaturaQrCode`, `assinarMdfe`, `ClienteMdfeOpcoes` | `signer` | `assinador` |
  | `montarMdfe` | `input` | `entrada` |
  | `montarMdfe`, `ClienteMdfe` | `options` | `opcoes` |
  | `comQrCode`, `assinarMdfe` | `built` | `manifesto` |
  | `comQrCode`, `qrCodeMdfe` | `sign` | `assinatura` |
  | `pagamentosDoLeiaute`, `rotuloDoCaminho` | `path` | `caminho` |
  | `FormatoDecimal` | `name` | `nome` |
  | `FormatoDecimal` | `intDigits` | `digitosInteiros` |
  | `FormatoDecimal` | `nonZero` | `naoNulo` |
  | `dec` | `input` | `valor` |
  | `sum` | `values` | `valores` |
  | `DocumentoAssinado`, `recortarElemento` | `doc` | `documento` |
  | `ClienteMdfeOpcoes` | `transport` | `transporte` |
  | `ClienteMdfeOpcoes` | `clock` | `relogio` |
  | `ResolucaoEnvio` | `outcome` | `resultado` |
  | `criarClienteMdfe` | `options` | `opcoesDoCliente` |
  | `comprimirGzipBase64` | `text` | `texto` |
  | `recuperarEventoRegistrado`, `resolverEnvioSemResposta` | `client` | `cliente` |
  | `recortarElemento` | `parentDefaultNs` | `nsPadraoDoPai` |
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - `recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento?)` aceita a sequência: com ela, devolve só o evento dessa sequência (a CC-e de um `nSeqEvento`); sem ela, continua o de maior sequência.
  - `DetalhePagamento.card` fica `card`: é o nome do grupo no leiaute (ADR 0015, exceção 1).
  - O `Decimal` próprio do pacote fica em inglês, como o do `@sinete/ibs-cbs` (ADR 0015, exceção 3).
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `BuildNfeOptions` | `MontarNfeOpcoes` |
  | `BuildNfeResult` | `ResultadoMontagemNfe` |
  | `BuiltNfe` | `NfeMontada` |
  | `buildNfe` | `montarNfe` |
  | `signNfe` | `assinarNfe` |
  | `DecimalFormat` | `FormatoDecimal` |
  | `formatDecimal` | `formatarDecimal` |
  | `formatProblem` | `problemaDeFormato` |
  | `NfeIssueCode` | `CodigoOcorrenciaNfe` |
  | `NFE_ISSUE_CODES` | `CODIGOS_OCORRENCIA_NFE` |
  | `NfeInput` | `DadosNfe` |
  | `IbsCbsCalculator` | `CalculadoraIbsCbs` |
  | `IbsCbsItemRequest` | `PedidoIbsCbsItem` |
  | `IbsCbsNotaRequest` | `PedidoIbsCbsNota` |
  | `IbsCbsResponse` | `RespostaIbsCbs` |
  | `IbsCbsCalculatorOptions` | `CalculadoraIbsCbsOpcoes` |
  | `ibsCbsCalculator` | `calculadoraIbsCbs` |
  | `AutorizacaoOutcome` | `ResultadoAutorizacao` |
  | `ConsultaOutcome` | `ResultadoConsulta` |
  | `EventoOutcome` | `ResultadoEvento` |
  | `InutilizacaoOutcome` | `ResultadoInutilizacao` |
  | `NfeClient` | `ClienteNfe` |
  | `NfeClientOptions` | `ClienteNfeOpcoes` |
  | `OpcoesEnvio` | `EnvioOpcoes` |
  | `Sleep` | `Espera` |
  | `createNfeClient` | `criarClienteNfe` |
  | `gunzipBase64` | `descomprimirGzipBase64` |
  | `sliceElement` | `recortarElemento` |
  | `formatDh` | `formatarDh` |
  | `offsetDaUf` | `deslocamentoDaUf` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `CalculadoraIbsCbs` | `calcular.request` | `calcular.pedido` |
  | `CalculadoraIbsCbsOpcoes` | `regras.rules` | `regras.regras` |
  | `CalculadoraIbsCbsOpcoes` | `regras.ignoreActivation` | `regras.ignorarAtivacao` |
  | `MontarNfeOpcoes` | `time` | `tempo` |
  | `MontarNfeOpcoes`, `ClienteNfeOpcoes`, `formatarDh` | `offsetMinutes` | `deslocamentoMin` |
  | `MontarNfeOpcoes` | `random` | `aleatorio` |
  | `ResultadoMontagemNfe`, `formatarDecimal`, `problemaDeFormato` | `value` | `valor` |
  | `ResultadoMontagemNfe`, `RespostaIbsCbs` | `issues` | `ocorrencias` |
  | `assinaturaQrCode`, `comQrCode`, `assinarNfe` | `built` | `nota` |
  | `assinaturaQrCode`, `assinarNfe`, `ClienteNfeOpcoes` | `signer` | `assinador` |
  | `montarNfe` | `input` | `entrada` |
  | `montarNfe`, `calculadoraIbsCbs`, `ClienteNfe` | `options` | `opcoes` |
  | `dec` | `input` | `valor` |
  | `sum` | `values` | `valores` |
  | `FormatoDecimal` | `name` | `nome` |
  | `FormatoDecimal` | `minBelowOne` | `minimoAbaixoDeUm` |
  | `FormatoDecimal` | `nonZero` | `naoNulo` |
  | `FormatoDecimal` | `intDigits` | `digitosInteiros` |
  | `formatarDecimal`, `problemaDeFormato` | `format` | `formato` |
  | `formatarDecimal` | `mode` | `modo` |
  | `rotuloDoCaminho` | `path` | `caminho` |
  | `CalculadoraIbsCbsOpcoes` | `rates` | `aliquotas` |
  | `CalculadoraIbsCbsOpcoes` | `utcOffsetMinutes` | `deslocamentoMin` |
  | `ClienteNfeOpcoes` | `transport` | `transporte` |
  | `ClienteNfeOpcoes` | `clock` | `relogio` |
  | `ClienteNfeOpcoes` | `sleep` | `esperar` |
  | `ClienteNfeOpcoes` | `nfceEndpoint` | `endpointNfce` |
  | `criarClienteNfe` | `options` | `opcoesDoCliente` |
  | `DocumentoAssinado`, `recortarElemento` | `doc` | `documento` |
  | `recortarElemento` | `parentDefaultNs` | `nsPadraoDoPai` |
  | `recuperarEventoRegistrado`, `resolverEnvioSemResposta` | `client` | `cliente` |
  | `ResolucaoEnvio` | `outcome` | `resultado` |
  | `formatarDh` | `date` | `data` |
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - `montarDps` passa a ser assíncrona e devolve `Promise<ResultadoMontagemDps>`, como a `montarNfe` e a `montarMdfe` (ADR 0009, emenda de 30/set/2026). O `ErroDeConfiguracao` de um `verAplic` inválido vira rejeição da `Promise`.
  - `ttl` é traduzido: `validadeMs`, `validadeNaoEncontradoMs` e `validadeParametrosMs`.
  - `detalhes` do `ErroRespostaInvalida` de uma rejeição fora do formato do Anexo I: `httpStatus` → `statusHttp`.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `BuildDpsOptions` | `MontarDpsOpcoes` |
  | `BuildDpsResult` | `ResultadoMontagemDps` |
  | `buildDps` | `montarDps` |
  | `signDps` | `assinarDps` |
  | `NfseClient` | `ClienteNfse` |
  | `NfseClientOptions` | `ClienteNfseOpcoes` |
  | `OpcoesEnvio` | `EnvioOpcoes` |
  | `createNfseClient` | `criarClienteNfse` |
  | `parseChaveNfse` | `lerChaveNfse` |
  | `PedidoEventoOptions` | `PedidoEventoOpcoes` |
  | `PedidoEventoResult` | `ResultadoPedidoEvento` |
  | `buildPedidoAnaliseFiscal` | `montarPedidoAnaliseFiscal` |
  | `buildPedidoCancelamento` | `montarPedidoCancelamento` |
  | `signPedidoEvento` | `assinarPedidoEvento` |
  | `gunzipBase64` | `descomprimirGzipBase64` |
  | `gzipBase64` | `comprimirGzipBase64` |
  | `DpsInput` | `DadosDps` |
  | `ParametrosOptions` | `ParametrosOpcoes` |
  | `createParametrosMunicipais` | `criarParametrosMunicipais` |
  | `NfseMensagem` | `MensagemNfse` |
  | `NfseOutcome` | `ResultadoNfse` |
  | `NfseRejeicao` | `RejeicaoNfse` |
  | `formatValor` | `formatarValor` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `MontarDpsOpcoes` | `time` | `tempo` |
  | `MontarDpsOpcoes`, `PedidoEventoOpcoes` | `offsetMinutes` | `deslocamentoMin` |
  | `ResultadoMontagemDps`, `ResultadoPedidoEvento` | `value` | `valor` |
  | `ResultadoMontagemDps`, `ResultadoPedidoEvento`, `formatarValor` | `issues` | `ocorrencias` |
  | `montarDps` | `input` | `entrada` |
  | `montarDps`, `montarPedidoAnaliseFiscal`, `montarPedidoCancelamento` | `options` | `opcoes` |
  | `assinarDps`, `ClienteNfseOpcoes`, `assinarPedidoEvento` | `signer` | `assinador` |
  | `ClienteNfseOpcoes`, `ParametrosOpcoes` | `transport` | `transporte` |
  | `ClienteNfseOpcoes`, `PedidoEventoOpcoes`, `ParametrosOpcoes` | `clock` | `relogio` |
  | `ResolucaoEnvio` | `outcome` | `resultado` |
  | `criarClienteNfse` | `options` | `opcoesDoCliente` |
  | `resolverEnvioSemResposta` | `client` | `cliente` |
  | `inscricaoId` | `doc` | `documento` |
  | `comprimirGzipBase64` | `text` | `texto` |
  | `CacheParametros` | `get` | `obter` |
  | `CacheParametros` | `set` | `gravar` |
  | `CacheParametros` | `clear` | `limpar` |
  | `ParametrosOpcoes` | `ttlMs` | `validadeMs` |
  | `ParametrosOpcoes` | `ttlNaoEncontradoMs` | `validadeNaoEncontradoMs` |
  | `RejeicaoNfse` | `httpStatus` | `statusHttp` |
  | `formatarValor` | `path` | `caminho` |
  | `ClienteNfseOpcoes` | `ttlParametrosMs` | `validadeParametrosMs` |
- ae8ab90: Nomes da API pública em português (ADR 0015, fase 1). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `RejeicaoCategory` | `CategoriaRejeicao` |
  | `REJEICAO_CATEGORIES` | `CATEGORIAS_REJEICAO` |
  | `RejeicaoRule` | `RegraRejeicao` |
  | `RejeicaoSource` | `FonteRejeicao` |
  | `RejeicoesTableInfo` | `DescricaoTabelaRejeicoes` |
  | `REJEICOES_TABLE` | `TABELA_REJEICOES` |
  | `rejeicaoByCode` | `rejeicaoPorCodigo` |
  | `rejectionHint` | `dicaRejeicao` |
  | `enrichRejected` | `completarRecusado` |
  | `enrichOutcome` | `completarResultado` |
  | `REJEICOES_MDFE_TABLE` | `TABELA_REJEICOES_MDFE` |
  | `rejeicaoMdfeByCode` | `rejeicaoMdfePorCodigo` |
  | `rejectionHintMdfe` | `dicaRejeicaoMdfe` |
  | `enrichRejectedMdfe` | `completarRecusadoMdfe` |
  | `enrichOutcomeMdfe` | `completarResultadoMdfe` |
  | `NfseErrosTableInfo` | `DescricaoTabelaErrosNfse` |
  | `NFSE_ERROS_TABLE` | `TABELA_ERROS_NFSE` |
  | `nfseErroByCode` | `nfseErroPorCodigo` |
  | `nfseRejectionHint` | `dicaRejeicaoNfse` |
  | `enrichNfseRejected` | `completarRecusadoNfse` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `RegraRejeicao` | `doc` | `documento` |
  | `Rejeicao` | `code` | `codigo` |
  | `Rejeicao` | `effect` | `efeito` |
  | `Rejeicao` | `message` | `mensagem` |
  | `Rejeicao` | `messages` | `mensagens` |
  | `Rejeicao` | `source` | `fonte` |
  | `Rejeicao` | `rules` | `regras` |
  | `Rejeicao` | `category` | `categoria` |
  | `RejeicaoMdfe` | `code` | `codigo` |
  | `RejeicaoMdfe` | `effect` | `efeito` |
  | `RejeicaoMdfe` | `message` | `mensagem` |
  | `RejeicaoMdfe` | `messages` | `mensagens` |
  | `RejeicaoMdfe` | `source` | `fonte` |
  | `RejeicaoMdfe` | `rules` | `regras` |
  | `RejeicaoMdfe` | `category` | `categoria` |
  | `FonteRejeicao` | `citation` | `citacao` |
  | `DescricaoTabelaRejeicoes` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoTabelaRejeicoes` | `version` | `versao` |
  | `DescricaoTabelaRejeicoes` | `sources` | `fontes` |
  | `DescricaoTabelaErrosNfse` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoTabelaErrosNfse` | `version` | `versao` |
  | `DescricaoTabelaErrosNfse` | `sources` | `fontes` |
  | `NfseErroRegra` | `doc` | `documento` |
  | `NfseErro` | `code` | `codigo` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/rejeicoes.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/rejeicoes.json` | `version` | `versao` |
  | `data/rejeicoes.json` | `sources` | `fontes` |
  | `data/rejeicoes.json` | `citation` | `citacao` |
  | `data/rejeicoes.json` | `code` | `codigo` |
  | `data/rejeicoes.json` | `effect` | `efeito` |
  | `data/rejeicoes.json` | `message` | `mensagem` |
  | `data/rejeicoes.json` | `messages` | `mensagens` |
  | `data/rejeicoes.json` | `source` | `fonte` |
  | `data/rejeicoes.json` | `rules` | `regras` |
  | `data/rejeicoes.json` | `category` | `categoria` |
  | `data/rejeicoes.json` | `doc` | `documento` |
  | `data/rejeicoes-mdfe.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/rejeicoes-mdfe.json` | `version` | `versao` |
  | `data/rejeicoes-mdfe.json` | `sources` | `fontes` |
  | `data/rejeicoes-mdfe.json` | `citation` | `citacao` |
  | `data/rejeicoes-mdfe.json` | `code` | `codigo` |
  | `data/rejeicoes-mdfe.json` | `effect` | `efeito` |
  | `data/rejeicoes-mdfe.json` | `message` | `mensagem` |
  | `data/rejeicoes-mdfe.json` | `messages` | `mensagens` |
  | `data/rejeicoes-mdfe.json` | `source` | `fonte` |
  | `data/rejeicoes-mdfe.json` | `rules` | `regras` |
  | `data/rejeicoes-mdfe.json` | `category` | `categoria` |
  | `data/rejeicoes-mdfe.json` | `doc` | `documento` |
  | `data/nfse-erros.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/nfse-erros.json` | `version` | `versao` |
  | `data/nfse-erros.json` | `sources` | `fontes` |
  | `data/nfse-erros.json` | `citation` | `citacao` |
  | `data/nfse-erros.json` | `code` | `codigo` |
  | `data/nfse-erros.json` | `doc` | `documento` |
  
  Também mudam nesta versão:
  
  - Parâmetros: `nfseErroPorCodigo(codigo)`, `dicaRejeicaoNfse(codigo)` e `completar*(desfecho)`.
  - `src/data/*.json`: as chaves seguem a tabela acima, e `notes` e `generatedBy` do topo viraram `notas` e `geradoPor`.
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar. Só o runtime muda: os tipos gerados dos XSD ficam com os nomes do schema.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `DecodeIssue` | `OcorrenciaDecodificacao` |
  | `DecodeIssueCode` | `CodigoOcorrenciaDecodificacao` |
  | `Decoded` | `Decodificado` |
  | `decode` | `decodificar` |
  | `decodeRoot` | `decodificarRaiz` |
  | `decodeXml` | `decodificarXml` |
  | `RootElement` | `ElementoRaiz` |
  | `SchemaModuleInfo` | `DescricaoModuloSchema` |
  | `SchemaPatch` | `AjusteDoSchema` |
  | `SchemaSource` | `FonteDoSchema` |
  | `ValueOf` | `ValorDe` |
  | `isComplexType` | `ehComplexType` |
  | `isElementParticle` | `ehElementParticle` |
  | `isWildcard` | `ehWildcard` |
  | `SchemaIssue` | `OcorrenciaSchema` |
  | `ValidationCode` | `CodigoValidacao` |
  | `assertValid` | `exigirValido` |
  | `checkSimple` | `conferirTipoSimples` |
  | `compareCalendar` | `compararCalendario` |
  | `compareDecimal` | `compararDecimal` |
  | `validate` | `validar` |
  | `validateRoot` | `validarRaiz` |
  | `serialize` | `serializar` |
  | `serializeRoot` | `serializarRaiz` |
  | `XsdRegexError` | `ErroRegexXsd` |
  | `compileXsdRegex` | `compilarRegexXsd` |
  | `xsdRegexToJs` | `regexXsdParaJs` |
  | `SchemasErrorCode` | `CodigoErroSchemas` |
  | `SerializeError` | `ErroSerializacao` |
  | `VigenciaError` | `ErroVigencia` |
  | `VigenciaEntry` | `EntradaDeVigencia` |
  | `Instant` | `Instante` |
  | `cmpInstant` | `compararInstantes` |
  | `validateElement` | `validarElemento` |
  | `decodeCT` | `decodificarComplexType` |
  | `decodeSimple` | `decodificarSimpleType` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ErroSerializacao` | `constructor.path` | `constructor.caminho` |
  | `ErroSerializacao`, `ErroVigencia` | `constructor.options` | `constructor.opcoes` |
  | `ErroRegexXsd` | `constructor.pattern` | `constructor.padrao` |
  | `decodificarXml`, `decodificarRaiz`, `serializarRaiz`, `exigirValido`, `validarRaiz` | `root` | `raiz` |
  | `ErroSerializacao`, `conferirTipoSimples` | `path` | `caminho` |
  | `Decodificado`, `serializar`, `serializarRaiz` | `value` | `valor` |
  | `Decodificado` | `issues` | `ocorrencias` |
  | `decodificar` | `source` | `texto` |
  | `decodificarRaiz` | `doc` | `documento` |
  | `ElementoRaiz`, `serializar` | `name` | `nome` |
  | `ElementoRaiz` | `type` | `tipo` |
  | `compilarRegexXsd`, `regexXsdParaJs` | `src` | `padrao` |
  | `serializar` | `inheritedNs` | `nsHerdado` |
  | `conferirTipoSimples` | `raw` | `bruto` |
  | `conferirTipoSimples` | `out` | `saida` |
  | `DescricaoModuloSchema` | `patches` | `ajustes` |
  Também mudam nesta versão:
  
  - Chaves de `detalhes`: `path` → `caminho` (`ErroSerializacao`), `pattern` → `padrao` (`ErroRegexXsd`).
  - Os módulos gerados descrevem cada raiz como `{ nome, ns, tipo }` e o módulo como `DescricaoModuloSchema`.
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - Os JSON de dados (`status.json`, `mdfe-status.json`, `svc.json`) passam a `versaoDoFormato: 2`, com as chaves em português.
  - `NfseSim.clearFaults` → `limparFalhas`, como no `SefazSim`.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `CertCheck` | `ConferenciaDoCertificado` |
  | `CertIdentity` | `IdentidadeDoCertificado` |
  | `SignatureCheck` | `ConferenciaDaAssinatura` |
  | `SignatureCheckInput` | `EntradaConferenciaAssinatura` |
  | `checkAssinatura` | `conferirAssinaturaDoDocumento` |
  | `checkTransmissor` | `conferirTransmissor` |
  | `RequestContext` | `ContextoDoPedido` |
  | `Runtime` | `EstadoDeExecucao` |
  | `SimConfig` | `ConfiguracaoSim` |
  | `SimHandler` | `TratadorSim` |
  | `MotivoParams` | `ParametrosDoMotivo` |
  | `isDenegacao` | `ehDenegacao` |
  | `isResultado` | `ehResultado` |
  | `NfseSimOptions` | `NfseSimOpcoes` |
  | `NfseSimFaultTarget` | `AlvoDaFalhaNfseSim` |
  | `NfseSimFullOptions` | `NfseSimOpcoesCompletas` |
  | `NfseSimInspect` | `InspecaoNfseSim` |
  | `createNfseSim` | `criarNfseSim` |
  | `redirectNfseToSim` | `redirecionarNfseParaSim` |
  | `SyntheticPfxOptions` | `PfxSinteticoOpcoes` |
  | `syntheticPfx` | `pfxSintetico` |
  | `AutorizacaoContext` | `ContextoAutorizacao` |
  | `EventoContext` | `ContextoEvento` |
  | `EventoFacts` | `FatosEvento` |
  | `InutilizacaoContext` | `ContextoInutilizacao` |
  | `InutilizacaoFacts` | `FatosInutilizacao` |
  | `NfeFacts` | `FatosNfe` |
  | `SimRejection` | `RejeicaoSim` |
  | `SimRule` | `RegraSim` |
  | `SimRules` | `RegrasSim` |
  | `SimView` | `VisaoSim` |
  | `chaveRejection` | `rejeicaoDaChave` |
  | `DEFAULT_RULES` | `REGRAS_PADRAO` |
  | `firstRejection` | `primeiraRejeicao` |
  | `SefazSimServer` | `ServidorSefazSim` |
  | `SefazSimServerOptions` | `ServidorSefazSimOpcoes` |
  | `SimServer` | `ServidorSim` |
  | `startSefazSimServer` | `iniciarServidorSefazSim` |
  | `startSimServer` | `iniciarServidorSim` |
  | `ServiceDef` | `DefinicaoDeServico` |
  | `SimAutorizador` | `AutorizadorSim` |
  | `SimServico` | `ServicoSim` |
  | `isMdfeServico` | `ehServicoMdfe` |
  | `MDFE_SERVICES` | `SERVICOS_MDFE` |
  | `NFE_SERVICES` | `SERVICOS_NFE` |
  | `routeOf` | `rotaDe` |
  | `serviceDef` | `definicaoDoServico` |
  | `servicePath` | `caminhoDoServico` |
  | `soapAction` | `acaoSoap` |
  | `wsdlNamespace` | `namespaceDoWsdl` |
  | `FaultTarget` | `AlvoDaFalha` |
  | `SefazSimOptions` | `SefazSimOpcoes` |
  | `SimEffect` | `EfeitoSim` |
  | `SimFault` | `FalhaSim` |
  | `SimInspect` | `InspecaoSim` |
  | `SimRequest` | `PedidoSim` |
  | `SimResult` | `RespostaSim` |
  | `createSefazSim` | `criarSefazSim` |
  | `DistDoc` | `DocumentoDaDistribuicao` |
  | `EventoRecord` | `RegistroEvento` |
  | `InutilizacaoRecord` | `RegistroInutilizacao` |
  | `LoteRecord` | `RegistroLote` |
  | `MdfeEventoRecord` | `RegistroEventoMdfe` |
  | `MdfeRecord` | `RegistroMdfe` |
  | `NfeRecord` | `RegistroNfe` |
  | `PendingNfe` | `NfePendente` |
  | `SyntheticCertificate` | `CertificadoSintetico` |
  | `SyntheticCertificateOptions` | `CertificadoSinteticoOpcoes` |
  | `SyntheticRole` | `PapelSintetico` |
  | `syntheticCertificate` | `certificadoSintetico` |
  | `SimTransportOptions` | `TransporteSimOpcoes` |
  | `redirectToSim` | `redirecionarParaSim` |
  | `SIM_BASE_URL` | `URL_BASE_SIM` |
  | `simAutorizadorOf` | `autorizadorSimDe` |
  | `simTransport` | `transporteSim` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `NfseSim`, `SefazSim`, `TratadorSim` | `handle.request` | `atender.pedido` |
  | `NfseSim`, `SefazSim` | `injectFault.fault` | `injetarFalha.falha` |
  | `NfseSim`, `SefazSim` | `injectFault.target` | `injetarFalha.alvo` |
  | `SefazSim` | `url.baseUrl` | `url.urlBase` |
  | `RegraSim` | `check.ctx` | `conferir.contexto` |
  | `rotaDe` | `@retorno.def` | `@retorno.definicao` |
  | `ContextoAutorizacao`, `ContextoEvento`, `ContextoInutilizacao` | `view` | `visao` |
  | `ContextoAutorizacao`, `DpsFatos`, `ContextoEvento`, `EventoNfseFatos`, `ContextoInutilizacao` e mais 4 | `now` | `agora` |
  | `ConferenciaDoCertificado`, `ConferenciaDaAssinatura` | `identity` | `identidade` |
  | `IdentidadeDoCertificado` | `info` | `certificado` |
  | `DpsFatos`, `EventoNfseFatos`, `EstadoDeExecucao`, `SefazSim`, `VisaoSim` | `config` | `configuracao` |
  | `AlvoDaFalha`, `AlvoDaFalhaNfseSim` | `times` | `vezes` |
  | `RegistroLote` | `receivedAt` | `recebidoEm` |
  | `RegistroLote` | `availableAt` | `disponivelEm` |
  | `RegistroLote` | `pending` | `pendente` |
  | `RegistroLote` | `processedAt` | `processadoEm` |
  | `NfseSim`, `SefazSim`, `TratadorSim` | `handle` | `atender` |
  | `NfseSim`, `SefazSim` | `injectFault` | `injetarFalha` |
  | `NfseSim`, `SefazSim` | `inspect` | `inspecao` |
  | `NfseSimOpcoes`, `SefazSimOpcoes`, `ConfiguracaoSim`, `CertificadoSinteticoOpcoes` | `clock` | `relogio` |
  | `NfseSimOpcoes`, `CertificadoSintetico` | `signer` | `assinador` |
  | `NfePendente` | `emitenteKey` | `chaveDoEmitente` |
  | `ContextoDoPedido`, `acaoSoap`, `namespaceDoWsdl` | `def` | `definicao` |
  | `EstadoDeExecucao` | `state` | `estado` |
  | `SefazSim`, `PedidoSim`, `rotaDe` | `path` | `caminho` |
  | `SefazSim`, `NfseSim` | `clearFaults` | `limparFalhas` |
  | `SefazSim` | `setParalisacao` | `definirParalisacao` |
  | `SefazSim` | `setParalisacaoMdfe` | `definirParalisacaoMdfe` |
  | `SefazSim` | `setProtocoloSemDigVal` | `definirProtocoloSemDigVal` |
  | `SefazSim` | `setContingencia` | `definirContingencia` |
  | `SefazSim` | `setAtivacaoSvc` | `definirAtivacaoSvc` |
  | `SefazSim` | `settle` | `processarLotes` |
  | `SefazSimOpcoes`, `ConfiguracaoSim`, `rejeicaoDaChave` | `offsetMinutes` | `deslocamentoMin` |
  | `SefazSimOpcoes`, `ConfiguracaoSim`, `primeiraRejeicao` | `rules` | `regras` |
  | `DefinicaoDeServico` | `operation` | `operacao` |
  | `DefinicaoDeServico` | `style` | `estilo` |
  | `ConferenciaDaAssinatura` | `certificateDer` | `certificadoDer` |
  | `EntradaConferenciaAssinatura` | `doc` | `documento` |
  | `EntradaConferenciaAssinatura` | `element` | `elemento` |
  | `FalhaSim` | `kind` | `tipo` |
  | `FalhaSim` | `phase` | `fase` |
  | `RejeicaoSim`, `motivo`, `motivoMdfe`, `motivoRejeicao` | `params` | `parametros` |
  | `PedidoSim` | `method` | `metodo` |
  | `PedidoSim`, `RespostaSim` | `headers` | `cabecalhos` |
  | `PedidoSim`, `RespostaSim` | `body` | `corpo` |
  | `PedidoSim`, `TransporteSimOpcoes` | `clientCertificate` | `certificadoDoCliente` |
  | `RespostaSim` | `effect` | `efeito` |
  | `RespostaSim` | `delayMs` | `atrasoMs` |
  | `RegraSim` | `source` | `fonte` |
  | `RegraSim` | `check` | `conferir` |
  | `TransporteSimOpcoes` | `policy` | `politica` |
  | `TransporteSimOpcoes` | `rejectOn403` | `recusarEm403` |
  | `VisaoSim` | `nfeByNumero` | `nfePorNumero` |
  | `VisaoSim` | `pendenteByNumero` | `pendentePorNumero` |
  | `CertificadoSintetico` | `keyPem` | `chavePem` |
  | `CertificadoSintetico` | `tlsIdentity` | `identidadeTls` |
  | `CertificadoSintetico` | `signTbs` | `assinarTbs` |
  | `CertificadoSinteticoOpcoes` | `role` | `papel` |
  | `CertificadoSinteticoOpcoes` | `validDays` | `diasDeValidade` |
  | `CertificadoSinteticoOpcoes` | `issuer` | `emissor` |
  | `CertificadoSinteticoOpcoes` | `omitDocumentExtension` | `omitirExtensaoDoDocumento` |
  | `PfxSinteticoOpcoes` | `chain` | `cadeia` |
  | `conferirAssinaturaDoDocumento` | `input` | `entrada` |
  | `criarNfseSim`, `criarSefazSim`, `transporteSim`, `certificadoSintetico`, `pfxSintetico` e mais 2 | `options` | `opcoes` |
  | `primeiraRejeicao` | `ctx` | `contexto` |
  | `redirecionarNfseParaSim`, `redirecionarParaSim` | `transport` | `transporte` |
  | `redirecionarNfseParaSim`, `redirecionarParaSim`, `ServidorSim` | `baseUrl` | `urlBase` |
  | `pfxSintetico`, `ServidorSefazSimOpcoes` | `cert` | `certificado` |
  | `ServidorSefazSimOpcoes` | `key` | `chave` |
  | `ServidorSefazSimOpcoes` | `requestCert` | `pedirCertificado` |
  | `ServidorSefazSimOpcoes` | `hostname` | `host` |
  | `ServidorSefazSimOpcoes`, `ServidorSim` | `port` | `porta` |
  | `ServidorSim` | `close` | `fechar` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `EfeitoSim` | `'respond'` | `'responder'` |
  | `EfeitoSim` | `'drop'` | `'derrubar'` |
  | `EfeitoSim` | `'hang'` | `'travar'` |
  | `FalhaSim` | `'delay'` | `'atraso'` |
  | `FalhaSim` | `'drop'` | `'derrubar'` |
  | `FalhaSim` | `'hang'` | `'travar'` |
  | `FalhaSim` | `'before'` | `'antes'` |
  | `FalhaSim` | `'after'` | `'depois'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `source` | `fonte` |
  | `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `retrievedAt` | `coletadoEm` |
  | `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `note` | `nota` |
  | `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `codes` | `codigos` |
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `AuditEvent` | `EventoDeAuditoria` |
  | `ExternalTlsHelper` | `HelperTlsExterno` |
  | `HelperHttpRequest` | `PedidoHttpDoHelper` |
  | `HostPolicy` | `PoliticaDeHosts` |
  | `PolicyRequest` | `PedidoParaPolitica` |
  | `TlsIdentity` | `IdentidadeTls` |
  | `TlsInfo` | `DescricaoTls` |
  | `TlsSignContext` | `ContextoAssinaturaTls` |
  | `TlsSigner` | `AssinadorTls` |
  | `Transport` | `Transporte` |
  | `TransportCapabilities` | `CapacidadesDoTransporte` |
  | `TransportOptions` | `TransporteOpcoes` |
  | `TransportRequest` | `PedidoTransporte` |
  | `TransportResponse` | `RespostaTransporte` |
  | `TransportRuntime` | `RuntimeDoTransporte` |
  | `PolicyError` | `ErroPolitica` |
  | `SignerError` | `ErroSigner` |
  | `SignerErrorCode` | `CodigoErroSigner` |
  | `TransportError` | `ErroTransporte` |
  | `TransportErrorCode` | `CodigoErroTransporte` |
  | `TransportUnsupportedError` | `ErroTransporteNaoSuportado` |
  | `ENDPOINT_DATA` | `DADOS_DE_ENDPOINTS` |
  | `EndpointDataInfo` | `DescricaoDadosDeEndpoints` |
  | `EndpointRef` | `EndpointResolvido` |
  | `NfceConsultaUrls` | `UrlsConsultaNfce` |
  | `NfceEndpointQuery` | `BuscaEndpointNfce` |
  | `NfeEndpointQuery` | `BuscaEndpointNfe` |
  | `TlsProfile` | `PerfilTls` |
  | `allEndpoints` | `todosOsEndpoints` |
  | `ambienteHosts` | `hostsDoAmbiente` |
  | `nfceConsultaUrls` | `urlsConsultaNfce` |
  | `tlsProfileForHost` | `perfilTlsDoHost` |
  | `tlsProfiles` | `perfisTls` |
  | `AllowlistPolicyOptions` | `PoliticaDeHostsPermitidosOpcoes` |
  | `allowlistPolicy` | `politicaDeHostsPermitidos` |
  | `allPolicies` | `todasAsPoliticas` |
  | `DENO_CAPABILITIES` | `CAPACIDADES_DENO` |
  | `DenoHttpApi` | `ApiHttpDeno` |
  | `DenoTransportOptions` | `TransporteDenoOpcoes` |
  | `createDenoTransport` | `criarTransporteDeno` |
  | `NodeTransportOptions` | `TransporteNodeOpcoes` |
  | `checkLocalCertificate` | `conferirCertificadoLocal` |
  | `createNodeTransport` | `criarTransporteNode` |
  | `CreateTransportOptions` | `CriarTransporteOpcoes` |
  | `createTransport` | `criarTransporte` |
  | `HelperFailureData` | `DadosDaFalhaDoHelper` |
  | `classifyHelperFailure` | `classificarFalhaDoHelper` |
  | `classifyTransportFailure` | `classificarFalhaDeTransporte` |
  | `http403Error` | `erroHttp403` |
  | `detectRuntime` | `detectarRuntime` |
  | `unsupportedReasons` | `motivosNaoSuportado` |
  | `pemIdentity` | `identidadePem` |
  | `soap12ContentType` | `contentTypeSoap12` |
  | `soap12Envelope` | `envelopeSoap12` |
  | `soapBody` | `lerBodySoap` |
  | `soapFault` | `lerSoapFault` |
  | `OpenPkcs11Options` | `AbrirPkcs11Opcoes` |
  | `OpenRemoteOptions` | `AbrirRemotoOpcoes` |
  | `SIGNER_PROTOCOL_VERSION` | `VERSAO_PROTOCOLO_SIGNER` |
  | `SignerChannel` | `CanalSigner` |
  | `SignerClientOptions` | `ClienteSignerOpcoes` |
  | `SignerConnection` | `ConexaoSigner` |
  | `SignerHello` | `HelloDoSigner` |
  | `SignerIdentity` | `IdentidadeSigner` |
  | `connectSignerChannel` | `conectarCanalSigner` |
  | `cryptoKeyTlsSigner` | `assinadorTlsDeCryptoKey` |
  | `digestTlsSigner` | `assinadorTlsDeDigest` |
  | `lineSplitter` | `divisorDeLinhas` |
  | `parseTlsTranscript` | `lerTranscricaoTls` |
  | `StartSignerOptions` | `IniciarSignerOpcoes` |
  | `connectSigner` | `conectarSigner` |
  | `startSigner` | `iniciarSigner` |
  | `toSineteError` | `paraErroSinete` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `CanalSigner` | `onLine.listener.line` | `aoReceberLinha.ouvinte.linha` |
  | `CanalSigner` | `onClose.listener.reason` | `aoFechar.ouvinte.motivo` |
  | `IdentidadeSigner` | `resetPool.options.dropSessions` | `reiniciarPool.opcoes.descartarSessoes` |
  | `HelperTlsExterno` | `request.identity` | `enviar.identidade` |
  | `HelperTlsExterno` | `request.request` | `enviar.pedido` |
  | `PoliticaDeHosts` | `check.request` | `conferir.pedido` |
  | `AssinadorTls` | `sign.input` | `assinar.entrada` |
  | `AssinadorTls` | `sign.scheme` | `assinar.esquema` |
  | `AssinadorTls` | `sign.context` | `assinar.contexto` |
  | `Transporte` | `send.request` | `enviar.pedido` |
  | `TransporteOpcoes` | `audit.event` | `auditoria.evento` |
  | `ErroPolitica` | `constructor.details` | `constructor.detalhes` |
  | `identidadePem` | `options.chain` | `opcoes.cadeia` |
  | `ErroSigner`, `ErroTransporte`, `ErroTransporteNaoSuportado` | `constructor.options` | `constructor.opcoes` |
  | `envelopeSoap12` | `options.header` | `opcoes.cabecalho` |
  | `ErroTransporteNaoSuportado` | `constructor.reasons` | `constructor.motivos` |
  | `ErroTransporteNaoSuportado` | `constructor.alternative` | `constructor.alternativa` |
  | `conectarSigner` | `options.socketPath` | `opcoes.caminhoDoSocket` |
  | `CanalSigner` | `send.line` | `enviar.linha` |
  | `CanalSigner` | `onLine.listener` | `aoReceberLinha.ouvinte` |
  | `CanalSigner` | `onClose.listener` | `aoFechar.ouvinte` |
  | `ConexaoSigner` | `openRemote.options` | `abrirRemoto.opcoes` |
  | `ConexaoSigner` | `openPkcs11.options` | `abrirPkcs11.opcoes` |
  | `IdentidadeSigner` | `resetPool.options` | `reiniciarPool.opcoes` |
  | `certificadoAberto` | `options.signer` | `opcoes.assinador` |
  | `certificadoAberto` | `@retorno.signer` | `@retorno.assinador` |
  | `divisorDeLinhas` | `onLine.line` | `aoReceberLinha.linha` |
  | `divisorDeLinhas` | `@retorno.chunk` | `@retorno.pedaco` |
  | `lerTranscricaoTls` | `@retorno.serverCertificate` | `@retorno.certificadoDoServidor` |
  | `criarTransporte`, `politicaDeHostsPermitidos`, `criarTransporteDeno`, `identidadePem`, `envelopeSoap12` e mais 5 | `options` | `opcoes` |
  | `PoliticaDeHostsPermitidosOpcoes` | `ports` | `portas` |
  | `PoliticaDeHostsPermitidosOpcoes` | `requireTpAmbInBody` | `exigirTpAmbNoCorpo` |
  | `EventoDeAuditoria` | `path` | `caminho` |
  | `EventoDeAuditoria`, `PedidoHttpDoHelper`, `PedidoParaPolitica`, `PedidoTransporte` | `method` | `metodo` |
  | `EventoDeAuditoria` | `errorCode` | `codigoDoErro` |
  | `EventoDeAuditoria` | `durationMs` | `duracaoMs` |
  | `TransporteDenoOpcoes` | `unknownHosts` | `hostsDesconhecidos` |
  | `DescricaoDadosDeEndpoints` | `endpointsVersion` | `versaoDosEndpoints` |
  | `DescricaoDadosDeEndpoints` | `tlsProfilesVersion` | `versaoDosPerfisTls` |
  | `DescricaoDadosDeEndpoints` | `tlsProfilesSource` | `fonteDosPerfisTls` |
  | `EndpointResolvido`, `UrlsConsultaNfce` | `source` | `fonte` |
  | `HelperTlsExterno` | `protocolVersion` | `versaoDoProtocolo` |
  | `HelperTlsExterno` | `request` | `enviar` |
  | `HelperTlsExterno`, `Transporte`, `CanalSigner`, `IdentidadeSigner` | `close` | `fechar` |
  | `PedidoHttpDoHelper`, `PedidoTransporte`, `RespostaTransporte` | `headers` | `cabecalhos` |
  | `PedidoHttpDoHelper`, `PedidoParaPolitica`, `PedidoTransporte`, `RespostaTransporte`, `envelopeSoap12` | `body` | `corpo` |
  | `PoliticaDeHosts` | `check` | `conferir` |
  | `IdentidadeTls` | `kind` | `tipo` |
  | `IdentidadeTls` | `certChain` | `cadeia` |
  | `IdentidadeTls`, `assinadorTlsDeCryptoKey` | `key` | `chave` |
  | `IdentidadeTls`, `TransporteOpcoes`, `certificadoAberto` | `identity` | `identidade` |
  | `DescricaoTls` | `protocol` | `protocolo` |
  | `DescricaoTls`, `PerfilTls` | `cipher` | `cifra` |
  | `DescricaoTls` | `resumed` | `retomada` |
  | `DescricaoTls` | `clientCertificateLoaded` | `certificadoLocalCarregado` |
  | `DescricaoTls` | `signatures` | `assinaturas` |
  | `PerfilTls` | `uses` | `usos` |
  | `PerfilTls` | `tlsVersions` | `versoesTls` |
  | `PerfilTls` | `maxTls` | `tlsMaximo` |
  | `PerfilTls` | `keyExchange` | `trocaDeChaves` |
  | `PerfilTls` | `clientCert` | `certificadoDoCliente` |
  | `PerfilTls` | `clientCertEvidence` | `evidenciaDoCertificadoDoCliente` |
  | `PerfilTls` | `serverRoot` | `raizDoServidor` |
  | `PerfilTls` | `serverRootName` | `nomeDaRaizDoServidor` |
  | `PerfilTls` | `sessionResumption` | `retomadaDeSessao` |
  | `ContextoAssinaturaTls` | `purpose` | `finalidade` |
  | `ContextoAssinaturaTls` | `connectionId` | `idDaConexao` |
  | `AssinadorTls` | `certificateChain` | `cadeia` |
  | `AssinadorTls` | `sign` | `assinar` |
  | `Transporte`, `motivosNaoSuportado` | `capabilities` | `capacidades` |
  | `Transporte`, `CanalSigner` | `send` | `enviar` |
  | `CapacidadesDoTransporte` | `renegotiation` | `renegociacao` |
  | `CapacidadesDoTransporte` | `sigalgsControl` | `controleDeSigalgs` |
  | `CapacidadesDoTransporte` | `clientCertificateCheck` | `conferenciaDoCertificadoLocal` |
  | `TransporteOpcoes` | `policy` | `politica` |
  | `TransporteOpcoes`, `AbrirPkcs11Opcoes`, `AbrirRemotoOpcoes` | `additionalCa` | `acsAdicionais` |
  | `TransporteOpcoes` | `rejectOn403` | `recusarEm403` |
  | `TransporteOpcoes` | `audit` | `auditoria` |
  | `RespostaTransporte` | `text` | `texto` |
  | `todasAsPoliticas` | `policies` | `politicas` |
  | `classificarFalhaDoHelper` | `data` | `dados` |
  | `classificarFalhaDeTransporte` | `err` | `erro` |
  | `classificarFalhaDeTransporte` | `context` | `contexto` |
  | `mdfeEndpoint`, `nfceEndpoint`, `nfeEndpoint`, `nfseEndpoint` | `query` | `busca` |
  | `identidadePem` | `keyStore` | `certificado` |
  | `contentTypeSoap12` | `action` | `acao` |
  | `ErroTransporteNaoSuportado` | `reasons` | `motivos` |
  | `motivosNaoSuportado` | `profile` | `perfil` |
  | `TransporteNodeOpcoes` | `trust` | `confianca` |
  | `TransporteNodeOpcoes` | `keepAlive` | `manterConexao` |
  | `conferirCertificadoLocal` | `expectedLeaf` | `folhaEsperada` |
  | `AbrirPkcs11Opcoes` | `module` | `modulo` |
  | `AbrirPkcs11Opcoes` | `serial` | `numeroDeSerie` |
  | `AbrirPkcs11Opcoes` | `label` | `rotulo` |
  | `AbrirPkcs11Opcoes` | `keyId` | `idDaChave` |
  | `AbrirPkcs11Opcoes`, `IdentidadeSigner`, `assinadorTlsDeCryptoKey`, `assinadorTlsDeDigest` | `chain` | `cadeia` |
  | `AbrirRemotoOpcoes`, `assinadorTlsDeDigest` | `signer` | `assinador` |
  | `AbrirRemotoOpcoes` | `allowedHosts` | `hostsPermitidos` |
  | `AbrirRemotoOpcoes` | `signTimeoutMs` | `prazoDaAssinaturaMs` |
  | `CanalSigner`, `divisorDeLinhas` | `onLine` | `aoReceberLinha` |
  | `CanalSigner` | `onClose` | `aoFechar` |
  | `ClienteSignerOpcoes` | `client` | `cliente` |
  | `ClienteSignerOpcoes` | `controlTimeoutMs` | `prazoDeControleMs` |
  | `ConexaoSigner` | `openRemote` | `abrirRemoto` |
  | `ConexaoSigner` | `openPkcs11` | `abrirPkcs11` |
  | `ConexaoSigner` | `stats` | `estatisticas` |
  | `IdentidadeSigner` | `tlsIdentity` | `identidadeTls` |
  | `IdentidadeSigner` | `documentSigner` | `assinadorDeDocumentos` |
  | `IdentidadeSigner` | `resetPool` | `reiniciarPool` |
  | `conectarCanalSigner` | `channel` | `canal` |
  | `lerTranscricaoTls` | `transcript` | `transcricao` |
  | `IniciarSignerOpcoes` | `binary` | `binario` |
  | `IniciarSignerOpcoes` | `rootsFiles` | `arquivosDeRaizes` |
  | `IniciarSignerOpcoes` | `auditFile` | `arquivoDeAuditoria` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `TransporteDenoOpcoes` | `'allow'` | `'permitir'` |
  | `TransporteDenoOpcoes` | `'refuse'` | `'recusar'` |
  | `TransporteNodeOpcoes` | `'bundled'` | `'embarcada'` |
  | `TransporteNodeOpcoes` | `'system'` | `'sistema'` |
  | `PerfilTls` | `'renegotiation'` | `'renegociacao'` |
  | `RuntimeDoTransporte` | `'custom'` | `'personalizada'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/endpoints.json` | `authorizers` | `autorizadores` |
  | `data/endpoints.json` | `ufMap` | `mapaDeUfs` |
  | `data/endpoints.json` | `retrievedAt` | `coletadoEm` |
  | `data/endpoints.json`, `data/tls-profiles.json` | `source` | `fonte` |
  | `data/endpoints.json` | `consultasSource` | `fonteDasConsultas` |
  | `data/endpoints.json` | `sources` | `fontes` |
  | `data/endpoints.json` | `ufMapRule` | `regraDoMapaDeUfs` |
  | `data/endpoints.json` | `sourceUpdatedAt` | `fonteAtualizadaEm` |
  | `data/tls-profiles.json` | `cipher` | `cifra` |
  | `data/tls-profiles.json` | `clientCert` | `certificadoDoCliente` |
  | `data/tls-profiles.json` | `clientCertEvidence` | `evidenciaDoCertificadoDoCliente` |
  | `data/tls-profiles.json` | `keyExchange` | `trocaDeChaves` |
  | `data/tls-profiles.json` | `maxTls` | `tlsMaximo` |
  | `data/tls-profiles.json` | `serverRoot` | `raizDoServidor` |
  | `data/tls-profiles.json` | `serverRootName` | `nomeDaRaizDoServidor` |
  | `data/tls-profiles.json` | `sessionResumption` | `retomadaDeSessao` |
  | `data/tls-profiles.json` | `tlsVersions` | `versoesTls` |
  | `data/tls-profiles.json` | `uses` | `usos` |
  | `data/endpoints.json`, `data/tls-profiles.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/endpoints.json`, `data/tls-profiles.json` | `version` | `versao` |
  | `data/tls-profiles.json` | `probedAt` | `sondadoEm` |
  Também mudam nesta versão:
  
  - `name` de cada classe de erro é o nome novo da classe (`ErroTransporte`, `ErroSigner`, `ErroPolitica`, `ErroTransporteNaoSuportado`).
  - Chaves de `detalhes`: `reasons` → `motivos` e `alternative` → `alternativa` (`ErroTransporteNaoSuportado`), `alert` → `alerta`, `systemCode` → `codigoDoSistema`, `stage` → `etapa` e `helper` → `mensagemDoHelper` (falhas de rede e TLS), `source` → `fonte` (`servico_nao_oferecido`), `code` → `codigo` (`ErroSigner` com o código do helper).
  - `detectarRuntime()` devolve `'navegador'` onde antes devolvia `'browser'`.
  - Campos do log do helper: `line` → `linha`.
  - `src/data/endpoints.json` e `src/data/tls-profiles.json`: além das chaves, `certificadoDoCliente: 'renegotiation'` passa a `'renegociacao'`, e `versaoDoFormato` sobe para 2.
  - Os nomes do protocolo do helper `sinete-signer` no fio (métodos, campos, `stage`, `x509`, `mode`, `scheme`, `purpose`, `backend`) ficam como estão (exceção 1 do ADR 0015); `Signer` segue como nome próprio (`iniciarSigner`, `ErroSigner`).
- ae8ab90: Nomes da API pública em português (ADR 0015, fase 1). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `caepfCheckDigits` | `calcularDvCaepf` |
  | `formatCaepf` | `formatarCaepf` |
  | `isValidCaepf` | `caepfValido` |
  | `parseCaepf` | `lerCaepf` |
  | `ChaveAcessoParts` | `PartesChaveAcesso` |
  | `ChaveParseOptions` | `LerChaveAcessoOpcoes` |
  | `buildChaveAcesso` | `montarChaveAcesso` |
  | `chaveAcessoCheckDigit` | `calcularDvChaveAcesso` |
  | `formatChaveAcesso` | `formatarChaveAcesso` |
  | `isValidChaveAcesso` | `chaveAcessoValida` |
  | `parseChaveAcesso` | `lerChaveAcesso` |
  | `cnpjCheckDigits` | `calcularDvCnpj` |
  | `formatCnpj` | `formatarCnpj` |
  | `isAlphanumericCnpj` | `cnpjAlfanumerico` |
  | `isValidCnpj` | `cnpjValido` |
  | `parseCnpj` | `lerCnpj` |
  | `ParseOptions` | `LerOpcoes` |
  | `cpfCheckDigits` | `calcularDvCpf` |
  | `formatCpf` | `formatarCpf` |
  | `isValidCpf` | `cpfValido` |
  | `parseCpf` | `lerCpf` |
  | `IeCheck` | `CalculoDvIe` |
  | `IeParseOptions` | `LerIeOpcoes` |
  | `IeRange` | `FaixaIe` |
  | `IeTableInfo` | `DescricaoTabelaIe` |
  | `IeUfRule` | `RegraIeUf` |
  | `IeVariant` | `VarianteIe` |
  | `completeIe` | `completarIe` |
  | `formatIe` | `formatarIe` |
  | `IE_TABLE` | `TABELA_IE` |
  | `ieCheckDigits` | `calcularDvIe` |
  | `ieRule` | `regraIe` |
  | `isIeIsento` | `ieIsenta` |
  | `isValidIe` | `ieValida` |
  | `parseIe` | `lerIe` |
  | `ValidationIssueCode` | `CodigoOcorrencia` |
  | `VALIDATION_ISSUE_CODES` | `CODIGOS_OCORRENCIA` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ChaveAcesso` | `layout` | `leiaute` |
  | `LerChaveAcessoOpcoes` | `checkEmitente` | `conferirEmitente` |
  | `LerChaveAcessoOpcoes` | `clock` | `relogio` |
  | `LerChaveAcessoOpcoes` | `layout` | `leiaute` |
  | `CNPJ_ALFANUMERICO_VIGENCIA` | `source` | `fonte` |
  | `LerOpcoes` | `path` | `caminho` |
  | `FaixaIe` | `slice` | `posicoes` |
  | `FaixaIe` | `min` | `minimo` |
  | `FaixaIe` | `max` | `maximo` |
  | `FaixaIe` | `add` | `acrescimo` |
  | `FaixaIe` | `map` | `troca` |
  | `CalculoDvIe` | `at` | `posicao` |
  | `CalculoDvIe` | `over` | `posicoesSomadas` |
  | `CalculoDvIe` | `weights` | `pesos` |
  | `CalculoDvIe` | `mod` | `modulo` |
  | `CalculoDvIe` | `result` | `resultado` |
  | `CalculoDvIe` | `map` | `troca` |
  | `CalculoDvIe` | `digitSum` | `somarAlgarismos` |
  | `CalculoDvIe` | `times` | `multiplicador` |
  | `CalculoDvIe` | `add` | `acrescimo` |
  | `CalculoDvIe` | `ranges` | `faixas` |
  | `VarianteIe` | `length` | `tamanho` |
  | `VarianteIe` | `pattern` | `padrao` |
  | `VarianteIe` | `mask` | `mascara` |
  | `VarianteIe` | `legacy` | `legado` |
  | `VarianteIe` | `checks` | `digitosVerificadores` |
  | `RegraIeUf` | `sources` | `fontes` |
  | `RegraIeUf` | `notes` | `notas` |
  | `RegraIeUf` | `variants` | `variantes` |
  | `DescricaoTabelaIe` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoTabelaIe` | `version` | `versao` |
  | `DescricaoTabelaIe` | `sources` | `fontes` |
  | `InscricaoEstadual` | `kind` | `tipo` |
  | `InscricaoEstadual` | `value` | `valor` |
  | `InscricaoEstadual` | `formatted` | `formatada` |
  | `InscricaoEstadual` | `variant` | `variante` |
  | `InscricaoEstadual` | `legacy` | `legado` |
  | `LerIeOpcoes` | `allowIsento` | `aceitarIsento` |
  | `LerIeOpcoes` | `allowLegacy` | `aceitarLegado` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `CalculoDvIe` | `'complement'` | `'complemento'` |
  | `CalculoDvIe` | `'remainder'` | `'resto'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/ie.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/ie.json` | `version` | `versao` |
  | `data/ie.json` | `sources` | `fontes` |
  | `data/ie.json` | `notes` | `notas` |
  | `data/ie.json` | `variants` | `variantes` |
  | `data/ie.json` | `length` | `tamanho` |
  | `data/ie.json` | `pattern` | `padrao` |
  | `data/ie.json` | `mask` | `mascara` |
  | `data/ie.json` | `legacy` | `legado` |
  | `data/ie.json` | `checks` | `digitosVerificadores` |
  | `data/ie.json` | `at` | `posicao` |
  | `data/ie.json` | `over` | `posicoesSomadas` |
  | `data/ie.json` | `weights` | `pesos` |
  | `data/ie.json` | `mod` | `modulo` |
  | `data/ie.json` | `result` | `resultado` |
  | `data/ie.json` | `map` | `troca` |
  | `data/ie.json` | `digitSum` | `somarAlgarismos` |
  | `data/ie.json` | `times` | `multiplicador` |
  | `data/ie.json` | `add` | `acrescimo` |
  | `data/ie.json` | `ranges` | `faixas` |
  | `data/ie.json` | `slice` | `posicoes` |
  | `data/ie.json` | `min` | `minimo` |
  | `data/ie.json` | `max` | `maximo` |
  
  Valores dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/ie.json` | `'complement'` | `'complemento'` |
  | `data/ie.json` | `'remainder'` | `'resto'` |
  
  Também mudam nesta versão:
  
  - Parâmetros: `lerX(entrada, opcoes?)`, `formatarX(valor)`, `calcularDvIe(valor, calculo)`, `montarChaveAcesso(partes)`, `completarIe(base, uf, idDaVariante?)`.
  - `src/data/ie.json`: as chaves seguem a tabela acima, e o `notes` do topo virou `notas`.

### Patch Changes

- Updated dependencies [4a3d258]
- Updated dependencies [2bd9b9a]
- Updated dependencies [2a46db6]
- Updated dependencies [84080ad]
- Updated dependencies [ae8ab90]
- Updated dependencies [84080ad]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [84080ad]
- Updated dependencies [84080ad]
- Updated dependencies [2a46db6]
- Updated dependencies [2a46db6]
- Updated dependencies [84080ad]
- Updated dependencies [84080ad]
- Updated dependencies [84080ad]
- Updated dependencies [ae8ab90]
- Updated dependencies [2a46db6]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [d824983]
  - @sinete/validators@0.2.0
  - @sinete/nfe@0.2.0
  - @sinete/mdfe@0.2.0
  - @sinete/cert@0.2.0
  - @sinete/cli@0.2.0
  - @sinete/core@0.2.0
  - @sinete/da@0.2.0
  - @sinete/nfse@0.2.0
  - @sinete/emissor@0.2.0
  - @sinete/transport@0.2.0
  - @sinete/schemas@0.2.0
  - @sinete/ibs-cbs-dados@2026.9.2
  - @sinete/ibs-cbs@0.2.0
  - @sinete/rejeicoes@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [14defbd]
  - @sinete/transport@0.1.1

## 0.1.0

### Minor Changes

- 515861a: `sinete agents-md`: faz upsert do bloco do sinete no `AGENTS.md` do projeto, entre `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`, sem tocar no resto, e cria o `CLAUDE.md` com `@AGENTS.md` se não existir. O bloco manda o agente de código ler a documentação embarcada da versão instalada, dá as regras que evitam nota duplicada e um índice curto dos pacotes. `CliIo` ganha `writeFile` opcional (sem ela, o `agents-md` sai com código 2); `upsertBloco` e `BLOCO_AGENTS` estão exportados.
- 515861a: `sinete agents-md` também instala a skill `sinete` (`SKILL.md` no formato Agent Skills) em `.claude/skills/sinete/` (Claude Code) e `.agents/skills/sinete/` (Codex e outras ferramentas do padrão), como complemento do bloco do `AGENTS.md`: a skill manda o agente ler a documentação embarcada da versão instalada, sem duplicá-la. O comando a atualiza a cada execução enquanto ela traz a linha `<!-- sinete-skill: ... -->`; um `SKILL.md` que já existe sem a linha é do projeto e é mantido. `--sem-skill` não instala nem atualiza; `--imprimir` segue só mostrando o bloco. `upsertSkill`, `SKILL_SINETE`, `DIRETORIOS_SKILL` e `MARCADOR_SKILL` estão exportados.
- 515861a: `SineteError` ganha `docs`, o caminho da página do código na documentação embarcada (`erros/<code>.md`, relativo a `node_modules/sinete/docs/`), como propriedade própria e no `toJSON`; `paginaDoErro(code)` monta o caminho.
- 515861a: Novo subpath `@sinete/da/nfse` (e `sinete/da/nfse`): `danfse` gera o DANFSe v2 da NFS-e Nacional pela NT SE/CGNFS-e 008/2026 v1.02, em PDF e HTML, a partir do `NFSe` autorizado nos pacotes de esquemas 1.01 de 20260209 e de 20260727. A4 retrato numa página só, QR Code da consulta pública com a chave, "NFS-e SEM VALIDADE JURÍDICA" em produção restrita e marcas d'água de cancelada e substituída pelo evento registrado (`cancelamento`, `substituicao`) ou por `true`; canhoto opcional e `nomeMunicipio` para os endereços. O `TextOp` do modelo ganha `rgb`, opcional, para o texto em cor que a NT pede; os outros documentos não mudam.
- 515861a: Documentação embarcada: a contingência automática no guia de contingência, na NFC-e, na retomada e no store SQL (tabela e métodos para o PostgreSQL), e uma regra nova no bloco do `AGENTS.md`. A NF-e só vai à SVC ativada pela SEFAZ de origem (107 no status da SVC), e a NFC-e off-line não depende de ativação.
- 515861a: A documentação de uso vai no pacote, em `docs/` (`node_modules/sinete/docs/`, `node_modules/@sinete/emissor/docs/`): tutorial da primeira NF-e em homologação contra a SEFAZ simulada, guias de como fazer (store em SQL com a suíte de contrato, retomada, contingência, cancelamento, CC-e, MDF-e com encerramento, NFS-e, IBS/CBS, browser com transmissão no servidor, documentos auxiliares, ocorrências de validação), explicações, a referência gerada dos tipos, uma página por código de erro e o bloco do `AGENTS.md`.
- 515861a: Documentação embarcada: guia "Como emitir NFC-e" (regras do modelo 65, QR Code versões 2 e 3, contingência off-line), a contingência com a NFC-e off-line e o bloco do `AGENTS.md` com a NFC-e e os nomes novos do `sinete/nfe`.
- 515861a: O DANFSe passa a ser gerado localmente, pelo `@sinete/da/nfse`, porque a API de geração do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026) e responde 404.
  
  Mudança de API no emissor de NFS-e (`@sinete/emissor/nfse`): `pdf(chave)`, que pedia o PDF ao ADN e devolvia `Promise<Uint8Array | undefined>`, virou `pdf(nfse, opcoes?)`, que recebe o XML da NFS-e (o `proc` do desfecho autorizado), gera o DANFSe v2 sem ir à rede e devolve `Promise<Uint8Array>`. Novos: `pdfCancelado(nfse, evento, opcoes?)`, com a marca de cancelada ou substituída pelo evento registrado, e `pdfPorChave(chave, opcoes?)`, que consulta a NFS-e e os eventos de cancelamento na Sefin e gera com a marca (`undefined` se a Sefin não conhece a chave). A opção `da` aceita o módulo `@sinete/da/nfse`, como nos emissores de NF-e e MDF-e.
  
  Remoção no `@sinete/nfse`: o `NfseClient` não tem mais o `obterDanfse`. Quem o chamava gera o DANFSe com `danfse` de `@sinete/da/nfse` a partir do XML da NFS-e.
- 515861a: Ocorrências de validação classificadas pela fase em que nasceram (ADR 0011): `ValidationIssue.origem` é `entrada` quando a conferência foi sobre a entrada do domínio (o `path` é da entrada e corrigir o valor ali resolve) e `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD e o PL, chave gerada, grupo IBS/CBS da calculadora, regras da NT). `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem; o campo é opcional no tipo, então quem constrói ocorrências fora do sinete não quebra. A calculadora de IBS/CBS pode marcar a origem das próprias ocorrências; sem marca, entram como `montagem`.
  
  `rotuloDoCaminho(path)` no `@sinete/nfe` e no `@sinete/mdfe` dá o rótulo em português do caminho de uma ocorrência (`Item 2, Descrição do produto`, `Condutor 1, CPF`), para os caminhos da entrada e do documento montado, inclusive os do validador de XSD. O mecanismo fica no `@sinete/core` (`normalizarCaminho`, `criarRotuloDoCaminho`) para os outros documentos.
- 515861a: A API de geração do DANFSe do ADN, suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026), sai dos dados e do simulador. Mudança de API: `NfseApi` do `@sinete/transport` não tem mais `'danfse'`, e o `nfseEndpoint` não resolve mais essa base; no `@sinete/sefaz-sim`, `NFSE_SIM_PREFIXOS` perde a chave `danfse`, `NfseRota` perde a rota `'danfse'` e o `GET /danfse/{chave}` passa a responder 404. O DANFSe v2 sai do XML da NFS-e pelo `@sinete/da/nfse`.
- 515861a: Novo `sinete/emissor` com os subpaths `sinete/emissor/nfe`, `/mdfe`, `/nfse`, `/memoria` e `/contrato`, que reexportam o `@sinete/emissor`; os emissores de poucas linhas (`createNfeEmissor`, `createMdfeEmissor`, `createNfseEmissor`) estão lá, não em `sinete/nfe`, `sinete/mdfe` e `sinete/nfse`. Acompanha as renomeações do ADR 0009 nos clientes.
- 515861a: Primeira versão do guarda-chuva `sinete`: um pacote só, sem entrada raiz, com um subpath por entrada dos `@sinete/*` (`sinete/nfe`, `sinete/nfe/ibs-cbs`, `sinete/mdfe`, `sinete/nfse`, `sinete/da` e `sinete/da/nfe`, `/nfce`, `/mdfe`, `/cce`, `sinete/ibs-cbs` e os subpaths, `sinete/ibs-cbs-dados`, `sinete/validators`, `sinete/cert`, `sinete/transport`, `sinete/rejeicoes`, `sinete/schemas/...`, `sinete/core` e `sinete/core/xml`), cada um reexportando o pacote correspondente, e o bin `sinete` com a CLI. As versões dos `@sinete/*` vão fixadas, então cada versão do guarda-chuva é um conjunto testado junto. Sobe de `0.0.0`, o marcador já publicado no npm.
- 515861a: Novo subpath `@sinete/transport/signer` (e `sinete/transport/signer`): cliente do helper nativo `sinete-signer` para certificado A3 em token PKCS#11, A3 em nuvem de PSC, OpenBao Transit e `CryptoKey` não exportável. `startSigner` sobe o binário, `connectSigner` conecta no socket Unix, `connectSignerChannel` fala o protocolo sobre qualquer canal; `openRemote` aplica a política do dono da chave e `openPkcs11` devolve também o `documentSigner`, que assina XML pelo `dfe.sign` validado pelo helper; `certificadoAberto` monta o certificado que o `@sinete/emissor` aceita. Falhas do helper viram os `TransportError` de sempre (`classifyHelperFailure`) ou o novo `SignerError` (`signer_indisponivel`, `signer_protocolo`, `assinatura_tls_recusada`, `assinatura_tls_expirou`, `pkcs11_falhou`, `assinatura_documento_recusada`). `TlsInfo` ganha `signatures`.
  
  Mudança incompatível: `TlsIdentity` fica com `pem` e `helper`. Os tipos `external` e `pkcs11`, que só lançavam `UnsupportedError`, saíram; use `openRemote` e `openPkcs11`, que devolvem a identidade `helper`. `TlsSignContext.purpose` passa a ser `'tls12-client-certificate-verify'`, o valor do protocolo.

### Patch Changes

- 515861a: A documentação embarcada acompanha a API nova do emissor: guia de como emitir por vários emitentes no mesmo servidor (certificado aberto, pool com `chave`, `aoDecidir` e `jaGuardado` por chamada, entrada preparada), os desfechos `ja-guardado`, `anterior` e `situacaoPosterior` na retomada e na explicação dos bytes, e o bloco do `AGENTS.md` com a entrada preparada e o `abrirCertificado`.
- 515861a: Documentação embarcada: as regras do destinatário conferidas antes do envio, no guia das ocorrências de validação; o tutorial passa a informar o endereço do destinatário da NF-e (RV E05-10).
- 515861a: Documentação embarcada: a inutilização não existe na SVC e fica para o ambiente normal da UF, no guia de contingência.
- 515861a: A barreira da recusa repetida passa a contar (ADR 0012): a mesma recusa (mesmo conteúdo e mesmo `cStat`) volta à SEFAZ até o limite dentro da janela, e só a tentativa seguinte lança `RecusaRepetidaError`. Novo `recusaRepetida.limite`, 3 por padrão (a 4ª tentativa igual não sai); a janela conta desde a primeira recusa da sequência. Assim o reenvio depois de resolver a causa fora da nota (o credenciamento do emitente, 203) passa sem `reenviarRecusado`. Quebra para quem implementou o store: `registrarRecusa` recebe `janelaMs` e conta a sequência numa instrução atômica (mesma recusa dentro da janela soma 1, outra ou a janela vencida recomeça em 1), `recusaRecente` filtra pela primeira da sequência e `RecusaRegistrada` ganha `vezes` e `primeiraEm`; o guia `store-sql.md` traz a tabela com as colunas novas. `details` do erro ganha `primeiraEm`, `vezes` e `limite`. A suíte de contrato ganha os casos da conta.
- 515861a: Barreira da recusa repetida (ADR 0012): com um `TransmissaoStore` que implementa os novos métodos opcionais `registrarRecusa` e `recusaRecente`, o emissor lembra o SHA-256 dos bytes descartados por uma recusa da SEFAZ e lança `RecusaRepetidaError` (`recusa_repetida`), antes de gravar e sem ir à SEFAZ, quando a mesma `ref` montaria os mesmos bytes dentro da janela (1 hora por padrão, `recusaRepetida: { janelaMs }` ou `false`). Evita o bloqueio por consumo indevido (rejeição 656). A nota corrigida e a retomada de bytes gravados nunca são barradas; a recusa do serviço (108, 109, 999) não conta; `emitir(ref, entrada, { reenviarRecusado: true })` envia depois de uma correção fora da nota. O store em memória implementa os dois métodos; store com um só lança `ConfigError`. A suíte de contrato ganha três casos, incluídos por padrão: o adaptador sem os métodos passa `recusas: false`. `PerfilDocumento` ganha `transitorio` opcional.
  
  O emissor da NF-e confere o certificado antes de assinar: sem CNPJ nem CPF, `ConfigError` (rejeição 282); emitente de outro CNPJ-base ou CPF, `ValidationError` com `emitente_difere_do_certificado` (213, 227).
- 515861a: A montagem confere regras da SEFAZ que só dependem do documento e voltavam como rejeição (ADR 0012), com `origem: 'entrada'`: série de emitente CNPJ de 0 a 889 (RV C02-30 e B26-10, rejeições 503 e 244), CST 50 ou 51 com destinatário contribuinte isento fora das exceções (RV N12-80, 529), duplicata sem vencimento ou vencendo antes da emissão (Y09-20, 900) ou da parcela anterior (Y09-30, 850) e parcela única vencendo na emissão (NT 2025.001 v1.03, Y09-40, 853). Novo `conferirEmitenteDoCertificado` (RV F03 e F03A) e o código `emitente_difere_do_certificado`. O cliente recusa, antes de enviar, o autor explícito de cancelamento, cancelamento por substituição e CC-e diferente do emitente da chave (`autor_difere_do_emitente`, RV P12-44, 574).
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
  - @sinete/cli@0.1.0
  - @sinete/nfe@0.1.0
  - @sinete/transport@0.1.0
  - @sinete/core@0.1.0
  - @sinete/da@0.1.0
  - @sinete/mdfe@0.1.0
  - @sinete/emissor@0.1.0
  - @sinete/nfse@0.1.0
  - @sinete/ibs-cbs-dados@2026.9.1
  - @sinete/ibs-cbs@0.1.0
  - @sinete/rejeicoes@0.1.0
  - @sinete/schemas@0.1.0
  - @sinete/validators@0.1.0
