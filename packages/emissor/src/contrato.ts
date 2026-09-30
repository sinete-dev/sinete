/**
 * `@sinete/emissor/contrato`: suíte de contrato do `TransmissaoStore`, para quem implementa o adaptador sobre o próprio
 * banco. Um adaptador errado produz nota duplicada (duas travas ao mesmo tempo, bytes que somem num reinício, o dono
 * antigo gravando por cima de quem assumiu); a suíte confere cada um desses casos.
 *
 * Não depende de runner de teste: devolve casos com `nome` e `rodar`, que lançam `ErroContratoViolado` quando o
 * adaptador falha. No Bun, no Vitest ou no `node:test`:
 *
 * ```ts
 * for (const caso of casosDoContrato({ criar: async () => ({ a: meuStore(db), b: meuStore(db) }) })) {
 *   test(caso.nome, caso.rodar, 30_000);
 * }
 * ```
 *
 * `criar` é chamado uma vez por caso e precisa devolver dois stores sobre o mesmo banco **vazio** (dois processos). Os
 * casos que esperam uma trava vencer usam o relógio de verdade (`esperar`); com o banco medindo o prazo pelo próprio
 * relógio, como deve ser, não há como adiantá-lo. `prazoCurtoMs` é o prazo dessas travas: o padrão (1 s) serve ao
 * MySQL e ao Postgres com `NOW(6)`/`now()`; a suíte inteira leva uns 20 prazos curtos.
 */

import { ErroSinete, ehErroSinete } from '@sinete/core';
import type { RegistroTransmissao, TransmissaoStore, Trava } from './store.ts';

type StoreComRecusas = TransmissaoStore & Required<Pick<TransmissaoStore, 'registrarRecusa' | 'recusaRecente'>>;
type StoreComContingencia = TransmissaoStore &
  Required<
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

/** O adaptador não cumpriu um item do contrato. `detalhes.caso` diz qual. */
export class ErroContratoViolado extends ErroSinete<'contrato_violado'> {
  constructor(caso: string, message: string) {
    super('contrato_violado', `${caso}: ${message}`, { detalhes: { caso } });
    this.name = 'ErroContratoViolado';
  }
}

/** Dois processos sobre o mesmo banco, vazio. */
export interface AmbienteContrato {
  readonly a: TransmissaoStore;
  readonly b: TransmissaoStore;
  /** Roda no fim do caso, passe ou não (fechar conexões, apagar o esquema). */
  readonly fechar?: () => Promise<void>;
}

export interface ContratoOpcoes {
  readonly criar: () => AmbienteContrato | Promise<AmbienteContrato>;
  /** Prazo das travas que os casos esperam vencer. Padrão: 1000 ms. */
  readonly prazoCurtoMs?: number;
  /** Espera de verdade. Padrão: `setTimeout`. Só o adaptador em memória com relógio manual troca por um avanço. */
  readonly esperar?: (ms: number) => Promise<void>;
  /**
   * Inclui os casos da lembrança de recusas (`registrarRecusa` e `recusaRecente`, opcionais no store). Padrão: `true`;
   * `false` só para o adaptador que não os implementa, e aí o emissor fica sem a barreira da recusa repetida.
   */
  readonly recusas?: boolean;
  /**
   * Inclui os casos da contingência automática (`registrarFalhaDoAutorizador`, `contingenciaAtiva`,
   * `entrarEmContingencia`, `sairDaContingencia`, `reservarSonda` e `marcarFimDaSvc`, opcionais no store; ADR 0013).
   * Padrão: `true`;
   * `false` só para o adaptador que não os implementa, e aí o emissor guarda a contingência na memória do processo.
   */
  readonly contingencia?: boolean;
}

export interface CasoContrato {
  readonly nome: string;
  rodar(): Promise<void>;
}

const XML = '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe1">çãõ &amp; ü 😀</infNFe></NFe>';
const ID = '35260911222333000181550010000000421000000421';
const META = { itens: ['a', 'b'], numero: 42, aninhado: { ok: true } };
const LONGO = 3_600_000;
const TUDO = { idadeMaximaMs: LONGO, paradaHaMs: 0, intervaloDepoisDoAlertaMs: LONGO, limite: 100 } as const;

