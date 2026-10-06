# @sinete/mdfe

MDF-e modelo 58, leiaute 3.00b, os quatro modais (rodoviário, aéreo, aquaviário e ferroviário): modelo de entrada tipado, montagem com totais em decimal exato e as regras de validação do MOC conferidas antes de assinar, chave de acesso, QR Code, contingência off-line, assinatura por splice e os serviços da SEFAZ (status, autorização síncrona, consulta, não encerrados e eventos). No aéreo, o grupo `aereo` (aeronave, voo, aeródromos e data) e a entrega parcial do CT-e (corte de voo); no aquaviário, o grupo `aquaviario` (embarcação, viagem, portos, terminais, comboio, unidades vazias e MMSI) e o MDF-e transportado (`descarregamentos[].mdfe`, com `qMDFe` derivado); no ferroviário, o grupo `ferroviario` (trem e vagões, com `qVag` pela contagem). Cobre os dois usos do rodoviário: carga própria (emitente não prestador, inclusive produtor rural com e-CPF) e prestador de serviço de transporte (com CT-e, ANTT, CIOT, vale-pedágio e pagamento do frete).

Para emitir, retomar, encerrar e cancelar com estado entre chamadas (bytes assinados gravados antes do envio, trava entre processos, retomada automática, cancelamento com recuperação), use o emissor de MDF-e do [`@sinete/emissor`](../emissor) (`@sinete/emissor/mdfe`, ou `sinete/emissor/mdfe` pelo guarda-chuva). Este pacote é o protocolo e as primitivas sem estado que ele usa (ADR 0010):

```ts
import { criarEmissorMdfe } from '@sinete/emissor/mdfe';

const emissor = await criarEmissorMdfe({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const desfecho = await emissor.emitir('viagem-7', mdfe);
```

Status: pré-alfa, API instável até a 1.0. Nada foi enviado à SEFAZ real. Os serviços foram testados contra o `@sinete/sefaz-sim` em processo e de ponta a ponta por HTTPS com mTLS, e o builder, com MDF-e sintéticos e com uma checagem local contra um corpus de MDF-e autorizados (abaixo).

## API completa

```ts
import { relogioDoSistema, contextoDeTempo } from '@sinete/core';
import { montarMdfe, criarClienteMdfe, assinarMdfe } from '@sinete/mdfe';

const r = await montarMdfe(mdfe, { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: relogioDoSistema }) });
if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
const assinado = await assinarMdfe(r.valor, signer); // grave esta string antes de enviar
const client = criarClienteMdfe({ transporte: transport, assinador: signer, ambiente: 'homologacao', relogio: relogioDoSistema });
const desfecho = await client.autorizar(assinado);
if (desfecho.tipo !== 'autorizado') throw new Error(`${desfecho.cStat} ${desfecho.xMotivo}`);
guardar(desfecho.valor.mdfeProc);
// Na chegada:
await client.encerrar({ chave: r.valor.chave, nProt: desfecho.valor.nProt ?? '', uf: 'SP', cMun: '3550308' });
```

## Montagem (`montarMdfe`)

A entrada (`DadosMdfe`) é `DadosMdfeRodoviario`, `DadosMdfeAereo`, `DadosMdfeAquaviario` ou `DadosMdfeFerroviario`: um grupo de modal, `rodoviario`, `aereo`, `aquaviario` ou `ferroviario`, e só um. Ela usa os nomes do MOC nos campos e nomes em português nos grupos (`emitente`, `carregamento`, `percurso`, `rodoviario.tracao`, `rodoviario.reboques`, `rodoviario.ciot`, `rodoviario.valePedagio`, `rodoviario.contratantes`, `rodoviario.pagamentos`, `aereo`, `aquaviario.terminaisCarregamento`, `aquaviario.comboio`, `ferroviario.trem`, `ferroviario.vagoes`, `descarregamentos[].nfe`/`cte`, `descarregamentos[].cte[].entregaParcial`, `descarregamentos[].mdfe` (só no `DadosMdfeAquaviario`, com `unidadesTransporte` no tipo do leiaute), `seguros`, `produtoPredominante`, `totais`). Valores aceitam `string`, `number`, `bigint` ou `Decimal`; prefira texto.

