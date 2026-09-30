# Documentação

| Documento | Leia quando |
|---|---|
| [guia/](guia/index.md) | for usar o sinete ou mexer na documentação embarcada: é a doc que vai em `node_modules/sinete/docs/` e `node_modules/@sinete/emissor/docs/` (tutorial, como fazer, explicação, referência gerada, uma página por código de erro, bloco do `AGENTS.md`) |
| [adr/](adr/) | for mudar tooling, codegen, XMLDSig, TLS, helper nativo, DANFE, dados de IBS/CBS, a divisão dos pacotes ou os verbos dos clientes: a decisão e a evidência medida estão lá |
| [adr/0001-tooling-monorepo.md](adr/0001-tooling-monorepo.md) | for mexer em build, testes, smoke, CI, formato de pacote ou publicação |
| [adr/0002-codegen-xsd.md](adr/0002-codegen-xsd.md) | for trabalhar em `@sinete/schemas`, no serializer ou numa NT nova |
| [adr/0003-xmldsig-c14n.md](adr/0003-xmldsig-c14n.md) | for trabalhar em `@sinete/core/xml`, assinatura ou `@sinete/cert` |
| [adr/0004-tls-transporte.md](adr/0004-tls-transporte.md) | for trabalhar em `@sinete/transport`, endpoints ou erros de TLS |
| [adr/0005-signer-tls-nativo.md](adr/0005-signer-tls-nativo.md) | for trabalhar no helper Go (`helpers/signer-tls/`), A3 ou assinatura delegada |
| [adr/0006-danfe.md](adr/0006-danfe.md) | for trabalhar em `@sinete/da` (documentos auxiliares) |
| [adr/0007-rtc-dados-e-oraculo.md](adr/0007-rtc-dados-e-oraculo.md) | for trabalhar no `@sinete/ibs-cbs`, no `@sinete/ibs-cbs-dados` ou no oráculo da Calculadora |
| [adr/0008-divisao-de-pacotes.md](adr/0008-divisao-de-pacotes.md) | for criar, juntar ou dividir um pacote, ou acrescentar um subpath: os critérios e o porquê de cada divisão atual |
| [adr/0009-verbos-e-caminho-curto.md](adr/0009-verbos-e-caminho-curto.md) | for nomear um método de cliente de documento, mexer nos verbos dos emissores (`create*Emissor`, hoje no `@sinete/emissor`) ou começar um documento novo: os verbos comuns, as diferenças de protocolo que ficam e o mapa das renomeações |
| [adr/0010-fronteira-emissor.md](adr/0010-fronteira-emissor.md) | for decidir se algo vai para um pacote de documento ou para o `@sinete/emissor` (estado, trava, retomada, pool), ou mexer nos emissores curtos: o critério 5 de divisão, os peers opcionais por subpath e a troca do `aoAssinar` pelo `TransmissaoStore` |
| [adr/0011-origem-e-rotulo-das-ocorrencias.md](adr/0011-origem-e-rotulo-das-ocorrencias.md) | for mexer em ocorrências de validação (`Ocorrencia`), no coletor de um montador ou em `rotuloDoCaminho`: quando uma ocorrência é `entrada` ou `montagem`, e o rótulo em português dos caminhos |
| [adr/0012-pre-validacao-pelas-rejeicoes-reais.md](adr/0012-pre-validacao-pelas-rejeicoes-reais.md) | for pré-validar uma regra da SEFAZ, curar a dica de uma rejeição ou mexer na barreira da recusa repetida: o critério do que se recusa antes de enviar, a classificação de cada rejeição real e os métodos opcionais de recusa do `TransmissaoStore` |
| [adr/0013-contingencia-automatica.md](adr/0013-contingencia-automatica.md) | for mexer na contingência automática do emissor (SVC da NF-e, NFC-e off-line): o que conta como falha do autorizador, onde fica o estado, a sonda da volta e por que os bytes gravados nunca mudam de tipo de emissão |
| [adr/0014-distribuicao-do-signer.md](adr/0014-distribuicao-do-signer.md) | for mexer no cliente `@sinete/transport/signer`, nos pacotes npm do helper (`@sinete/signer` e os de plataforma) ou no build e na release dos binários |
| [adr/0015-nomes-em-portugues.md](adr/0015-nomes-em-portugues.md) | for dar nome a qualquer coisa pública (função, tipo, propriedade, valor de união): o glossário inglês → português e as exceções |
| [validacao-homologacao.md](validacao-homologacao.md) e [../tools/homologacao/README.md](../tools/homologacao/README.md) | for saber o que já foi provado contra a SEFAZ de homologação real, ou rodar a validação com o seu certificado |
| [release.md](release.md) | for versionar ou publicar pacotes |
| [../packages/core/README.md](../packages/core/README.md) | for usar erros, desfechos da SEFAZ, relógio, logger, ambiente ou UFs em outro pacote |
| [../packages/validators/README.md](../packages/validators/README.md) | for validar CPF, CNPJ alfanumérico, CAEPF, chave de acesso ou IE, ou mexer nas regras de IE por UF (`src/data/ie.json`) |
| [../packages/rejeicoes/README.md](../packages/rejeicoes/README.md) e [../tools/rejeicoes-data/README.md](../tools/rejeicoes-data/README.md) | for consultar rejeições (inclusive os códigos de erro da NFS-e), enriquecer um desfecho `recusado` ou regenerar o catálogo a partir dos PDFs e planilhas oficiais |
| [../packages/cert/README.md](../packages/cert/README.md) | for ler PFX, extrair CNPJ/CPF, montar a cadeia ICP-Brasil ou assinar com A1 |
| [../packages/transport/README.md](../packages/transport/README.md) | for enviar para a SEFAZ, resolver endpoints, escrever uma `HostPolicy` ou entender por que o Deno recusa um host |
| [../packages/sefaz-sim/README.md](../packages/sefaz-sim/README.md) | for testar um fluxo de DF-e contra a SEFAZ simulada (em processo ou HTTPS com mTLS), injetar falhas de rede ou acrescentar uma regra de rejeição ao simulador (NF-e e NFS-e Nacional) |
| [../packages/cli/README.md](../packages/cli/README.md) | for diagnosticar certificado, cadeia, relógio e TLS com `sinete doctor` |
| [../packages/da/README.md](../packages/da/README.md) | for gerar DANFE, DANFC-e, DAMDFE ou DACCe, ou escolher o subpath de um documento |
| [../packages/sinete/README.md](../packages/sinete/README.md) | for usar o guarda-chuva `sinete` (um pacote, um subpath por `@sinete/*`) ou mexer no gerador `scripts/umbrella.ts` |
| [signer-contract/README.md](signer-contract/README.md) | for trabalhar no contrato NDJSON entre o cliente TS e o helper `sinete-signer` (`PROTOCOL.md` é a parte normativa) |
| [../helpers/signer-tls/README.md](../helpers/signer-tls/README.md) | for compilar, testar ou rodar o helper `sinete-signer` (flags, sabores, laboratório com SoftHSM) |
| [../packages/core/README.md](../packages/core/README.md) (seção `@sinete/core/xml`) | for parsear, canonicalizar, assinar ou verificar XML de DF-e |
| [../packages/schemas/README.md](../packages/schemas/README.md) | for serializar, decodificar ou validar um documento, ou escolher o PL por vigência |
| [../packages/emissor/README.md](../packages/emissor/README.md) | for emitir NF-e, MDF-e ou NFS-e em poucas linhas (`createNfeEmissor` e os outros subpaths), implementar o `TransmissaoStore` do seu banco e rodar a suíte de contrato, agendar a retomada automática (`retomarPendentes`), usar o pool de emissores por certificado ou entender o que o emissor faz com os bytes depois de cada resposta |
| [../packages/nfe/README.md](../packages/nfe/README.md) | for montar, assinar ou autorizar uma NF-e peça por peça, entender como a calculadora padrão de IBS/CBS (`ibsCbsCalculator`) escolhe base, local e datas, trocá-la (`IbsCbsCalculator`), usar o motor pelo `@sinete/nfe/ibs-cbs`, tratar envio sem resposta ou rodar a checagem do builder contra o corpus |
| [../packages/nfse/README.md](../packages/nfse/README.md) | for montar e emitir uma NFS-e Nacional peça por peça, registrar eventos, consultar parâmetros municipais ou saber quais caminhos da Sefin e do ADN foram observados e quais vêm só do Swagger |
| [../tools/xsd-codegen/README.md](../tools/xsd-codegen/README.md) | for regenerar os schemas, trazer uma NT nova ou rodar as checagens do corpus |
| [../tools/fontes-oficiais/README.md](../tools/fontes-oficiais/README.md) | for saber o que os portais oficiais publicaram desde a última atualização, fechar a issue do vigia ou vigiar uma página nova |
| [../packages/ibs-cbs-dados/README.md](../packages/ibs-cbs-dados/README.md) e [../tools/ibs-cbs-dados/README.md](../tools/ibs-cbs-dados/README.md) | for consultar CST, cClassTrib, anexos ou atores do IBS/CBS numa data, carregar um dataset em runtime, ou regenerar e comparar o dataset a partir da Calculadora e do IT |
| [../packages/ibs-cbs/README.md](../packages/ibs-cbs/README.md) | for saber qual alíquota do IBS e da CBS vale numa data (`/aliquotas`), calcular IBS e CBS de uma operação classificada (`/calcular`), validar os grupos pelas regras da NT 2025.002 (`/validar`) ou chegar ao CST e cClassTrib de um item a partir de fatos de negócio (`/determinar`) |
| [../tools/ibs-cbs-oraculo/README.md](../tools/ibs-cbs-oraculo/README.md) | for rodar o oráculo da Calculadora, regravar as fixtures do motor ou mexer no ledger de divergências |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | antes da primeira PR: regras de origem, DCO e comandos |

O código dos spikes fica em `spikes/` como referência dos ADRs. É descartável: não importe nada dele nos pacotes.
