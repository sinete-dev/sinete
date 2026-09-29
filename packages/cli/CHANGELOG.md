# @sinete/cli

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