/** Casos do contrato, na ordem do mais básico ao mais sutil. */
export function casosDoContrato(opcoes: ContratoOpcoes): readonly CasoContrato[] {
  const P = opcoes.prazoCurtoMs ?? 1000;
  const esperar =
    opcoes.esperar ??
    ((ms: number): Promise<void> =>
      new Promise((r) => {
        setTimeout(r, ms);
      }));

  type Falha = (m: string) => never;
  const caso = (nome: string, corpo: (ctx: AmbienteContrato, falha: Falha) => Promise<void>): CasoContrato => ({
    nome,
    async rodar(): Promise<void> {
      const amb = await opcoes.criar();
      const falha = (m: string): never => {
        throw new ErroContratoViolado(nome, m);
      };
      try {
        await corpo(amb, falha);
      } finally {
        await amb.fechar?.();
      }
    },
  });

  const travar = async (s: TransmissaoStore, ref: string, prazo: number, falha: Falha): Promise<Trava> =>
    (await s.travar('nfe', ref, prazo)) ?? falha(`travar ${ref} devolveu undefined sem outra trava em vigor`);

  const recusa = async (p: Promise<unknown>, code: string, oque: string, falha: Falha): Promise<void> => {
    try {
      await p;
    } catch (e) {
      if (ehErroSinete(e, code)) return;
      falha(`${oque}: esperava o erro ${code}, veio ${String(e)}`);
    }
    falha(`${oque}: esperava o erro ${code}, não lançou`);
  };

  const refs = (l: readonly RegistroTransmissao[]): string => l.map((r) => r.ref).join(',');

  const comRecusas = (s: TransmissaoStore, falha: Falha): StoreComRecusas => {
    if (typeof s.registrarRecusa !== 'function' || typeof s.recusaRecente !== 'function') {
      falha('o store não implementa registrarRecusa e recusaRecente (passe recusas: false para pular estes casos)');
    }
    return s as StoreComRecusas;
  };
  const DIGEST = 'a'.repeat(64);

  const comContingencia = (s: TransmissaoStore, falha: Falha): StoreComContingencia => {
    const metodos = [
      'registrarFalhaDoAutorizador',
      'contingenciaAtiva',
      'entrarEmContingencia',
      'sairDaContingencia',
      'reservarSonda',
      'marcarFimDaSvc',
    ] as const;
    for (const m of metodos) {
      if (typeof s[m] !== 'function') {
        falha(`o store não implementa ${m} (passe contingencia: false para pular estes casos)`);
      }
    }
    return s as StoreComContingencia;
  };
  const ESCOPO = 'homologacao:nfe:55:SP';

  const casosDeContingencia: readonly CasoContrato[] = [
    caso(
      'falhas do autorizador somam entre processos, recomeçam depois da janela e são por escopo',
      async ({ a, b }, falha) => {
        const [ca, cb] = [comContingencia(a, falha), comContingencia(b, falha)];
        if ((await ca.registrarFalhaDoAutorizador(ESCOPO, LONGO)) !== 1) falha('a primeira falha não contou 1');
        if ((await cb.registrarFalhaDoAutorizador(ESCOPO, LONGO)) !== 2) falha('a falha do outro processo não somou');
        const juntas = await Promise.all([
          ca.registrarFalhaDoAutorizador(ESCOPO, LONGO),
          cb.registrarFalhaDoAutorizador(ESCOPO, LONGO),
        ]);
        if (Math.max(...juntas) !== 4) falha(`falhas simultâneas se perderam na conta: ${juntas.join(',')}`);
        if ((await ca.registrarFalhaDoAutorizador('homologacao:nfe:65:SP', LONGO)) !== 1) {
          falha('a falha de outro escopo somou na conta deste');
        }
        await esperar(P * 1.5);
        if ((await cb.registrarFalhaDoAutorizador(ESCOPO, P)) !== 1)
          falha('a sequência não recomeçou depois da janela');
      },
    ),

    caso('só um processo entra em contingência, e o outro vê o mesmo estado', async ({ a, b }, falha) => {
      const [ca, cb] = [comContingencia(a, falha), comContingencia(b, falha)];
      if ((await cb.contingenciaAtiva(ESCOPO)) !== undefined) falha('contingência ativa antes de entrar');
      const [ra, rb] = await Promise.all([
        ca.entrarEmContingencia(ESCOPO, 'motivo a'),
        cb.entrarEmContingencia(ESCOPO, 'motivo b'),
      ]);
      if (Number(ra.entrou) + Number(rb.entrou) !== 1) falha('os dois processos (ou nenhum) entraram em contingência');
      const quem = ra.entrou ? ra : rb;
      const visto = (await cb.contingenciaAtiva(ESCOPO)) ?? falha('o outro processo não viu a contingência');
      if (visto.motivo !== quem.estado.motivo) falha('o motivo gravado não é o de quem entrou');
      if (visto.desde.getTime() !== quem.estado.desde.getTime()) falha('o desde mudou entre processos');
      if (Number.isNaN(visto.desde.getTime())) falha('instante inválido');
      if ((await ca.contingenciaAtiva('homologacao:nfe:65:SP')) !== undefined) falha('a contingência vazou de escopo');
      const [sa, sb] = await Promise.all([ca.sairDaContingencia(ESCOPO), cb.sairDaContingencia(ESCOPO)]);
      if (Number(sa) + Number(sb) !== 1) falha('os dois processos (ou nenhum) saíram da contingência');
      if ((await ca.contingenciaAtiva(ESCOPO)) !== undefined) falha('a contingência continuou depois de sair');
    }),

    caso('sair da contingência zera a conta de falhas', async ({ a, b }, falha) => {
      const [ca, cb] = [comContingencia(a, falha), comContingencia(b, falha)];
      await ca.registrarFalhaDoAutorizador(ESCOPO, LONGO);
      await ca.registrarFalhaDoAutorizador(ESCOPO, LONGO);
      await cb.entrarEmContingencia(ESCOPO, 'x');
      await cb.sairDaContingencia(ESCOPO);
      if ((await ca.registrarFalhaDoAutorizador(ESCOPO, LONGO)) !== 1) falha('a conta de falhas sobreviveu à saída');
    }),

    caso('a sonda é de um processo por intervalo, em contingência ou fora dela', async ({ a, b }, falha) => {
      const [ca, cb] = [comContingencia(a, falha), comContingencia(b, falha)];
      // Fora da contingência (a consulta à SVC que a achou sem ativação): um processo por intervalo.
      const [fa, fb] = await Promise.all([ca.reservarSonda(ESCOPO, P), cb.reservarSonda(ESCOPO, P)]);
      if (Number(fa) + Number(fb) !== 1)
        falha('fora da contingência, os dois processos (ou nenhum) reservaram a sonda');
      if (await ca.reservarSonda(ESCOPO, P)) falha('fora da contingência, reservou de novo antes do intervalo');
      if (!(await cb.reservarSonda('homologacao:nfe:65:SP', P))) falha('a sonda de um escopo barrou a de outro');
      await ca.entrarEmContingencia(ESCOPO, 'x');
      if (await cb.reservarSonda(ESCOPO, P)) falha('reservou a sonda antes do intervalo desde a entrada');
      await esperar(P * 1.5);
      const [ra, rb] = await Promise.all([ca.reservarSonda(ESCOPO, P), cb.reservarSonda(ESCOPO, P)]);
      if (Number(ra) + Number(rb) !== 1) falha('os dois processos (ou nenhum) reservaram a mesma sonda');
      if (await ca.reservarSonda(ESCOPO, P)) falha('reservou de novo antes do intervalo');
      const e = (await cb.contingenciaAtiva(ESCOPO)) ?? falha('a contingência sumiu');
      if (e.sondadaEm === undefined || e.sondadaEm.getTime() <= e.desde.getTime()) falha('a sonda não ficou gravada');
      await cb.sairDaContingencia(ESCOPO);
      if (!(await ca.reservarSonda(ESCOPO, P))) falha('a sonda de antes da saída barrou a primeira depois dela');
    }),

    caso('o fim da SVC fica no escopo em contingência e sai com ele', async ({ a, b }, falha) => {
      const [ca, cb] = [comContingencia(a, falha), comContingencia(b, falha)];
      const fim = (await ca.entrarEmContingencia('homologacao:nfe:65:SP', 'y')).estado.desde;
      await ca.sairDaContingencia('homologacao:nfe:65:SP');
      if (await ca.marcarFimDaSvc(ESCOPO, fim)) falha('marcou o fim da SVC fora da contingência');
      await ca.entrarEmContingencia(ESCOPO, 'x');
      if ((await cb.contingenciaAtiva(ESCOPO))?.fimDaSvc !== undefined) falha('fim da SVC antes de marcar');
      if (!(await cb.marcarFimDaSvc(ESCOPO, fim))) falha('não marcou o fim da SVC em contingência');
      const e = (await ca.contingenciaAtiva(ESCOPO)) ?? falha('a contingência sumiu');
      if (e.fimDaSvc?.getTime() !== fim.getTime()) falha('o outro processo não viu o fim da SVC marcado');
      await cb.marcarFimDaSvc(ESCOPO, undefined);
      if ((await ca.contingenciaAtiva(ESCOPO))?.fimDaSvc !== undefined) falha('o fim da SVC não saiu com undefined');
      await ca.marcarFimDaSvc(ESCOPO, fim);
      await ca.sairDaContingencia(ESCOPO);
      await cb.entrarEmContingencia(ESCOPO, 'z');
      if ((await ca.contingenciaAtiva(ESCOPO))?.fimDaSvc !== undefined) falha('o fim da SVC sobreviveu à saída');
    }),
  ];

  const casosDeRecusa: readonly CasoContrato[] = [
    caso('recusa lembrada vale para outro processo dentro da janela e some depois', async ({ a, b }, falha) => {
      const [ra, rb] = [comRecusas(a, falha), comRecusas(b, falha)];
      if ((await rb.recusaRecente('nfe', 'doc', LONGO)) !== undefined) falha('recusa lembrada antes de registrar');
      await ra.registrarRecusa(
        'nfe',
        'doc',
        { digest: DIGEST, cStat: '232', xMotivo: 'IE do destinatário não informada' },
        LONGO,
      );
      const r = (await rb.recusaRecente('nfe', 'doc', LONGO)) ?? falha('outro processo não achou a recusa registrada');
      if (r.digest !== DIGEST || r.cStat !== '232' || r.xMotivo !== 'IE do destinatário não informada') {
        falha('a recusa voltou diferente em outro processo');
      }
      if (r.vezes !== 1) falha(`a primeira recusa voltou com vezes ${r.vezes}`);
      if (Number.isNaN(r.recusadaEm.getTime()) || Number.isNaN(r.primeiraEm.getTime())) falha('instante inválido');
      await esperar(P * 1.5);
      if ((await rb.recusaRecente('nfe', 'doc', P)) !== undefined) falha('a recusa continuou depois da janela');
      if ((await rb.recusaRecente('nfe', 'doc', LONGO)) === undefined) falha('a recusa sumiu dentro da janela maior');
    }),

    caso('a mesma recusa dentro da janela conta, de dois processos', async ({ a, b }, falha) => {
      const [ra, rb] = [comRecusas(a, falha), comRecusas(b, falha)];
      const igual = { digest: DIGEST, cStat: '203', xMotivo: 'emissor não habilitado' };
      await ra.registrarRecusa('nfe', 'doc', igual, LONGO);
      const primeira = (await ra.recusaRecente('nfe', 'doc', LONGO)) ?? falha('a primeira recusa sumiu');
      await rb.registrarRecusa('nfe', 'doc', igual, LONGO);
      await ra.registrarRecusa('nfe', 'doc', igual, LONGO);
      const r = (await rb.recusaRecente('nfe', 'doc', LONGO)) ?? falha('a sequência sumiu');
      if (r.vezes !== 3) falha(`três recusas iguais contaram ${r.vezes}`);
      if (r.primeiraEm.getTime() !== primeira.primeiraEm.getTime()) falha('a sequência mudou a primeira recusa');
      if (r.recusadaEm.getTime() < primeira.recusadaEm.getTime()) falha('recusadaEm não é a da última recusa');
      // Três ao mesmo tempo, de dois processos: nenhuma se perde.
      await Promise.all([
        ra.registrarRecusa('nfe', 'doc', igual, LONGO),
        rb.registrarRecusa('nfe', 'doc', igual, LONGO),
        ra.registrarRecusa('nfe', 'doc', igual, LONGO),
      ]);
      if ((await ra.recusaRecente('nfe', 'doc', LONGO))?.vezes !== 6) falha('recusas simultâneas se perderam na conta');
    }),

    caso('outro conteúdo, outro cStat ou a janela vencida recomeçam a conta', async ({ a, b }, falha) => {
      const [ra, rb] = [comRecusas(a, falha), comRecusas(b, falha)];
      const igual = { digest: DIGEST, cStat: '203', xMotivo: 'emissor não habilitado' };
      await ra.registrarRecusa('nfe', 'doc', igual, LONGO);
      await ra.registrarRecusa('nfe', 'doc', igual, LONGO);
      await rb.registrarRecusa('nfe', 'doc', { ...igual, digest: 'b'.repeat(64) }, LONGO);
      let r = await ra.recusaRecente('nfe', 'doc', LONGO);
      if (r?.digest !== 'b'.repeat(64) || r.vezes !== 1) falha('outro conteúdo não recomeçou a conta');
      await rb.registrarRecusa('nfe', 'doc', { ...igual, digest: 'b'.repeat(64), cStat: '232' }, LONGO);
      r = await ra.recusaRecente('nfe', 'doc', LONGO);
      if (r?.cStat !== '232' || r.vezes !== 1) falha('outro cStat não recomeçou a conta');
      await esperar(P * 1.5);
      await ra.registrarRecusa('nfe', 'doc', { ...igual, digest: 'b'.repeat(64), cStat: '232' }, P);
      r = await ra.recusaRecente('nfe', 'doc', LONGO);
      if (r?.vezes !== 1) falha(`a janela vencida não recomeçou a conta (vezes ${r?.vezes})`);
      if ((await ra.recusaRecente('mdfe', 'doc', LONGO)) !== undefined) falha('a recusa da NF-e apareceu no MDF-e');
      if ((await ra.recusaRecente('nfe', 'outro', LONGO)) !== undefined) falha('a recusa apareceu em outro ref');
    }),

    caso('a recusa sobrevive a travar, gravar, descartar e soltar o documento', async ({ a, b }, falha) => {
      const ra = comRecusas(a, falha);
      const t = await travar(a, 'doc', LONGO, falha);
      await a.gravar(t, { xml: XML, id: ID, meta: {} });
      await a.descartar(t);
      await ra.registrarRecusa('nfe', 'doc', { digest: DIGEST, cStat: '232', xMotivo: 'x' }, LONGO);
      await a.soltar(t);
      if ((await comRecusas(b, falha).recusaRecente('nfe', 'doc', LONGO))?.digest !== DIGEST) {
        falha('soltar a trava sem bytes apagou a recusa lembrada');
      }
      const t2 = await travar(b, 'doc', LONGO, falha);
      await b.gravar(t2, { xml: XML, id: ID, meta: {} });
      await b.concluir(t2);
      await b.soltar(t2);
      if ((await ra.recusaRecente('nfe', 'doc', LONGO))?.digest !== DIGEST) falha('concluir apagou a recusa lembrada');
    }),
  ];

  return [
    caso('dez travas ao mesmo tempo, de dois processos: uma vence', async ({ a, b }, falha) => {
      const r = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? a : b).travar('nfe', 'doc', LONGO)));
      const vencedoras = r.filter((t): t is Trava => t !== undefined);
      if (vencedoras.length !== 1) falha(`${vencedoras.length} travas em vigor ao mesmo tempo`);
      await a.soltar(vencedoras[0] as Trava);
      const depois = await b.travar('nfe', 'doc', LONGO);
      if (depois === undefined) falha('solta a trava, a próxima não conseguiu travar');
    }),

    caso('NF-e e MDF-e com o mesmo ref têm travas separadas', async ({ a, b }, falha) => {
      await travar(a, 'doc', LONGO, falha);
      if ((await b.travar('mdfe', 'doc', LONGO)) === undefined) falha('a trava da NF-e bloqueou o MDF-e do mesmo ref');
      if ((await b.travar('nfe', 'doc', LONGO)) !== undefined) falha('duas travas da mesma NF-e');
    }),

    caso('bytes, id e meta gravados sobrevivem ao processo e a outra leitura', async ({ a, b }, falha) => {
      const t = await travar(a, 'doc', LONGO, falha);
      if ((await a.ler('nfe', 'doc')) !== undefined) falha('ler devolveu bytes antes de gravar');
      const g = await a.gravar(t, { xml: XML, id: ID, meta: META });
      if (g.xml !== XML || g.id !== ID || g.tentativas !== 0 || !g.gravacao) falha('gravar devolveu outro registro');
      if (!(g.assinadoEm instanceof Object) || Number.isNaN(g.assinadoEm.getTime())) falha('assinadoEm inválido');
      await a.soltar(t);
      // "Reinício": outro processo, sem nada em memória, acha os mesmos bytes.
      const lido = (await b.ler('nfe', 'doc')) ?? falha('os bytes gravados sumiram para outro processo');
      if (lido.xml !== XML) falha('os bytes gravados não voltaram iguais em outro processo');
      if (lido.id !== ID || lido.gravacao !== g.gravacao) falha('id ou gravação diferentes em outro processo');
      if (JSON.stringify(lido.meta) !== JSON.stringify(META)) falha('meta diferente em outro processo');
      if (lido.tipo !== 'nfe' || lido.ref !== 'doc') falha('tipo ou ref diferentes');
      const t2 = await travar(b, 'doc', LONGO, falha);
      await b.concluir(t2);
      await b.soltar(t2);
      if ((await a.ler('nfe', 'doc')) !== undefined) falha('concluído, os bytes continuam');
    }),

    caso('gravar por cima de bytes gravados é recusado', async ({ a, b }, falha) => {
      const t = await travar(a, 'doc', LONGO, falha);
      await a.gravar(t, { xml: XML, id: ID, meta: {} });
      await a.soltar(t);
      const t2 = await travar(b, 'doc', LONGO, falha);
      await recusa(
        b.gravar(t2, { xml: '<outro/>', id: ID, meta: {} }),
        'transmissao_ja_gravada',
        'gravar de novo',
        falha,
      );
      if ((await b.ler('nfe', 'doc'))?.xml !== XML) falha('a segunda gravação trocou os bytes');
    }),

    caso('trava vencida é assumida, e o dono antigo não grava nem solta a trava nova', async ({ a, b }, falha) => {
      const velha = await travar(a, 'doc', P, falha);
      if ((await b.travar('nfe', 'doc', LONGO)) !== undefined) falha('travou com a trava do outro em vigor');
      await esperar(P * 1.5);
      const nova = await travar(b, 'doc', LONGO, falha);
      if (nova.token === velha.token) falha('a trava assumida tem o mesmo token da vencida');
      await recusa(
        a.gravar(velha, { xml: XML, id: ID, meta: {} }),
        'trava_perdida',
        'gravar com a trava vencida',
        falha,
      );
      if ((await b.ler('nfe', 'doc')) !== undefined) falha('o dono antigo gravou com a trava vencida');
      await a.soltar(velha);
      if ((await a.travar('nfe', 'doc', LONGO)) !== undefined) falha('soltar a trava vencida soltou a de quem assumiu');
      if (await a.renovar(velha, LONGO)) falha('renovar recuperou a trava vencida');
      await b.gravar(nova, { xml: XML, id: ID, meta: {} });
    }),

    caso('renovar estende a trava em vigor', async ({ a, b }, falha) => {
      const t = await travar(a, 'doc', P, falha);
      // Quatro esperas de um terço do prazo passam do prazo original com folga de dois terços entre as renovações: a
      // espera de verdade atrasa (timer, GC, banco lento), e com meio prazo de folga a suíte reprovava adaptador certo.
      for (let i = 0; i < 4; i++) {
        await esperar(P / 3);
        if (!(await a.renovar(t, P))) falha(`a renovação ${i + 1} falhou com a trava em vigor`);
      }
      // Passou do prazo original, mas a trava foi renovada: ninguém assume.
      if ((await b.travar('nfe', 'doc', LONGO)) !== undefined) falha('a trava renovada foi assumida');
      await a.gravar(t, { xml: XML, id: ID, meta: {} });
    }),

    caso(
      'trava perdida: renovar falha, concluir não apaga a gravação nova e descartar é recusado',
      async ({ a, b }, falha) => {
        const velha = await travar(a, 'doc', P, falha);
        await a.gravar(velha, { xml: XML, id: ID, meta: {} });
        await esperar(P * 1.5);
        const nova = await travar(b, 'doc', LONGO, falha);
        if ((await b.ler('nfe', 'doc'))?.xml !== XML) falha('quem assumiu não achou os bytes');
        if (await a.renovar(velha, LONGO)) falha('renovar recuperou a trava perdida');
        await a.concluir(velha);
        if ((await b.ler('nfe', 'doc')) === undefined)
          falha('concluir do dono antigo apagou a gravação de quem assumiu');
        await recusa(a.descartar(velha), 'trava_perdida', 'descartar com a trava perdida', falha);
        if ((await b.ler('nfe', 'doc')) === undefined) falha('descartar do dono antigo apagou a gravação');
        await b.concluir(nova);
        await b.soltar(nova);
        if ((await a.ler('nfe', 'doc')) !== undefined) falha('concluído por quem assumiu, os bytes continuam');
      },
    ),

    caso('concluir é idempotente e não exige a trava em vigor', async ({ a, b }, falha) => {
      const t = await travar(a, 'doc', P, falha);
      await a.gravar(t, { xml: XML, id: ID, meta: {} });
      await esperar(P * 1.5);
      await a.concluir(t);
      await a.concluir(t);
      await a.soltar(t);
      if ((await b.ler('nfe', 'doc')) !== undefined) falha('concluir com a trava vencida (e não assumida) não apagou');
      if ((await b.travar('nfe', 'doc', LONGO)) === undefined) falha('depois de concluir e soltar, não trava');
    }),

    caso('descartar apaga os bytes, e a próxima gravação é outra', async ({ a }, falha) => {
      const t = await travar(a, 'doc', LONGO, falha);
      const g1 = await a.gravar(t, { xml: XML, id: ID, meta: {} });
      await a.descartar(t);
      if ((await a.ler('nfe', 'doc')) !== undefined) falha('descartado, os bytes continuam');
      const g2 = await a.gravar(t, { xml: '<outro/>', id: ID, meta: {} });
      if (g2.gravacao === g1.gravacao) falha('a gravação depois do descarte tem a mesma identidade');
      await a.soltar(t);
    }),

    caso('soltar sem gravar não deixa nada para trás', async ({ a, b }, falha) => {
      const t = await travar(a, 'doc', LONGO, falha);
      await a.soltar(t);
      if ((await b.ler('nfe', 'doc')) !== undefined) falha('soltar sem gravar deixou bytes');
      if ((await b.listarPendentes(TUDO)).length !== 0) falha('soltar sem gravar deixou uma pendente');
      if ((await b.travar('nfe', 'doc', LONGO)) === undefined) falha('solta, a trava continua');
    }),

    caso('listarPendentes: só com bytes, sem trava em vigor, parada e dentro da idade', async ({ a, b }, falha) => {
      const gravar = async (ref: string, soltar = true): Promise<void> => {
        const t = await travar(a, ref, soltar ? LONGO : LONGO * 10, falha);
        await a.gravar(t, { xml: XML, id: ID, meta: {} });
        if (soltar) await a.soltar(t);
      };
      await gravar('velha');
      await esperar(P * 2.5);
      await gravar('boa');
      await gravar('travada', false);
      const sem = await travar(a, 'sem-bytes', LONGO, falha);
      await a.soltar(sem);
      await esperar(P * 1.5);
      await gravar('recente');
      const l = await b.listarPendentes({
        idadeMaximaMs: P * 3,
        paradaHaMs: P,
        intervaloDepoisDoAlertaMs: 0,
        limite: 10,
      });
      if (refs(l) !== 'boa') falha(`esperava [boa], veio [${refs(l)}]`);
      if (l[0]?.xml !== XML) falha('a pendente veio sem os bytes');
    }),

    caso(
      'listarPendentes: nunca tentadas primeiro, depois pela tentativa e pela gravação; respeita o limite',
      async ({ a, b }, falha) => {
        for (const ref of ['x1', 'x2', 'x3']) {
          const t = await travar(a, ref, LONGO, falha);
          await a.gravar(t, { xml: XML, id: ID, meta: {} });
          await a.soltar(t);
          await esperar(P / 10);
        }
        const x1 = (await a.ler('nfe', 'x1')) ?? falha('x1 sumiu');
        await b.registrarTentativa(x1, { alertar: false });
        const l = await b.listarPendentes(TUDO);
        if (refs(l) !== 'x2,x3,x1') falha(`ordem errada: [${refs(l)}]`);
        const limitada = await b.listarPendentes({ ...TUDO, limite: 2 });
        if (refs(limitada) !== 'x2,x3') falha(`limite 2 devolveu [${refs(limitada)}]`);
      },
    ),

    caso('tentativas contam e o alerta sai uma vez; a alertada volta depois do intervalo', async ({ a, b }, falha) => {
      const t = await travar(a, 'doc', LONGO, falha);
      const g = await a.gravar(t, { xml: XML, id: ID, meta: {} });
      await a.soltar(t);
      const r1 = await b.registrarTentativa(g, { alertar: false });
      if (!r1.registrada || r1.alertou) falha('a primeira tentativa sem alerta não foi registrada como tal');
      const r2 = await a.registrarTentativa(g, { alertar: true });
      if (!r2.registrada || !r2.alertou) falha('o primeiro alerta não foi marcado');
      const r3 = await b.registrarTentativa(g, { alertar: true });
      if (!r3.registrada || r3.alertou) falha('o alerta saiu duas vezes para a mesma gravação');
      const lido = (await a.ler('nfe', 'doc')) ?? falha('a gravação sumiu');
      if (lido.tentativas !== 3) falha(`esperava 3 tentativas, veio ${lido.tentativas}`);
      if (lido.alertadoEm === undefined || lido.ultimaTentativaEm === undefined) falha('alerta ou tentativa sem data');
      const filtro = { ...TUDO, intervaloDepoisDoAlertaMs: P };
      if ((await b.listarPendentes(filtro)).length !== 0) falha('a alertada voltou antes do intervalo');
      await esperar(P * 1.5);
      if (refs(await b.listarPendentes(filtro)) !== 'doc') falha('a alertada não voltou depois do intervalo');
    }),

    caso('a tentativa de uma gravação que saiu não conta na seguinte', async ({ a }, falha) => {
      const t = await travar(a, 'doc', LONGO, falha);
      const g1 = await a.gravar(t, { xml: XML, id: ID, meta: {} });
      await a.descartar(t);
      await a.gravar(t, { xml: XML, id: ID, meta: {} });
      const r = await a.registrarTentativa(g1, { alertar: true });
      if (r.registrada || r.alertou) falha('a tentativa da gravação descartada contou na nova');
      if ((await a.ler('nfe', 'doc'))?.tentativas !== 0) falha('a nova gravação ganhou tentativas da anterior');
      await a.concluir(t);
      if ((await a.registrarTentativa(g1, { alertar: false })).registrada) falha('tentativa contou depois de concluir');
    }),
    ...(opcoes.recusas === false ? [] : casosDeRecusa),
    ...(opcoes.contingencia === false ? [] : casosDeContingencia),
  ];
}
