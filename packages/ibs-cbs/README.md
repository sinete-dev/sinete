# @sinete/ibs-cbs

O IBS e a CBS da reforma tributária do consumo para qualquer DF-e: alíquotas por data de fato gerador, cálculo nos grupos da NT 2025.002, regras de validação que dá para conferir sem o banco da SEFAZ e determinação do CST e do cClassTrib a partir de fatos de negócio. O motor não conhece o leiaute de nenhum documento: recebe uma operação classificada e devolve os grupos `IBSCBS` e o `IBSCBSTot`, que servem à NF-e, à NFC-e, ao CT-e, à NFCom e aos demais. A cola de cada documento fica no pacote dele (na NF-e, `packages/nfe/src/rtc.ts`).

Os dados oficiais (CST, cClassTrib, tratamentos, anexos, atores) ficam no [`@sinete/ibs-cbs-dados`](../ibs-cbs-dados), que é versionado pelo mês dos dados e muda num ritmo diferente do código.

Status: pré-alfa, API instável até a 1.0.

## Quem usa o quê

- **Quem emite NF-e ou NFC-e** não precisa importar este pacote: o `@sinete/nfe` calcula por padrão e reexporta o motor e o leitor do dataset em `@sinete/nfe/ibs-cbs`.
- **ERP, PDV ou outro DF-e** (CT-e, NFCom) importa daqui: a raiz tem tudo, e os subpaths dão só uma parte, para não levar ao bundle o que não usa.

| Entrada | O que tem |
|---|---|
| `@sinete/ibs-cbs` | as quatro partes abaixo |
| `@sinete/ibs-cbs/aliquotas` | alíquotas nominais e de referência por data, com estado da fonte (`aliquotasOficiais`, `comAliquotasInformadas`, `exigirAliquota`) |
| `@sinete/ibs-cbs/calcular` | cálculo puro e determinístico a partir da operação classificada (`calcular`, `calcularEm`, `Decimal`) |
| `@sinete/ibs-cbs/validar` | regras da NT 2025.002 como funções puras (`validar`, `documentoDoRoc`, `REGRAS`, `TABELAS_NT`) |
| `@sinete/ibs-cbs/determinar` | restrições oficiais, regras legais e resolvedores plugáveis (`restringir`, `determinar`, `paraClassificado`) |

A raiz e os subpaths saem do mesmo build com code splitting: `Decimal` ou `ErroClassificacao` importados por um caminho ou pelo outro são a mesma classe.

Até a reorganização dos pacotes (ADR 0008), cada parte era um pacote: `@sinete/rtc-rates`, `@sinete/rtc-engine`, `@sinete/rtc-rules` e `@sinete/rtc-determine`.

## Alíquotas (`@sinete/ibs-cbs/aliquotas`)

Alíquotas nominais e de referência do IBS (UF e município) e da CBS por data de fato gerador, com o estado de cada uma. Separado do `@sinete/ibs-cbs-dados` porque a cadência é outra: alíquota muda por lei e resolução do Senado, não por versão da Calculadora.

```ts
import { aliquotasOficiais, exigirAliquota, comAliquotasInformadas } from '@sinete/ibs-cbs/aliquotas';

const p = aliquotasOficiais();
p.nominal('2026-10-10').CBS; // { situacao: 'oficial', valor: '0.9', legal: 'LC 214/2025, art. 346', ... }
p.nominal('2029-03-01').CBS; // { situacao: 'desconhecida', valor: null, ... }
exigirAliquota(p.nominal('2029-03-01').CBS, '2029-03-01'); // lança ErroAliquotaDesconhecida
const sim = comAliquotasInformadas(p, [{ tributo: 'CBS', valor: '8.8', motivo: 'simulação do orçamento 2029' }]);
```

### Estados

- `oficial`: vem de lei ou ato publicado, com dispositivo legal e fonte. 2026: CBS 0,9%, IBS da UF 0,1%, IBS municipal 0% (LC 214/2025, arts. 343 e 346). 2027 e 2028: IBS da UF e municipal 0,05% cada (LC 214/2025, art. 344).
- `informada`: informada pelo usuário com motivo obrigatório (`comAliquotasInformadas`, ou `aliquotasInformadas` no item do `@sinete/ibs-cbs/calcular`). O cálculo que usa uma delas sai marcado como simulado.
- `desconhecida`: ainda não publicada (CBS de 2027 e 2028, que é a referência do Senado menos 0,1 ponto percentual pelo art. 347, e tudo de 2029 em diante). Nunca vira zero: quem precisa do número recebe `ErroAliquotaDesconhecida` (`ibscbs_aliquota_desconhecida`).

