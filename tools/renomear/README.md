# tools/renomear

Aplica um mapa de renomeação da API pública ([ADR 0015](../../docs/adr/0015-nomes-em-portugues.md)) pelo serviço de renomeação do TypeScript, num programa único com o `src` e o `test` de todos os pacotes, `tools/`, `scripts/`, `smoke/` e os blocos ```ts dos READMEs e do guia. `@sinete/*`, os subpaths e o guarda-chuva `sinete/*` resolvem para o `src` de cada pacote, então a troca atravessa os pacotes e chega aos exemplos da documentação.

Workspace privado, nunca publicado. O TypeScript 7 do repo não tem language service em JavaScript; a ferramenta usa o 5.9 (`typescript-ls`) só para achar referências. Quem confere os tipos continua sendo o `bun run typecheck`.

```sh
bun tools/renomear/renomear.ts mapa.json --simular --relatorio relatorio.md   # tudo em memória, nada gravado
bun tools/renomear/renomear.ts mapa.json --relatorio relatorio.md             # grava e roda o biome nos arquivos tocados
bun tools/renomear/renomear.ts a.json b.json c.json --simular                 # os mapas de uma fase, na ordem do ADR
```

Com vários mapas, rodam como um só: os símbolos de todos, depois os literais, as chaves e os valores.

## Mapa

```json
{
  "pacote": "@sinete/core",
  "simbolos": [
    { "arquivo": "packages/core/src/result.ts", "tipo": "SefazOutcome", "nome": "status", "novo": "tipo" },
    { "arquivo": "packages/core/src/result.ts", "tipo": "pending", "nome": "options.ref", "novo": "referencia" },
    { "arquivo": "packages/core/src/result.ts", "tipo": "ok", "nome": "@retorno.value", "novo": "valor" },
    { "arquivo": "packages/core/src/result.ts", "nome": "SefazOutcome", "novo": "ResultadoSefaz" }
  ],
  "literais": [
    { "arquivo": "packages/core/src/result.ts", "tipo": "ResultadoSefaz", "propriedade": "tipo",
      "antigo": "authorized", "novo": "autorizado", "grupo": ["rejected", "denied", "pending"] }
  ],
  "chavesDeDados": [
    { "arquivo": "packages/core/src/data/ufs.json", "caminho": "sources[]", "antigo": "retrievedAt", "novo": "coletadoEm" }
  ],
  "valoresDeDados": [
    { "arquivo": "packages/validators/src/data/ie.json", "caminho": "ufs.*.variants[].checks[]", "chave": "result",
      "antigo": "complement", "novo": "complemento" }
  ]
}
```

- `simbolos` rodam na ordem do mapa, cada um sobre o estado deixado pelo anterior. Membro se acha pelo tipo que o declara, com o nome antigo do tipo: ponha os membros antes do tipo. `tipo` pode ser uma lista, ou uma união (os membros de mesmo nome de todas as partes mudam juntos). No caminho de `nome`, um segmento é um parâmetro (`options.ref`) ou um membro, e `@retorno` desce no tipo de retorno anotado.
- `literais` rodam depois dos símbolos, então `tipo` e `propriedade` já têm o nome novo. Sem `propriedade`, `tipo` é o alias da união (`VerifyFailure`). Só muda o literal que o verificador liga ao tipo: a propriedade comparada ou atribuída tem a declaração do mapa entre as raízes, o objeto é do tipo (o `this.name` de uma classe de erro), o tipo esperado é uma união com dois ou mais valores de `grupo`, ou o objeto sem tipo tem todas as chaves de um tipo do alvo. O resto sai no relatório, sem mudança.
- `chavesDeDados` e `valoresDeDados` trocam chaves e valores de JSON por caminho (`*` é qualquer chave, `[]` qualquer item), e os acessos do código ao JSON importado (`table.schemaVersion`).

## O que a ferramenta confere

- Diagnósticos do programa antes e depois: todo erro novo sai no relatório (o JSON que ficou com a chave antiga, o import quebrado).
- Captura de nome: cada local trocado tem de resolver para a declaração renomeada. Um nome novo que já existe no escopo (`erro`, `valor`) prende a referência sem erro de tipo, e sai como falha.
- O que o serviço não alcança sai no relatório para revisão: chaves de objeto sem tipo (`toEqual({ status: ... })`) trocadas pela regra do `expect` ou da forma, o nome antigo como texto (`'hint' in r`, `Object.keys` comparado com uma lista), chaves de `Record` e acessos que sobraram nos arquivos tocados, e o nome antigo em comentários e na prosa do Markdown.

A cópia via `as unknown as T` (o `table.ufs` do `ie.ts`) não é conferida pelo verificador: se a chave do JSON e o membro do tipo divergirem, só os testes pegam.
