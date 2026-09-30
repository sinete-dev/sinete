# `ibscbs_determinacao_invalida`: a determinação do CST e do cClassTrib não pode seguir

A determinação da classificação tributária define o CST (Código de Situação Tributária) e o cClassTrib (código de classificação tributária). Esse erro ocorre quando `determinar` recebe fatos da operação inválidos, uma resposta inválida ou uma decisão inválida de um resolvedor, componente que escolhe a classificação de um item. Também ocorre quando `paraClassificado` recebe um item ainda sem decisão.

O erro é uma instância de `ErroDeterminacao` (`@sinete/ibs-cbs`), que estende `ErroSinete` e tem `code: 'ibscbs_determinacao_invalida'`. O campo `detalhes.motivo` informa o motivo, e `detalhes.item`, quando presente, informa o número do item. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'ibscbs_determinacao_invalida')`, de `@sinete/core`, nunca pela mensagem.

## Causa

Os motivos possíveis em `motivo` são:

- `fatos_invalidos`: dados da operação inválidos, como número de item repetido ou NCM (Nomenclatura Comum do Mercosul, código de classificação de mercadorias) com letras.
- `resolvedor_fora_dos_candidatos`: um resolvedor escolheu um cClassTrib que não está entre os candidatos restantes após as restrições dos dados oficiais e a aplicação das regras legais.
- `resolvedor_invalido`: o resolvedor retornou uma decisão cujo campo `confianca` não é um número entre 0 e 1, inclusive.
- `resposta_fora_dos_candidatos`: o cClassTrib informado na resposta do usuário não está entre os candidatos do item.
- `determinacao_incompleta`: `paraClassificado` recebeu um item ainda sem decisão.

## Correção

Corrija os fatos inválidos e responda às perguntas com o valor `cClassTrib` de uma das opções em `itens[].pendente[].opcoes`. Só chame `paraClassificado` quando todos os itens tiverem `decidido`, condição indicada por `completa: true` no resultado da determinação.

Ao retornar uma decisão, um resolvedor próprio deve escolher um cClassTrib presente em `contexto.candidatos` e informar `confianca` como um número entre 0 e 1, inclusive.

## Armadilha

Cada pergunta em `itens[].pendente` tem um `id`: `idDaPergunta(n)` nas perguntas do resolvedor padrão `perguntarAoUsuario()`, em que `n` é o número do item, ou um identificador definido pelo resolvedor próprio. Na próxima chamada a `determinar`, envie a resposta nas opções como `answers[id]`, com o cClassTrib escolhido. Se usar outro identificador, a resposta não será associada à pergunta, que poderá aparecer novamente.
