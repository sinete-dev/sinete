# Validação em homologação

Fechamento do M1: os pacotes na forma publicada, não os spikes, contra a SEFAZ de homologação real, com o e-CNPJ A1 da FAZER.AI LTDA (CNPJ 59554465000137, SP, Simples Nacional, sem IE; serial `48126C57E6D1ABA9`, AC SAFEWEB RFB v5, válido até 12/jan/2027). Rodada de 26/set/2026. Runner e passo a passo para outro operador: [tools/homologacao/](../tools/homologacao/README.md).

## Como foi feito

- Pacotes importados pelo nome (`@sinete/nfe`, `@sinete/cert`, `@sinete/transport`, `@sinete/cli`, `@sinete/core/xml`), resolvidos para o `dist` do `bun run build`. Nenhum import do fonte nem dos spikes.
- PFX legado (RC2-40 + 3DES) aberto pelo `abrirPfx` do `@sinete/cert` em memória, lido do 1Password por spawn sem shell. PFX, chave e senha não foram gravados, impressos nem passados em argv ou env de outro processo.
- Guarda: `PoliticaDeHosts` do `@sinete/transport` (`politicaDeHostsPermitidos`) com 15 hosts de NF-e e MDF-e de homologação escritos à mão, porta 443 e `tpAmb` 2 no corpo. Testada antes da rodada (`tools/homologacao/test/policy.test.ts`: todo endpoint de produção recusado, NFC-e e NFS-e fora, `tpAmb` 1 recusado mesmo com prefixo ou comentário, e o transporte real recusando antes do socket sem nenhum evento de auditoria).
- Ledger em `~/.local/state/sinete/cert-usage.log`: 48 linhas nesta rodada, 40 envios que usaram o certificado, 6 recusas do Deno antes do socket e 2 assinaturas locais.
- Identidade TLS: `identidadePem` com a cadeia que o `montarCadeia` montou. O bundle ICP-Brasil do pacote não tem as intermediárias da AC SAFEWEB, então o cliente mandou **só a folha**.

## Resultados

| Operação | Node 26.3 | Bun 1.4.2 | Deno 2.9.1 |
|---|---|---|---|
| `statusServico`, 12 autorizadores (AM, BA, GO, MG, MS, MT, PE, PR, RS, SP, SVAN, SVRS) e SVC-AN e SVC-RS | 14 x cStat 107 | 14 x cStat 107 | 8 x cStat 107; BA, MT, PR, SP, SVAN e SVC-AN recusados com `nao_suportado` antes do socket |
| `consultarCadastro` do próprio CNPJ em SP | cStat 257 "Solicitante não habilitado para emissão da NF-e" | | |
| `distribuicaoDFe` no AN, `distNSU` 0 | cStat 137 "Nenhum documento localizado", `ultNSU` = `maxNSU` = 0 | | |
| `buildNfe` + `signNfe` + `autorizar` em SP (1 tentativa) | lote cStat 104, protocolo cStat 166 | | |
| `sinete doctor --uf RS` (handshake, sem requisição) | `pfx` ok, `cadeia` aviso (falta a AC SAFEWEB RFB v5), `tls` ok com certificado de cliente carregado, saída sem material de chave | | |

Autorização: chave `35260959554465000137550010000000031775481524`, série 1, nNF 3, PL_010f, emitente sem IE e CRT 1, destinatário com o próprio CNPJ e o nome literal de homologação posto pelo builder, um item de R$ 1,00 com CSOSN 102 e PIS e COFINS 49 zerados. Antes do envio: schema do builder, `conferirAssinatura` do `@sinete/core/xml` e `xmllint` contra o `nfe_v4.00.xsd` oficial. Retorno: lote **104** "Lote processado", protocolo **166** "Rejeição: UF de autorização não permitida para contribuinte exclusivo do IBS/CBS", `dhRecbto` 2026-09-26T03:16:36-03:00. Pela ordem de validação do MOC (TLS, mensagem, schema 225, certificado da assinatura 290 a 296, assinatura 297 e 298, e só então as regras de negócio), a 166 no protocolo de um lote processado prova que TLS, XSD, certificado e assinatura saídos dos pacotes foram aceitos. É o mesmo desfecho do spike (ADR 0004, seção 6), agora com o builder, o signer e o cliente reais. A 166 é esperada: sem IE, a SEFAZ-SP trata o emitente como contribuinte exclusivo do IBS/CBS, que pela NT 2026.007 autoriza só na SVRS.

