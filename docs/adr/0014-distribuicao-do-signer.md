# ADR 0014: onde mora o cliente do sinete-signer e como o binário chega a quem instala

- Status: proposto
- Data: 28/set/2026
- Complementa o [ADR 0005](0005-signer-tls-nativo.md) (o helper) e aplica o [ADR 0008](0008-divisao-de-pacotes.md) (critérios de pacote).

## Contexto

O ADR 0005 decidiu o helper nativo `sinete-signer` em Go, com dois sabores (estático e `-p11` com cgo), e deixou duas perguntas: onde fica o cliente TS do protocolo e como o binário chega ao projeto de quem usa. Havia um pacote reservado para o contrato (`@sinete/signer-contract`), que o ADR 0008 já tirou de `packages/`, e o ADR 0005 citava de passagem `optionalDependencies` por plataforma no padrão do esbuild.

As restrições que valem aqui:

- Quem usa A1 em Node ou Bun não pode carregar binário nenhum (ADR 0005, consequências). Isso vale também para quem instala o guarda-chuva `sinete`, que cobre o `@sinete/transport`.
- O Bun não roda script de instalação de dependência sem `trustedDependencies`; o pnpm 10 também bloqueia por padrão; CI corporativo costuma instalar com `--ignore-scripts`. Um `postinstall` que baixa o binário falha em silêncio nesses três casos.
- O binário tem política de segurança compilada (a lista de hosts), então precisa de proveniência verificável e de versão amarrada ao protocolo.
- O sabor `-p11` depende de um compilador C para o alvo (Linux com glibc, Windows com MinGW ou MSVC, macOS com clang) e não compila cruzado a partir do macOS, exceto as duas arquiteturas do macOS (verificado: `clang -arch x86_64` a partir do arm64). A partir do Ubuntu, compila cruzado com os compiladores do próprio Ubuntu (revisão de 28/set, abaixo).

## Decisão

### 1. O cliente é o subpath `@sinete/transport/signer`

Pelos critérios do ADR 0008, o cliente não justifica pacote: não traz dependência pesada (usa `@sinete/cert` e o core, que o transporte já usa), muda no mesmo ritmo do `Transport` (a identidade `helper` é do transporte) e o transporte já é o pacote com entradas por runtime (critério 3). Então é subpath, com duas condições:

- `default` (puro): `connectSignerChannel` fala o protocolo sobre qualquer canal de linhas, o que serve ao stdio, ao socket Unix e a um relay por WebSocket até o navegador; `cryptoKeyTlsSigner`, `digestTlsSigner`, `certificadoAberto` e `parseTlsTranscript`.
- `node`: acrescenta `startSigner` (sobe o binário com o ambiente mínimo) e `connectSigner` (socket Unix do helper em contêiner).

O `TlsIdentity` fica com `pem` e `helper`. Os tipos `external` e `pkcs11` que o ADR 0005 previa saem: quem sobe o helper e abre a identidade é o subpath (`openRemote`, `openPkcs11`), que devolve uma identidade `helper`. O transporte continua sem `child_process` e sem saber onde está o binário, e há um caminho só.

### 2. O binário vem por `optionalDependencies` por plataforma

- `@sinete/signer-<os>-<cpu>`, com o nome de plataforma do npm (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `win32-x64`, `win32-arm64`), `os` e `cpu` no package.json e `bin/sinete-signer` (estático) mais `bin/sinete-signer-p11` (cgo) quando houver: em todos menos o `win32-arm64`, que só tem o estático. O gerenciador instala só o da plataforma, sem script, pelo mesmo registry e com o mesmo lockfile e a mesma integridade do resto.
- `@sinete/signer`, o lançador: `signerBinary()` acha o binário pelo resolvedor do Node, e `startSigner` é o do `@sinete/transport/signer` já com esse binário. Lista os pacotes de plataforma em `optionalDependencies` na versão exata.
- Os pacotes do helper são separados do `@sinete/transport` pelo critério 1 (seis a sete MB por binário) e pelo 2 (o helper muda quando mudam os dados compilados, o Go ou o protocolo, não quando muda o transporte). Ficam fora do guarda-chuva `sinete`, como o `@sinete/sefaz-sim`: quem precisa de A3 instala `@sinete/signer` à parte.
- O download verificado por hash fica como caminho secundário, não como mecanismo de instalação: os binários também vão para os assets da release com `SHA256SUMS`, para imagem de contêiner e para quem não usa npm, e `startSigner` aceita `binary` ou `SINETE_SIGNER_BIN` e `SINETE_SIGNER_P11_BIN`.

