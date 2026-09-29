# Referência: `@sinete/cli`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/cli/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/cli/x` é `sinete/cli/x`.

## `@sinete/cli`

`@sinete/cli`: o executável `sinete` e, para quem quiser embutir, o `runDoctor` programático e o upsert do bloco do `AGENTS.md` e da skill `sinete` (`upsertBloco`, `BLOCO_AGENTS`, `upsertSkill`, `SKILL_SINETE`).

### Funções

- `formatCnpj`: `formatCnpj(cnpj: string): string`
- `formatReport`: `formatReport(report: DoctorReport): string[]`
- `main`: Executa a CLI e devolve o código de saída. `main(argv: readonly string[], io: CliIo): Promise<number>`
- `maskCpf`: Máscara de CPF para a saída (o doctor costuma ir parar em issue e chat). `maskCpf(cpf: string): string`
- `maskCpfs`: Mascara todo CPF (11 dígitos soltos) num texto de saída: CN de e-CPF, DN com serialNumber. `maskCpfs(text: string): string`
- `parseHttpDate`: `Date` HTTP (IMF-fixdate, RFC 9110) em ms desde a época, sem o global `Date`. `parseHttpDate(value: string | undefined): number | undefined`
- `runDoctor`: `runDoctor(options: DoctorOptions): Promise<DoctorReport>`
- `upsertBloco`: Devolve o `AGENTS.md` com o bloco: cria o arquivo, acrescenta o bloco no fim ou troca o que estiver entre os marcadores. Lança se os marcadores estiverem incompletos, repetidos ou fora de ordem, para não apagar texto do integrador. `upsertBloco(atual: string | undefined, bloco: string): { texto: string; acao: AcaoAgentsMd; }`
- `upsertSkill`: Devolve o `SKILL.md` a gravar. `upsertSkill(atual: string | undefined, skill: string): { texto: string; acao: AcaoSkill; }`

### Interfaces

- `CliIo`: Membros: `out`, `err`, `env`, `promptPassword`, `readFile`, `writeFile`, `doctor`.
- `DoctorCheck`: Membros: `id`, `status`, `message`, `details`.
- `DoctorOptions`: Membros: `pfx`, `password`, `extraChainPem`, `extraCaPem`, `allowExpired`, `endpoint`, `documento`, `uf`, `ambiente`, `status`, `clockUrl`, `timeoutMs`, `clock`.
- `DoctorReport`: Membros: `ok`, `checks`.

### Tipos

- `AcaoAgentsMd`: O que o upsert fez com o `AGENTS.md`. `type AcaoAgentsMd = 'criado' | 'inserido' | 'atualizado' | 'sem-mudanca'`
- `AcaoSkill`: O que o upsert fez com o `SKILL.md`. `preservada`: existe sem o marcador, logo é do integrador e não foi tocada. `type AcaoSkill = 'criada' | 'atualizada' | 'sem-mudanca' | 'preservada'`
- `CheckStatus`: `type CheckStatus = 'ok' | 'aviso' | 'falha' | 'pulado'`

### Constantes

- `BLOCO_AGENTS`: O bloco do sinete para o `AGENTS.md` do integrador, com os marcadores. `BLOCO_AGENTS: string`
- `CLAUDE_MD`: Conteúdo do `CLAUDE.md` criado quando o projeto não tem um: o Claude Code importa o `AGENTS.md` por ele. `CLAUDE_MD = "@AGENTS.md\n"`
- `DIRETORIOS_SKILL`: Diretórios de projeto onde as ferramentas de agente procuram skills: Claude Code (`.claude/skills`) e Codex (`.agents/skills`, o padrão que o agentskills.io recomenda). `DIRETORIOS_SKILL: readonly string[]`
- `FIM_BLOCO`: `FIM_BLOCO = "<!-- END:sinete-agent-rules -->"`
- `INICIO_BLOCO`: `sinete agents-md`: põe o bloco do sinete no `AGENTS.md` do projeto do integrador, entre os marcadores `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`, sem tocar no que está fora deles. `INICIO_BLOCO = "<!-- BEGIN:sinete-agent-rules -->"`
- `MARCADOR_SKILL`: Início da linha que marca o `SKILL.md` como gerado pelo comando. Sem ela, o arquivo é do integrador. `MARCADOR_SKILL = "<!-- sinete-skill:"`
- `SKILL_SINETE`: O `SKILL.md` da skill `sinete` que o `sinete agents-md` grava no projeto do integrador. `SKILL_SINETE: string`
