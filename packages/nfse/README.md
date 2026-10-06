# @sinete/nfse

NFS-e Nacional (leiaute 1.01): DPS tipada, montagem com validação no XSD vigente, assinatura por splice, emissão síncrona na Sefin Nacional, substituição, consultas, eventos e parâmetros municipais com cache. As NFS-e municipais de leiaute próprio (ABRASF e afins) ficam fora deste pacote e entram sob demanda.

Para emitir, substituir, retomar e cancelar com estado entre chamadas (DPS assinada gravada antes do envio, trava entre processos, retomada automática), use o emissor da NFS-e do [`@sinete/emissor`](../emissor) (`@sinete/emissor/nfse`, ou `sinete/emissor/nfse` pelo guarda-chuva). Este pacote é o protocolo e as primitivas sem estado que ele usa (ADR 0010):

```ts
import { criarEmissorNfse } from '@sinete/emissor/nfse';

const emissor = await criarEmissorNfse({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const desfecho = await emissor.emitir('servico-9', dps);
```

Status: pré-alfa, API instável até a 1.0. Na produção restrita da Sefin real, em 28/09/2026, o sinete gerou uma NFS-e e a cancelou (e101101 registrado), e as consultas por chave, por Id da DPS e de eventos responderam no formato da tabela abaixo (ADR 0004, rodada 4). O DANFSe do ADN respondeu 404 para essa NFS-e: a API de geração foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026, 1). Antes disso, o spike do ADR 0004 tinha visto a E1229 (DPS sem a declaração XML), a E0312 e os GETs de parametrização. O resto foi testado com respostas sintéticas e de ponta a ponta contra a NFS-e simulada do `@sinete/sefaz-sim` (abaixo).

## API completa

```ts
import { relogioDoSistema, contextoDeTempo } from '@sinete/core';
import { montarDps, criarClienteNfse, assinarDps } from '@sinete/nfse';

const r = await montarDps(dps, { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: relogioDoSistema }) });
if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
const assinada = await assinarDps(r.valor, signer); // grave esta string antes de enviar
const client = criarClienteNfse({ transporte: transport, ambiente: 'homologacao', relogio: relogioDoSistema, assinador: signer });
const desfecho = await client.autorizar(assinada);
if (desfecho.tipo === 'autorizado') guardar(desfecho.valor.chaveAcesso, desfecho.valor.xml);
else console.log(desfecho.erros); // [{ codigo: 'E0312', descricao, complemento? }], com o catálogo do Anexo I
```

## Montagem (`montarDps`)

A entrada (`DadosDps`) usa nomes em português nos grupos (`prestador`, `tomador`, `intermediario`, `servico`, `valores`, `tributacao`, `ibsCbs`, `substituicao`) e os nomes do leiaute nos campos. Grupos raros (obra, evento, exportação, dedução, benefício municipal, tributação federal) vão como o tipo do `@sinete/schemas`, repassados.

