#!/usr/bin/env bash
# Roda a mesma suíte (node:test, vitest, bun:test) nas três runtimes, com tempo de parede.
cd "$(dirname "$0")/../testrunners"
t() {
  local s e out rc
  s=$(perl -MTime::HiRes=time -e 'printf "%.3f", time')
  out=$("$@" 2>&1); rc=$?
  e=$(perl -MTime::HiRes=time -e 'printf "%.3f", time')
  echo "[rc=$rc] $(echo "$e - $s" | bc)s :: $* :: $(echo "$out" | grep -iE '^# (pass|fail)|pass|fail|Tests |error' | head -4 | tr '\n' ' ' | cut -c1-260)"
}
for v in 20.20.2 22.23.3 24.13.0 26.3.1; do t fnm exec --using=$v node --test smoke.node-test.test.ts; done
t bun test ./smoke.node-test.test.ts
t bun test ./smoke.bun.test.ts
t deno test --minimum-dependency-age=0 -A smoke.node-test.test.ts
t ./node_modules/.bin/vitest run
t bun --bun ./node_modules/.bin/vitest run
t deno run --minimum-dependency-age=0 -A npm:vitest@5.0.2 run
