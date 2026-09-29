# Vigia das fontes oficiais

Lê as páginas de onde saem os dados versionados do sinete e compara o que elas listam com `estado.json`. Uma NT nova, um pacote de schemas, um manual ou uma base nova da Calculadora aparecem aqui antes de alguém lembrar de olhar o portal.

Fontes em `src/fontes.ts`: Esquemas XML, Notas Técnicas, Informes Técnicos, Atos Técnicos RFB/CGIBS e Manuais do portal da NF-e; documentos do MDF-e no portal DF-e da SVRS; documentação atual, produção restrita e reforma tributária da NFS-e Nacional; e a Calculadora da RFB. A Calculadora não entra no `estado.json`: a referência dela é o pin de `tools/ibs-cbs-dados/sources.json` (ADR 0007), comparado por `last-modified` e tamanho, sem baixar o zip.

## Uso

```sh
bun tools/fontes-oficiais/src/vigiar.ts                    # relatório no stdout, nada gravado
bun tools/fontes-oficiais/src/vigiar.ts --relatorio r.md   # relatório em arquivo
bun tools/fontes-oficiais/src/vigiar.ts --gravar           # grava o que as páginas listam hoje em estado.json
```

Página que responde sem nenhum item reconhecido conta como falha de leitura (leiaute mudou ou página de erro), não como "tudo saiu", e a fonte mantém o estado anterior.

## No CI

O workflow `fontes-oficiais.yml` roda todo dia. Com diferença, abre (ou atualiza) a issue "Fontes oficiais publicaram novidades" com o relatório; sem diferença, fecha a issue se ela estiver aberta. Com alguma fonte que não deu para ler, o job não mexe na issue (o relatório estaria incompleto) e fica vermelho. Em PR que mexe no vigia, ele só lê e escreve o relatório no resumo do job.

## Fechar a issue

Traga o que for relevante pelo caminho de cada fonte: esquemas pelo `tools/xsd-codegen` (ADR 0002), Calculadora e tabelas pelo `tools/ibs-cbs-dados` (ADR 0007), regras e rejeições pelo `@sinete/nfe` e pelo `tools/rejeicoes-data`. No mesmo PR, rode `--gravar` e revise o diff do `estado.json`. O que não pede mudança (uma NT de regra que fica com a SEFAZ, por exemplo) também entra pelo `--gravar`, com o motivo no PR.

O estado inicial, de 29/set/2026, deixou de fora cinco publicações ainda não avaliadas por completo, para que a primeira execução abra a issue com elas: NT 2026.006 v1.00 (grupo YC e evento 110300 do split payment, homologação em 05/10/2026 e produção em 03/11/2026, preenchimento só a partir de 2027, schemas ainda não publicados), NT 2026.009 v1.00 (regra I08-140, CFOP 1.949 e 2.949 na devolução), NT 2021.003 v1.50 (GTIN da construção civil, validado pela SEFAZ no CCG), NT 2014.001 v1.41 (EPEC, que o sinete ainda não implementa; a v1.40 veda EPEC para PR e PB a partir de 05/10/2026) e IT 2025.004 v1.20 (índice de mistura de biocombustível, da monofasia, que o `@sinete/ibs-cbs` não suporta).

## Fonte nova

Acrescente em `src/fontes.ts` com o extrator que já serve (`portal-nfe`, `portal-dfe`, `gov-br`) ou um novo em `src/extrair.ts`, com teste em `test/`, e rode `--gravar`.
