---
'@sinete/cli': minor
'sinete': minor
---

`sinete agents-md`: faz upsert do bloco do sinete no `AGENTS.md` do projeto, entre `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`, sem tocar no resto, e cria o `CLAUDE.md` com `@AGENTS.md` se não existir. O bloco manda o agente de código ler a documentação embarcada da versão instalada, dá as regras que evitam nota duplicada e um índice curto dos pacotes. `CliIo` ganha `writeFile` opcional (sem ela, o `agents-md` sai com código 2); `upsertBloco` e `BLOCO_AGENTS` estão exportados.
