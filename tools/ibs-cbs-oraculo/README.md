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
