# Como emitir a carta de correção (CC-e) da NF-e

A carta de correção eletrônica (CC-e) é o evento 110110 da Nota Fiscal Eletrônica (NF-e): corrige um erro de preenchimento sem cancelar a nota. Toda CC-e inclui uma condição de uso no campo `xCondUso`, com texto fixado pelo schema de validação do evento. Esse texto reproduz o Convênio S/N de 15 de dezembro de 1970, art. 7º, § 1º-A, e proíbe corrigir as variáveis que determinam o valor do imposto (base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação), dados cadastrais que mudem o remetente ou o destinatário e a data de emissão ou de saída. Para esses casos, cancelar e emitir outra nota depende de ainda ser possível realizar o cancelamento; veja [Cancelamento](cancelamento.md).

## Enviar

Use o emissor de NF-e, que reutiliza o transporte e o certificado da emissão. O texto da condição de uso é preenchido pelo sinete.

```ts
import { createNfeEmissor } from 'sinete/emissor/nfe';

const nfe = await createNfeEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const r = await nfe.cartaCorrecao({
  chave,
  xCorrecao: 'Onde se le Rua A, numero 1, leia-se Rua A, numero 10',
  nSeqEvento: 1,
});
if (r.tipo === 'autorizado') await guardarEvento(chave, r.valor.procEventoNFe);
else console.log(r.tipo, r.cStat, r.xMotivo);
```

- **Sequência.** Cada nova CC-e da mesma nota substitui a anterior e leva o número sequencial seguinte (`nSeqEvento` de 1 a 20). Inclua no texto as correções anteriores que devem continuar valendo. O sinete lança `ErroDeConfiguracao` antes do envio se o sequencial não for inteiro ou estiver fora desse intervalo. A Secretaria da Fazenda (SEFAZ) rejeita sequencial repetido com o código 573 (duplicidade de evento). O código 594 corresponde à rejeição por sequencial acima do permitido, mas o sinete impede esse envio na validação local.
- **Texto.** `xCorrecao` deve ter de 15 a 1000 caracteres, conforme o schema do evento no pacote PL_010d. Fora desse intervalo, o sinete lança `ErroDeValidacao` antes do envio.
- **Autorizador.** A CC-e vai sempre ao autorizador da unidade federativa (UF), mesmo quando a nota foi autorizada pela SEFAZ Virtual de Contingência (SVC), usada como alternativa ao autorizador habitual.
- O retorno é o `EventoOutcome`, definido como um `ResultadoSefaz` do cliente. Neste método, `tipo` é `autorizado` quando o evento foi registrado ou `recusado` quando foi rejeitado; `cStat` é o código de resposta da SEFAZ e `xMotivo` é sua descrição. Em caso de registro, `procEventoNFe` contém o XML do evento com a resposta da SEFAZ. A CC-e não usa o desfecho normalizado do emissor nem mantém estado entre chamadas.

## Quando o pedido fica sem resposta

`cartaCorrecao` propaga falhas de transporte, como `ErroDeTempoEsgotado` com código `tempo_esgotado` ou `ErroTransporte` com código `conexao_recusada`. Se a resposta não chegou, o evento pode ter sido registrado. Antes de reenviar, consulte: `recuperarEventoRegistrado` devolve o evento 110110 de maior sequencial encontrado na consulta da chave, desde que tenha retorno de registro válido.

```ts
import { recuperarEventoRegistrado } from 'sinete/nfe';

const rec = await recuperarEventoRegistrado(nfe.cliente, chave, '110110');
if (rec.registrado && rec.evento.nSeqEvento === '1') await guardarEvento(chave, rec.evento.procEventoNFe);
```

Se o evento recuperado tem o sequencial que você enviou, confira o conteúdo da correção e guarde o XML. A mesma consulta serve após uma rejeição 573: o código de duplicidade, sozinho, não comprova que o conteúdo registrado é o que você pretendia enviar.

`registrado: false` significa que a consulta não mostrou um evento válido desse tipo; não prova que ele não existe. A função examina os eventos quando `rec.consulta.tipo` é `autorizado` ou `denegado`. Nos demais casos, a consulta foi inconclusiva: tente novamente depois. Com a consulta concluída, confira também a situação da nota antes de reenviar o pedido com o mesmo sequencial. Se a função recuperar outro sequencial, verifique os registros antes de decidir pelo reenvio, pois ela devolve apenas o maior.

## Imprimir o DACCe

O DACCe é o Documento Auxiliar da Carta de Correção Eletrônica, a representação impressa da CC-e.

```ts
import { dacce, toPdf } from 'sinete/da/cce';

const pdf = toPdf(dacce(procEventoNFe, { nfe: nfeProc }));
```

A opção `nfe` recebe o XML da nota autorizada (`nfeProc`) e é opcional: completa o DACCe com os dados da nota. Se o XML for de outra chave, `dacce` lança `DanfeError` com código `evento_incompativel`. O leiaute do DACCe segue uma convenção de mercado: o Manual de Orientação do Contribuinte (MOC) não define um.

## Armadilhas

- **Sequencial calculado pela contagem local.** Se uma CC-e anterior ficou sem resposta e foi registrada, a sua contagem fica atrás da SEFAZ. Para uma nova correção, use o `nSeqEvento` devolvido por `recuperarEventoRegistrado`, convertido em número, mais um, respeitando o limite de 20. Para recuperar um pedido sem resposta, confira primeiro o sequencial enviado; não avance automaticamente.
- **CC-e para valor.** A condição de uso veda corrigir quantidade ou valor. O sinete não interpreta o texto da correção, então não rejeita o pedido por esse motivo: a conferência é sua.

## Veja também

- [Cancelamento](cancelamento.md).
- [Documentos auxiliares](documentos-auxiliares.md).
- Referência: [`@sinete/nfe`](../referencia/nfe.md) e [`@sinete/da`](../referencia/da.md).
