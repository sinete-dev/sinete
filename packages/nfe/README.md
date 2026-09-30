# @sinete/nfe

NF-e modelo 55 e NFC-e modelo 65: modelo de entrada tipado, montagem com totais em decimal exato e validação estrita antes de assinar, QR Code da NFC-e, assinatura por splice e os serviços da SEFAZ (autorização síncrona e assíncrona, consultas, eventos, inutilização, cadastro, contingência SVC e Distribuição DF-e).

Para emitir, retomar e cancelar com estado entre chamadas (bytes assinados gravados antes do envio, trava entre processos, retomada automática, cancelamento com recuperação, pool por certificado), use o emissor de NF-e do [`@sinete/emissor`](../emissor) (`@sinete/emissor/nfe`, ou `sinete/emissor/nfe` pelo guarda-chuva). Este pacote é o protocolo e as primitivas sem estado que ele usa (ADR 0010):

```ts
import { createNfeEmissor } from '@sinete/emissor/nfe';

const nfe = await createNfeEmissor({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const desfecho = await nfe.emitir('pedido-42', nota);
```

Status: pré-alfa, API instável até a 1.0. Contra a SEFAZ real, só em homologação: com um e-CNPJ do Simples sem IE, `statusServico` em todos os autorizadores e SVC, `consultarCadastro`, `distribuicaoDFe` e uma `autorizar` que parou na regra de negócio (166); com o e-CPF de um produtor rural do DF com IE, seis NF-e autorizadas na SVRS (cStat 100, CST 00, 20, 30, 40 e 70 com desoneração, IBS/CBS pela calculadora padrão, uma delas por transmissor terceiro), `consultar` (então `consultarProtocolo`), CC-e com sequência e cancelamento; veja [docs/validacao-homologacao.md](../../docs/validacao-homologacao.md). Inutilização e recibo assíncrono ainda não. O `@sinete/emissor` usa esses mesmos serviços e foi testado só contra o simulador. No mais, os serviços foram testados com respostas SOAP sintéticas e de ponta a ponta contra o `@sinete/sefaz-sim` (abaixo), e o builder, com notas sintéticas e com uma checagem local contra um corpus de notas autorizadas.

## API completa

```ts
import { relogioDoSistema, contextoDeTempo } from '@sinete/core';
import { buildNfe, createNfeClient, signNfe } from '@sinete/nfe';

const r = await buildNfe(nota, { ambiente: 'homologacao', time: contextoDeTempo({ emissao: relogioDoSistema }) });
if (!r.ok) throw new Error(r.issues.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
const assinada = await signNfe(r.value, signer); // grave esta string antes de enviar
const client = createNfeClient({ transport, signer, ambiente: 'homologacao', uf: 'SP', clock: relogioDoSistema });
const desfecho = await client.autorizar(assinada);
if (desfecho.tipo === 'autorizado') guardar(desfecho.valor.nfeProc);
```

## Montagem (`buildNfe`)

A entrada (`NfeInput`) usa os nomes do MOC nos campos e nomes em português nos grupos (`emitente`, `destinatario`, `itens`, `impostos.icms`, `transporte`, `cobranca`, `pagamento`). Valores aceitam `string`, `number`, `bigint` ou `Decimal`; prefira texto (`'12.34'`). Grupos raros (DI, rastro, veículo, medicamento, combustível, exportação, cana, agropecuário) vão como o tipo do `@sinete/schemas`, repassados.

