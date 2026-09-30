# @sinete/schemas

Código gerado dos XSD oficiais dos DF-e, por documento e pacote de liberação (PL): tipos TS, descritores de ordem e restrições, serializer canônico, decoder tolerante, validador estrito e a tabela de vigências que escolhe o PL por data e ambiente. Roda em Node (`^20.19.0 || >=22.12.0`), Bun, Deno e no browser, sem dependências além de `@sinete/core` e `@sinete/core/xml`.

Status: pré-alfa, API instável até a 1.0.

```ts
import { relogioFixo } from '@sinete/core';
import { decodeXml, selecionarPl, serialize, validateRoot } from '@sinete/schemas';
import { nfeProcElement, TNFe_infNFe } from '@sinete/schemas/nfe/PL_010f';

selecionarPl('nfe', 'producao', relogioFixo('2026-09-25T10:00:00-03:00')).modulo; // 'nfe/PL_010e'

const inf: TNFe_infNFe = { Id: 'NFe35...', versao: '4.00', ide, emit, det, total, transp, pag }; // os grupos montados
const xml = serialize(TNFe_infNFe, 'infNFe', inf); // forma canônica: é o C14N do elemento, pronto para assinar

const { value, issues } = decodeXml(nfeProcElement, recebido); // tolerante: issues em vez de exceção
const erros = validateRoot(nfeProcElement, recebido); // estrito: [] = válido
```

## Módulos

Cada subpath é autocontido e exporta, com o mesmo identificador, o tipo TS e o descritor de cada tipo complexo (`TNFe`, `TNFe_infNFe`, `TNFe_infNFe_det_imposto`...), os elementos raiz (`nfeProcElement`) e `schema` com a proveniência (pacote oficial, zip, sha256, URL). PL que você não importa custa zero no bundle.

| Subpath | Pacote oficial | Raízes |
|---|---|---|
| `nfe/PL_010f` | PL_010f_v1.04 | `NFe`, `nfeProc`, `enviNFe`, `retEnviNFe`, `consReciNFe`, `retConsReciNFe` |
| `nfe/PL_010e` | PL_010e_v1.02 | as mesmas |
| `mdfe/3.00b` | PL_MDFe_300b_NT012025_1.05 | `mdfeProc`, `MDFe` (infModal ligado a `rodo`, `aereo`, `aquav`, `ferrov`), `retMDFe` |
| `mdfe/eventos/3.00b` | PL_MDFe_300b_NT012025_1.05 | `eventoMDFe`, `retEventoMDFe`, `procEventoMDFe` (detEvento ligado aos sete schemas de evento do PL) |
| `mdfe/servicos/3.00b` | PL_MDFe_300b_NT012025_1.05 | `consStatServMDFe`, `retConsStatServMDFe`, `consSitMDFe`, `retConsSitMDFe`, `consMDFeNaoEnc`, `retConsMDFeNaoEnc` |
| `nfe/evento-cancelamento/PL_010d` | PL_010d_v1.03 + Evento_Canc_PL_v1.01 (e110111) | `envEvento`, `retEnvEvento`, `procEventoNFe` |
| `nfe/evento-cce/PL_010d` | PL_010d_v1.03 + Evento_CCe_PL_v1.01 (e110110) | as mesmas |
| `nfe/evento-cancelamento-substituicao/PL_010d` | PL_010d_v1.03 + Evento_CancSubst_v1.01 (e110112, só NFC-e) | as mesmas |
| `nfe/evento-confirmacao-operacao/PL_010d` | PL_010d_v1.03 + Evento_ManifestaDest_PL_v1.01 (e210200) | as mesmas |
| `nfe/evento-ciencia-operacao/PL_010d` | idem (e210210) | as mesmas |
| `nfe/evento-desconhecimento-operacao/PL_010d` | idem (e210220) | as mesmas |
| `nfe/evento-operacao-nao-realizada/PL_010d` | idem (e210240) | as mesmas |
| `nfe/inutilizacao/PL_010d` | PL_010d_v1.03 | `inutNFe`, `retInutNFe`, `ProcInutNFe` |
| `nfe/consulta-protocolo/PL_010d` | PL_010d_v1.03 | `consSitNFe`, `retConsSitNFe` |
| `nfe/consulta-cadastro/PL_010d` | PL_010d_v1.03 | `ConsCad`, `retConsCad` |
| `nfe/status-servico/PL_009q` | PL_009q_NT2025_001_v1.00 | `consStatServ`, `retConsStatServ` |
| `nfe/dist-dfe/PL_NFeDistDFe_104` | PL_NFeDistDFe_104 | `distDFeInt`, `retDistDFeInt`, `resNFe`, `resEvento` |
| `nfse/1.01-20260209` | NFSe-ESQUEMAS_XSD-v1.01-20260209 (NFS-e Nacional) | `DPS`, `NFSe`, `pedRegEvento`, `evento` |
| `nfse/1.01-20260727` | NFSe-ESQUEMAS_XSD-v1.01-20260727 (CNPJ alfanumérico) | as mesmas |

