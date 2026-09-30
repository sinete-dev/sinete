# `recusa_repetida`: a mesma nota já foi recusada pela SEFAZ o limite de vezes

O emissor montou e assinou o documento, mas identificou que a SEFAZ (Secretaria da Fazenda) já recusou o mesmo conteúdo, com o mesmo código de rejeição, o limite de vezes dentro da janela configurada. A contagem é feita por tipo de documento e `ref`, a referência que sua aplicação usa para identificar a nota. Por padrão, após 3 recusas iguais em 1 hora, a quarta tentativa é barrada. A janela é contada desde a primeira recusa da sequência.

A comparação desconsidera campos que podem mudar automaticamente a cada montagem. Na NF-e (Nota Fiscal Eletrônica) e na NFC-e (Nota Fiscal de Consumidor Eletrônica), ficam fora as datas e horas de emissão e de saída, o código numérico e o dígito verificador da chave de acesso, o identificador derivado da chave, o `hashCSRT`, a assinatura e o grupo suplementar que contém o QR Code. No MDF-e (Manifesto Eletrônico de Documentos Fiscais), ficam fora a data e hora de emissão, o código numérico e o dígito verificador da chave, o identificador derivado da chave, a assinatura e o grupo suplementar. Na DPS (Declaração de Prestação de Serviços) da NFS-e (Nota Fiscal de Serviço Eletrônica), ficam fora a data e hora de emissão e a assinatura. Quando o código da recusa indica um problema que pode ser corrigido nesses campos, como uma data de emissão atrasada, a comparação usa todos os bytes do XML assinado. Nesse caso, uma alteração nos bytes permite uma nova tentativa.

O documento desta tentativa não foi gravado nem enviado. O erro lançado é `ErroRecusaRepetida`, de `@sinete/emissor`, que estende `ErroSinete` e tem `code: 'recusa_repetida'`. Em `detalhes`, estão `tipo` (tipo de documento), `cStat` (código da rejeição), `xMotivo` (descrição da rejeição), `recusadaEm` (data e hora da última recusa), `primeiraEm` (data e hora da primeira recusa da sequência), `vezes`, `limite` e `janelaMs` (duração da janela em milissegundos). Decida pelo `code`, com `ehErroSinete(e, 'recusa_repetida')`, nunca pela mensagem.

## Causa

Um reenvio da mesma nota sem corrigir a causa da rejeição: um job que tenta emitir novamente toda nota recusada ou uma pessoa clicando em "emitir" outra vez. Atualizar apenas a hora de emissão e o `cNF`, código numérico que compõe a chave de acesso da NF-e, normalmente não muda o conteúdo comparado.

A SEFAZ conta os reenvios da mesma nota com a mesma rejeição. A regra de referência prevê bloqueio do emitente por até uma hora em todas as requisições quando há mais de 30 rejeições iguais em uma hora, com limites configuráveis pelo ambiente autorizador. Esse bloqueio corresponde à rejeição 656, consumo indevido, descrita no Manual de Orientação do Contribuinte (MOC), versão 7.0, Anexo I, item 4.3.1.

O emissor permite as primeiras tentativas porque a causa pode ter sido resolvida fora da nota entre uma e outra. Por padrão, ele barra novos reenvios bem antes do limite de referência da SEFAZ. Configure a janela e o limite nas opções do emissor com `recusaRepetida: { janelaMs, limite }`. A barreira fica ativa por padrão quando o `store`, responsável pela persistência das transmissões, implementa os dois métodos `registrarRecusa` e `recusaRecente`. A opção `recusaRepetida: false` desliga a barreira.

## Correção

Mostre a recusa original (`detalhes.cStat` e `detalhes.xMotivo`, com a dica do catálogo em `sinete/rejeicoes`) e peça a correção da nota. Uma mudança no conteúdo usado na comparação permite uma nova tentativa. Se essa tentativa também for recusada, a contagem recomeça quando o conteúdo ou o código da rejeição é diferente.

Quando a causa estava fora da nota e já foi resolvida, emita de novo com `reenviarRecusado: true` nas opções de `emitir`, ou espere a janela passar. Exemplos são a regularização do credenciamento do emitente na SEFAZ, para a rejeição 203, e do cadastro da inscrição estadual (IE), para a rejeição 230.

Recusas transitórias do serviço não entram na contagem. Na NF-e, são os códigos 108 e 109 (serviço paralisado), 114 (Sefaz Virtual de Contingência, ou SVC, desabilitada) e 999 (erro não catalogado).

## Armadilha

Não troque a `ref` só para escapar da barreira: a nota continua a mesma para a SEFAZ e a rejeição volta, contando para o bloqueio. Não use `reenviarRecusado: true` em todo reenvio automático; essa opção existe para permitir uma nova tentativa depois de uma correção feita fora da nota.