- **Leiaute por vigência.** O relógio de emissão e o ambiente escolhem o pacote de schemas (`nfse/1.01-20260209` ou `nfse/1.01-20260727`, tabela de vigências do `@sinete/schemas`). O pacote de 27/07/2026 traz o CNPJ alfanumérico e o grupo IBS/CBS da NT 004.
- **Id da DPS.** `DPS` + município emissor (7) + tipo de inscrição (1) + CNPJ ou CPF com zeros (14) + série (5) + número (15), montado pelos campos (`idDps`).
- **cTribNac.** Aceita `01.01.01` ou `010101` e grava os 6 dígitos da DPS. A parametrização do ADN usa o código de 9 dígitos com pontos (`01.01.01.000`, `codigoServicoParametrizacao`); sem pontos, o ADN responde 400.
- **Valores.** Texto com até 2 casas (`'1500.00'`), `number`, `bigint` ou `Decimal`; o que tem mais casas vira ocorrência `valor_casas`, nunca arredondamento silencioso.
- **IBS e CBS (NT SE/CGNFS-e 004).** A DPS leva só a classificação (`ibsCbs`: cIndOp, indDest, CST, cClassTrib, crédito presumido, tributação regular, diferimento). Os valores (base, alíquotas, IBS UF, IBS municipal, CBS) são calculados pela Sefin e vêm na NFS-e; o pacote não calcula nada disso.
- **Total aproximado dos tributos.** O Anexo I amarra o grupo `totTrib` ao regime do prestador no Simples Nacional: `indTotTrib` só no MEI (E0712 no ME/EPP, E0713 no não optante) e `pTotTribSN` nunca no MEI (E0710) nem no não optante. Sem o grupo, o MEI recebe `indTotTrib` 0; os outros regimes precisam informar `vTotTrib`, `pTotTrib` ou, no ME/EPP, `pTotTribSN`, e a combinação proibida vira ocorrência `campo_proibido` antes do envio. Com tomador ou intermediário emitindo, o regime dele não vem na DPS: o grupo é obrigatório e não é conferido localmente.
- **Declaração UTF-8.** O XML devolvido começa com `<?xml version="1.0" encoding="UTF-8"?>` (`DECLARACAO_XML`). Sem ela, a Sefin recusa com E1229 antes do schema, como o spike provou. A declaração fica fora do elemento assinado, então `assinarDps` assina a string como está.
- **Validação estrita.** O XML é validado contra o schema vigente antes de devolver; problemas voltam como `Ocorrencia` (`caminho`, `code`, `mensagem`, `origem`: `entrada` na conferência da `DadosDps`, `montagem` no schema do XML), nunca como exceção; `rotuloDoCaminho(path)` dá o caminho em português para a tela (`Tomador, CNPJ`), nos dois formatos de caminho ([ADR 0011](../../docs/adr/0011-origem-e-rotulo-das-ocorrencias.md)). Competência depois da emissão (E0015) é conferida localmente.
- **`verAplic`.** Padrão `sinete <versão do @sinete/nfse>` (`formatarVerProc` do `@sinete/core`, cortado com segurança em 20 caracteres); `opcoes.verAplic` sobrepõe (na DPS e nos pedidos de evento).

`assinarDps` insere a `Signature` como último filho de `DPS` por splice, com referência ao `infDPS`. A string devolvida é a que vai para a Sefin e para o banco.

## Serviços (`criarClienteNfse`)

REST com JSON sobre qualquer `Transporte` do `@sinete/transport`; as bases (Sefin, ADN, parametrização) vêm do `nfseEndpoint` dos dados de endpoints. Os documentos viajam em gzip e base64 (`comprimirGzipBase64` e `descomprimirGzipBase64`, com `CompressionStream` da plataforma).

| Operação | Caminho | Origem |
|---|---|---|
| `autorizar` | `POST {sefin}/nfse` | observado na Sefin real em 28/09/2026 (NFS-e gerada; antes, E1229 e E0312 no spike) |
| `substituir` | `POST {sefin}/nfse` | Swagger da Sefin (mesmo caminho do `autorizar`; substituição não sondada) |
| `consultar` | `GET {sefin}/nfse/{chave}` | observado na Sefin real em 28/09/2026 |
| `consultarDps` | `GET {sefin}/dps/{id}` | observado na Sefin real em 28/09/2026 |
| `cancelar`, `registrarEvento` | `POST {sefin}/nfse/{chave}/eventos` | observado na Sefin real em 28/09/2026 (e101101 registrado) |
| `solicitarAnaliseFiscal` | `POST {sefin}/nfse/{chave}/eventos` | Swagger da Sefin (mesmo caminho do `cancelar`) |
| `consultarEventos` | `GET {sefin}/nfse/{chave}/eventos/{tipo}/{seq}` | observado na Sefin real em 28/09/2026: 405 sem o tipo, 404 sem a sequência |
| `parametros.convenio` | `GET {parametrizacao}/{cMun}/convenio` | observado no spike |
| `parametros.aliquota`, `historicoAliquotas` | `.../{cMun}/{codigo}/{AAAA-MM-DD}/aliquota`, `.../{cMun}/{codigo}/historicoaliquotas` | observado no spike |
| `parametros.regimesEspeciais`, `retencoes`, `beneficio` | `.../regimes_especiais`, `.../retencoes`, `.../beneficio` | Swagger do ADN, formato da resposta não observado (devolve o JSON cru) |

