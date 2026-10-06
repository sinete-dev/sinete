# @sinete/sefaz-sim

SEFAZ simulada com estado, para os testes de integração dos pacotes e dos consumidores. Atende os web services da NF-e 4.00 e do MDF-e 3.00b com os nomes reais dos WSDL, valida na ordem da SEFAZ com as mensagens oficiais do `@sinete/rejeicoes`, guarda notas, eventos, inutilizações e a fila de distribuição em memória e lê o tempo só do `Relogio` injetado. O `@sinete/transport` real conversa com ela como conversaria com a SEFAZ: em processo pelo `transporteSim` ou por HTTPS com mTLS pelo `iniciarServidorSefazSim`.

Status: pré-alfa, API instável até a 1.0. Nada aqui fala com SEFAZ real.

```ts
import { relogioManual } from '@sinete/core';
import { criarSefazSim, URL_BASE_SIM, transporteSim, certificadoSintetico } from '@sinete/sefaz-sim';

const clock = relogioManual('2026-09-26T10:00:00-03:00');
const ac = await certificadoSintetico({ relogio: clock, papel: 'ac' });
const emitente = await certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: '11222333000181', emissor: ac });
const sim = criarSefazSim({ relogio: clock, uf: 'SP' });

// Em processo: o mesmo Transporte que o pacote do documento recebe em produção.
const transport = transporteSim(sim, { certificadoDoCliente: emitente.der });
await transport.enviar({ url: sim.url(URL_BASE_SIM, 'NFeAutorizacao'), cabecalhos: headers, corpo: body });

// Cenário: a SEFAZ processa e a resposta não chega; o reenvio responde 204 com o recibo original.
sim.injetarFalha({ tipo: 'travar', fase: 'depois' }, { servico: 'NFeAutorizacao' });
```

```ts
// Por HTTPS, com o transporte real (entrada node).
import { iniciarServidorSefazSim } from '@sinete/sefaz-sim';
import { criarTransporteNode } from '@sinete/transport';

const servidor = await certificadoSintetico({ relogio: clock, papel: 'servidor', emissor: ac });
const server = await iniciarServidorSefazSim(sim, { certificado: servidor.pem, chave: servidor.chavePem });
const t = criarTransporteNode({ identidade: emitente.identidadeTls, acsAdicionais: [ac.pem] });
await t.enviar({ url: server.url('NfeConsultaProtocolo'), cabecalhos: headers, corpo: body });
await server.fechar();
```

```ts
// Cliente de documento sem saber do simulador: ele resolve o endpoint pelos dados do transporte (nfeEndpoint,
// nfceEndpoint) e o redirecionarParaSim troca só a URL pelo caminho do autorizador simulado (UF, SVC ou AN).
import { redirecionarParaSim } from '@sinete/sefaz-sim';
import { criarClienteNfe } from '@sinete/nfe';

const client = criarClienteNfe({ transporte: redirecionarParaSim(t, server.urlBase), assinador: emitente.assinador, ambiente: 'homologacao', uf: 'SP', relogio: clock });
```

```ts
// O emissor do @sinete/emissor sem saber do simulador: ele recebe um PFX sintético (pfxSintetico, com a AC como
// intermediária) e a fábrica do transporte troca a URL; a política padrão de hosts fica de fora, porque o simulador está
// em 127.0.0.1.
import { pfxSintetico } from '@sinete/sefaz-sim';
import { criarEmissorNfe } from '@sinete/emissor/nfe';
import { criarMemoriaStore } from '@sinete/emissor/memoria';

const nfe = await criarEmissorNfe({
  pfx: pfxSintetico(emitente, 'senha', { cadeia: [ac] }), senha: 'senha', ambiente: 'homologacao', relogio: clock,
  store: criarMemoriaStore({ relogio: clock }),
  aoDecidir: (registro, desfecho) => decididas.set(registro.ref, desfecho),
  transporte: ({ politica: policy, ...o }) => redirecionarParaSim(criarTransporteNode({ ...o, acsAdicionais: [ac.pem] }), server.urlBase),
});
```

