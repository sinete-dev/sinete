# Referência: `@sinete/validators`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/validators/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/validators/x` é `sinete/validators/x`.

## `@sinete/validators`

`@sinete/validators`: CPF, CNPJ (numérico e alfanumérico), CAEPF, chave de acesso e inscrição estadual das 27 UFs.

Funções puras, sem API de runtime. Cada documento tem `parseX` (devolve `Result` com o valor normalizado ou uma `ValidationIssue` de código estável), `isValidX` e `formatX`; os códigos das ocorrências compõem o `ValidationError` do `@sinete/core`.

### Funções

- `buildChaveAcesso`: Monta a chave com o DV a partir das partes, completando zeros à esquerda. Não valida o emitente. `buildChaveAcesso(parts: ChaveAcessoParts): string`
- `caepfCheckDigits`: Os 2 dígitos de controle do CAEPF para uma base de 12 algarismos. `caepfCheckDigits(base: string): string`
- `chaveAcessoCheckDigit`: O DV (1 algarismo) dos 43 primeiros caracteres da chave. `chaveAcessoCheckDigit(base: string): string`
- `cnpjCheckDigits`: Os 2 dígitos verificadores de uma base de 12 caracteres (algarismos ou letras maiúsculas). `cnpjCheckDigits(base: string): string`
- `completeIe`: Preenche os dígitos verificadores de uma inscrição, na ordem da tabela (útil para gerar massa de teste). `base` tem o tamanho da variante; o que estiver nas posições dos DV é sobrescrito. `completeIe(base: string, uf: Uf, variantId?: string): string`
- `cpfCheckDigits`: Os 2 dígitos verificadores de uma base de 9 algarismos. `cpfCheckDigits(base: string): string`
- `formatCaepf`: `000.000.000/000-00`. Não valida. `formatCaepf(value: string): string`
- `formatChaveAcesso`: Chave em 11 blocos de 4, como no DANFE. Não valida. `formatChaveAcesso(value: string): string`
- `formatCnpj`: `00.000.000/0000-00`, também para o alfanumérico (`12.ABC.345/01DE-35`). Não valida. `formatCnpj(value: string): string`
- `formatCpf`: `000.000.000-00`. Não valida: formate só o que já passou por `parseCpf`. `formatCpf(value: string): string`
- `formatIe`: Formata com a máscara da UF se a inscrição for válida; senão devolve a entrada sem mudança. `formatIe(input: string, uf: Uf): string`
- `ieCheckDigits`: Dígitos aceitos na posição `check.at` de `value` (as demais posições do cálculo já preenchidas). `ieCheckDigits(value: string, check: IeCheck): readonly number[]`
- `ieRule`: Regra de IE da UF (variantes, máscaras e fontes). `ieRule(uf: Uf): IeUfRule`
- `isAlphanumericCnpj`: Verdadeiro se o CNPJ (já normalizado ou com máscara) tem alguma letra na raiz ou na ordem. `isAlphanumericCnpj(value: string): boolean`
- `isIeIsento`: Verdadeiro se o texto é o literal `ISENTO`, ignorando caixa e espaços nas pontas. `isIeIsento(input: string): boolean`
- `isValidCaepf`: `isValidCaepf(input: string): boolean`
- `isValidChaveAcesso`: `isValidChaveAcesso(input: string, options?: ChaveParseOptions): boolean`
- `isValidCnpj`: `isValidCnpj(input: string): boolean`
- `isValidCpf`: `isValidCpf(input: string): boolean`
- `isValidIe`: `isValidIe(input: string, uf: Uf, options?: IeParseOptions): boolean`
- `parseCaepf`: Valida e normaliza um CAEPF (aceita máscara); devolve os 14 algarismos. `parseCaepf(input: string, options?: ParseOptions): Result<string, ValidationIssue>`
- `parseChaveAcesso`: Valida e decompõe a chave de acesso (aceita espaços, como no DANFE, e minúsculas). Cada componente é conferido contra o domínio do leiaute, com a regra de origem em `data/chave.json`. `parseChaveAcesso(input: string, options?: ChaveParseOptions): Result<ChaveAcesso, ValidationIssue>`
- `parseCnpj`: Valida e normaliza um CNPJ, numérico ou alfanumérico (aceita máscara e minúsculas); devolve os 14 caracteres. `parseCnpj(input: string, options?: ParseOptions): Result<string, ValidationIssue>`
- `parseCpf`: Valida e normaliza um CPF (aceita máscara); devolve só os 11 algarismos. `parseCpf(input: string, options?: ParseOptions): Result<string, ValidationIssue>`
- `parseIe`: Valida e normaliza a inscrição estadual para a UF. Aceita máscara (ponto, hífen, barra, espaço), minúsculas e zeros à esquerda a mais ou a menos. `parseIe(input: string, uf: Uf, options?: IeParseOptions): Result<InscricaoEstadual, ValidationIssue>`

