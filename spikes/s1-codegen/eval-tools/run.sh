#!/usr/bin/env bash
# Reproduz a avaliação das ferramentas existentes sobre o PL_010f (saídas não versionadas).
set -euo pipefail
cd "$(dirname "$0")"
XSD=../xsd/PL_010f_v1.04
bun add cxsd @kie-tools/xml-parser-ts-codegen @kie-tools/xml-parser-ts jsdom @asyncapi/modelina xsd-ts
# kie-tools: exige prefixo xsd: e falha em restrição com base de simpleType próprio
rm -rf kie && mkdir kie && cp $XSD/*.xsd kie/ && node node_modules/@kie-tools/xml-parser-ts-codegen/bin.js kie/nfe_v4.00.xsd NFe || true
# cxsd: só lê por HTTP
rm -rf cx && mkdir cx && cp $XSD/*.xsd cx/
python3 -m http.server 8765 --bind 127.0.0.1 --directory cx & HTTP_PID=$!
sleep 1
(cd cx && node ../node_modules/cxsd/cxsd-cli.js http://127.0.0.1:8765/nfe_v4.00.xsd)
kill $HTTP_PID
node modelina.mjs
node xsdts.mjs || true
GOBIN=$PWD/.gobin go install github.com/xuri/xgen/cmd/xgen@latest && mkdir -p xgen-in xgen-out && cp $XSD/*.xsd xgen-in/ && ./.gobin/xgen -i xgen-in -o xgen-out -l TypeScript
mkdir -p xsdata-out && (cd xsdata-out && uvx --from 'xsdata[cli]' xsdata generate ../$XSD/nfe_v4.00.xsd --package nfe --compound-fields)
