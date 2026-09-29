/**
 * Retomada automática das transmissões gravadas, para o job do integrador (ADR 0010, decisão 3). Sem agendador: quem
 * chama é o cron da aplicação.
 *
 * O documento cujo XML assinado foi gravado e ficou sem desfecho (a SEFAZ não respondeu, a consulta não decidiu, o
 * processo caiu) é retomado pelo mesmo `retomar` do emissor, com a mesma trava. Sem isso, o documento autorizado na
 * SEFAZ só seria guardado quando alguém transmitisse de novo.
 *
 * Regras:
 * - nunca monta: só retoma o que foi gravado (`retomar`, que não recebe entrada);
 * - só gravações feitas há no máximo `idadeMaximaMs`. É obrigatória na prática: tem padrão conservador (3 dias) e
 *   nunca é infinita. Depois disso, a chance de o emitente já ter feito outro documento para a mesma operação é alta, e
 *   autorizar sozinho um documento assinado há dias vira surpresa; ele continua gravado e o `emitir` do usuário o
 *   retoma;
 * - só as paradas há `paradaHaMs` (quem acabou de transmitir tem a vez) e sem trava em vigor;
 * - `lote` por execução, as nunca tentadas primeiro, e nenhuma nova depois de `prazoMs`;
 * - depois de `alertarDepoisDe` tentativas sem desfecho, um alerta, uma vez por gravação; o divergente (a SEFAZ tem
 *   outro documento no número) alerta na primeira, porque tentar de novo não resolve. Depois do alerta, a gravação
 *   ainda é tentada, no máximo uma vez por `intervaloDepoisDoAlertaMs`;
 * - a retomada que perde a trava para outro processo não conta tentativa.
 */

import type { Clock } from '@sinete/core';
import { ConfigError, isSineteError, systemClock } from '@sinete/core';
import type { Desfecho } from './desfecho.ts';
import type { AoDecidir, JaGuardado, OpcoesRetomar } from './emissor.ts';
import type { RegistroTransmissao, TransmissaoStore } from './store.ts';

export interface PoliticaRetomada {
  /** Idade máxima da gravação. Padrão: 3 dias. Precisa ser finita e positiva. */
  readonly idadeMaximaMs: number;
  /** Parada há pelo menos isto (nem trava, nem gravação, nem tentativa). Padrão: 5 minutos. */
  readonly paradaHaMs: number;
  /** Retomadas por execução (cada uma pode levar alguns timeouts). Padrão: 5. */
  readonly lote: number;
  /** Nenhuma retomada nova depois disto, para não encavalar com a próxima execução. Padrão: 7 minutos. */
  readonly prazoMs: number;
  /** Tentativas sem desfecho antes do alerta. Padrão: 3. */
  readonly alertarDepoisDe: number;
  /** Depois do alerta, uma tentativa por este intervalo. Padrão: 1 hora. */
  readonly intervaloDepoisDoAlertaMs: number;
}

export const POLITICA_RETOMADA_PADRAO: PoliticaRetomada = {
  idadeMaximaMs: 3 * 24 * 60 * 60 * 1000,
  paradaHaMs: 5 * 60 * 1000,
  lote: 5,
  prazoMs: 7 * 60 * 1000,
  alertarDepoisDe: 3,
  intervaloDepoisDoAlertaMs: 60 * 60 * 1000,
};

/** O que a retomada precisa de um emissor: só `retomar`, que não monta. Qualquer emissor do pacote serve. */
export interface EmissorRetomavel {
  retomar(ref: string, opcoes?: OpcoesRetomar<never, never>): Promise<Desfecho | undefined>;
}

/** Como terminou cada gravação selecionada. */
export type DesfechoRetomada =
  /** A gravação saiu: o documento foi guardado, ou recusado e descartado. */
  | 'resolvida'
  /** Os bytes continuam gravados: conta uma tentativa. */
  | 'sem-desfecho'
  /**
   * Outro processo (o usuário) tinha a trava, ou a assumiu no meio desta retomada (`TravaPerdidaError`): sem contar
   * tentativa, porque quem tem a trava é que decide.
   */
  | 'ocupada'
  /** Os bytes saíram entre a seleção e a trava: nada foi feito. */
  | 'sem-bytes'
  /** `deveRetomar` recusou: não conta no lote. */
  | 'ignorada';