Os módulos da NFS-e trazem em `schema.patches` as correções documentadas sobre o XSD oficial: o `TSSerieDPS` de 09/02/2026 declara `^0{0,4}\d{1,5}$`, e em regex de XSD `^` e `$` são literais, então nenhuma série passaria; o módulo usa `0{0,4}\d{1,5}`. A `ds:Signature` da NFS-e é opaca (`$any`), porque o xmldsig do W3C usa construções fora do subconjunto do gerador. O `TSChaveNFSe` de 27/07/2026 (`[0-9]{6}([0-9A-Z]{14})[0-9]{30}`) põe o trecho alfanumérico nas posições 7 a 20, e não nas 10 a 23 da inscrição federal; o módulo segue o XSD oficial sem correção, e chave com CNPJ alfanumérico pode ser recusada por ele.

Os eventos, a consulta, a inutilização e o cadastro não vêm no zip do PL_010f: o portal da NF-e publica esses schemas em pacotes separados. O mais recente para eles é o PL_010d_v1.03 (CNPJ alfanumérico). O status do serviço só é redistribuído até o PL_009q. Cada evento é um módulo próprio porque a SEFAZ valida em duas etapas: o envelope genérico (onde `detEvento` é `xs:any`) e depois o `detEvento` pelo schema do tipo de evento; o módulo gerado junta as duas coisas. No MDF-e, os schemas dos eventos vêm no mesmo pacote do documento, então um módulo só liga o `detEvento` aos sete tipos como uma escolha; quem confere que o elemento é o do `tpEvento` (regra J06 do MOC 3.00b, rejeição 630) é o `@sinete/mdfe` ao montar e o simulador ao receber. O `retMDFe_v3.00.xsd` oficial declara o `tpAmb` do `TRetMDFe` sem tipo (`xs:anyType`); o gerador o aceita como texto porque está listado em `untypedAsText` no `modules.ts`, e o validador recusa filhos ali. O `retConsSitMDFe` do XSD aceita um único elemento dentro de `procEventoMDFe` (`xs:any`), mas o autorizador devolve `eventoMDFe` e `retEventoMDFe` juntos; o validador segue o XSD, e o `@sinete/mdfe` lê o retorno pelo decoder tolerante.

## Modelo de valores (ADR 0002)

- Valores simples são **strings lexicais**, inclusive decimais (`'123.40'`): nada se perde em formatação. Enumerações viram união de literais.
- `xs:choice` vira **união exclusiva**: CNPJ e CPF juntos no emitente não compilam.
- Nomes estáveis: tipo nomeado mantém o nome do XSD; anônimo recebe o caminho (`TNFe.infNFe.det.imposto` vira `TNFe_infNFe_det_imposto`).
- Sequência repetível (`cMsg`/`xMsg` do `infProt`) vira arrays zipados por índice.
- `xs:any processContents="skip"` sem ligação vira `$any: string[]` com o XML bruto de cada elemento, na ordem; `xs:anyAttribute` vira `$attrs`. Conteúdo simples com atributos (`docZip`) tem o texto em `$text`.
- Tipos com `Signature` obrigatória (`TNFe`, `TEvento`, `TInutNFe`) descrevem o documento assinado. Para emitir, serialize o elemento assinado (`infNFe`, `infEvento`), monte o envelope e assine com o `@sinete/core/xml`, que insere a `Signature` sem reserializar.

## Runtime

