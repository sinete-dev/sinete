/**
 * Contingência automática (ADR 0013): a conta de falhas do autorizador normal, a entrada em contingência confirmada
 * pela consulta de status (a da SVC da UF na NF-e, a do autorizador normal na NFC-e), a sonda que decide a volta e o
 * estado na memória do processo quando o store não o guarda.
 *
 * A contingência só entra na montagem de uma nota nova. Bytes já gravados nunca são remontados: a nota pendente em
 * emissão normal é retomada com os mesmos bytes pela consulta da chave no autorizador normal (Ajuste SINIEF 07/05,
 * cláusula décima primeira, § 14, e Ajuste SINIEF 19/16, cláusula décima primeira, § 2º: é vedado reutilizar em
 * contingência o número transmitido em emissão normal).
 */

import type { Logger, Relogio } from '@sinete/core';
import { ErroDeConfiguracao } from '@sinete/core';
import type { Desfecho, TipoDocumento } from './desfecho.ts';
import type { EstadoContingencia, Instante, TransmissaoStore } from './store.ts';

/** O autorizador normal de um documento, modelo e UF: cada um entra e sai da contingência sozinho. */
export interface EscopoContingencia {
  readonly documento: TipoDocumento;
  /** Modelo do documento (`55` NF-e, `65` NFC-e). */
  readonly modelo: string;
  readonly uf: string;
}

/**
 * Aviso ao integrador: o escopo entrou em contingência, saiu dela, ou o autorizador normal está fora e a SVC não está
 * ativada para a UF (`svc-indisponivel`: as notas seguem em emissão normal e ficam pendentes; repete a cada consulta da
 * SVC, uma por `sondaMs`).
 */
export type MudancaContingencia =
  | {
      readonly tipo: 'entrou';
      readonly escopo: EscopoContingencia;
      readonly desde: Instante;
      readonly motivo: string;
    }
  | { readonly tipo: 'saiu'; readonly escopo: EscopoContingencia; readonly motivo: string }
  | { readonly tipo: 'svc-indisponivel'; readonly escopo: EscopoContingencia; readonly motivo: string };

/** Opções da contingência automática. Desligada por padrão. */
export interface OpcoesContingencia {
  /** Liga a contingência automática. */
  readonly automatica: boolean;
  /**
   * Falhas do autorizador normal na janela que levam à consulta de status: na NF-e, a da SVC da UF, e só com 107 entra;
   * na NFC-e, a do autorizador normal, e sem 107 entra. Padrão: 3.
   */
  readonly limiteFalhas?: number;
  /** Janela da conta de falhas, desde a primeira da sequência, pelo relógio do banco. Padrão: 5 minutos. */
  readonly janelaMs?: number;
  /**
   * Intervalo entre as consultas de status: em contingência, as que decidem a volta; fora dela, na NF-e, entre as
   * consultas à SVC que encontraram a SVC sem ativação. Padrão: 5 minutos.
   */
  readonly sondaMs?: number;
  /**
   * Justificativa da entrada em contingência (`xJust`, 15 a 256 caracteres; MOC 7.0 Anexo I, campo B29). Padrão:
   * `SEFAZ autorizadora sem resposta: contingencia automatica`.
   */
  readonly xJust?: string;
}

/** O que os bytes assinados dizem da contingência (pela chave de acesso). */
export interface ContingenciaDosBytes {
  readonly escopo: EscopoContingencia;
  /** `tpEmis` diferente de 1. */
  readonly emContingencia: boolean;
  /** Contingência off-line (NFC-e, `tpEmis` 9). */
  readonly offline: boolean;
}

/** O que entra na nota em contingência. */
export interface ContingenciaAplicada {
  /**
   * Entrada em contingência, pelo relógio do banco. O perfil usa como `dhCont`, limitado à emissão da nota (B28-40:
   * `dhCont` não passa da emissão), medida pelo relógio que a montagem usa.
   */
  readonly desde: Instante;
  readonly xJust: string;
}

