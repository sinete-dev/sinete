# Como informar o IBS e a CBS

O IBS (Imposto sobre Bens e Serviços) e a CBS (Contribuição sobre Bens e Serviços) são os tributos da reforma tributária do consumo, previstos na Lei Complementar 214/2025. No sinete, cada documento trata deles conforme seu leiaute: na NF-e (Nota Fiscal Eletrônica), você classifica o item e o sinete calcula os grupos; na NFS-e Nacional (Nota Fiscal de Serviço Eletrônica), você informa a classificação e os indicadores da operação, e a Sefin Nacional, o serviço de autorização, calcula os tributos. Esta página cobre os dois documentos e explica como chegar à classificação a partir dos dados da operação.

## NF-e: classificar o item e deixar o sinete calcular

Cada item leva a classificação em `impostos.ibsCbs.classificacao`: o CST (Código de Situação Tributária), o `cClassTrib` (código de classificação tributária) do cadastro do item e a base de cálculo. Por padrão, a montagem (`buildNfe`, também usada pelo emissor) usa a calculadora do sinete. Ela consulta os dados do `@sinete/ibs-cbs-dados`, extraídos das fontes oficiais, incluindo a Calculadora da Receita Federal, e as alíquotas oficiais disponíveis para a data do fato gerador, o momento da operação que dá origem ao tributo. Antes de montar a nota, confere o resultado pelas regras de validação da Nota Técnica (NT) 2025.002 aplicáveis à data de emissão e ao ambiente.

```ts
import type { NfeInput } from 'sinete/nfe';

const item: NfeInput['itens'][number] = {
  produto: { cProd: '1', xProd: 'PARAFUSO', NCM: '73181500', CFOP: '5102', uCom: 'UN', qCom: '10', vUnCom: '1.00' },
  impostos: {
    icms: { CST: '00', orig: '0', pICMS: '18' },
    pis: { CST: '07' },
    cofins: { CST: '07' },
    ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001', vBC: '10.00' } },
  },
};
```

- **Base.** Nas regras usadas pelo sinete, a composição da base de cálculo (NT 2025.002, regra UB16-10) consta como "implementação futura, aguardando orientação normativa". Por isso, o sinete não presume uma base: sem `vBC` na classificação e sem a função `base` nas opções, o item gera a ocorrência `ibscbs_base_ausente`.
- **Base por função.** Para não repetir a conta em todo item, passe `base` na calculadora. Ela recebe os valores do item já calculados, como objetos `Decimal`, e os dados da nota. A função é usada quando a classificação não informa `vBC`:

```ts
import { createNfeEmissor } from 'sinete/emissor/nfe';
import { ibsCbsCalculator } from 'sinete/nfe';

const ibsCbs = ibsCbsCalculator({ base: (item) => item.vProd.minus(item.vDesc).toFixed(2) });
const nfe = await createNfeEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir, montagem: { ibsCbs } });
```

- **Datas.** A data do fato gerador determina os dados e as alíquotas; a data de emissão determina quais regras da NT já estão implantadas no ambiente. Os dois relógios vêm do `ContextoDeTempo`; sem fato gerador explícito, vale a data da emissão.
- **Local da operação.** O sinete usa `cMunFGIBS`, o código do município do fato gerador informado na nota (campo B12a), quando consegue identificar sua unidade federativa (UF). Caso contrário, usa o destino da mercadoria: primeiro o endereço de entrega, depois o endereço do destinatário, conforme o critério de local da entrega da LC 214/2025, art. 11. Sem destino ou com destino no exterior, usa o município e a UF do emitente.
- **Alíquota não publicada.** Uma alíquota necessária ao cálculo que não está disponível no provedor nunca vira zero: a calculadora retorna a ocorrência `ibscbs_aliquota_desconhecida`, e a nota não é montada. Para simular, informe as alíquotas (`ibsCbsCalculator({ rates })`, com `withOverrides` do `sinete/nfe/ibs-cbs`). No resultado do motor de cálculo avulso, `simulated` indica o uso de alíquotas informadas; a calculadora integrada à montagem não repassa esse indicador.
- **Grupo pronto.** Se outro sistema já calcula, mande o grupo do leiaute em `ibsCbs.grupo` no lugar da classificação; a calculadora não roda para esse item.
- **Crédito presumido, diferimento e devolução de tributos.** Para informar esses valores, use o grupo pronto. A classificação aceita `cCredPres`, mas a calculadora padrão retorna `ibscbs_nao_suportado` quando ele é informado, pois precisa dos percentuais de crédito por tributo. A classificação não tem campos para informar percentuais de diferimento nem de devolução de tributos.

As ocorrências do IBS/CBS voltam como as outras da montagem: `ErroDeValidacao` no emissor e `issues` no `buildNfe`. As ocorrências de um item apontam para `itens[n].impostos.ibsCbs` ou seus campos, com índice iniciado em zero. Há também ocorrências em outros caminhos: alíquota desconhecida aponta para `impostos.ibsCbs`, e violações das regras de totalização apontam para `total.IBSCBSTot`. A propriedade `origem` vale `entrada` quando a ocorrência aponta um valor informado na nota e `montagem` quando decorre do cálculo ou dos dados usados pelo sinete. As violações das regras da NT usam o código `ibscbs_regra_nt`, com a identificação da regra, o código de rejeição e a fonte na mensagem. Veja [como tratar as ocorrências de validação](ocorrencias-de-validacao.md).

