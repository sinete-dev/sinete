# Como implementar o `TransmissaoStore` num banco SQL

O emissor do sinete (`@sinete/emissor`) não conhece o seu banco: ele recebe um `TransmissaoStore`, que guarda os bytes assinados de cada documento até o serviço fiscal decidir e controla a trava entre processos. Para os documentos estaduais, esse serviço é o da Secretaria da Fazenda (SEFAZ). Esta página mostra um adaptador completo para PostgreSQL e como verificar seu comportamento com a suíte de contrato `@sinete/emissor/contrato`. Um adaptador errado pode produzir nota duplicada, então não pule a suíte.

## O que o store precisa garantir

- **Trava com prazo, por documento.** `travar(tipo, ref, prazoMs)` pega a trava se não houver outra em vigor; uma trava vencida é assumida por quem chega, e o dono antigo perde o direito de gravar, descartar e renovar. `ref` é o identificador do documento no sistema do integrador. `tipo` (`nfe`, `mdfe`, `nfse`) faz parte da chave: a Nota Fiscal Eletrônica (NF-e) e o Manifesto Eletrônico de Documentos Fiscais (MDF-e) com a mesma `ref` têm travas separadas. `nfse` identifica a Nota Fiscal de Serviço Eletrônica (NFS-e).
- **Bytes gravados uma vez.** `gravar` só grava com a trava em vigor (senão lança `ErroTravaPerdida`) e se não houver bytes guardados (senão lança `ErroTransmissaoJaGravada`). Nos dois casos de erro, nada muda.
- **Relógio do banco.** Prazo, renovação, "parado há" e "assinado há" são comparados com o `now()` do banco. A interface recebe durações (`prazoMs`, `idadeMaximaMs`), nunca instantes calculados no processo: dois servidores com relógios diferentes poderiam discordar sobre o vencimento de uma trava.
- **`concluir` idempotente e sem exigir a trava em vigor.** Repetir a chamada não muda o resultado, mas ela só limpa a gravação se o `token` ainda for o do dono. A gravação de quem assumiu a trava fica.
- **Seleção da retomada automática.** `listarPendentes` devolve as gravações sem trava em vigor e dentro do filtro, com as nunca tentadas primeiro. `registrarTentativa` conta a tentativa só na mesma `gravacao` e marca o alerta uma única vez.

## A tabela

Uma linha por documento (`tipo`, `ref`), com a trava e os bytes na mesma linha:

```sql
CREATE TABLE transmissao (
  tipo text NOT NULL,
  ref text NOT NULL,
  token text,
  trava_ate timestamptz,
  xml text,
  id text,
  meta jsonb,
  gravacao text,
  assinado_em timestamptz,
  tentativas integer NOT NULL DEFAULT 0,
  ultima_tentativa_em timestamptz,
  alertado_em timestamptz,
  atividade_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, ref)
);
```

`xml` é texto, exatamente a string que o emissor entregou. Nunca guarde o XML assinado num tipo ou por meio de uma conversão que o reformate: mudanças no conteúdo assinado podem invalidar a assinatura. Use `text`, sem interpretar e serializar o XML novamente.

## O adaptador

O exemplo usa uma interface `Sql` mínima: recebe o texto com parâmetros `$1`, `$2`... e devolve as linhas em `rows`. Você pode implementá-la sobre `pg`, `postgres` ou PGlite, adaptando a chamada e o retorno do driver. As escritas cujo resultado precisa ser conferido usam `RETURNING` para saber se alguma linha mudou. Configure o driver para devolver `timestamptz` como `Date` e `jsonb` como objeto, conforme o tipo `Linha`.

