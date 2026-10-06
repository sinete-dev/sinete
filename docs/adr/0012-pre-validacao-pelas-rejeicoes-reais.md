# ADR 0012: pré-validação guiada pelas rejeições reais e barreira da recusa repetida

- Status: aceito
- Data: 28/set/2026
- Complementa o [ADR 0010](0010-fronteira-emissor.md) (o que vai para o `@sinete/emissor`) e o [ADR 0011](0011-origem-e-rotulo-das-ocorrencias.md) (`origem` das ocorrências).

## Contexto

As rejeições reais de um integrador em produção, em 180 dias, dão a lista do que chega à SEFAZ e volta: 38 códigos distintos (37 da NF-e e um do MDF-e), com a contagem de cada um. O mais frequente, com folga, é o 656 (consumo indevido) no envio: o integrador reenviava a mesma nota rejeitada repetidas vezes, e a SEFAZ passou a bloquear o emitente. Os seguintes são o 203 (emissor não habilitado), no envio e nos eventos, e o 266 (série fora da faixa).

Para cada código há três respostas possíveis, e só uma delas é recusar antes de enviar:

- **(a) pré-validável**: a regra do MOC ou da NT decide só com o documento (e, no máximo, o certificado). O sinete confere antes de assinar e devolve a ocorrência com o caminho da entrada.
- **(b) depende da SEFAZ**: cadastro (emitente habilitado, IE ativa no CCC), estado de outros documentos (CT-e ou MDF-e vinculado, manifestação do destinatário) ou configuração da UF (regra facultativa, lista de UF que muda por versão da NT, tabela externa). Não dá para decidir antes; o que dá é a dica do catálogo (`@sinete/rejeicoes`) clara e com a fonte.
- **(c) serviço**: a recusa não é da nota (serviço paralisado, consumo indevido). O que importa é o comportamento do emissor.

## Critério da pré-validação

Recusar localmente uma nota que a SEFAZ aceitaria é pior que a rejeição: a pessoa fica sem emitir por um defeito do sinete. Então só entra em (a) a regra que cumpre as quatro condições:

1. aplicação obrigatória (`Obrig.`) no documento vigente, sem "a critério da UF" nem "implementação opcional";
2. o resultado sai só do documento, sem cadastro, sem tabela do Portal (CFOP, NCM) e sem lista de UF que a própria NT diz ser configuração de cada uma;
3. toda exceção da regra é decidível com o documento; a que não é faz a conferência não recusar, em vez de recusar;
4. quando o MOC é ambíguo (em que fuso a SEFAZ compara "a data de emissão"), a conferência recusa só o que é recusado em todas as leituras.

Regra sem fonte localizada no MOC 7.0 e nas NT vigentes não é pré-validada.

## Tabela

Fontes: MOC 7.0 Anexo I e Visão Geral, NT 2018.001 v1.10, NT 2019.001 v1.70, NT 2023.001 v1.60, NT 2023.003 v1.40, NT 2024.003 v1.10, NT 2025.001 v1.03, NT 2026.001 v1.02b (Portal da NF-e, coletadas em 28/09/2026), MOC MDF-e 3.00b. "Já coberto" é conferência que o sinete fazia antes deste ADR.