- **Schema por vigência.** O relógio de emissão e o ambiente escolhem o schema (`selecionarPl('mdfe')` do `@sinete/schemas`); o XML é validado contra ele antes de devolver.
- **Chave.** cUF, AAMM, CNPJ (ou `000` + CPF), modelo 58, série, nMDF, tpEmis, cMDF e DV. cMDF aleatório (WebCrypto, injetável em `opcoes.aleatorio`) que não repete o nMDF; cMDF informado é conferido. Emitente CPF usa as séries 920 a 969.
- **Derivados e conferências.** `qCTe` e `qNFe` do `tot` saem das listas de documentos; `vCarga` e `qCarga` informados são formatados no leiaute. No pagamento do frete, componentes e parcelas mais adiantamento conferem com o `vContrato` na tolerância de R$ 0,01 (F58 e F62), e as datas das parcelas, com a emissão e entre si (F60 e F61).
- **Percurso.** `percurso` é conferido contra a tabela de divisas (`src/data/ufs-vizinhas.json`, fronteiras do IBGE, regra F90): cada trecho `ufIni → percurso → ufFim` tem de ligar UFs vizinhas, e o erro sugere o caminho mais curto (`sugerirPercurso`). `conferirPercurso` e `saoVizinhas` estão exportados para a tela.
- **Produto predominante.** `infLotacao` fica dentro do `prodPred`, com o local de carregamento e o de descarregamento (CEP ou latitude e longitude). A obrigatoriedade do NCM e do `infLotacao` segue a vigência da NT 2025.001 (`src/data/regras.json`).
- **CIOT por vigência.** A rejeição 684 (CIOT obrigatório para o TAC e equiparado) entra em homologação em 21/09/2026 e em produção em 23/11/2026 (NT 2026.001), como dado.
- **IE.** Sai com os dígitos informados, sem completar zeros à esquerda: é o que a SEFAZ autoriza (checagem do corpus).
- **Validação estrita.** Cada problema volta como `Ocorrencia` (`caminho`, `code`, `mensagem` com a regra do MOC e a rejeição, por exemplo `(F90, rejeição 663)`), nunca como exceção. Os códigos estão em `CODIGOS_OCORRENCIA_MDFE`. `origem` diz se a ocorrência veio da conferência da entrada (`entrada`, com o caminho da `DadosMdfe`) ou do documento montado (`montagem`: schema, chave, `tpEmis` das opções), e `rotuloDoCaminho(path)` dá o caminho em português para a tela (`Condutor 1, CPF`); veja o [ADR 0011](../../docs/adr/0011-origem-e-rotulo-das-ocorrencias.md).
- **`verProc`.** Padrão `sinete <versão do @sinete/mdfe>` (`formatarVerProc` do `@sinete/core`, cortado com segurança em 20 caracteres); `opcoes.verProc` sobrepõe.

- **NT 2024.001.** Chave de CT-e ou NF-e anterior a 6 meses da emissão (518 e 519; o mês limite passa) e cavalo mecânico sem reboque (523), com os parâmetros em `src/data/emissao.json`.

Regras do Anexo I conferidas no builder: F08, F10, F11, F13 a F24, F26 a F30, F34 a F37, F41 a F45, F52 a F58, F55a, F55b, F60 a F73, F77, F89 a F96, F98 a F108 e F121, mais F30a, F37a, F45a e F89c da NT 2024.001, com a origem de cada uma no código. As que o Anexo I abre com "Se modal rodoviário" (F18 a F20, F52 a F66, F89 a F113) não valem nos outros modais; F23 (carregamento posterior) e F34 (entrega parcial) dependem do modal.

### QR Code, contingência e assinatura

`assinarMdfe` coloca o `infMDFeSupl` com o QR Code (`src/data/qrcode.json`) antes de `</MDFe>` e depois insere a `Signature` como último filho, por splice. Em contingência off-line (`tpEmis: '2'`), o QR Code leva `sign`, a assinatura RSA-SHA1 da chave em Base64, e o MDF-e tem 168 horas para ser transmitido com o mesmo cMDF (`prazoContingencia`). Na emissão normal, transmitir depois de 24 horas é recusado com 228 (F80). `comQrCode` e `assinaturaQrCode` estão exportados para quem assina de outro jeito.

## Serviços (`criarClienteMdfe`)

`ClienteMdfe` fala SOAP 1.2 com o holder `mdfeDadosMsg` sobre qualquer `Transporte` do `@sinete/transport`, com os endpoints do MDF-e (SVRS) vindos dele. Cada operação devolve um `ResultadoSefaz` do core, com a rejeição enriquecida pelo catálogo do MDF-e do `@sinete/rejeicoes` (os códigos colidem com os da NF-e, por isso a entrada própria). O mapa de cStat é dado (`src/data/cstat.json`).

