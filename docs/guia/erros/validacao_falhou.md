# `validacao_falhou`: a entrada ou o documento montado não passou na validação local

O dado foi recusado pela validação local, antes de o documento ou pedido ser enviado à autoridade fiscal, como a Secretaria da Fazenda (SEFAZ). O erro é um `ErroDeValidacao` (`@sinete/core`), um `ErroSinete` com `code: 'validacao_falhou'`. Ele traz em `ocorrencias` todas as ocorrências reunidas pela validação que falhou, não só a primeira. Decida pelo `code` (`ehErroSinete(e, 'validacao_falhou')`), nunca pela mensagem.

## Causa

A montagem chamada pelo emissor, durante `emitir` ou `assinar`, encontrou problemas na entrada ou no documento montado: campo obrigatório ausente, valor que não confere com o cálculo do Manual de Orientação do Contribuinte (MOC), identificado por `valor_divergente`, XML fora do XSD (schema que define a estrutura e as restrições do XML) do leiaute vigente, identificado por `schema`, percurso de Manifesto Eletrônico de Documentos Fiscais (MDF-e) rodoviário entre unidades federativas (UFs) que não fazem divisa, base de cálculo do Imposto sobre Bens e Serviços (IBS) e da Contribuição sobre Bens e Serviços (CBS) ausente, entre outros. Na montagem direta com `buildNfe`, `buildMdfe` ou `buildDps`, as falhas de validação são devolvidas como `{ ok: false, issues }`; o emissor transforma esse resultado em `ErroDeValidacao`.

O erro também é lançado pelos clientes quando um pedido de evento não passa na validação do schema, por exemplo, por justificativa curta ou texto da Carta de Correção Eletrônica (CC-e) fora do tamanho permitido. O `assertValid` do `@sinete/schemas` também lança `ErroDeValidacao` quando encontra ocorrências de schema.

## Correção

Percorra `e.ocorrencias`. Cada ocorrência tem `caminho`, `code` e `mensagem`. Os montadores também preenchem `origem`: `entrada` quando a conferência aponta um valor da entrada que pode ser corrigido naquele caminho, ou `montagem` quando a conferência é sobre o que o sinete produziu, como o XML contra o XSD, a chave ou um grupo calculado. Uma ocorrência de `montagem` ainda pode ter sido causada por um valor da entrada, mas não identifica diretamente o campo a corrigir. Em validadores avulsos, `origem` pode estar ausente, indicando que a ocorrência não foi classificada.

Mostre as ocorrências de `entrada` no campo correspondente, com `rotuloDoCaminho(path)` do `sinete/nfe` ou do `sinete/mdfe` para obter o nome em português. Mande para o log as de `montagem`, as sem classificação e as dos campos que o seu sistema preenche. Veja [como tratar as ocorrências](../como-fazer/ocorrencias-de-validacao.md).

## Armadilha

Quando a validação da montagem falha durante `emitir`, o emissor ainda não gravou os bytes do documento no store, o armazenamento das transmissões, nem enviou o documento à autoridade fiscal. Nesse caso, corrigir a entrada e chamar `emitir` de novo com a mesma `ref`, a referência da transmissão, é seguro. Não decida pela `mensagem` de uma ocorrência, pois ela muda entre versões, e não mostre ocorrência de `montagem` como erro de preenchimento.

```ts
import { ehErroSinete, type ErroDeValidacao } from 'sinete/core';
import { rotuloDoCaminho } from 'sinete/nfe';

try {
  await nfe.emitir(pedido.id, nota);
} catch (e) {
  if (!ehErroSinete(e, 'validacao_falhou')) throw e;
  for (const i of (e as ErroDeValidacao).ocorrencias) {
    if (i.origem === 'entrada') mostrarNoCampo(i.caminho, `${rotuloDoCaminho(i.caminho)}: ${i.mensagem}`);
    else registrarNoLog(i);
  }
}
```