- **Rejeição é desfecho.** HTTP 400 com `{"erros":[{"Codigo","Descricao","Complemento"}]}` (grafia observada; o cliente também lê camelCase, `erro` e objeto único) vira `RejeicaoNfse`: `tipo: 'recusado'`, `cStat` com o primeiro código (`E0312`), `erros` com todos e `dica` do catálogo do `@sinete/rejeicoes/nfse` (496 códigos do Anexo I e do Anexo II, com a planilha de origem). Resposta fora do contrato (5xx, JSON inválido, NFS-e sem chave, NFS-e de outra DPS) é `ErroRespostaInvalida`.
- **Conferências antes do envio.** A DPS precisa ter a declaração XML, ser uma `DPS` do namespace da NFS-e e ter o `tpAmb` do cliente; o pedido de evento, o mesmo. O `tpAmb` é conferido aqui porque a política de hosts do transporte não enxerga dentro do JSON com gzip.
- **Conferências na resposta.** A NFS-e devolvida precisa trazer a DPS enviada (mesmo Id) e a chave informada; na consulta, a chave pedida. O XML é devolvido como string recebida, nunca reserializado, com uma leitura tolerante ao lado.
- **Substituição.** `substituir` envia a DPS com o grupo `subst`; a Sefin gera a nova NFS-e e registra sozinha o e105102 na substituída. O cliente não monta o e105102.
- **Consulta de eventos.** `consultarEventos(chave, { tpEvento, nSeqEvento })` exige os dois: a Sefin real responde 405 a `GET .../eventos` e 404 (página HTML do IIS) a `GET .../eventos/{tipo}`, e só o caminho com a sequência devolve o evento. O cancelamento (e101101) é sempre a sequência 1. A resposta é `{"eventos":[{"chaveAcesso","tipoEvento","numeroPedidoRegistroEvento","dataHoraRecebimento","arquivoXml"}]}`, e `arquivoXml` é o base64 do texto do gzip em base64 (começa com `SDRzSUFBQUFB`, que decodifica para `H4sIAAAA`); o cliente decodifica as duas camadas e ainda lê os campos `...XmlGZipB64` do Swagger como reserva. Um 404 no caminho completo, com qualquer corpo, vira lista vazia: o corpo do 404 de evento inexistente não foi observado, e ler o 404 como ausência só deixa o cancelamento do emissor `pendente`, nunca o dá por registrado. Evento de outra NFS-e na resposta é `ErroRespostaInvalida`.
- **Evento com resposta perdida.** Depois de um pedido de evento sem resposta, ou recusado com E0840 (algum evento já vinculado à NFS-e), `recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento = 1)` consulta o evento e devolve `{ registrado: true, evento }` ou `{ registrado: false }`; nunca conclua pelo código do pedido, porque a E0840 também sai com a substituição vinculada. Falha de rede e resposta fora do contrato lançam, como no `consultarEventos`, e não viram `registrado: false`. É o mesmo nome e o mesmo uso da NF-e e do MDF-e, e o emissor o usa no cancelamento.
- **Eventos.** `cancelar` (e101101) e `solicitarAnaliseFiscal` (e101103) montam o pedido (`PRE` + chave + tipo), assinam com `opcoes.assinador` e registram. `registrarEvento` aceita um pedido já assinado. Situações de sucesso (`src/data/situacoes.json`): a NFS-e usa o cStat do documento (100 gerada, 102 de decisão judicial, 103 avulsa, 107 MEI); o evento registrado não tem cStat no leiaute, e o sinete usa 100 "Evento registrado" por convenção.
- **Parâmetros municipais com cache.** `client.parametros` (ou `criarParametrosMunicipais`) guarda cada resposta pela URL por 6 horas (`validadeParametrosMs`), um 404 por 30 minutos, e junta consultas simultâneas numa só. O cache em memória (`cacheEmMemoria`, 500 entradas) é trocável por qualquer `CacheParametros` assíncrono (Redis, KV); `cacheParametros: false` desliga. A resposta do convênio é normalizada (inclusive o campo `permiteAproveitametoDeCreditos`, com a grafia do ADN).
- **DANFSe.** A API de geração do DANFSe do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026 v1.02, 1) e responde 404 desde então. O cliente não tem mais o `obterDanfse`: o DANFSe v2 sai do XML da NFS-e pelo `danfse` de `@sinete/da/nfse`, e o emissor de NFS-e (`@sinete/emissor/nfse`) o gera com `pdf`, `pdfCancelado` e `pdfPorChave`.