`redirecionarParaSim` recusa com `ErroDeConfiguracao` o pedido sem `endpoint` ou de serviço que o simulador não atende: nada escapa para a SEFAZ real.

## Decisões que valem aqui

- Inspiração de desenho: o emulador com estado e relógio virtual usado como oráculo de E2E. O simulador é determinístico: com o mesmo relógio e a mesma sequência de pedidos, os mesmos protocolos, recibos, NSU e `dhRecbto`.
- Todo retorno é montado pelo serializer do `@sinete/schemas` a partir do XSD oficial do PL vigente, e os testes validam cada resposta contra o schema do retorno: o XSD é o oráculo do leiaute.
- O documento assinado nunca é reserializado (invariante do repo): a área de dados sai do envelope como fatia da string recebida, a `NFe` do `nfeProc`, o `evento` do `procEventoNFe` e o que vai para o `docZip` são a string original, concatenada com o protocolo.
- Regras como dados: cada regra de negócio é um `RegraSim` com `id` e `fonte` (item do MOC 7.0 Anexo I ou da Visão Geral) e a lista é trocável por `opcoes.regras` (`REGRAS_PADRAO` é o ponto de partida). Nada de `if (uf === ...)`: o que muda por autorizador está em `SERVICOS_NFE` e nas opções.
- Relógio injetado: nenhum `Date` no pacote; datas são milissegundos convertidos pelo algoritmo civil de Howard Hinnant (`src/time.ts`).

## Serviços

| `NfeServico` do transporte | WSDL | Autorizadores | Caminho |
|---|---|---|---|
| `NfeStatusServico` | NFeStatusServico4 | `uf`, `svc` | `/uf/ws/NFeStatusServico4` |
| `NFeAutorizacao` | NFeAutorizacao4 (`indSinc` 0 e 1) | `uf`, `svc` | `/uf/ws/NFeAutorizacao4` |
| `NFeRetAutorizacao` | NFeRetAutorizacao4 | `uf`, `svc` | `/uf/ws/NFeRetAutorizacao4` |
| `NfeConsultaProtocolo` | NFeConsultaProtocolo4 | `uf`, `svc` | `/uf/ws/NFeConsultaProtocolo4` |
| `RecepcaoEvento` | NFeRecepcaoEvento4 (110110, 110111, 110112; 2102xx no AN com `cOrgao` 91) | `uf`, `svc`, `an` | `/an/ws/NFeRecepcaoEvento4` |
| `NfeInutilizacao` | NFeInutilizacao4 | `uf` | `/uf/ws/NFeInutilizacao4` |
| `NfeConsultaCadastro` | CadConsultaCadastro4 | `uf` | `/uf/ws/CadConsultaCadastro4` |
| `NFeDistribuicaoDFe` | NFeDistribuicaoDFe (`distNSU`, `consNSU`, `consChNFe`, `docZip` gzip em base64) | `an` | `/an/ws/NFeDistribuicaoDFe` |

Os três autorizadores dividem o mesmo estado. A SVC responde conforme a ativação para a UF (NT 2013.007 v1.03): com `definirContingencia('SVC-AN' | 'SVC-RS')` ligada, a UF responde 108 e a SVC fica ativada para as UFs atendidas (107 no status); desligada, a SVC responde 114 no status e na autorização, e o retorno e a consulta dela continuam atendendo. `definirAtivacaoSvc` ajusta a SVC de uma UF sem mexer na UF: `ativa`, `desativando` até uma hora (113 no status, com a data e a hora no `xMotivo`, e a autorização ainda aceita; depois da hora, como `inativa`) ou `inativa` (114).

## Ordem da validação