| cStat | Regra | Fonte | Classe | O que foi feito |
|---|---|---|---|---|
| 656 | mesma NF-e com mais de 30 rejeições iguais: bloqueio de até 1 hora do emitente em todas as requisições; limites parametrizáveis pela UF | Anexo I, item 4.3.1 (NT 2018.002) | c | barreira da recusa repetida no emissor (abaixo); dica revista |
| 203 | emitente não habilitado a emitir NF-e no cadastro da UF | Anexo I, RV 1C17-34 | b | dica nova: regularizar o credenciamento antes de reenviar |
| 266 | série não permitida no serviço: na inutilização, série 910 a 969; no EPEC, série fora de 0 a 889 e 920 a 969 | Visão Geral, RV I02a e P12-32 (NT 2018.001) | a | já coberto na inutilização (`inutilizacao_serie_cpf`); a série da emissão agora é conferida (503/244); dica nova |
| 217 | NF-e não consta na base da SEFAZ (consulta, eventos) | Visão Geral, RV J03 e H142 | b | já coberto no envio (o emissor reenvia os mesmos bytes quando a consulta diz 217); dica existente |
| 690 | cancelamento de NF-e com CT-e ou MDF-e autorizado | Visão Geral, RV 4P15-18 | b | dica nova |
| 502 | Id difere da chave formada pelos campos | Anexo I, RV A03-10 | a | já coberto: a chave é montada dos mesmos campos do XML; dica nova |
| 836 | animal vivo sem GTA, fora dos CFOP dispensados, nas UF e NCM da tabela 4.1; facultativa | NT 2024.003 v1.10, RV ZF05-10 | b | código entrou no catálogo (`adicionais`); dica nova |
| 108 | serviço paralisado momentaneamente | Anexo I, regra B03 | c | recusa descartada sem entrar na barreira da recusa repetida; dica nova |
| 617 | chave do evento ou da consulta com CNPJ/CPF zerado ou DV inválido | Visão Geral, RV P12-26 e J02e | a | já coberto: o cliente valida a chave (`parseChaveAcesso`) antes do pedido; dica nova |
| 781 | emitente não habilitado a emitir NFC-e | Anexo I, RV 1C17-38 | b | dica nova |
| 503 | emitente CNPJ com série fora de 0 a 909 | Anexo I, RV C02-30; NT 2026.001 v1.02b | a | novo: série de 0 a 889 para emitente CNPJ (`serie_invalida`) |
| 253 | DV da chave inválido | Anexo I, RV B23-10 | a | já coberto: DV calculado na montagem; dica nova |
| 210 | IE do destinatário inválida para a UF | Anexo I, RV E17-50 | a | já coberto (`parseIe`); dica existente |
| 230 | IE do emitente não cadastrada | Anexo I, RV 1C17-10 | b | dica existente |
| 232 | destinatário CNPJ sem IE, com IE ativa e obrigatória no CCC | Anexo I, RV 5E17-50 (NT 2019.001) | b | dica existente |
| 529 | CST 50 ou 51 com destinatário isento (indIEDest 2) | Anexo I, RV N12-80 | a | novo: `combinacao_invalida` no CST do item, fora das exceções 1 e 3; o CST 51 interno passa com destinatário CNPJ ou CPF (revisão abaixo) |
| 997 | emissão monitorada pela SEFAZ de MG | sem fonte no MOC nem nas NT | b | nada: sem fonte oficial, fica fora do catálogo |
| 972 | responsável técnico obrigatório na UF | Anexo I, RV ZD01-10 (NT 2018.005) | a | já coberto (`resp_tec_obrigatorio`, por UF em `resp-tec.json`); dica nova |
| 934 | ICMS desonerado e motivo exigidos pela UF | Anexo I, RV N12-90 e I05f-30; facultativa por UF e CST | b | dica nova |
| 282 | certificado sem CNPJ nem CPF nas extensões ICP-Brasil | Anexo I, regra A07 | a | novo, em parte: o emissor da NF-e recusa (`ConfigError`) o certificado em que não se acha CNPJ nem CPF; o certificado com o documento só no CN continua indo à SEFAZ |
| 900 | duplicata sem vencimento ou vencendo antes da emissão | Anexo I, RV Y09-20 | b | dica existente; a conferência local foi retirada, com a da Y09-30 (850) (revisão abaixo) |
| 306 | IE do destinatário não ativa no CCC | Anexo I, RV 5E17-46 | b | dica nova |
| 853 | parcela única vencendo na data de emissão | NT 2025.001 v1.03, RV Y09-40 (produção desde 01/09/2025) | a | novo; código entrou no catálogo (`adicionais`) |
| 114 | SVC não ativada para a UF, ou desabilitada pela SEFAZ de origem | NT 2013.007 v1.03 (SVC), item 04.1 (C03.2, GB02.2) e item 04.7 (K05.1); fora do MOC 7.0 (revisto em 28/09) | c | fora do catálogo do `@sinete/rejeicoes`; a contingência automática só entra na SVC com 107 no status dela e sai com 114, e a recusa 114 é transitória para a barreira (ADR 0013, Revisão) |
| 213 | CNPJ-base do emitente difere do CNPJ-base do certificado | Anexo I, RV F03 | a | novo: `conferirEmitenteDoCertificado` no `@sinete/nfe`, chamado pelo emissor (e a F03A, 227, junto) |
| 528 | vICMS difere de vBC vezes pICMS | Anexo I, RV N17-20; facultativa | b | dica existente |
| 805 | destinatário isento em UF que não aceita isento | NT 2025.001 v1.03, RV E16a-30 e E16a-35 | b | dica nova; a lista de UF mudou três vezes entre as versões 1.01 e 1.03 e a NT a chama de configuração da UF |
| 508 | CST fora de 00, 20, 40, 41, 60 com não contribuinte | Anexo I, RV N12-70; NT 2023.001 e 2023.003 | b | dica nova; as exceções dependem da tabela CFOP (indRetor, indRemes), da UF e de alterações por NT |
| 328 | CFOP de devolução em nota que não é de devolução | Anexo I, RV I08-144 | b | dica nova; depende da tabela CFOP do Portal (indDevol), que o repositório não tem |
| 574 | autor do evento difere do emitente da chave | Visão Geral, RV P12-44 | a | novo: o cliente recusa o autor explícito de cancelamento, cancelamento por substituição e CC-e (`autor_difere_do_emitente`) |
| 244 | emissão pelo contribuinte com série fora de 0 a 889 e 920 a 969 | Anexo I, RV B26-10; NT 2026.001 v1.02b | a | novo, com o 503 |
| 209 | IE do emitente inválida para a UF | Anexo I, RV C17-20 | a | já coberto (`parseIe`); dica existente |
| 624 | IE do destinatário não vinculada ao CPF no CCC | Anexo I, RV 5E17-30 | b | dica nova |
| 402 | XML fora de UTF-8 | Anexo I, regra D03 | a | já coberto: o XML sai em UTF-8 da montagem ao transporte; dica nova |
| 519 | CFOP de saída em nota de entrada | Anexo I, RV I08-20; facultativa | b | dica nova |
| 481 | CRT diverge do cadastro | Anexo I, RV 7C21-10 | b | dica nova |
| 221 | cancelamento depois da Confirmação da Operação | Visão Geral, RV 4P15-14 | b | dica nova |
| 611 (MDF-e) | MDF-e não encerrado para a placa, o tipo de emitente e a UF de descarregamento | MOC MDF-e 3.00b Anexo I, RV F85 | b | dica existente |