- `statusServico`, `autorizar` (MDFeRecepcaoSinc, o MDF-e em gzip e Base64; como a política do transporte não enxerga o `tpAmb` dentro do gzip, o cliente confere o `tpAmb` do MDF-e contra o ambiente dele e recusa com `ErroPolitica` antes do envio), `consultar` (situação, protocolo, eventos e conferência do `digVal` contra o MDF-e assinado), `consultarNaoEncerrados`.
- Eventos: `cancelar`, `encerrar` (`dtEnc`, padrão a data de hoje no fuso da UF da chave, `cUF` e `cMun`; o município tem de ser da UF, ou 9999999 no exterior, conferido antes do envio como K03 e K04; `terceiro` é o encerramento pelo proprietário do veículo de tração, que assina com o próprio certificado, vira o autor e liga o `indEncPorTerceiro`, NT 2024.001), `incluirCondutor`, `incluirDFe`, `pagamentoOperacao`. O `Id` segue o leiaute, `cOrgao` é o cUF da chave e o autor é o emitente da chave (fora o encerramento por terceiro); `opcoes.autor` é o padrão da consulta de não encerrados.
- Cancelamento: todo método que vai à rede aceita `opcoes?: EnvioOpcoes` como último parâmetro, com o `signal` que cancela a requisição em curso. Abortar rejeita com `ErroTransporte` de `code: 'cancelado'` (com o transporte do `@sinete/transport`), e um pedido que já saiu pode ter sido processado: confirme por consulta antes de repetir.
- `mdfeProc` e `procEventoMDFe` são montados por splice: o documento assinado entra byte a byte.
- Envio sem resposta: `resolverEnvioSemResposta(client, assinado, desfecho?, { signal }?)` consulta a chave e devolve `concluida`, `reenviar`, `divergente` (duplicidade com outra chave, extraída do xMotivo 539), `sem-prova` (a chave consta e o protocolo não traz o `digVal` para provar que é este MDF-e) ou `indefinida`. `recuperarEventoRegistrado(client, chave, tpEvento, { signal }?)` confirma pela consulta um evento cujo pedido ficou sem resposta ou voltou como duplicidade, e devolve o `procEventoMDFe` que a SEFAZ tem. `mdfeAssinadoDoProc(xml)` tira do `mdfeProc` guardado o MDF-e assinado pronto para isso, com o namespace declarado na raiz quando ele o herdava do envelope.

## Lacunas conhecidas

- MDF-e transportado: a existência, a situação e o modal do MDF-e referenciado (F46 a F49) dependem da base da SEFAZ e não são conferidos pelo montador; o simulador confere F46, F48 e F49 contra os MDF-e que ele mesmo autorizou (F47 não tem como ocorrer nele).
- Sem tabela de municípios do IBGE: nome e código do município não são cruzados (rejeições 405, 406 e 408), nem a base da ANTT (RNTRC, CIOT) ou do DENATRAN.
- A assinatura do parâmetro `sign` do QR Code não é conferida pelo simulador (F119).
- O nome do elemento de resposta do WSDL não foi confirmado contra a SEFAZ real: o cliente procura o `ret*` pelo nome em qualquer lugar do `Body`.
- NFF (tpEmis 3) e o evento de alteração de pagamento não são emitidos.

## Ponta a ponta contra a SEFAZ simulada

`test/e2e/sefaz-sim.test.ts` sobe o `@sinete/sefaz-sim` em HTTPS com mTLS (AC, e-CPF do produtor, e-CNPJ da transportadora e certificado do servidor gerados na hora) e usa o `criarTransporte` real. Cobre status, autorização, consulta com `digVal`, não encerrados e encerramento com o e-CPF; contingência off-line autorizada 48 horas depois e cancelamento com o e-CNPJ; e o envio sem resposta resolvido pela consulta. Roda no `bun run check`.

## Checagem local contra o corpus

`bun packages/mdfe/test/golden/golden.ts` remonta a entrada de cada `mdfeProc` do corpus local (`~/.local/state/sinete/corpus/mdfe`, nunca no repo), monta com o mesmo cMDF, tpEmis e fuso e compara o `infMDFe` com o autorizado em C14N. Também confere a tabela de divisas contra cada percurso autorizado, o endereço do QR Code e a forma do `Id` e do `nSeqEvento` dos eventos. Grava só agregados em `~/.local/state/sinete/results/mdfe-golden.json`. Não roda no CI.

Última rodada: dos 371 MDF-e autorizados, 351 remontados sem nenhuma ocorrência do builder e todos idênticos ao autorizado depois de normalizar (290 idênticos em C14N sem normalização; os demais foram emitidos antes da vigência do 3.00b, são montados na data de início dela e diferem só em `dhEmi` e `cDV`). Os outros 20 são desses anteriores à vigência e só caem na regra das chaves com mais de 6 meses (F37a) por causa da data deslocada. 371 percursos aceitos pela tabela de divisas, 371 QR Codes com o endereço do dado e 113 eventos (cancelamento e encerramento) com o `Id` de 54 posições.
