# `transmissao_ja_gravada`: já há bytes gravados para o documento

O `TransmissaoStore`, responsável por persistir o XML assinado e controlar a trava de transmissão, recusou uma gravação porque já existem bytes assinados para o mesmo `tipo` de documento e a mesma `ref`, o identificador do documento no sistema do integrador. O erro é uma instância de `TransmissaoJaGravadaError` (`@sinete/emissor`), que estende `ErroSinete` e tem `code: 'transmissao_ja_gravada'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'transmissao_ja_gravada')` de `@sinete/core`, nunca pela mensagem.

## Causa

Uma segunda chamada a `store.gravar(trava, gravacao)` tentou gravar bytes para um documento que já tinha uma gravação. Isso pode ocorrer em código que grava diretamente no store, por exemplo, um servidor que recebe XML assinado no navegador. Com um adaptador que respeita o contrato, o emissor adquire a trava, lê antes de gravar e retoma com os bytes encontrados. Se o erro surgir nesse fluxo, confira a implementação do adaptador e os outros pontos que gravam no store.

## Correção

Leia o registro existente com `store.ler(tipo, ref)`; o XML assinado está em `registro.xml`. Para continuar a transmissão, use `emissor.retomar(ref)`, que lê novamente o store e usa os bytes gravados, sem montar outro documento. Se o código que tentou gravar ainda mantiver a trava, solte-a com `store.soltar(trava)` antes de chamar `retomar`, pois o emissor precisa adquirir sua própria trava.

A gravação recusada não altera os bytes existentes. Desconsidere os novos bytes: substituir o XML assinado por outro pode criar um segundo documento para o mesmo número. Não chame `store.descartar` para resolver este erro, pois esse método apaga a gravação que deve ser retomada.

## Armadilha

Gravar por cima, com um `UPDATE` sem verificar que ainda não há bytes gravados, apaga a única cópia de um documento que pode estar autorizado. A suíte de contrato (`sinete/emissor/contrato`, também disponível em `@sinete/emissor/contrato`) verifica tanto a recusa da segunda gravação quanto a preservação dos bytes originais.
