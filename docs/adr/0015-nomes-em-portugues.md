# ADR 0015: nomes da API pública em português

- Status: aceito
- Data: 30/set/2026
- Emendas: 30/set/2026, na aplicação da fase 1 (`validators`, `rejeicoes`, `core`): `namespace` e `digest` entram na lista do jargão (exceção 2) e o logger compatível com `console` entra na exceção 3. 30/set/2026, na aplicação da fase 2 (`cert`, `transport`, runtime do `schemas`, `ibs-cbs-dados`, `ibs-cbs`): a exceção 1 passa a cobrir os campos X.509 da RFC 5280, os nomes do protocolo do helper e o vocabulário do XSD; `endpoint`, `helper`, `runtime`, `socket`, `host` e `schema` entram na exceção 2; o `Decimal` entra na exceção 3; e os nomes próprios de produto ficam fora da tradução.
- Substitui a regra de idioma do `CONTRIBUTING.md` (seção Estilo) e a ressalva de idioma do [ADR 0009](0009-verbos-e-caminho-curto.md) ("`create` e o nome do que é criado, em português quando não há termo técnico em inglês").

## Contexto

O inventário da API para a 1.0 (30/set/2026) achou os dois idiomas misturados na superfície pública: os verbos dos clientes, os códigos de erro, a documentação e o emissor em português (`autorizar`, `validacao_falhou`, `tipo: 'autorizado'`), e as fábricas, as classes de erro, os tipos de opções e o resultado do core em inglês (`createNfeClient`, `ConfigError`, `NfeClientOptions`, `status: 'authorized'`). Os tipos de opções tinham três formatos (`XOpcoes`, `OpcoesX`, `XOptions`), às vezes no mesmo pacote. Quem usa o sinete escreve o mesmo domínio fiscal em português, e a mistura obriga a lembrar, nome por nome, em que idioma cada um está.

Uma API que já saiu 1.0 só troca nome em versão major. A decisão tem de ser antes.

## Decisão

Toda a API pública fica em português do Brasil: funções, métodos, classes, tipos, propriedades, parâmetros com nome, valores de união literal e subpaths. Três exceções, fechadas:

1. **Nome oficial fica como na fonte.** Elementos e atributos do XML e dos schemas (`infNFe`, `cStat`, `xMotivo`, `tpAmb`, `chNFe`), nomes dos serviços do WSDL e das APIs REST (`NfeStatusServico`, `statusServico`, `distribuicaoDFe`), siglas oficiais (`NFe`, `MDFe`, `DPS`, `CNPJ`, `IE`, `IBS`, `CBS`) e os tipos gerados dos XSD no `@sinete/schemas`. Eles precisam bater com o leiaute e com o MOC. Pelo mesmo motivo ficam como na fonte:
   - os campos do certificado X.509 com o nome da RFC 5280 (`subject`, `issuer`, `serialNumber`, `notBefore`, `notAfter`, `keyUsage`, `extKeyUsage`, `signatureAlgorithm`, os `type` e `value` de um atributo do nome distinto e o `value` de um `otherName`); os tipos que os agrupam ficam em português (`CertificadoX509`, `AtributoDoNome`);
   - os nomes do protocolo do helper `sinete-signer` no fio (`docs/signer-contract/PROTOCOL.md`): métodos (`hello`, `identity.open`, `http.request`, `dfe.sign`), campos dos parâmetros e das respostas, os valores de `stage` e de `x509`, e os de `mode`, `scheme`, `purpose` e `backend`. Mudar esses nomes quebraria o contrato com os binários já publicados; os tipos TypeScript que os descrevem ficam em português (`DadosDaFalhaDoHelper`, `HelloDoSigner`);
   - o vocabulário do XSD no runtime do `@sinete/schemas` (`complexType`, `simpleType`, `minOccurs`, `use="required"`, os tipos embutidos `date` e `time`), que é o da especificação do W3C.
2. **Jargão técnico sem equivalente natural fica em inglês.** Lista fechada: `store`, `logger`, `cache`, `hash`, `pool`, `buffer`, `stream`, `token`, `bundle`, `dataset`, `payload`, `handshake`, `namespace`, `digest`, `timeout` (só no nome da opção `timeoutMs`), `signal`, `mTLS`, `PEM`, `PFX`, `DER`, `PDF`, `HTML`, `SVG`, `QR Code`, `A1`, `A3`, `endpoint`, `helper`, `runtime`, `socket`, `host` e `schema`. Traduzir esses termos gera calque (`registrador`, `armazém`) e esconde o que a pessoa procuraria. Termo novo só entra na lista por mudança neste ADR.
3. **O que a linguagem ou a plataforma fixa fica como está.** `Error`, `message`, `name`, `cause` e `stack` das exceções, `AbortSignal`, `Uint8Array`, `Promise`, `then`, e as condições do `exports` (`node`, `default`, `types`). Entram aqui também os métodos e níveis de interfaces que espelham uma de fato do ecossistema, como o logger compatível com `console` (`debug`, `info`, `warn`, `error`, `child` e os níveis de mesmo nome): quem integra pluga o logger que já usa, sem adaptador. Pelo mesmo motivo o `Decimal` do `@sinete/ibs-cbs/calcular` mantém os métodos (`plus`, `times`, `round`, `parse`) e o modo de arredondamento `'HALF_EVEN'` do `BigDecimal`, que é a referência de quem confere o cálculo.

Nome próprio de produto não é tradução: o helper `sinete-signer`, o pacote `@sinete/signer` e o subpath `@sinete/transport/signer` ficam como estão, e os nomes que derivam dele levam `Signer` como nome próprio (`iniciarSigner`, `ErroSigner`, `ConexaoSigner`).