- **PL por vigência.** O relógio de emissão e o ambiente escolhem o PL (`selecionarPl` do schemas). O objeto é montado na forma do PL mais novo e serializado com o descritor do vigente; campo que o PL vigente não conhece vira `campo_fora_do_pl` em vez de sumir.
- **Derivados.** Cada valor que tem conta no MOC é calculado quando falta (vProd, vICMS, FCP, ST por MVA com IPI na base, diferimento, crédito do Simples, IPI, PIS, COFINS, ISSQN, retenção do transporte, vLiq) e, quando vem, conferido contra a conta com a tolerância de R$ 0,01 da nota (*4) do Anexo I (`valor_divergente`). Na complementar e na de ajuste (finNFe 2 e 3) nada é conferido, e o vProd só é conferido na normal (RV I11).
- **Bases.** Base de cálculo informada prevalece sem conferência; o padrão (valor da operação, reduzido por pRedBC) só vale quando ela falta. A base legal varia por UF e operação: na checagem do corpus, 4.474 bases de IPI e 157 de ICMS autorizadas eram diferentes do valor da operação.
- **Arredondamento.** Por família de campo, como dado (`src/data/arredondamento.json`): HALF_UP nos tributos atuais, HALF_EVEN no IBS/CBS (Calculadora da RFB). `options.arredondamento` troca o modo de uma família.
- **Totais.** ICMSTot (W16-10 com as exceções do faturamento direto de veículos), ISSQNtot, IBSCBSTot (W35 a W59g, somando os grupos dos itens), vItem e vNFTot (VB01-10; IBS/CBS no vItem só com fato gerador a partir de 2027, `src/data/reforma.json`). O vICMSDeson só sai do vNF com `indDeduzDeson` 1; a exceção 3 da W16-10 aceita as duas formas, e notas antigas costumam deduzir sem o indicador.
- **Pagamento igual ao total.** Com `options.pagamentoIgualTotal`, o `vPag` do único `detPag` é o `vNF` calculado na mesma montagem, e o valor informado nele é ignorado; nenhum, mais de um `detPag` ou `tPag` 90 dão `pagamento_igual_total`.
- **Chave e cNF.** cNF aleatório (WebCrypto, injetável em `options.random`) sorteado de novo até passar nas regras de emissão da chave (RV B03-10); cNF informado é conferido. Emitente CPF usa as séries 920 a 969.
- **Regras por UF como dado.** Fuso (`fusos.json`), exigência de responsável técnico e CSRT (`resp-tec.json`, hoje só PR com fonte), vedação da NF de produtor modelo 04 (`produtor-rural.json`). O hashCSRT é Base64(SHA-1(CSRT + chave)) (NT 2018.005); o CSRT nunca vai para o XML.
- **Homologação.** O nome do destinatário vira o literal da RV E04-20.
- **Validação estrita.** O XML canônico é validado contra o schema do PL vigente antes de devolver; qualquer problema volta como lista de `Ocorrencia` (`caminho`, `code`, `mensagem`, `origem`), nunca como exceção. Os códigos estão em `NFE_ISSUE_CODES`. `origem` é `entrada` quando a conferência foi sobre a `NfeInput` (o caminho é dela) e `montagem` quando foi sobre o que o pacote produziu (schema e PL do XML, chave gerada, grupo IBS/CBS da calculadora); `rotuloDoCaminho(path)` dá o caminho em português para a tela (`Item 2, Descrição do produto`), nos dois formatos de caminho. Veja o [ADR 0011](../../docs/adr/0011-origem-e-rotulo-das-ocorrencias.md).
- **`verProc`.** Padrão `sinete <versão do @sinete/nfe>` (`formatarVerProc` do `@sinete/core`, cortado com segurança em 20 caracteres); `options.verProc` sobrepõe.

`signNfe` insere a `Signature` como último filho de `NFe` por splice. A string que ele devolve é a que vai para a SEFAZ e para o banco.

## NFC-e (modelo 65)

`modelo: '65'` na entrada monta a NFC-e com as regras dela, conferidas antes de montar (MOC 7.0 Anexo I, regras de aplicação obrigatória do modelo 65; NT 2023.002 v1.01; NT 2025.001 v1.03; NT 2025.002 v1.51):