/** Resultado da consulta de status do autorizador normal: 107 é em operação; 108, 109 ou sem resposta, fora. */
export interface Sonda {
  readonly emOperacao: boolean;
  /** O que a consulta respondeu (`107`, `108`, `sem resposta`), para o motivo e o log. */
  readonly detalhe: string;
}

/**
 * Situação da SVC da UF pela consulta de status nela (NT 2013.007 v1.03, item 04.7, regras K05.1 a K05.3): `ativa`
 * (107), `desativando` (113, com o instante em que deixa de atender a UF, `undefined` se o `xMotivo` não o diz),
 * `desativada` (114) ou `indisponivel` (sem resposta ou outro código).
 */
export type SondaSvc =
  | { readonly situacao: 'ativa'; readonly detalhe: string }
  | { readonly situacao: 'desativando'; readonly fim: Instante | undefined; readonly detalhe: string }
  | { readonly situacao: 'desativada'; readonly detalhe: string }
  | { readonly situacao: 'indisponivel'; readonly detalhe: string };

/**
 * O que o perfil de um documento com contingência automática oferece ao emissor. Hoje, só o da NF-e (55 e 65).
 * `C` é o contexto do emissor; o módulo não depende dele.
 */
export interface ContingenciaDoPerfil<Entrada, C> {
  /** Escopo do autorizador normal da entrada; `undefined` se a entrada já traz a contingência. */
  escopo(entrada: Entrada): EscopoContingencia | undefined;
  /**
   * Escopo dos bytes assinados, pela chave, e se eles já estão em contingência (`tpEmis` diferente de 1) e na off-line
   * (NFC-e, `tpEmis` 9). `undefined` quando os bytes não dizem.
   */
  dosBytes(xml: string): ContingenciaDosBytes | undefined;
  /**
   * A entrada com a contingência do escopo: o `tpEmis` da SVC da UF (NF-e) ou 9 (NFC-e), `dhCont` (o `desde`, ou a
   * emissão se ela vier antes) e `xJust`.
   */
  aplicar(entrada: Entrada, escopo: EscopoContingencia, c: ContingenciaAplicada, ctx: C): Entrada;
  /**
   * A contingência do escopo é a off-line (a nota é gravada sem envio). A off-line é decisão do emitente; a outra, a
   * SVC, só vale com a SVC ativada pela SEFAZ de origem.
   */
  offline(escopo: EscopoContingencia): boolean;
  /** Consulta o status do autorizador normal do escopo. Não lança: sem resposta é `emOperacao: false`. */
  sondar(escopo: EscopoContingencia, ctx: C): Promise<Sonda>;
  /** Consulta o status na SVC da UF do escopo (só nos escopos que não são off-line). Não lança. */
  sondarSvc(escopo: EscopoContingencia, ctx: C): Promise<SondaSvc>;
  /** O desfecho de um envio em emissão normal é falha do autorizador (sem resposta, serviço paralisado). */
  falha(d: Desfecho): boolean;
  /** O envio à SVC foi recusado porque a SVC não está ativada para a UF (114). */
  svcDesativada(d: Desfecho): boolean;
}

/** Os seis métodos da contingência do store. */
export type ContingenciaStore = Required<
  Pick<
    TransmissaoStore,
    | 'registrarFalhaDoAutorizador'
    | 'contingenciaAtiva'
    | 'entrarEmContingencia'
    | 'sairDaContingencia'
    | 'reservarSonda'
    | 'marcarFimDaSvc'
  >
>;

const METODOS = [
  'registrarFalhaDoAutorizador',
  'contingenciaAtiva',
  'entrarEmContingencia',
  'sairDaContingencia',
  'reservarSonda',
  'marcarFimDaSvc',
] as const;

/** Onde a contingência em memória guarda o estado; o `BancoMemoria` carrega um, compartilhado entre emissores. */
export interface DadosContingenciaMemoria {
  readonly falhas: Map<string, { primeiraEm: number; vezes: number }>;
  readonly estados: Map<string, { desde: number; motivo: string; fimDaSvc: number | undefined }>;
  /** Última consulta de status reservada de cada escopo, em contingência ou não. */
  readonly sondas: Map<string, number>;
}

export function dadosContingenciaMemoria(): DadosContingenciaMemoria {
  return { falhas: new Map(), estados: new Map(), sondas: new Map() };
}

