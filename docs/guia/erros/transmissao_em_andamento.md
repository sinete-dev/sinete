# `transmissao_em_andamento`: outro processo está transmitindo este documento

O emissor tentou adquirir a trava que impede transmissões simultâneas do mesmo documento, identificado pelo par `tipo` (tipo de documento) e `ref` (identificador no seu sistema). Outro processo, ou outra chamada do mesmo processo, já tem essa trava em vigor. O erro lançado é `TransmissaoEmAndamentoError`, de `@sinete/emissor`, que estende `ErroSinete` e tem `code: 'transmissao_em_andamento'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'transmissao_em_andamento')`, de `@sinete/core`, nunca pela mensagem.

## Causa

Duas chamadas para o mesmo `tipo` e a mesma `ref` ao mesmo tempo: um duplo clique, o job de retomada rodando enquanto a pessoa emite ou dois servidores recebendo o mesmo pedido. A chamada que lançou esse erro não enviou nada à SEFAZ (Secretaria da Fazenda) nem ao serviço autorizador do documento.

## Correção

Mostre "em processamento" e consulte o resultado depois pelo seu sistema. A função `aoDecidir`, implementada por você, guarda o documento quando o emissor obtém um desfecho autorizado ou denegado. Para tentar novamente, chame `emitir` ou `retomar` mais tarde, com a mesma `ref`. Se já houver bytes do documento assinado gravados, ambos retomam a transmissão com esses bytes. Sem bytes gravados, `retomar` devolve `undefined`, enquanto `emitir` monta o documento a partir da entrada fornecida.

A trava é renovada enquanto a transmissão está em andamento e liberada ao fim da chamada. Se o processo que a detém morrer, ela vence ao terminar o prazo contado da aquisição ou da última renovação: 10 minutos por padrão, configuráveis em `trava.prazoMs`. Depois disso, outra chamada pode adquirir a trava e retomar com os bytes gravados, se houver.

## Armadilha

Não "resolva" gerando outra `ref` para o mesmo pedido: o emissor passa a tratá-lo como outro documento, sem aproveitar a trava nem os bytes da referência original. Isso pode gerar outro documento para o mesmo número. E não apague a trava à mão no banco; espere que seja liberada ou que o prazo vença.