Total: 15 em (a), 7 delas novas (503, 244, 529, 853, 213, 574, 282) e 8 já cobertas (266, 502, 253, 617, 209, 210, 972, 402); 20 em (b); 3 em (c) (656, 108, 114).

A faixa de série do emitente CNPJ considera a NT 2026.001 (PAA, produção em 05/10/2026): ela abre 980 a 989 na C02-30, mas mantém a B26-10 para a emissão pelo contribuinte e reserva 970 a 979 ao provedor. Juntas, as duas regras deixam 0 a 889 antes e depois da NT, e a conferência não muda na virada.

## Revisão pelas notas autorizadas (28/09/2026)

Antes de o integrador atualizar a versão, as regras novas foram aplicadas às NF-e autorizadas dele (cStat 100 e 150) e à paridade de 1.500 notas. Duas recusariam nota que a SEFAZ autorizou depois de setembro de 2025:

- **N12-80, CST 51 interno com destinatário CPF isento:** autorizado em produção por uma UF. A exceção 3 fala em destinatário CNPJ, mas deixa a aplicação a critério da UF; a conferência passa a liberar o CST 51 em qualquer operação interna, seja qual for o documento do destinatário.
- **Y09-20, parcela única vencendo dois meses antes da emissão:** autorizada em produção por outra UF em 2026. A aplicação da Y09-20 depende da UF, e a Y09-30 (850), do mesmo bloco e sem rejeição real na amostra, vai junto: as duas saem da conferência local e ficam para a SEFAZ.

As demais regras novas não recusariam nenhuma nota autorizada da amostra: série de emitente CNPJ fora de 0 a 889, Y09-40 depois da vigência, emitente diferente do certificado e autor de evento diferente do emitente da chave.

## Destinatário, grupo E (28/09/2026)

