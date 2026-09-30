# @sinete/cli

CLI `sinete`: o `doctor`, que confere o certificado A1, a cadeia ICP-Brasil, o relógio e o handshake TLS com um endpoint, sem nunca mostrar chave, senha ou o PFX; e o `agents-md`, que põe o bloco do sinete no `AGENTS.md` do projeto e instala a skill `sinete`. Validar, assinar, enviar e consultar vêm depois.

Status: pré-alfa, API instável até a 1.0.

```sh
export SINETE_PFX_SENHA=...        # ou deixe sem e digite no prompt (sem eco)
sinete doctor --pfx empresa.pfx                          # PFX, cadeia e relógio local
sinete doctor --pfx empresa.pfx --uf SP                  # + handshake TLS com a SEFAZ-SP de homologação
sinete doctor --pfx empresa.pfx --uf SP --status         # + consulta de status do serviço (a única requisição)
sinete doctor --pfx empresa.pfx --documento mdfe --json
```

## `sinete agents-md`

```sh
sinete agents-md                   # AGENTS.md e CLAUDE.md da pasta atual
sinete agents-md --dir ../meu-app  # de outro projeto
sinete agents-md --imprimir        # só mostra o bloco
sinete agents-md --sem-skill       # só o bloco, sem a skill
```

Faz upsert do bloco do sinete no `AGENTS.md` entre `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`: cria o arquivo se não existe, acrescenta o bloco no fim se não há marcadores, troca só o que está entre eles se há, e não escreve nada se já está em dia. Marcadores incompletos, repetidos ou fora de ordem saem com código 1 sem mexer no arquivo. Cria o `CLAUDE.md` com `@AGENTS.md` se não existir; um `CLAUDE.md` existente não é tocado (o comando avisa se ele não importa o `AGENTS.md`). Além do bloco, instala a skill `sinete` (`SKILL.md` no formato Agent Skills) em `.claude/skills/sinete/` e em `.agents/skills/sinete/` do projeto, e a atualiza a cada execução. O bloco continua sendo o mecanismo principal: um índice sempre presente no `AGENTS.md` é mais confiável que uma skill, que só vale se o agente decidir chamá-la. A skill é o complemento para quem trabalha com skills e não duplica a documentação: só manda ler `node_modules/sinete/docs/index.md` e o `bloco-agents.md` antes de escrever código. Dois diretórios porque nenhuma das ferramentas lê o do outro: o Claude Code lê `.claude/skills/` ([documentação](https://code.claude.com/docs/en/skills)) e o Codex lê `.agents/skills/` ([documentação](https://developers.openai.com/codex/skills)), o caminho que o [agentskills.io](https://agentskills.io/client-implementation/adding-skills-support) recomenda para interoperar entre clientes. O arquivo gerado leva a linha `<!-- sinete-skill: ... -->`: com ela, o comando o substitui pela versão instalada; um `SKILL.md` que já existe sem ela é seu e é mantido (o comando avisa e não escreve), porque o arquivo inteiro é a skill e não há trecho seguro para trocar. Para assumir a skill, apague a linha; para o comando voltar a gerá-la, apague o arquivo. `--sem-skill` não instala nem atualiza; `--imprimir` continua só mostrando o bloco. O texto do bloco é o de `docs/guia/bloco-agents.md`, que vai na documentação embarcada, gerado em `src/bloco-agents.ts` por `scripts/docs-gerados.ts`; `SKILL_SINETE` vem de `docs/guia/skill-sinete.md` do mesmo jeito; `aplicarBloco`, `BLOCO_AGENTS`, `aplicarSkill` e `SKILL_SINETE` estão exportados para quem quiser fazer o mesmo de outro jeito.

## Decisões que valem aqui

- Único pacote com `bin`: o build usa `target: node` e pode usar builtins do Node e console (override do Biome).
- A senha vem de variável de ambiente (`--senha-env`, padrão `SINETE_PFX_SENHA`) ou de prompt sem eco; nunca de argumento.
- Por padrão o doctor só faz o handshake TLS, sem requisição HTTP. `--status` manda a consulta de status (NF-e com `--uf`, MDF-e), que é o único jeito de provar a aceitação do certificado nos hosts que o pedem por renegociação (SP, BA, SVAN, AN, Sefin).
- O CPF do responsável sai mascarado (`***.444.777-**`): a saída do doctor costuma ir parar em issue e chat.
- `ambiente` padrão: homologação.

## Verificações

| id | O que confere | Falha quando |
|---|---|---|
| `pfx` | abre o PFX (inclusive RC2-40 + 3DES), titular, CNPJ/CPF, emissor, validade | senha errada, PFX ilegível, vencido (aviso com `--aceitar-vencido`); aviso a menos de 30 dias |
| `cadeia` | sobe até as raízes ICP-Brasil v5, v10, v11 ou v12 com as intermediárias do PFX e de `--cadeia` | assinatura de elo inválida ou elo vencido; aviso se falta intermediária ou a raiz não é ICP-Brasil |
| `relogio` | diferença para o `Date` do servidor (`--status` ou `--relogio-url`) | acima de 5 min (aviso acima de 1 min); a SEFAZ recusa emissão no futuro (703) |
| `tls` | handshake com o endpoint, protocolo, cifra, servidor e certificado de cliente carregado | cadeia do servidor não confiável, alerta TLS, conexão recusada |
| `status` | só com `--status`: `cStat` do status do serviço | erro de transporte (403 do IIS, alertas); aviso se `cStat` diferente de 107 |

Saída com código 0 sem falhas, 1 com falha e 2 para uso errado. `rodarDoctor(opcoes)` faz o mesmo de forma programática.

## Pendências

- Consulta OCSP sob demanda (ADR 0004, decisão 3).
- Catálogo completo de ACs do ITI para completar a cadeia de qualquer A1 sem `--cadeia`.
