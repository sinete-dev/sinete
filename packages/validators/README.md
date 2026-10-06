# @sinete/validators

CPF, CNPJ (numérico e alfanumérico), CAEPF, chave de acesso de DF-e e inscrição estadual das 27 UFs. Funções puras, sem API de runtime: rodam igual em Node (`^20.19.0 || >=22.12.0`), Bun, Deno e no browser. Única dependência: `@sinete/core`.

Status: pré-alfa, API instável até a 1.0.

```ts
import { lerChaveAcesso, lerCnpj, lerIe } from '@sinete/validators';

lerCnpj('12.ABC.345/01DE-35'); // { ok: true, valor: '12ABC34501DE35' }
lerIe('0013000001-9', 'MT'); // { ok: true, valor: { tipo: 'numero', valor: '00130000019', formatada: '0013000001-9', ... } }
lerIe('isento', 'SP'); // { ok: true, valor: { tipo: 'isento', valor: 'ISENTO' } }
const ch = lerChaveAcesso('5206 0433 0099 1100 2506 5501 2000 0007 8002 6730 1615', { leiaute: '1.10' }); // exemplo do MOC, de 2006
if (ch.ok) ch.valor.uf; // 'GO'
```

## Forma da API

Cada documento tem `lerX(entrada, opcoes?)`, a conferência booleana (`cpfValido`, `cnpjValido`, `caepfValido`, `chaveAcessoValida`, `ieValida`) e `formatarX(valor)`, e o cálculo do dígito exposto (`calcularDvCpf`, `calcularDvCnpj`, `calcularDvCaepf`, `calcularDvChaveAcesso`, `calcularDvIe`).

`lerX` devolve o `Resultado` do core: `{ ok: true, valor }` com o valor normalizado (sem máscara, maiúsculo, no tamanho do leiaute) ou `{ ok: false, erro }` com uma `Ocorrencia` (`caminho`, `code`, `mensagem`). O `caminho` padrão é o nome do campo; passe `{ caminho: 'infNFe.dest.IE' }` para compor um `ErroDeValidacao` com várias ocorrências. Os códigos estão em `CODIGOS_OCORRENCIA` e são API pública (renomear é major).

Entrada aceita: máscara (ponto, hífen, barra, espaço), espaços nas pontas e minúsculas. `formatarX` não valida, exceto `formatarIe`, que precisa da variante da UF para escolher a máscara.

## Regras e fontes

| Documento | Regra | Fonte |
|---|---|---|
| CPF | módulo 11, pesos 10 a 2 e 11 a 2 | regra da RFB (cadastro regido pela IN RFB 2.172/2024) |
| CNPJ | `[A-Z0-9]{12}[0-9]{2}`; módulo 11, pesos 2 a 9; cada caractere vale ASCII menos 48 (A=17) | NT Conjunta 2025.001 v1.00, itens 2 e 4; NT 2026.004 (NF-e/NFC-e) |
| CAEPF | DV do CNPJ sobre os 12 primeiros, mais 12, módulo 100 | regra da RFB para o CAEPF (IN RFB 1.828/2018), conferida contra a implementação anterior dos mesmos titulares |
| Chave de acesso | `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`; DV módulo 11 com ASCII menos 48 | MOC 7.0 Visão Geral, item 2.2.6; NT Conjunta 2025.001, item 5 e Anexo II |
| IE | por UF, tabela `src/data/ie.json` | roteiro de cada UF no Sintegra e páginas das SEFAZ, URL por UF em `regraIe(uf).fontes` |

A NT 2025.001 menciona que as letras I, O, U, Q e F podem vir a ser vedadas no CNPJ alfanumérico, sem confirmação da RFB; o validador segue a expressão do schema e aceita todas.

### Chave de acesso

`lerChaveAcesso` decompõe em `cUF`, `uf`, `aamm`, `ano`, `mes`, `emitente` (as 14 posições), `cnpj` ou `cpf` (quando válidos; CPF vem com `000` à esquerda, MOC 2.2.6.1), `mod`, `documento`, `serie`, `nNF`, `leiaute`, `tpEmis`, `cNF` e `cDV`. Os domínios estão em `src/data/chave.json`, cada um com a regra de origem:

| Componente | Regra | Origem | Ocorrência |
|---|---|---|---|
| DV | módulo 11, pesos 2 a 9, ASCII menos 48 | MOC Visão Geral 2.2.6.2; NT 2025.001 item 5; RV BA02-10 | `chave_dv_invalido` |
| cUF | código IBGE de UF existente | RV BA02-14 | `chave_uf_invalida` |
| AAMM | mês 01 a 12; ano a partir de 06; com `relogio`, não posterior ao ano corrente | RV BA02-24 e BA02-20 | `chave_mes_invalido`, `chave_ano_invalido` |
| mod | 55, 65, 57, 67, 58, 62, 63, 66; 59 (CF-e SAT) recusado à parte, porque a chave dele tem outra composição (fora do escopo por enquanto) | B06; demais modelos pelos MOCs de cada DF-e | `chave_modelo_invalido`, `chave_modelo_nao_suportado` |
| nNF | 1 a 999999999 | TNF; RV BA02-40 | `chave_numero_invalido` |
| tpEmis | 1 a 7 e 9 | campo B22 | `chave_tpemis_invalido` |
| leiaute | padrão 2.00 (tpEmis e cNF de 8); 1.10 (sem tpEmis, cNF de 9) só com `leiaute: '1.10'`. Sem detecção automática: no 1.10 a posição do tpEmis é parte do cNF e pode coincidir com um tpEmis válido, e chaves anteriores a 2011 já passaram do prazo legal de guarda de 5 anos | MOC Visão Geral 2.2.6.3 | |
| emitente | modelos 55 e 65: série 0 a 909 exige CNPJ, 910 a 969 exige CPF; demais: CNPJ ou CPF | RV BA02-30 | `chave_emitente_invalido` |
| CNPJ alfanumérico | só com AAMM a partir de 2607 | NT 2026.004 v1.01; NT 2025.001 item 5 | `chave_cnpj_alfanumerico_fora_da_vigencia` |

