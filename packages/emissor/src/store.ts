/**
 * Persistência dos bytes assinados e trava entre processos (ADR 0010, decisão 3), no lugar do antigo `aoAssinar`.
 *
 * O emissor grava o documento assinado antes do envio e só o apaga quando a SEFAZ decidiu. Toda retomada (outro
 * clique, outro processo, depois de um reinício) encontra os bytes gravados, consulta a chave e, se o documento não
 * consta, reenvia os mesmos bytes; nunca remonta. Remontar gera outro `cNF` e outro `dhEmi`, e a SEFAZ responde 539 ou,
 * pior, autoriza um segundo documento para o mesmo número.
 *
 * A trava é uma concessão com prazo: vale entre processos e se desfaz sozinha se o processo morrer no meio. Só quem
 * tem a trava em vigor grava ou descarta. O emissor a renova enquanto espera a SEFAZ e confere (`renovar`) antes de
 * guardar o desfecho: quem perdeu a trava não grava nada.
 *
 * **Relógio do banco.** Prazo, renovação, "parado há" e "assinado há" são medidos pelo relógio do banco, não do
 * processo: dois processos com relógios diferentes decidiriam de forma diferente se uma trava venceu. Por isso a
 * interface recebe durações (`prazoMs`, `idadeMaximaMs`), nunca instantes calculados no processo, e o adaptador as
 * compara com o `NOW()` do banco (`lockUntil <= NOW(6)` no MySQL, `now()` no Postgres). O adaptador em memória
 * (`@sinete/emissor/memoria`) usa o `Clock` que recebe, porque ali processo e banco são a mesma coisa.
 *
 * Quem implementa em SQL roda a suíte de `@sinete/emissor/contrato` contra o próprio banco. Um adaptador errado
 * produz nota duplicada.
 */

import type { Clock } from '@sinete/core';
import type { TipoDocumento } from './desfecho.ts';

/** Instante no tempo, como os relógios do `@sinete/core` o devolvem (o tipo `Date`, sem tocar no global). */
export type Instante = ReturnType<Clock['now']>;

/** Trava de um documento. `token` identifica o dono: renovar, soltar, descartar e concluir só valem com ele. */
export interface Trava {
  readonly tipo: TipoDocumento;
  readonly ref: string;
  readonly token: string;
}

/** Bytes gravados de um documento, com a contagem da retomada automática. */
export interface RegistroTransmissao {
  readonly tipo: TipoDocumento;
  /** Id do documento no sistema do integrador (o rascunho da nota). */
  readonly ref: string;
  /** O documento assinado, exatamente como foi (ou vai) para a SEFAZ. */
  readonly xml: string;
  /** Chave de acesso; na NFS-e, o Id da DPS. */
  readonly id: string;
  /**
   * Identifica esta gravação. Outra gravação do mesmo `ref` (depois de um descarte) tem outro valor: a contagem de
   * tentativas e o alerta são de uma gravação, não do documento.
   */
  readonly gravacao: string;
  /** Instante da gravação, pelo relógio do banco. */
  readonly assinadoEm: Instante;
  /** Dados livres do integrador, gravados junto com os bytes (o que ele precisa para guardar o documento no fim). */
  readonly meta: Readonly<Record<string, unknown>>;
  /** Retomadas automáticas sem desfecho desta gravação. */
  readonly tentativas: number;
  readonly ultimaTentativaEm?: Instante;
  /** Instante do alerta desta gravação; só há um. */
  readonly alertadoEm?: Instante;
}

/** O que o emissor grava. */
export interface GravacaoTransmissao {
  readonly xml: string;
  readonly id: string;
  readonly meta: Readonly<Record<string, unknown>>;
}

/** Seleção da retomada automática. Durações, medidas pelo relógio do banco. */
export interface FiltroPendentes {
  /** Só gravações feitas há no máximo isto. */
  readonly idadeMaximaMs: number;
  /** Só as paradas há pelo menos isto: nenhuma trava, gravação ou tentativa nesse intervalo. */
  readonly paradaHaMs: number;
  /** Uma gravação já alertada só volta depois disto desde a última tentativa. */
  readonly intervaloDepoisDoAlertaMs: number;
  readonly limite: number;
}