/**
 * Estado da contingência num processo só, pelo `clock`: o do `@sinete/emissor/memoria` e o do emissor cujo store não
 * implementa os métodos da contingência.
 */
export function contingenciaEmMemoria(
  clock: Relogio,
  dados: DadosContingenciaMemoria = dadosContingenciaMemoria(),
): ContingenciaStore {
  const { falhas, estados, sondas } = dados;
  const agora = (): number => clock.agora().getTime();
  /** Instante sem o global `Date` (relógio injetado): uma cópia do `Date` do relógio. */
  const instante = (ms: number): Instante => {
    const d = clock.agora();
    d.setTime(ms);
    return d;
  };
  const comoEstado = (
    k: string,
    e: { desde: number; motivo: string; fimDaSvc: number | undefined },
  ): EstadoContingencia => {
    const sondadaEm = sondas.get(k);
    return {
      desde: instante(e.desde),
      motivo: e.motivo,
      ...(sondadaEm === undefined ? {} : { sondadaEm: instante(sondadaEm) }),
      ...(e.fimDaSvc === undefined ? {} : { fimDaSvc: instante(e.fimDaSvc) }),
    };
  };
  return {
    async registrarFalhaDoAutorizador(escopo: string, janelaMs: number): Promise<number> {
      const t = agora();
      const f = falhas.get(escopo);
      const n =
        f === undefined || t - f.primeiraEm > janelaMs ? { primeiraEm: t, vezes: 1 } : { ...f, vezes: f.vezes + 1 };
      falhas.set(escopo, n);
      return n.vezes;
    },
    async contingenciaAtiva(escopo: string): Promise<EstadoContingencia | undefined> {
      const e = estados.get(escopo);
      return e === undefined ? undefined : comoEstado(escopo, e);
    },
    async entrarEmContingencia(
      escopo: string,
      motivo: string,
    ): Promise<{ readonly estado: EstadoContingencia; readonly entrou: boolean }> {
      const e = estados.get(escopo);
      if (e !== undefined) return { estado: comoEstado(escopo, e), entrou: false };
      const t = agora();
      const novo = { desde: t, motivo, fimDaSvc: undefined };
      estados.set(escopo, novo);
      sondas.set(escopo, t);
      return { estado: comoEstado(escopo, novo), entrou: true };
    },
    async sairDaContingencia(escopo: string): Promise<boolean> {
      falhas.delete(escopo);
      if (!estados.delete(escopo)) return false;
      sondas.delete(escopo);
      return true;
    },
    async reservarSonda(escopo: string, intervaloMs: number): Promise<boolean> {
      const s = sondas.get(escopo);
      const t = agora();
      if (s !== undefined && t - s < intervaloMs) return false;
      sondas.set(escopo, t);
      return true;
    },
    async marcarFimDaSvc(escopo: string, fim: Instante | undefined): Promise<boolean> {
      const e = estados.get(escopo);
      if (e === undefined) return false;
      e.fimDaSvc = fim?.getTime();
      return true;
    },
  };
}

const JANELA_PADRAO_MS = 5 * 60 * 1000;
const SONDA_PADRAO_MS = 5 * 60 * 1000;
const LIMITE_PADRAO = 3;
const XJUST_PADRAO = 'SEFAZ autorizadora sem resposta: contingencia automatica';

/** A contingência automática ligada: opções conferidas e o estado (store ou memória). */
export interface Contingencia<Entrada, C> {
  /** A entrada com a contingência, se o escopo dela está em contingência (com a sonda da volta, se venceu). */
  naMontagem(entrada: Entrada, ctx: C): Promise<{ readonly entrada: Entrada; readonly offline: boolean }>;
  /** Os bytes gravados são de uma NFC-e off-line cujo autorizador ainda está fora: não envie. */
  seguraOffline(xml: string, ctx: C): Promise<boolean>;
  /** Conta a falha do envio em emissão normal e, no limite, confirma pela sonda e entra em contingência. */
  depoisDoEnvio(xml: string, d: Desfecho, ctx: C): Promise<void>;
}