```ts
import type {
  FiltroPendentes,
  GravacaoTransmissao,
  RegistroTransmissao,
  TransmissaoStore,
  Trava,
} from 'sinete/emissor';
import { ErroTransmissaoJaGravada, ErroTravaPerdida } from 'sinete/emissor';

/** O mínimo do driver: texto com $1, $2... e as linhas devolvidas (use RETURNING para saber o que mudou). */
export interface Sql {
  query<T>(texto: string, params: readonly unknown[]): Promise<{ readonly rows: readonly T[] }>;
}

interface Linha {
  tipo: 'nfe' | 'mdfe' | 'nfse';
  ref: string;
  xml: string;
  id: string;
  meta: Record<string, unknown>;
  gravacao: string;
  assinado_em: Date;
  tentativas: number;
  ultima_tentativa_em: Date | null;
  alertado_em: Date | null;
}

const COLUNAS = 'tipo, ref, xml, id, meta, gravacao, assinado_em, tentativas, ultima_tentativa_em, alertado_em';
/** Milissegundos como intervalo, comparado com o relógio do banco. */
const ms = (n: number): string => `($${n}::double precision * interval '1 millisecond')`;

function registro(l: Linha): RegistroTransmissao {
  return {
    tipo: l.tipo,
    ref: l.ref,
    xml: l.xml,
    id: l.id,
    meta: l.meta,
    gravacao: l.gravacao,
    assinadoEm: l.assinado_em,
    tentativas: l.tentativas,
    ...(l.ultima_tentativa_em === null ? {} : { ultimaTentativaEm: l.ultima_tentativa_em }),
    ...(l.alertado_em === null ? {} : { alertadoEm: l.alertado_em }),
  };
}

export function createPgStore(sql: Sql): TransmissaoStore {
  return {
    async travar(tipo, ref, prazoMs) {
      const token = crypto.randomUUID();
      const r = await sql.query<{ token: string }>(
        `INSERT INTO transmissao (tipo, ref, token, trava_ate, atividade_em)
         VALUES ($1, $2, $3, now() + ${ms(4)}, now())
         ON CONFLICT (tipo, ref) DO UPDATE
           SET token = excluded.token, trava_ate = excluded.trava_ate, atividade_em = now()
           WHERE transmissao.token IS NULL OR transmissao.trava_ate <= now()
         RETURNING token`,
        [tipo, ref, token, prazoMs],
      );
      return r.rows.length === 1 ? { tipo, ref, token } : undefined;
    },

    async renovar(t, prazoMs) {
      const r = await sql.query(
        `UPDATE transmissao SET trava_ate = now() + ${ms(4)}, atividade_em = now()
         WHERE tipo = $1 AND ref = $2 AND token = $3 AND trava_ate > now() RETURNING ref`,
        [t.tipo, t.ref, t.token, prazoMs],
      );
      return r.rows.length === 1;
    },

    async soltar(t) {
      await sql.query('DELETE FROM transmissao WHERE tipo = $1 AND ref = $2 AND token = $3 AND xml IS NULL', [
        t.tipo,
        t.ref,
        t.token,
      ]);
      await sql.query(
        `UPDATE transmissao SET token = NULL, trava_ate = NULL, atividade_em = now()
         WHERE tipo = $1 AND ref = $2 AND token = $3`,
        [t.tipo, t.ref, t.token],
      );
    },

    async ler(tipo, ref) {
      const r = await sql.query<Linha>(
        `SELECT ${COLUNAS} FROM transmissao WHERE tipo = $1 AND ref = $2 AND xml IS NOT NULL`,
        [tipo, ref],
      );
      const l = r.rows[0];
      return l === undefined ? undefined : registro(l);
    },

    async gravar(t: Trava, g: GravacaoTransmissao) {
      // Reserve a numeração do emitente aqui, na mesma transação, se o seu sistema numera ao gravar.
      const r = await sql.query<Linha>(
        `UPDATE transmissao
         SET xml = $4, id = $5, meta = $6, gravacao = $7, assinado_em = now(), tentativas = 0,
             ultima_tentativa_em = NULL, alertado_em = NULL, atividade_em = now()
         WHERE tipo = $1 AND ref = $2 AND token = $3 AND trava_ate > now() AND xml IS NULL
         RETURNING ${COLUNAS}`,
        [t.tipo, t.ref, t.token, g.xml, g.id, JSON.stringify(g.meta), crypto.randomUUID()],
      );
      const l = r.rows[0];
      if (l !== undefined) return registro(l);
      const dono = await sql.query(
        `SELECT ref FROM transmissao
         WHERE tipo = $1 AND ref = $2 AND token = $3 AND trava_ate > now() AND xml IS NOT NULL`,
        [t.tipo, t.ref, t.token],
      );
      if (dono.rows.length === 1) throw new ErroTransmissaoJaGravada('já há bytes gravados: retome com eles');
      throw new ErroTravaPerdida('a trava venceu: outro processo pode ter assumido');
    },

    async descartar(t) {
      const r = await sql.query(
        `UPDATE transmissao
         SET xml = NULL, id = NULL, meta = NULL, gravacao = NULL, assinado_em = NULL, tentativas = 0,
             ultima_tentativa_em = NULL, alertado_em = NULL, atividade_em = now()
         WHERE tipo = $1 AND ref = $2 AND token = $3 AND trava_ate > now() RETURNING ref`,
        [t.tipo, t.ref, t.token],
      );
      if (r.rows.length === 0) throw new ErroTravaPerdida('a trava venceu: outro processo pode ter assumido');
    },

    async concluir(t) {
      await sql.query(
        `UPDATE transmissao
         SET xml = NULL, id = NULL, meta = NULL, gravacao = NULL, assinado_em = NULL, tentativas = 0,
             ultima_tentativa_em = NULL, alertado_em = NULL, atividade_em = now()
         WHERE tipo = $1 AND ref = $2 AND token = $3`,
        [t.tipo, t.ref, t.token],
      );
    },

    async listarPendentes(f: FiltroPendentes) {
      const r = await sql.query<Linha>(
        `SELECT ${COLUNAS} FROM transmissao
         WHERE xml IS NOT NULL
           AND (token IS NULL OR trava_ate <= now())
           AND assinado_em >= now() - ${ms(1)}
           AND atividade_em <= now() - ${ms(2)}
           AND NOT (alertado_em IS NOT NULL AND ultima_tentativa_em > now() - ${ms(3)})
         ORDER BY ultima_tentativa_em IS NOT NULL, ultima_tentativa_em, assinado_em, tipo, ref
         LIMIT $4`,
        [f.idadeMaximaMs, f.paradaHaMs, f.intervaloDepoisDoAlertaMs, f.limite],
      );
      return r.rows.map(registro);
    },

    async registrarTentativa(reg, { alertar }) {
      const r = await sql.query<{ alertou: boolean }>(
        `WITH antes AS (
           SELECT alertado_em FROM transmissao WHERE tipo = $1 AND ref = $2 AND gravacao = $3 FOR UPDATE
         )
         UPDATE transmissao AS t
         SET tentativas = t.tentativas + 1, ultima_tentativa_em = now(), atividade_em = now(),
             alertado_em = CASE WHEN $4::boolean AND t.alertado_em IS NULL THEN now() ELSE t.alertado_em END
         FROM antes
         WHERE t.tipo = $1 AND t.ref = $2 AND t.gravacao = $3
         RETURNING ($4::boolean AND antes.alertado_em IS NULL) AS alertou`,
        [reg.tipo, reg.ref, reg.gravacao, alertar],
      );
      const l = r.rows[0];
      return { registrada: l !== undefined, alertou: l?.alertou === true };
    },
  };
}
```