A tabela (`TABELA_ALIQUOTAS`) é gerada pelo `tools/ibs-cbs-dados/extract.ts` a partir da Calculadora e de `tools/ibs-cbs-dados/rates.json` (curadoria com fonte legal); `ErroDadosDeAliquotas` (`ibscbs_aliquotas_invalidas`) recusa tabela ou sobreposição malformada.

## Cálculo (`@sinete/ibs-cbs/calcular`)

Cálculo puro e determinístico do IBS e da CBS a partir de uma operação já classificada (CST e cClassTrib por item). Não conhece CFOP, cliente nem descrição de produto: quem decide a classificação é o `@sinete/ibs-cbs/determinar` ou o usuário. As regras vêm do `@sinete/ibs-cbs-dados`, as alíquotas do `@sinete/ibs-cbs/aliquotas`.

```ts
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';
import { calcular } from '@sinete/ibs-cbs/calcular';
import { aliquotasOficiais } from '@sinete/ibs-cbs/aliquotas';

const roc = calcular(
  { modelo: 55, local: { uf: 'SP', cMun: '3550308' }, itens: [{ n: 1, cst: '000', cClassTrib: '000001', base: '1000.00' }] },
  { dataset: datasetEmbarcado(), aliquotas: aliquotasOficiais(), tempo: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }) },
);
roc.itens[0].IBSCBS.gIBSCBS?.gCBS; // { pCBS: '0.90', vCBS: '9.00' }
roc.total.IBSCBSTot.vBCIBSCBS; // '1000.00'
```

### Como calcula

- As expressões de cada tratamento tributário vêm do dataset (`aliquota*(1-percentualReducao)`, `baseCalculo*aliquotaEfetiva`...) e são avaliadas com decimal exato (BigInt), 8 casas HALF_EVEN por expressão, como a Calculadora (`ArredondamentoUtils`, LC 214/2025 art. 349 §14). Valores saem com 2 casas e percentuais com 4, HALF_EVEN.
- A data do fato gerador (`ContextoDeTempo.fatoGerador`, no fuso de Brasília por padrão) escolhe dados e alíquotas. `calcularEm` recebe a data civil direto.
- Saída (`Roc`) nos grupos da NT 2025.002: `gIBSCBS` com `gIBSUF`, `gIBSMun` e `gCBS` (`gDif`, `gDevTrib`, `gRed`), `gTribRegular`, `gTribCompraGov`, `gTransfCred`, `gAjusteCompet`, `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`, e `IBSCBSTot`. Cada item diz as alíquotas usadas e o estado delas; `simulado` marca o cálculo com alíquota informada; `rastro` guarda fórmula, entradas e resultado de cada passo.
- Com diferimento e devolução no mesmo tributo, o valor sai do tributo menos as deduções como emitidas (2 casas), para fechar com a UB67-10; tributação regular com diferimento ou devolução é recusada.
- Crédito presumido em bem móvel usado (`creditoPresumido.bemMovelUsado`, `indBemMovelUsado=1`) vale mesmo com cClassTrib que veda o grupo (UB120-20, exceção).
- Os totais somam os valores de 2 casas dos itens, como exigem as regras W da NT; a Calculadora soma os valores internos. A diferença (até meio centavo por parcela) está no ledger do oráculo.
- Alíquotas efetivas entram no cálculo com a precisão em que saem no XML (4 casas no percentual), para `v = vBC x pAliqEfet` fechar com o que foi emitido; com as alíquotas oficiais isso não muda nada.
- Compra governamental: redutor dos arts. 370 e 472 e, a partir de 2027, a redistribuição entre entes do art. 473 da LC 214/2025, com `gTribCompraGov` antes da redistribuição. O diferimento acompanha a redistribuição (exige o mesmo `pDif` nos três tributos); devolução de tributos com compra governamental a partir de 2027 é recusada, sem regra publicada.
- Tributação regular (suspensão, diferimento integral e afins): o grupo principal sai zerado e `gTribRegular` leva a tributação do cClassTrib regular. Se a CST do cClassTrib principal exige `gRed` (UB26-20), o grupo vai com o `pRedAliq` da tabela e alíquota efetiva zero; a Calculadora não o emite, e a divergência está no ledger.

