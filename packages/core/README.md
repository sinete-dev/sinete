# @sinete/core

A base de todos os pacotes do sinete: erros tipados, desfechos discriminados da SEFAZ, relógio injetável, logger estruturado, ambiente e tabela de UFs e, no subpath `@sinete/core/xml`, o parser XML estrito, o C14N e o XMLDSig no perfil dos DF-e. Sem dependências e sem API de runtime: roda igual em Node (`^20.19.0 || >=22.12.0`), Bun, Deno e no browser.

Status: pré-alfa, API instável até a 1.0.

```ts
import { relogioFixo, formatarDataHoraComFuso, tratarResultado, ufPorSigla } from '@sinete/core';

const clock = relogioFixo('2026-09-25T09:00:00-03:00');
formatarDataHoraComFuso(clock.agora(), -180); // '2026-09-25T09:00:00-03:00'
ufPorSigla('MT'); // { sigla: 'MT', cUF: '51', nome: 'Mato Grosso', regiao: 'CO' }
```

## Convenções

- Identificadores da API em inglês; termos do leiaute com o nome do MOC (`cStat`, `xMotivo`, `cUF`, `tpAmb`); termos fiscais sem tradução boa em português (`Ambiente`, `emissao`, `fatoGerador`).
- Valores do leiaute na forma lexical do XML: `cStat` é `'100'`, `cUF` é `'35'`, `tpAmb` é `'2'`. Conversão de número e data fica na borda. Na NFS-e Nacional o `cStat` da rejeição é o código de erro do Anexo I ou II (`'E0312'`), e `ehCStat` aceita as duas formas.

## Erros

Todo erro lançado pelo sinete é `ErroSinete`, com `code` estável (snake_case, português, sem acento), `cause` preservada e `detalhes` serializáveis. O `code` é API pública; renomear um código é major. Nunca decida nada pela mensagem.

| Classe | `code` | Quando |
|---|---|---|
| `ErroDeConfiguracao` | `config_invalida` | opção do chamador ausente ou fora do domínio |
| `ErroDeValidacao` | `validacao_falhou` | dado recusado pela validação local; `ocorrencias` traz todas as ocorrências |
| `ErroNaoSuportado` | `nao_suportado` | a runtime não suporta o recurso pedido |
| `ErroDeTempoEsgotado` | `tempo_esgotado` | operação passou do prazo; `timeoutMs` |
| `ErroRespostaInvalida` | `resposta_invalida` | resposta fora do leiaute (XML malformado, `cStat` inválido) |
| `ErroSefaz` | `sefaz_rejeitou`, `sefaz_denegou`, `sefaz_pendente` | só pelo `exigirAutorizado`; traz `cStat` e `xMotivo` |

