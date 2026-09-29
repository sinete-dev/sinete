#!/bin/sh
# Token SoftHSM descartável dentro de .local/ (ignorado pelo git). PIN de laboratório, sem valor.
set -eu
cd "$(dirname "$0")/.."
D="$PWD/.local/softhsm"; rm -rf "$D"; mkdir -p "$D/tokens"
printf "directories.tokendir = %s/tokens\nobjectstore.backend = file\nlog.level = ERROR\n" "$D" > "$D/softhsm2.conf"
export SOFTHSM2_CONF="$D/softhsm2.conf"
softhsm2-util --init-token --free --label sinete-s4 --pin 123456 --so-pin 654321
go run ./cmd/p11setup -pin 123456
