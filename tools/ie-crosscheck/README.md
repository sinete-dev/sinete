# tools/ie-crosscheck

Confronta o `parseIe` do `@sinete/validators` com outra implementação de IE sobre uma lista local de pares `UF<TAB>IE` e imprime **só estatísticas agregadas por UF**: quantas o sinete aceita, quantas a referência aceita, concordância, quantas o sinete aceita só depois de ajustar zeros à esquerda (nota *2 do Anexo I do MOC) e os códigos de ocorrência das recusas. Nunca imprime nem grava os valores, porque a lista costuma vir de base real.

Workspace privado, nunca publicado.

```sh
bun run build
<comando que imprime pares UF\tIE> | bun tools/ie-crosscheck/crosscheck.ts [--reference caminho/modulo.ts]
```

O módulo de referência exporta `validate(ie: string, uf: string): boolean`. Nem a lista nem a referência entram no repositório.

Para uma base MySQL, por exemplo: `mysql -N -B -e "SELECT DISTINCT uf, ie FROM tabela"` com a senha em `MYSQL_PWD`, lida de um arquivo sem ecoar.