/** O que o emissor lembra de uma recusa definitiva: o resumo dos bytes recusados e o que a SEFAZ respondeu. */
export interface Recusa {
  /** SHA-256 dos bytes recusados, em hexadecimal minúsculo. */
  readonly digest: string;
  readonly cStat: string;
  readonly xMotivo: string;
}

/**
 * Recusa lembrada, pelo relógio do banco: a última da sequência (`recusadaEm`) e quantas vezes a mesma recusa (mesmo
 * `digest` e mesmo `cStat`) voltou desde a primeira dela (`primeiraEm`).
 */
export interface RecusaRegistrada extends Recusa {
  readonly recusadaEm: Instante;
  /** Quantas recusas iguais seguidas, desde `primeiraEm`. Começa em 1. */
  readonly vezes: number;
  readonly primeiraEm: Instante;
}

/**
 * Contingência de um autorizador (ADR 0013), pelo relógio do banco: desde quando, por quê e a última consulta de status
 * (a sonda que decide a volta).
 */
export interface EstadoContingencia {
  readonly desde: Instante;
  readonly motivo: string;
  readonly sondadaEm?: Instante;
  /**
   * NF-e: a partir deste instante a SVC não atende mais a UF (a consulta de status na SVC respondeu 113 com a hora; NT
   * 2013.007 v1.03, regra K05.3), e a nota nova volta à emissão normal.
   */
  readonly fimDaSvc?: Instante;
}