### Glossário

| Em inglês | Em português | Exemplo |
|---|---|---|
| `create` (fábrica) | `criar` + o que é criado | `createNfeClient` → `criarClienteNfe`, `createTransport` → `criarTransporte` |
| `build` | `montar` | `buildNfe` → `montarNfe`, `buildDps` → `montarDps` |
| `sign` | `assinar` | `signNfe` → `assinarNfe` |
| `verify`, `check` | `conferir` | `verifyDataset` → `conferirDataset` |
| `parse` | `ler` | `parseChaveNfse` → `lerChaveNfse` |
| `load` | `carregar` | `loadDataset` → `carregarDataset` |
| `get`, `ByCode` | `obter`, `PorCodigo` | `rejeicaoByCode` → `rejeicaoPorCodigo` |
| `is` + adjetivo (predicado) | o adjetivo | `isValidCpf` → `cpfValido`, `isIeIsento` → `ieIsenta` |
| `is` + substantivo | `eh` + substantivo | `isSineteError` → `ehErroSinete`, `isDenegacao` → `ehDenegacao` |
| `to`/`from` (conversão) | o verbo do que acontece | `toPdf` → `gerarPdf`, `fromPercent` → `dePercentual` |
| `with` | `com` | `withOverrides` → `comAliquotasInformadas` |
| `require` | `exigir` | `requireRate` → `exigirAliquota` |
| `enrich` | `completar` | `enrichOutcome` → `completarResultado` |
| `classify` | `classificar` | |
| `Options` | `Opcoes` no fim | `NfeClientOptions` → `ClienteNfeOpcoes`; `OpcoesEmissor` → `EmissorOpcoes` |
| `Client` | `Cliente` | `NfeClient` → `ClienteNfe` |
| `Transport` | `Transporte` | |
| `Signer` | `Assinador` | `createA1Signer` → `criarAssinadorA1` |
| `Request`, `Response` | `Pedido`, `Resposta` | |
| `Result` | `Resultado` | |
| `Outcome` (resposta da SEFAZ) | `Resultado` | `SefazOutcome` → `ResultadoSefaz`, `AutorizacaoOutcome` → `ResultadoAutorizacao` |
| `status` (situação do resultado) | `tipo`, com os valores do emissor | `'authorized'` → `'autorizado'`, `'rejected'` → `'recusado'`, `'denied'` → `'denegado'`, `'pending'` → `'pendente'` |
| `Issue` | `Ocorrencia` | `ValidationIssue` → `Ocorrencia` |
| `Rule` | `Regra` | |
| `Rate` | `Aliquota` | `RateProvider` → `ProvedorDeAliquotas` |
| `Provider` | `Provedor` | |
| `Policy` | `Politica` | `allowlistPolicy` → `politicaDeHostsPermitidos` |
| `Profile` | `Perfil` | |
| `Identity` | `Identidade` | |
| `Chain` | `Cadeia` | `buildChain` → `montarCadeia` |
| `Config` | `Configuracao` | |
| `Error` (classe) | `Erro` no começo | `SineteError` → `ErroSinete`, `ConfigError` → `ErroDeConfiguracao`, `TimeoutError` → `ErroDeTempoEsgotado` |
| `Code` | `Codigo` | `DanfeErrorCode` → `CodigoErroDa` |
| `Info` (metadados) | `Descricao` + o que é descrito | `RejeicoesTableInfo` → `DescricaoTabelaRejeicoes` |
| `Layout`, `Page`, `Doc` (documento auxiliar) | `Leiaute`, `Pagina`, `Documento` | |
| `Unknown`, `Unsupported` | `Desconhecido`, `NaoSuportado` | `RateUnknownError` → `ErroAliquotaDesconhecida` |

Nome que o glossário não cobre segue a regra geral: português, sem acento, `camelCase` para valores e `PascalCase` para tipos e classes, como já são os verbos do ADR 0009. Os códigos de erro (`code`) não mudam: já estão em português e são o contrato estável do ADR sobre erros.

### Como a troca acontece

- Por pacote, das folhas para cima: `validators`, `rejeicoes`, `core`, `cert`, `transport`, runtime do `schemas`, `ibs-cbs-dados`, `ibs-cbs`, `nfe`, `mdfe`, `nfse`, `da`, `emissor`, `sefaz-sim`, `cli`, e o guarda-chuva `sinete` por último.
- Cada pacote tem um mapa de renomeação revisado antes de aplicar, e a troca é feita pelo serviço de renomeação do TypeScript (referências dentro e fora do pacote), não por busca e troca de texto. A documentação embarcada, os READMEs e os exemplos acompanham no mesmo PR, e o `bun run check` compila os exemplos.
- Sem aliases com o nome antigo. O sinete está em 0.x, com um consumidor conhecido que usa tarballs fixos; alias em inglês dobraria a superfície que este ADR quer reduzir.
- Uma versão minor só no fim (0.2.0), com a lista de nomes antigos e novos no CHANGELOG de cada pacote.

## Consequências

- A superfície pública fica num idioma só, o mesmo dos verbos, dos códigos de erro e da documentação.
- Quem já usa a 0.1.x reescreve imports e nomes ao subir para a 0.2.0. A tabela de nomes antigos e novos no CHANGELOG é o guia.
- A 1.0 congela nomes já em português; depois dela, renomear é major.
- O `CONTRIBUTING.md` passa a apontar para este ADR na seção Estilo.
