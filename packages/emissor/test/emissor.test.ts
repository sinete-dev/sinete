/**
 * O ciclo de `createEmissor` com um perfil de mentira (sem rede): trava, gravação antes do envio, política dos bytes,
 * conferência da trava antes de guardar o desfecho e soltura no fim. Os perfis de verdade contra o simulador estão em
 * `nfe.test.ts`, `mdfe.test.ts` e `nfse.test.ts`.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao, ErroDeTempoEsgotado, ErroDeValidacao, loggerEmMemoria, relogioManual } from '@sinete/core';
import { syntheticCertificate, syntheticPfx } from '@sinete/sefaz-sim';
import type { Desfecho, OpcoesEmissor, PerfilDocumento, RegistroTransmissao, TransmissaoStore } from '../src/index.ts';
import {
  abrirCertificado,
  createEmissor,
  destinoDosBytes,
  RecusaRepetidaError,
  semResposta,
  TransmissaoEmAndamentoError,
} from '../src/index.ts';
import { createBancoMemoria, createMemoriaStore } from '../src/memoria.ts';

const SENHA = 'senha-sintetica';
const EMISSAO = '2026-09-27T10:00:00-03:00';
let pfx: Uint8Array;

beforeAll(async () => {
  const clock = relogioManual(EMISSAO);
  const ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
  const titular = await syntheticCertificate({ clock, role: 'titular', cnpj: '11222333000181', issuer: ac });
  pfx = syntheticPfx(titular, SENHA, { chain: [ac] });
}, 60_000);

type Entrada = { readonly n: number; readonly invalida?: boolean };

/** Perfil de mentira: `respostas` diz o desfecho de cada envio, na ordem. */
function perfil(respostas: (Desfecho | Error)[], log: string[] = []): PerfilDocumento<Entrada, { readonly c: 1 }> {
  let assinaturas = 0;
  return {
    tipo: 'nfe',
    indefinido: (cStat) => cStat === '204',
    criarCliente: (ctx) => {
      log.push(`cliente ${ctx.titular.cnpj}`);
      return { c: 1 };
    },
    async assinar(e) {
      if (e.invalida)
        throw new ErroDeValidacao('inválida', [{ caminho: 'n', code: 'campo_obrigatorio', mensagem: 'x' }]);
      assinaturas++;
      log.push(`assinar ${e.n}`);
      return { id: `chave-${e.n}`, xml: `<doc n="${e.n}" a="${assinaturas}"/>` };
    },
    async enviar(_c, xml, modo) {
      log.push(`enviar ${modo} ${xml}`);
      const r = respostas.shift();
      if (r === undefined) throw new Error('sem resposta programada');
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

const autorizado = (id = 'chave-1'): Desfecho => ({
  documento: 'nfe',
  tipo: 'autorizado',
  id,
  cStat: '100',
  xMotivo: 'Autorizado',
  proc: '<proc/>',
  protocolo: {},
  bruto: {},
});
const recusado = (cStat: string): Desfecho => ({
  documento: 'nfe',
  tipo: 'recusado',
  id: 'chave-1',
  cStat,
  xMotivo: 'x',
  bruto: {},
});
const pendente: Desfecho = { documento: 'nfe', tipo: 'pendente', id: 'chave-1', motivo: 'sem-resposta' };

interface Montagem {
  readonly store: TransmissaoStore;
  readonly decididos: { readonly registro: RegistroTransmissao; readonly desfecho: Desfecho }[];
  readonly opcoes: OpcoesEmissor;
}

function montar(extra: Partial<OpcoesEmissor> = {}): Montagem {
  const clock = relogioManual(EMISSAO);
  const store = createMemoriaStore({ clock });
  const decididos: Montagem['decididos'] = [];
  return {
    store,
    decididos,
    opcoes: {
      pfx,
      senha: SENHA,
      ambiente: 'homologacao',
      clock,
      store,
      aoDecidir: (registro, desfecho) => {
        decididos.push({ registro, desfecho });
      },
      transporte: () => {
        throw new Error('o perfil de mentira não usa transporte');
      },
      ...extra,
    },
  };
}

describe('createEmissor: ciclo dos bytes', () => {
  test('autorizado: grava antes de enviar, guarda pelo aoDecidir e conclui', async () => {
    const m = montar();
    const log: string[] = [];
    const e = await createEmissor(perfil([autorizado()], log), m.opcoes);
    expect(e.tipo).toBe('nfe');
    const d = await e.emitir('rascunho-1', { n: 1 }, { meta: { itens: [1, 2] } });
    expect(d.tipo).toBe('autorizado');
    expect(log).toEqual(['assinar 1', 'cliente 11222333000181', 'enviar primeiro <doc n="1" a="1"/>']);
    expect(m.decididos).toHaveLength(1);
    expect(m.decididos[0]?.registro).toMatchObject({ ref: 'rascunho-1', id: 'chave-1', meta: { itens: [1, 2] } });
    expect(await m.store.ler('nfe', 'rascunho-1')).toBeUndefined();
    // A trava foi solta: outro processo trava.
    expect(await m.store.travar('nfe', 'rascunho-1', 1000)).toBeDefined();
  });

  test('pendente mantém os bytes; o próximo emitir retoma com eles, sem montar de novo', async () => {
    const m = montar();
    const log: string[] = [];
    const e = await createEmissor(perfil([pendente, autorizado()], log), m.opcoes);
    expect((await e.emitir('r', { n: 1 })).tipo).toBe('pendente');
    const gravado = await m.store.ler('nfe', 'r');
    expect(gravado?.xml).toBe('<doc n="1" a="1"/>');
    expect(m.decididos).toHaveLength(0);
    // A nota "editada" pede outro número: os bytes gravados valem.
    const d = await e.emitir('r', { n: 7 });
    expect(d.tipo).toBe('autorizado');
    expect(log.filter((l) => l.startsWith('assinar'))).toEqual(['assinar 1']);
    expect(log.at(-1)).toBe('enviar retomada <doc n="1" a="1"/>');
    expect(await m.store.ler('nfe', 'r')).toBeUndefined();
  });

  test('recusado descarta; recusado indefinido (204) e divergente mantêm', async () => {
    const m = montar();
    const divergente: Desfecho = { documento: 'nfe', tipo: 'divergente', id: 'chave-1', xMotivo: 'outra' };
    const e = await createEmissor(perfil([recusado('225'), recusado('204'), divergente]), m.opcoes);
    expect((await e.emitir('a', { n: 1 })).tipo).toBe('recusado');
    expect(await m.store.ler('nfe', 'a')).toBeUndefined();
    await e.emitir('b', { n: 2 });
    expect(await m.store.ler('nfe', 'b')).toBeDefined();
    await e.emitir('c', { n: 3 });
    expect(await m.store.ler('nfe', 'c')).toBeDefined();
    expect(m.decididos).toHaveLength(0);
  });

  test('retomar sem bytes gravados devolve undefined e não monta', async () => {
    const m = montar();
    const log: string[] = [];
    const e = await createEmissor(perfil([], log), m.opcoes);
    expect(await e.retomar('nada')).toBeUndefined();
    expect(log).toEqual([]);
    expect(await m.store.travar('nfe', 'nada', 1000)).toBeDefined();
  });

  test('outro processo com a trava: TransmissaoEmAndamentoError sem montar nem enviar', async () => {
    const m = montar();
    const log: string[] = [];
    const e = await createEmissor(perfil([autorizado()], log), m.opcoes);
    await m.store.travar('nfe', 'r', 60_000);
    const erro = await e.emitir('r', { n: 1 }).catch((x: unknown) => x);
    expect(erro).toBeInstanceOf(TransmissaoEmAndamentoError);
    expect((erro as TransmissaoEmAndamentoError).code).toBe('transmissao_em_andamento');
    expect(log).toEqual([]);
  });

  test('trava perdida antes de guardar: não chama o aoDecidir e os bytes ficam para quem assumiu', async () => {
    const clock = relogioManual(EMISSAO);
    const banco = createBancoMemoria();
    const store = createMemoriaStore({ clock, banco });
    const outro = createMemoriaStore({ clock, banco });
    const m = montar({ clock, store, trava: { prazoMs: 1000, renovarACadaMs: 0 } });
    const lento = perfil([autorizado()]);
    const e = await createEmissor(
      {
        ...lento,
        async enviar(c, xml, modo) {
          // A SEFAZ demorou mais que o prazo e outro processo assumiu.
          clock.avancar(1500);
          expect(await outro.travar('nfe', 'r', 60_000)).toBeDefined();
          return lento.enviar(c, xml, modo);
        },
      },
      m.opcoes,
    );
    await expect(e.emitir('r', { n: 1 })).rejects.toMatchObject({ code: 'trava_perdida' });
    expect(m.decididos).toHaveLength(0);
    expect((await outro.ler('nfe', 'r'))?.xml).toBe('<doc n="1" a="1"/>');
  });

  test('trava perdida com desfecho que mantém os bytes: lança, e quem assumiu responde pela transmissão', async () => {
    const clock = relogioManual(EMISSAO);
    const banco = createBancoMemoria();
    const store = createMemoriaStore({ clock, banco });
    const outro = createMemoriaStore({ clock, banco });
    const m = montar({ clock, store, trava: { prazoMs: 1000, renovarACadaMs: 0 } });
    const lento = perfil([pendente]);
    const e = await createEmissor(
      {
        ...lento,
        async enviar(c, xml, modo) {
          clock.avancar(1500);
          expect(await outro.travar('nfe', 'r', 60_000)).toBeDefined();
          return lento.enviar(c, xml, modo);
        },
      },
      m.opcoes,
    );
    await expect(e.emitir('r', { n: 1 })).rejects.toMatchObject({
      code: 'trava_perdida',
      details: { desfecho: 'pendente' },
    });
    expect((await outro.ler('nfe', 'r'))?.xml).toBe('<doc n="1" a="1"/>');
  });

  test('retomar com a gravação esperada: outra gravação não é enviada', async () => {
    const m = montar();
    const e = await createEmissor(perfil([pendente, pendente]), m.opcoes);
    expect((await e.emitir('r', { n: 1 })).tipo).toBe('pendente');
    const gravada = await m.store.ler('nfe', 'r');
    if (gravada === undefined) throw new Error('sem bytes');
    expect(await e.retomar('r', { gravacao: 'outra' })).toBeUndefined();
    expect((await e.retomar('r', { gravacao: gravada.gravacao }))?.tipo).toBe('pendente');
  });

  test('aoDecidir que falha: os bytes ficam e a retomada decide de novo', async () => {
    let falhar = true;
    const m = montar({
      aoDecidir: () => {
        if (falhar) throw new Error('banco fora do ar');
      },
    });
    const e = await createEmissor(perfil([autorizado(), autorizado()]), m.opcoes);
    await expect(e.emitir('r', { n: 1 })).rejects.toThrow('banco fora do ar');
    expect(await m.store.ler('nfe', 'r')).toBeDefined();
    falhar = false;
    expect((await e.retomar('r'))?.tipo).toBe('autorizado');
    expect(await m.store.ler('nfe', 'r')).toBeUndefined();
  });

  test('entrada inválida lança antes de gravar e solta a trava', async () => {
    const m = montar();
    const e = await createEmissor(perfil([]), m.opcoes);
    await expect(e.emitir('r', { n: 1, invalida: true })).rejects.toBeInstanceOf(ErroDeValidacao);
    expect(await m.store.ler('nfe', 'r')).toBeUndefined();
    expect(await m.store.travar('nfe', 'r', 1000)).toBeDefined();
  });

  test('a trava é renovada enquanto a SEFAZ demora', async () => {
    const banco = createBancoMemoria();
    const store = createMemoriaStore({ banco });
    const outro = createMemoriaStore({ banco });
    const m = montar({ store, trava: { prazoMs: 120, renovarACadaMs: 30 } });
    const base = perfil([autorizado()]);
    let assumiu: unknown;
    const e = await createEmissor(
      {
        ...base,
        async enviar(c, xml, modo) {
          await Bun.sleep(300);
          assumiu = await outro.travar('nfe', 'r', 60_000);
          return base.enviar(c, xml, modo);
        },
      },
      m.opcoes,
    );
    expect((await e.emitir('r', { n: 1 })).tipo).toBe('autorizado');
    expect(assumiu).toBeUndefined();
  });

  test('soltar que falha não esconde o desfecho; a renovação que falha vai ao log', async () => {
    const logger = loggerEmMemoria();
    const clock = relogioManual(EMISSAO);
    const real = createMemoriaStore({ clock });
    const store: TransmissaoStore = {
      ...real,
      soltar: async () => {
        throw new Error('conexão caiu');
      },
      renovar: async (t, p) => {
        if (p < 0) return real.renovar(t, p);
        throw new Error('renovação falhou');
      },
    };
    const m = montar({ clock, store, logger, trava: { prazoMs: 60_000, renovarACadaMs: 10 } });
    const base = perfil([pendente]);
    const e = await createEmissor(
      {
        ...base,
        async enviar(c, xml, modo) {
          await Bun.sleep(40);
          return base.enviar(c, xml, modo);
        },
      },
      m.opcoes,
    );
    expect((await e.emitir('r', { n: 1 })).tipo).toBe('pendente');
    const msgs = logger.entradas.map((x) => x.mensagem);
    expect(msgs).toContain('emissor: soltar a trava falhou');
    expect(msgs).toContain('emissor: renovação da trava falhou');
  });

  test('recusa repetida: o conteúdo conta, o campo que muda sozinho não; a recusa por esse campo compara os bytes', async () => {
    // O atributo `a` muda a cada montagem, como a hora de emissão: fora da comparação, menos quando a recusa é por ele.
    const volatil = (respostas: Desfecho[]): PerfilDocumento<Entrada, { readonly c: 1 }> => ({
      ...perfil(respostas),
      conteudoParaRecusa: (xml) => xml.replace(/ a="\d+"/, ''),
      recusaPorCampoVolatil: (cStat) => cStat === '228',
    });
    const m = montar();
    // Limite 1: a segunda tentativa igual já é barrada (o padrão, 3, está nos testes da NF-e).
    const e = await createEmissor(volatil([recusado('225'), recusado('228'), autorizado('chave-2')]), {
      ...m.opcoes,
      recusaRepetida: { limite: 1 },
    });
    expect((await e.emitir('r1', { n: 1 })).tipo).toBe('recusado');
    // Remontada com outro `a` e o mesmo conteúdo: barrada.
    await expect(e.emitir('r1', { n: 1 })).rejects.toBeInstanceOf(RecusaRepetidaError);
    // 228 (data de emissão atrasada) se corrige só na data: outra montagem vai à SEFAZ.
    expect((await e.emitir('r2', { n: 2 })).tipo).toBe('recusado');
    expect((await e.emitir('r2', { n: 2 })).tipo).toBe('autorizado');
  });

  test('assinar não grava nem usa rede; cliente e fechar', async () => {
    const m = montar();
    const log: string[] = [];
    const e = await createEmissor(perfil([], log), m.opcoes);
    expect(await e.assinar({ n: 5 })).toEqual({ id: 'chave-5', xml: '<doc n="5" a="1"/>' });
    expect(await m.store.ler('nfe', 'x')).toBeUndefined();
    expect(e.cliente).toEqual({ c: 1 });
    expect(e.cliente).toBe(e.cliente);
    await e.fechar();
    expect(e.titular.cnpj).toBe('11222333000181');
  });

  test('store obrigatório; aoDecidir no emissor ou na chamada; prazo, renovação e certificado conferidos', async () => {
    const m = montar();
    const sem = (o: object): Promise<unknown> =>
      createEmissor(perfil([]), { ...m.opcoes, ...o } as unknown as OpcoesEmissor);
    await expect(sem({ store: undefined })).rejects.toThrow('store é obrigatório');
    const { aoDecidir: _sem, ...semAoDecidir } = m.opcoes;
    const semGuarda = await createEmissor(perfil([autorizado()]), semAoDecidir);
    await expect(semGuarda.emitir('r', { n: 1 })).rejects.toThrow('aoDecidir é obrigatório');
    // Recusado antes de travar: nada foi gravado.
    expect(await m.store.ler('nfe', 'r')).toBeUndefined();
    await expect(sem({ pfx: undefined, senha: undefined })).rejects.toThrow('um dos dois');
    await expect(sem({ senha: undefined })).rejects.toThrow('o pfx vai com a senha');
    const aberto = await abrirCertificado({ pfx, senha: SENHA }, { clock: relogioManual(EMISSAO) });
    await expect(sem({ certificado: aberto })).rejects.toThrow('um dos dois');
    await expect(sem({ trava: { prazoMs: 0 } })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(sem({ trava: { prazoMs: 1000, renovarACadaMs: 1000 } })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(sem({ senha: 'errada' })).rejects.toMatchObject({ code: 'pfx_senha_incorreta' });
  });
});

describe('createEmissor: guarda por chamada, preparação, já guardado, situação posterior e certificado aberto', () => {
  test('aoDecidir da chamada vale sobre o do emissor; duas transmissões do processo ao mesmo tempo, cada uma com o seu', async () => {
    const m = montar();
    const e = await createEmissor(perfil([autorizado('chave-1'), autorizado('chave-2')]), m.opcoes);
    const guardados: string[] = [];
    const [a, b] = await Promise.all([
      e.emitir('a', { n: 1 }, { aoDecidir: (r) => void guardados.push(`a ${r.ref}`) }),
      e.emitir('b', { n: 2 }, { aoDecidir: (r) => void guardados.push(`b ${r.ref}`) }),
    ]);
    expect([a.tipo, b.tipo]).toEqual(['autorizado', 'autorizado']);
    expect(guardados.sort()).toEqual(['a a', 'b b']);
    // O do emissor não rodou.
    expect(m.decididos).toHaveLength(0);
  });

  test('preparar só roda sem bytes gravados, com a trava; o meta dele é gravado', async () => {
    const m = montar();
    const log: string[] = [];
    const e = await createEmissor(perfil([pendente, autorizado()], log), m.opcoes);
    let preparos = 0;
    const preparar = async (): Promise<{ entrada: Entrada; meta: Record<string, unknown> }> => {
      preparos++;
      // A trava já é desta transmissão: outro processo não trava.
      expect(await m.store.travar('nfe', 'r', 1000)).toBeUndefined();
      return { entrada: { n: 3 }, meta: { numero: 3 } };
    };
    expect((await e.emitir('r', preparar, { meta: { ignorado: true } })).tipo).toBe('pendente');
    expect((await m.store.ler('nfe', 'r'))?.meta).toEqual({ numero: 3 });
    // Com bytes gravados, a retomada não prepara nada.
    expect((await e.emitir('r', preparar)).tipo).toBe('autorizado');
    expect(preparos).toBe(1);
    expect(log.filter((l) => l.startsWith('assinar'))).toEqual(['assinar 3']);
  });

  test('preparar que recusa não grava nada e solta a trava', async () => {
    const m = montar();
    const e = await createEmissor(perfil([]), m.opcoes);
    await expect(
      e.emitir('r', async () => {
        throw new Error('não é mais rascunho');
      }),
    ).rejects.toThrow('não é mais rascunho');
    expect(await m.store.ler('nfe', 'r')).toBeUndefined();
    expect(await m.store.travar('nfe', 'r', 1000)).toBeDefined();
  });

  test('jaGuardado com bytes gravados: conclui sem ir à SEFAZ e sem aoDecidir', async () => {
    const m = montar();
    const log: string[] = [];
    const e = await createEmissor(perfil([pendente], log), m.opcoes);
    await e.emitir('r', { n: 1 });
    const perguntas: string[] = [];
    const d = await e.retomar('r', {
      jaGuardado: (r) => {
        perguntas.push(r.id);
        return true;
      },
    });
    expect(d).toEqual({ documento: 'nfe', tipo: 'ja-guardado', id: 'chave-1' });
    expect(perguntas).toEqual(['chave-1']);
    expect(log.filter((l) => l.startsWith('enviar'))).toHaveLength(1);
    expect(m.decididos).toHaveLength(0);
    expect(await m.store.ler('nfe', 'r')).toBeUndefined();
    expect(destinoDosBytes(d as Desfecho, () => false)).toBe('concluir');
  });

  test('jaGuardado que diz não, ou sem bytes gravados: segue o ciclo', async () => {
    const m = montar();
    const e = await createEmissor(perfil([pendente, autorizado()]), m.opcoes);
    const jaGuardado = (): boolean => {
      throw new Error('sem bytes gravados, não pergunta');
    };
    expect((await e.emitir('r', { n: 1 }, { jaGuardado })).tipo).toBe('pendente');
    expect((await e.retomar('r', { jaGuardado: () => false }))?.tipo).toBe('autorizado');
    expect(m.decididos).toHaveLength(1);
  });

  test("situacaoPosterior 'divergente': o autorizado já cancelado fora do fluxo mantém os bytes", async () => {
    const m = montar({ situacaoPosterior: 'divergente' });
    const cancelado: Desfecho = { ...(autorizado() as Desfecho & { tipo: 'autorizado' }), situacaoAtual: 'cancelado' };
    const e = await createEmissor(perfil([cancelado, autorizado()]), m.opcoes);
    const d = await e.emitir('r', { n: 1 });
    expect(d).toMatchObject({ tipo: 'divergente', situacaoAtual: 'cancelado', proc: '<proc/>' });
    expect(m.decididos).toHaveLength(0);
    expect(await m.store.ler('nfe', 'r')).toBeDefined();
    // O autorizado comum segue guardado.
    expect((await e.retomar('r'))?.tipo).toBe('autorizado');
  });

  test('certificado aberto no lugar do PFX', async () => {
    const m = montar();
    const certificado = await abrirCertificado({ pfx, senha: SENHA }, { clock: relogioManual(EMISSAO) });
    const { pfx: _p, senha: _s, ...resto } = m.opcoes;
    const e = await createEmissor(perfil([autorizado()]), { ...resto, certificado });
    expect(e.titular.cnpj).toBe('11222333000181');
    expect((await e.emitir('r', { n: 1 })).tipo).toBe('autorizado');
    expect(certificado.identidade.kind).toBe('pem');
    // Com a cadeia completada (a AC sintética é raiz, e a raiz não vai no mTLS), o titular continua lá.
    const completo = await abrirCertificado(
      { pfx, senha: SENHA },
      { clock: relogioManual(EMISSAO), completarCadeia: true },
    );
    const pem = completo.identidade.kind === 'pem' ? completo.identidade.certChain : '';
    expect(pem.match(/BEGIN CERTIFICATE/g)?.length).toBeGreaterThanOrEqual(1);
    expect(completo.titular.cnpj).toBe('11222333000181');
  });
});

describe('política dos bytes e erros sem resposta', () => {
  test('destinoDosBytes', () => {
    const indefinido = (c: string): boolean => c === '539';
    expect(destinoDosBytes(autorizado(), indefinido)).toBe('concluir');
    expect(destinoDosBytes({ ...autorizado(), tipo: 'denegado' } as Desfecho, indefinido)).toBe('concluir');
    expect(destinoDosBytes(pendente, indefinido)).toBe('manter');
    expect(destinoDosBytes({ documento: 'nfe', tipo: 'divergente', id: 'x', xMotivo: 'x' }, indefinido)).toBe('manter');
    expect(destinoDosBytes(recusado('539'), indefinido)).toBe('manter');
    expect(destinoDosBytes(recusado('225'), indefinido)).toBe('descartar');
  });

  test('semResposta', () => {
    expect(semResposta(new ErroDeTempoEsgotado('t', 1))).toBe(true);
    expect(semResposta(new ErroDeConfiguracao('c'))).toBe(false);
    expect(semResposta(new Error('x'))).toBe(false);
  });
});