Por que não download no `postinstall`: falha em silêncio nos três gerenciadores e CIs citados, precisa de rede fora do registry (proxy corporativo, instalação offline, espelho interno) e tira o binário da integridade do lockfile. Por que não um pacote só com todos os binários: uns 75 MB por instalação (seis estáticos e cinco `-p11`, de 6 a 7 MB cada) para usar um.

### 3. Versão e compatibilidade

O helper tem versão própria (`helpers/signer-tls/VERSION`). O cliente não confere a versão do helper, confere o protocolo: `hello` com `protocol` diferente de `SIGNER_PROTOCOL_VERSION` vira `signer_protocolo`. O `@sinete/signer` depende de `@sinete/transport` com `^`, e o protocolo só sobe em mudança incompatível (`docs/signer-contract/PROTOCOL.md`).

## Revisão de 28/set/2026: o que o build no CI mostrou

O workflow `.github/workflows/signer.yml` monta a distribuição inteira em PR, sem publicar. O que mudou em relação à decisão acima, medido em contêiner Ubuntu 22.04 amd64 e arm64 e no macOS arm64:

- **O `-p11` compila cruzado a partir do Ubuntu.** O `miekg/pkcs11` só faz `dlopen` do módulo do fabricante e traz os cabeçalhos, então não há biblioteca do alvo para ligar: `gcc-aarch64-linux-gnu` gera o `linux-arm64` e `gcc-mingw-w64-x86-64` gera o `windows-amd64`, a partir do runner amd64. O runner nativo por SO deixa de ser necessário para compilar; continua necessário para a smoke. São dois jobs de build: Ubuntu 22.04 (os seis estáticos e o `-p11` de linux amd64, linux arm64 e windows amd64) e macOS (o `-p11` das duas arquiteturas darwin). O `build.ts` lê o compilador de cada alvo em `SINETE_CC_<GOOS>_<GOARCH>`.
- **O `-p11` do Linux exige glibc 2.34 ou mais nova.** Compilado no Ubuntu 22.04, o binário pede `GLIBC_2.34` (Ubuntu 22.04, Debian 12 e RHEL 9 em diante); no Debian 11 ele não sobe. O job fica no `ubuntu-22.04` de propósito e barra o build se a exigência subir. Distribuição mais antiga usa o estático ou o helper em contêiner (`--socket`), como o musl.
- **Windows arm64 entra só com o estático** (`@sinete/signer-win32-arm64`): o Ubuntu não empacota compilador cruzado para ele, e o token no Windows arm64 não tem demanda que justifique um runner próprio agora.
- **Os estáticos saem idênticos no Linux e no macOS.** O job do macOS compila os estáticos também, e o `build.ts --merge` exige o mesmo SHA-256 quando dois jobs trazem o mesmo arquivo: a reprodutibilidade fica conferida entre hosts diferentes, além do `--verify` (dois builds no mesmo host).
- **Proveniência:** os binários e os tarballs recebem atestado do GitHub (`actions/attest-build-provenance`) fora de PR e só com o repositório público, porque atestado em repositório privado exige GitHub Enterprise Cloud. O `npm publish --provenance` fica para a publicação real.
- **Smoke:** o `smoke/run.ts` compila a plataforma do host, publica o pacote dela e o lançador no verdaccio e sobe o helper pelo `@sinete/signer` (os dois sabores). No workflow, cada SO instala o tarball da própria plataforma e faz o mesmo `hello`: Linux x64 e arm64 (`ubuntu-latest`, `ubuntu-24.04-arm`), macOS arm64 (`macos-latest`) e Windows x64 e arm64 (`windows-latest`, `windows-11-arm`) sempre, porque os runners arm64 padrão atendem repositório privado desde jan/2026; macOS Intel (`macos-15-intel`, a última imagem x86_64 do GitHub, anunciada até ago/2027) só com o repositório público, para não gastar minuto de macOS a mais no privado. Quando essa imagem sair, o `darwin-x64` fica sem smoke nativa e continua coberto pelo build.
- **Verdaccio e Node 20:** o verdaccio 6.9 em diante exige Node 22, e a perna Node 20.19 da smoke do `ci.yml` falhava ao subir o registry (também no `main`). O verdaccio passa a rodar num Node 24 separado (`VERDACCIO_NODE`), e a versão da matriz continua sendo a dos consumidores.

