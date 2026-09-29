# `pl_sem_vigencia`: nenhum leiaute vigente para a data e o ambiente

A seleção não encontrou um pacote de liberação (PL), conjunto de esquemas que define o leiaute do documento, para a família, a data e o ambiente pedidos. A função `selecionarPl`, de `@sinete/schemas`, lança um `VigenciaError`, que é um `SineteError` com `code: 'pl_sem_vigencia'`. Trate o erro pelo `code`, usando `isSineteError(e, 'pl_sem_vigencia')`, de `@sinete/core`, nunca pela mensagem.

## Causa

A data informada é anterior ao primeiro leiaute registrado para aquela família de documento e ambiente, sem uma entrada sem data de início que cubra o período. O erro também ocorre quando a família é desconhecida ou o ambiente é diferente de `'homologacao'` e `'producao'`. Um relógio configurado com a data errada, como um `fixedClock` de teste com uma data antiga, pode causar a seleção de um período sem cobertura.

## Correção

Confira a família, o relógio de emissão e o ambiente. Consulte `VIGENCIAS`, de `@sinete/schemas`, para verificar os leiautes disponíveis e suas datas de início. Para reprocessar um documento recebido, use um `fixedClock` com a data original dele.

O PL é escolhido pelo dia de Brasília (UTC-3) e pelo ambiente, nunca por tentativa. A seleção usa a entrada com a data de início mais recente que não ultrapasse o dia informado. Uma entrada sem data de início registrada (`null`) cobre qualquer data anterior à próxima entrada da família naquele ambiente. Homologação, o ambiente de testes, pode receber um leiaute antes de produção.

Uma data futura não causa esse erro apenas por ainda não haver um novo PL publicado: a seleção continua usando a última entrada aplicável da tabela, que não tem data de término. Quando uma nota técnica (NT) ou um cronograma oficial estabelecer um novo leiaute, atualize os pacotes para uma versão que o inclua e registre sua vigência.

## Armadilha

Reemitir um documento antigo com a data de hoje é emitir outro documento. Reprocessá-lo com a data original exige o PL correspondente àquela época, que precisa estar disponível no pacote e registrado na tabela. A existência de um leiaute atual não garante cobertura de datas antigas.