| Função | O que faz |
|---|---|
| `serialize(ct, nome, valor, nsHerdado?)`, `serializeRoot(raiz, valor)` | forma canônica, na ordem do XSD; é o C14N do elemento (o de `serializeRoot` inclui o `xmlns`) |
| `decode(ct, el)`, `decodeRoot(raiz, doc)`, `decodeXml(raiz, xml)` | decoder tolerante: `{ value, issues }` com `elemento_desconhecido`, `whitespace_descartado`, `namespace_divergente`... |
| `validate(ct, el)`, `validateRoot(raiz, xml)`, `assertValid(raiz, xml)` | validador estrito: modelo de conteúdo, atributos, facetas, espaço léxico dos tipos embutidos, `xs:unique`, `ID` único. `assertValid` lança `ErroDeValidacao` do core |
| `selecionarPl(familia, ambiente, relogio)`, `VIGENCIAS` | PL por data (dia de Brasília) e ambiente, nunca por tentativa; `VigenciaError` (`pl_sem_vigencia`) fora de toda vigência |
| `xsdRegexToJs`, `compileXsdRegex`, `checkSimple`, `compareDecimal` | utilitários do validador |

As ocorrências seguem o `Ocorrencia` do core (`caminho`, `code`, `mensagem`) e nunca trazem o valor do campo, só a regra e o caminho.

## Vigências (`src/data/vigencia.json`)

| Família | PL | Homologação | Produção | Fonte |
|---|---|---|---|---|
| `nfe` | PL_010e_v1.02 | 2026-07-01 | 2026-08-03 | NT 2025.002 v1.51, cronograma da versão 1.40 |
| `nfe` | PL_010f_v1.04 | 2026-09-01 | 2026-11-03 | NT 2025.002 v1.51 (versão 1.50) e NT 2026.007 v1.00 |
| `mdfe`, `mdfe/eventos`, `mdfe/servicos` | 3.00b (NT 2025.001) | 2025-07-01 | 2025-10-06 | NT MDF-e 2025.001 v1.03 e aviso do portal |
| eventos, inutilização, consultas | PL_010d_v1.03 | 2026-06-15 | 2026-07-01 | NT 2026.004 v1.01 (CNPJ alfanumérico) |
| `nfe/status-servico`, `nfe/dist-dfe` | PL_009q, PL_NFeDistDFe_104 | sem data | sem data | sem cronograma próprio publicado |
| `nfse` | NFSe_v1.01_20260209 | 2026-02-09 | 2026-02-09 | Documentação Atual do Portal NFS-e (data do nome do pacote) |
| `nfse` | NFSe_v1.01_20260727 | 2026-07-27 | 2026-08-10 | notícia do Portal NFS-e de 28/07/2026 |

Na NFS-e, homologação é a produção restrita. A página de Documentação Atual (atualizada em 15/08/2026) ainda lista o pacote de 09/02/2026 como o de produção, enquanto a notícia de 28/07/2026 diz que os esquemas do CNPJ alfanumérico entraram em produção em 10/08/2026; a tabela segue a notícia. Datas de homologação das NT são "até" e podem variar por UF; a tabela registra a data da NT. Em 25/09/2026, produção usa o PL_010e e homologação usa o PL_010f.

## Conformidade

- Round-trip no corpus local (3.615 nfeProc, 600 eventos, 372 mdfeProc; dados fora do repo): o SHA-1 da reserialização do elemento assinado confere com o `DigestValue` em 100% dos documentos cuja assinatura original confere.
- Validador contra `xmllint --schema` (libxml2) no mesmo corpus: veredito igual em 100% dos documentos. Em 2.700 mutações (remover, duplicar e trocar elementos, alterar texto), igual em 2.694; as 6 diferenças são um bug de regex do libxml2 (ver `tools/xsd-codegen/README.md`), em que o validador segue a spec.
- Os scripts ficam em `tools/xsd-codegen/src/corpus-check/` e só rodam localmente.

## Regenerar

O código em `src/nfe`, `src/mdfe`, `src/nfse` e `package.json#exports` é gerado por `tools/xsd-codegen` (não edite à mão). Um teste deste pacote roda o gerador em modo `--check`, que falha se a saída versionada divergir da regenerada ou se algum XSD não bater com o sha256 do `SOURCE.md`.

## Licença

Apache-2.0. Os XSD oficiais são artefatos públicos do governo, guardados sem alteração em `tools/xsd-codegen/xsd/` com a proveniência de cada um.
