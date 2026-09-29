#!/bin/bash
# Reconstrói o SQLite da Calculadora a partir das migrações Flyway publicadas no pacote oficial
# (codigo-fonte-backend.zip), até a versão pedida. Uso: rebuild-db.sh <dir flyway/sql> <V00NN> <saida.db> [pro|nonpro]
set -euo pipefail
SQL="$1"; UPTO="$2"; OUT="$3"; FLAVOR="${4:-pro}"
rm -f "$OUT"
{
  cat "$SQL/criacao/beforeMigrate.sql"
  cat "$SQL/criacao/B0001__sistema_tributario_completo.sql"
  for f in $(ls "$SQL"/manutencao/V*.sql | sort); do
    v=$(basename "$f" | cut -d_ -f1)
    [[ "$v" > "$UPTO" ]] && break
    echo "-- >>> $f"; cat "$f"; echo ";"
  done
  [ "$FLAVOR" = none ] || cat "$SQL/criacao/afterMigrate-$FLAVOR.sql"
} | sed -E 's/PRAGMA foreign_keys *= *ON;/PRAGMA foreign_keys = OFF;/I' | sqlite3 -bail "$OUT" >/dev/null
# Flyway roda cada migração em transação, onde PRAGMA foreign_keys é ignorado; aqui desligamos a checagem
# durante a reconstrução e reportamos as violações no fim, sem falhar.
sqlite3 "$OUT" "PRAGMA foreign_key_check" | cut -d"|" -f1,3 | sort | uniq -c | sed "s/^/fk-violation: /" >&2 || true
