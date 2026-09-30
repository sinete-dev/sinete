# Referência: `@sinete/rejeicoes`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/rejeicoes/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/rejeicoes/x` é `sinete/rejeicoes/x`.

## `@sinete/rejeicoes`

`@sinete/rejeicoes`: catálogo de rejeições e denegações da SEFAZ para NF-e e NFC-e.

O catálogo vive em `data/rejeicoes.json`, gerado por `tools/rejeicoes-data` a partir dos PDFs oficiais (MOC 7.0 Anexo I e NT 2025.002, mais códigos avulsos das NT 2025.001 e 2024.003) com sha256 conferido, mais a curadoria manual de causa provável e correção. Este módulo só consulta a tabela e preenche o `DicaRejeicao` do `ResultadoSefaz` do `@sinete/core`.

### Funções

- `completarRecusado`: Preenche a `dica` de um desfecho `recusado` a partir do catálogo. Não sobrescreve uma `dica` já presente e devolve o mesmo objeto quando não há o que acrescentar. `completarRecusado(desfecho: Recusado): Recusado`
- `completarResultado`: Como `completarRecusado`, aceitando qualquer desfecho; só o `recusado` muda. `completarResultado<T, D = T>(desfecho: ResultadoSefaz<T, D>): ResultadoSefaz<T, D>`
- `dicaRejeicao`: `DicaRejeicao` do core para o código, quando há curadoria de causa e correção. `dicaRejeicao(cStat: string): DicaRejeicao | undefined`
- `rejeicaoPorCodigo`: Entrada do catálogo para o `cStat` (`'204'`, `'1020'`), ou `undefined` se o código não está catalogado. `rejeicaoPorCodigo(cStat: string): Rejeicao | undefined`

### Interfaces

- `DescricaoTabelaRejeicoes`: Membros: `versaoDoFormato`, `versao`, `fontes`.
- `FonteRejeicao` (estende `FonteDeDados`): Membros: `id`, `versao`, `citacao`, `sha256`.
- `RegraRejeicao`: Regra de validação em que o código aparece. Membros: `documento`, `id`.
- `Rejeicao`: Membros: `codigo`, `efeito`, `mensagem`, `mensagens`, `modelos`, `fonte`, `regras`, `categoria`, `causaProvavel`, `comoCorrigir`, `referencia`.

### Tipos

- `CategoriaRejeicao`: Categoria do problema, para agrupar tratamento e mensagens de interface. `type CategoriaRejeicao = 'schema' | 'assinatura' | 'certificado' | 'cadastro' | 'regra-negocio' | 'duplicidade' | 'reforma'`

### Constantes

- `CATEGORIAS_REJEICAO`: `CATEGORIAS_REJEICAO: readonly CategoriaRejeicao[]`
- `REJEICOES`: Todas as entradas, em ordem numérica de código. `REJEICOES: readonly Rejeicao[]`
- `TABELA_REJEICOES`: Metadados do catálogo: versão (data de coleta) e documentos de origem com sha256. `TABELA_REJEICOES: DescricaoTabelaRejeicoes`

## `@sinete/rejeicoes/mdfe`

`@sinete/rejeicoes/mdfe`: catálogo de rejeições do MDF-e (modelo 58).

Os códigos do MDF-e colidem com os da NF-e com outro significado (611 e 686 são bloqueios por MDF-e não encerrado, 220 é o prazo de 24 horas do cancelamento do MDF-e), então o catálogo é outro e fica numa entrada própria: quem não emite MDF-e não carrega este JSON. Gerado por `tools/rejeicoes-data/mdfe.ts` a partir das regras de validação do MOC MDF-e 3.00b (Anexo I e Visão Geral) e das NT 2025.001 e 2026.001, com o sha256 de cada PDF conferido.

### Funções