Cada ocorrência de um `ErroDeValidacao` é uma `Ocorrencia` com `caminho`, `code`, `mensagem` e `origem`: `entrada` quando a conferência foi sobre a entrada do domínio (o caminho é dela e corrigir o valor ali resolve), `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD, chave gerada, cálculo). Os montadores sempre preenchem; ausente, a ocorrência não foi classificada. Para mostrar o caminho em português, cada pacote de documento tem o seu `rotuloDoCaminho`, montado com `criarRotuloDoCaminho` e `normalizarCaminho` daqui (ADR 0011).

Os outros pacotes estendem `ErroSinete` com códigos próprios. `ehErroSinete(e, code?)` reconhece o erro mesmo vindo de outra cópia do pacote no mesmo processo, onde `instanceof` falharia.

## Desfechos da SEFAZ

Rejeição não é exceção. Toda operação que chega a uma resposta devolve `ResultadoSefaz<T>`:

| `tipo` | Significado |
|---|---|
| `autorizado` | autorizado; `valor` traz o protocolo |
| `recusado` | recusado, pode corrigir e reenviar; `dica` opcional com causa provável, correção e origem da regra (preenchido pelo `@sinete/rejeicoes`) |
| `denegado` | uso denegado; o número fica consumido e `valor` traz o protocolo de denegação |
| `pendente` | recebido e ainda não processado; `referencia` para consultar e `aguardarMs` |

`tratarResultado` obriga a tratar os quatro casos; `exigirAutorizado` devolve o valor ou lança `ErroSefaz`. Qual `cStat` é qual desfecho é dado do pacote do documento, não do core.

## Relógio

Nenhuma função do sinete chama `new Date()` por conta própria (regra do Biome no repo inteiro, exceto `src/clock.ts`). Quem precisa de tempo recebe um `Relogio`.

Existem dois relógios, reunidos em `ContextoDeTempo`:

- **emissão** (`emissao`): o instante em que o documento é gerado e transmitido. Alimenta `dhEmi`, `dhEvento`, prazos, timeouts, contingência e a escolha do pacote de liberação vigente.
- **fato gerador** (`fatoGerador`): a data do fato que o documento registra. Decide a regra tributária com vigência (alíquotas e classificações de IBS/CBS). Pode ser anterior à emissão. Sem valor explícito, vale o da emissão.

`relogioDoSistema` para produção (só na borda da aplicação), `relogioFixo` e `relogioManual` para teste e reprocessamento. Instantes em texto exigem fuso explícito. `formatarDataHoraComFuso` formata no padrão `TDateTimeUTC` dos leiautes com o deslocamento informado pelo chamador, sem depender do fuso da máquina.

## Logger

`Logger` estruturado (`debug`, `info`, `warn`, `error`, `child`), com `loggerSilencioso` como padrão e `loggerEmMemoria` para testes. Nunca logue chave, PIN, certificado ou o XML inteiro: identifique o documento pela chave de acesso.

## Ambiente e UFs

`Ambiente` é `'producao' | 'homologacao'`; `tpAmbDoAmbiente` e `ambienteDoTpAmb` convertem para o `tpAmb` do leiaute.

A tabela de UFs vive em `src/data/ufs.json`, com versão, fontes e data de coleta (princípio "dados como dados"). `UFS`, `ufPorSigla`, `ufPorCUf`, `ehUf`, `ehCUf` e `TABELA_UFS` (metadados). A sigla `EX` do leiaute não é UF e fica fora.

## Versão do aplicativo emissor

`formatarVerProc(nome, versao)` monta o `verProc` (NF-e, MDF-e) e o `verAplic` (NFS-e) padrão de cada pacote (`sinete <versão do pacote>`), cortando a versão com segurança se passar do limite de 20 caracteres do leiaute.

## XML e XMLDSig (`@sinete/core/xml`)

Morava no pacote `@sinete/xml` até a reorganização dos pacotes (ADR 0008): é parte do core porque não tem dependência, todo pacote de documento usa e não tem público avulso que justifique uma versão própria.

Parser XML estrito com offsets, C14N 1.0 inclusivo e XMLDSig no perfil dos DF-e (assinar e verificar), sem DOM e sem dependências de runtime. A criptografia é a WebCrypto de `globalThis.crypto`, então o mesmo código roda em Node (`^20.19.0 || >=22.12.0`), Bun, Deno e no browser.

```ts
import { assinarXml, conferirAssinatura } from '@sinete/core/xml';

// signer: qualquer Assinador do @sinete/core (A1 via WebCrypto, A3 via PKCS#11, HSM)
const assinado = await assinarXml(xml, { id: 'NFe3526...' }, signer);
// `assinado` é `xml` com exatamente uma inserção: é essa string que vai para a SEFAZ e para o banco.