- **Padrões.** `indPres` 1, `indFinal` 1, `tpImp` 4 e `idDest` 1. Destinatário opcional, obrigatório na entrega a domicílio (`indPres` 4, com endereço e transportador) e acima de R$ 10.000,00 (W16-40). Em homologação, a descrição do primeiro item vira o literal da RV I04-10 (`XPROD_HOMOLOGACAO_NFCE`).
- **Pagamento obrigatório.** Sem `tPag` 14, 90 e 99; soma dos pagamentos não abaixo do total (salvo `tPag` 91, pagamento posterior, com valor zero); troco calculado quando falta (`vTroco`, YA03-20) e conferido quando vem (YA09-10); cartão e PIX com o grupo `card` (YA04-10).
- **Grupos vedados** (`grupo_vedado`): data de saída, previsão de entrega, notas referenciadas, compra governamental, IE-ST, Suframa, veículo, armamento, RECOPI, IPI, II, PIS-ST, COFINS-ST, ICMS da UF de destino, partilha e repasse do ICMS, devolução de tributos, cobrança, exportação, compra, cana e transporte fora da entrega a domicílio.
- **QR Code** (`infNFeSupl`). Padrão versão 3 (NT 2025.001, Manual de Padrões Técnicos do DANFE NFC-e e QR Code 6.0, item 4.4), sem CSC: `chave|3|tpAmb`. Com `options.qrCode = { versao: '2', idCSC, CSC }`, o hash SHA-1 com o CSC da versão 2 (item 4.3); o CSC nunca vai para o XML, e o emitente pessoa física não usa a versão 2 (ZX02-222). O endereço do QR Code e o `urlChave` saem da UF, do ambiente e da data de emissão (`src/data/nfce-urls.json`, das tabelas do Portal Nacional da NFC-e); `options.urlQrCode` e `options.urlChave` sobrepõem (AM e MA publicam o endereço sem protocolo e pedem a opção).
- **Contingência off-line.** `contingencia: { tpEmis: '9', dhCont, xJust }`. O QR Code leva o dia da emissão, o `vNF` e, na versão 3, a identificação do destinatário e a assinatura RSA-SHA1 dos parâmetros com o certificado da nota; na versão 2, o `digVal` (o DigestValue da assinatura em hexadecimal). A nota é impressa com esse XML e transmitida depois, com os mesmos bytes.

`signNfe` acrescenta o `infNFeSupl` antes da `Signature`. Para assinar em três fases (A3, HSM), `assinaturaQrCode(built, signer)` e `comQrCode(built, assinatura)` dão o texto que vai para o `prepararAssinatura` do `@sinete/core/xml`.

## IBS e CBS

O IBS/CBS é obrigatório na NF-e (CRT 3 rejeitado sem o grupo desde 03/08/2026; Simples e MEI a partir de 04/01/2027), então o cálculo vem no pacote. O item traz a classificação (`ibsCbs.classificacao`: CST, cClassTrib, vBC opcional e, nos cClassTrib que exigem ou permitem, a tributação regular em `gTribRegular: { CSTReg, cClassTribReg }`) e, sem `options.ibsCbs`, o `buildNfe` calcula com o `ibsCbsCalculator()`: o `@sinete/ibs-cbs/calcular` calcula, o `@sinete/ibs-cbs-dados` e o `@sinete/ibs-cbs/aliquotas` dão dados e alíquotas, e o `@sinete/ibs-cbs/validar` confere os grupos produzidos pelas regras da NT 2025.002 antes de a nota ser montada. Item com grupo pronto (`ibsCbs.grupo`) dispensa o cálculo.

```ts
import { buildNfe, ibsCbsCalculator } from '@sinete/nfe';

// Padrão: dataset embarcado, alíquotas oficiais, regras implantadas na data de emissão.
const r = await buildNfe(nota, { ambiente: 'homologacao', time });
// item com impostos.ibsCbs.classificacao = { CST: '000', cClassTrib: '000001', vBC: '1000.00' }

// Com opções: base para item sem vBC, alíquotas informadas, dataset verificado em runtime.
const ibsCbs = ibsCbsCalculator({ base: (item) => item.vProd.minus(item.vDesc).toFixed(2), rates: minhasAliquotas });
const r2 = await buildNfe(nota, { ambiente: 'homologacao', time, ibsCbs });
```

### Custo no bundle