### Erros

| Classe | `code` | Quando |
|---|---|---|
| `ErroClassificacao` | `ibscbs_classificacao_invalida` | código inexistente ou fora de vigência, cClassTrib fora da CST ou do DF-e, grupo exigido ausente ou vedado presente, entrada malformada; `motivo` diz qual |
| `ErroRegimeNaoSuportado` | `ibscbs_regime_nao_suportado` | monofasia, Imposto Seletivo, alíquotas combinadas, ajuste que a CST exige em `gIBSCBS`; nunca sai valor zerado no lugar |
| `ErroAliquotaDesconhecida` | `ibscbs_aliquota_desconhecida` | alíquota não publicada e não informada |
| `ErroExpressao` | `ibscbs_expressao_invalida` | expressão do dataset fora da gramática conhecida |

### Oráculo

`tools/ibs-cbs-oraculo` compara o motor com a Calculadora offline em operações sintéticas e grava as fixtures de `test/calcular/fixtures/oracle-cases.json`, que os testes unitários conferem sem Docker. Cada divergência conhecida tem entrada em `tools/ibs-cbs-oraculo/ledger.json`, com motivo e fonte.

## Regras de validação da NT 2025.002 (`@sinete/ibs-cbs/validar`)

Regras de validação da NT 2025.002-RTC v1.51 (grupos UB e W da NF-e e da NFC-e) que dá para conferir sem o banco da SEFAZ, como funções puras. Cada regra tem o id da NT, o cStat de rejeição (cruzado com o `@sinete/rejeicoes`), os modelos, a implantação por ambiente e a fonte. Serve para conferir um XML lido de fora ou a saída do `@sinete/ibs-cbs/calcular`, e é o segundo oráculo do motor no que a Calculadora da RFB não calcula.

```ts
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';
import { documentoDoRoc, validar } from '@sinete/ibs-cbs/validar';

const doc = documentoDoRoc(roc, { modelo: 55, crt: 3, finNFe: 1 });
const report = validar(doc, {
  dataset: datasetEmbarcado(),
  tempo: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
  ambiente: 'producao',
});
report.violacoes; // [{ regra: 'UB35-10', cStat: '1041', item: 1, message: '...', fonte: 'NT 2025.002 v1.51, UB35-10' }]
```

### O que confere

- UB12-10 a UB133-10: presença e vedação de grupos pelos indicadores da CST, do cClassTrib e do cCredPres; cClassTrib x tipo de nota de débito e crédito; alíquotas por ano de emissão; fórmulas de `vDif`, `pAliqEfet`, valores por ente, `vIBS`, tributação regular, compra governamental, crédito presumido, ZFM e estorno, com a tolerância da NT.
- W34-10 a W59g-10: totais do `IBSCBSTot` como soma dos itens.
- `NAO_IMPLEMENTADAS` lista o que ficou de fora e por quê (Imposto Seletivo, monofasia, composição da base UB16-10, `gALCZFMCBS`, `vItem`/`vNFTot`).
- As tabelas próprias da NT (tipo de nota x cClassTrib, alíquotas por ano de emissão, municípios da ZFM e das ALC) estão em `TABELAS_NT`, com o sha256 do PDF da NT.

### Os dois relógios

O relógio de emissão decide quais regras já estão implantadas no ambiente (cronograma da NT por versão e, na UB12-10, por CRT) e as regras amarradas ao ano de emissão; o de fato gerador decide as tabelas do `@sinete/ibs-cbs-dados`. `ignorarAtivacao` avalia tudo, para se antecipar ao cronograma.

### Pontos em que a NT e a Calculadora não fecham

- Compra governamental a partir de 2027: a fórmula de `pAliqEfet` da NT (UB28-10, UB47-10, UB66-10) não inclui a redistribuição do art. 473 da LC 214/2025, que a Calculadora e o motor aplicam. As regras acusam esses casos até a NT tratar o tema.
- cClassTrib que exige tributação regular com CST que exige `gRed` (200022 e 200024): a NT pede `gRed` com o `pRedAliq` da tabela; a Calculadora não emite o grupo (ou emite `pRedAliq` 0 na compra governamental). O motor segue a NT.

## Determinação de CST e cClassTrib (`@sinete/ibs-cbs/determinar`)

