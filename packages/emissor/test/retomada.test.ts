/**
 * `retomarPendentes` sobre o adaptador em memória com o relógio manual, com a retomada trocada por um dublê: seleção
 * (idade, atividade recente, trava, lote), filtro do integrador, contagem das tentativas, alerta único e prazo da
 * execução. São os casos de retomada de um integrador em produção; o caminho de verdade contra o simulador, concorrendo com
 * o usuário, está em `nfe.test.ts`.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import { relogioManual } from '@sinete/core';
import type { Desfecho, RegistroTransmissao, RetomadaOpcoes, TipoDocumento, TransmissaoStore } from '../src/index.ts';
import {
  ErroTransmissaoEmAndamento,
  ErroTravaPerdida,
  POLITICA_RETOMADA_PADRAO,
  retomarPendentes,
} from '../src/index.ts';
import { criarMemoriaStore } from '../src/memoria.ts';

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

type Comportamento = 'resolve' | 'falha' | 'ocupada' | 'divergente' | 'sem-bytes' | 'descarta' | 'pendente';

let clock: RelogioManual;
let store: TransmissaoStore;
let comportamento: Map<string, Comportamento>;
let chamadas: string[];
let alertas: { registro: RegistroTransmissao; ultimo: unknown; tentativas: number }[];

beforeEach(() => {
  clock = relogioManual('2026-09-27T10:00:00-03:00');
  store = criarMemoriaStore({ relogio: clock });
  comportamento = new Map();
  chamadas = [];
  alertas = [];
});

/** Grava bytes para `ref` e deixa o relógio andar `parada` (a gravação fica parada esse tempo). */
async function gravada(ref: string, tipo: TipoDocumento = 'nfe'): Promise<void> {
  const t = await store.travar(tipo, ref, 10 * MIN);
  if (t === undefined) throw new Error('travada');
  await store.gravar(t, { xml: '<NFe/>', id: '5'.repeat(44), meta: {} });
  await store.soltar(t);
}

const divergente: Desfecho = { documento: 'nfe', tipo: 'divergente', id: 'x', cStat: '539', xMotivo: 'outra nota' };
const pendente: Desfecho = { documento: 'nfe', tipo: 'pendente', id: 'x', motivo: 'consulta-indefinida' };

function opcoes(extra: Partial<RetomadaOpcoes> = {}): RetomadaOpcoes {
  return {
    store,
    relogio: clock,
    usarEmissor: (_r, fn) =>
      fn({
        async retomar(ref: string): Promise<Desfecho | undefined> {
          chamadas.push(ref);
          const c = comportamento.get(ref) ?? 'falha';
          const t = await store.travar('nfe', ref, 10 * MIN);
          if (c === 'ocupada' || t === undefined) throw new ErroTransmissaoEmAndamento('ocupada');
          try {
            if (c === 'sem-bytes') return undefined;
            if (c === 'resolve') {
              await store.concluir(t);
              return {
                documento: 'nfe',
                tipo: 'autorizado',
                id: 'x',
                cStat: '100',
                xMotivo: 'ok',
                proc: '',
                protocolo: {},
                bruto: {},
              };
            }
            if (c === 'descarta') {
              await store.descartar(t);
              return { documento: 'nfe', tipo: 'recusado', id: 'x', cStat: '999', xMotivo: 'recusada', bruto: {} };
            }
            if (c === 'divergente') return divergente;
            if (c === 'pendente') return pendente;
            throw new Error('tempo_esgotado: sem resposta');
          } finally {
            await store.soltar(t);
          }
        },
      }),
    aoAlertar: (registro, ultimo, tentativas) => {
      alertas.push({ registro, ultimo, tentativas });
    },
    ...extra,
  };
}

