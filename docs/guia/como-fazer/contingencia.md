# Como emitir em contingência

Contingência é emitir quando o autorizador normal, o serviço que autoriza o documento fiscal, está indisponível. O sinete cobre três casos: a NF-e (Nota Fiscal eletrônica) na SVC (Sefaz Virtual de Contingência, SVC-AN ou SVC-RS, conforme o estado, identificado pela UF), o MDF-e (Manifesto Eletrônico de Documentos Fiscais) em contingência off-line e a NFC-e (Nota Fiscal de Consumidor eletrônica) em contingência off-line, descrita em [Como emitir NFC-e](nfce.md#contingência-off-line). A modalidade é escolhida na entrada ou nas opções de montagem. Na NF-e e na NFC-e, também pode ser escolhida pela [contingência automática](#contingência-automática).

O sinete ainda não emite NF-e por EPEC (Evento Prévio de Emissão em Contingência) nem por FS-DA (Formulário de Segurança para Impressão de Documento Auxiliar). A NFC-e não tem SVC. As referências abaixo usam MOC para Manual de Orientação do Contribuinte e NT para Nota Técnica.

## NF-e na SVC

A NF-e em SVC é outro documento: a forma de emissão (`tpEmis` 6 para SVC-AN, 7 para SVC-RS; MOC 7.0, campo B22) faz parte da chave de acesso. A data e hora de entrada em contingência (`dhCont`) e a justificativa (`xJust`) ficam no XML, mas não compõem a chave. Com o emissor, a contingência vai na entrada, e o autorizador é determinado pela chave: a nota com `tpEmis` 6 vai à SVC-AN, com 7 à SVC-RS, sem opção adicional no emissor.

```ts
import { manualClock } from 'sinete/core';
import { createNfeEmissor } from 'sinete/emissor/nfe';
import { autorizadorContingencia } from 'sinete/nfe';

const clock = manualClock('2026-09-26T10:00:00-03:00');
const nfe = await createNfeEmissor({ pfx, senha, ambiente: 'homologacao', clock, store, aoDecidir });

// Qual SVC atende a UF do emitente e o tpEmis que a nota leva.
const { autorizador, tpEmis } = autorizadorContingencia('SP', 'homologacao');
const d = await nfe.emitir('pedido-43', {
  ...nota,
  contingencia: {
    tpEmis,
    dhCont: new Date('2026-09-26T09:55:00-03:00'), // quando a contingência começou, com fuso
    xJust: 'SEFAZ da UF sem resposta desde as 9h55',
  },
});
console.log(autorizador, d.tipo);
```

- **O que já está gravado continua como está.** Um pedido com XML assinado gravado em emissão normal, por exemplo, porque a resposta se perdeu ou a SEFAZ (Secretaria da Fazenda) caiu durante o envio, é retomado com os mesmos bytes. A chamada a `emitir` com a mesma `ref`, o identificador do pedido no sistema do integrador, ignora a entrada nova enquanto essa gravação existir. A contingência só é aplicada na montagem de documentos novos. Não reassine um pendente em SVC com o mesmo número: se a SEFAZ da UF autorizou os bytes originais, você teria duas notas para o mesmo número.
- **Consulta e cancelamento no SVC.** A nota autorizada em SVC é consultada e cancelada na SVC que a autorizou, mesmo depois de o autorizador normal voltar (NT 2013.007). O cliente determina esse destino pela chave. A carta de correção vai sempre ao autorizador normal da UF.
- **Justificativa.** `xJust` deve ter de 15 a 256 caracteres. Informe `dhCont` como um `Date` e use fuso explícito ao construí-lo a partir de uma string. A entrada em contingência não pode ser posterior à emissão.
- **Serviços sem documento** (status do serviço, recibo consultado sem a nota) vão à SVC num cliente criado com `createNfeClient({ ..., contingencia: 'svc' })`; a emissão não precisa disso.
- **Inutilização só no ambiente normal.** A inutilização comunica que uma faixa de números não será usada. A SVC não oferece esse serviço (NT 2013.007 v1.03, item 04.5), e o cliente com `contingencia: 'svc'` o recusa com `servico_nao_oferecido`: guarde a faixa e inutilize no autorizador normal da UF quando ele voltar.

Para verificar a disponibilidade antes de decidir, `nfe.cliente.statusServico()` devolve o `cStat`, o código de status da resposta do serviço: 107 significa em operação; 108, paralisado momentaneamente; 109, paralisado sem previsão (MOC 7.0, tabela 4.4.1). A consulta usa a UF configurada no cliente. A decisão de entrar em contingência é do emitente, mas a SVC só autoriza depois que a SEFAZ da UF a ativa manualmente, para uma parada programada ou não (NT 2013.007 v1.03, item 03).

Antes de mandar a nota à SVC, consulte o status nela, num cliente criado com `contingencia: 'svc'`: 107 indica a SVC ativada; 113, "SVC será desabilitada" na data e hora informadas em `xMotivo`, o texto que explica o status; 114, desabilitada pela SEFAZ de origem (item 04.7). Só entre com 107. A nota enviada à SVC sem ativação é recusada com 114 (item 04.1, regras C03.2 e GB02.2). Essa recusa não autoriza a nota nem consome seu número; o emissor descarta a gravação recusada.

## MDF-e em contingência off-line

O MDF-e em contingência off-line (`tpEmis` 2) pode ser emitido sem autorização prévia da SEFAZ. O QR Code leva o parâmetro `sign` com a assinatura da chave de acesso, e o DAMDFE, o documento auxiliar do MDF-e, sai com "EMISSÃO EM CONTINGÊNCIA". O documento tem 168 horas a partir da emissão para ser transmitido com o mesmo `cMDF`, o código numérico que compõe a chave (MOC MDF-e, Visão Geral, item 11.1). A forma de emissão é uma opção da montagem, então use um emissor só para a contingência:

```ts
import { damdfe, toPdf } from 'sinete/da/mdfe';
import { createMdfeEmissor } from 'sinete/emissor/mdfe';

const offline = await createMdfeEmissor({
  pfx,
  senha,
  ambiente: 'homologacao',
  store,
  aoDecidir,
  montagem: { tpEmis: '2' },
});
const d = await offline.emitir('viagem-8', mdfe);
if (d.tipo === 'pendente') {
  // A autorização não foi confirmada: os bytes ficaram gravados e a viagem sai com o DAMDFE deles.
  const gravado = await store.ler('mdfe', 'viagem-8');
  if (gravado !== undefined) {
    await imprimir(toPdf(damdfe(gravado.xml)));
  }
}
```

O emissor tenta enviar na hora. Se a SEFAZ autoriza, o MDF-e sai autorizado como qualquer outro; uma resposta de rejeição continua sendo uma recusa. Se não for possível confirmar o resultado, o desfecho é `pendente`, os bytes ficam gravados no `store`, o armazenamento de transmissões, e a [retomada](retomada.md) tenta resolver depois, com os mesmos bytes.

Retome dentro das 168 horas, que é o prazo do MOC para a transmissão. A função `prazoContingencia`, exportada por `sinete/mdfe`, calcula o vencimento a partir de um `Date` com o instante de emissão. Use a data e hora do campo `dhEmi` do XML gravado. Não use `gravado.assinadoEm` para esse cálculo: apesar do nome, esse campo registra o instante da gravação pelo relógio do banco, que pode diferir da emissão.

## Contingência automática

Com `contingencia: { automatica: true }`, o emissor de NF-e e NFC-e decide sozinho quando entrar e sair de contingência, conforme a decisão de arquitetura ADR 0013. Essa opção vem desligada por padrão: mudar o tipo de emissão muda o documento fiscal, e quem a habilita precisa estar preparado para notas com `tpEmis` 6, 7 ou 9.

```ts
import { createNfeEmissor } from 'sinete/emissor/nfe';

const nfe = await createNfeEmissor({
  pfx,
  senha,
  ambiente: 'producao',
  store,
  aoDecidir,
  contingencia: { automatica: true }, // limiteFalhas 3, janelaMs 5 min, sondaMs 5 min
  aoMudarContingencia: (m) => {
    const onde = `${m.escopo.uf} modelo ${m.escopo.modelo}`;
    if (m.tipo === 'entrou') alertar(`${onde} em contingência: ${m.motivo}`);
    else if (m.tipo === 'saiu') alertar(`${onde} de volta à emissão normal: ${m.motivo}`);
    else alertar(`${onde} sem autorizador e sem SVC, notas pendentes: ${m.motivo}`);
  },
});
```

- **Quando entra, na NF-e.** Depois de `limiteFalhas` falhas do autorizador normal em `janelaMs`, o emissor consulta o status na SVC da UF. Contam os desfechos pendentes por falta de resposta e as respostas 108 e 109 de serviço paralisado, inclusive na consulta que tenta resolver um envio sem resposta (MOC 7.0, tabela 4.4.1). A SVC só atende depois que a SEFAZ de origem a ativa (NT 2013.007 v1.03, itens 03 e 04.7): só com 107 o emissor entra em contingência. Com 114 (desabilitada), 113 (em desativação), outro código ou sem resposta, não entra. A nota que provocou a consulta mantém o desfecho do envio normal: pode ficar pendente por falta de resposta ou ser recusada com 108 ou 109. O callback `aoMudarContingencia` recebe `svc-indisponivel`, com um motivo que distingue SVC não ativada, em desativação ou indisponível e inclui o detalhe da consulta. A consulta só pode ser repetida após `sondaMs`; com o estado compartilhado no store, esse intervalo vale para todas as réplicas.
- **Quando entra, na NFC-e.** A NFC-e não tem SVC, e a contingência off-line não depende de ativação: é decisão do emitente (Ajuste SINIEF 19/16, cláusula décima primeira). Depois das mesmas falhas, o emissor consulta o status do autorizador normal da NFC-e. Com 107, não entra, pois a consulta indica que o serviço está em operação. Sem resposta ou com qualquer código diferente de 107, inclusive 108 e 109, entra.
- **Escopo.** A contingência vale para uma combinação de tipo de documento, modelo e UF (`escopo`), no ambiente do emissor. NF-e, modelo 55, e NFC-e, modelo 65, têm estados separados; não se trata do estado de uma nota individual.
- **O que muda.** A mudança só vale na montagem de notas novas. A NF-e sai com o `tpEmis` da SVC da UF (6 na SVC-AN, 7 na SVC-RS; MOC 7.0 Anexo I, B22-60) e é enviada a ela. A NFC-e sai off-line (`tpEmis` 9) e é gravada **sem envio**, com `pendente` e `motivo: 'contingencia'`, para o caixa não esperar o tempo limite de resposta. O DANFC-e, o documento auxiliar da NFC-e, é gerado a partir dos bytes gravados. `dhCont` recebe o instante de entrada em contingência, limitado à data e hora de emissão da nota. `xJust` vem da opção de mesmo nome, com 15 a 256 caracteres (MOC 7.0 Anexo I, B29); o padrão é `SEFAZ autorizadora sem resposta: contingencia automatica`. A entrada que já traz `contingencia` não é alterada pela contingência automática.
- **O que nunca muda.** A nota com bytes gravados em emissão normal, pendente porque a UF não respondeu, é retomada com os mesmos bytes, pela consulta da chave no autorizador normal, mesmo com a contingência ativa. O número transmitido em emissão normal não pode ser reutilizado em contingência (Ajuste SINIEF 07/05, cláusula décima primeira, § 14; para a NFC-e, Ajuste SINIEF 19/16, cláusula décima primeira, § 2º; NT 2013.007, item 05.1). O autorizador normal pode ter autorizado a nota.
- **Quando volta.** Após cada intervalo de `sondaMs`, uma emissão nova ou a retomada de uma NFC-e off-line pode provocar uma consulta ao autorizador normal. Com 107, a contingência acaba. Não há uma consulta periódica independente dessas chamadas. Na NF-e, se o autorizador normal não está em operação, a mesma verificação consulta a SVC: 114 encerra a contingência imediatamente; 113 registra a data e hora de desativação informadas em `xMotivo`. A partir desse instante, a nota nova volta à emissão normal sem esperar outra consulta. Sem data e hora legíveis, ou com o instante já passado, a contingência acaba imediatamente. Se uma consulta posterior retorna 107 na SVC antes do encerramento, o horário de desativação registrado é apagado. A nota enviada à SVC que recebe 114 é recusada, sua gravação é descartada e a contingência acaba imediatamente. Outra falha de envio à SVC, por falta de resposta ou pelos códigos 108 e 109, provoca uma verificação imediata. Quando a contingência acaba, `aoMudarContingencia` recebe `saiu` com o motivo.
- **Entre processos.** Com os métodos de contingência no store ([store SQL](store-sql.md#contingência-automática-entre-processos-opcional)), as réplicas somam as falhas, veem o mesmo estado de contingência e compartilham o intervalo entre consultas à SVC. Só a réplica que efetiva a mudança de estado ou reserva a consulta emite o aviso correspondente. Sem esses métodos, o estado fica na memória de cada emissor.
- **NFC-e off-line depois da volta.** Com a contingência automática habilitada, a retomada (`retomar`, `retomarPendentes`) não envia a NFC-e off-line enquanto a contingência do escopo estiver ativa. O adiamento não conta como tentativa na retomada automática. Depois da volta, a nota é transmitida. O prazo é "até o primeiro dia útil subsequente contado a partir de sua emissão" (Ajuste SINIEF 19/16, cláusula décima primeira, § 1º, II, a); depois de 24 horas, a autorização recebe o código 150, "autorização fora de prazo" (MOC 7.0 Anexo I, B09-40). Execute o job de retomada com frequência.

## Armadilhas

- **Trocar para SVC um documento pendente.** O pendente é resolvido pela consulta da chave original, nunca reassinado, também na contingência automática.
- **Nota presa na SVC.** A NF-e assinada para a SVC que ficou sem resposta continua pendente com esses bytes. A retomada a procura na SVC pela chave: se estiver autorizada, o documento é guardado; se não constar, os mesmos bytes são reenviados. Se esse reenvio receber 114 porque a SVC já foi desligada, a gravação é descartada, permitindo uma nova emissão normal com o número. O emissor nunca remonta a nota para o autorizador normal por conta própria, pois isso criaria outro documento com o mesmo número. Enquanto as consultas e os reenvios não produzirem um resultado conclusivo, a nota continua pendente, e a retomada automática alerta depois das tentativas previstas na política.
- **SVC não ativada.** Com o autorizador normal indisponível e a SVC sem ativação, não há onde autorizar a NF-e. As emissões continuam no ambiente normal: podem ficar pendentes por falta de resposta ou ser recusadas por serviço paralisado. O aviso `svc-indisponivel` pode se repetir nas novas consultas à SVC, provocadas por falhas após o intervalo de `sondaMs`. A ativação depende da SEFAZ da UF; para a NFC-e, a contingência off-line continua disponível. Não trate toda rejeição como indisponibilidade: corrigir uma nota recusada continua sendo necessário. Com a barreira de recusa repetida habilitada e os métodos correspondentes no store, três recusas definitivas iguais em uma hora barram, por padrão, a próxima emissão da mesma `ref` com o mesmo conteúdo, com `recusa_repetida`. Isso ajuda a evitar consumo indevido, código 656. As recusas transitórias 108, 109 e 114 não entram nessa contagem.
- **Prazo da contingência off-line.** A retomada automática seleciona gravações de até `idadeMaximaMs` (3 dias por padrão); o prazo do MDF-e off-line é de 168 horas (7 dias), contado da emissão. Se a SEFAZ ficar indisponível por mais de 3 dias, retome manualmente ou aumente a idade máxima para os MDF-e, respeitando o prazo de transmissão.
- **Relógio.** A data de emissão vem do relógio de emissão configurado na montagem ou no emissor. Na contingência automática, `dhCont` vem do instante registrado no estado de contingência, pelo relógio do banco quando o store o compartilha, e é limitado à data de emissão. Na contingência manual, `dhCont` vem da entrada. Com o relógio da máquina errado, a SEFAZ pode recusar a NF-e por emissão no futuro (703). Confira com `sinete doctor`.

## Veja também

- [Retomada](retomada.md).
- [MDF-e com encerramento](mdfe.md).
- [NFC-e, com a contingência off-line](nfce.md).
- [Por que o autorizador sai da chave](../explicacao/autorizador-pela-chave.md).
