# sinete

## 0.1.0

### Minor Changes

- 515861a: `sinete agents-md`: faz upsert do bloco do sinete no `AGENTS.md` do projeto, entre `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`, sem tocar no resto, e cria o `CLAUDE.md` com `@AGENTS.md` se não existir. O bloco manda o agente de código ler a documentação embarcada da versão instalada, dá as regras que evitam nota duplicada e um índice curto dos pacotes. `CliIo` ganha `writeFile` opcional (sem ela, o `agents-md` sai com código 2); `upsertBloco` e `BLOCO_AGENTS` estão exportados.
- 515861a: `sinete agents-md` também instala a skill `sinete` (`SKILL.md` no formato Agent Skills) em `.claude/skills/sinete/` (Claude Code) e `.agents/skills/sinete/` (Codex e outras ferramentas do padrão), como complemento do bloco do `AGENTS.md`: a skill manda o agente ler a documentação embarcada da versão instalada, sem duplicá-la. O comando a atualiza a cada execução enquanto ela traz a linha `<!-- sinete-skill: ... -->`; um `SKILL.md` que já existe sem a linha é do projeto e é mantido. `--sem-skill` não instala nem atualiza; `--imprimir` segue só mostrando o bloco. `upsertSkill`, `SKILL_SINETE`, `DIRETORIOS_SKILL` e `MARCADOR_SKILL` estão exportados.
- 515861a: `SineteError` ganha `docs`, o caminho da página do código na documentação embarcada (`erros/<code>.md`, relativo a `node_modules/sinete/docs/`), como propriedade própria e no `toJSON`; `paginaDoErro(code)` monta o caminho.
- 515861a: Novo subpath `@sinete/da/nfse` (e `sinete/da/nfse`): `danfse` gera o DANFSe v2 da NFS-e Nacional pela NT SE/CGNFS-e 008/2026 v1.02, em PDF e HTML, a partir do `NFSe` autorizado nos pacotes de esquemas 1.01 de 20260209 e de 20260727. A4 retrato numa página só, QR Code da consulta pública com a chave, "NFS-e SEM VALIDADE JURÍDICA" em produção restrita e marcas d'água de cancelada e substituída pelo evento registrado (`cancelamento`, `substituicao`) ou por `true`; canhoto opcional e `nomeMunicipio` para os endereços. O `TextOp` do modelo ganha `rgb`, opcional, para o texto em cor que a NT pede; os outros documentos não mudam.
- 515861a: Documentação embarcada: a contingência automática no guia de contingência, na NFC-e, na retomada e no store SQL (tabela e métodos para o PostgreSQL), e uma regra nova no bloco do `AGENTS.md`. A NF-e só vai à SVC ativada pela SEFAZ de origem (107 no status da SVC), e a NFC-e off-line não depende de ativação.
- 515861a: A documentação de uso vai no pacote, em `docs/` (`node_modules/sinete/docs/`, `node_modules/@sinete/emissor/docs/`): tutorial da primeira NF-e em homologação contra a SEFAZ simulada, guias de como fazer (store em SQL com a suíte de contrato, retomada, contingência, cancelamento, CC-e, MDF-e com encerramento, NFS-e, IBS/CBS, browser com transmissão no servidor, documentos auxiliares, ocorrências de validação), explicações, a referência gerada dos tipos, uma página por código de erro e o bloco do `AGENTS.md`.
- 515861a: Documentação embarcada: guia "Como emitir NFC-e" (regras do modelo 65, QR Code versões 2 e 3, contingência off-line), a contingência com a NFC-e off-line e o bloco do `AGENTS.md` com a NFC-e e os nomes novos do `sinete/nfe`.
- 515861a: O DANFSe passa a ser gerado localmente, pelo `@sinete/da/nfse`, porque a API de geração do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026) e responde 404.
  
  Mudança de API no emissor de NFS-e (`@sinete/emissor/nfse`): `pdf(chave)`, que pedia o PDF ao ADN e devolvia `Promise<Uint8Array | undefined>`, virou `pdf(nfse, opcoes?)`, que recebe o XML da NFS-e (o `proc` do desfecho autorizado), gera o DANFSe v2 sem ir à rede e devolve `Promise<Uint8Array>`. Novos: `pdfCancelado(nfse, evento, opcoes?)`, com a marca de cancelada ou substituída pelo evento registrado, e `pdfPorChave(chave, opcoes?)`, que consulta a NFS-e e os eventos de cancelamento na Sefin e gera com a marca (`undefined` se a Sefin não conhece a chave). A opção `da` aceita o módulo `@sinete/da/nfse`, como nos emissores de NF-e e MDF-e.
  
  Remoção no `@sinete/nfse`: o `NfseClient` não tem mais o `obterDanfse`. Quem o chamava gera o DANFSe com `danfse` de `@sinete/da/nfse` a partir do XML da NFS-e.