Determinação do CST e do cClassTrib do IBS e da CBS a partir de fatos de negócio (natureza da operação, NCM ou NBS, atores das partes, tipo de nota). Separa o que é regra fechada do que é interpretação: o dado oficial e a lei eliminam candidatos com o motivo; o que sobra vai para resolvedores plugáveis (cadastro do item, pergunta ao usuário, IA, fila de revisão), e cada decisão sai com proveniência.

```ts
import { relogioFixo, contextoDeTempo } from '@sinete/core';
import { datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';
import { determinar, idDaPergunta, paraClassificado } from '@sinete/ibs-cbs/determinar';

const opts = { dataset: datasetEmbarcado(), tempo: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }) };
const facts = { modelo: 55, tipo: 'venda', itens: [{ n: 1, ncm: '10063021', descricao: 'arroz' }] } as const;

const first = await determinar(facts, opts);
first.itens[0].pendente; // [{ id: 'cClassTrib:1', opcoes: [{ cClassTrib: '000001', ... }, { cClassTrib: '200003', ... }, ...] }]

const det = await determinar(facts, { ...opts, respostas: { [idDaPergunta(1)]: '200003' } });
det.itens[0].decidido?.procedencia; // { por: 'usuario', nome: 'cClassTrib:1', em: '...', versaoDoConteudo: '2026.09+...', dataDeReferencia: '2026-10-10' }
const op = paraClassificado(det, { modelo: 55, local: { uf: 'SP', cMun: '3550308' } }, () => ({ base: '100.00' }));
```

### `restringir`: restrições oficiais

Síncrono e barato, só com dado oficial. Todo cClassTrib do IBS/CBS sai como candidato ou como exclusão, com o primeiro motivo que o eliminou, o detalhe e a fonte:

| Motivo | Fonte |
|---|---|
| `vigencia` | vigência do cClassTrib no `@sinete/ibs-cbs-dados` |
| `dfe` | vínculo cClassTrib x modelo de DF-e |
| `tipo-de-nota` | NT 2025.002, UB14-60, UB14-70 e UB14-80 (só NF-e e NFC-e) |
| `nomenclatura` | o código pede NCM e o item só tem NBS, ou o contrário |
| `ncm`, `nbs` | anexo da LC 214/2025 (aplicabilidade, com a exceção que excluiu) |
| `atores` | vínculo cClassTrib x atores do fornecedor e do adquirente |

Fato desconhecido não exclui nada: sem NCM, o anexo não é conferido; sem atores, o vínculo por atores também não.

### `determinar`: regras legais, respostas e resolvedores

1. `REGRAS_LEGAIS` restringem os candidatos pela natureza da operação ou da parte, com o dispositivo: bonificação no documento (410001, art. 5º, § 1º, I), transferência entre estabelecimentos (410002, art. 6º, II), doação sem contraprestação (410003, art. 6º, VIII), exportação (410004 ou 410027, arts. 8º e 80), produtor rural não contribuinte (410014, art. 164) e devolução espelhando o item original (arts. 12, § 7º, e 17). Regra que pede código já excluído marca `conflito` e deixa o item sem candidato, nunca escolhe por cima da restrição oficial.
2. Resposta do usuário em `respostas[idDaPergunta(n)]`: decide com `por: 'usuario'`.
3. Regra que deixou um só candidato: decide com `por: 'regra'`.
4. Resolvedores em ordem (padrão `doPerfil()`, `candidatoUnico()`, `perguntarAoUsuario()`): o primeiro que decidir vence; `perguntar` devolve perguntas em `pendente`, e a resposta volta em `respostas[id]` com o id que o resolvedor deu à pergunta (o resolvedor também recebe `contexto.respostas`); `abster` passa adiante. Um `Resolvedor` é `{ nome, resolver(contexto, signal) }` assíncrono e só escolhe dentro de `contexto.candidatos`.

`ErroDeterminacao` (`ibscbs_determinacao_invalida`) com `motivo`: `fatos_invalidos`, `resolvedor_fora_dos_candidatos`, `resolvedor_invalido` (confiança fora de [0, 1]), `resposta_fora_dos_candidatos`, `determinacao_incompleta` (em `paraClassificado`).

### Fora do escopo por enquanto

Regras por `tpRBSN` e CRT do Simples (a partir de 2027), escolha de cCredPres e de percentual de diferimento, e o perfil semântico do item (destinação, in natura) que decide entre anexos. Ficam com os resolvedores.

## Licença

Apache-2.0.
