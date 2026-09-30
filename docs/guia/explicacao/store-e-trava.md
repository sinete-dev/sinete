# Por que o emissor exige um `store` com trava

O emissor do sinete (`@sinete/emissor`) exige um `TransmissaoStore`: a opção `store` é obrigatória, e a criação do emissor lança `ErroDeConfiguracao` sem ela. Esta página explica por quê, e por que o store é uma interface que o integrador implementa no próprio banco em vez de uma tabela que o sinete cria. As decisões estão no registro de decisão de arquitetura ADR 0010 do sinete.

## Gravar não basta: dois processos

[Gravar os bytes antes do envio](bytes-antes-do-envio.md) resolve a resposta perdida num processo só. Em produção, pode haver mais de um: dois servidores atrás de um balanceador, o job de retomada rodando enquanto a pessoa clica em "emitir", um deploy que sobe o processo novo antes de o antigo terminar. Dois processos transmitindo o mesmo documento ao mesmo tempo deixam perguntas sem resposta: quem grava os bytes, quem guarda o desfecho, quem descarta os bytes numa recusa. Uma função que só "garante que os bytes existem antes do envio" pode dar ao integrador a impressão de que isso basta. O erro aparece no dia em que a rede cai com dois processos no ar.

Por isso o store reúne a gravação **e** a trava na mesma interface:

- **Trava com prazo, por documento.** Só quem tem a trava em vigor grava ou descarta os bytes. O emissor também confere a trava antes de chamar a função que guarda o desfecho. A trava é uma concessão com vencimento: se o processo morrer no meio, ela vence, e quem chegar depois pode assumir e retomar pelos bytes gravados.
- **Renovação enquanto espera a SEFAZ.** O emissor renova a trava enquanto espera a resposta da Secretaria da Fazenda (SEFAZ) ou do serviço fiscal correspondente. Por padrão, o prazo é de 10 minutos, com folga para envio, consulta, reenvio e espera pelo processamento do recibo. A renovação ocorre a cada terço desse prazo. As opções `trava.prazoMs` e `trava.renovarACadaMs` permitem ajustar esses intervalos; `renovarACadaMs: 0` desliga a renovação periódica, somente para testes.
- **Conferência antes de gravar o desfecho.** Antes de guardar o desfecho, e antes de devolver um desfecho que mantém os bytes, o emissor tenta renovar a trava para conferir que ela ainda é dele. Se `renovar` retorna `false`, o emissor lança `TravaPerdidaError` e não guarda o desfecho: o novo dono decide. Se a conferência falhar por erro do banco, a guarda do desfecho é interrompida; no caso que mantém os bytes, o emissor registra a falha no log e devolve o desfecho. Depois que o integrador guarda o documento, `concluir` apaga os bytes sem exigir que o prazo da trava ainda esteja em vigor, mas confere o `token` que identifica seu dono. Assim, um processo lento não apaga a gravação de quem assumiu a trava.
- **`TransmissaoEmAndamentoError`** para quem chega com a trava de outro em vigor: essa tentativa não envia nada ao serviço fiscal. A aplicação pode tratar o erro e mostrar "em processamento".

## Relógio do banco

Prazo, renovação, "parado há" e "assinado há" são medidos pelo relógio do banco. Dois servidores com relógios diferentes poderiam discordar sobre o vencimento de uma trava; o relógio do banco dá aos dois a mesma referência. Por isso as operações de trava e os filtros de retomada recebem durações (`prazoMs`, `idadeMaximaMs`, `paradaHaMs`), em vez de instantes calculados no processo. O adaptador as compara com o `now()` do banco. O campo `assinadoEm` registra o instante em que os bytes foram gravados no store.

## Por que uma interface, e não uma tabela do sinete

O sinete roda em Node, Bun, Deno e no navegador, e não sabe qual banco você usa. Além disso, a gravação dos bytes é onde o integrador reserva a numeração do emitente, na mesma transação, e guarda o que precisa para a retomada (`meta`: dados como o emitente e o pedido). Uma tabela do sinete fora da transação do integrador reabriria a janela entre "número reservado" e "bytes gravados". O adaptador em memória (`@sinete/emissor/memoria`) é a referência para testes e scripts de um processo; ele perde os bytes se o processo cair.

## A suíte de contrato

Um adaptador incorreto pode produzir nota duplicada, e o erro pode aparecer apenas sob concorrência. Por isso o `@sinete/emissor/contrato` vem junto do pacote. A suíte verifica, contra o seu banco, dez tentativas simultâneas de adquirir a mesma trava com uma vencedora, a trava vencida assumida sem o dono antigo conseguir gravar, a renovação de uma trava perdida sendo recusada, os bytes acessíveis por outra conexão, `concluir` idempotente (repetir a chamada não altera o resultado) e a seleção dos registros para retomada. O mesmo contrato roda contra o adaptador em memória nos testes do sinete e nos testes básicos dos arquivos de distribuição do pacote.

## Emissor e pacote de documento

A trava, o store, a retomada e o pool de emissores por certificado ficam no `@sinete/emissor`, e não no `@sinete/nfe`, no `@sinete/mdfe` e no `@sinete/nfse`, porque compartilham a mesma política entre os tipos de documento. Manter essa política em cada pacote havia produzido três cópias. O ADR 0010 registra cinco diferenças de comportamento encontradas entre os emissores curtos e a orquestração de um integrador, além do risco de divergência entre as cópias dos pacotes. Para decidir onde uma função deve ficar, o critério é: se ela precisa lembrar de algo entre duas chamadas ou decidir o que fazer com o documento por quem a chama, pertence ao emissor. Uma chamada ao serviço fiscal ou uma leitura, com desfecho tipado e sem essa política, pertence ao pacote do documento. Veja [a divisão dos pacotes](divisao-de-pacotes.md).

## Veja também

- [Como implementar o `TransmissaoStore` num banco SQL](../como-fazer/store-sql.md).
- [Retomada](../como-fazer/retomada.md).
- Erros: [`trava_perdida`](../erros/trava_perdida.md), [`transmissao_em_andamento`](../erros/transmissao_em_andamento.md), [`transmissao_ja_gravada`](../erros/transmissao_ja_gravada.md).