export interface ResumoRetomada {
  /** Gravações que a seleção trouxe (todas, mesmo as que ficaram fora do lote). */
  readonly candidatas: number;
  readonly desfechos: Readonly<Partial<Record<DesfechoRetomada, number>>>;
  readonly alertas: number;
  /** Paradas pelo prazo da execução; ficam para a próxima. */
  readonly adiadas: number;
}

export interface OpcoesRetomada {
  readonly store: TransmissaoStore;
  /**
   * Empresta o emissor do documento durante `fn`. Com o pool: `(r, fn) => pool.usar(certificadoDe(r), fn)`. O emissor
   * precisa ter o mesmo `store`.
   */
  readonly usarEmissor: <T>(registro: RegistroTransmissao, fn: (emissor: EmissorRetomavel) => Promise<T>) => Promise<T>;
  readonly politica?: Partial<PoliticaRetomada>;
  /** Filtro do integrador (a flag por emitente, por exemplo). O recusado não conta no lote. */
  readonly deveRetomar?: (registro: RegistroTransmissao) => boolean | Promise<boolean>;
  /**
   * Alerta único da gravação. `ultimo` é o desfecho da última tentativa, ou o erro que ela lançou. `tentativas`
   * conta esta.
   *
   * No máximo uma vez: o alerta é marcado no store (`registrarTentativa` com `alertar`) antes da chamada, para dois
   * jobs nunca avisarem a mesma gravação. Se a entrega pode falhar, grave o alerta numa fila do próprio banco aqui
   * dentro e entregue de lá; um erro lançado aqui interrompe a execução e não desmarca o alerta.
   */
  readonly aoAlertar: (
    registro: RegistroTransmissao,
    ultimo: Desfecho | { readonly erro: unknown },
    tentativas: number,
  ) => void | Promise<void>;
  /**
   * Guarda o documento decidido na retomada, passado ao `retomar` de cada gravação. Sem ele, vale o `aoDecidir` do
   * emissor. `registro.tipo` e `registro.ref` dizem qual documento.
   */
  readonly aoDecidir?: AoDecidir;
  /** Veja `JaGuardado`: passado ao `retomar` de cada gravação. */
  readonly jaGuardado?: JaGuardado;
  /** Relógio do prazo da execução. Padrão: o do sistema. */
  readonly clock?: Clock;
}

/**
 * Quantas gravações a primeira seleção traz. Se o lote não enche com elas (as que `deveRetomar` recusa ficam onde
 * estão, na frente da fila), a seleção dobra e segue das ainda não vistas, até a fila acabar ou o prazo vencer.
 */
const SELECAO = 1000;

function conferirPolitica(p: PoliticaRetomada): void {
  for (const [nome, v] of Object.entries(p)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new ConfigError(`política de retomada: ${nome} precisa ser um número finito e não negativo`, {
        details: { [nome]: String(v) },
      });
    }
  }
  if (p.idadeMaximaMs <= 0) throw new ConfigError('política de retomada: idadeMaximaMs precisa ser positiva');
}

/**
 * Roda uma execução da retomada automática e devolve o resumo. Agende com intervalo maior que `prazoMs`, para as
 * execuções não se sobreporem. Se se sobrepuserem, a trava impede duas transmissões ao mesmo tempo e a gravação é
 * conferida de novo antes do `retomar`; o pior caso é uma consulta a mais com os mesmos bytes, nunca outro documento.
 */