- 515861a: Ocorrências de validação classificadas pela fase em que nasceram (ADR 0011): `ValidationIssue.origem` é `entrada` quando a conferência foi sobre a entrada do domínio (o `path` é da entrada e corrigir o valor ali resolve) e `montagem` quando foi sobre o que o sinete produziu (XML contra o XSD e o PL, chave gerada, grupo IBS/CBS da calculadora, regras da NT). `buildNfe`, `buildMdfe` e `buildDps` sempre preenchem; o campo é opcional no tipo, então quem constrói ocorrências fora do sinete não quebra. A calculadora de IBS/CBS pode marcar a origem das próprias ocorrências; sem marca, entram como `montagem`.
  
  `rotuloDoCaminho(path)` no `@sinete/nfe` e no `@sinete/mdfe` dá o rótulo em português do caminho de uma ocorrência (`Item 2, Descrição do produto`, `Condutor 1, CPF`), para os caminhos da entrada e do documento montado, inclusive os do validador de XSD. O mecanismo fica no `@sinete/core` (`normalizarCaminho`, `criarRotuloDoCaminho`) para os outros documentos.
- 515861a: A API de geração do DANFSe do ADN, suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026), sai dos dados e do simulador. Mudança de API: `NfseApi` do `@sinete/transport` não tem mais `'danfse'`, e o `nfseEndpoint` não resolve mais essa base; no `@sinete/sefaz-sim`, `NFSE_SIM_PREFIXOS` perde a chave `danfse`, `NfseRota` perde a rota `'danfse'` e o `GET /danfse/{chave}` passa a responder 404. O DANFSe v2 sai do XML da NFS-e pelo `@sinete/da/nfse`.
- 515861a: Novo `sinete/emissor` com os subpaths `sinete/emissor/nfe`, `/mdfe`, `/nfse`, `/memoria` e `/contrato`, que reexportam o `@sinete/emissor`; os emissores de poucas linhas (`createNfeEmissor`, `createMdfeEmissor`, `createNfseEmissor`) estão lá, não em `sinete/nfe`, `sinete/mdfe` e `sinete/nfse`. Acompanha as renomeações do ADR 0009 nos clientes.
- 515861a: Primeira versão do guarda-chuva `sinete`: um pacote só, sem entrada raiz, com um subpath por entrada dos `@sinete/*` (`sinete/nfe`, `sinete/nfe/ibs-cbs`, `sinete/mdfe`, `sinete/nfse`, `sinete/da` e `sinete/da/nfe`, `/nfce`, `/mdfe`, `/cce`, `sinete/ibs-cbs` e os subpaths, `sinete/ibs-cbs-dados`, `sinete/validators`, `sinete/cert`, `sinete/transport`, `sinete/rejeicoes`, `sinete/schemas/...`, `sinete/core` e `sinete/core/xml`), cada um reexportando o pacote correspondente, e o bin `sinete` com a CLI. As versões dos `@sinete/*` vão fixadas, então cada versão do guarda-chuva é um conjunto testado junto. Sobe de `0.0.0`, o marcador já publicado no npm.
- 515861a: Novo subpath `@sinete/transport/signer` (e `sinete/transport/signer`): cliente do helper nativo `sinete-signer` para certificado A3 em token PKCS#11, A3 em nuvem de PSC, OpenBao Transit e `CryptoKey` não exportável. `startSigner` sobe o binário, `connectSigner` conecta no socket Unix, `connectSignerChannel` fala o protocolo sobre qualquer canal; `openRemote` aplica a política do dono da chave e `openPkcs11` devolve também o `documentSigner`, que assina XML pelo `dfe.sign` validado pelo helper; `certificadoAberto` monta o certificado que o `@sinete/emissor` aceita. Falhas do helper viram os `TransportError` de sempre (`classifyHelperFailure`) ou o novo `SignerError` (`signer_indisponivel`, `signer_protocolo`, `assinatura_tls_recusada`, `assinatura_tls_expirou`, `pkcs11_falhou`, `assinatura_documento_recusada`). `TlsInfo` ganha `signatures`.
  
  Mudança incompatível: `TlsIdentity` fica com `pem` e `helper`. Os tipos `external` e `pkcs11`, que só lançavam `UnsupportedError`, saíram; use `openRemote` e `openPkcs11`, que devolvem a identidade `helper`. `TlsSignContext.purpose` passa a ser `'tls12-client-certificate-verify'`, o valor do protocolo.