Este adaptador passou nos 14 casos básicos da suíte de contrato contra o PostgreSQL do PGlite (27/set/2026). Isso verifica os comportamentos cobertos pela suíte nesse ambiente; rode-a também contra a instância que vai para produção. Em MySQL, garanta a existência da linha com `INSERT IGNORE` e pegue a trava com `UPDATE transmissao SET token = ?, trava_ate = NOW(6) + INTERVAL ? MICROSECOND WHERE tipo = ? AND ref = ? AND (token IS NULL OR trava_ate <= NOW(6))`. O intervalo é `prazoMs * 1000`, e a trava foi obtida se o comando afetou uma linha. A regra é a mesma do PostgreSQL: a condição da trava e a escrita devem estar no mesmo comando, usando o relógio do banco.

## Lembrar recusas (opcional)

`registrarRecusa` e `recusaRecente` são opcionais e devem ser implementados juntos. Com os dois, a barreira de recusas fica ligada por padrão: o emissor conta as recusas definitivas iguais de cada par (`tipo`, `ref`), comparando o resumo SHA-256 do conteúdo recusado e o mesmo `cStat`, o código de status da resposta fiscal. Recusas transitórias do serviço, identificadas pelo perfil do documento, não entram nessa conta.

Para comparar o conteúdo, os perfis retiram campos que mudam a cada montagem, como a data e hora de emissão e a assinatura. Na NF-e e no MDF-e, também retiram o código numérico, o dígito verificador e outros campos derivados da chave de acesso. Se a recusa puder ser corrigida justamente num dos campos retirados, o emissor compara o SHA-256 do XML assinado completo, para permitir a correção.

