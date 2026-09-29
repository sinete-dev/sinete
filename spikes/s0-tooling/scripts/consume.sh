#!/usr/bin/env bash
# Consome do verdaccio local os pacotes de uma variante em Node (ESM, require), Bun, Deno e browser.
# Uso: scripts/consume.sh <rotulo> <versao-core> <versao-xml> <versao-cli>
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL=$1; CORE=$2; XML=$3; CLI=$4
PORT=$(cat "$ROOT/registry/port"); REG="http://127.0.0.1:$PORT/"
export NPM_CONFIG_USERCONFIG="$ROOT/registry/npmrc"
SRC="$ROOT/consumers/src"; TSC="$ROOT/a-bun/node_modules/.bin/tsc"
NODES="20.20.2 22.9.0 22.23.3 24.13.0 26.3.1"
D="$ROOT/consumers/$LABEL"; rm -rf "$D"; mkdir -p "$D/node" "$D/bun" "$D/deno"

echo "### [$LABEL] node: npm install do registry local"
cd "$D/node"
cat > package.json <<J
{ "name": "consumer-node", "private": true, "type": "module",
  "dependencies": { "@sinete/core": "$CORE", "@sinete/xml": "$XML", "@sinete/cli": "$CLI", "@sinete/core-dual": "0.1.0", "@types/node": "^22" } }
J
npm install --no-audit --no-fund 2>&1 | tail -1
cp "$SRC"/*.mjs "$SRC"/*.cjs "$SRC"/typed.ts .
for v in $NODES; do
  echo "-- node $v esm:     $(fnm exec --using=$v node esm.mjs 2>&1 | tr '\n' ' ')"
  echo "-- node $v require: $(fnm exec --using=$v node cjs.cjs 2>&1 | head -3 | tr '\n' ' ')"
  echo "-- node $v hazard:  $(fnm exec --using=$v node hazard.mjs 2>&1 | head -2 | tr '\n' ' ')"
done
echo "-- bin (npx sinete doctor): $(npx --no-install sinete doctor 2>&1)"
echo "-- tsc nodenext:"; "$TSC" --noEmit --strict --module nodenext --moduleResolution nodenext --types node --skipLibCheck false typed.ts 2>&1 | head -5; echo "   exit=${PIPESTATUS[0]}"
echo "-- tsc bundler:";  "$TSC" --noEmit --strict --module preserve --moduleResolution bundler --types node --skipLibCheck false typed.ts 2>&1 | head -5; echo "   exit=${PIPESTATUS[0]}"
echo "-- browser (esbuild --platform=browser):"
npx --yes esbuild@0.28.2 browser.mjs --bundle --platform=browser --format=esm --outfile=browser.esbuild.js 2>&1 | tail -1
echo "   node:crypto no bundle? $(grep -c 'node:crypto' browser.esbuild.js)  run(deno): $(deno run --quiet --minimum-dependency-age=0 browser.esbuild.js 2>&1)"

echo "### [$LABEL] bun"
cd "$D/bun"
printf '[install]\nregistry = "%s"\n' "$REG" > bunfig.toml
cat > package.json <<J
{ "name": "consumer-bun", "private": true, "type": "module",
  "dependencies": { "@sinete/core": "$CORE", "@sinete/xml": "$XML", "@sinete/cli": "$CLI" } }
J
bun install --no-cache 2>&1 | tail -1  # cache de manifesto do bun fica velho entre publicações
cp "$SRC"/esm.mjs "$SRC"/cjs.cjs "$SRC"/typed.ts "$SRC"/browser.mjs .
echo "-- bun esm:     $(bun esm.mjs 2>&1)"
echo "-- bun require: $(bun cjs.cjs 2>&1)"
echo "-- bun typed.ts: $(bun typed.ts 2>&1)"
echo "-- bun bin: $(bun x sinete doctor 2>&1)"
bun build browser.mjs --target=browser --outfile=browser.bun.js 2>&1 | tail -1
echo "   node:crypto no bundle? $(grep -c 'node:crypto' browser.bun.js)  run(deno): $(deno run --quiet --minimum-dependency-age=0 browser.bun.js 2>&1)"

echo "### [$LABEL] deno (npm: specifier, DENO_DIR isolado)"
cd "$D/deno"
export DENO_DIR="$D/deno/.deno-cache" NPM_CONFIG_REGISTRY="$REG"
sed -e "s#'@sinete/core'#'npm:@sinete/core@$CORE'#; s#'@sinete/core/runtime'#'npm:@sinete/core@$CORE/runtime'#; s#'@sinete/xml'#'npm:@sinete/xml@$XML'#" "$SRC/esm.mjs" > esm.mjs
sed -e "s#'@sinete/core'#'npm:@sinete/core@$CORE'#g; s#'@sinete/core/runtime'#'npm:@sinete/core@$CORE/runtime'#; s#'@sinete/xml'#'npm:@sinete/xml@$XML'#" "$SRC/typed.ts" > typed.ts
echo "-- deno run: $(deno run --quiet --minimum-dependency-age=0 --allow-read --allow-env esm.mjs 2>&1)"
echo "-- deno check typed.ts:"; deno check --quiet --minimum-dependency-age=0 typed.ts 2>&1 | head -5; echo "   exit=${PIPESTATUS[0]}"
echo "-- deno run typed.ts: $(deno run --quiet --minimum-dependency-age=0 typed.ts 2>&1)"
echo "-- deno bin (npm:@sinete/cli): $(deno run --quiet --minimum-dependency-age=0 -A npm:@sinete/cli@$CLI doctor 2>&1)"