1. Transporte: rota (404), método (405), SVC desligada (503), certificado de cliente ausente (403, desligável com `exigirCertificado: false`).
2. Envelope SOAP 1.2: `Content-Type`, `action`, `Envelope`, `Body`, `nfeDadosMsg` com um só filho. Falha vira SOAP Fault com HTTP 500.
3. Certificado do transmissor (grupo A do Anexo I): 280, 281, 282.
4. Área de dados (grupo B): 214 tamanho, 243 XML malformado, 108/109 paralisação, 588 espaço entre tags, schema (225 e 215 com 565/516/568/517 na raiz e na versão), 404 prefixo de namespace.
5. Assinatura de cada documento (grupo E): 298, 290, 291, 292, 297, 213 e 227 (CNPJ base ou CPF do certificado contra o emitente ou autor).
6. Regras de negócio na ordem de `REGRAS_PADRAO`:
   - Autorização: A03-10 (502), B02-10 (226), B22-30/60/70 (570, 713, 783), B24-10 (252), C17 (229, 209, 554 para a IE do emitente), 1C17 (230, 231, 622, 203, contra o cadastro configurado), 2B08 (539 e 218, 205, 204 com o `nRec`, 635), 3B08-100 (206) e 1C17-40 (301, denegação com protocolo; na NFC-e, 781 sem protocolo, NT 2023.002 item 6).
   - CFOP e CST (modelo 55, com a Tabela CFOP do `@sinete/validators`): I08-144 (328, CFOP de devolução fora da devolução, menos a nota de crédito 03, 04 e 06) e N12-70 (508, CST com destinatário não contribuinte, com as exceções da NT 2023.001 e da NT 2023.003).
   - NFC-e (modelo 65): B11-10 (706), B11a-10 (717), B21-10 (709, e 710 para NF-e com `tpImp` 4 ou 5), B22-10 (711, off-line na NF-e sem `tpImp` 6), B25-20 (715, 716, 717), ZX02-10 (394, também na NF-e com `tpImp` 6, NT 2026.002 v1.11, que tirou a ZX01-10 e o 393), ZX02-220 (672, QR Code da NF-e fora da versão 3) e ZX02-222 da NT 2025.001 v1.03 (396 a 398, 444, 445, 474 e 583, com a assinatura da versão 3 off-line conferida contra o certificado que assinou a nota). Lote com mais de uma NFC-e é rejeitado com 126. O hash da versão 2 e o endereço do QR Code por UF não são conferidos.
   - Evento: P07 a P21, 2P12, H01 a H06, 2P13, 2P23, 4P15 e 5P31, com 572, 250, 252, 489/490, chave (236 e afins), 574, 578, 573, 594, 455/466, 784, 595, 494, 575, 501, 580, 650/651, 655, 577/579, 222, 221 e 910 a 913.
   - Inutilização: I01 a I08 com 252, 250, 266 (I02a da NT 2018.001: série 910 a 969 é de emitente CPF, que não inutiliza), 453/454, 224/201, 502, 203/240, 563 (com o `nProt` anterior), 256 e 241.

Os lotes do `indSinc=0` ficam pendentes até o relógio passar de `atrasoProcessamentoMs` (105 enquanto isso); `settle()` processa os vencidos.

## MDF-e 3.00b

Os serviços do MDF-e ficam no autorizador `uf` (no país real, todos na SVRS), com o holder `mdfeDadosMsg` e o namespace `http://www.portalfiscal.inf.br/mdfe/wsdl/<Servico>`. O `redirecionarParaSim` aceita os pedidos do MDF-e (`documento: 'mdfe'` do `@sinete/transport`).