### Patch Changes

- 515861a: A documentação embarcada acompanha a API nova do emissor: guia de como emitir por vários emitentes no mesmo servidor (certificado aberto, pool com `chave`, `aoDecidir` e `jaGuardado` por chamada, entrada preparada), os desfechos `ja-guardado`, `anterior` e `situacaoPosterior` na retomada e na explicação dos bytes, e o bloco do `AGENTS.md` com a entrada preparada e o `abrirCertificado`.
- 515861a: Documentação embarcada: as regras do destinatário conferidas antes do envio, no guia das ocorrências de validação; o tutorial passa a informar o endereço do destinatário da NF-e (RV E05-10).
- 515861a: Documentação embarcada: a inutilização não existe na SVC e fica para o ambiente normal da UF, no guia de contingência.
- 515861a: A barreira da recusa repetida passa a contar (ADR 0012): a mesma recusa (mesmo conteúdo e mesmo `cStat`) volta à SEFAZ até o limite dentro da janela, e só a tentativa seguinte lança `RecusaRepetidaError`. Novo `recusaRepetida.limite`, 3 por padrão (a 4ª tentativa igual não sai); a janela conta desde a primeira recusa da sequência. Assim o reenvio depois de resolver a causa fora da nota (o credenciamento do emitente, 203) passa sem `reenviarRecusado`. Quebra para quem implementou o store: `registrarRecusa` recebe `janelaMs` e conta a sequência numa instrução atômica (mesma recusa dentro da janela soma 1, outra ou a janela vencida recomeça em 1), `recusaRecente` filtra pela primeira da sequência e `RecusaRegistrada` ganha `vezes` e `primeiraEm`; o guia `store-sql.md` traz a tabela com as colunas novas. `details` do erro ganha `primeiraEm`, `vezes` e `limite`. A suíte de contrato ganha os casos da conta.
- 515861a: Barreira da recusa repetida (ADR 0012): com um `TransmissaoStore` que implementa os novos métodos opcionais `registrarRecusa` e `recusaRecente`, o emissor lembra o SHA-256 dos bytes descartados por uma recusa da SEFAZ e lança `RecusaRepetidaError` (`recusa_repetida`), antes de gravar e sem ir à SEFAZ, quando a mesma `ref` montaria os mesmos bytes dentro da janela (1 hora por padrão, `recusaRepetida: { janelaMs }` ou `false`). Evita o bloqueio por consumo indevido (rejeição 656). A nota corrigida e a retomada de bytes gravados nunca são barradas; a recusa do serviço (108, 109, 999) não conta; `emitir(ref, entrada, { reenviarRecusado: true })` envia depois de uma correção fora da nota. O store em memória implementa os dois métodos; store com um só lança `ConfigError`. A suíte de contrato ganha três casos, incluídos por padrão: o adaptador sem os métodos passa `recusas: false`. `PerfilDocumento` ganha `transitorio` opcional.
  
  O emissor da NF-e confere o certificado antes de assinar: sem CNPJ nem CPF, `ConfigError` (rejeição 282); emitente de outro CNPJ-base ou CPF, `ValidationError` com `emitente_difere_do_certificado` (213, 227).
- 515861a: A montagem confere regras da SEFAZ que só dependem do documento e voltavam como rejeição (ADR 0012), com `origem: 'entrada'`: série de emitente CNPJ de 0 a 889 (RV C02-30 e B26-10, rejeições 503 e 244), CST 50 ou 51 com destinatário contribuinte isento fora das exceções (RV N12-80, 529), duplicata sem vencimento ou vencendo antes da emissão (Y09-20, 900) ou da parcela anterior (Y09-30, 850) e parcela única vencendo na emissão (NT 2025.001 v1.03, Y09-40, 853). Novo `conferirEmitenteDoCertificado` (RV F03 e F03A) e o código `emitente_difere_do_certificado`. O cliente recusa, antes de enviar, o autor explícito de cancelamento, cancelamento por substituição e CC-e diferente do emitente da chave (`autor_difere_do_emitente`, RV P12-44, 574).
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/cert@0.1.0
  - @sinete/cli@0.1.0
  - @sinete/nfe@0.1.0
  - @sinete/transport@0.1.0
  - @sinete/core@0.1.0
  - @sinete/da@0.1.0
  - @sinete/mdfe@0.1.0
  - @sinete/emissor@0.1.0
  - @sinete/nfse@0.1.0
  - @sinete/ibs-cbs-dados@2026.9.1
  - @sinete/ibs-cbs@0.1.0
  - @sinete/rejeicoes@0.1.0
  - @sinete/schemas@0.1.0
  - @sinete/validators@0.1.0
