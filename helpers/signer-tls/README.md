# helpers/signer-tls

Helper nativo `sinete-signer`, em Go, que termina o mTLS com a SEFAZ usando uma chave que ele não guarda: A3 em token (PKCS#11), A3 em nuvem de PSC, chave em OpenBao Transit, `CryptoKey` não exportável. Fala o protocolo v1 de [`docs/signer-contract/`](../../docs/signer-contract/PROTOCOL.md) pelo stdio (ou por um socket Unix); o cliente é o [`@sinete/transport/signer`](../../packages/transport/README.md). Não é pacote do workspace: os binários vão para o npm em `@sinete/signer` e `@sinete/signer-<os>-<cpu>` ([ADR 0014](../../docs/adr/0014-distribuicao-do-signer.md)).

## Decisões que valem aqui

- ADR 0005: Go com `crypto/tls` da biblioteca padrão e só `github.com/miekg/pkcs11` (BSD-3) de dependência; perfil TLS só 1.2 e só PKCS#1 no CertificateVerify; troca RSA só no host cujo perfil medido pede; renegociação uma vez por conexão; HTTP/1.1; sem redirecionamento; não existe assinatura avulsa.
- ADR 0014: build reproduzível, pacotes npm por plataforma, cliente no subpath do transporte.
- Os dados (hosts por ambiente, hosts com troca RSA, ACs ICP-Brasil da confiança TLS) são gerados de `@sinete/transport` e `@sinete/cert` em `internal/policy/data_gen.go` por `scripts/gen-data.ts`. Mudar a lista de hosts exige release do helper.

## Sabores

| Binário | Build | Backends |
|---|---|---|
| `sinete-signer` | `CGO_ENABLED=0`, cruzado de qualquer host para linux, windows e darwin, amd64 e arm64 | `remote` (`digest` e `message`) |
| `sinete-signer-p11` | cgo: no macOS, as duas arquiteturas darwin; no Ubuntu, linux/amd64 nativo e, com `SINETE_CC_<GOOS>_<GOARCH>`, linux/arm64 e windows/amd64 cruzados. Sem windows/arm64. No Linux, exige glibc 2.34 ou mais nova | `remote` e `pkcs11` |

## Uso

```sh
sinete-signer --ambiente homologacao [--ambiente producao] [--tpamb 2] [--require-tpamb] [--audit-file arquivo] [--roots ac.pem] [--socket caminho]
sinete-signer --lab [--roots ac.pem]   # só loopback: laboratório e testes
sinete-signer --version
```

`--ambiente` é obrigatório fora do laboratório. O PIN do token só entra pelo canal (`identity.open`), nunca por argumento ou variável. O stderr leva o log humano e, sem `--audit-file`, a auditoria em linhas `audit {json}`.

## Estrutura

- `cmd/sinete-signer/`: flags, stdio e socket Unix.
- `internal/protocol/`: o canal NDJSON bidirecional.
- `internal/server/`: os métodos do protocolo sobre um canal (identidades por conexão).
- `internal/policy/`: a guarda de hosts, o perfil de suítes e a confiança TLS, com os dados gerados.
- `internal/pool/`: HTTP/1.1 com mTLS, pool keep-alive por identidade e a contabilidade de cada conexão.
- `internal/signer/`: identidades `remote` e `pkcs11`, titular do certificado e a validação do `dfe.sign`.
- `internal/audit/`, `internal/testpki/` (PKI dos testes), `internal/p11lab/` e `tools/p11lab/` (token SoftHSM descartável para os testes).

## Build e testes

```sh
bun helpers/signer-tls/scripts/build.ts [--only host] [--verify]   # dist/ com SHA256SUMS; --verify compila duas vezes e compara
bun helpers/signer-tls/scripts/build.ts --merge a --merge b --out d # junta os dist/ dos jobs do CI, conferindo os hashes
bun helpers/signer-tls/scripts/npm.ts [--require-p11] [--pack]      # monta os pacotes npm a partir de dist/ e gera os tarballs
bun helpers/signer-tls/scripts/smoke.ts --tarballs dir              # publica num verdaccio, instala o @sinete/signer e faz o hello
bun helpers/signer-tls/scripts/check.ts                             # gen-data --check, gofmt, go vet e go test nos dois sabores
```

No Ubuntu, o `-p11` dos outros alvos sai com `SINETE_CC_LINUX_ARM64=aarch64-linux-gnu-gcc` e `SINETE_CC_WINDOWS_AMD64=x86_64-w64-mingw32-gcc` (pacotes `gcc-aarch64-linux-gnu`, `libc6-dev-arm64-cross` e `gcc-mingw-w64-x86-64`), como no workflow `signer` do CI. A `bun run smoke` inclui o pacote da plataforma do host quando há Go.

O `bun run check` roda o `scripts/check.ts`; sem Go, só os dados gerados são conferidos. Os testes Go usam PKI gerada na hora e, com `softhsm2-util` e o módulo instalados (Homebrew `softhsm`, Debian `softhsm2`, ou `SOFTHSM2_MODULE`), um token SoftHSM com o par gerado dentro dele. Os testes TS do cliente (`packages/transport/test/signer-*.test.ts` e `packages/emissor/test/signer-a3.test.ts`) compilam o helper em `dist/test/` e sobem o binário de verdade contra o laboratório TLS e o `@sinete/sefaz-sim`. Nada fala com a SEFAZ.

Go: a versão do `toolchain` do `go.mod`. Sem Go no sistema, instale só para o usuário (por exemplo em `~/.local/state/sinete/go/`) ou defina `GO` com o caminho do binário.
