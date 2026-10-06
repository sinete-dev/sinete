# @sinete/nfe

## 0.5.0

### Minor Changes

- 25eb579: `inutilizar` devolve no 563 o protocolo da faixa já inutilizada. Não existe consulta de inutilização na NF-e 4.00, então reenviar a mesma faixa depois de uma resposta perdida é o único caminho para guardar o `nProt` que valeu, e até aqui o desfecho só trazia `cStat` e `xMotivo`. O 563 continua `recusado` (a resposta não é a homologação e não monta `procInutNFe`); quando o `retInutNFe` traz `nProt`, o desfecho ganha `anterior: { nProt, retInutNFe }` (tipos novos `RecusadoInutilizacao` e `InutilizacaoAnterior`; `ResultadoInutilizacao` passa a usar o primeiro no caso `recusado`). Fonte: MOC 7.0 Visão Geral, tabela 5-12, regra I07.
  
  Mudança de comportamento: um 563 com `nProt` cuja faixa (`ano`, `CNPJ`, `mod`, `serie`, `nNFIni`, `nNFFin`) não é a pedida passa a lançar `ErroRespostaInvalida` (`resposta_invalida`), a mesma conferência que o 102 já fazia. Antes voltava como `recusado` 563, e quem lia o 563 como "a faixa já estava homologada" não tinha como notar que a resposta era de outra faixa. O 563 sem `nProt` e as demais rejeições seguem como `recusado`, sem `anterior`.
- adb6148: Tabela de CFOP do Portal da NF-e no `@sinete/validators` (`indicadoresCfop`, `TABELA_CFOP`; IT 2023.002 v2.10). Com ela, o `montarNfe` confere antes de assinar o CFOP de devolução fora da devolução (I08-144, rejeição 328) e o CST com destinatário não contribuinte (N12-70, rejeição 508, com as exceções da NT 2023.001 e da NT 2023.003), e o `@sinete/sefaz-sim` recusa os dois casos com o mesmo código.
- cc09d66: Contribuinte exclusivo do IBS/CBS (NT 2026.007 v1.10). O `montarNfe` confere antes de assinar a nota sem IE do emitente: NFC-e até o fim de 2032 (rejeição 156), emitente sem CNPJ (157), IEST informada (158), ICMS no item fora da devolução e do `tpNFCredito` 03 (161) e item sem o grupo IBS/CBS (162); a falta de ICMS e ISSQN deixa de ser ocorrência nessa nota. O catálogo do `@sinete/rejeicoes` ganha as 30 rejeições novas da NT (156 a 188), e a `vigencia.json` do `@sinete/schemas` passa a citar a v1.10.
- e6c8f28: NF-e com DANFE Simplificado Tipo 2 (`tpImp` 6, NT 2026.002 v1.11): o `montarNfe` gera o `infNFeSupl` com o QR Code versão 3 na URL da NFC-e da UF, recusa a versão 2 (672) e aceita a contingência off-line (`tpEmis` 9) nela; a chave de acesso passa a aceitar `tpEmis` 9 no modelo 55. O `@sinete/sefaz-sim` deixa de recusar o `infNFeSupl` da NF-e (393, que saiu da NT), exige o QR Code na NF-e Tipo 2 (394) e confere a versão (672). O catálogo do `@sinete/rejeicoes` ganha o 672 (ZX02-220), e o `campoVolatil` do emissor acompanha.
- f40a0aa: NF-e de contribuinte exclusivo do IBS/CBS (sem `emit/IE`) vai à SVRS, como pede a NT 2026.007 (regras C17-11 e 1P10-40). `autorizar`, `consultar` e o recibo consultado com a nota decidem pela própria NF-e; cancelamento, carta de correção, consulta pela chave e recibo sem a nota seguem a opção nova `contribuinteExclusivoIbsCbs` do cliente. Os eventos da série 890 a 919 e a NFC-e continuam no autorizador de antes.

### Patch Changes

