# Referência: `@sinete/validators`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/validators/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/validators/x` é `sinete/validators/x`.

## `@sinete/validators`

`@sinete/validators`: CPF, CNPJ (numérico e alfanumérico), CAEPF, chave de acesso, inscrição estadual das 27 UFs e a tabela de CFOP do Portal da NF-e.

Funções puras, sem API de runtime. Cada documento tem `lerX` (devolve `Resultado` com o valor normalizado ou uma `Ocorrencia` de código estável), a conferência booleana (`cpfValido`, `ieValida`...) e `formatarX`; os códigos das ocorrências compõem o `ErroDeValidacao` do `@sinete/core`.

### Funções

- `caepfValido`: `caepfValido(entrada: string): boolean`
- `calcularDvCaepf`: Os 2 dígitos de controle do CAEPF para uma base de 12 algarismos. `calcularDvCaepf(base: string): string`
- `calcularDvChaveAcesso`: O DV (1 algarismo) dos 43 primeiros caracteres da chave. `calcularDvChaveAcesso(base: string): string`
- `calcularDvCnpj`: Os 2 dígitos verificadores de uma base de 12 caracteres (algarismos ou letras maiúsculas). `calcularDvCnpj(base: string): string`
- `calcularDvCpf`: Os 2 dígitos verificadores de uma base de 9 algarismos. `calcularDvCpf(base: string): string`
- `calcularDvIe`: Dígitos aceitos na posição `calculo.posicao` de `valor` (as demais posições do cálculo já preenchidas). `calcularDvIe(valor: string, calculo: CalculoDvIe): readonly number[]`
- `chaveAcessoValida`: `chaveAcessoValida(entrada: string, opcoes?: LerChaveAcessoOpcoes): boolean`
- `cnpjAlfanumerico`: Verdadeiro se o CNPJ (já normalizado ou com máscara) tem alguma letra na raiz ou na ordem. `cnpjAlfanumerico(valor: string): boolean`
- `cnpjValido`: `cnpjValido(entrada: string): boolean`
- `completarIe`: Preenche os dígitos verificadores de uma inscrição, na ordem da tabela (útil para gerar massa de teste). `base` tem o tamanho da variante; o que estiver nas posições dos DV é sobrescrito. `completarIe(base: string, uf: Uf, idDaVariante?: string): string`
- `cpfValido`: `cpfValido(entrada: string): boolean`
- `formatarCaepf`: `000.000.000/000-00`. Não valida. `formatarCaepf(valor: string): string`
- `formatarChaveAcesso`: Chave em 11 blocos de 4, como no DANFE. Não valida. `formatarChaveAcesso(valor: string): string`
- `formatarCnpj`: `00.000.000/0000-00`, também para o alfanumérico (`12.ABC.345/01DE-35`). Não valida. `formatarCnpj(valor: string): string`
- `formatarCpf`: `000.000.000-00`. Não valida: formate só o que já passou por `lerCpf`. `formatarCpf(valor: string): string`
- `formatarIe`: Formata com a máscara da UF se a inscrição for válida; senão devolve a entrada sem mudança. `formatarIe(entrada: string, uf: Uf): string`
- `ieIsenta`: Verdadeiro se o texto é o literal `ISENTO`, ignorando caixa e espaços nas pontas. `ieIsenta(entrada: string): boolean`
- `ieValida`: `ieValida(entrada: string, uf: Uf, opcoes?: LerIeOpcoes): boolean`
- `indicadoresCfop`: Indicadores do CFOP (`'5202'`, `'5.202'`), ou `undefined` quando o código não está na tabela. Quem confere uma regra da SEFAZ com o indicador não recusa o CFOP desconhecido: a tabela pode estar atrás da do Portal. `indicadoresCfop(cfop: string): IndicadoresCfop | undefined`
- `lerCaepf`: Valida e normaliza um CAEPF (aceita máscara); devolve os 14 algarismos. `lerCaepf(entrada: string, opcoes?: LerOpcoes): Resultado<string, Ocorrencia>`
- `lerChaveAcesso`: Valida e decompõe a chave de acesso (aceita espaços, como no DANFE, e minúsculas). Cada componente é conferido contra o domínio do leiaute, com a regra de origem em `data/chave.json`. `lerChaveAcesso(entrada: string, opcoes?: LerChaveAcessoOpcoes): Resultado<ChaveAcesso, Ocorrencia>`
- `lerCnpj`: Valida e normaliza um CNPJ, numérico ou alfanumérico (aceita máscara e minúsculas); devolve os 14 caracteres. `lerCnpj(entrada: string, opcoes?: LerOpcoes): Resultado<string, Ocorrencia>`
- `lerCpf`: Valida e normaliza um CPF (aceita máscara); devolve só os 11 algarismos. `lerCpf(entrada: string, opcoes?: LerOpcoes): Resultado<string, Ocorrencia>`
- `lerIe`: Valida e normaliza a inscrição estadual para a UF. Aceita máscara (ponto, hífen, barra, espaço), minúsculas e zeros à esquerda a mais ou a menos. `lerIe(entrada: string, uf: Uf, opcoes?: LerIeOpcoes): Resultado<InscricaoEstadual, Ocorrencia>`
- `montarChaveAcesso`: Monta a chave com o DV a partir das partes, completando zeros à esquerda. Não valida o emitente. `montarChaveAcesso(partes: PartesChaveAcesso): string`
- `regraIe`: Regra de IE da UF (variantes, máscaras e fontes). `regraIe(uf: Uf): RegraIeUf`