O dataset embarcado tem ~2 MB de JSON e é importado por `import()` dinâmico só na primeira nota com item classificado (`carregarDatasetEmbarcado()` adianta a carga; `ibsCbsCalculator({ dataset })` com um dataset já carregado faz o cálculo síncrono). Bundle de browser minificado (`bun build --target=browser --minify`), medido ao juntar o antigo `@sinete/nfe-rtc` a este pacote:

| Uso | Antes | Depois |
|---|---|---|
| Só leitura de XML (`documentoAssinado`, `sliceElement`, `gunzipBase64`) | 20,0 KiB | 20,0 KiB (20,2 sem code splitting) |
| Serviços (`createNfeClient`: eventos, Distribuição DF-e) | 375,9 KiB | 375,9 KiB (376,1 sem code splitting) |
| Emissão (`buildNfe`, `signNfe`) com IBS/CBS | 2.033,9 KiB num arquivo | com code splitting, 264,3 KiB na carga inicial (75,3 KiB gzip) e 1.770,3 KiB (109,1 KiB gzip) num chunk carregado na primeira nota classificada; sem code splitting, 2.034,3 KiB num arquivo |

O motor, as alíquotas e as regras (~63 KiB minificados) entram estaticamente em quem usa o `buildNfe`; quem não emite não os carrega.

### A porta `IbsCbsCalculator`

`options.ibsCbs` troca a calculadora padrão, para testes com alíquotas fixas ou para quem calcula em outro lugar:

```ts
interface IbsCbsCalculator {
  calcular(request: { nota: IbsCbsNotaRequest; itens: readonly IbsCbsItemRequest[] }): IbsCbsResponse | Promise<IbsCbsResponse>;
}
```

`IbsCbsNotaRequest` leva o instante do fato gerador e o da emissão, ambiente, modelo, tpNF, finNFe, indFinal, indPres, UF, município e CRT do emitente, destino (entrega, depois destinatário), cMunFGIBS e compra governamental. `IbsCbsItemRequest` leva nItem, CST, cClassTrib, NCM, CFOP, unidade e quantidade tributáveis e os valores do item já calculados (vProd, vDesc, vFrete, vSeg, vOutro, vICMS, vICMSST, vFCP, vFCPST, vIPI, vPIS, vCOFINS, vII, vISSQN, e o ICMS e o FCP de partilha para a UF de destino, vICMSUFDest e vFCPUFDest, zero sem o grupo) como `Decimal`, para a função `base` deduzir o que a composição de quem emite pedir; com `gTribRegular` quando a classificação traz. `IbsCbsResponse` é `{ itens: { nItem, IBSCBS }[], issues? }`.

### O que a calculadora padrão decide

- **Base.** O motor recebe a base já apurada, e a composição dela (NT 2025.002, UB16-10) ainda é "implementação futura, aguardando orientação normativa". A calculadora usa o `vBC` da classificação do item ou a função `base` das opções; sem as duas, o item vira ocorrência `ibscbs_base_ausente`, nunca uma base presumida.
- **Local da operação.** `cMunFGIBS` (campo B12a), senão o destino (entrega, depois destinatário; LC 214/2025, art. 11), senão o emitente. Destino no exterior cai no emitente. Exportado como `localDaOperacao`.
- **Datas.** O fato gerador escolhe dados e alíquotas; a emissão escolhe as regras da NT implantadas no ambiente (`IbsCbsNotaRequest.emissao`).
- **Erros como ocorrências.** `ClassificationError`, `UnsupportedRegimeError` e `RateUnknownError` viram `Ocorrencia` no caminho do item (`itens[n].impostos.ibsCbs`), e cada violação das regras do `@sinete/ibs-cbs/validar`, `ibscbs_regra_nt` com a regra, a rejeição e a fonte. O `buildNfe` devolve `{ ok: false, issues }`. Outros erros propagam.
- **Não suportado aqui.** Crédito presumido (`cCredPres`) pede percentuais por tributo que a porta não traz: informe o grupo pronto (`ibsCbs.grupo`). Diferimento e devolução também não têm campo na classificação da porta.

