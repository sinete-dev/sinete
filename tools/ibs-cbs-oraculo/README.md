# tools/ibs-cbs-oraculo

Teste diferencial do `@sinete/ibs-cbs/calcular` e do `@sinete/ibs-cbs-dados` contra a Calculadora offline da RFB, a mesma versão fixada em `tools/ibs-cbs-dados/sources.json`. Opcional: fica fora do `bun run check` porque precisa de Docker, do zip oficial (cerca de 350 MB) e de alguns minutos. Roda localmente e no workflow `rtc-oracle` (manual e semanal; o agendamento também baixa o zip de novo, fora do cache, para detectar Calculadora nova). Workspace privado, nunca publicado.

## Uso

```sh
bun tools/ibs-cbs-oraculo/run.ts                          # 400 operações, semente 1, sobe e remove o contêiner
bun tools/ibs-cbs-oraculo/run.ts --n 800 --seed 11        # outra amostra
bun tools/ibs-cbs-oraculo/run.ts --keep                   # deixa o contêiner de pé (o nome sai no log)
bun tools/ibs-cbs-oraculo/run.ts --api http://127.0.0.1:PORTA/api --no-build   # contra um contêiner já de pé
bun tools/ibs-cbs-oraculo/run.ts --n 120 --seed 1 --pairs 250 --actors 30 --record   # regrava as fixtures dos testes
```

O relatório vai para `~/.local/state/sinete/ibs-cbs-oraculo/seed<S>-n<N>/report.json` (ou `--out`).

`aliquota.ts` é o ensaio de uma alíquota publicada: aplica a CBS na tabela em memória, imprime o diff de `tools/ibs-cbs-dados/rates.json` e roda o motor e a Calculadora para a vigência. Ver "Quando a resolução do Senado sair", abaixo.

```sh
bun tools/ibs-cbs-oraculo/aliquota.ts --referencia 8.8 --inicio 2027-01-01 --fim 2027-12-31 --sem-oraculo   # só o motor, sem Docker
bun tools/ibs-cbs-oraculo/aliquota.ts --referencia 8.8 --inicio 2027-01-01 --fim 2027-12-31 --n 300         # com a Calculadora
bun tools/ibs-cbs-oraculo/aliquota.ts --cbs 8.7 --inicio 2027-01-01 --fim 2028-12-31 --ato '...' --url '...' --data AAAA-MM-DD --gravar
```

## O que faz

1. Compila os pacotes `@sinete/ibs-cbs-dados` e `@sinete/ibs-cbs` (o oráculo importa pelo `dist`).
2. Baixa o zip (ou lê do cache), confere os hashes, importa o rootfs com `docker import` numa imagem `sinete-ibs-cbs-oraculo/calculadora:<versaoDb>-<diff_id>` e confere o `diff_id` da camada. Sobe um contêiner com nome único (`sinete-ibs-cbs-oraculo-<pid>-<aleatório>`), porta livre só em `127.0.0.1` e `VERSAO_OFFLINE_URL` apontando para um endereço inválido, para nada sair para a rede. Remove só esse contêiner, pelo nome. Nunca usa os scripts oficiais de instalação, que apagam qualquer contêiner com "calculadora" no nome.
3. Gera operações sintéticas com a semente (sem dado pessoal): cClassTrib vigentes e habilitados no modelo, NCM e NBS aplicáveis, bases em bordas de meio centavo, compra governamental, tributação regular, crédito presumido, estorno, transferência e ajuste quando o código exige, alíquotas informadas a partir de 2027. Calcula no motor e no `POST /calculadora/regime-geral` e compara campo a campo, sem tolerância.
4. Confere o dataset contra a API `dados-abertos`: aplicabilidade de NCM e NBS em pares sorteados, filtro por atores e listas de cClassTrib e CST.
5. Falha (saída 1) com divergência que nenhuma entrada do ledger explica, entrada com `expectHits` que não explicou nada, ou diferença no dataset.

## Ledger

