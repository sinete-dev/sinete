#!/bin/sh
# PKI descartável do lab (tudo em .local/, ignorado pelo git). Nada aqui é certificado real.
set -eu
D="$(dirname "$0")/../.local/pki"; mkdir -p "$D"; cd "$D"
openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 30 -subj "/CN=sinete-s4-throwaway-ca" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/CN=localhost" 2>/dev/null
printf "subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n" > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 30 -extfile server.ext 2>/dev/null
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out client.key 2>/dev/null
openssl req -new -key client.key -out client.csr -subj "/CN=sinete-s4-throwaway-client:00000000000000" 2>/dev/null
printf "extendedKeyUsage=clientAuth\n" > client.ext
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 30 -extfile client.ext 2>/dev/null
ls