const r = await conferirAssinatura(assinado, { id: 'NFe3526...', elemento: 'infNFe' });
if (r.ok) usar(r.elemento); // leia os dados do elemento assinado, não de outro lugar do documento
else console.log(r.motivo); // 'digest-diverge', 'assinatura-invalida', 'id-duplicado', ...
```

### Decisões (ADR 0003)

- **Assinar a string final e nunca mais tocar nela.** A assinatura tem três fases: `prepararAssinatura` calcula o digest e insere o `<Signature>` por splice como último filho do pai do elemento referenciado (depois de `infNFeSupl` e `infMDFeSupl`, como os schemas pedem), com um marcador no `SignatureValue`; `assinarPreparada` pede a assinatura ao `Assinador`; `montarAssinatura` troca o marcador. Nada é reparseado para gerar a saída nem reserializado.
- **`Assinador` do `@sinete/core` nos dois modos.** `dados` recebe os bytes do `SignedInfo` canonicalizado (WebCrypto, `CKM_SHA1_RSA_PKCS`); `digest` recebe só o DigestInfo SHA-1 de 35 bytes (`CKM_RSA_PKCS` em PKCS#11, HSM, A3 em nuvem), e o documento não sai do processo. As duas saídas são idênticas byte a byte (teste).
- **O verificador exige o `Id` esperado** e recusa `Id` duplicado ou duas assinaturas para o mesmo `Id` (signature wrapping). Devolve um resultado discriminado, nunca lança por causa do documento. Em `digest-diverge`, `signedInfoValido` separa "documento alterado depois de assinado" (`true`) de "assinatura que nunca foi válida" (`false`).
- **Perfil estreito.** C14N 1.0 inclusivo sem comentários, uma `Reference` com `URI="#Id"`, transforms `enveloped-signature` e C14N, RSA PKCS#1 v1.5. A assinatura produzida é RSA-SHA1 com digest SHA-1 (o perfil SEFAZ); a verificação aceita também SHA-256.
- **Parser estrito.** Recusa `&` sem escape, entidade desconhecida, DTD, `<` em atributo, `]]>` em texto, atributo duplicado, prefixo não declarado, caractere fora da produção `Char`, aninhamento acima de 256 níveis (o limite do libxml2, para que nenhuma travessia recursiva estoure a pilha) e o resto do que não é XML 1.0 bem formado com namespaces. O erro é `ErroXml` (`xml_malformado`) com `posicao`. Um documento que outra biblioteca aceitaria pode ser recusado aqui; isso é intencional.
- Envelopes (`nfeProc`, `procEventoNFe`) montados em volta de um documento assinado não podem declarar namespaces novos nos ancestrais do elemento assinado: o C14N inclusivo leva esses namespaces para dentro do digest.

### API

| Função | O que faz |
|---|---|
| `lerXml(xml)` | `DocumentoXml` com `raiz`, `texto` intacto e `ids` (valor do atributo `Id` para os elementos) |
| `elementosFilhos`, `primeiroFilho`, `descendentes`, `textoDe`, `atributoDe`, `namespacesEmEscopo` | navegação na árvore |
| `c14n(el, { excluir })` | C14N 1.0 inclusivo do elemento e descendentes |
| `escaparTextoC14n`, `escaparAtributoC14n` | os escapes do C14N (o serializer do `@sinete/schemas` usa os mesmos) |
| `conferirAssinatura(xml, { id, elemento? })` | `ResultadoConferencia` discriminado |
| `prepararAssinatura`, `assinarPreparada`, `montarAssinatura`, `assinarXml` | assinatura em três fases |
| `codificarBase64`, `decodificarBase64`, `extrairSpki` | utilitários sem `Buffer` |

Erros: `ErroXml` (`xml_malformado`, com `posicao`) e `ErroAssinaturaXml` (`xmldsig_falhou`, com `motivo`), os dois `ErroSinete`.

### Testes

- 12 casos de borda sintéticos do C14N em `test/xml/fixtures/edge/` (CRLF, referências a CR e TAB, whitespace em atributo, entidades e acentos, CDATA com comentário e PI, ordem de atributos com prefixo, namespaces e `xml:lang` herdados, `xmlns=""`, aspas simples, elementos vazios, evento sem `xmlns` no `infEvento`). Foram assinados por `test/xml/fixtures/edge/gerar.ts` com uma chave descartável e aceitos pelo xmlsec1; o teste verifica os arquivos commitados com o verificador próprio e, se o xmlsec1 estiver instalado, com ele também.
- As chaves dos testes são geradas na hora com WebCrypto (`test/xml/helpers/test-keys.ts`); nenhuma chave vai para o repo.

## Licença

Apache-2.0.