## O que isso muda

- **Só a folha basta.** Os 14 hosts em Node e Bun e os 8 do Deno aceitaram o certificado de cliente sem intermediárias. No spike o cliente mandava folha e duas intermediárias; a dúvida registrada no ADR 0004 fica respondida para os autorizadores de NF-e de homologação e este emissor (AC SAFEWEB RFB v5, raiz v5). Produção e outras ACs seguem sem medição.
- A renegociação iniciada pelo servidor (BA, MT, SP, SVAN, AN) funciona pelo `@sinete/transport` em Node e Bun. SVC-AN e SVC-RS reaproveitaram a conexão keep-alive de SVAN e SVRS, e a checagem do certificado local no socket reaproveitado passou.
- A recusa explícita do Deno bate com os perfis TLS dos dados: os 6 hosts recusados são os que pedem o certificado por renegociação (BA, MT, SP, SVAN, SVC-AN) ou só oferecem CBC (PR). O AN também só negocia CBC (`ECDHE-RSA-AES256-SHA384`) e pede renegociação; ficou fora do Deno por escopo.
- Nenhum bug de pacote apareceu. Nada foi corrigido nos pacotes nesta rodada.

## O que não foi coberto nesta rodada

Eventos, inutilização, consulta protocolo, recibo assíncrono, contingência com emissão, MDF-e (fora do `@sinete/nfe`), NFC-e, produção, e uma NF-e autorizada (cStat 100), que depende de a SVRS de homologação atender emitentes de SP ou de um emitente com IE. A rodada 2, abaixo, cobre a autorização, a consulta protocolo e os eventos.

# Rodada 2: emitente do DF com IE (26/set/2026)

Emitente: produtor rural pessoa física do DF, com IE, CRT 3, e-CPF A1 da AC SAFEWEB RFB v5 (válido até 17/dez/2026), com o consentimento do produtor para testes em homologação. CPF, IE, nome, endereço, chaves de acesso e protocolos são dados pessoais e ficam fora do repo: os dados do emitente foram lidos só para leitura da cópia local da base do integrador em produção, e o XML e os retornos ficam em `~/.local/state/sinete/homologacao-df/`. O DF é autorizado pela SVRS. Runner: `tools/homologacao/src/df.ts`.

## Controles

- Guarda mais estreita que a da rodada 1: `homologacaoDfPolicy` (`tools/homologacao/src/policy.ts`), com 3 hosts escritos à mão (SVRS de NF-e, SVC-AN e Ambiente Nacional de homologação), porta 443, `tpAmb` 2 obrigatório em todo POST, só os serviços da rodada (status, autorização, consulta protocolo, eventos e Distribuição DF-e; inutilização e cadastro recusados mesmo no host permitido) e só os eventos 110110 e 110111 no corpo. Testada antes da rodada, com todo endpoint de produção e todo outro host de homologação recusados.
- Certificados só em memória, lidos do 1Password por spawn sem shell. O e-CPF assina tudo; o e-CNPJ da FAZER.AI LTDA entrou só no TLS do teste de transmissor terceiro.
- Ledger: 18 envios (16 com o e-CPF no TLS e 2 com o e-CNPJ do transmissor, autorização e consulta) e 11 assinaturas locais (6 notas enviadas e 5 de dry-run), com CPF, IE e chave mascarados.
- Consulta cadastro: o DF não tem o serviço em nenhum autorizador (a tabela da SVRS de homologação só lista AC, ES, RN, PB e SC). A IE veio da cópia local da base do integrador em produção.

## Resultados (Node 26.3)

