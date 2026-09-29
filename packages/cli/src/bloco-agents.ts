// GERADO por scripts/docs-gerados.ts a partir de docs/guia/bloco-agents.md. Não edite: rode `bun scripts/docs-gerados.ts`.
/** O bloco do sinete para o `AGENTS.md` do integrador, com os marcadores. */
export const BLOCO_AGENTS: string = `<!-- BEGIN:sinete-agent-rules -->
## sinete: regras para agentes de código

Este projeto usa o sinete (DF-e brasileiros em TypeScript: NF-e, NFC-e, MDF-e, NFS-e Nacional). A API muda entre versões e o domínio (MOC, NT, cStat) é pouco coberto no treino: o que você lembra pode estar errado. **Antes de escrever código com \`sinete\` ou \`@sinete/*\`, leia a documentação da versão instalada** em \`node_modules/sinete/docs/\` (ou \`node_modules/@sinete/emissor/docs/\`), começando pelo \`index.md\`. Os \`.d.ts\` em \`node_modules/@sinete/*/dist/\` são a palavra final sobre nomes e assinaturas. Não invente campo, método nem código de erro.

### Regras que evitam nota duplicada

- Emita, retome e cancele pelo emissor (\`sinete/emissor/nfe\`, \`/mdfe\`, \`/nfse\`), com um \`TransmissaoStore\` sobre o banco da aplicação (\`docs/como-fazer/store-sql.md\`) validado pela suíte \`sinete/emissor/contrato\`. Não monte orquestração própria sobre \`createNfeClient\` e afins.
- Nunca remonte documento assinado ainda sem desfecho definitivo. Depois de um envio sem resposta, retome com os mesmos bytes: \`emitir(ref, ...)\` com a mesma \`ref\` (ele acha os bytes gravados e ignora a entrada) ou \`retomar(ref)\`. Remontar gera outro cNF e outro dhEmi: 539 ou uma segunda nota para o mesmo número.
- \`ref\` é o id estável do documento no sistema (o pedido, o rascunho), igual em todas as tentativas.
- Nunca altere, reformate, parseie e reserialize o XML assinado nem o \`proc\`. Guarde a string como veio, em coluna de texto.
- \`aoDecidir\` é idempotente (upsert por \`ref\`): roda de novo depois de uma queda. Vai no emissor ou em cada chamada (\`emitir(ref, entrada, { aoDecidir, jaGuardado })\`); o \`jaGuardado\` compara a chave (\`registro.id\`), não só a \`ref\`.
- Conferências que dependem do banco (o rascunho ainda é rascunho) vão na entrada preparada, \`emitir(ref, async () => ({ entrada, meta }))\`, que roda com a trava; nunca antes do \`emitir\`.
- \`pendente\` não é falha: os bytes ficam e o job \`retomarPendentes\` continua. \`divergente\` pede uma pessoa. Nenhum dos dois autoriza emitir outro documento.
- Não apague bytes gravados à mão para destravar a tela; o documento pode estar autorizado na SEFAZ.
- Contingência da NF-e e da NFC-e: deixe o emissor decidir (\`contingencia: { automatica: true }\`, \`aoMudarContingencia\`) ou ponha \`contingencia\` na entrada (a NF-e só vai à SVC com a SVC ativada pela SEFAZ da UF: 107 no status da SVC); nunca reassine em contingência uma nota pendente de emissão normal (é vedado reutilizar o número, e a UF pode tê-la autorizado).
- \`sinete/emissor/memoria\` é só para testes e scripts de um processo.
- Rejeição da SEFAZ é desfecho (\`tipo: 'recusado'\` no emissor, \`status: 'rejected'\` no cliente), não exceção. Erro lançado é \`SineteError\` com \`code\` estável e \`docs\` (página em \`docs/erros/<code>.md\`): decida pelo \`code\`, nunca pela mensagem.
- Barreira contra 656: implemente \`registrarRecusa\` e \`recusaRecente\` juntos no store. Ligada por padrão; após 3 recusas iguais em 1 hora, barra a próxima emissão do mesmo conteúdo com \`recusa_repetida\`. Corrija a nota; \`reenviarRecusado: true\` nas opções de \`emitir\` só após resolver a causa fora dela. Sem esses métodos, não há barreira.
- Cancelamento e eventos pelo emissor: ele confirma pela consulta quando o pedido fica sem resposta ou volta como duplicidade; não conclua por 573, 580, 631 ou E0840. Na NFS-e, E0840 só vira sucesso com o e101101 recuperado pela consulta (\`recuperado: true\`); sem ele, continua \`recusado\`.
- Testes sem certificado real e sem SEFAZ: \`@sinete/sefaz-sim\` (\`createSefazSim\`, \`syntheticCertificate\`, \`syntheticPfx\`) e \`ambiente: 'homologacao'\`. Senha de PFX vem do ambiente, nunca do código.
- Datas do documento vêm do relógio injetado (\`clock\`, \`timeContext\`), não de \`new Date()\`; em teste, \`manualClock\`.

### Índice (guarda-chuva \`sinete/<pacote>\`; avulso \`@sinete/<pacote>\`)

- \`sinete/emissor/nfe\`: \`createNfeEmissor\` devolve \`.emitir()\`, \`.assinar()\`, \`.retomar()\`, \`.consultar()\`, \`.cancelar()\`, \`.cartaCorrecao()\`, \`.pdf()\`, \`.pdfCancelado()\`, \`.cliente\`, \`.fechar()\`
- \`sinete/emissor/mdfe\`: \`createMdfeEmissor\` devolve \`.emitir()\`, \`.retomar()\`, \`.consultar()\`, \`.cancelar()\`, \`.encerrar()\`, \`.pdf()\`, \`.pdfCancelado()\`
- \`sinete/emissor/nfse\`: \`createNfseEmissor\` devolve \`.emitir()\`, \`.substituir()\`, \`.retomar()\`, \`.consultar()\`, \`.cancelar()\`, \`.pdf()\`, \`.pdfCancelado()\`, \`.pdfPorChave()\`. DANFSe v2 local: \`.pdf()\` recebe o XML da NFS-e (o \`proc\` autorizado); \`.pdfCancelado()\` recebe também o XML do evento registrado. \`pdfPorChave\` consulta a NFS-e e seus eventos (até 5 consultas); chave desconhecida devolve \`undefined\`
- \`sinete/emissor\`: \`retomarPendentes\`, \`createPoolDeEmissores\`, \`abrirCertificado\`, \`destinoDosBytes\`, \`TransmissaoStore\`, \`RegistroTransmissao\`, \`Desfecho\`, \`TravaPerdidaError\`, \`TransmissaoEmAndamentoError\`
- \`sinete/emissor/memoria\`: \`createMemoriaStore\`, \`createBancoMemoria\` (só teste)
- \`sinete/emissor/contrato\`: \`casosDoContrato\`
- \`sinete/nfe\`: \`NfeInput\`, \`buildNfe\`, \`signNfe\`, \`createNfeClient\` (\`.autorizar()\`, \`.consultar()\`, \`.cancelar()\`, \`.cartaCorrecao()\`, \`.manifestar()\`, \`.inutilizar()\`, \`.consultarCadastro()\`, \`.distribuicaoDFe()\`, \`.statusServico()\`), \`resolverEnvioSemResposta\`, \`recuperarEventoRegistrado\`, \`nfeAssinadaDoProc\`, \`autorizadorContingencia\`, \`assinaturaQrCode\`, \`comQrCode\`, \`urlsNfce\`, \`ibsCbsCalculator\`, \`carregarDatasetEmbarcado\`, \`rotuloDoCaminho\`
- \`sinete/nfe/ibs-cbs\`: motor do IBS/CBS reexportado (\`determine\`, \`calculate\`, \`validate\`, \`officialRates\`)
- \`sinete/mdfe\`: \`MdfeInput\`, \`buildMdfe\`, \`signMdfe\`, \`createMdfeClient\` (\`.encerrar()\`, \`.consultarNaoEncerrados()\`), \`conferirPercurso\`, \`sugerirPercurso\`, \`prazoContingencia\`, \`rotuloDoCaminho\`
- \`sinete/nfse\`: \`DpsInput\`, \`buildDps\`, \`signDps\`, \`createNfseClient\` (\`.consultarDps()\`, \`.solicitarAnaliseFiscal()\`), \`resolverEnvioSemResposta\`
- \`sinete/da/nfe\`: \`danfe\`, \`toPdf\`, \`toHtml\`; \`sinete/da/nfce\`: \`danfce\`; \`sinete/da/mdfe\`: \`damdfe\`; \`sinete/da/nfse\`: \`danfse\`; \`sinete/da/cce\`: \`dacce\`
- \`sinete/ibs-cbs\`: \`calculate\`, \`validate\`, \`determine\`, \`officialRates\`, \`withOverrides\`
- \`sinete/ibs-cbs-dados\`: \`loadDataset\`, \`verifyDataset\`; \`/bundled\`: \`bundledDataset\`
- \`sinete/cert\`: \`openPfx\`, \`buildChain\`, \`createA1Signer\`
- \`sinete/transport\`: \`createTransport\`, \`allowlistPolicy\`, \`nfeEndpoint\`
- \`sinete/transport/signer\`: \`startSigner\`, \`certificadoAberto\` (cliente do helper \`sinete-signer\`, distribuído em \`@sinete/signer\`: A3 em token PKCS#11, A3 em nuvem de PSC e chave não exportável)
- \`sinete/validators\`: \`parseCnpj\`, \`parseCpf\`, \`parseIe\`, \`parseChaveAcesso\`, \`isValidCnpj\`
- \`sinete/rejeicoes\`: \`rejeicaoByCode\`, \`enrichRejected\`; \`/nfse\`: \`nfseErroByCode\`
- \`sinete/schemas\`: \`selecionarPl\`, \`decodeXml\`, \`validateRoot\`
- \`sinete/core\`: \`SineteError\`, \`isSineteError\`, \`ValidationError\`, \`matchOutcome\`, \`systemClock\`, \`manualClock\`, \`timeContext\`; \`/xml\`: \`verifySignature\`
- \`@sinete/sefaz-sim\` (dev, fora do guarda-chuva): \`createSefazSim\`, \`createNfseSim\`, \`simTransport\`, \`redirectToSim\`, \`redirectNfseToSim\`, \`syntheticCertificate\`, \`syntheticPfx\`
- CLI: \`npx sinete doctor --pfx <arquivo>\` confere certificado, cadeia, relógio e TLS; \`npx sinete agents-md\` atualiza este bloco e a skill \`sinete\`.

### Onde ler

Tutorial: \`docs/tutorial/primeira-nfe.md\`. Como fazer: \`docs/como-fazer/\` (store-sql, retomada, varios-emitentes, nfce, contingencia, cancelamento, carta-de-correcao, mdfe, nfse, ibs-cbs, browser, documentos-auxiliares, ocorrencias-de-validacao). Por quê: \`docs/explicacao/\`. Referência gerada dos tipos: \`docs/referencia/<pacote>.md\`. Erros: \`docs/erros/<code>.md\`.
<!-- END:sinete-agent-rules -->
`;
