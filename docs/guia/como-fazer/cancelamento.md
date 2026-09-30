# Como cancelar NF-e, MDF-e e NFS-e

Cancele pelo emissor do documento (`sinete/emissor/nfe`, `sinete/emissor/mdfe` ou `sinete/emissor/nfse`). O método `cancelar` devolve `registrado` quando a resposta confirma o registro do evento. Se o pedido ficar sem resposta ou receber um dos códigos descritos abaixo, o emissor tenta recuperar o evento por consulta: na SEFAZ (Secretaria da Fazenda), para NF-e e MDF-e, ou na Sefin Nacional (serviço autorizador da NFS-e). Nessa recuperação, só devolve `registrado` quando encontra o evento de cancelamento. O cliente de baixo nível (`createNfeClient().cancelar`) envia o pedido e interpreta a resposta, mas não faz essa recuperação; se você o usar diretamente, ela fica por sua conta.

Nos desfechos, `cStat` é o código de situação ou rejeição retornado pelo serviço, e `xMotivo` é a descrição correspondente.

## NF-e

```ts
import { createNfeEmissor } from 'sinete/emissor/nfe';

const nfe = await createNfeEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const d = await nfe.cancelar({ chave, xJust: 'Pedido cancelado pelo cliente antes do envio' });
switch (d.tipo) {
  case 'registrado':
    await guardarEvento(chave, d.procEvento); // procEventoNFe: o evento assinado com o retorno
    await guardarPdf(chave, await nfe.pdfCancelado(nfeProc, d.procEvento));
    break;
  case 'recusado':
    console.log(d.cStat, d.xMotivo, d.hint?.comoCorrigir);
    break;
  case 'pendente':
    break; // sem decisão: chame cancelar de novo mais tarde, com os mesmos dados
}
```

- **`nProt` opcional.** Sem ele, o emissor consulta a chave e obtém o protocolo de autorização na consulta. Se encontrar o evento de cancelamento já registrado, como em um pedido anterior cuja resposta se perdeu, devolve esse evento com `recuperado: true`, sem enviar outro pedido. Se a consulta indicar cancelamento, mas não trouxer um evento legível, o resultado fica `pendente`.
- **Sem resposta, 573 ou 580.** O pedido que não teve resposta, ou que voltou com 573 (duplicidade de evento) ou 580 (o evento exige uma NF-e autorizada, resposta que também pode ocorrer para uma nota já cancelada), pode ter sido registrado. Nesses casos, o emissor consulta a chave e só devolve `registrado`, com `recuperado: true`, se encontrar o evento de cancelamento correspondente. Os códigos são do Manual de Orientação do Contribuinte (MOC) 7.0, Anexo I. Nenhum dos dois comprova sozinho o cancelamento: 573 indica duplicidade, e 580 indica que a situação da nota não atende à exigência do evento.
- **Justificativa.** O campo `xJust` deve ter de 15 a 255 caracteres, conforme o tipo `TJust` do schema XML do evento, no Pacote de Liberação (PL) PL_010d. Ao montar um novo pedido, o cliente rejeita uma justificativa fora desses limites com `ValidationError`, antes do envio.
- **Autorizador.** O pedido vai ao autorizador identificado pela chave. A nota autorizada em contingência pela SVC (SEFAZ Virtual de Contingência), com `tpEmis` (tipo de emissão) 6 ou 7, é cancelada na SVC que a autorizou, mesmo que o serviço do estado já tenha voltado ao normal (Nota Técnica 2013.007).
- **Prazo.** A rejeição 501 indica que o prazo de cancelamento previsto na legislação foi ultrapassado (MOC 7.0, Anexo I). Se a SEFAZ devolver esse código, o desfecho será `recusado`; o sinete não confere o prazo antes do envio.

`pdfCancelado(nfeProc, procEventoNFe)` gera o DANFE (Documento Auxiliar da NF-e) com a marca "CANCELADA" e o protocolo do evento. Se o evento for de outra nota, o método lança um erro, e você decide se mantém o PDF antigo. A aplicação é responsável por guardar o PDF e o evento.

## MDF-e

```ts
import { createMdfeEmissor } from 'sinete/emissor/mdfe';

const mdfe = await createMdfeEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const d = await mdfe.cancelar({ chave, xJust: 'Viagem cancelada antes da saida' });
if (d.tipo === 'registrado') await guardarEvento(chave, d.procEvento); // procEventoMDFe
```