| Opção do `ibsCbsCalculator` | Padrão | |
|---|---|---|
| `dataset` | o embarcado, importado sob demanda | um bundle verificado em runtime (`verifyDataset`), ou `bundledDataset()` já carregado |
| `rates` | `officialRates()` | um provedor com alíquotas informadas |
| `base(item, nota)` | nenhum | base do item sem `vBC`, texto com até 2 casas |
| `regras` | as implantadas | `false` desliga; `{ rules, ignoreActivation }` troca a lista ou antecipa as futuras |
| `utcOffsetMinutes` | -180 | fuso para a data civil do fato gerador |

`test/rtc/e2e.test.ts` pega casos gravados da Calculadora offline da RFB (fixtures do oráculo do `@sinete/ibs-cbs/calcular`, só os sem divergência), monta a nota com a calculadora padrão, autoriza na `@sinete/sefaz-sim` por HTTPS com mTLS e confere cada campo dos grupos `IBSCBS` e do `IBSCBSTot` do `nfeProc` autorizado contra a saída gravada.

## Serviços (`createNfeClient`)

`NfeClient` fala SOAP 1.2 sobre qualquer `Transport` do `@sinete/transport`, com endpoints por UF e ambiente vindos dele. Cada operação devolve um `ResultadoSefaz` do core, com a rejeição enriquecida pelo `@sinete/rejeicoes`; o mapa de cStat é dado (`src/data/cstat.json`).

- `statusServico`, `autorizar` (síncrona por padrão; assíncrona devolve `pendente` com o recibo), `consultarRecibo` e `aguardarRecibo` (política de espera com teto e `AbortSignal`), `consultar` (consulta protocolo pela chave; com a NF-e assinada, confere o `digVal` e monta o `nfeProc`).
- Eventos: `cancelar`, `cartaCorrecao` (sequência informada), `manifestar` (sempre no Ambiente Nacional, cOrgao 91), `cancelarPorSubstituicao` (só NFC-e; `detEvento` do e110112 oficial, gerado no `@sinete/schemas`).
- `inutilizar` (Id com os zeros do leiaute; só emitente CNPJ: pela NT 2018.001 v1.10, item 6.1, a inutilização não se aplica ao emitente pessoa física, e a série 910 a 969 é recusada antes do envio, como a SEFAZ faz com 266), `consultarCadastro`, `distribuicaoDFe` (distNSU, consNSU, consChNFe; descompacta o docZip com o `DecompressionStream` da plataforma).
- Autorizador: `autorizar` vai à UF do documento; `autorizar`, `consultar`, `cancelar` e o recibo consultado com a nota seguem o tpEmis da chave (6 SVC-AN, 7 SVC-RS), seja qual for a contingência de agora, porque o SVC só consulta e cancela a nota que ele autorizou (NT 2013.007); a CC-e vai sempre à UF. `uf` e `contingencia: 'svc'` nas opções valem só para o que não parte de um documento (status, inutilização, recibo sem a nota, distribuição); sem `uf`, esses serviços lançam `ErroDeConfiguracao`. `autorizadorContingencia(uf, ambiente)` diz qual SVC e qual tpEmis a UF usa.
- NFC-e (modelo 65, pela chave ou pelo `mod`): endpoints da tabela da NFC-e do `@sinete/transport` (`nfceEndpoint`), que em várias UFs é outro host; `NfeClientOptions.nfceEndpoint` sobrepõe. A NFC-e não tem SVC: com o cliente em contingência, ela continua indo ao autorizador normal.
- Cancelamento: todo método que vai à rede aceita `signal` (`OpcoesEnvio`) no último parâmetro de opções. Em `statusServico`, `autorizar`, `consultarRecibo`, `aguardarRecibo` e `distribuicaoDFe`, ele fica no mesmo objeto das outras opções; nos demais, é um `opcoes?: OpcoesEnvio` a mais no fim. Abortar rejeita com `TransportError` de `code: 'cancelado'` (com o transporte do `@sinete/transport`), e um pedido que já saiu pode ter sido processado: confirme por consulta antes de repetir.
- `nfeProc`, `procEventoNFe` e `procInutNFe` são montados por splice: o documento assinado entra byte a byte, nunca reserializado. O `nfeProc` só é montado quando chave e `digVal` do protocolo conferem com a NF-e assinada.