Com `emissao: true` entram as regras de uma emissão nova, que chaves antigas já autorizadas podem não cumprir: série até 969 e NFC-e sem emitente CPF (B07, C02a-04, `chave_serie_invalida`), tpEmis por modelo (NF-e sem 3 e 9, NFC-e só 1, 4 e 9; B22, B22-10, B22-34) e cNF fora da lista de sequências proibidas e diferente do nNF (B03-10, `chave_cnf_invalido`).

`montarChaveAcesso` monta a chave com o DV a partir das partes.

### Inscrição estadual

`src/data/ie.json` descreve cada UF como uma lista de variantes: tamanho, padrão, máscara e os dígitos verificadores (posição, pesos, módulo, complemento ou resto, e os casos especiais: faixas do Amapá e de Goiás, soma de algarismos de Minas Gerais, multiplicação por 10 de Alagoas e Rio Grande do Norte). O código só interpreta a tabela. A primeira variante que casa em tamanho, padrão e DV vence; `valor.variante` diz qual foi e `valor.legado` marca formatos anteriores ao vigente (Rondônia antes de 08/2000, Tocantins antes da Portaria 676/2002, CACEPE de Pernambuco), que `aceitarLegado: false` recusa.

Zeros à esquerda a mais ou a menos são ajustados ao tamanho da variante, como a SEFAZ faz (MOC 7.0, Anexo I, nota *2 das regras C17-20, E16a e X07). O valor devolvido é a forma do XML; `formatada` usa a máscara do roteiro oficial quando ele traz uma.

Casos que a tabela registra em `notas`:

- **SP, produtor rural**: `P` + 12 algarismos, DV na 10ª posição. O `TIe` do leiaute da NF-e só aceita algarismos.
- **GO**: o roteiro da Secretaria da Economia lista os prefixos 10, 11 e 15, o do Sintegra 10, 11 e 20 a 29; vale a união.
- **DF**: o `07` do exemplo oficial é parte do número sequencial, não prefixo fixo.
- **RJ**: o roteiro é uma imagem com pesos e módulo; resto 0 ou 1 dá DV 0, como nas demais UFs de módulo 11.

### ISENTO

O literal `ISENTO` (qualquer caixa) volta como `{ tipo: 'isento' }`; `aceitarIsento: false` recusa. Onde ele vale, pelo MOC 7.0, Anexo I:

| Campo | Regra | Rejeição |
|---|---|---|
| `emit/IE` | só na NF-e avulsa (série 890 a 919); modelo 65 nunca | C17-30, 554 |
| `dest/IE` | contribuinte isento usa `indIEDest=2` e **não informa** a tag IE | E16a nota 3, E17-30, 791 |
| `dest` isento | a UF do destinatário pode não admitir contribuinte isento | E16a-30, 805 |
| `transp/transporta/IE` | literal `ISENTO` para transportador isento | X07-20, 544 |
| `refNFP/IE` | IE do produtor ou `ISENTO` | BA15 |

O validador não decide qual campo aceita `ISENTO`: quem monta o documento passa `aceitarIsento` conforme o campo.

### Tabela de CFOP

`indicadoresCfop('5202')` devolve a vigência e os indicadores do CFOP na Tabela de CFOP do Portal da NF-e (`indNFe`, `indComunica`, `indTransp`, `indDevol`, `indRetor`, `indAnula`, `indRemes`, `indComb`, `indExcIBSCBS`), ou `undefined` para o código fora da tabela. `TABELA_CFOP` traz a fonte e o sha256 da planilha. O dado sai de `tools/cfop-data` (IT 2023.002 v2.10, publicada em 04/09/2026). As regras da SEFAZ que consultam a tabela (I08-144 e N12-70) estão no `@sinete/nfe`, que não recusa o CFOP desconhecido.

## Verificação

- Testes com os exemplos de cada roteiro oficial (válidos e com o DV trocado), mais testes de propriedade por UF e variante: IE gerada com `completarIe` valida, DV trocado falha, algarismo da base trocado falha em mais de 75% dos casos (o módulo 11 com resto 0 e 1 levados a 0 deixa passar cerca de 1 em 11).
- `tools/ie-crosscheck` confronta o `lerIe` com outra implementação sobre uma lista local de pares UF e IE e imprime só estatísticas agregadas.

## Licença

Apache-2.0.