| Operação | Resultado |
|---|---|
| `statusServico` SVRS e SVC-AN com cUF 53 | 107 e 107 |
| Autorização, CST 00 (nota base) | lote 104, protocolo **100** |
| `consultar` (então `consultarProtocolo`) da nota base | 100, `digVal` confere com a NF-e assinada |
| Autorização, CST 40 com `vICMSDeson` e `motDesICMS` 3, cBenef DF814087 | **100** |
| Autorização, CST 30 com ST, `vICMSDeson` e `motDesICMS` 9, cBenef DF814087 | **100** |
| Autorização, CST 70 com redução, ST, `vICMSDeson` e `motDesICMS` 9, cBenef DF816038 | **100** |
| Autorização, CST 20 com redução, `vICMSDeson` e `motDesICMS` 9, cBenef DF816038 (controle) | **100** |
| Autorização assinada pelo e-CPF e transmitida com o e-CNPJ de terceiro no TLS | **100**; `consultar` (então `consultarProtocolo`) pelo mesmo transmissor: 100 |
| CC-e seq 1 e seq 2 na nota base | 135 e 135; a consulta depois lista 2 eventos |
| Cancelamento da nota CST 20 | 135; a consulta depois dá 101 "Cancelamento de NF-e homologado" |
| `distribuicaoDFe` no AN pelo CPF, `distNSU` 0, TLS com o e-CPF | 137 "Nenhum documento localizado", `ultNSU` = `maxNSU` = 0 |
| mesma consulta, cerca de 20 minutos depois | 656 "Consumo indevido" (espera de 1 hora depois de um 137) |

6 das 12 tentativas de autorização do orçamento, todas aceitas na primeira vez. Nenhum bug de pacote apareceu e nada foi corrigido nos pacotes.

Todas as notas: série 920 (faixa do emitente pessoa física, a mesma que o integrador em produção usa), PL_010f, CRT 3 como o integrador manda para este produtor, destinatário igual ao emitente como contribuinte com IE e o nome literal de homologação posto pelo builder, um item de R$ 100,00 (NCM 10059010, CFOP 5101), PIS e COFINS 49 zerados e IBS/CBS pela calculadora padrão do `@sinete/nfe` (CST 000, cClassTrib 000001, CBS 0,9% e IBS UF 0,1% sobre R$ 100,00). Antes de cada envio: schema do builder, `conferirAssinatura` e `xmllint` contra o `nfe_v4.00.xsd` oficial. Os cBenef são da tabela do DF (Anexo do Ato Declaratório 4/2023): DF814087 vale para CST 30 e 40, DF816038 para CST 20 e 70.

## O que isso muda

- **Primeira NF-e autorizada pelo sinete** (builder, assinatura e cliente dos pacotes publicados), e com emitente CPF, série 920, CRT 3 e o grupo IBS/CBS calculado pelo próprio pacote.
- **A correção do `motDesICMS` do integrador em produção é válida na SEFAZ.** Os grupos com o conteúdo que o integrador manda depois da correção (CST 40 com motivo 3; CST 30, 70 e 20 com motivo 9, sem zero à esquerda) foram autorizados pela SVRS. Antes, `03` e `09` viravam motivo 1 na montagem antiga, que nem existe no domínio do ICMS30 e do ICMS70.
- **Transmissor terceiro funciona na SVRS.** O certificado do TLS não precisa ser do emitente: a SVRS autorizou e respondeu à consulta com o e-CNPJ de um terceiro no TLS e a assinatura do e-CPF do emitente na nota.
- **Eventos do emitente na SVRS** (CC-e com sequência e cancelamento) funcionam com autor CPF, e a consulta protocolo reflete os eventos.
- **Distribuição DF-e não devolve ao emitente as próprias notas.** Mesmo com o CPF do emitente também como destinatário, o AN respondeu 137. Não dá para saber se é regra (o AN não distribui ao emitente) ou atraso da indexação: a segunda consulta caiu no 656, e o sinete não protege contra consultar de novo antes de 1 hora depois de um 137. Isso fica como lacuna do `distribuicaoDFe` (a espera é do chamador) e como teste a repetir.
- Só a folha no TLS de novo bastou, agora também para um e-CPF e no AN.

## O que não foi coberto

Manifestação (não se aplica ao emitente), inutilização (não se aplica a emitente pessoa física), recibo assíncrono, contingência com emissão, Bun e Deno nesta rodada, e MDF-e: o `@sinete/mdfe` ainda não emite, e a base do integrador em produção mostra 0 MDF-e emitidos por este produtor.
