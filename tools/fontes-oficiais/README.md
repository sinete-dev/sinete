# Vigia das fontes oficiais

Lê as páginas de onde saem os dados versionados do sinete e compara o que elas listam com `estado.json`. Uma NT nova, um pacote de schemas, um manual ou uma base nova da Calculadora aparecem aqui antes de alguém lembrar de olhar o portal.

Fontes em `src/fontes.ts`: Esquemas XML, Notas Técnicas, Informes Técnicos, Atos Técnicos RFB/CGIBS e Manuais do portal da NF-e; documentos do MDF-e no portal DF-e da SVRS; documentação atual, produção restrita e reforma tributária da NFS-e Nacional; a Calculadora da RFB; e, no Senado, a resolução que fixa a alíquota de referência do IBS/CBS e os projetos de resolução sobre ela. A Calculadora não entra no `estado.json`: a referência dela é o pin de `tools/ibs-cbs-dados/sources.json` (ADR 0007), comparado por `last-modified` e tamanho, sem baixar o zip.

## Uso

```sh
bun tools/fontes-oficiais/src/vigiar.ts                    # relatório no stdout, nada gravado
bun tools/fontes-oficiais/src/vigiar.ts --relatorio r.md   # relatório em arquivo
bun tools/fontes-oficiais/src/vigiar.ts --gravar           # grava o que as páginas listam hoje em estado.json
```

Página que responde sem nenhum item reconhecido conta como falha de leitura (leiaute mudou ou página de erro), não como "tudo saiu", e a fonte mantém o estado anterior.

## Alíquota de referência no Senado

A CBS de 2027 e 2028 é a alíquota de referência fixada por resolução do Senado menos 0,1 ponto percentual (LC 214/2025, art. 347), e o `@sinete/ibs-cbs` recusa a nota com fato gerador em 2027 até ter esse número. Duas fontes vigiam a publicação, pelos dados abertos do Senado (`legis.senado.leg.br/dadosabertos`), que respondem em JSON e não dependem do leiaute de uma página:

- `senado-resolucoes-aliquota-referencia`: todas as resoluções do Senado (`legislacao/lista.json?tipo=RSF`), filtradas pela ementa;
- `senado-projetos-aliquota-referencia`: os projetos de resolução em tramitação (`processo?sigla=PRS&tramitando=S`), filtrados pela ementa. Avisa antes: o projeto aparece ao ser apresentado e sai da lista quando vira resolução.

O filtro (`ementaDaAliquotaDeReferencia`) casa "alíquota(s) de referência", "Contribuição Social sobre Bens e Serviços", "Imposto sobre Bens e Serviços", CBS e IBS, sem acento e sem caixa. Em 01/10/2026 nenhuma das 6.578 resoluções nem dos 275 projetos em tramitação casava, e o estado inicial dessas duas fontes é a lista vazia: só uma publicação nova abre a issue. Aqui a lista vazia é o normal; falha de leitura é a resposta sem a lista de normas ou de processos. A busca do Diário Oficial da União ficou de fora: a página muda e bloqueia acesso automatizado, e a resolução entra nos dados abertos do Senado depois de publicada.

Quando uma dessas fontes aparecer na issue, siga `tools/ibs-cbs-oraculo/README.md`, seção "Quando a resolução do Senado sair".

## No CI

O workflow `fontes-oficiais.yml` roda todo dia. Com diferença, abre (ou atualiza) a issue "Fontes oficiais publicaram novidades" com o relatório; sem diferença, fecha a issue se ela estiver aberta. Com alguma fonte que não deu para ler, o job não mexe na issue (o relatório estaria incompleto) e fica vermelho. Em PR que mexe no vigia, ele só lê e escreve o relatório no resumo do job.

## Quando começar o trabalho

Uma NT é revisada várias vezes antes de valer, e os schemas costumam sair depois dela. Por isso o trabalho sobre uma publicação só começa quando ela já está ativa no ambiente de homologação, ou quando tudo o que ela pede já foi publicado (NT na versão que vai valer e os schemas correspondentes). Até lá, a issue do vigia fica aberta como registro do que falta, sem implementação antecipada.

## Fechar a issue

Traga o que for relevante pelo caminho de cada fonte: esquemas pelo `tools/xsd-codegen` (ADR 0002), Calculadora e tabelas pelo `tools/ibs-cbs-dados` (ADR 0007), regras e rejeições pelo `@sinete/nfe` e pelo `tools/rejeicoes-data`. No mesmo PR, rode `--gravar` e revise o diff do `estado.json`. O que não pede mudança (uma NT de regra que fica com a SEFAZ, por exemplo) também entra pelo `--gravar`, com o motivo no PR.

O estado inicial, de 29/set/2026, deixou de fora cinco publicações que ficam registradas para voltar depois, pela regra acima, para que a primeira execução abra a issue com elas: NT 2026.006 v1.00 (grupo YC e evento 110300 do split payment, homologação em 05/10/2026 e produção em 03/11/2026, preenchimento só a partir de 2027, schemas ainda não publicados), NT 2026.009 v1.00 (regra I08-140, CFOP 1.949 e 2.949 na devolução), NT 2021.003 v1.50 (GTIN da construção civil, validado pela SEFAZ no CCG), NT 2014.001 v1.41 (EPEC, que o sinete ainda não implementa; a v1.40 veda EPEC para PR e PB a partir de 05/10/2026) e IT 2025.004 v1.20 (índice de mistura de biocombustível, da monofasia, que o `@sinete/ibs-cbs` não suporta).

## Fonte nova

Acrescente em `src/fontes.ts` com o extrator que já serve (`portal-nfe`, `portal-dfe`, `gov-br`, `senado-normas`, `senado-processos`) ou um novo em `src/extrair.ts`, com teste em `test/`, e rode `--gravar`. Se outras fontes tiverem publicações deixadas de fora de propósito (seção acima), o `--gravar` as apagaria do estado: nesse caso, acrescente à mão só a entrada da fonte nova em `estado.json`, como foi feito com as do Senado.