| Serviço | Caminho | Regras, na ordem do MOC MDF-e 3.00b |
|---|---|---|
| `MDFeStatusServico` | `/uf/ws/MDFeStatusServico` | 252, 107 (108 e 109 com `definirParalisacaoMdfe`) |
| `MDFeRecepcaoSinc` | `/uf/ws/MDFeRecepcaoSinc` | área de dados em GZip e Base64 (244, 214 depois de descompactar, 243, 599 espaço entre tags, schema 215, prefixo 404); assinatura (290 a 298, 213 e 202); F01 (252), F02 (247), F03 (227), F05 (253), 207 e 210 no documento do emitente, F69 a F71 (232 a 234), F79 (212), F80 (228), F23 (705), F34 (702), F43 (647) e F44 (648) por modal, F45 (649), F45a (520), F46 (655), F48 (657) e F49 (658) do MDF-e transportado, F30a e F37a (518, 519) e F89c (523) da NT 2024.001, F114 a F118 (480, 479, 481, 482, 488), F81 (539) e F82 (204) duplicidade, F85 a F88 (611, 686, 462, 662) MDF-e não encerrados |
| `MDFeConsulta` | `/uf/ws/MDFeConsulta` | G01 a G06: 252, 236, 217, 600; 100, 101 ou 132 com o `protMDFe` e os `procEventoMDFe` |
| `MDFeConsNaoEnc` | `/uf/ws/MDFeConsNaoEnc` | H01 a H05: 252, 207 e 210, 213, 202; 111 com as chaves abertas do autor ou 112 |
| `MDFeRecepcaoEvento` | `/uf/ws/MDFeRecepcaoEvento` | J01 a J16 (252, 236, 217, 627, 628, 629, 631 duplicidade antes das regras do evento, 632, 634 a 637, 630 para schema só do `detEvento`) e as regras K de cancelamento (110111: 218, 609, 220 prazo, 222), encerramento (110112: 614, 689, 615, 222; pelo transportador terceiro, autor igual ao proprietário do veículo de tração e diferente do emitente, J09 e K11 da NT 2024.001 com 632 e 524), inclusão de condutor (110114), inclusão de DF-e (110115) e pagamento da operação (110116) |

Estado: cancelamento e encerramento mudam a situação do MDF-e (101 e 132 na consulta) e o tiram da lista de não encerrados. Protocolo: `9` (autorizador SVRS) + cUF + ano com dois dígitos + sequência de 10.

| Opção | Padrão | |
|---|---|---|
| `prazoCancelamentoMdfeHoras` | 24 | prazo do cancelamento depois da autorização (K04, 220) |
| `tamanhoMaximoMdfe` | 2048 KB | limite da área de dados descompactada (214) |
| `regrasMdfeDesligadas` | nenhuma | desliga regras pelo id do MOC (`F86`, `K04`, `J16`...) para montar cenários |

Fora do simulador: cadastro de emitente e de municípios (405, 406, 408), bases da ANTT (RNTRC, CIOT) e das NF-e e CT-e referenciados, e a conferência do `sign` do QR Code (F119).

## Controles de cenário

| Controle | Efeito |
|---|---|
| `injetarFalha({ tipo: 'travar', fase: 'depois' }, alvo)` | Processa e não responde: o cliente cai no timeout e o reenvio recebe 204 |
| `injetarFalha({ tipo: 'derrubar', fase: 'depois' \| 'antes' })` | Derruba a conexão depois ou antes de processar |
| `injetarFalha({ tipo: 'atraso', ms })` | Responde depois da espera em tempo real |
| `injetarFalha({ tipo: 'http', status })` | Só o status HTTP (503 do balanceador), sem processar |
| `definirParalisacao('108' \| '109', autorizador)` | Paralisação momentânea ou sem previsão |
| `definirContingencia(svc)` | UF em 108 e a SVC ativada para as UFs atendidas; `undefined` volta a UF e desativa a SVC (114) |
| `definirAtivacaoSvc(ativacao, uf?)` | ativação da SVC para a UF, sem mexer na UF: `ativa` (107), `desativando` com `ate` (113 até a hora) ou `inativa` (114) |
| `definirProtocoloSemDigVal('denegacao' \| 'todos', onde)` | Protocolo sem `digVal` (opcional no leiaute): só nas denegações da NF-e ou também nas autorizações da NF-e e do MDF-e; `onde` é `autorizacao`, `consulta` ou `ambos` (padrão). `undefined` volta ao normal |
| `respostaSincrona: 'aceita' \| 'recusa' \| 'assincrona'`, `cadastro`, `prazoCancelamentoHoras`, `intervaloConsumoIndevidoMs`, `tamanhoMaximo` | Opções de `criarSefazSim` |

O alvo (`{ servico, autorizador, vezes }`) restringe a falha; `vezes: Infinity` mantém até `limparFalhas()`. No `transporteSim`, queda vira `ErroTransporte('conexao_recusada')` e falta de resposta vira `ErroDeTempoEsgotado`, como no transporte real; no servidor HTTPS a queda destrói o socket e a falta de resposta deixa o socket aberto.