### Interfaces

- `CalculoDvIe`: Um dígito verificador. Membros: `posicao`, `posicoesSomadas`, `pesos`, `modulo`, `resultado`, `troca`, `somarAlgarismos`, `multiplicador`, `acrescimo`, `faixas`.
- `ChaveAcesso`: Chave de acesso decomposta. Os campos têm a forma lexical do leiaute (strings com zeros à esquerda). Membros: `chave`, `cUF`, `uf`, `aamm`, `ano`, `mes`, `emitente`, `cnpj`, `cpf`, `mod`, `documento`, `serie`, `nNF`, `leiaute`, `tpEmis`, `cNF`, `cDV`.
- `DescricaoTabelaCfop`: Membros: `versaoDoFormato`, `versao`, `fontes`, `sha256`.
- `DescricaoTabelaIe`: Membros: `versaoDoFormato`, `versao`, `fontes`.
- `FaixaIe`: Faixa de números em que a regra de um dígito muda (Amapá, Goiás). Membros: `posicoes`, `minimo`, `maximo`, `acrescimo`, `troca`.
- `IndicadoresCfop`: Indicadores e vigência de um CFOP, com os nomes das colunas da tabela oficial. Membros: `cfop`, `inicioVigencia`, `fimVigencia`, `indNFe`, `indComunica`, `indTransp`, `indDevol`, `indRetor`, `indAnula`, `indRemes`, `indComb`, `indExcIBSCBS`.
- `LerChaveAcessoOpcoes` (estende `LerOpcoes`): Membros: `conferirEmitente`, `emissao`, `relogio`, `leiaute`.
- `LerIeOpcoes` (estende `LerOpcoes`): Membros: `aceitarIsento`, `aceitarLegado`.
- `LerOpcoes`: Membros: `caminho`.
- `PartesChaveAcesso`: Membros: `cUF`, `aamm`, `emitente`, `mod`, `serie`, `nNF`, `tpEmis`, `cNF`.
- `RegraIeUf`: Membros: `fontes`, `notas`, `variantes`.
- `VarianteIe`: Membros: `id`, `tamanho`, `padrao`, `mascara`, `legado`, `digitosVerificadores`.

### Tipos

- `CodigoOcorrencia`: `type CodigoOcorrencia = (typeof CODIGOS_OCORRENCIA)[number]`
- `InscricaoEstadual`: Inscrição reconhecida.

### Constantes

- `CNPJ_ALFANUMERICO_VIGENCIA`: Vigência do CNPJ alfanumérico nos DF-e: NT 2026.004 v1.01 (NF-e/NFC-e), produção a partir de 1º de julho de 2026. Chave com letra no CNPJ e AAMM anterior é recusada pela SEFAZ como CNPJ inválido (NT 2025.001, item 5, nota aos autorizadores). `CNPJ_ALFANUMERICO_VIGENCIA: { readonly aamm: string; readonly fonte: string; }`
- `CODIGOS_OCORRENCIA`: Códigos estáveis das ocorrências dos validadores (API pública: renomear é major). `CODIGOS_OCORRENCIA: readonly ['cpf_caractere_invalido', 'cpf_tamanho_invalido', 'cpf_digitos_repetidos', 'cpf_dv_invalido', 'cpf_base_invalida', 'cnpj_caractere_invalido', 'cnpj_tamanho_invalido', 'cnpj_formato_invalido', 'cnpj_digitos_rep…`
- `IE_ISENTO`: Literal do leiaute para contribuinte isento de inscrição (TIe e TIeDest do schema). `IE_ISENTO: 'ISENTO'`
- `TABELA_CFOP`: Metadados da tabela de CFOP: versão (data da coleta), fonte e sha256 da planilha. `TABELA_CFOP: DescricaoTabelaCfop`
- `TABELA_IE`: Metadados da tabela de regras de IE: versão e fontes gerais. As fontes por UF estão em `regraIe(uf).fontes`. `TABELA_IE: DescricaoTabelaIe`