## Chegar ao CST e ao `cClassTrib`

Se o cadastro do item não tem a classificação, `determine` (em `sinete/nfe/ibs-cbs`) elimina candidatos com base nos dados oficiais e nas regras legais implementadas. Quando essas regras não determinam a classificação, consulta resolvedores, funções que podem usar o cadastro do item, uma pergunta ao usuário ou uma fila de revisão. Por padrão, tenta a classificação do cadastro, escolhe se restou um único candidato ou retorna uma pergunta com as opções restantes. Cada decisão registra sua proveniência: quem decidiu, quando e com qual versão dos dados.

```ts
import { relogioFixo, contextoDeTempo } from 'sinete/core';
import { carregarDatasetEmbarcado } from 'sinete/nfe';
import { determine, questionId } from 'sinete/nfe/ibs-cbs';

const opts = {
  dataset: await carregarDatasetEmbarcado(),
  time: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
};
const fatos = { modelo: 55, kind: 'venda', items: [{ n: 1, ncm: '10063021', description: 'arroz' }] } as const;

const primeira = await determine(fatos, opts);
console.log(primeira.items[0]?.pending); // pergunta com os cClassTrib possíveis

const decidida = await determine(fatos, { ...opts, answers: { [questionId(1)]: '200003' } });
console.log(decidida.items[0]?.decided?.provenance); // quem decidiu, quando e com que versão dos dados
```

Um fato desconhecido não exclui candidatos por si só: sem NCM (Nomenclatura Comum do Mercosul, o código de classificação da mercadoria), a aplicabilidade pelo anexo correspondente da LC 214/2025 não é conferida. Quando uma regra legal exige códigos que os dados oficiais já excluíram, o resultado registra um conflito e deixa o item sem candidato. A regra não ignora a restrição para escolher uma classificação.

## NFS-e Nacional: só a classificação

Na DPS (Declaração de Prestação de Serviços, enviada para gerar a NFS-e), o grupo `ibsCbs` leva a classificação e os indicadores da operação. Também permite informar, quando aplicáveis, o código de crédito presumido, a classificação da tributação regular e os percentuais de diferimento, que adiam parte do recolhimento. A base, as alíquotas e os valores do IBS estadual e municipal e da CBS são calculados pela Sefin e vêm na NFS-e gerada (NT SE/CGNFS-e 004). O sinete não calcula esses tributos na NFS-e.

```ts
import type { DpsInput } from 'sinete/nfse';

const ibsCbs: DpsInput['ibsCbs'] = {
  cIndOp: '100301', // código indicador da operação (Anexo C, 6 dígitos)
  indDest: '0', // o destinatário é o próprio tomador
  classificacao: { CST: '000', cClassTrib: '000001' },
};
```

O grupo está presente nos dois pacotes de esquemas XML da NFS-e usados pelo sinete: `nfse/1.01-20260209` e `nfse/1.01-20260727`. O sinete escolhe o pacote pela data de emissão e pelo ambiente, conforme sua tabela de vigências.

## Outros documentos e uso avulso

O motor (`sinete/ibs-cbs` ou `@sinete/ibs-cbs`) calcula sem depender da montagem de um documento específico: recebe uma operação classificada e devolve os grupos `IBSCBS` dos itens e o total `IBSCBSTot`. A saída segue os nomes dos grupos da NT 2025.002, e o modelo do documento informado na entrada é usado para conferir se o `cClassTrib` pode ser aplicado. Serve a sistemas de gestão (ERP) e de ponto de venda (PDV) que simulam carga tributária ou conferem uma nota recebida sem emitir, além de poder apoiar integrações com outros documentos da reforma. Veja a [referência do `@sinete/ibs-cbs`](../referencia/ibs-cbs.md).

## Armadilhas

- **Base presumida por conta própria.** Como a composição da base pela UB16-10 não está implementada nas regras usadas pelo sinete, você precisa fornecer a base; documente de onde ela vem no seu sistema.
- **Relógio único.** Reprocessar uma nota antiga com o relógio de hoje pode trocar os dados e as alíquotas aplicáveis. Passe o fato gerador da operação (`contextoDeTempo({ emissao, fatoGerador })`).
- **Dataset trocado sem verificação.** Para carregar um novo conjunto de dados sem atualizar o pacote, verifique o pacote de dados com `verifyDataset` antes de chamar `loadDataset`. A verificação confere os hashes das tabelas e do conjunto contra o manifesto.

## Veja também

- [Emitir a NFS-e](nfse.md).
- Referência: [`@sinete/nfe`](../referencia/nfe.md), [`@sinete/ibs-cbs`](../referencia/ibs-cbs.md) e [`@sinete/ibs-cbs-dados`](../referencia/ibs-cbs-dados.md).