## Números determinísticos

- Protocolo: tipo do autorizador + cUF (ou 91 no AN) + ano com dois dígitos + sequência de 10 (MOC 7.0 Visão Geral, tabela 4-8). O primeiro protocolo da UF SP em 2026 é `135260000000001`.
- Recibo: cUF + tipo do autorizador + sequência de 12 (tabela 4-7).
- NSU: sequência de 15 por interessado (CNPJ ou CPF), a partir de 1.

## Distribuição de DF-e

- Destinatário: `resNFe` na autorização; a NF-e completa (`procNFe`) entra na fila depois da primeira manifestação que não seja desconhecimento (210210, 210200 ou 210240); eventos do emitente chegam como `resEvento` antes disso e como `procEventoNFe` depois.
- `autXML` e transportador: `procNFe` e `procEventoNFe` direto.
- Emitente: `procEventoNFe` das manifestações do destinatário.
- Validações da tabela 5-29: 252, 489/490 (documento do interessado), 593/472 (certificado), 589, 236 a 619 na chave (só modelo 55), 217, 641 (emitente), 640, 653 e 654.
- Consumo indevido (656) quando o interessado repete uma consulta vazia antes de `intervaloConsumoIndevidoMs` (padrão: 1 hora).

## Códigos que diferem do pedido informal

- Prazo de cancelamento não é 220: o MOC usa 501 (24 horas, 168 horas no cancelamento por substituição) e 221 para cancelamento depois da confirmação da operação. O 220 do catálogo é outra regra.
- Sequência da CC-e não é 503: são 573 (evento duplicado) e 594 (`nSeqEvento` acima de 20).
- Consulta e distribuição de chave inexistente respondem 217; evento para chave inexistente responde 494.

## Fora desta versão

- Cadeia, LCR e raiz ICP-Brasil do certificado (A03 a A06 e E04 a E07): o simulador confia em qualquer AC, então os certificados sintéticos servem.
- Na NFS-e: eventos de manifestação, bloqueio e ofício, a distribuição do ADN e as regras de conteúdo da DPS além das listadas acima.
- Prazo da manifestação (596) e prazo de download da distribuição (632).
- EPEC, pedido de prorrogação, eventos de interesse do fisco e os grupos de regras de conteúdo da NF-e (cálculos e totais): o simulador cuida do ciclo de vida, não do mérito fiscal.

## NFS-e Nacional (`criarNfseSim`)

Sefin Nacional e ADN simulados, com estado próprio e o mesmo relógio injetado. `criarNfseSim({ relogio, assinador, municipios, contribuintes })` devolve um `TratadorSim` (o mesmo `atender(PedidoSim)` da NF-e), então serve pelo `transporteSim` em processo e pelo `iniciarServidorSim(sim, { certificado, chave })` em HTTPS com mTLS. `redirecionarNfseParaSim(transporte, urlBase)` troca a base de cada API resolvida pelo `nfseEndpoint` (Sefin, ADN, parametrização) pelo prefixo dela no simulador (`NFSE_SIM_PREFIXOS`), e recusa com `ErroDeConfiguracao` o pedido sem endpoint ou fora da base.

```ts
import { criarNfseSim, redirecionarNfseParaSim, iniciarServidorSim, certificadoSintetico } from '@sinete/sefaz-sim';

const sim = criarNfseSim({
  relogio: clock,
  assinador: servidor.assinador, // a Sefin simulada assina a NFS-e e o evento
  municipios: [{ cMun: '3550308', nome: 'São Paulo', servicos: [{ codigo: '01.01.01', aliquotas: [{ aliquota: '2.00', inicio: '2026-01-01' }] }] }],
});
const server = await iniciarServidorSim(sim, { certificado: servidor.pem, chave: servidor.chavePem });
const transporte = redirecionarNfseParaSim(criarTransporte({ identidade: prestador.identidadeTls, acsAdicionais: [ac.pem] }), server.urlBase);
```

