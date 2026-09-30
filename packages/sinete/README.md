# sinete

O sinete monta, valida, assina, transmite e guarda NF-e, NFC-e, MDF-e e NFS-e Nacional em TypeScript para sistemas que emitem ou leem documentos fiscais brasileiros. O pacote reúne emissor com estado, documentos auxiliares, IBS/CBS, certificado A1 e transporte, sem exigir binário nativo, JDK ou openssl externo.

Roda em Node (`^20.19.0 || >=22.12.0`), Bun, Deno e no browser, conforme o suporte de cada pacote. No browser, monta, valida e assina; a transmissão fica no servidor.

**Pré-alfa, API instável até a 1.0.** Os comandos abaixo descrevem a instalação e o diagnóstico do pacote:

```sh
npm install sinete
npx sinete doctor --pfx empresa.pfx
```

A senha do PFX vem do ambiente, em `SINETE_PFX_SENHA`. O `doctor` nunca mostra a chave nem a senha.

Os imports escolhem a parte usada pelo sistema:

```ts
import { buildNfe, createNfeClient, signNfe } from 'sinete/nfe';
import { createNfeEmissor } from 'sinete/emissor/nfe';
import { determinar } from 'sinete/nfe/ibs-cbs';
import { danfe, toPdf } from 'sinete/da/nfe';
import { damdfe } from 'sinete/da/mdfe';
import { cnpjValido } from 'sinete/validators';
```

Para emitir com retomada, o emissor grava os bytes assinados no banco da aplicação antes de enviar. Se a resposta se perder, consulta a chave e retoma com esses bytes, evitando que uma nova montagem transforme a tentativa em outra nota. A aplicação fornece o `TransmissaoStore` e o `aoDecidir` idempotente que guarda o documento.

## Documentação e agentes de código

Comece por `node_modules/sinete/docs/index.md`: a documentação embarcada corresponde à versão instalada. O tutorial da primeira NF-e usa a SEFAZ simulada e certificado sintético, mostra a recuperação depois de uma queda e gera o DANFE. Os guias tratam de store SQL, retomada, vários emitentes, contingência, cancelamento, CC-e, NFC-e, MDF-e, NFS-e, IBS/CBS, browser e documentos auxiliares. Há também explicações, referência dos tipos e uma página por código de erro.

Para orientar o agente de código do projeto por essa versão, rode na raiz:

```sh
npx sinete agents-md
```

O comando acrescenta o bloco do sinete ao `AGENTS.md`, delimitado por `<!-- BEGIN:sinete-agent-rules -->` e `<!-- END:sinete-agent-rules -->`, preservando o restante. Também cria `CLAUDE.md` com `@AGENTS.md` se o arquivo não existir, e instala a skill `sinete` em `.claude/skills/sinete/` e `.agents/skills/sinete/`, que manda ler a mesma documentação (`--sem-skill` não a instala; uma skill `sinete` sua, sem a linha `<!-- sinete-skill: ... -->`, não é tocada).

O bloco pede a leitura de `node_modules/sinete/docs/` antes de escrever código, inclui regras para evitar nota duplicada e um índice de pacotes e verbos. Como a API muda e o domínio fiscal é pouco coberto no treino dos modelos, isso dá ao agente uma referência da versão em uso. Execute novamente após atualizar o pacote; `--imprimir` apenas mostra o bloco. O campo `docs` de cada erro aponta para sua página em `erros/<code>.md`.

## Como funciona

O guarda-chuva oferece somente subpaths: `sinete/<pacote>[/<subpath>]` reexporta `@sinete/<pacote>[/<subpath>]` sem copiar a implementação. A função e a classe de erro são as mesmas pelos dois caminhos, e o bundler leva só o que foi importado. `import 'sinete'` não resolve de propósito, porque um índice geral puxaria dados de IBS/CBS, schemas e layouts mesmo para quem precisa de uma parte.

Cada dependência `@sinete/*` fica numa versão exata. Assim, uma versão do `sinete` representa o conjunto que passou junto pela smoke. Para trocar um pacote isoladamente, instale o `@sinete/*` direto.

O bin `sinete` executa a CLI de `@sinete/cli`, com `doctor` e `agents-md`. O simulador `@sinete/sefaz-sim` fica fora do guarda-chuva e deve ser instalado como dependência de desenvolvimento.

## Subpaths

| Subpath | Pacote |
|---|---|
| `sinete/nfe`, `sinete/nfe/ibs-cbs` | `@sinete/nfe` |
| `sinete/mdfe` | `@sinete/mdfe` |
| `sinete/nfse` | `@sinete/nfse` |
| `sinete/emissor`, `sinete/emissor/nfe`, `/mdfe`, `/nfse`, `/memoria`, `/contrato` | `@sinete/emissor` |
| `sinete/da`, `sinete/da/nfe`, `sinete/da/nfce`, `sinete/da/mdfe`, `sinete/da/cce` | `@sinete/da` |
| `sinete/ibs-cbs`, `sinete/ibs-cbs/aliquotas`, `/calcular`, `/validar`, `/determinar` | `@sinete/ibs-cbs` |
| `sinete/ibs-cbs-dados`, `sinete/ibs-cbs-dados/bundled` | `@sinete/ibs-cbs-dados` |
| `sinete/validators` | `@sinete/validators` |
| `sinete/cert` | `@sinete/cert` |
| `sinete/transport` | `@sinete/transport` |
| `sinete/rejeicoes`, `sinete/rejeicoes/mdfe`, `sinete/rejeicoes/nfse` | `@sinete/rejeicoes` |
| `sinete/schemas`, `sinete/schemas/nfe/PL_010f` e os demais schemas | `@sinete/schemas` |
| `sinete/core`, `sinete/core/xml` | `@sinete/core` |

No repositório, `scripts/umbrella.ts` gera `package.json` e os arquivos de `src/` a partir do `exports` dos pacotes. O `bun run check` falha quando eles ficam fora de sincronia. Os critérios de divisão estão no ADR 0008.

## Licença

Apache-2.0.