## O que já está no repositório e o que fica pendente

Feito nesta mudança, e barato de manter:

- `helpers/signer-tls/scripts/build.ts`: build reproduzível (`-trimpath`, `-buildvcs=false`, `-ldflags "-s -w -buildid="`, `-mod=readonly`, `toolchain` fixo no `go.mod`) dos cinco estáticos e dos `-p11` que a máquina compila, com `SHA256SUMS` e `--verify`, que compila duas vezes e compara. Medido no macOS arm64 com Go 1.26.6: sete binários idênticos nos dois builds.
- `helpers/signer-tls/scripts/npm.ts`: monta os pacotes de plataforma e o lançador (modelo em `helpers/signer-tls/npm/signer/`) a partir do build, conferindo cada binário contra o `SHA256SUMS`.
- `packages/transport/test/signer-npm.test.ts`: monta os pacotes da plataforma local, instala num projeto consumidor e sobe o helper pelo lançador, no Node.
- `bun run check` roda gofmt, go vet e go test nos dois sabores (com SoftHSM quando instalado) e a compilação cruzada para o Windows; o CI instala Go e SoftHSM no job `check`.
- `.github/workflows/signer.yml` (revisão acima): build por plataforma e sabor, `build.ts --merge`, `npm.ts --require-p11 --pack`, `npm publish --dry-run`, atestado quando público e a smoke por SO com `scripts/smoke.ts`. Roda em PR que toca o helper, no `main` e na tag `sinete-signer@<versão>`, que precisa bater com `VERSION`.

Pendente, e registrado aqui para não se perder:

1. **Publicação real**, no job `package` do `signer.yml` com o repositório público: tirar o `--dry-run`, publicar com `--provenance` cada pacote de plataforma antes do lançador (trusted publisher, como o `release` do `ci.yml`), e criar a release da tag com os binários e o `SHA256SUMS` nos assets. O `scripts/release.ts` não publica nada disso: ele só vê `packages/*` e `tools/*`.
2. **Assinatura de código**: notarização no macOS e Authenticode no Windows, para o agente desktop com token (o SmartScreen e o Gatekeeper barram binário sem assinatura baixado pelo navegador; pelo npm, não).
3. **Linux com musl** (Alpine) e glibc anterior à 2.34: o estático roda; o `-p11` não. Quem precisa de token nesses sistemas usa o helper em contêiner próprio (`--socket`) com base glibc recente.
4. Trusted publisher no npm para os sete nomes novos.

## Consequências

- Quem usa A1 não muda nada e não baixa binário. Quem usa A3 instala `@sinete/signer` (quando o job de release existir) ou aponta `binary` para o binário da release.
- O `@sinete/transport` publica o cliente para todo mundo, inclusive no browser, onde ele serve de base para o relay por WebSocket.
- Enquanto o job de release não existir, o `@sinete/signer` não é publicado; a documentação embarcada descreve o caminho por `binary` e `SHA256SUMS`, que é o que funciona hoje.