### Envio sem resposta

Grave a NF-e assinada antes de enviar e nunca a remonte depois de um envio: outro cNF ou outro dhEmi cria uma segunda nota para o mesmo número. Sem resposta (timeout, conexão caída), ou com 204 ou 539, chame `resolverEnvioSemResposta(client, assinada, desfecho?)`: `concluida` traz o protocolo e o `nfeProc` (na denegação, que é da chave, conclui também sem `digVal` ou com outro, e `conteudo` diz qual; o `nfeProc` só vem com `confere`), `reenviar` (217) pede para reenviar os mesmos bytes, `divergente` diz que existe outra nota para o número (539 com a chave extraída do xMotivo, ou digVal diferente), `sem-prova` diz que a chave está autorizada e o protocolo não traz o `digVal` para provar que é esta nota (não reenvie, não descarte, não guarde sem conferir) e `indefinida` pede nova tentativa mais tarde.

Pedido de evento sem resposta, ou respondido com 573 ou 580, pode ter sido registrado; o `cStat` sozinho não prova que foi este evento. `recuperarEventoRegistrado(client, chave, tpEvento)` consulta a chave e devolve o `procEventoNFe` que a SEFAZ tem (`registrado: true`, com `nProt`, `dhRegEvento` e o `retEvento`), ou `registrado: false` com a consulta, que pode ter sido só indecisa.

Quem guardou só o `nfeProc` tira dele a NF-e assinada com `nfeAssinadaDoProc(xml)`: a fatia sai com os bytes assinados e, quando a `NFe` herdava o `xmlns` do envelope (proc montado por outro emissor), com o namespace declarado na própria raiz, que é o que `consultar`, `resolverEnvioSemResposta` e `retomar` exigem. O C14N do `infNFe` não muda, então a assinatura confere dentro e fora do proc.

## Lacunas conhecidas

- Exigência de infRespTec e CSRT por UF só tem PR com fonte; as demais UFs estão no padrão opcional (`options.exigencias` sobrepõe).
- EPEC e FS-DA ficam para outra versão; o modelo já tem os campos.
- NFC-e: as listas de CFOP e CST aceitas (I08-150, N12-30, N12-40) têm exceções por UF que mudam a cada versão da NT 2023.003 e ficam com a SEFAZ; também ficam com ela as regras opcionais por UF (limite de valor da W16-30, endereço na W16-60, bandeira do cartão da YA06-10, tabelas de NCM e unidade). O QR Code versão 100 não é montado.

## Ponta a ponta contra a SEFAZ simulada

`test/e2e/sefaz-sim.test.ts` sobe o `@sinete/sefaz-sim` em HTTPS com mTLS (AC, e-CNPJ e certificado do servidor gerados na hora) e usa o `createTransport` real. O cliente resolve os endpoints pelos dados do transporte, como em produção; o `redirectToSim` do simulador troca só a URL. Cobre status, autorização síncrona e assíncrona com recibo, envio sem resposta resolvido pelo `resolverEnvioSemResposta` (timeout, 204, 539 e 217), CC-e com sequência, cancelamento, manifestação no AN, distribuição ao destinatário, inutilização, consulta cadastro, contingência SVC-AN, transmissor terceiro e a rejeição 213 enriquecida pelo `@sinete/rejeicoes`. Roda no `bun run check`.

## Checagem local contra o corpus

`bun packages/nfe/test/golden/golden.ts` remonta a entrada de cada NF-e do corpus local (`~/.local/state/sinete/corpus`, nunca no repo) e roda o builder com os valores informados e com os derivados removidos. Grava só agregados em `~/.local/state/sinete/results/nfe-golden.json`. Não roda no CI.
