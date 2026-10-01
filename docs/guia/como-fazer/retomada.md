# Como retomar documentos pendentes

Um documento fica pendente quando o emissor do sinete grava os bytes assinados, mas ainda não obtém uma decisão do serviço autorizador. Isso pode acontecer porque o envio ou a consulta ficou sem resposta (`motivo: 'sem-resposta'`), porque a consulta respondeu sem decidir, por exemplo com o serviço paralisado (`consulta-indefinida`), ou porque o lote foi recebido, mas a consulta do recibo continuou indicando processamento até o fim da espera (`lote-em-processamento`, só NF-e, a Nota Fiscal Eletrônica). Há também a NFC-e, Nota Fiscal de Consumidor Eletrônica, gravada off-line sem envio pela [contingência automática](contingencia.md#contingência-automática) (`contingencia`). Enquanto ela permanece nesse estado, a retomada automática adia o envio sem contar tentativa nem gerar alerta.

O processo também pode ter caído no meio da transmissão. Em todos esses casos, os bytes continuam no `TransmissaoStore`, a interface que guarda as transmissões. Retomar é continuar com eles: consultar a chave e, se o documento não consta na SEFAZ, a Secretaria da Fazenda, reenviar os mesmos bytes. Na NFS-e Nacional, a Nota Fiscal de Serviço Eletrônica, a consulta parte do identificador da DPS, a Declaração de Prestação de Serviços enviada para gerar a nota. Retomar nunca monta o documento de novo.

Há três jeitos de retomar, e os três usam a mesma trava, então podem conviver.

## 1. O usuário tenta de novo

`emitir(ref, entrada)` com uma `ref` que já tem bytes gravados retoma com eles e ignora a entrada. É o que acontece quando a pessoa clica em "emitir" de novo no mesmo pedido. Não há nada a fazer além de usar sempre a mesma `ref` para o mesmo documento.

```ts
import { criarEmissorNfe } from 'sinete/emissor/nfe';

const nfe = await criarEmissorNfe({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const desfecho = await nfe.emitir(pedido.id, nota); // com bytes gravados para pedido.id, `nota` é ignorada
```

## 2. O seu código retoma um documento

`retomar(ref)` retoma pelos bytes gravados e devolve o desfecho, ou `undefined` se não há nada gravado para a `ref`. Não recebe entrada. Assim como `emitir`, exige uma função `aoDecidir` para guardar o documento decidido, definida no emissor ou nas opções da chamada.

```ts
import { criarEmissorNfe } from 'sinete/emissor/nfe';

const nfe = await criarEmissorNfe({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const desfecho = await nfe.retomar('pedido-42');
if (desfecho === undefined) console.log('nada gravado para pedido-42');
else if (desfecho.tipo === 'pendente') console.log('ainda sem decisão:', desfecho.motivo);
```

## 3. Um job retoma tudo o que ficou parado

`retomarPendentes` roda uma execução da retomada automática: seleciona no store as gravações paradas, sem trava em vigor e dentro da idade máxima, obtém o emissor do certificado de cada uma e chama `retomar`. O agendamento é seu (cron, fila, timer). Use um intervalo maior que `prazoMs`, de 7 minutos por padrão, para reduzir a sobreposição entre execuções. Esse prazo impede o início de novas retomadas, mas não interrompe uma que já começou; por isso, o intervalo sozinho não garante que as execuções nunca se sobreponham.

```ts
import { criarPoolDeEmissores, retomarPendentes } from 'sinete/emissor';
import { criarEmissorNfe } from 'sinete/emissor/nfe';

// Um emissor por certificado, reaproveitado entre emissões e retomadas.
const pool = criarPoolDeEmissores({
  criar: (cert) => criarEmissorNfe({ ...cert, ambiente: 'producao', store, aoDecidir }),
});

const resumo = await retomarPendentes({
  store,
  usarEmissor: async (registro, fn) => pool.usar(await certificadoDoEmitente(registro.meta), fn),
  aoAlertar: (registro, ultimo, tentativas) => filaDeAlertas.gravar({ ref: registro.ref, id: registro.id, ultimo, tentativas }),
  deveRetomar: (registro) => registro.tipo === 'nfe',
  // aoDecidir e jaGuardado: opcionais, passados a cada retomar (senão, valem os do emissor)
});
console.log(resumo.candidatas, resumo.desfechos, resumo.alertas, resumo.adiadas);
```

- `usarEmissor` recebe o registro gravado (com o `meta` que você passou em `emitir(ref, entrada, { meta })`) e disponibiliza o emissor do certificado certo durante a função recebida. O emissor precisa usar o mesmo `store`. Guarde no `meta` o que você precisa para achar o certificado (o id do emitente, não a senha).
- `aoAlertar` é obrigatório e é chamado no máximo uma vez por gravação: depois de `alertarDepoisDe` tentativas sem desfecho (3 por padrão), ou já na primeira quando o desfecho é `divergente`, porque tentar de novo não resolve a divergência. O alerta é marcado no store antes da chamada. Para entregar o alerta com novas tentativas, grave-o numa fila do próprio banco dentro do `aoAlertar` e entregue de lá. Se o próprio `aoAlertar` lançar um erro, a execução é interrompida e a marcação não é desfeita; essa falha precisa ser acompanhada pela aplicação.
- `aoDecidir` e `jaGuardado`, quando passados, substituem os do emissor em cada retomada. `jaGuardado` verifica se o documento já foi salvo no seu sistema. O emissor do pool pode não ter `aoDecidir` próprio, desde que a função seja passada à retomada (veja [vários emitentes](varios-emitentes.md)).
- `deveRetomar` é o seu filtro (uma configuração por emitente, por exemplo). O que ele recusa não conta no lote.
- Você pode retomar NF-e e NFC-e (`tipo: 'nfe'`), MDF-e, o Manifesto Eletrônico de Documentos Fiscais (`tipo: 'mdfe'`), e NFS-e Nacional (`tipo: 'nfse'`). O `tipo` do registro diz qual emissor disponibilizar.

A política (`politica`, com os padrões definidos em `POLITICA_RETOMADA_PADRAO`) seleciona gravações de até `idadeMaximaMs` (3 dias), paradas há pelo menos `paradaHaMs` (5 minutos). Cada execução retoma um `lote` de até 5 gravações, priorizando as nunca tentadas, e não inicia novas retomadas depois de `prazoMs` (7 minutos). O alerta ocorre depois de `alertarDepoisDe` (3) tentativas sem desfecho, salvo o caso `divergente`, que alerta na primeira. Depois do alerta, há no máximo uma tentativa por `intervaloDepoisDoAlertaMs` (1 hora).

A idade máxima é finita de propósito: uma gravação de dias atrás pode corresponder a uma operação para a qual outro documento já foi emitido, e autorizá-la automaticamente seria uma surpresa. Ela continua gravada e ainda pode ser retomada por `emitir` ou `retomar`.

## O que fazer com cada desfecho da retomada

O campo `cStat` é o código de status retornado pelo serviço autorizador. O `digVal` é o resumo criptográfico informado no protocolo para conferir se o conteúdo registrado corresponde aos bytes gravados. O campo `proc`, quando presente, reúne o documento e seu protocolo.

| Desfecho | O que aconteceu | O que fazer |
|---|---|---|
| `autorizado`, `denegado` | o `aoDecidir` já guardou o documento; os bytes saíram do store | não reenviar. Em `autorizado`, `situacaoAtual` informa se o documento já foi cancelado ou encerrado fora deste fluxo; guarde essa situação também. Com `situacaoPosterior: 'divergente'`, esse caso vem como `divergente`. A denegação, que impede o uso do número e só ocorre na NF-e, é definitiva mesmo com o protocolo sem `digVal` (`conteudo: 'sem-digval'`) ou com outro conteúdo na chave (`conteudo: 'difere'`); nesses dois casos, não há `proc`. Com `difere`, alguém precisa ser informado de que o conteúdo registrado é outro, mas a retomada não volta à gravação |
| `ja-guardado` | o `jaGuardado` disse que o documento destes bytes já está no seu sistema; não houve consulta nem envio ao serviço autorizador e os bytes saíram do store | nada |
| `recusado` | o serviço autorizador recusou; os bytes foram descartados, exceto quando o `cStat` está entre os códigos indefinidos do documento | se os bytes foram descartados, mostrar a rejeição e deixar a pessoa corrigir e emitir de novo com a mesma `ref`. Se foram mantidos, continuar a retomada: uma nova chamada a `emitir` ainda ignora a entrada e usa os bytes gravados |
| `pendente` | ainda sem decisão; os bytes ficam. `anterior` traz a recusa que levou à consulta quando ela não decidiu, como as duplicidades 204 e 539 na NF-e ou E0014 na NFS-e | aguardar a próxima execução; se `anterior` estiver presente, mostrar também essa recusa |
| `divergente` | o serviço autorizador tem outro documento no número desses bytes, ou a chave está autorizada e nem a resposta nem a consulta trazem o `digVal` (`conteudo: 'sem-digval'`). Também pode indicar documento já cancelado ou encerrado, com a opção `situacaoPosterior: 'divergente'` | alguém precisa analisar: o alerta sai na primeira tentativa da retomada automática, e ela ainda tenta uma vez por intervalo, até a idade máxima; veja [o que fazer com `divergente`](../explicacao/bytes-antes-do-envio.md) |

No resumo, `candidatas` conta todas as gravações encontradas pela seleção, inclusive as que ficaram fora do lote. As processadas entram em `desfechos` como `resolvida` (a gravação original saiu do store ou foi substituída), `sem-desfecho` (os bytes continuam gravados e conta uma tentativa), `ocupada` (outro processo tinha ou assumiu a trava, ou outra execução já tentou a gravação; não conta tentativa), `sem-bytes` (os bytes já não estavam disponíveis quando conferidos) ou `ignorada` (o `deveRetomar` recusou). `alertas` conta os alertas emitidos. `adiadas` conta as retomadas adiadas pelo prazo da execução ou porque a NFC-e continua em contingência off-line; estas não contam tentativa nem geram alerta.

## Armadilhas

- **Remontar para "tentar de novo".** Chamar `montarNfe` remonta o documento; chamar `emitir` com outra `ref` permite uma nova montagem e transmissão, mesmo para o mesmo pedido e número fiscal. A `ref` é o id estável do documento no seu sistema.
- **Apagar os bytes pendentes à mão** para destravar a tela. O documento pode estar autorizado no serviço autorizador; apagar os bytes não cancela a autorização e impede a retomada. Na NF-e e no MDF-e, `emissor.consultar(id)` consulta pela chave de acesso. Na NFS-e, o `id` gravado identifica a DPS, não a chave da nota: `emissor.cliente.consultarDps(id)` permite obter a chave para consultar a NFS-e. Consultar não substitui guardar o documento no seu sistema.
- **Retomada sem `aoDecidir` idempotente.** Se o processo cair entre guardar o documento e apagar os bytes, a retomada decide de novo e chama o `aoDecidir` outra vez com o mesmo documento. O `jaGuardado` evita essa segunda decisão quando identifica o documento salvo, mas não dispensa uma gravação idempotente, como um upsert, que insere ou atualiza sem duplicar o registro.
- **Abortar e descartar os bytes.** Com `signal` em `emitir` ou `retomar`, o abort depois de gravar devolve `pendente` com `motivo: 'sem-resposta'` e mantém os bytes: o pedido pode ter chegado. Antes de gravar, lança o erro `cancelado` e nada fica. No desligamento do processo, passe o mesmo `signal` ao `retomarPendentes`: nenhuma retomada nova começa, e as gravações que ficaram contam em `adiadas`, sem tentativa nem alerta.
- **Agendar mais de uma execução ao mesmo tempo** não produz documento duplicado, pois a trava impede transmissões simultâneas dos mesmos bytes, mas pode gerar consultas extras. Use um intervalo maior que `prazoMs` e, se precisar impedir qualquer sobreposição, controle também a execução no agendador.
- **Reemitir a mesma nota recusada sem corrigir a causa.** Com `registrarRecusa` e `recusaRecente` implementados no store e a barreira `recusaRepetida` habilitada, três recusas definitivas iguais em uma hora barram, por padrão, a próxima emissão da mesma `ref` com o mesmo conteúdo. O emissor lança `ErroRecusaRepetida` antes de gravar e enviar. Essa proteção ajuda a evitar a rejeição 656, de consumo indevido; mudar apenas campos que variam automaticamente na montagem pode não liberar o envio. Corrija a causa da rejeição antes de tentar novamente.

## Veja também

- [Como implementar o `TransmissaoStore`](store-sql.md).
- [Como emitir por vários emitentes no mesmo servidor](varios-emitentes.md).
- [Por que gravar os bytes antes do envio](../explicacao/bytes-antes-do-envio.md).
- Referência: [`@sinete/emissor`](../referencia/emissor.md).
