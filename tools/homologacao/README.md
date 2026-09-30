# tools/homologacao

Validação dos pacotes na forma publicada (`@sinete/nfe`, `@sinete/cert`, `@sinete/transport`, `@sinete/cli`, importados pelo nome e resolvidos para o `dist` do build) contra a SEFAZ de homologação, com o certificado A1 real do operador. Workspace privado: não é publicado e não roda no CI (só o teste da guarda roda).

Resultado da última rodada: [docs/validacao-homologacao.md](../../docs/validacao-homologacao.md).

## Decisões que valem aqui

- ADR 0004, seções 6 e 7. Referência: `spikes/s2-tls/real/` (não importe nada de lá).
- A guarda é a `PoliticaDeHosts` do `@sinete/transport` com uma allowlist fechada, escrita à mão em `src/policy.ts`: 15 hosts de NF-e e MDF-e de homologação, só a porta 443, e todo `tpAmb` do corpo igual a 2. Ela roda antes de abrir socket em todo envio. Produção, NFC-e e NFS-e ficam de fora. O `sinete doctor` não recebe política, então o runner confere com ela o endpoint que o doctor vai usar antes de chamá-lo.
- Cada operação grava uma linha em `~/.local/state/sinete/cert-usage.log`: hora, runtime, host, serviço e desfecho. Nunca corpo nem segredo. A assinatura local da NF-e também entra, com host `local`.
- O certificado só existe em memória. Com `--op`, o PFX (base64) e a senha vêm da CLI do 1Password por spawn sem shell; com `--pfx`, do arquivo do operador e da variável de `--senha-env`. Nada é gravado, impresso ou passado em argv de outro processo. A saída do doctor é varrida atrás de chave, senha e trechos do PFX antes de ser mostrada.
- Resultados (JSON, a NF-e assinada, o retorno da SEFAZ) ficam em `~/.local/state/sinete/homologacao/`, fora do repo. A NF-e assinada só tem o certificado público.

## Como rodar com o seu certificado

Pré-requisitos: `bun install` e `bun run build` na raiz (o runner usa o `dist`). O certificado precisa ser e-CNPJ.

```sh
# senha só na variável, nunca em argumento; ou use --op op://cofre/item (campos pfx_base64 e senha)
read -rs SINETE_PFX_SENHA && export SINETE_PFX_SENHA
R=tools/homologacao/src/run.ts
C="--pfx /caminho/empresa.pfx"

node $R doctor $C --uf RS          # sinete doctor em memória + handshake TLS com um host (sem requisição)
node $R status $C                  # statusServico em cada autorizador de NF-e e nos dois SVC
bun $R status $C
deno run -A $R status $C           # hosts que o rustls não alcança são recusados antes do socket
node $R consultas $C --uf SP       # consultaCadastro do próprio CNPJ + uma distribuicaoDFe (distNSU 0) no AN
node $R autorizacao $C --uf SP --emitente emitente.json --serie 1 --nnf 3            # monta, assina e valida; não envia
node $R autorizacao $C --uf SP --emitente emitente.json --serie 1 --nnf 3 --enviar   # envia uma vez
```

`emitente.json` fica fora do repo: `{ "xNome": "...", "CRT": "1", "IE": "...", "endereco": { "xLgr", "nro", "xCpl", "xBairro", "cMun", "xMun", "UF", "CEP" } }` (`IE` é opcional). A NF-e de teste segue o perfil do spike: destinatário igual ao emitente com o nome literal de homologação, um item de R$ 1,00 com CSOSN 102 e PIS e COFINS 49 zerados. Com emitente fora do Simples, troque o grupo de ICMS em `src/run.ts`.

Limites do runner: `autorizacao --enviar` recusa a partir da 2ª tentativa registrada em `autorizacao-tentativas.json`; nenhum comando manda eventos, inutilização ou qualquer coisa de produção. Cada comando roda uma vez por chamada, sem laço.

### Emitente pessoa física com IE (`src/df.ts`)

Runner da rodada 2 (emitente do DF, autorizado pela SVRS): e-CPF do emitente por `--op` (CLI padrão `op-agentes`), guarda `homologacaoDfPolicy` (SVRS, SVC-AN e AN; só status, autorização, consulta protocolo, eventos 110110 e 110111 e Distribuição DF-e), teto de 12 autorizações por diretório de estado (padrão `~/.local/state/sinete/homologacao-df`, onde também fica o `emitente.json`: `{ CPF, xNome, IE, CRT, endereco }`). CPF, IE, nome e chave saem mascarados na saída e no ledger; os arquivos do estado são nomeados por série, número e o fim da chave (cNF e DV), nunca pela chave inteira, e série e número já enviados são recusados.

```sh
D=tools/homologacao/src/df.ts; O="--op op://cofre/item-do-e-cpf"
node $D status $O                                        # SVRS e SVC-AN com cUF 53
node $D emitir $O --cenario base --nnf 1                 # monta, assina e valida; sem --enviar não envia
node $D emitir $O --cenario cst40 --nnf 2 --enviar       # base, cst40, cst30, cst70, cst20
node $D emitir $O --cenario base --nnf 3 --enviar --transmissor-op op://cofre/item-do-e-cnpj   # TLS de terceiro
node $D consultar $O --chave <chave> [--transmissor-op ...]
node $D cce $O --chave <chave> --seq 1 --texto "..."
node $D cancelar $O --chave <chave>                      # nProt lido do retorno gravado no estado
node $D dist $O --ultnsu 0                               # depois de um 137, espere 1 hora (656)
```

Com Deno, o runner resolve os pacotes pelo `node_modules` do workspace (`deno run -A`, sem `npm:`); o transporte do Deno recusa com `nao_suportado` os hosts que pedem o certificado por renegociação ou só oferecem CBC.