Quando a contagem chega ao limite, 3 por padrão, dentro da janela de 1 hora desde a primeira recusa da sequência, a próxima emissão do mesmo conteúdo lança `ErroRecusaRepetida` antes de gravar. O reenvio da mesma nota com a mesma rejeição mais de 30 vezes pode levar ao bloqueio por consumo indevido, a rejeição 656, conforme o Manual de Orientação do Contribuinte (MOC) 7.0, Anexo I, item 4.3.1. Os limites dessa regra são parametrizáveis por ambiente autorizador.

Abaixo do limite da barreira, a mesma nota pode ser enviada novamente, pois a causa pode ter sido resolvida fora dela. A opção `recusaRepetida` permite configurar `limite` e `janelaMs`, ou desligar a barreira com `false`. Sem os dois métodos, o emissor não mantém essa barreira local; com apenas um deles, `criarEmissor` lança `ErroDeConfiguracao`.

A contagem fica numa tabela à parte: `soltar` apaga a linha de `transmissao` quando não há bytes, e a recusa precisa sobreviver a isso e ser visível para outro processo. Basta uma linha por documento, com a sequência atual, o instante da primeira recusa e quantas vezes ela se repetiu. A janela é comparada com o relógio do banco:

```sql
CREATE TABLE transmissao_recusa (
  tipo text NOT NULL,
  ref text NOT NULL,
  digest text NOT NULL,
  cstat text NOT NULL,
  xmotivo text NOT NULL,
  recusada_em timestamptz NOT NULL,
  primeira_em timestamptz NOT NULL,
  vezes integer NOT NULL,
  PRIMARY KEY (tipo, ref)
);
```

A contagem é atualizada inteira num `INSERT ... ON CONFLICT`: a mesma recusa dentro da janela soma 1; outra recusa, ou a janela vencida, recomeça em 1. Com a atualização numa única instrução, dois processos que registram ao mesmo tempo não perdem uma recusa.