Em produção, uma NF-e com `indIEDest` 1 e sem IE voltou 232. O 232 é a regra do cadastro (5E17-50: destinatário CNPJ sem IE, com IE ativa e obrigatória no CCC); a regra do documento para o mesmo caso é a E17-20 (728: `indIEDest` 1 sem IE), e a UF que avalia o cadastro primeiro devolve o 232. A E17-20 o montador já conferia desde a primeira versão, com a citação errada (E17-10): montada pelo `buildNfe` desta versão, a nota seria recusada antes de assinar, com o caminho `destinatario.IE`. O lote revisou o grupo E inteiro do MOC 7.0 Anexo I pelo mesmo critério. As regras só da NFC-e (E01-20, E02-20, E05-20, E16a-10, E18-10) já eram conferidas pelo montador da NFC-e e ficam onde estão.

| Regra | cStat | Modelo | O que confere | Decisão |
|---|---|---|---|---|
| E01-10 | 719 | 55 | NF-e sem destinatário | já coberto |
| E02-10, E03-10 | 208, 237 | 55/65 | CNPJ e CPF com dígito inválido | já coberto (`parseCnpj`, `parseCpf`) |
| E03a-10 | 720 | 55 | exterior (`idDest` 3) sem `idEstrangeiro` | **entrou** |
| E03a-20 | 721 | 55 | `idEstrangeiro` fora do exterior sem consumidor final | **entrou** |
| E03a-30 | 925 | 55/65 | `idEstrangeiro` com IE | **entrou** |
| E03a-60 | 372 | 55/65 | `idEstrangeiro` com caractere fora de algarismos, letras e `:.+-/()` | **entrou** |
| E04-10 | 724 | 55 | NF-e sem o nome do destinatário, em produção | **entrou** (em homologação o montador põe o literal da E04-20) |
| E04-20 | 598 | 55/65 | nome em homologação | já coberto: o montador põe o literal |
| E05-10 | 726 | 55 | NF-e sem o endereço do destinatário | **entrou** |
| E10-10 | 274 | 55/65 | município inexistente | fora: depende da tabela de municípios do IBGE, que o repositório não tem |
| E10-20 | 275 | 55/65 | município de outra UF (as duas primeiras posições do código) | **entrou** |
| E10-30, E12-10 | 509, 727 | 55 | exterior com município 9999999 e UF EX | já coberto: o montador preenche |
| E12-30, E12-50 | 772 | 55 | interestadual com o destinatário na UF do emitente | **entrou**, com as exceções da regra (outro CNPJ, `UFCons` do combustível, UFs de entrega e retirada) |
| E12-40, E12-60 | 773 | 55 | interna com o destinatário em outra UF, sem consumidor final | **entrou**, com as exceções (`UFCons`, entrega e retirada) |
| E14-04 | 377 | 55/65 | país inexistente | fora: depende da tabela de países do BACEN |
| E14-10, E14-20 | 510, 511 | 55, 55/65 | país Brasil no exterior e estrangeiro fora dele | fora: facultativas |
| E14-30 | 926 | 55/65 | exterior com o país Brasil (1058, com ou sem zeros) | **entrou** |
| E16a-20 | 790 | 55 | exterior com destinatário contribuinte | **entrou** |
| E16a-30, E16a-35 | 805 | 55 | isento em UF que não aceita | fora (já na tabela acima): a lista de UFs é configuração de cada uma |
| E16a-40 | 696 | 55 | saída para não contribuinte sem consumidor final | **entrou** |
| E17-10 | 729 | 65 | NFC-e para o exterior com IE | fora: a NFC-e já é recusada antes pela B11a-10 (707, só operação interna) |
| E17-20 | 728 | 55 | contribuinte sem IE | já coberto; citação corrigida (era "E17-10") |
| E17-30 | 791 | 55 | isento com IE | já coberto; citação corrigida (era "E16a, nota 3") |
| E17-40 | 792 | 55 | exterior com IE | **entrou** |
| E17-50 | 210 | 55 | IE inválida para a UF | já coberto (`parseIe`) |
| E18-20 | 235 | 55 | ISUF com dígito inválido | fora: o MOC não traz o algoritmo, e sem fonte não se implementa |
| E18-30 | 251 | 55 | ISUF fora da área incentivada (AC, AM, RO, RR; no AP, Macapá e Santana) | **entrou**, com a área em `data/suframa.json` |
| 5E17-12 | 300 | 55 | IE com `indIEDest` 9 e tipo diferente de não contribuinte no CCC | fora: depende do cadastro e está como "implementação futura" (NT 2025.001 v1.03). IE com `indIEDest` 9 passa: há IE de não contribuinte |
| 5E17-10 a 5E17-80 | 232, 233, 234, 302, 303, 305, 306, 623, 624 | 55 | cadastro do destinatário no CCC | fora: dependem do cadastro; dicas revistas (232) ou existentes |