/**
 * Confere as opções e devolve a contingência ligada, ou `undefined` desligada. `ConfigError` com `automatica: true`
 * num documento sem contingência automática, com limites fora da faixa, com o store implementando só parte dos métodos.
 */
export function criarContingencia<Entrada, C>(deps: {
  readonly opcoes: OpcoesContingencia | undefined;
  readonly perfil: ContingenciaDoPerfil<Entrada, C> | undefined;
  readonly tipo: TipoDocumento;
  readonly ambiente: string;
  readonly store: TransmissaoStore;
  readonly clock: Relogio;
  readonly logger: Logger;
  readonly aoMudar: ((m: MudancaContingencia) => void | Promise<void>) | undefined;
}): Contingencia<Entrada, C> | undefined {
  const { opcoes, perfil, store, clock, logger, aoMudar } = deps;
  const implementados = METODOS.filter((m) => typeof store[m] === 'function').length;
  if (implementados !== 0 && implementados !== METODOS.length) {
    throw new ErroDeConfiguracao(
      `o store implementa os métodos da contingência todos juntos, ou nenhum: ${METODOS.join(', ')}`,
    );
  }
  if (aoMudar !== undefined && typeof aoMudar !== 'function') {
    throw new ErroDeConfiguracao('aoMudarContingencia precisa ser uma função');
  }
  if (opcoes?.automatica !== true) return undefined;
  if (perfil === undefined) {
    throw new ErroDeConfiguracao(
      `o emissor de ${deps.tipo} não tem contingência automática (ADR 0013: só NF-e e NFC-e)`,
    );
  }
  const doPerfil: ContingenciaDoPerfil<Entrada, C> = perfil;
  const limite = opcoes.limiteFalhas ?? LIMITE_PADRAO;
  if (!Number.isInteger(limite) || limite < 1) throw new ErroDeConfiguracao(`limiteFalhas inválido: ${limite}`);
  const janelaMs = opcoes.janelaMs ?? JANELA_PADRAO_MS;
  if (!Number.isFinite(janelaMs) || janelaMs <= 0) throw new ErroDeConfiguracao(`janelaMs inválido: ${janelaMs}`);
  const sondaMs = opcoes.sondaMs ?? SONDA_PADRAO_MS;
  if (!Number.isFinite(sondaMs) || sondaMs <= 0) throw new ErroDeConfiguracao(`sondaMs inválido: ${sondaMs}`);
  const xJust = opcoes.xJust ?? XJUST_PADRAO;
  // MOC 7.0 Anexo I, campo B29: 15 a 256 caracteres.
  if (xJust.trim().length < 15 || xJust.length > 256) {
    throw new ErroDeConfiguracao('xJust da contingência com 15 a 256 caracteres (MOC 7.0 Anexo I, campo B29)');
  }
  const estado: ContingenciaStore =
    implementados === METODOS.length ? (store as ContingenciaStore) : contingenciaEmMemoria(clock);
  const chave = (e: EscopoContingencia): string => `${deps.ambiente}:${e.documento}:${e.modelo}:${e.uf}`;

  const avisar = async (m: MudancaContingencia): Promise<void> => {
    const msg = {
      entrou: 'emissor: entrou em contingência',
      saiu: 'emissor: saiu da contingência',
      'svc-indisponivel': 'emissor: autorizador indisponível e SVC indisponível para a UF',
    }[m.tipo];
    logger.warn(msg, { ...m.escopo, motivo: m.motivo });
    try {
      await aoMudar?.(m);
    } catch (e) {
      logger.warn('emissor: aoMudarContingencia falhou', { erro: String(e) });
    }
  };

  const sair = async (escopo: EscopoContingencia, motivo: string): Promise<void> => {
    if (await estado.sairDaContingencia(chave(escopo))) await avisar({ tipo: 'saiu', escopo, motivo });
  };

  /**
   * A sonda da volta, com a consulta já reservada: o autorizador normal em 107 encerra a contingência. Na SVC, 114
   * (desabilitada pela SEFAZ de origem) também encerra; 113 (em desativação) marca a hora em que a SVC deixa de atender
   * a UF, e sem hora legível, ou com ela já passada, encerra na hora (NT 2013.007 v1.03, item 04.7, regras K05.1 e
   * K05.3). `true`: a contingência continua.
   */
  async function sondarVolta(escopo: EscopoContingencia, ativo: EstadoContingencia, ctx: C): Promise<boolean> {
    const s = await doPerfil.sondar(escopo, ctx);
    if (s.emOperacao) {
      await sair(escopo, `autorizador normal em operação (status ${s.detalhe})`);
      return false;
    }
    if (doPerfil.offline(escopo)) return true;
    const v = await doPerfil.sondarSvc(escopo, ctx);
    if (v.situacao === 'desativada') {
      await sair(escopo, `SVC desabilitada pela SEFAZ de origem (status da SVC: ${v.detalhe})`);
      return false;
    }
    if (v.situacao === 'desativando') {
      if (v.fim === undefined || v.fim.getTime() <= clock.agora().getTime()) {
        await sair(escopo, `SVC em desativação para a UF (status da SVC: ${v.detalhe})`);
        return false;
      }
      await estado.marcarFimDaSvc(chave(escopo), v.fim);
    }
    // 107 depois de um 113: a SEFAZ de origem manteve a SVC, e a hora anunciada não vale mais.
    if (v.situacao === 'ativa' && ativo.fimDaSvc !== undefined) await estado.marcarFimDaSvc(chave(escopo), undefined);
    // Ativa, ou sem resposta: a nota nova segue na SVC, e a próxima falha nela sonda de novo.
    return true;
  }

  /** A contingência em vigor no escopo, depois da sonda da volta quando ela venceu. */
  async function emVigor(escopo: EscopoContingencia, ctx: C): Promise<EstadoContingencia | undefined> {
    const k = chave(escopo);
    let ativo = await estado.contingenciaAtiva(k);
    if (ativo === undefined) return undefined;
    if (await estado.reservarSonda(k, sondaMs)) {
      if (!(await sondarVolta(escopo, ativo, ctx))) return undefined;
      // A sonda pode ter marcado ou apagado a hora do 113, e a espera por ela pode ter passado dessa hora.
      ativo = await estado.contingenciaAtiva(k);
      if (ativo === undefined) return undefined;
    }
    // 113: a partir da hora informada, a SVC não atende mais a UF, e a nota nova não vai a ela.
    if (ativo.fimDaSvc !== undefined && ativo.fimDaSvc.getTime() <= clock.agora().getTime()) {
      await sair(escopo, `SVC desabilitada para a UF desde ${ativo.fimDaSvc.toISOString()} (status 113 da SVC)`);
      return undefined;
    }
    return ativo;
  }

  /** Falha no caminho da contingência não derruba a emissão: sem estado, a nota segue em emissão normal. */
  async function seguro<T>(o: string, f: () => Promise<T>, padrao: T): Promise<T> {
    try {
      return await f();
    } catch (e) {
      logger.warn(`emissor: contingência automática, ${o} falhou`, { erro: String(e) });
      return padrao;
    }
  }

  /** NFC-e: a off-line é decisão do emitente (Ajuste SINIEF 19/16), confirmada pelo status do autorizador normal. */
  async function entrarOffline(escopo: EscopoContingencia, n: number, ctx: C): Promise<void> {
    const s = await doPerfil.sondar(escopo, ctx);
    if (s.emOperacao) return;
    const motivo = `${n} falhas de transmissão em até ${Math.round(janelaMs / 1000)} s; status do serviço: ${s.detalhe}`;
    const r = await estado.entrarEmContingencia(chave(escopo), motivo);
    if (r.entrou) await avisar({ tipo: 'entrou', escopo, desde: r.estado.desde, motivo });
  }

  /**
   * NF-e: a SVC só autoriza depois que a SEFAZ de origem a ativa para a UF (NT 2013.007 v1.03, item 03), e a empresa
   * só a usa com 107 na consulta de status feita nela (item 04.7). Sem ativação, a nota segue em emissão normal, e a
   * reserva da consulta guarda a resposta por `sondaMs`: nenhum processo consulta a SVC de novo antes disso.
   */
  async function entrarNaSvc(escopo: EscopoContingencia, n: number, ctx: C): Promise<void> {
    const k = chave(escopo);
    if (!(await estado.reservarSonda(k, sondaMs))) return;
    const v = await doPerfil.sondarSvc(escopo, ctx);
    const falhas = `${n} falhas de transmissão em até ${Math.round(janelaMs / 1000)} s`;
    if (v.situacao !== 'ativa') {
      const svc = {
        desativada: 'SVC não ativada pela SEFAZ',
        desativando: 'SVC em desativação para a UF',
        indisponivel: 'SVC sem resposta',
      }[v.situacao];
      const motivo = `autorizador indisponível e ${svc} (${falhas}; status da SVC: ${v.detalhe})`;
      await avisar({ tipo: 'svc-indisponivel', escopo, motivo });
      return;
    }
    const motivo = `${falhas}; SVC ativada para a UF (status da SVC: ${v.detalhe})`;
    const r = await estado.entrarEmContingencia(k, motivo);
    if (r.entrou) await avisar({ tipo: 'entrou', escopo, desde: r.estado.desde, motivo });
  }

  return {
    async naMontagem(entrada: Entrada, ctx: C): Promise<{ readonly entrada: Entrada; readonly offline: boolean }> {
      const escopo = doPerfil.escopo(entrada);
      if (escopo === undefined) return { entrada, offline: false };
      const ativo = await seguro('ler o estado', () => emVigor(escopo, ctx), undefined);
      if (ativo === undefined) return { entrada, offline: false };
      return {
        entrada: doPerfil.aplicar(entrada, escopo, { desde: ativo.desde, xJust }, ctx),
        offline: doPerfil.offline(escopo),
      };
    },
    async seguraOffline(xml: string, ctx: C): Promise<boolean> {
      const b = doPerfil.dosBytes(xml);
      if (b === undefined || !b.offline) return false;
      return (await seguro('ler o estado', () => emVigor(b.escopo, ctx), undefined)) !== undefined;
    },
    async depoisDoEnvio(xml: string, d: Desfecho, ctx: C): Promise<void> {
      const b = doPerfil.dosBytes(xml);
      if (b === undefined) return;
      if (b.emContingencia) {
        if (b.offline) return;
        const k = chave(b.escopo);
        if (doPerfil.svcDesativada(d)) {
          // 114 na autorização: a SEFAZ de origem desligou a SVC para a UF (NT 2013.007 v1.03, item 04.1, regras C03.2
          // e GB02.2). É a resposta da própria SVC e vale como a sonda: sai na hora, e a reserva guarda a SVC como
          // inativa por `sondaMs`, para a próxima falha na UF não consultá-la de novo.
          await seguro(
            'sair depois do 114 na SVC',
            async () => {
              await sair(b.escopo, 'SVC desabilitada pela SEFAZ de origem (114 na autorização)');
              await estado.reservarSonda(k, 0);
            },
            undefined,
          );
          return;
        }
        if (!doPerfil.falha(d)) return;
        // A SVC falhou sem dizer por quê (sem resposta, 108, 109): pode ser que a SEFAZ de origem já a desligou. Sonda
        // agora, sem esperar o intervalo, para a próxima nota não sair para uma SVC que não atende mais.
        await seguro(
          'sondar depois da falha na contingência',
          async () => {
            const ativo = await estado.contingenciaAtiva(k);
            if (ativo !== undefined && (await estado.reservarSonda(k, 0))) await sondarVolta(b.escopo, ativo, ctx);
          },
          undefined,
        );
        return;
      }
      if (!doPerfil.falha(d)) return;
      await seguro(
        'contar a falha',
        async () => {
          const k = chave(b.escopo);
          const n = await estado.registrarFalhaDoAutorizador(k, janelaMs);
          if (n < limite || (await estado.contingenciaAtiva(k)) !== undefined) return;
          await (doPerfil.offline(b.escopo) ? entrarOffline(b.escopo, n, ctx) : entrarNaSvc(b.escopo, n, ctx));
        },
        undefined,
      );
    },
  };
}