O cancelamento do MDF-e (Manifesto Eletrônico de Documentos Fiscais) segue o mesmo fluxo de recuperação da NF-e, mas o código de duplicidade que aciona a consulta é 631, em vez de 573 ou 580. O prazo geral é de 24 horas depois da autorização (MOC MDF-e 3.00b, regra K04, rejeição 220). A regra prevê exceção para MDF-e com carregamento posterior sem evento de inclusão de documentos fiscais eletrônicos. O MDF-e de uma viagem realizada deve ser encerrado; ultrapassar o prazo não transforma o encerramento em alternativa para cancelar uma viagem que não ocorreu. Veja [MDF-e com encerramento](mdfe.md).

## NFS-e Nacional

A NFS-e (Nota Fiscal de Serviço Eletrônica) Nacional usa a Sefin Nacional para registrar e consultar o cancelamento.

```ts
import { createNfseEmissor } from 'sinete/emissor/nfse';

const nfse = await createNfseEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const d = await nfse.cancelar({ chave, cMotivo: '1', xMotivo: 'Erro na emissao do valor do servico' });
if (d.tipo === 'recusado') console.log(d.cStat, d.xMotivo); // código E da Sefin, por exemplo E0822
```

- `cMotivo` é o código de justificativa do evento de cancelamento, representado pelo grupo XML `e101101` (`TSCodJustCanc` do schema: `1` erro na emissão, `2` serviço não prestado, `9` outros). O campo `xMotivo` descreve a justificativa e deve ter de 15 a 255 caracteres. O autor, se não for informado, é o titular do certificado.
- **Sem resposta ou E0840.** O pedido que não teve resposta, ou que voltou com E0840 (evento já vinculado à NFS-e que impede o cancelamento, Anexo II da NFS-e Nacional v1.01, aba RN EVENTO_PED.REG.EVENTO), pode ter sido registrado. Isso pode acontecer quando a resposta do primeiro pedido se perde e você tenta de novo. O emissor consulta o evento de cancelamento na Sefin, com tipo 101101 e sequência 1. Se o encontrar para a mesma chave, devolve `registrado` com `recuperado: true` e o XML do evento registrado em `procEvento` e `evento.xml`. Quando a consulta foi motivada por E0840, `bruto` traz essa rejeição. Se a consulta terminar sem encontrar o evento, o pedido sem resposta fica `pendente`, e a E0840 fica `recusado`. A E0840 pode se referir, por exemplo, ao cancelamento por substituição (`e105102`) de uma NFS-e substituída. Se a própria consulta ficar sem resposta, o resultado será `pendente`, inclusive após E0840.
- A Sefin recusa o cancelamento fora do prazo configurado pelo município com E0822 (Anexo II da NFS-e Nacional, v1.01). Fora do prazo, o caminho é a solicitação de análise fiscal (`e101103`), pelo método `nfse.cliente.solicitarAnaliseFiscal`. Essa solicitação pede uma análise; seu registro não confirma o cancelamento.
- Para trocar uma NFS-e por outra, por exemplo por valor ou tomador incorreto, use a substituição (`nfse.substituir`). Quando a emissão substituta é autorizada, a Sefin gera a nova nota e cancela a anterior na mesma operação. Veja [NFS-e](nfse.md).

Com o desfecho `registrado`, `nfse.pdfCancelado(xmlNfse, d.procEvento)` gera localmente o DANFSe v2 (Documento Auxiliar da NFS-e), por meio de `@sinete/da/nfse`, com a marca "CANCELADA". O primeiro argumento é o XML da NFS-e, e o segundo é o XML do evento registrado. Para um evento de cancelamento por substituição (`e105102`), a marca é "SUBSTITUÍDA". Um evento de outra nota ou de tipo incompatível causa erro `evento_incompativel`. A aplicação é responsável por guardar o PDF e o evento.

## Armadilhas

- **Concluir pelo `cStat`.** Tratar 573, 580, 631 ou E0840 como confirmação de cancelamento pode marcar como cancelado um documento sem que o evento correspondente tenha sido confirmado. Use o desfecho do emissor.
- **Pedido pendente descartado.** `pendente` significa que ainda não foi possível confirmar o resultado: chame `cancelar` de novo mais tarde, com os mesmos dados. Para NF-e e MDF-e, o emissor consulta antes do envio quando `nProt` não foi informado. Para NFS-e, a recuperação ocorre depois de um pedido sem resposta ou de E0840. Uma nova tentativa pode reenviar o pedido; use o desfecho para saber se o evento foi registrado ou recuperado.
- **Guardar só o PDF.** O XML do evento registrado é devolvido em `procEvento`: `procEventoNFe` para NF-e, `procEventoMDFe` para MDF-e e o XML do evento para NFS-e. Guarde-o junto do `proc`, o XML do documento autorizado.

## Veja também

- [Carta de correção](carta-de-correcao.md).
- [Documentos auxiliares](documentos-auxiliares.md).
- Referência: [`@sinete/emissor`](../referencia/emissor.md).