- `completarRecusadoMdfe`: Preenche a `dica` de um desfecho `recusado` do MDF-e. Não sobrescreve uma `dica` já presente. `completarRecusadoMdfe(desfecho: Recusado): Recusado`
- `completarResultadoMdfe`: Como `completarRecusadoMdfe`, aceitando qualquer desfecho; só o `recusado` muda. `completarResultadoMdfe<T, D = T>(desfecho: ResultadoSefaz<T, D>): ResultadoSefaz<T, D>`
- `dicaRejeicaoMdfe`: `DicaRejeicao` do core para o código do MDF-e, quando há curadoria de causa e correção. `dicaRejeicaoMdfe(cStat: string): DicaRejeicao | undefined`
- `rejeicaoMdfePorCodigo`: Entrada do catálogo do MDF-e para o `cStat`, ou `undefined` se o código não está catalogado. `rejeicaoMdfePorCodigo(cStat: string): RejeicaoMdfe | undefined`

### Interfaces

- `RejeicaoMdfe`: Membros: `codigo`, `efeito`, `mensagem`, `mensagens`, `modelos`, `fonte`, `regras`, `categoria`, `causaProvavel`, `comoCorrigir`, `referencia`.

### Constantes

- `REJEICOES_MDFE`: Todas as entradas do MDF-e, em ordem numérica de código. `REJEICOES_MDFE: readonly RejeicaoMdfe[]`
- `TABELA_REJEICOES_MDFE`: Metadados do catálogo do MDF-e: versão (data de coleta) e documentos de origem com sha256. `TABELA_REJEICOES_MDFE: DescricaoTabelaRejeicoes`

## `@sinete/rejeicoes/nfse`

`@sinete/rejeicoes/nfse`: catálogo dos códigos de erro da NFS-e Nacional (`E0312`, `E1229`...).

O catálogo vive em `data/nfse-erros.json`, gerado por `tools/rejeicoes-data/nfse.ts` a partir das planilhas oficiais do Anexo I (DPS e NFS-e) e do Anexo II (pedido de registro de evento e evento) do leiaute do Sistema Nacional NFS-e, com sha256 conferido, mais a curadoria manual de causa provável e correção. Na NFS-e o código de erro faz o papel do `cStat`: a Sefin responde com uma lista de erros (`Codigo`, `Descricao`), e o desfecho `recusado` do core traz o código no `cStat`.

### Funções

- `completarRecusadoNfse`: Preenche a `dica` de um desfecho `recusado` da NFS-e a partir do catálogo. Não sobrescreve uma `dica` já presente e devolve o mesmo objeto quando não há o que acrescentar. `completarRecusadoNfse(desfecho: Recusado): Recusado`
- `dicaRejeicaoNfse`: `DicaRejeicao` do core para o código, quando há curadoria de causa e correção. `dicaRejeicaoNfse(codigo: string): DicaRejeicao | undefined`
- `nfseErroPorCodigo`: Entrada do catálogo para o código (`'E0312'`), ou `undefined` se não está catalogado. `nfseErroPorCodigo(codigo: string): NfseErro | undefined`

### Interfaces

- `DescricaoTabelaErrosNfse`: Membros: `versaoDoFormato`, `versao`, `fontes`.
- `NfseErro`: Membros: `codigo`, `mensagem`, `mensagens`, `nivel`, `regras`, `categoria`, `fonte`, `causaProvavel`, `comoCorrigir`, `referencia`.
- `NfseErroRegra`: Regra de negócio da planilha em que o código aparece. Membros: `documento`, `aba`, `linha`, `caminho`, `nivel`, `regra`.

### Tipos

- `NfseErroCategoria`: Categoria do erro, para agrupar tratamento e mensagens de interface. `type NfseErroCategoria = 'recepcao' | 'schema' | 'assinatura' | 'certificado' | 'cadastro' | 'parametrizacao-municipal' | 'regra-negocio' | 'duplicidade' | 'evento' | 'reforma'`

### Constantes

- `NFSE_ERRO_CATEGORIAS`: `NFSE_ERRO_CATEGORIAS: readonly NfseErroCategoria[]`
- `NFSE_ERROS`: Todas as entradas, em ordem de código. `NFSE_ERROS: readonly NfseErro[]`
- `TABELA_ERROS_NFSE`: Metadados do catálogo: versão (data de coleta) e planilhas de origem com sha256. `TABELA_ERROS_NFSE: DescricaoTabelaErrosNfse`
