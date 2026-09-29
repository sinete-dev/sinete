/**
 * `@sinete/emissor/memoria`: `TransmissaoStore` em memória, o adaptador de referência.
 *
 * **Só para testes e scripts de um processo.** Os bytes gravados vivem na memória do processo: se ele cair depois de
 * a SEFAZ autorizar e antes da resposta chegar, a gravação some junto, e a próxima emissão monta outro documento para o
 * mesmo número. Em produção, implemente o `TransmissaoStore` sobre o banco da aplicação (a trava com prazo na própria
 * linha, comparada com o relógio do banco) e rode a suíte de `@sinete/emissor/contrato` contra ele.
 *
 * Dois stores criados sobre o mesmo `BancoMemoria` se comportam como dois processos sobre o mesmo banco: é assim que a
 * suíte de contrato e os testes simulam o outro processo e o reinício. O relógio do "banco" é o `clock` recebido.
 */

import type { Clock } from '@sinete/core';
import { systemClock } from '@sinete/core';
import type { DadosContingenciaMemoria } from './contingencia.ts';
import { contingenciaEmMemoria, dadosContingenciaMemoria } from './contingencia.ts';
import type { TipoDocumento } from './desfecho.ts';
import { TransmissaoJaGravadaError, TravaPerdidaError } from './erros.ts';
import type {
  FiltroPendentes,
  GravacaoTransmissao,
  Instante,
  Recusa,
  RecusaRegistrada,
  RegistroTransmissao,
  TransmissaoStore,
  Trava,
} from './store.ts';

interface Gravado {
  readonly xml: string;
  readonly id: string;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly gravacao: string;
  readonly assinadoEm: number;
  tentativas: number;
  ultimaTentativaEm: number | undefined;
  alertadoEm: number | undefined;
}

interface Linha {
  readonly tipo: TipoDocumento;
  readonly ref: string;
  token: string | undefined;
  travaAte: number;
  gravado: Gravado | undefined;
  /** Última trava, gravação, tentativa ou soltura: o "parado há" da retomada. */
  atividadeEm: number;
}

/** O "banco" em memória. Compartilhe entre stores para simular processos sobre o mesmo banco. */
export interface BancoMemoria {
  readonly linhas: Map<string, Linha>;
  /** Sequência de recusas de cada documento, fora da linha dos bytes (que `soltar` apaga). */
  readonly recusas: Map<string, Recusa & { readonly em: number; readonly primeira: number; readonly vezes: number }>;
  /** Falhas e contingência de cada autorizador (ADR 0013). */
  readonly contingencia: DadosContingenciaMemoria;
  sequencia: number;
}

/** Banco vazio. */
export function createBancoMemoria(): BancoMemoria {
  return { linhas: new Map(), recusas: new Map(), contingencia: dadosContingenciaMemoria(), sequencia: 0 };
}

export interface OpcoesMemoria {
  /** Relógio do "banco": prazos, gravação e tentativas. Padrão: o do sistema. */
  readonly clock?: Clock;
  /** Banco compartilhado; padrão, um novo e só deste store. */
  readonly banco?: BancoMemoria;
}

const chave = (tipo: TipoDocumento, ref: string): string => `${tipo}\u0000${ref}`;

