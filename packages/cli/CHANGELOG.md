# @sinete/cli

## 0.2.2

### Patch Changes

- Updated dependencies [4ba29b8]
- Updated dependencies [30d6381]
  - @sinete/cert@0.2.2
  - @sinete/transport@0.3.0

## 0.2.1

### Patch Changes

- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/core@0.3.0
  - @sinete/cert@0.2.1
  - @sinete/transport@0.2.1

## 0.2.0

### Minor Changes

- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Mudanças de comportamento:
  
  - Flags do `doctor`: `--allow-expired` → `--aceitar-vencido` e `--ca` → `--ac`. Os comandos `doctor` e `agents-md` ficam (nome próprio).
  - Saída JSON do `doctor`: `checks` → `verificacoes`, `status` → `situacao`, `message` → `mensagem`, `details` → `detalhes`, e as chaves dos detalhes em português (`diasRestantes`, `cadeia`, `situacao`, `vencidos`, `desvioSegundos`, `fonte`, `protocolo`, `cifra`, `certificadoDoCliente`, `statusHttp`). `notBefore` e `notAfter` ficam, como na RFC 5280.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `upsertBloco` | `aplicarBloco` |
  | `upsertSkill` | `aplicarSkill` |
  | `CheckStatus` | `SituacaoDaVerificacao` |
  | `DoctorCheck` | `VerificacaoDoDoctor` |
  | `DoctorOptions` | `DoctorOpcoes` |
  | `DoctorReport` | `RelatorioDoDoctor` |
  | `formatCnpj` | `formatarCnpj` |
  | `maskCpf` | `mascararCpf` |
  | `maskCpfs` | `mascararCpfs` |
  | `parseHttpDate` | `lerDataHttp` |
  | `runDoctor` | `rodarDoctor` |
  | `openKeyStore` | `abrirCertificado` |
  | `CliIo` | `EntradaSaidaCli` |
  | `formatReport` | `formatarRelatorio` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `EntradaSaidaCli` | `out.line` | `saida.linha` |
  | `EntradaSaidaCli` | `err.line` | `erro.linha` |
  | `EntradaSaidaCli` | `promptPassword.question` | `pedirSenha.pergunta` |
  | `EntradaSaidaCli` | `readFile.path` | `lerArquivo.caminho` |
  | `EntradaSaidaCli` | `writeFile.path` | `gravarArquivo.caminho` |
  | `EntradaSaidaCli` | `writeFile.text` | `gravarArquivo.texto` |
  | `EntradaSaidaCli` | `doctor.options` | `doctor.opcoes` |
  | `VerificacaoDoDoctor` | `status` | `situacao` |
  | `VerificacaoDoDoctor` | `message` | `mensagem` |
  | `VerificacaoDoDoctor` | `details` | `detalhes` |
  | `DoctorOpcoes` | `password` | `senha` |
  | `DoctorOpcoes` | `extraChainPem` | `cadeiaAdicionalPem` |
  | `DoctorOpcoes` | `extraCaPem` | `acsAdicionaisPem` |
  | `DoctorOpcoes` | `allowExpired` | `aceitarVencido` |
  | `DoctorOpcoes` | `status` | `consultarStatus` |
  | `DoctorOpcoes` | `clockUrl` | `urlDoRelogio` |
  | `DoctorOpcoes` | `clock` | `relogio` |
  | `RelatorioDoDoctor` | `checks` | `verificacoes` |
  | `mascararCpfs` | `text` | `texto` |
  | `lerDataHttp` | `value` | `valor` |
  | `rodarDoctor` | `options` | `opcoes` |
  | `EntradaSaidaCli` | `out` | `saida` |
  | `EntradaSaidaCli` | `err` | `erro` |
  | `EntradaSaidaCli` | `promptPassword` | `pedirSenha` |
  | `EntradaSaidaCli` | `readFile` | `lerArquivo` |
  | `EntradaSaidaCli` | `writeFile` | `gravarArquivo` |
  | `formatarRelatorio` | `report` | `relatorio` |
- 2a46db6: Acompanham a fase 2 do ADR 0015 (`@sinete/cert`, `@sinete/transport`, runtime do `@sinete/schemas`, `@sinete/ibs-cbs-dados` e `@sinete/ibs-cbs` com nomes em português). Os tipos desses pacotes que estes recebem e devolvem mudam, e o código de quem os usa muda junto; a tabela completa está nos changesets de cada pacote da fase. Nomes destes pacotes que também mudam:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | `CertificadoAberto` (`@sinete/emissor`) | `signer` | `assinador` |
  | `syntheticCertificate(...).tlsIdentity` (`@sinete/sefaz-sim`) | `{ kind: 'pem', certChain, key }` | `{ tipo: 'pem', cadeia, chave }`, a forma da `IdentidadeTls` |
  | `simTransport` (`@sinete/sefaz-sim`) | `runtime: 'custom'` | `runtime: 'personalizada'` |
