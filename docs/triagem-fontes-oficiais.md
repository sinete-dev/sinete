# Triagem das fontes oficiais

Registro de cada publicação que o vigia (`tools/fontes-oficiais`) acusou: o que ela muda, em que data vale e o que o sinete faz com ela. A regra é a do README do vigia: só vira código a publicação ativa em homologação, ou com a NT na versão que vai valer e tudo o que ela pede já publicado (schemas incluídos). O resto fica aqui com a data em que vira trabalho, e o `estado.json` registra que a publicação foi vista.

Uma seção por data, a mais recente primeiro. O teste do vigia (`tools/fontes-oficiais/test/triagem.test.ts`) confere que toda publicação da seção mais recente está no `estado.json`; as anteriores são histórico, e a versão que o portal substituir sai do estado no próximo `--gravar`.

Classes: **A** ativa em homologação (ou NT final com tudo publicado), vira trabalho agora; **B** com data futura, vira trabalho na data; **C** publicada sem data ou sem schema, espera; **D** não pede mudança no sinete.

## 06/10/2026 (issue #10)

Datas como o documento as dá, com a página ou seção. Todas as versões abaixo, exceto as da NFS-e, foram aprovadas pelo Ato Técnico Conjunto RFB/CGIBS 08/2026 (DOU de 01/10/2026), que inclui também a NT 2026.004 dos outros DF-e.

| Publicação | Tema | Classe | Homologação | Produção | O que o sinete faz |
|---|---|---|---|---|---|
| NT 2025.002 v1.52 | RTC NF-e e NFC-e | A | até 05/10/2026 (histórico, p. 6) | até 03/11/2026; VC02-14 passou de 05/10 para 03/11/2026 | Tirar a UB14-40, que a v1.52 removeu sem registrar no histórico: #34. UB16-10 segue "implementação futura" (p. 43). PL_010f inalterado |
| NT 2026.009 v1.00 | I08-140 (327): CFOP 1.949 e 2.949 em qualquer devolução | A | até 17/09/2026 (p. 3) | até 17/09/2026 | Corrigir a dica curada da 327: #35. O sinete não pré-valida a I08-140 |
| NT 2026.007 v1.10 | Contribuinte exclusivo do IBS/CBS, autorização na SVRS | A | v1.00 desde 01/09/2026; v1.10 até 05/10/2026 (p. 3) | 03/11/2026 | Roteamento para a SVRS, rejeições 156 a 188 no catálogo, pré-validação, `vigencia.json`: #36 |
| NT 2026.002 v1.11 | DANFE simplificado Tipo 2, autorização com alerta | A | regras da v1.10 desde 01/09/2026 | I08-180, BA02-35 e VC02-40 adiadas de 05/10 para 14/12/2026 (p. 3) | A v1.11 só adia e tira do texto a ZX01-10 (393). Lacuna anterior: NF-e com tpImp 6 sai sem QR Code: #37 |
| NT 2026.010 v1.00 | Leiaute do DANFE da reforma tributária | A (NT final, usa só o PL_010f) | não se aplica ("-", p. 3) | 01/12/2026 | Bloco do IBS/CBS/IS, CRT e campos por item no `@sinete/da`: #38 |
| IT 2025.002 v1.70 | Tabelas cClassTrib e cCredPres | B | até 16/10/2026 (p. 3) | até 16/10/2026 | Trocar o pin do `tools/ibs-cbs-dados` a partir de 16/10/2026: #39 |
| NT 2026.006 v1.00 | Split payment: grupo YC e evento 110300 | C | 05/10/2026 (p. 3) | 03/11/2026, sem preenchimento exigido em 2026 | Nenhum PL com `gPgtoVinc` nem o `e110300_v1.00.xsd` publicado em 06/10/2026, e o Ato Técnico 08/2026 não a inclui. Vira trabalho quando sair o PL |
| NT 2026.008 v1.00 | Valor líquido do produto (vUnComLiq, vProdLiq, grupo NB, vProdLiqTot) | C | 05/10/2026; NB01-30 em 01/02/2027 (p. 3) | 03/11/2026; NB01-30 em 01/03/2027 | Sem schema publicado. Remove a UB16-10 ("Regra removida", p. 8), que é a pendência que segura o `@sinete/ibs-cbs` na 1.0: quando o PL sair, a base do IBS/CBS deixa de esperar norma. Vira trabalho com o PL |
| NFS-e NT 009 v1.01, Anexo VI v1.04.01, Anexo VII v1.03.00 | Leiaute da reforma tributária na DPS | C | sem data ("será publicado no portal da NFS-e o cronograma", p. 3) | sem data | Muda o grupo IBS/CBS da DPS (finNFSe e destinatário para o `infDPS`, CST e cClassTrib em `trib`, ajuste de base, `gPgtoVinc`, condomínios). A produção restrita segue no XSD 1.01-20260727. Vira trabalho com o cronograma e o XSD |
| NT 2014.001 v1.41 | EPEC | D | 09/09/2026 (p. 4) | 05/10/2026 | Só corrige o número da rejeição da P14-20; a v1.40 vetou EPEC para PR e PB. O sinete não emite EPEC (ADR 0013) |
| NT 2021.003 v1.50 | GTIN da construção civil (grupo V) | D | 01/04/2027 (p. 3) | 01/09/2027 | A SEFAZ confere no cadastro CCG; nada no sinete |
| IT 2025.004 v1.20 | Índice de mistura de biocombustível (pBio) | D | não se aplica | gasolina comum a 32% desde 01/08/2026 (p. 5) | Monofasia não é suportada pelo `@sinete/ibs-cbs` |
| Ato Técnico Conjunto 08/2026 | Aprovação RFB/CGIBS das versões acima | D | não se aplica | em vigor desde 01/10/2026 | Confirma quais versões valem |

O que ficou sem conferir nesta triagem: as planilhas da IT 2025.002 v1.70 e dos Anexos VI e VII da NFS-e (só identificadas; o conteúdo entra pelo pipeline de dados na data), a comparação palavra a palavra da NFS-e NT 009 v1.01 com a v1.0, e se a SVRS de homologação já aceita os campos das NT 2026.006 e 2026.008 ou já atende cUF 35 (pede envio com certificado). A página da reforma tributária da NFS-e também lista uma NT SE/CGNFS-e 010 v1.00 (NFS-e Via e manifestação do adquirente, 02/10/2026) que o vigia não acusou: #40.