export interface TransmissaoStore {
  /**
   * Pega a trava do documento por `prazoMs` se não houver outra em vigor. `undefined`: outro processo está
   * transmitindo. Uma trava vencida é assumida: o dono antigo perde o direito de gravar.
   */
  travar(tipo: TipoDocumento, ref: string, prazoMs: number): Promise<Trava | undefined>;
  /** Estende a própria trava ainda em vigor por mais `prazoMs`. `false`: perdida (venceu ou foi assumida). */
  renovar(trava: Trava, prazoMs: number): Promise<boolean>;
  /** Solta a trava, se ainda for dela; sem bytes gravados, não deixa nada para trás. */
  soltar(trava: Trava): Promise<void>;
  /** Bytes gravados do documento, com ou sem trava. */
  ler(tipo: TipoDocumento, ref: string): Promise<RegistroTransmissao | undefined>;
  /**
   * Grava os bytes assinados. Só com a trava em vigor (`TravaPerdidaError` sem ela) e só sem bytes já gravados
   * (`TransmissaoJaGravadaError`); nos dois casos nada é gravado. É aqui que o integrador reserva a numeração, na
   * mesma transação.
   */
  gravar(trava: Trava, gravacao: GravacaoTransmissao): Promise<RegistroTransmissao>;
  /**
   * A SEFAZ recusou os bytes de vez: apaga a gravação (e o integrador devolve o número, se reservou). Só com a trava em
   * vigor (`TravaPerdidaError`).
   */
  descartar(trava: Trava): Promise<void>;
  /**
   * O integrador já guardou o documento decidido: apaga a gravação. Não exige a trava em vigor (o documento já está
   * guardado), mas exige o `token`: a gravação de quem assumiu a trava fica. Idempotente.
   */
  concluir(trava: Trava): Promise<void>;
  /**
   * Gravações para a retomada automática: com bytes, sem trava em vigor, dentro do filtro. Ordem: as nunca tentadas
   * primeiro, depois pela última tentativa, depois pela gravação.
   */
  listarPendentes(filtro: FiltroPendentes): Promise<readonly RegistroTransmissao[]>;
  /**
   * Conta uma retomada sem desfecho da mesma gravação (`registro.gravacao`); se ela já saiu, nada. Com
   * `alertar: true`, marca o alerta se ainda não houver: `alertou` só é `true` para quem marcou (uma vez por gravação).
   */
  registrarTentativa(
    registro: RegistroTransmissao,
    opcoes: { readonly alertar: boolean },
  ): Promise<{ readonly registrada: boolean; readonly alertou: boolean }>;
  /**
   * Opcional, junto com `recusaRecente`: conta as recusas definitivas do documento (uma sequência por `tipo` e `ref`).
   * A mesma recusa (mesmo `digest` e mesmo `cStat`) com a primeira da sequência há no máximo `janelaMs`, pelo relógio do
   * banco, soma 1 em `vezes`; outra recusa, ou depois da janela, recomeça a sequência em 1, com `primeiraEm` agora. O
   * emissor chama depois de descartar os bytes recusados, para não reenviar a mesma nota até o bloqueio por consumo
   * indevido (MOC 7.0 Anexo I, item 4.3, rejeição 656). Precisa sobreviver ao `soltar` e ao `descartar`, que apagam a
   * gravação: guarde fora da linha dos bytes. A leitura e a escrita da sequência vão numa operação só (um `UPDATE` ou
   * um `INSERT ... ON CONFLICT` com a conta no banco), para dois processos não perderem uma recusa.
   */
  registrarRecusa?(tipo: TipoDocumento, ref: string, recusa: Recusa, janelaMs: number): Promise<void>;
  /**
   * Opcional, junto com `registrarRecusa`: a sequência de recusas do documento, se a primeira dela foi há no máximo
   * `janelaMs` pelo relógio do banco; senão `undefined`.
   */
  recusaRecente?(tipo: TipoDocumento, ref: string, janelaMs: number): Promise<RecusaRegistrada | undefined>;
  /**
   * Opcional, com os outros cinco métodos da contingência (todos ou nenhum; ADR 0013): conta uma falha do autorizador
   * do `escopo` (um texto como `homologacao:nfe:55:SP`) e devolve quantas houve na sequência. A sequência recomeça em 1
   * quando a primeira dela foi há mais de `janelaMs` pelo relógio do banco, e zera no `sairDaContingencia`. Leitura e
   * escrita numa operação só, para dois processos não perderem uma falha. Sem os seis métodos, o emissor guarda a
   * contingência na memória do processo.
   */
  registrarFalhaDoAutorizador?(escopo: string, janelaMs: number): Promise<number>;
  /** Opcional (veja `registrarFalhaDoAutorizador`): a contingência em vigor no escopo, ou `undefined`. */
  contingenciaAtiva?(escopo: string): Promise<EstadoContingencia | undefined>;
  /**
   * Opcional (veja `registrarFalhaDoAutorizador`): põe o escopo em contingência, com `desde` e `sondadaEm` agora pelo
   * relógio do banco, se ele ainda não estiver. `entrou` só é `true` para quem pôs (um `INSERT ... ON CONFLICT DO
   * NOTHING`): é ele quem avisa o integrador.
   */
  entrarEmContingencia?(
    escopo: string,
    motivo: string,
  ): Promise<{ readonly estado: EstadoContingencia; readonly entrou: boolean }>;
  /**
   * Opcional (veja `registrarFalhaDoAutorizador`): tira o escopo da contingência e zera a sequência de falhas, a última
   * sonda e o fim da SVC. `true` só para quem tirou.
   */
  sairDaContingencia?(escopo: string): Promise<boolean>;
  /**
   * Opcional (veja `registrarFalhaDoAutorizador`): reserva a próxima consulta de status do escopo, em contingência ou
   * não. `true` (e `sondadaEm` passa a ser agora) só se nunca houve sonda desde a última saída ou a última foi há pelo
   * menos `intervaloMs`, num `INSERT ... ON CONFLICT ... WHERE` condicional: um processo por intervalo consulta a SEFAZ.
   * Em contingência é a sonda da volta; fora dela, na NF-e, guarda a consulta à SVC que a encontrou sem ativação.
   */
  reservarSonda?(escopo: string, intervaloMs: number): Promise<boolean>;
  /**
   * Opcional (veja `registrarFalhaDoAutorizador`): grava `fimDaSvc` no escopo em contingência (a SVC respondeu 113 com a
   * hora em que deixa de atender a UF), ou o apaga com `undefined` (a SVC voltou a responder 107). `false` se o escopo
   * não está em contingência.
   */
  marcarFimDaSvc?(escopo: string, fim: Instante | undefined): Promise<boolean>;
}