Todas as ocorrências novas vão no caminho da entrada (`destinatario...`, `idDest`, `indFinal`) com `origem: 'entrada'`, e cada código tem dica curada no `@sinete/rejeicoes`. As regras de idDest (E12) só recusam o `idDest` informado: o calculado pelo montador sai das UFs e nunca as contraria. Duas regras novas pegaram exemplos do próprio repositório: a E12-30 (um teste com destinatário de SP e `idDest` 2 explícito, corrigido para o RJ) e a E05-10 (o tutorial, as fixtures da smoke do `@sinete/nfe` e do `@sinete/emissor` e um teste do emissor montavam NF-e com destinatário sem endereço, que a SEFAZ recusaria com 726; ganharam o endereço).

Antes de fechar, as regras foram aplicadas às 3.615 NF-e autorizadas do corpus local (as próprias do integrador e a paridade), todas modelo 55: nenhuma seria recusada. O controle negativo (trocar o `idDest` de cada nota) faz a E12-30 a E12-60 dispararem em 3.435 delas, então a conferência roda sobre esse corpus. O corpus não tem destinatário no exterior, com ISUF nem NFC-e com destinatário: as regras E03a, E14-30, E16a-20, E17-40 e E18-30 se apoiam só no texto do MOC. A E12-30 recusa também o destinatário com CPF na UF do emitente com `idDest` 2 (o CPF difere do CNPJ do emitente em qualquer leitura da regra).

## Contribuinte exclusivo do IBS/CBS (06/10/2026)

A NT 2026.007 v1.10 (produção em 03/11/2026) cria a NF-e sem IE do emitente, autorizada só na SVRS, e 30 rejeições novas (156 a 188, que entraram no catálogo do `@sinete/rejeicoes` pela leitura das regras da NT). O roteamento (166 e 188) é do cliente da NF-e. Pelo critério acima:

| Regra | Rejeição | Classe | O que foi feito |
|---|---|---|---|
| C17-42: NFC-e sem IE, até o fim de 2032 | 156 | a | novo: `campo_obrigatorio` em `emitente.IE`; recusa só quando a data da emissão e a do fato gerador, no fuso local, em Brasília e em UTC, caem todas antes de 2033 |
| C17-43: NF-e sem IE e sem CNPJ do emitente | 157 | a | novo: `campo_obrigatorio` em `emitente.CNPJ` |
| C18-50: NF-e sem IE com IEST | 158 | a | novo: `combinacao_invalida` em `emitente.IEST` |
| N01-10: ICMS ou ICMSUFDest no item da NF-e sem IE, fora da devolução e do tpNFCredito 03 | 161 | a | novo: `grupo_vedado` em `itens[n].impostos.icms` ou `icmsUfDest` |
| UB12-11: item sem IBSCBS na NF-e sem IE | 162 | a | novo: `campo_obrigatorio` em `itens[n].impostos.ibsCbs`, conferido no grupo montado (pronto ou da calculadora); a falta de ICMS e ISSQN, que a exceção 2 da B25-90 libera nessa nota, deixa de ser ocorrência |
| I08-191: CFOP fora da tabela do Portal (coluna indExcIBSCBS) | 159 | b | fora: depende da tabela de CFOP |
| 1C17-02, 1C17-04 | 163, 164 | b | fora: CCC |
| 5AF15, 5AF17, 5BG15, 5BG17 (locais de retirada e entrega) | 165, 167 a 169, 171, 173, 175 a 177 | b | fora: CCC |
| 12C02, 12C21, 12E02, 12F02, 12G02, 1P10-30, 1P10-32 | 170, 178 a 187 | b | fora: LCC-RFB |

As regras da NT de aplicação "exclusiva da SVRS" (157, 158, 161, 162) entram mesmo assim: a NF-e sem IE só é autorizada na SVRS (C17-11), então não há autorizador em que a nota recusada aqui passaria.

## A barreira da recusa repetida (656)

