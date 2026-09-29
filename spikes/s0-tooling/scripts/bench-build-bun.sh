#!/usr/bin/env bash
# Build limpo: tsdown sob node, tsdown sob bun (--bun) e Bun.build + tsc. 6 execuções cada.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }
run() {
  local label=$1 dir=$2; shift 2
  cd "$ROOT/$dir"
  for i in 1 2 3 4 5 6; do
    rm -rf packages/core/dist packages/xml/dist packages/cli/dist
    s=$(now); "$@" >/dev/null 2>&1 || echo "$label FAIL"; e=$(now)
    echo "$label run$i $(echo "$e - $s" | bc)s"
  done
}
run tsdown-node a-bun bun run build
run tsdown-bun a-bun bun --bun run build
run bunbuild-tsc a-bun-bunbuild bun run build