- dec66f5: Texto e tamanho conferidos na entrada do MDF-e e da DPS, como na NF-e (ADR 0011, revisão de 06/10). É quebra do `caminho`, da `origem` e do `code` dessas ocorrências:
  
  | Caso | Antes | Depois |
  |---|---|---|
  | MDF-e, texto fora do tipo do leiaute (longo, curto, espaço nas pontas, caractere fora do `TString`) | `schema`, `origem: 'montagem'`, caminho do XSD (`/infMDFe/emit/xNome`), mensagem do validador | `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`emitente.xNome`), mensagem para quem preenche (`no máximo 60 caracteres (tem 61)`) |
  | MDF-e, caractere que o XML não representa | `campo_invalido`, `origem: 'montagem'`, caminho do documento montado (`infMDFe.prodPred.xProd`) | `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`produtoPredominante.xProd`), em qualquer texto da entrada, inclusive os que a montagem transforma (`emitente.endereco.CEP`) |
  | DPS, texto fora do tipo do leiaute | `schema`, `origem: 'montagem'`, caminho do XSD (`/DPS/infDPS/subst/xMotivo`) | `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`substituicao.xMotivo`), também dentro de prestador, tomador, intermediário e dos grupos do serviço (`tomador.end.xLgr`) |
  | DPS, caractere que o XML não representa | `caractere_invalido`, `origem: 'montagem'`, caminho `/` (o documento inteiro) | `campo_invalido`, `origem: 'entrada'`, caminho da entrada (`ibsCbs.refNFSe[1]`) |
  
  O texto das opções do montador (o `respTec` das opções e o `verProc` do MDF-e, o `verAplic` da DPS) continua conferido na montagem, como antes, e os campos que a montagem transforma (telefone, CEP e placa no MDF-e; série e código de tributação nacional na DPS) seguem aceitos como antes.
  
  `@sinete/schemas` exporta o motor da conferência (`conferirTextos`, `CampoDeTexto`, `TextoRecusado`, `textoXmlValido` e `camposSemElemento`), que saiu do `@sinete/nfe`. Na NF-e, o comportamento é o mesmo; a única diferença é a mensagem de um tipo de formato (só dígitos, um código), que passa a ser `formato não aceito` em vez de apontar um caractere. `rotuloDoCaminho` do MDF-e e da NFS-e ganhou os campos novos (`Responsável técnico, Contato`, `Informações adicionais, Informações de interesse do fisco`, `IBS/CBS, NFS-e referenciada`).
- Updated dependencies [1f07136]
- Updated dependencies [adb6148]
- Updated dependencies [cc09d66]
- Updated dependencies [e6c8f28]
- Updated dependencies [eb06ce6]
- Updated dependencies [dec66f5]
- Updated dependencies [30d6381]
  - @sinete/ibs-cbs@0.2.2
  - @sinete/validators@0.3.0
  - @sinete/rejeicoes@0.4.0
  - @sinete/schemas@0.3.0
  - @sinete/transport@0.3.0

## 0.4.0

### Minor Changes

- f3d43e3: **Quebra: alíquota de IBS/CBS desconhecida sai uma vez, no caminho do item.** Quando a calculadora padrão (`calculadoraIbsCbs`) não tem a alíquota da data do fato gerador (a CBS de 2027 antes da resolução do Senado, qualquer alíquota de 2029 em diante), o `montarNfe` devolvia a causa com o caminho da nota e, além dela, uma `ibscbs_calculo` por item classificado. Agora devolve uma ocorrência só. O `code` e a `origem` não mudam. Quem compara `caminho` ou conta ocorrências precisa conferir estes casos:
  
  | Ocorrência | Antes | Agora |
  |---|---|---|
  | alíquota desconhecida na data (`ibscbs_aliquota_desconhecida`, `origem: 'montagem'`) | `caminho: 'impostos.ibsCbs'` | `caminho: 'itens[n].impostos.ibsCbs'`, o primeiro item (pela ordem da nota) que precisa da alíquota; o item sem `gIBSCBS` (CST 410, por exemplo) não pede alíquota e é pulado |
  | grupo IBSCBS ausente depois de uma recusa explicada da calculadora (`ibscbs_calculo`, `origem: 'montagem'`, `itens[n].impostos.ibsCbs`) | uma por item classificado, depois da causa | não sai: a ocorrência da calculadora já diz a causa |
  
  Com N itens classificados, a nota recusada por alíquota desconhecida passa de 1 + N ocorrências para 1. O mesmo vale para as outras recusas da calculadora (`ibscbs_base_ausente`, `ibscbs_classificacao_invalida`, `ibscbs_nao_suportado`, calculadora própria que devolve `ocorrencias`): a `ibscbs_calculo` só sai quando a calculadora omite um item sem devolver nenhuma ocorrência.
  
  **Novo: a nota montada diz quais alíquotas vieram de quem integra.** `NfeMontada.aliquotasInformadas` lista, por item, o tributo, o valor e o motivo de cada alíquota do IBS/CBS que veio de `comAliquotasInformadas` em vez da tabela oficial do pacote; ausente quando todas foram oficiais. A montagem continua sem recusar a alíquota informada, em qualquer ambiente (ADR 0007, seção "Alíquotas"): é o caminho para emitir com uma alíquota já publicada que o pacote ainda não traz. A porta `CalculadoraIbsCbs` ganha o campo opcional `RespostaIbsCbs.aliquotasInformadas`, e o tipo `AliquotaIbsCbsInformada` é exportado. Calculadora própria que não o preencher continua funcionando.

## 0.3.0

### Minor Changes

- 23c1c08: **Quebra: texto e tamanho dos campos conferidos na entrada** (ADR 0011, revisão de 01/10/2026). O `montarNfe` confere os textos da entrada antes de montar, e as ocorrências abaixo mudam de `caminho` e de `origem`; o texto fora do tipo do leiaute muda também de `code` e de `mensagem`. Quem compara `code` ou `caminho` (lista de códigos que vão para a tela, tabela de rótulos, lista de campos que a aplicação preenche) precisa conferir estes casos:
  
  | Ocorrência | Antes | Agora |
  |---|---|---|
  | caractere que o XML não representa (de controle, substituto solto), em qualquer texto da entrada | `code: 'campo_invalido'`, caminho do documento montado (`infNFe.ide.natOp`, `infNFe.det[0].prod.xProd`), `origem: 'montagem'`, `mensagem: 'texto com caractere não permitido em XML'` | `code: 'campo_invalido'`, caminho da entrada (`natOp`, `itens[0].produto.xProd`), `origem: 'entrada'`, `mensagem: 'caractere não aceito (símbolo ou caractere de controle)'` |
  | texto fora do tipo do leiaute (tamanho, espaço nas pontas, caractere fora do `TString`) nos campos listados abaixo | `code: 'schema'`, caminho do XSD (`/infNFe/ide/natOp`, `/infNFe/det[2]/prod/xProd`), `origem: 'montagem'`, `mensagem` do validador (`tamanho_maximo: tamanho máximo 60 (TString)`, `padrao: valor não casa com o pattern (TString)`) | `code: 'campo_invalido'`, caminho da entrada (`natOp`, `itens[1].produto.xProd`), `origem: 'entrada'`, uma ocorrência por regra violada, com `mensagem` para quem preenche o campo |
  
  As mensagens novas do texto fora do tipo: `no máximo 60 caracteres (tem 70)` (e `no mínimo`, `exatamente`, com o limite do PL), `sem espaço no começo nem no fim`, `caractere não aceito: “€”` (o primeiro caractere recusado, quando é visível), `caractere não aceito (símbolo ou caractere de controle)` (quando não é), `não pode ficar em branco` (só espaços) e, para o que o tipo recusa sem ser um desses casos, `formato não aceito`. A `mensagem` não é contrato (ADR 0016): o `code`, o `caminho` e a `origem` são.
  
  Campos conferidos na entrada: `natOp`; `emitente.xNome`, `xFant` e `endereco.xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`; `destinatario.xNome`, `email` e `endereco.xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`, `xPais`; `retirada` e `entrega` (`xNome`, `xLgr`, `nro`, `xCpl`, `xBairro`, `xMun`, `email`); `itens[n].produto.cProd`, `xProd`, `uCom`, `uTrib`, `xPed`; `itens[n].infAdProd`; `transporte.transportador.xNome`, `xEnder`, `xMun`; `transporte.volumes[n].esp`, `marca`, `nVol`; `cobranca.fatura.nFat`; `cobranca.duplicatas[n].nDup`; `pagamento.detPag[n].xPag`; `informacoesAdicionais.infAdFisco`, `infCpl`, `obsCont[n].xTexto`, `obsFisco[n].xTexto`; `compra.xNEmp`, `xPed`, `xCont`.
  
  O limite vem do tipo do elemento no PL da montagem, não de uma tabela de números. Não mudam e continuam `schema` (ou `campo_invalido` com a mensagem antiga, no caractere fora do XML), com o caminho do XML e `origem: 'montagem'`: o nome do destinatário e, na NFC-e, a descrição do primeiro item em homologação (a montagem os troca pelas literais de teste), os grupos repassados no tipo do schema (`exporta`, `infIntermed`, `cana`, `agropecuario` e afins), as opções da montagem (o `respTec` das opções, o CSC, o QR Code) e os valores calculados. O grupo IBSCBS pronto (`itens[n].impostos.ibsCbs.grupo`) segue `schema` com `origem: 'entrada'`, como antes: é estrutura do leiaute montada pelo integrador, não texto digitado. O campo que já tem ocorrência de outra conferência da entrada não ganha a segunda.
  
  **`signal` nos resolvedores.** `resolverEnvioSemResposta(cliente, nfeAssinada, anterior?, opcoes?)` e `recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento?, opcoes?)` aceitam `opcoes?: EnvioOpcoes` no fim e repassam o `signal` à consulta. Compatível.
- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.

### Patch Changes

- a3993e7: A dependência do `@sinete/ibs-cbs-dados` passa de `^2026.9.2` para `>=2026.9.2`: o pacote de dados tem versão de calendário, e a faixa com `^` não aceitaria o dataset de 2027 nos pacotes já publicados. A compatibilidade passa a ser conferida pelo formato: `calcular`, `validar`, `restringir` e `determinar` do `@sinete/ibs-cbs` recusam com `ibscbs_dados_versao_incompativel` um dataset cujo `versaoDoFormato` não é o que este motor lê, mesmo que o pacote de dados instalado aceite o formato dele (ADR 0016, seção 6).
- Updated dependencies [a3993e7]
- Updated dependencies [1864bb5]
- Updated dependencies [395f19c]
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/ibs-cbs@0.2.1
  - @sinete/ibs-cbs-dados@2026.9.3
  - @sinete/rejeicoes@0.3.0
  - @sinete/core@0.3.0
  - @sinete/schemas@0.2.1
  - @sinete/transport@0.2.1
  - @sinete/validators@0.2.1

## 0.2.0

### Minor Changes

- 2bd9b9a: `NfeClient` e `MdfeClient` aceitam `signal` em todo método que vai à rede, no padrão do `NfseClient`. Na NF-e, `consultar`, `cancelar`, `cancelarPorSubstituicao`, `cartaCorrecao`, `manifestar`, `inutilizar` e `consultarCadastro` ganham `opcoes?: OpcoesEnvio` no fim, e `statusServico` (`StatusServicoOpcoes`) e `distribuicaoDFe` recebem o `signal` no objeto de opções que já tinham. No MDF-e, `statusServico`, `consultar`, `consultarNaoEncerrados` e os eventos ganham `opcoes?: OpcoesEnvio`, e `AutorizarOpcoes` passa a ser o mesmo tipo. Os dois pacotes exportam `OpcoesEnvio`. A mudança é compatível: o parâmetro novo é opcional.
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

### Patch Changes

- Updated dependencies [4a3d258]
- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
- Updated dependencies [84080ad]
- Updated dependencies [2a46db6]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [2a46db6]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [d824983]
  - @sinete/validators@0.2.0
  - @sinete/core@0.2.0
  - @sinete/transport@0.2.0
  - @sinete/schemas@0.2.0
  - @sinete/ibs-cbs-dados@2026.9.2
  - @sinete/ibs-cbs@0.2.0
  - @sinete/rejeicoes@0.2.0

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
