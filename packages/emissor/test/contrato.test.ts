/**
 * O adaptador em memória passa na suíte de contrato do `TransmissaoStore`, duas vezes: com o relógio manual (a espera
 * avança o relógio do "banco", sem dormir) e com o relógio do sistema e esperas de verdade, como um adaptador SQL roda.
 * A suíte também é conferida contra adaptadores quebrados de propósito: cada defeito que produz nota duplicada precisa
 * reprovar.
 */
import { describe, expect, test } from 'bun:test';
import { relogioManual } from '@sinete/core';
import type { AmbienteContrato } from '../src/contrato.ts';
import { ContratoVioladoError, casosDoContrato } from '../src/contrato.ts';
import { createBancoMemoria, createMemoriaStore } from '../src/memoria.ts';
import type { TransmissaoStore } from '../src/store.ts';

describe('contrato do TransmissaoStore no adaptador em memória, relógio manual', () => {
  const clock = relogioManual('2026-09-27T10:00:00-03:00');
  const casos = casosDoContrato({
    criar: (): AmbienteContrato => {
      const banco = createBancoMemoria();
      return { a: createMemoriaStore({ clock, banco }), b: createMemoriaStore({ clock, banco }) };
    },
    esperar: async (ms) => {
      clock.avancar(ms);
    },
  });
  test('a suíte tem os casos de um integrador em produção', () => {
    expect(casos.length).toBeGreaterThanOrEqual(14);
  });
  for (const caso of casos) test(caso.nome, caso.rodar);
});

describe('contrato do TransmissaoStore no adaptador em memória, relógio do sistema', () => {
  let fechados = 0;
  const casos = casosDoContrato({
    criar: (): AmbienteContrato => {
      const banco = createBancoMemoria();
      return {
        a: createMemoriaStore({ banco }),
        b: createMemoriaStore({ banco }),
        fechar: async () => {
          fechados++;
        },
      };
    },
    prazoCurtoMs: 60,
  });
  for (const caso of casos) test(caso.nome, caso.rodar, 10_000);
  test('fechar roda em todo caso', () => {
    expect(fechados).toBe(casos.length);
  });
});

/** Adaptador em memória com um defeito injetado. */
function quebrado(defeito: (s: TransmissaoStore) => Partial<TransmissaoStore>): () => AmbienteContrato {
  return () => {
    const clock = relogioManual('2026-09-27T10:00:00-03:00');
    const banco = createBancoMemoria();
    const embrulha = (s: TransmissaoStore): TransmissaoStore => ({ ...s, ...defeito(s) });
    return { a: embrulha(createMemoriaStore({ clock, banco })), b: embrulha(createMemoriaStore({ clock, banco })) };
  };
}

async function reprovados(criar: () => AmbienteContrato): Promise<string[]> {
  const nomes: string[] = [];
  for (const caso of casosDoContrato({ criar, esperar: async () => {} })) {
    try {
      await caso.rodar();
    } catch (e) {
      expect(e).toBeInstanceOf(ContratoVioladoError);
      expect((e as ContratoVioladoError).code).toBe('contrato_violado');
      nomes.push(caso.nome);
    }
  }
  return nomes;
}

describe('a suíte reprova adaptadores errados', () => {
  test('trava que não confere a outra em vigor', async () => {
    const r = await reprovados(
      quebrado((s) => ({
        travar: async (tipo, ref, prazo) => {
          const t = await s.travar(tipo, ref, prazo);
          return t ?? { tipo, ref, token: 'intrusa' };
        },
      })),
    );
    expect(r).toContain('dez travas ao mesmo tempo, de dois processos: uma vence');
  });

  test('gravar sem conferir a trava nem os bytes já gravados', async () => {
    const r = await reprovados(
      quebrado((s) => ({
        gravar: async (t, g) => {
          await s.descartar(t).catch(() => {});
          const nova = (await s.travar(t.tipo, t.ref, 3_600_000)) ?? t;
          return s.gravar(nova, g);
        },
      })),
    );
    expect(r).toContain('gravar por cima de bytes gravados é recusado');
  });

  test('concluir sem conferir o dono apaga a gravação de quem assumiu', async () => {
    const r = await reprovados(
      quebrado((s) => ({
        concluir: async (t) => {
          const dono = await s.travar(t.tipo, t.ref, 1);
          if (dono !== undefined) await s.concluir(dono);
        },
      })),
    );
    expect(r).toContain('trava perdida: renovar falha, concluir não apaga a gravação nova e descartar é recusado');
  });

  test('bytes que não sobrevivem a outro processo', async () => {
    const r = await reprovados(() => {
      const clock = relogioManual('2026-09-27T10:00:00-03:00');
      return { a: createMemoriaStore({ clock }), b: createMemoriaStore({ clock }) };
    });
    expect(r).toContain('bytes, id e meta gravados sobrevivem ao processo e a outra leitura');
  });

  test('alerta que sai mais de uma vez', async () => {
    const r = await reprovados(
      quebrado((s) => ({
        registrarTentativa: async (reg, o) => ({ ...(await s.registrarTentativa(reg, o)), alertou: o.alertar }),
      })),
    );
    expect(r).toContain('tentativas contam e o alerta sai uma vez; a alertada volta depois do intervalo');
  });

  test('recusa lembrada sem separar o documento', async () => {
    const r = await reprovados(
      quebrado((s) => ({
        registrarRecusa: async (_tipo, _ref, recusa, janela) => s.registrarRecusa?.('nfe', 'doc', recusa, janela),
        recusaRecente: async (_tipo, _ref, janela) => s.recusaRecente?.('nfe', 'doc', janela),
      })),
    );
    expect(r).toContain('outro conteúdo, outro cStat ou a janela vencida recomeçam a conta');
  });

  test('recusa lembrada sem contar', async () => {
    const r = await reprovados(
      quebrado((s) => ({
        recusaRecente: async (tipo, ref, janela) => {
          const x = await s.recusaRecente?.(tipo, ref, janela);
          return x === undefined ? undefined : { ...x, vezes: 1 };
        },
      })),
    );
    expect(r).toContain('a mesma recusa dentro da janela conta, de dois processos');
  });

  test('store sem os métodos de recusa reprova os casos deles, a não ser com recusas: false', async () => {
    const tira = ({ registrarRecusa: _r, recusaRecente: _c, ...resto }: TransmissaoStore): TransmissaoStore => resto;
    const sem = (): AmbienteContrato => {
      const amb = quebrado(() => ({}))();
      return { a: tira(amb.a), b: tira(amb.b) };
    };
    const r = await reprovados(sem);
    expect(r).toContain('a recusa sobrevive a travar, gravar, descartar e soltar o documento');
    const nomes = casosDoContrato({ criar: sem, recusas: false }).map((c) => c.nome);
    expect(nomes).not.toContain('a recusa sobrevive a travar, gravar, descartar e soltar o documento');
    expect(casosDoContrato({ criar: sem }).length - nomes.length).toBe(4);
  });
});