```ts continua
import type { Recusa, RecusaRegistrada } from 'sinete/emissor';

/** O store do PostgreSQL com a conta de recusas. */
export function createPgStoreComRecusas(sql: Sql): TransmissaoStore {
  const mesma = `t.digest = excluded.digest AND t.cstat = excluded.cstat AND t.primeira_em >= now() - ${ms(6)}`;
  return {
    ...createPgStore(sql),
    async registrarRecusa(tipo, ref, r: Recusa, janelaMs) {
      await sql.query(
        `INSERT INTO transmissao_recusa AS t (tipo, ref, digest, cstat, xmotivo, recusada_em, primeira_em, vezes)
         VALUES ($1, $2, $3, $4, $5, now(), now(), 1)
         ON CONFLICT (tipo, ref) DO UPDATE
           SET vezes = CASE WHEN ${mesma} THEN t.vezes + 1 ELSE 1 END,
               primeira_em = CASE WHEN ${mesma} THEN t.primeira_em ELSE now() END,
               digest = excluded.digest, cstat = excluded.cstat, xmotivo = excluded.xmotivo, recusada_em = now()`,
        [tipo, ref, r.digest, r.cStat, r.xMotivo, janelaMs],
      );
    },
    async recusaRecente(tipo, ref, janelaMs): Promise<RecusaRegistrada | undefined> {
      const r = await sql.query<{
        digest: string;
        cstat: string;
        xmotivo: string;
        recusada_em: Date;
        primeira_em: Date;
        vezes: number;
      }>(
        `SELECT digest, cstat, xmotivo, recusada_em, primeira_em, vezes FROM transmissao_recusa
         WHERE tipo = $1 AND ref = $2 AND primeira_em >= now() - ${ms(3)}`,
        [tipo, ref, janelaMs],
      );
      const l = r.rows[0];
      return l === undefined
        ? undefined
        : {
            digest: l.digest,
            cStat: l.cstat,
            xMotivo: l.xmotivo,
            recusadaEm: l.recusada_em,
            primeiraEm: l.primeira_em,
            vezes: l.vezes,
          };
    },
  };
}
```

Com a tabela acima, o `createPgStoreComRecusas` passou nos 18 casos básicos e de recusas da suíte de contrato contra o PostgreSQL do PGlite (28/set/2026).

Apague periodicamente as linhas antigas. Por exemplo, `DELETE FROM transmissao_recusa WHERE primeira_em < now() - interval '1 day'` serve quando a janela configurada é menor que um dia. Passada a janela, essas linhas não barram mais nada; se você ampliar `janelaMs`, ajuste também o prazo de limpeza para não apagar sequências ainda válidas.

## Contingência automática entre processos (opcional)