/** Cria o store em memória (veja o aviso do módulo: só testes e scripts de um processo). */
export function createMemoriaStore(opcoes: OpcoesMemoria = {}): TransmissaoStore {
  const clock = opcoes.clock ?? systemClock;
  const banco = opcoes.banco ?? createBancoMemoria();
  const agora = (): number => clock.now().getTime();
  const proximo = (prefixo: string): string => `${prefixo}-${++banco.sequencia}`;
  /** Instante para o chamador, sem o global `Date` (relógio injetado): uma cópia do `Date` do relógio. */
  const instante = (ms: number): Instante => {
    const d = clock.now();
    d.setTime(ms);
    return d;
  };

  const emVigor = (l: Linha | undefined, t: Trava): l is Linha =>
    l !== undefined && l.token === t.token && l.travaAte > agora();

  const registro = (l: Linha, g: Gravado): RegistroTransmissao => ({
    tipo: l.tipo,
    ref: l.ref,
    xml: g.xml,
    id: g.id,
    gravacao: g.gravacao,
    assinadoEm: instante(g.assinadoEm),
    meta: structuredClone(g.meta),
    tentativas: g.tentativas,
    ...(g.ultimaTentativaEm === undefined ? {} : { ultimaTentativaEm: instante(g.ultimaTentativaEm) }),
    ...(g.alertadoEm === undefined ? {} : { alertadoEm: instante(g.alertadoEm) }),
  });

  return {
    ...contingenciaEmMemoria(clock, banco.contingencia),
    async travar(tipo: TipoDocumento, ref: string, prazoMs: number): Promise<Trava | undefined> {
      const k = chave(tipo, ref);
      const t = agora();
      const l = banco.linhas.get(k);
      if (l?.token !== undefined && l.travaAte > t) return undefined;
      const token = proximo('trava');
      if (l === undefined) {
        banco.linhas.set(k, { tipo, ref, token, travaAte: t + prazoMs, gravado: undefined, atividadeEm: t });
      } else {
        l.token = token;
        l.travaAte = t + prazoMs;
        l.atividadeEm = t;
      }
      return { tipo, ref, token };
    },

    async renovar(trava: Trava, prazoMs: number): Promise<boolean> {
      const l = banco.linhas.get(chave(trava.tipo, trava.ref));
      if (!emVigor(l, trava)) return false;
      l.travaAte = agora() + prazoMs;
      l.atividadeEm = agora();
      return true;
    },

    async soltar(trava: Trava): Promise<void> {
      const k = chave(trava.tipo, trava.ref);
      const l = banco.linhas.get(k);
      if (l === undefined || l.token !== trava.token) return;
      if (l.gravado === undefined) {
        banco.linhas.delete(k);
        return;
      }
      l.token = undefined;
      l.travaAte = 0;
      l.atividadeEm = agora();
    },

    async ler(tipo: TipoDocumento, ref: string): Promise<RegistroTransmissao | undefined> {
      const l = banco.linhas.get(chave(tipo, ref));
      return l?.gravado === undefined ? undefined : registro(l, l.gravado);
    },

    async gravar(trava: Trava, g: GravacaoTransmissao): Promise<RegistroTransmissao> {
      const l = banco.linhas.get(chave(trava.tipo, trava.ref));
      if (!emVigor(l, trava)) throw new TravaPerdidaError('a trava venceu: outro processo pode ter assumido');
      if (l.gravado !== undefined) {
        throw new TransmissaoJaGravadaError('já há bytes gravados para este documento: retome com eles');
      }
      const t = agora();
      l.gravado = {
        xml: g.xml,
        id: g.id,
        meta: structuredClone(g.meta),
        gravacao: proximo('gravacao'),
        assinadoEm: t,
        tentativas: 0,
        ultimaTentativaEm: undefined,
        alertadoEm: undefined,
      };
      l.atividadeEm = t;
      return registro(l, l.gravado);
    },

    async descartar(trava: Trava): Promise<void> {
      const l = banco.linhas.get(chave(trava.tipo, trava.ref));
      if (!emVigor(l, trava)) throw new TravaPerdidaError('a trava venceu: outro processo pode ter assumido');
      l.gravado = undefined;
      l.atividadeEm = agora();
    },

    async concluir(trava: Trava): Promise<void> {
      const l = banco.linhas.get(chave(trava.tipo, trava.ref));
      if (l === undefined || l.token !== trava.token) return;
      l.gravado = undefined;
      l.atividadeEm = agora();
    },

    async listarPendentes(f: FiltroPendentes): Promise<readonly RegistroTransmissao[]> {
      const t = agora();
      const escolhidas = [...banco.linhas.values()].filter((l): l is Linha & { gravado: Gravado } => {
        const g = l.gravado;
        if (g === undefined) return false;
        if (l.token !== undefined && l.travaAte > t) return false;
        if (t - g.assinadoEm > f.idadeMaximaMs) return false;
        if (t - l.atividadeEm < f.paradaHaMs) return false;
        const alertadaRecente =
          g.alertadoEm !== undefined &&
          g.ultimaTentativaEm !== undefined &&
          t - g.ultimaTentativaEm < f.intervaloDepoisDoAlertaMs;
        return !alertadaRecente;
      });
      escolhidas.sort((x, y) => {
        const [a, b] = [x.gravado, y.gravado];
        if ((a.ultimaTentativaEm === undefined) !== (b.ultimaTentativaEm === undefined)) {
          return a.ultimaTentativaEm === undefined ? -1 : 1;
        }
        return (
          (a.ultimaTentativaEm ?? 0) - (b.ultimaTentativaEm ?? 0) ||
          a.assinadoEm - b.assinadoEm ||
          x.tipo.localeCompare(y.tipo) ||
          x.ref.localeCompare(y.ref)
        );
      });
      return escolhidas.slice(0, f.limite).map((l) => registro(l, l.gravado));
    },

    async registrarTentativa(
      r: RegistroTransmissao,
      opcoes: { readonly alertar: boolean },
    ): Promise<{ readonly registrada: boolean; readonly alertou: boolean }> {
      const l = banco.linhas.get(chave(r.tipo, r.ref));
      const g = l?.gravado;
      if (l === undefined || g === undefined || g.gravacao !== r.gravacao) return { registrada: false, alertou: false };
      const t = agora();
      g.tentativas++;
      g.ultimaTentativaEm = t;
      l.atividadeEm = t;
      const alertou = opcoes.alertar && g.alertadoEm === undefined;
      if (alertou) g.alertadoEm = t;
      return { registrada: true, alertou };
    },

    async registrarRecusa(tipo: TipoDocumento, ref: string, r: Recusa, janelaMs: number): Promise<void> {
      const k = chave(tipo, ref);
      const t = agora();
      const a = banco.recusas.get(k);
      const mesma = a !== undefined && a.digest === r.digest && a.cStat === r.cStat && t - a.primeira <= janelaMs;
      banco.recusas.set(k, {
        digest: r.digest,
        cStat: r.cStat,
        xMotivo: r.xMotivo,
        em: t,
        primeira: mesma ? a.primeira : t,
        vezes: mesma ? a.vezes + 1 : 1,
      });
    },

    async recusaRecente(tipo: TipoDocumento, ref: string, janelaMs: number): Promise<RecusaRegistrada | undefined> {
      const r = banco.recusas.get(chave(tipo, ref));
      if (r === undefined || agora() - r.primeira > janelaMs) return undefined;
      return {
        digest: r.digest,
        cStat: r.cStat,
        xMotivo: r.xMotivo,
        recusadaEm: instante(r.em),
        vezes: r.vezes,
        primeiraEm: instante(r.primeira),
      };
    },
  };
}