describe('retomarPendentes', () => {
  test('só as gravadas há até 3 dias, paradas há 5 minutos e sem trava', async () => {
    await gravada('velha');
    clock.avancar(4 * DIA);
    await gravada('boa');
    await gravada('travada', 'mdfe');
    clock.avancar(10 * MIN);
    await gravada('recente');
    clock.avancar(MIN);
    const t = await store.travar('mdfe', 'travada', 10 * MIN);
    expect(t).toBeDefined();
    const semBytes = await store.travar('nfe', 'sem-bytes', MIN);
    if (semBytes) await store.soltar(semBytes);
    comportamento.set('boa', 'resolve');
    const r = await retomarPendentes(opcoes());
    expect(chamadas).toEqual(['boa']);
    expect(r).toEqual({ candidatas: 1, desfechos: { resolvida: 1 }, alertas: 0, adiadas: 0 });
    expect(await store.ler('nfe', 'boa')).toBeUndefined();
    expect(await store.ler('nfe', 'velha')).toBeDefined();
    expect(await store.ler('nfe', 'recente')).toBeDefined();
  });

  test('lote pequeno, as nunca tentadas primeiro; o filtro do integrador não conta no lote', async () => {
    for (const ref of ['fora', 'a1', 'a2', 'a3']) {
      await gravada(ref);
      clock.avancar(MIN);
    }
    // A mais antiga já foi tentada: vai para o fim da fila.
    const a1 = await store.ler('nfe', 'a1');
    if (a1) await store.registrarTentativa(a1, { alertar: false });
    clock.avancar(20 * MIN);
    const r = await retomarPendentes(opcoes({ politica: { lote: 2 }, deveRetomar: (reg) => reg.ref !== 'fora' }));
    expect(chamadas).toEqual(['a2', 'a3']);
    expect(r.desfechos).toEqual({ ignorada: 1, 'sem-desfecho': 2 });
    expect((await store.ler('nfe', 'fora'))?.tentativas).toBe(0);
  });

  test('muitas recusadas pelo filtro não tomam a vez das outras', async () => {
    for (let n = 0; n < 60; n++) await gravada(`fora-${n}`);
    clock.avancar(MIN);
    await gravada('vez');
    clock.avancar(10 * MIN);
    comportamento.set('vez', 'resolve');
    const r = await retomarPendentes(opcoes({ deveRetomar: async (reg) => reg.ref === 'vez' }));
    expect(chamadas).toEqual(['vez']);
    expect(r.desfechos).toEqual({ ignorada: 60, resolvida: 1 });
  });

  test('mais recusadas pelo filtro que a primeira seleção: a seleção dobra e acha as de trás', async () => {
    for (let n = 0; n < 1001; n++) await gravada(`fora-${n}`);
    clock.avancar(MIN);
    await gravada('vez');
    clock.avancar(10 * MIN);
    comportamento.set('vez', 'resolve');
    const r = await retomarPendentes(opcoes({ deveRetomar: (reg) => reg.ref === 'vez' }));
    expect(chamadas).toEqual(['vez']);
    expect(r).toEqual({ candidatas: 1002, desfechos: { ignorada: 1001, resolvida: 1 }, alertas: 0, adiadas: 0 });
  });

  test('conta as tentativas sem desfecho e alerta uma vez, na terceira; depois, uma por hora', async () => {
    await gravada('doc');
    const rodar = async (): Promise<void> => {
      clock.avancar(11 * MIN);
      await retomarPendentes(opcoes());
    };
    await rodar();
    await rodar();
    expect(alertas).toHaveLength(0);
    expect((await store.ler('nfe', 'doc'))?.tentativas).toBe(2);
    await rodar();
    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.tentativas).toBe(3);
    expect(alertas[0]?.registro.ref).toBe('doc');
    // A falha real vai no alerta.
    expect(String((alertas[0]?.ultimo as { erro: Error } | undefined)?.erro)).toContain('tempo_esgotado');
    // Depois do alerta: nada na próxima execução (menos de uma hora)...
    await rodar();
    expect(chamadas).toHaveLength(3);
    // ...e uma tentativa por hora, sem alerta de novo.
    clock.avancar(HORA);
    await retomarPendentes(opcoes());
    expect(chamadas).toHaveLength(4);
    expect(alertas).toHaveLength(1);
    expect((await store.ler('nfe', 'doc'))?.tentativas).toBe(4);
  });

  test('divergente alerta na primeira tentativa; pendente não', async () => {
    await gravada('div');
    await gravada('pend');
    clock.avancar(10 * MIN);
    comportamento.set('div', 'divergente');
    comportamento.set('pend', 'pendente');
    const r = await retomarPendentes(opcoes());
    expect(r.alertas).toBe(1);
    expect(alertas[0]?.ultimo).toBe(divergente);
    expect(r.desfechos).toEqual({ 'sem-desfecho': 2 });
    expect(await store.ler('nfe', 'div')).toBeDefined();
  });

  test('o usuário com a trava: não conta tentativa; sem bytes na hora da trava: nada', async () => {
    await gravada('a');
    await gravada('b');
    clock.avancar(10 * MIN);
    comportamento.set('a', 'ocupada');
    comportamento.set('b', 'sem-bytes');
    const r = await retomarPendentes(opcoes());
    expect(r.desfechos).toEqual({ ocupada: 1, 'sem-bytes': 1 });
    expect((await store.ler('nfe', 'a'))?.tentativas).toBe(0);
    expect((await store.ler('nfe', 'b'))?.tentativas).toBe(0);
  });

  test('trava perdida no meio da retomada: quem assumiu decide, sem contar tentativa', async () => {
    await gravada('a');
    clock.avancar(10 * MIN);
    const r = await retomarPendentes(
      opcoes({
        usarEmissor: (_r, fn) =>
          fn({
            retomar: async (): Promise<Desfecho | undefined> => {
              throw new ErroTravaPerdida('assumida por outro processo');
            },
          }),
        politica: { alertarDepoisDe: 1 },
      }),
    );
    expect(r).toEqual({ candidatas: 1, desfechos: { ocupada: 1 }, alertas: 0, adiadas: 0 });
    expect((await store.ler('nfe', 'a'))?.tentativas).toBe(0);
  });

  test('o prazo vale de novo depois do filtro do integrador', async () => {
    await gravada('a');
    clock.avancar(10 * MIN);
    comportamento.set('a', 'resolve');
    const r = await retomarPendentes(
      opcoes({
        deveRetomar: () => {
          clock.avancar(8 * MIN);
          return true;
        },
      }),
    );
    expect(chamadas).toEqual([]);
    expect(r).toEqual({ candidatas: 1, desfechos: {}, alertas: 0, adiadas: 1 });
  });

  test('a gravação mudou entre a seleção e a retomada: não retoma com a seleção velha', async () => {
    for (const ref of ['tentada', 'regravada', 'concluida']) await gravada(ref);
    clock.avancar(10 * MIN);
    const r = await retomarPendentes(
      opcoes({
        deveRetomar: async (reg) => {
          // Outra execução (ou o usuário) mexeu na gravação depois da seleção desta.
          if (reg.ref === 'tentada') await store.registrarTentativa(reg, { alertar: false });
          const t = await store.travar('nfe', reg.ref, MIN);
          if (t === undefined) throw new Error('travada');
          if (reg.ref === 'regravada') {
            await store.descartar(t);
            await store.gravar(t, { xml: '<NFe/>', id: '5'.repeat(44), meta: {} });
          }
          if (reg.ref === 'concluida') await store.concluir(t);
          await store.soltar(t);
          return true;
        },
      }),
    );
    expect(chamadas).toEqual([]);
    expect(r.desfechos).toEqual({ ocupada: 1, resolvida: 1, 'sem-bytes': 1 });
    expect((await store.ler('nfe', 'tentada'))?.tentativas).toBe(1);
  });

  test('recusa que descarta os bytes conta como resolvida', async () => {
    await gravada('doc');
    clock.avancar(10 * MIN);
    comportamento.set('doc', 'descarta');
    const r = await retomarPendentes(opcoes());
    expect(r.desfechos).toEqual({ resolvida: 1 });
    expect(await store.ler('nfe', 'doc')).toBeUndefined();
  });

  test('para de começar retomadas depois do prazo da execução', async () => {
    await gravada('a');
    await gravada('b');
    clock.avancar(10 * MIN);
    const r = await retomarPendentes(
      opcoes({
        usarEmissor: async (_r, fn) =>
          fn({
            async retomar(): Promise<Desfecho | undefined> {
              clock.avancar(8 * MIN);
              return pendente;
            },
          }),
      }),
    );
    expect(r.adiadas).toBe(1);
    expect(r.desfechos).toEqual({ 'sem-desfecho': 1 });
  });

  test('signal: a retomada em curso recebe o sinal; abortada, ela e as seguintes ficam para a próxima execução', async () => {
    for (const ref of ['a1', 'a2']) {
      await gravada(ref);
      clock.avancar(MIN);
    }
    clock.avancar(10 * MIN);
    const ctrl = new AbortController();
    const recebidos: (AbortSignal | undefined)[] = [];
    const r = await retomarPendentes(
      opcoes({
        signal: ctrl.signal,
        usarEmissor: (_r, fn) =>
          fn({
            async retomar(ref, o): Promise<Desfecho> {
              chamadas.push(ref);
              recebidos.push(o?.signal);
              ctrl.abort();
              return { documento: 'nfe', tipo: 'pendente', id: 'x', motivo: 'sem-resposta' };
            },
          }),
      }),
    );
    expect(chamadas).toEqual(['a1']);
    expect(recebidos).toEqual([ctrl.signal]);
    expect(r).toEqual({ candidatas: 2, desfechos: {}, alertas: 0, adiadas: 2 });
    expect((await store.ler('nfe', 'a1'))?.tentativas).toBe(0);
    expect((await store.ler('nfe', 'a2'))?.tentativas).toBe(0);
  });

  test('a idade máxima nunca é infinita, e a política é conferida', async () => {
    expect(POLITICA_RETOMADA_PADRAO.idadeMaximaMs).toBe(3 * DIA);
    for (const politica of [{ idadeMaximaMs: Number.POSITIVE_INFINITY }, { idadeMaximaMs: 0 }, { lote: -1 }]) {
      await expect(retomarPendentes(opcoes({ politica }))).rejects.toMatchObject({ code: 'config_invalida' });
    }
    await expect(
      retomarPendentes({ ...opcoes(), aoAlertar: undefined } as unknown as RetomadaOpcoes),
    ).rejects.toMatchObject({ code: 'config_invalida' });
  });

  test('aoDecidir e jaGuardado da retomada chegam ao retomar de cada gravação', async () => {
    await gravada('a');
    clock.avancar(10 * MIN);
    const recebidas: unknown[] = [];
    const aoDecidir = (): void => {};
    const jaGuardado = (): boolean => false;
    await retomarPendentes(
      opcoes({
        aoDecidir,
        jaGuardado,
        usarEmissor: (_r, fn) =>
          fn({
            async retomar(_ref, o): Promise<Desfecho | undefined> {
              recebidas.push(o);
              return pendente;
            },
          }),
      }),
    );
    expect(recebidas).toHaveLength(1);
    expect(recebidas[0]).toMatchObject({ aoDecidir, jaGuardado });
  });
});
