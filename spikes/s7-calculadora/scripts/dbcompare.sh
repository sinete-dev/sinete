#!/bin/bash
# Compara conteúdo (não bytes) de dois SQLite: por tabela, sha256 das linhas ordenadas.
A="$1"; B="$2"
for t in $(sqlite3 "$A" "select name from sqlite_master where type='table' and name not like 'sqlite_%' and name <> 'flyway_schema_history' order by 1"); do
  ha=$(sqlite3 -csv "$A" "select * from $t order by 1,2" 2>/dev/null | shasum -a 256 | cut -c1-12)
  hb=$(sqlite3 -csv "$B" "select * from $t order by 1,2" 2>/dev/null | shasum -a 256 | cut -c1-12)
  na=$(sqlite3 "$A" "select count(*) from $t"); nb=$(sqlite3 "$B" "select count(*) from $t" 2>/dev/null || echo NA)
  if [ "$ha" = "$hb" ]; then echo "same  $t $na"; else echo "DIFF  $t $na/$nb"; fi
done