### Envio sem resposta

Grave a DPS assinada antes de enviar e nunca monte outra DPS para o mesmo número depois de um envio sem resposta. `resolverEnvioSemResposta(client, assinada, desfecho?, { signal }?)` consulta a DPS pelo Id e devolve `acao`, na mesma forma do resolvedor da NF-e e do MDF-e: `concluida` traz a NFS-e consultada e o `resultado` que a emissão teria devolvido, `reenviar` diz que a DPS não gerou NFS-e e os mesmos bytes (`dpsAssinada`) podem ir de novo (a Sefin recusa a duplicada com E0014), `divergente` diz que a NFS-e do Id é de outra DPS (o DigestValue da DPS embutida nela não é o dos bytes gravados; sem a assinatura na NFS-e devolvida, vale o Id), e `indefinida` diz que a consulta respondeu sem decidir: a DPS consta como processada, mas a NFS-e da chave não é encontrada ou é de outra DPS, ou o envio voltou E0014 (`desfecho`) e a consulta não acha a DPS. Com `indefinida`, tente mais tarde, sem reenviar nem descartar; `motivo` diz o que a consulta mostrou. Até a 0.2, esses casos lançavam `ErroRespostaInvalida`.

`client.opcoes` são as opções da criação, como `ClienteNfe.opcoes` e `ClienteMdfe.opcoes`; `client.ambiente` continua, igual a `opcoes.ambiente`.

### mTLS com o certificado do emitente

A Sefin autoriza pelo certificado do canal TLS e exige a DPS assinada pelo emitente (E0718 com outro titular). Sem procuração nem transmissor terceiro, o canal de outro contribuinte recebe 403 (registrado na pesquisa de certificados, sem código no Anexo I), e o simulador faz o mesmo. O sinete não usa transmissor terceiro na NFS-e: o `Transporte` precisa apresentar o mesmo e-CNPJ ou e-CPF que assina a DPS e os pedidos de evento. A Sefin é IIS com renegociação TLS 1.2 (ADR 0004), então o Deno não chega nela; Node e Bun chegam.

## Chave de acesso

50 posições: município emissor (7), ambiente gerador (1), tipo de inscrição (1), inscrição federal (14), número da NFS-e (13), ano e mês (4), código numérico (9) e DV (1). `lerChaveNfse` confere só a estrutura: o Anexo I não publica o algoritmo do DV, então o cliente não o confere (o simulador usa módulo 11 como a NF-e). O XSD oficial de 27/07/2026 declara `TSChaveNFSe` como `[0-9]{6}([0-9A-Z]{14})[0-9]{30}`: o trecho alfanumérico começa na posição 7, e não na 10, onde está a inscrição. Com CNPJ alfanumérico, uma chave correta pode ser recusada pelo XSD. O achado está registrado e não foi corrigido no codegen, porque o erro está no documento oficial e corrigir mudaria o que o schema aceita.

## Ponta a ponta contra a NFS-e simulada

`test/e2e.test.ts` sobe o `@sinete/sefaz-sim` com a NFS-e simulada em HTTPS com mTLS (AC, certificado do prestador e do servidor gerados na hora) e usa o `criarTransporte` real; o `redirecionarNfseParaSim` troca só a base de cada API. Cobre emissão, IBS/CBS, rejeição municipal (E0312) com o catálogo, substituição com o e105102 registrado pela Sefin, cancelamento e o repetido (E0840), consulta de eventos no formato da Sefin real, análise fiscal, consultas, parametrização com cache, envio sem resposta, certificado do canal recusado e DPS sem a declaração. Roda no `bun run check`.

## Lacunas conhecidas

- Emissão por tomador ou intermediário (`tpEmit` 2 e 3) está no modelo, mas não foi testada contra a Sefin real.
- Eventos de manifestação, bloqueio e ofício (tipos 2xx e 3xx do Anexo II) não têm montagem; `registrarEvento` aceita o pedido pronto.
- NFS-e municipais de leiaute próprio e a API de distribuição do ADN (`/contribuintes/DFe/{NSU}`) ficam para outra versão.
