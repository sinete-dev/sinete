# Como emitir a carta de correção (CC-e) da NF-e

A carta de correção eletrônica (CC-e) é o evento 110110 da Nota Fiscal Eletrônica (NF-e): corrige um erro de preenchimento sem cancelar a nota. Toda CC-e inclui uma condição de uso no campo `xCondUso`, com texto fixado pelo schema de validação do evento. Esse texto reproduz o Convênio S/N de 15 de dezembro de 1970, art. 7º, § 1º-A, e proíbe corrigir as variáveis que determinam o valor do imposto (base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação), dados cadastrais que mudem o remetente ou o destinatário e a data de emissão ou de saída. Para esses casos, cancelar e emitir outra nota depende de ainda ser possível realizar o cancelamento; veja [Cancelamento](cancelamento.md).

## Enviar

Use o emissor de NF-e, que reutiliza o transporte e o certificado da emissão. O texto da condição de uso é preenchido pelo sinete.

```ts
import { criarEmissorNfe } from 'sinete/emissor/nfe';

const nfe = await criarEmissorNfe({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const r = await nfe.cartaCorrecao({
  chave,
  xCorrecao: 'Onde se le Rua A, numero 1, leia-se Rua A, numero 10',
  nSeqEvento: 1,
});
if (r.tipo === 'registrado') await guardarEvento(chave, r.procEvento);
else if (r.tipo === 'recusado') console.log(r.cStat, r.xMotivo, r.dica);
else agendarNovaTentativa(chave, r.motivo);
```

- **Sequência.** Cada nova CC-e da mesma nota substitui a anterior e leva o número sequencial seguinte (`nSeqEvento` de 1 a 20). Inclua no texto as correções anteriores que devem continuar valendo. O sinete lança `ErroDeConfiguracao` antes do envio se o sequencial não for inteiro ou estiver fora desse intervalo. A Secretaria da Fazenda (SEFAZ) rejeita sequencial repetido com o código 573 (duplicidade de evento). O código 594 corresponde à rejeição por sequencial acima do permitido, mas o sinete impede esse envio na validação local.
- **Texto.** `xCorrecao` deve ter de 15 a 1000 caracteres, conforme o schema do evento no pacote PL_010d. Fora desse intervalo, o sinete lança `ErroDeValidacao` antes do envio.
- **Autorizador.** A CC-e vai sempre ao autorizador da unidade federativa (UF), mesmo quando a nota foi autorizada pela SEFAZ Virtual de Contingência (SVC), usada como alternativa ao autorizador habitual.
- O retorno é um `DesfechoEvento`, o mesmo do `cancelar`: `registrado` traz o `evento` e o `procEvento` (o XML do evento com a resposta da SEFAZ); `recusado` traz `cStat`, `xMotivo` e, quando o catálogo tem, a `dica`; `pendente` diz que ainda não se sabe se a SEFAZ registrou a correção. O campo `recuperado` do `registrado` indica que o evento veio da consulta da chave, e não da resposta do pedido.

## Quando o pedido fica sem resposta

O emissor trata a falta de resposta e a duplicidade de evento pela consulta da chave, e nunca conclui pelo `cStat` sozinho:

- **Sem resposta** (tempo esgotado, conexão caída): o emissor consulta a chave. Se a SEFAZ registrou a CC-e com o mesmo `nSeqEvento` e o mesmo `xCorrecao`, o desfecho é `registrado` com `recuperado: true`. Se a consulta não mostra o evento, o desfecho é `pendente` com `motivo: 'sem-resposta'` e o erro do pedido em `causa`: tente de novo com o mesmo sequencial e o mesmo texto.
- **Rejeição 573 ou 580** (evento já registrado): a mesma consulta decide. A correção registrada com o mesmo texto volta como `registrado` com `recuperado: true`; se a sequência já tem outro texto, o desfecho é `recusado` com o 573, e a próxima CC-e leva o `nSeqEvento` seguinte.

Sem o emissor, a mesma recuperação está em `recuperarEventoRegistrado`, do `sinete/nfe`. Com o sequencial, ela devolve só o evento dessa sequência; sem ele, o de maior sequencial.

```ts
import { recuperarEventoRegistrado } from 'sinete/nfe';

const rec = await recuperarEventoRegistrado(cliente, chave, '110110', 1);
if (rec.registrado) await guardarEvento(chave, rec.evento.procEventoNFe);
```

Confira o texto da correção no `procEventoNFe` antes de guardar. `registrado: false` significa que a consulta não mostrou um evento válido dessa sequência; não prova que ele não existe. A função examina os eventos quando `rec.consulta.tipo` é `autorizado` ou `denegado`. Nos demais casos, a consulta foi inconclusiva: tente novamente depois.

## Imprimir o DACCe

O DACCe é o Documento Auxiliar da Carta de Correção Eletrônica, a representação impressa da CC-e.

```ts
import { dacce, gerarPdf } from 'sinete/da/cce';

const pdf = gerarPdf(dacce(procEventoNFe, { nfe: nfeProc }));
```

A opção `nfe` recebe o XML da nota autorizada (`nfeProc`) e é opcional: completa o DACCe com os dados da nota. Se o XML for de outra chave, `dacce` lança `ErroDa` com código `evento_incompativel`. O leiaute do DACCe segue uma convenção de mercado: o Manual de Orientação do Contribuinte (MOC) não define um.

## Armadilhas

- **Sequencial calculado pela contagem local.** Se uma CC-e anterior ficou sem resposta e foi registrada, a sua contagem fica atrás da SEFAZ. Para uma nova correção, use o `nSeqEvento` devolvido por `recuperarEventoRegistrado`, convertido em número, mais um, respeitando o limite de 20. Para recuperar um pedido sem resposta, confira primeiro o sequencial enviado; não avance automaticamente.
- **CC-e para valor.** A condição de uso veda corrigir quantidade ou valor. O sinete não interpreta o texto da correção, então não rejeita o pedido por esse motivo: a conferência é sua.

## Veja também

- [Cancelamento](cancelamento.md).
- [Documentos auxiliares](documentos-auxiliares.md).
- Referência: [`@sinete/nfe`](../referencia/nfe.md) e [`@sinete/da`](../referencia/da.md).