`registrarFalhaDoAutorizador`, `contingenciaAtiva`, `entrarEmContingencia`, `sairDaContingencia`, `reservarSonda` e `marcarFimDaSvc` são opcionais e devem ser implementados juntos. Eles guardam o estado da [contingência automática](contingencia.md#contingência-automática), a emissão alternativa quando o serviço autorizador normal falha, no banco. Assim, todas as réplicas da aplicação veem o mesmo estado, somam as falhas umas das outras e apenas uma avisa a entrada em contingência. A reserva de consulta também garante que apenas uma réplica por intervalo consulte o status do autorizador ou da SEFAZ Virtual de Contingência (SVC), o serviço alternativo da NF-e.

Sem os seis métodos, o emissor guarda a contingência na memória do processo; com apenas parte deles, `criarEmissor` lança `ErroDeConfiguracao`. Implementar os métodos não ativa a contingência por si só: ela depende da configuração do emissor. Na NF-e, a entrada na SVC exige que a consulta feita à própria SVC responda 107, indicando serviço em operação. O escopo é um texto como `homologacao:nfe:55:SP`, que identifica ambiente, tipo de documento, modelo e unidade federativa (UF). Uma linha por escopo basta:

```sql
CREATE TABLE autorizador_contingencia (
  escopo text PRIMARY KEY,
  falhas integer NOT NULL DEFAULT 0,
  primeira_falha_em timestamptz,
  desde timestamptz,
  motivo text,
  sondada_em timestamptz,
  fim_svc timestamptz
);
```

Cada alteração combina a condição e a escrita numa única instrução, usando o relógio do banco. Assim, as falhas registradas por dois processos entram na contagem, apenas um processo registra a entrada em contingência, apenas um registra a saída e apenas um por intervalo reserva a consulta de status. Na entrada, o `WHERE t.desde IS NULL` do `ON CONFLICT` decide quem altera a linha; quem não a alterou lê o estado existente em seguida.

A reserva vale dentro e fora da contingência. Fora dela, impede que cada nota consulte a SVC enquanto a SEFAZ de origem não a ativou. `fim_svc` é o instante anunciado pela SVC para deixar de atender a UF, quando a consulta de status responde 113, indicando desativação em andamento, e informa esse horário. Esse instante vem da resposta fiscal, em vez de ser calculado pelo relógio da aplicação, e volta a `NULL` se a SVC responder 107 novamente.

```ts continua
import type { EstadoContingencia } from 'sinete/emissor';

interface LinhaContingencia {
  desde: Date;
  motivo: string;
  sondada_em: Date | null;
  fim_svc: Date | null;
}

const estado = (l: LinhaContingencia): EstadoContingencia => ({
  desde: l.desde,
  motivo: l.motivo,
  ...(l.sondada_em === null ? {} : { sondadaEm: l.sondada_em }),
  ...(l.fim_svc === null ? {} : { fimDaSvc: l.fim_svc }),
});

/** O store do PostgreSQL com a conta de recusas e a contingência automática. */
export function createPgStoreCompleto(sql: Sql): TransmissaoStore {
  const naJanela = `t.primeira_falha_em >= now() - ${ms(2)}`;
  const ativa = async (escopo: string): Promise<EstadoContingencia | undefined> => {
    const r = await sql.query<LinhaContingencia>(
      `SELECT desde, motivo, sondada_em, fim_svc FROM autorizador_contingencia
       WHERE escopo = $1 AND desde IS NOT NULL`,
      [escopo],
    );
    return r.rows[0] === undefined ? undefined : estado(r.rows[0]);
  };
  return {
    ...createPgStoreComRecusas(sql),
    async registrarFalhaDoAutorizador(escopo, janelaMs) {
      const r = await sql.query<{ falhas: number }>(
        `INSERT INTO autorizador_contingencia AS t (escopo, falhas, primeira_falha_em) VALUES ($1, 1, now())
         ON CONFLICT (escopo) DO UPDATE
           SET falhas = CASE WHEN ${naJanela} THEN t.falhas + 1 ELSE 1 END,
               primeira_falha_em = CASE WHEN ${naJanela} THEN t.primeira_falha_em ELSE now() END
         RETURNING falhas`,
        [escopo, janelaMs],
      );
      return r.rows[0]?.falhas ?? 1;
    },
    contingenciaAtiva: ativa,
    async entrarEmContingencia(escopo, motivo) {
      const r = await sql.query<LinhaContingencia>(
        `INSERT INTO autorizador_contingencia AS t (escopo, desde, motivo, sondada_em) VALUES ($1, now(), $2, now())
         ON CONFLICT (escopo) DO UPDATE
           SET desde = now(), motivo = excluded.motivo, sondada_em = now(), fim_svc = NULL
           WHERE t.desde IS NULL
         RETURNING desde, motivo, sondada_em, fim_svc`,
        [escopo, motivo],
      );
      if (r.rows[0] !== undefined) return { estado: estado(r.rows[0]), entrou: true };
      const e = await ativa(escopo);
      if (e === undefined) throw new Error('contingência sem linha depois do conflito');
      return { estado: e, entrou: false };
    },
    async sairDaContingencia(escopo) {
      const r = await sql.query(
        `UPDATE autorizador_contingencia
           SET desde = NULL, motivo = NULL, sondada_em = NULL, fim_svc = NULL, falhas = 0, primeira_falha_em = NULL
         WHERE escopo = $1 AND desde IS NOT NULL RETURNING escopo`,
        [escopo],
      );
      return r.rows.length > 0;
    },
    async reservarSonda(escopo, intervaloMs) {
      const r = await sql.query(
        `INSERT INTO autorizador_contingencia AS t (escopo, sondada_em) VALUES ($1, now())
         ON CONFLICT (escopo) DO UPDATE SET sondada_em = now()
           WHERE t.sondada_em IS NULL OR t.sondada_em <= now() - ${ms(2)}
         RETURNING escopo`,
        [escopo, intervaloMs],
      );
      return r.rows.length > 0;
    },
    async marcarFimDaSvc(escopo, fim) {
      const r = await sql.query(
        'UPDATE autorizador_contingencia SET fim_svc = $2 WHERE escopo = $1 AND desde IS NOT NULL RETURNING escopo',
        [escopo, fim ?? null],
      );
      return r.rows.length > 0;
    },
  };
}
```

Com a tabela acima, o `createPgStoreCompleto` passou nos 23 casos da suíte de contrato contra o PostgreSQL do PGlite (28/set/2026).

## A suíte de contrato

`casosDoContrato` devolve os casos como funções; cada um recebe dois stores sobre o mesmo banco vazio, que representam dois processos. Rode com o executor de testes que você já usa (Bun, Vitest, `node:test`), num banco de teste. No exemplo, `sql` e `outraConexao` implementam a interface `Sql` e acessam a mesma base. Execute os casos em sequência, pois cada um limpa as tabelas; para execução paralela, use uma base ou um esquema isolado por caso:

```ts
import { test } from 'bun:test';
import { casosDoContrato } from 'sinete/emissor/contrato';

for (const caso of casosDoContrato({
  criar: async () => {
    await sql.query('TRUNCATE transmissao, transmissao_recusa, autorizador_contingencia', []);
    return { a: createPgStoreCompleto(sql), b: createPgStoreCompleto(outraConexao) };
  },
})) {
  test(caso.nome, caso.rodar, 30_000);
}
```

A suíte inclui os casos da contagem de recusas: a mesma recusa soma, outra recomeça, a janela vencida recomeça e a contagem sobrevive a `soltar` e `descartar`. Para testar um store sem `registrarRecusa` e `recusaRecente`, passe `recusas: false` para `casosDoContrato`. Sem esses métodos, o emissor fica sem a barreira de recusas repetidas.

A suíte inclui também os casos da contingência automática: as falhas somam entre processos e recomeçam depois da janela, apenas um processo entra e apenas um sai, a saída zera a contagem, a reserva da consulta de status é de um processo por intervalo dentro e fora da contingência, e o fim da SVC fica no escopo e é apagado na saída. Para testar um store sem os seis métodos, passe `contingencia: false`; nesse caso, o emissor guarda a contingência na memória do processo. Para testar `createPgStore`, que não implementa nenhum dos dois grupos opcionais, passe tanto `recusas: false` quanto `contingencia: false`.

Os casos conferem, entre outros comportamentos: dez travas simultâneas de dois processos com uma só vencedora; a trava vencida assumida sem o dono antigo conseguir gravar ou soltar a nova trava; a renovação perdida impedindo a gravação; os bytes, o `id` e o `meta` disponíveis por outra conexão; `concluir` idempotente; a seleção e a contagem da retomada. Uma falha lança `ErroContratoViolado` (`contrato_violado`) com o nome do caso. Os casos que verificam prazos esperam as travas vencerem de verdade: `prazoCurtoMs` vale 1 segundo por padrão, e a suíte completa leva cerca de 20 vezes esse prazo, além do tempo das consultas.

## Armadilhas

- **Relógio do processo.** Calcular `trava_ate` com a hora da aplicação (`Date.now() + prazo`) quebra a trava entre servidores com relógios diferentes. Deixe o banco somar.
- **Ler e depois escrever.** Um `SELECT` seguido de `UPDATE` em comandos separados, sem proteção contra concorrência, pode deixar dois processos pegarem a mesma trava. No adaptador apresentado, a condição está no próprio comando que escreve.
- **Réplica de leitura.** `ler` e `listarPendentes` numa réplica atrasada podem não ver os bytes que acabaram de ser gravados. Use a mesma base de escrita.
- **Adaptador em memória em produção.** `sinete/emissor/memoria` perde os bytes se o processo cair, inclusive depois de a SEFAZ autorizar e antes de o sistema guardar o resultado. É só para testes e scripts de um processo.
- **Apagar a linha no fim.** `concluir` limpa os bytes; não apague a linha fora do store, ou uma retomada em curso pode perder a referência.

## Veja também

- [Retomada automática](retomada.md), que usa `listarPendentes` e `registrarTentativa`.
- [Por que o `store` e a trava](../explicacao/store-e-trava.md).
- Referência: [`@sinete/emissor`](../referencia/emissor.md).