`ledger.json` é amarrado à versão da Calculadora (`versaoDb` e sha256 do zip). Cada entrada tem `id`, `kind` (`engine-choice`, `oracle-gap`, `oracle-refuses`), um `match` (desfecho, caminho do campo, diferença máxima, compra governamental, ano, cClassTrib, texto do erro, grupo de entrada), o motivo e a fonte. Vale a primeira que casar. Entradas atuais:

- `credito-presumido-nao-calculado` e `estorno-de-credito-nao-calculado`: a Calculadora não monta `gCredPresOper` nem `gEstornoCred`; o segundo oráculo é o `@sinete/ibs-cbs/validar`.
- `gred-na-tributacao-regular`: 200022 e 200024 com tributação regular; o motor segue a NT (UB26-20, UB27-10) e emite `gRed` com o `pRedAliq` da tabela.
- `diferimento-na-compra-governamental`: a partir de 2027 o motor redistribui o `vDif` junto com o tributo (art. 473); a Calculadora deixa o `gDif` no ente de origem. Rara na amostra, sem `expectHits`.
- `soma-dos-valores-arredondados`: o motor soma os valores de 2 casas, como pedem as regras W; a Calculadora soma os internos (até 0,03 de diferença).
- `oraculo-recusa-tratamento-com-ajuste` e `oraculo-recusa-tipo-de-documento`: códigos e modelos que a Calculadora recusa e o motor calcula.

## Fixtures

`--record` grava `packages/ibs-cbs/test/calcular/fixtures/oracle-cases.json` (entrada, saída do motor, erro do oráculo e as entradas do ledger de cada divergência) e `packages/ibs-cbs-dados/test/fixtures/oracle-data.json`. Os testes unitários conferem essas fixtures sem Docker: mudança de comportamento do motor aparece como diff na fixture, e só se regrava com o oráculo de pé.

## Quando a resolução do Senado sair

A CBS de 2027 e 2028 é a alíquota de referência que o Senado fixar por resolução, menos 0,1 ponto percentual (LC 214/2025, art. 347). Até lá, a linha da CBS de 2027 e 2028 em `rates.json` é `desconhecida`, e toda NF-e com fato gerador em 2027 e item com `gIBSCBS` é recusada com `ibscbs_aliquota_desconhecida`. O aviso chega pela issue do vigia (`tools/fontes-oficiais`, fontes `senado-resolucoes-aliquota-referencia` e `senado-projetos-aliquota-referencia`).

### Por que patch do `@sinete/ibs-cbs`

O `@sinete/nfe` 0.3.0 depende de `@sinete/ibs-cbs` `^0.2.1`. Em 0.x, o `^` só aceita a mesma minor: `^0.2.1` casa com 0.2.2, não com 0.3.0. A alíquota tem de sair como patch (0.2.x) para chegar a quem já usa o `@sinete/nfe` 0.3.0 sem release do `@sinete/nfe`; uma minor do `@sinete/ibs-cbs` só chegaria com uma versão nova do `@sinete/nfe` que dependesse dela. A política também diz patch: corrigir um valor para o que a fonte diz é patch (ADR 0016, seção 3). Quem fixa a versão exata (sem `^`) precisa subir o `@sinete/ibs-cbs` à mão, nas dependências e nos overrides ou `resolutions` que tiver.

O `bun run version` consome todos os changesets pendentes de uma vez. Antes de começar, confira `.changeset/`: um changeset `minor` pendente do `@sinete/ibs-cbs` faria a release sair 0.3.0. Changesets de outros pacotes (o `@sinete/nfe`, por exemplo) saem junto na mesma versão; isso não muda o `^0.2.1` do `@sinete/nfe` 0.3.0 já publicado.

### Passos