A regra do consumo indevido conta a mesma NF-e com a mesma rejeição. Reenviar a mesma nota depois de uma rejeição que só depende dela dá sempre a mesma rejeição; depois de uma que depende do cadastro da SEFAZ (203, 230), pode passar, se a causa foi resolvida fora da nota. O emissor conta as recusas iguais e barra o reenvio só a partir de um limite:

- **O que é lembrado.** Quando o desfecho é `recusado` e os bytes são descartados, o emissor registra no store o SHA-256 do conteúdo da nota, o `cStat` e o `xMotivo`, por `tipo` e `ref`. O store conta a sequência: a mesma recusa (mesmo conteúdo e mesmo `cStat`, como na regra) dentro da janela desde a primeira dela soma 1; outra recusa, ou a janela vencida, recomeça em 1. Não entra a recusa do serviço (`transitorio` em `src/data/cstat.json`: 108, 109 e 999 na NF-e; 108 e 109 no MDF-e), nem a que mantém os bytes (duplicidade, lote em processamento), que não é descarte.
- **Onde barra.** Em `emitir`, com a trava, depois de montar e assinar e antes de gravar: se a sequência da janela chegou ao limite e o conteúdo montado tem o mesmo SHA-256, lança `RecusaRepetidaError` (`recusa_repetida`), sem gravar e sem ir à SEFAZ. A janela padrão é 1 hora, a da regra, contada desde a primeira recusa da sequência; o limite padrão é 3, então a 4ª tentativa igual não sai. Os dois são configuráveis (`recusaRepetida: { janelaMs, limite }`).
- **O que não barra.** A mesma nota abaixo do limite. A nota corrigida, que tem outro conteúdo e recomeça a conta. A retomada de bytes gravados (`retomar`, `retomarPendentes`, o `emitir` que acha bytes), que nunca passa pela barreira: o envio sem resposta continua sendo resolvido pela consulta e pelo reenvio dos mesmos bytes. E o reenvio pedido com `reenviarRecusado: true`, para depois de corrigir uma causa fora da nota (o credenciamento do emitente, 203) quando a conta já chegou ao limite.
- **Conteúdo, não bytes.** A primeira versão comparava os bytes e não via o integrador que remonta a nota a cada clique com a hora de agora: cada tentativa sai com bytes novos. O conteúdo comparado é o XML assinado sem o que muda sozinho entre duas montagens da mesma nota (`PerfilDocumento.conteudoParaRecusa`): na NF-e, `dhEmi`, `dhSaiEnt`, `cNF`, `cDV`, o `Id` e o `hashCSRT` que saem da chave, a assinatura e o `infNFeSupl`; no MDF-e, `dhEmi`, `cMDF`, `cDV`, `Id`, assinatura e `infMDFeSupl`; na DPS, `dhEmi` e assinatura. A exceção é a recusa que se corrige justamente num desses campos (`campoVolatil` em `src/data/cstat.json`): todo código do catálogo do `@sinete/rejeicoes` cuja mensagem fala de data, hora, prazo, vencimento, entrega, competência, validade, chave de acesso, código numérico, dígito verificador, assinatura, certificado, QR Code, CSRT ou hash, pela expressão em `campoVolatilPadrao`, com um teste que mantém a lista em sincronia com o catálogo. A lista por expressão, e não caso a caso, porque cada revisão achava mais um código (228, 978, 1154); classificar a mais só enfraquece a barreira, classificar a menos barraria uma correção: para ela a barreira compara os bytes, e a nota remontada com a data certa vai à SEFAZ. A comparação é só para a barreira: o XML enviado nunca é reserializado.

### Por que 3 recusas, e não 1 nem 30

A primeira versão barrava já o segundo envio igual. Isso partia de que a mesma nota volta sempre com a mesma rejeição, o que não vale para a rejeição de cadastro: o emitente que se credencia na SEFAZ (203) ou acerta a IE (230) e clica de novo com a mesma nota recebia `recusa_repetida`, a menos que o integrador tivesse ligado `reenviarRecusado` a uma ação da pessoa, o que quase nenhum faz. Ligá-lo em todo reenvio desliga a barreira.

