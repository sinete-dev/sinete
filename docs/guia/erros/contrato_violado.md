# `contrato_violado`: o adaptador do store não cumpre o contrato

Um caso da suíte de contrato do `TransmissaoStore`, a interface que guarda os documentos assinados e controla as travas entre processos, falhou. A suíte está em `sinete/emissor/contrato` e lança `ContratoVioladoError`, exportado por esse mesmo módulo ou por `@sinete/emissor/contrato`. O erro é um `ErroSinete` com `code: 'contrato_violado'`, e `detalhes.caso` identifica o caso que falhou. Decida pelo `code` (`ehErroSinete(e, 'contrato_violado')`, com `ehErroSinete` de `@sinete/core`), nunca pela mensagem.

## Causa

O adaptador do seu banco não se comporta como o emissor precisa. Por exemplo: dois processos conseguem a trava do mesmo documento ao mesmo tempo, uma trava expirada não pode ser assumida por outro processo, o dono antigo consegue gravar depois de perder a trava, `concluir` não é idempotente (repetir a chamada altera o resultado), ou `listarPendentes` seleciona documentos que não atendem aos critérios da retomada automática. A mensagem traz o nome do caso e o comportamento esperado.

## Correção

Corrija o adaptador e rode a suíte de novo em um banco de teste com o mesmo sistema de banco de dados, a mesma versão e o mesmo nível de isolamento usados em produção. Cada caso precisa de dois stores sobre o mesmo banco vazio, representando dois processos. Confira especialmente estas regras: a condição da trava tem de estar no mesmo comando que escreve, e os prazos devem ser medidos pelo relógio do banco. Veja [como implementar o store](../como-fazer/store-sql.md).

## Armadilha

Não enfraqueça a verificação do caso que falha nem rode a suíte só contra um banco em memória: um adaptador incorreto pode produzir notas duplicadas, e falhas de concorrência podem passar despercebidas em testes sem operações simultâneas no banco usado em produção.