- **Rotas.** `POST /sefin/nfse`, `GET /sefin/nfse/{chave}`, `GET /sefin/dps/{id}`, `POST /sefin/nfse/{chave}/eventos`, `GET /sefin/nfse/{chave}/eventos/{tipo}/{seq}` (como a Sefin real em 28/09/2026: 405 sem o tipo, 404 com a página HTML do IIS sem a sequência, 200 com `eventos[].arquivoXml` em base64 do gzip em base64 e 404 com `{}` sem o evento), `GET /parametrizacao/{cMun}/...` (convênio, alíquota, histórico, regimes especiais, retenções, benefício). O DANFSe do ADN não é simulado: a API de geração foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026), e o DANFSe sai do `@sinete/da/nfse`. Respostas no formato observado na produção restrita: sucesso em JSON com o documento em gzip e base64, rejeição em HTTP 400 com `{"erros":[{"Codigo","Descricao","Complemento"}]}` e as mensagens oficiais do `@sinete/rejeicoes/nfse`.
- **Recepção, na ordem da aba RN_RECEPCAO_DPS e do nível 1.** Certificado do canal (403 sem certificado; E1200, E1203 e E1209 no lugar de 280, 281 e 282), JSON e base64 (E1225), gzip e XML malformado (E1226), UTF-8 e declaração XML (E1229), prefixo de namespace (E1228), raiz (E1242), schema do leiaute vigente pela tabela de vigências (E1235), assinatura da DPS (E0714 a E0718) e do pedido de evento (E1980 a E1991, E0812 e E0815). Canal com certificado válido de outro contribuinte, que não o emitente da DPS ou o autor do evento, responde 403: a API não tem transmissor terceiro nem procuração, e o Anexo I não tem código para isso.
- **Regras como dado** (`NFSE_REGRAS_PADRAO`, trocável por `regras`), cada uma com o código e a linha da planilha oficial: na DPS, E0006, E0015, E0037, E0038, E1270, E0014, E0042, E0046, E0312 (serviço sem alíquota vigente na competência) e E0617; no evento, E1845, E1831, E0813 e E0816 (autor do cancelamento ou da análise fiscal que não é o emitente da NFS-e), E0840 (com o nome do evento já registrado na mensagem) e E0822 (prazo de cancelamento do município).
- **Documentos.** A NFS-e leva a DPS recebida byte a byte, os valores do ISSQN e do IBS/CBS calculados em centavos inteiros (contas simples do simulador, não a apuração da Sefin) e a assinatura do `assinador`. A chave tem DV módulo 11, escolha do simulador: o Anexo I não publica o algoritmo. A substituta registra sozinha o e105102 na substituída.
- **Falhas.** `injetarFalha(falha, { rota, vezes })` com as mesmas falhas da NF-e, por rota (`emitir`, `consultarNfse`, `consultarDps`, `evento`, `consultarEventos`, `parametrizacao`); `inspecao` lista as NFS-e e os eventos.

## Certificados sintéticos

`certificadoSintetico({ relogio, papel })` gera na hora (WebCrypto, RSA-2048, sha256WithRSA) a AC, o e-CNPJ (`otherName` 2.16.76.1.3.3), o e-CPF (2.16.76.1.3.1 posicional) e o certificado do servidor (SAN com IP e DNS), com `assinador` (`AssinadorDeDados` do core), `identidadeTls` (`pem` do transporte) e PEM da chave. Não são ICP-Brasil e nada vai para o repo. No Bun, um certificado de AC apresentado como cliente derruba o handshake no servidor; use um de titular.

## Servidor HTTPS

HTTP/1.1 mínimo sobre `node:tls` (`Content-Length`, `chunked`, keep-alive, sem pipelining), porque o servidor HTTP do Bun 1.4.2 não expõe o certificado do cliente. O servidor pede o certificado de cliente sem recusar no handshake (`rejectUnauthorized: false` do lado do servidor), para que o próprio simulador decida entre 403, 280, 281 e 282. Isso não afrouxa o cliente: o `@sinete/transport` continua verificando o servidor pela `acsAdicionais`.