export async function retomarPendentes(opcoes: OpcoesRetomada): Promise<ResumoRetomada> {
  const politica: PoliticaRetomada = { ...POLITICA_RETOMADA_PADRAO, ...opcoes.politica };
  conferirPolitica(politica);
  if (typeof opcoes.aoAlertar !== 'function') throw new ConfigError('aoAlertar é obrigatório na retomada');
  const { store } = opcoes;
  const clock = opcoes.clock ?? systemClock;
  const inicio = clock.now().getTime();
  const filtro = {
    idadeMaximaMs: politica.idadeMaximaMs,
    paradaHaMs: politica.paradaHaMs,
    intervaloDepoisDoAlertaMs: politica.intervaloDepoisDoAlertaMs,
  };
  const desfechos: Partial<Record<DesfechoRetomada, number>> = {};
  const conta = (d: DesfechoRetomada): void => {
    desfechos[d] = (desfechos[d] ?? 0) + 1;
  };
  const vistas = new Set<string>();
  let alertas = 0;
  let adiadas = 0;
  let tentadas = 0;
  const esgotado = (): boolean => clock.now().getTime() - inicio >= politica.prazoMs;
  for (let limite = SELECAO; ; limite *= 2) {
    const lista = await store.listarPendentes({ ...filtro, limite });
    // Uma por vez: cada retomada pode esperar a SEFAZ, e o lote é pequeno.
    for (const r of lista) {
      const chave = `${r.tipo}\u0000${r.ref}\u0000${r.gravacao}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      if (tentadas >= politica.lote) continue;
      if (esgotado()) {
        adiadas++;
        continue;
      }
      if (opcoes.deveRetomar !== undefined && !(await opcoes.deveRetomar(r))) {
        conta('ignorada');
        continue;
      }
      const d = await retomarUma(r);
      if (d === 'adiada') {
        adiadas++;
        continue;
      }
      tentadas++;
      conta(d);
    }
    if (lista.length < limite || tentadas >= politica.lote || esgotado()) break;
  }
  return { candidatas: vistas.size, desfechos, alertas, adiadas };

  /**
   * Retoma uma gravação. O prazo e a gravação são conferidos de novo logo antes do `retomar`: o filtro do integrador e
   * o empréstimo do emissor podem demorar, e outra execução pode ter tentado a mesma gravação nesse meio tempo.
   */
  async function retomarUma(r: RegistroTransmissao): Promise<DesfechoRetomada | 'adiada'> {
    let ultimo: Desfecho | { readonly erro: unknown };
    try {
      const res = await opcoes.usarEmissor(r, async (e): Promise<Desfecho | DesfechoRetomada | 'adiada'> => {
        if (esgotado()) return 'adiada';
        const antes = await store.ler(r.tipo, r.ref);
        if (antes === undefined) return 'sem-bytes';
        if (antes.gravacao !== r.gravacao) return 'resolvida';
        // Outra execução tentou esta gravação depois da seleção: a vez é dela, e o intervalo da política vale.
        if (antes.tentativas !== r.tentativas) return 'ocupada';
        // A gravação vai junto e é conferida já com a trava: se mudou depois desta leitura, nada é enviado.
        const o: OpcoesRetomar = {
          gravacao: r.gravacao,
          ...(opcoes.aoDecidir === undefined ? {} : { aoDecidir: opcoes.aoDecidir }),
          ...(opcoes.jaGuardado === undefined ? {} : { jaGuardado: opcoes.jaGuardado }),
        };
        return (await e.retomar(r.ref, o as OpcoesRetomar<never, never>)) ?? 'sem-bytes';
      });
      if (typeof res === 'string') return res;
      // NFC-e off-line com o autorizador ainda fora (ADR 0013): nada foi enviado, então não conta tentativa nem alerta.
      if (res.tipo === 'pendente' && res.motivo === 'contingencia') return 'adiada';
      ultimo = res;
    } catch (e) {
      // Outro processo tem a trava, ou a assumiu no meio desta retomada: é ele quem conta, não esta execução.
      if (isSineteError(e, 'transmissao_em_andamento') || isSineteError(e, 'trava_perdida')) return 'ocupada';
      ultimo = { erro: e };
    }
    const agora = await store.ler(r.tipo, r.ref);
    if (agora === undefined || agora.gravacao !== r.gravacao) return 'resolvida';
    const tentativas = r.tentativas + 1;
    const divergente = 'tipo' in ultimo && ultimo.tipo === 'divergente';
    const t = await store.registrarTentativa(r, { alertar: divergente || tentativas >= politica.alertarDepoisDe });
    if (t.alertou) {
      alertas++;
      await opcoes.aoAlertar(r, ultimo, tentativas);
    }
    return 'sem-desfecho';
  }
}
