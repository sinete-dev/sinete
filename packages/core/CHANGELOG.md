# @sinete/core

## 0.1.0

### Minor Changes

- 515861a: O `cStat` de um `SefazOutcome` aceita também os códigos de erro da NFS-e Nacional (`E` seguido de 4 dígitos, como `E0312`), além dos 3 ou 4 dígitos da NF-e.
- 515861a: `SineteError` ganha `docs`, o caminho da página do código na documentação embarcada (`erros/<code>.md`, relativo a `node_modules/sinete/docs/`), como propriedade própria e no `toJSON`; `paginaDoErro(code)` monta o caminho.
- 515861a: `DataSigner.sign` recebe um terceiro argumento opcional, `SignContext` (`id` e `referenced`, o elemento referenciado canonicalizado), e `PreparedSignature` ganha `referenced`. Quem assina fora do processo pode conferir o que assina: o `documentSigner` do `@sinete/transport/signer` manda o elemento ao helper, que confere o autor do evento (manifestação do destinatário). Signers existentes, que ignoram o argumento, seguem funcionando.
- 515861a: Novo subpath `@sinete/core/xml` (antes o pacote `@sinete/xml`): parser XML estrito com offsets, C14N 1.0 inclusivo, verificação XMLDSig que exige o Id esperado e devolve falha discriminada, e assinatura em três fases por splice com o Signer do core nos modos data e digest. O core continua sem dependências.
- 515861a: Ocorrências de validação classificadas pela fase em que nasceram (ADR 0011): `ValidationIssue.origem` é `entrada` quando a conferência foi sobre a entrada do domínio (o `path` é da entrada e corrigir o valor ali resolve) e `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD e o PL, chave gerada, grupo IBS/CBS da calculadora, regras da NT). `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem; o campo é opcional no tipo, então quem constrói ocorrências fora do sinete não quebra. A calculadora de IBS/CBS pode marcar a origem das próprias ocorrências; sem marca, entram como `montagem`.
  
  `rotuloDoCaminho(path)` no `@sinete/nfe` e no `@sinete/mdfe` dá o rótulo em português do caminho de uma ocorrência (`Item 2, Descrição do produto`, `Condutor 1, CPF`), para os caminhos da entrada e do documento montado, inclusive os do validador de XSD. O mecanismo fica no `@sinete/core` (`normalizarCaminho`, `criarRotuloDoCaminho`) para os outros documentos.
- 515861a: Novo código `servico_nao_oferecido` (`ServicoNaoOferecidoError`) para o serviço que a tabela oficial de web services não lista para a UF ou o ambiente, como a consulta cadastro de uma UF que a SVRS não atende nesse serviço. Antes esses casos saíam como `config_invalida`, que continua valendo só para defeito de integração. `details` traz `autorizador`, `servico`, `ambiente` e, quando informada, a `uf`.

### Patch Changes

- 515861a: O `verProc` padrão da NF-e e do MDF-e, e o `verAplic` padrão da NFS-e (DPS e pedidos de evento), passam de `sinete` para `sinete <versão do pacote>`, montado pelo novo `formatarVerProc` do `@sinete/core` e cortado com segurança se passar dos 20 caracteres do leiaute. A versão de cada pacote é embutida no build (`src/versao-gerada.ts`, gerado a partir do `package.json` por `scripts/versao-gerada.ts`), nunca lida em runtime. `options.verProc`/`options.verAplic` informado continua prevalecendo, como antes.