### Interfaces

- `ChaveAcesso`: Chave de acesso decomposta. Os campos têm a forma lexical do leiaute (strings com zeros à esquerda). Membros: `chave`, `cUF`, `uf`, `aamm`, `ano`, `mes`, `emitente`, `cnpj`, `cpf`, `mod`, `documento`, `serie`, `nNF`, `layout`, `tpEmis`, `cNF`, `cDV`.
- `ChaveAcessoParts`: Membros: `cUF`, `aamm`, `emitente`, `mod`, `serie`, `nNF`, `tpEmis`, `cNF`.
- `ChaveParseOptions` (estende `ParseOptions`): Membros: `checkEmitente`, `emissao`, `clock`, `layout`.
- `IeCheck`: Um dígito verificador. Membros: `at`, `over`, `weights`, `mod`, `result`, `map`, `digitSum`, `times`, `add`, `ranges`.
- `IeParseOptions` (estende `ParseOptions`): Membros: `allowIsento`, `allowLegacy`.
- `IeRange`: Faixa de números em que a regra de um dígito muda (Amapá, Goiás). Membros: `slice`, `min`, `max`, `add`, `map`.
- `IeTableInfo`: Membros: `schemaVersion`, `version`, `sources`.
- `IeUfRule`: Membros: `sources`, `notes`, `variants`.
- `IeVariant`: Membros: `id`, `length`, `pattern`, `mask`, `legacy`, `checks`.
- `ParseOptions`: Membros: `path`.

### Tipos

- `InscricaoEstadual`: Inscrição reconhecida.
- `ValidationIssueCode`: `type ValidationIssueCode = (typeof VALIDATION_ISSUE_CODES)[number]`

### Constantes

- `CNPJ_ALFANUMERICO_VIGENCIA`: Vigência do CNPJ alfanumérico nos DF-e: NT 2026.004 v1.01 (NF-e/NFC-e), produção a partir de 1º de julho de 2026. Chave com letra no CNPJ e AAMM anterior é recusada pela SEFAZ como CNPJ inválido (NT 2025.001, item 5, nota aos autorizadores). `CNPJ_ALFANUMERICO_VIGENCIA: { readonly aamm: string; readonly source: string; }`
- `IE_ISENTO`: Literal do leiaute para contribuinte isento de inscrição (TIe e TIeDest do schema). `IE_ISENTO: 'ISENTO'`
- `IE_TABLE`: Metadados da tabela de regras de IE: versão e fontes gerais. As fontes por UF estão em `ieRule(uf).sources`. `IE_TABLE: IeTableInfo`
- `VALIDATION_ISSUE_CODES`: Códigos estáveis das ocorrências dos validadores (API pública: renomear é major). `VALIDATION_ISSUE_CODES: readonly ['cpf_caractere_invalido', 'cpf_tamanho_invalido', 'cpf_digitos_repetidos', 'cpf_dv_invalido', 'cpf_base_invalida', 'cnpj_caractere_invalido', 'cnpj_tamanho_invalido', 'cnpj_formato_invalido', 'cnpj_digitos…`