1. Confira a resolução no ato publicado: número, data, link do Diário Oficial da União ou da página da norma no Senado, o valor da referência e os anos que ela cobre (só 2027, ou 2027 e 2028).
2. Branch nova a partir da `main`: `git switch -c fix/cbs-2027 origin/main`.
3. Ensaio, sem gravar nada, com a Calculadora (Docker e o zip em cache):

   ```sh
   bun tools/ibs-cbs-oraculo/aliquota.ts --referencia <referência> --inicio 2027-01-01 --fim <2027-12-31 ou 2028-12-31> \
     --ato '<Resolução do Senado Federal nº N, de DD/MM/AAAA>' --url '<link do ato>' --data <AAAA-MM-DD>
   ```

   Revise o diff da tabela (a linha de 2027 e 2028 se divide quando a resolução só cobre 2027), a tabela dos perfis e o resumo. Tem de sair `0 diferentes` na comparação da tabela nova com a mesma alíquota informada e `0 sem explicação` na Calculadora. Se a resolução fixar a CBS nominal e não a referência, use `--cbs` no lugar de `--referencia`. Se a RFB já tiver publicado uma Calculadora que conhece a alíquota do ano, troque o pin primeiro (`tools/ibs-cbs-dados/README.md`) e rode com `--calculadora-com-aliquota`: a Calculadora passa a conferir a alíquota, não só o cálculo.
4. O mesmo comando com `--gravar` grava `tools/ibs-cbs-dados/rates.json`. Depois:

   ```sh
   bun tools/ibs-cbs-dados/extract.ts           # gera packages/ibs-cbs/src/aliquotas/data/rates.json
   bun tools/ibs-cbs-dados/extract.ts --check
   ```

   Se o IT 2026.002 (tabela de alíquotas da CBS) tiver versão nova com o ano, troque o pin em `tools/ibs-cbs-dados/sources.json` no mesmo PR.
5. Testes: os de alíquota desconhecida já usam 2029 e não mudam. Acrescente em `packages/ibs-cbs/test/aliquotas/rates.test.ts` um teste com a CBS oficial do ano (valor, `situacao: 'oficial'`, `legal` citando o ato) e, se a linha se dividiu, com 2028 ainda `desconhecida`.
6. Texto que cita a CBS de 2027 como desconhecida: `packages/ibs-cbs/README.md` (seção "Estados"), `docs/guia/erros/ibscbs_aliquota_desconhecida.md` (seção "Causa"), `docs/adr/0007-rtc-dados-e-oraculo.md` (seção "Alíquotas", como revisão datada) e `docs/guia/como-fazer/ibs-cbs.md`. Confira com `grep -rn "2027" packages/ibs-cbs/README.md docs/guia docs/adr/0007-rtc-dados-e-oraculo.md`.
7. Vigia: `bun tools/fontes-oficiais/src/vigiar.ts --gravar` registra a resolução no `estado.json`, e a issue fecha sozinha depois do merge. Se outras fontes tiverem pendências na issue, acrescente à mão só os itens do Senado (README do vigia).
8. Changeset só do `@sinete/ibs-cbs`, `patch`, com a fonte (o guarda-chuva `sinete` sobe em patch sozinho):

   ```md
   ---
   '@sinete/ibs-cbs': patch
   ---

   CBS de <ano(s)>: <x>% (alíquota de referência de <y>% fixada pela <ato>, menos 0,1 ponto percentual, LC 214/2025, art. 347). Nota com fato gerador nesse período deixa de ser recusada com `ibscbs_aliquota_desconhecida`.
   ```

9. `bun run check`, PR, review, merge.
10. Versão: `bun run version` num PR à parte (confira no diff que o `@sinete/ibs-cbs` foi para 0.2.x), merge, `bun run release:tag` e `bun run release:push` (nunca `git push --tags`: com mais de três tags o GitHub não dispara a publicação, ver `docs/release.md`).
11. Depois de publicado: `npm view @sinete/ibs-cbs version` e, num diretório vazio, `npm install @sinete/nfe@0.3.0 && npm ls @sinete/ibs-cbs` tem de mostrar a patch nova.
12. Quem integra: atualizar o `@sinete/ibs-cbs` no lockfile (ou na versão fixada) e emitir uma nota de teste com fato gerador no ano, sem alíquota informada. Quem estava emitindo com a alíquota informada (`comAliquotasInformadas`) tira a sobreposição: a montagem deixa de marcar `aliquotasInformadas` na nota.