- **1 (barrar o primeiro reenvio).** Protege ao máximo, mas trata como erro o fluxo normal de corrigir o cadastro e tentar de novo, e empurra o integrador para o `reenviarRecusado` automático.
- **30 (o limite da regra).** Não protege: a UF pode baixar o limite (a regra diz que ele é parametrizável), e cada envio igual acima de poucos só consome a cota sem chance de resultado diferente.
- **3 (escolhida).** Deixa passar o clique repetido e o reenvio depois de resolver a causa fora da nota, com uma tentativa de folga, e para o job que reenvia em laço na 4ª tentativa da hora: um décimo do limite da regra, com margem se a UF o baixar. A janela conta desde a primeira recusa da sequência, como a regra conta as rejeições numa hora: a cada hora, no máximo 3 envios iguais saem, e passada a hora a conta recomeça.

O número é um padrão, não um dado da regra: quem conhece o limite da sua UF ajusta `limite`, e `limite: 1` reproduz a barreira da primeira versão.

### Onde fica a memória: métodos opcionais do `TransmissaoStore`

A memória precisa valer entre processos (o job de retomada e o clique da pessoa em servidores diferentes), então fica no banco do integrador, pelo store. As alternativas:

1. **Métodos obrigatórios no `TransmissaoStore`.** Quebraria todo adaptador SQL já escrito por um recurso que não protege contra nota duplicada. A trava e a gravação são obrigatórias porque o erro delas produz documento em dobro; a barreira só evita uma rejeição que a SEFAZ daria de qualquer jeito.
2. **Memória no processo do emissor.** Não vale entre processos nem sobrevive a reinício, que é justamente o cenário do reenvio em laço por um job.
3. **Métodos opcionais, juntos (escolhida).** `registrarRecusa` e `recusaRecente` entram no `TransmissaoStore` como opcionais. Com os dois, a barreira liga por padrão; sem nenhum, o emissor funciona como antes; com um só, `createEmissor` lança `ConfigError`. O adaptador em memória implementa os dois. A suíte de contrato ganhou quatro casos (outro processo vê a recusa e a janela vence pelo relógio do banco; a mesma recusa conta, inclusive de dois processos ao mesmo tempo; outro conteúdo, outro `cStat` ou a janela vencida recomeçam a conta; a recusa sobrevive a `soltar` e `descartar`), incluídos por padrão: quem roda a suíte num adaptador sem os métodos vê o motivo na falha e passa `recusas: false` para pular. A janela é uma duração comparada com o relógio do banco, como os prazos da trava, e vai como parâmetro nos dois métodos; a conta é feita pelo banco numa instrução só, para dois processos que registram juntos não perderem uma recusa. O guia `store-sql.md` traz a tabela e os dois métodos para o PostgreSQL, conferidos com os 18 casos no PGlite.

A falha ao registrar a recusa (o banco fora do ar logo depois do descarte) só gera um aviso no log: o desfecho vale, e a SEFAZ continua a juíza.

## Consequências

- `@sinete/nfe`: `buildNfe` passa a recusar série de emitente CNPJ fora de 0 a 889, CST 50 e 51 com destinatário isento, duplicata sem vencimento ou vencendo antes da emissão ou da parcela anterior, e parcela única vencendo na emissão. Novo `conferirEmitenteDoCertificado` e o código `emitente_difere_do_certificado` em `NFE_ISSUE_CODES`. O cliente recusa autor explícito de evento do emitente diferente do emitente da chave.
- `@sinete/emissor`: `RecusaRepetidaError`, `OpcoesEmissor.recusaRepetida` (`janelaMs`, `limite`), `OpcoesEmitir.reenviarRecusado`, `PerfilDocumento.transitorio` (opcional), os métodos opcionais do store e os tipos `Recusa` e `RecusaRegistrada`; `casosDoContrato` ganha `recusas`. O emissor da NF-e confere o certificado contra o emitente antes de assinar.
- `@sinete/rejeicoes`: dicas para 29 códigos a mais; 853 e 836 entram no catálogo pelas `adicionais` da curadoria, com a NT de origem em `sources.json` e a linha da regra conferida no PDF.
- A próxima leva de rejeições reais segue o mesmo caminho: classificar pela tabela acima e pré-validar só o que passa no critério.

## Pendências

- A tabela CFOP do Portal (indDevol, indRetor, indRemes) permitiria pré-validar o 328 e parte do 508; entra quando for versionada como dado com fonte.
- O 282 com o documento só no CN do certificado: o `@sinete/cert` sabe de onde veio o documento (`source`), mas recusar por isso depende de confirmar que nenhuma SEFAZ aceita esse certificado.
