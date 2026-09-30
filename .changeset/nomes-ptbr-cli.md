---
'@sinete/cli': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Mudanças de comportamento:

- Flags do `doctor`: `--allow-expired` → `--aceitar-vencido` e `--ca` → `--ac`. Os comandos `doctor` e `agents-md` ficam (nome próprio).
- Saída JSON do `doctor`: `checks` → `verificacoes`, `status` → `situacao`, `message` → `mensagem`, `details` → `detalhes`, e as chaves dos detalhes em português (`diasRestantes`, `cadeia`, `situacao`, `vencidos`, `desvioSegundos`, `fonte`, `protocolo`, `cifra`, `certificadoDoCliente`, `statusHttp`). `notBefore` e `notAfter` ficam, como na RFC 5280.

Nomes exportados:

| Antigo | Novo |
|---|---|
| `upsertBloco` | `aplicarBloco` |
| `upsertSkill` | `aplicarSkill` |
| `CheckStatus` | `SituacaoDaVerificacao` |
| `DoctorCheck` | `VerificacaoDoDoctor` |
| `DoctorOptions` | `DoctorOpcoes` |
| `DoctorReport` | `RelatorioDoDoctor` |
| `formatCnpj` | `formatarCnpj` |
| `maskCpf` | `mascararCpf` |
| `maskCpfs` | `mascararCpfs` |
| `parseHttpDate` | `lerDataHttp` |
| `runDoctor` | `rodarDoctor` |
| `openKeyStore` | `abrirCertificado` |
| `CliIo` | `EntradaSaidaCli` |
| `formatReport` | `formatarRelatorio` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `EntradaSaidaCli` | `out.line` | `saida.linha` |
| `EntradaSaidaCli` | `err.line` | `erro.linha` |
| `EntradaSaidaCli` | `promptPassword.question` | `pedirSenha.pergunta` |
| `EntradaSaidaCli` | `readFile.path` | `lerArquivo.caminho` |
| `EntradaSaidaCli` | `writeFile.path` | `gravarArquivo.caminho` |
| `EntradaSaidaCli` | `writeFile.text` | `gravarArquivo.texto` |
| `EntradaSaidaCli` | `doctor.options` | `doctor.opcoes` |
| `VerificacaoDoDoctor` | `status` | `situacao` |
| `VerificacaoDoDoctor` | `message` | `mensagem` |
| `VerificacaoDoDoctor` | `details` | `detalhes` |
| `DoctorOpcoes` | `password` | `senha` |
| `DoctorOpcoes` | `extraChainPem` | `cadeiaAdicionalPem` |
| `DoctorOpcoes` | `extraCaPem` | `acsAdicionaisPem` |
| `DoctorOpcoes` | `allowExpired` | `aceitarVencido` |
| `DoctorOpcoes` | `status` | `consultarStatus` |
| `DoctorOpcoes` | `clockUrl` | `urlDoRelogio` |
| `DoctorOpcoes` | `clock` | `relogio` |
| `RelatorioDoDoctor` | `checks` | `verificacoes` |
| `mascararCpfs` | `text` | `texto` |
| `lerDataHttp` | `value` | `valor` |
| `rodarDoctor` | `options` | `opcoes` |
| `EntradaSaidaCli` | `out` | `saida` |
| `EntradaSaidaCli` | `err` | `erro` |
| `EntradaSaidaCli` | `promptPassword` | `pedirSenha` |
| `EntradaSaidaCli` | `readFile` | `lerArquivo` |
| `EntradaSaidaCli` | `writeFile` | `gravarArquivo` |
| `formatarRelatorio` | `report` | `relatorio` |
