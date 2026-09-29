#!/usr/bin/env bash
# Mede build limpo (6 execuções) de cada variante. Uso: scripts/bench-build.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }
run() {
  local dir=$1; shift
  cd "$ROOT/$dir"
  for i in 1 2 3 4 5 6; do
    rm -rf packages/core/dist packages/xml/dist packages/cli/dist packages/*/tsconfig.tsbuildinfo
    s=$(now); "$@" >/dev/null 2>&1 || echo "$dir FAIL"; e=$(now)
    echo "$dir run$i $(echo "$e - $s" | bc)s"
  done
}
run a-bun bun run build
run b-pnpm pnpm run build
[ -d "$ROOT/c-tsc" ] && run c-tsc npx tsc -b packages/cli