- ae8ab90: Acompanham a fase 1 do ADR 0015 (`@sinete/core`, `@sinete/validators` e `@sinete/rejeicoes` com nomes em português). Nenhum nome próprio destes pacotes muda nesta fase, mas os tipos do core que eles recebem e devolvem mudam, e o código de quem os usa muda junto. Os mais visíveis:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | desfecho dos clientes (`ResultadoSefaz`, antes `SefazOutcome`) | `status: 'authorized' \| 'rejected' \| 'denied' \| 'pending'` | `tipo: 'autorizado' \| 'recusado' \| 'denegado' \| 'pendente'` |
  | desfecho autorizado ou denegado | `value` | `valor` |
  | desfecho recusado | `hint` (`probableCause`, `suggestedFix`, `source`) | `dica` (`causaProvavel`, `comoCorrigir`, `fonte`) |
  | desfecho pendente | `ref`, `retryAfterMs` | `referencia`, `aguardarMs` |
  | erros (`ErroSinete`, antes `SineteError`) | `details`, `docs` | `detalhes`, `pagina` |
  | ocorrências (`Ocorrencia`, antes `ValidationIssue`) | `path`, `message` | `caminho`, `mensagem` |
  | `ErroDeValidacao` (antes `ValidationError`) | `issues` | `ocorrencias` |
  | assinador (`Assinador`, antes `Signer`) | `kind: 'data' \| 'digest'`, `sign`, `signDigestInfo`, `certificateDer` | `tipo: 'dados' \| 'digest'`, `assinar`, `assinarDigestInfo`, `certificadoDer` |
  | relógio (`Relogio`, antes `Clock`) | `now()` | `agora()` |
  | resultado local (`Resultado`, antes `Result`) | `value`, `error` | `valor`, `erro` |
  
  A tabela completa de cada pacote da fase está nos changesets do `@sinete/core`, do `@sinete/validators` e do `@sinete/rejeicoes`.

### Patch Changes

- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
- Updated dependencies [2a46db6]
  - @sinete/cert@0.2.0
  - @sinete/core@0.2.0
  - @sinete/transport@0.2.0

## 0.1.0

### Minor Changes

- 515861a: `sinete agents-md`: faz upsert do bloco do sinete no `AGENTS.md` do projeto, entre `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`, sem tocar no resto, e cria o `CLAUDE.md` com `@AGENTS.md` se não existir. O bloco manda o agente de código ler a documentação embarcada da versão instalada, dá as regras que evitam nota duplicada e um índice curto dos pacotes. `CliIo` ganha `writeFile` opcional (sem ela, o `agents-md` sai com código 2); `upsertBloco` e `BLOCO_AGENTS` estão exportados.
- 515861a: Primeira versão do @sinete/cli com `sinete doctor`: abre o PFX (senha por variável de ambiente ou prompt sem eco), confere identidade, validade e cadeia ICP-Brasil, mede o relógio contra o `Date` do servidor e faz só o handshake TLS com o endpoint, com a consulta de status apenas sob `--status`. Nunca mostra material de chave.
- 515861a: `sinete agents-md` também instala a skill `sinete` (`SKILL.md` no formato Agent Skills) em `.claude/skills/sinete/` (Claude Code) e `.agents/skills/sinete/` (Codex e outras ferramentas do padrão), como complemento do bloco do `AGENTS.md`: a skill manda o agente ler a documentação embarcada da versão instalada, sem duplicá-la. O comando a atualiza a cada execução enquanto ela traz a linha `<!-- sinete-skill: ... -->`; um `SKILL.md` que já existe sem a linha é do projeto e é mantido. `--sem-skill` não instala nem atualiza; `--imprimir` segue só mostrando o bloco. `upsertSkill`, `SKILL_SINETE`, `DIRETORIOS_SKILL` e `MARCADOR_SKILL` estão exportados.

### Patch Changes

- 515861a: Documentação embarcada: a contingência automática no guia de contingência, na NFC-e, na retomada e no store SQL (tabela e métodos para o PostgreSQL), e uma regra nova no bloco do `AGENTS.md`. A NF-e só vai à SVC ativada pela SEFAZ de origem (107 no status da SVC), e a NFC-e off-line não depende de ativação.
- 515861a: A documentação embarcada acompanha a API nova do emissor: guia de como emitir por vários emitentes no mesmo servidor (certificado aberto, pool com `chave`, `aoDecidir` e `jaGuardado` por chamada, entrada preparada), os desfechos `ja-guardado`, `anterior` e `situacaoPosterior` na retomada e na explicação dos bytes, e o bloco do `AGENTS.md` com a entrada preparada e o `abrirCertificado`.
- 515861a: Documentação embarcada: guia "Como emitir NFC-e" (regras do modelo 65, QR Code versões 2 e 3, contingência off-line), a contingência com a NFC-e off-line e o bloco do `AGENTS.md` com a NFC-e e os nomes novos do `sinete/nfe`.
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
  - @sinete/transport@0.1.0
  - @sinete/core@0.1.0
