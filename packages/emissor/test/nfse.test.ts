/**
 * `createNfseEmissor` contra a NFS-e simulada do `@sinete/sefaz-sim` em HTTPS com mTLS, com os bytes gravados no
 * adaptador em memória: geração com a DPS gravada, sem resposta (a retomada depois de reiniciar guarda com os mesmos
 * bytes), não chegou, E0014 e divergente, substituição e cancelamento com recuperação pelos eventos da NFS-e.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { ManualClock } from '@sinete/core';
import { manualClock, ValidationError } from '@sinete/core';
import * as danfse from '@sinete/da/nfse';
import type { NfseSim, SimServer } from '@sinete/sefaz-sim';
import { createNfseSim, redirectNfseToSim, startSimServer, syntheticPfx } from '@sinete/sefaz-sim';
import { createTransport, TransportError } from '@sinete/transport';
import type { Desfecho, TransmissaoStore } from '../src/index.ts';
import type { BancoMemoria } from '../src/memoria.ts';
import { createBancoMemoria, createMemoriaStore } from '../src/memoria.ts';
import type { DesfechoNfse, NfseEmissor, NfseEmissorOptions } from '../src/nfse.ts';
import { createNfseEmissor } from '../src/nfse.ts';
import type { Certs } from './helpers/nfse.ts';
import { dps, EMISSAO, gerarCerts, MUNICIPIOS, PRESTADOR } from './helpers/nfse.ts';

const SENHA = 'senha-sintetica';

let c: Certs;
let pfx: Uint8Array;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  c = await gerarCerts();
  pfx = syntheticPfx(c.prestador, SENHA, { chain: [c.ac] });
}, 60_000);

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
});

interface Cenario {
  readonly clock: ManualClock;
  readonly sim: NfseSim;
  readonly server: SimServer;
  readonly banco: BancoMemoria;
  readonly store: TransmissaoStore;
  readonly emissor: NfseEmissor;
  readonly guardados: { readonly ref: string; readonly desfecho: Desfecho }[];
  readonly caminhos: string[];
  novoEmissor(): Promise<NfseEmissor>;
}

/** `depois` roda depois de cada resposta; lançar aqui simula a falha depois do envio. */
async function cenario(extra: Partial<NfseEmissorOptions> = {}, depois?: (caminho: string) => void): Promise<Cenario> {
  const clock = manualClock(EMISSAO);
  const sim = createNfseSim({ clock, signer: c.servidor.signer, municipios: MUNICIPIOS });
  const caminhos: string[] = [];
  const server = await startSimServer(
    {
      handle: (r) => {
        caminhos.push(`${r.method ?? 'GET'} ${r.path}`);
        return sim.handle(r);
      },
    },
    { cert: c.servidor.pem, key: c.servidor.keyPem },
  );
  const banco = createBancoMemoria();
  const guardados: Cenario['guardados'] = [];
  const emissores: NfseEmissor[] = [];
  const novoEmissor = async (): Promise<NfseEmissor> => {
    const e = await createNfseEmissor({
      pfx,
      senha: SENHA,
      ambiente: 'homologacao',
      clock,
      store: createMemoriaStore({ clock, banco }),
      aoDecidir: (r, desfecho) => {
        guardados.push({ ref: r.ref, desfecho });
      },
      transporte: ({ policy: _policy, ...o }) => {
        const real = redirectNfseToSim(createTransport({ ...o, additionalCa: [c.ac.pem] }), server.baseUrl);
        return {
          capabilities: real.capabilities,
          send: async (r) => {
            const resposta = await real.send(r);
            depois?.(`${r.method} ${new URL(r.url).pathname}`);
            return resposta;
          },
          close: () => real.close(),
        };
      },
      ...extra,
    });
    emissores.push(e);
    return e;
  };
  const emissor = await novoEmissor();
  fechar.push(async () => {
    for (const e of emissores) await e.fechar();
    await server.close();
  });
  return {
    clock,
    sim,
    server,
    banco,
    store: createMemoriaStore({ clock, banco }),
    emissor,
    guardados,
    caminhos,
    novoEmissor,
  };
}

const emissoes = (s: Cenario): number => s.caminhos.filter((p) => p === 'POST /sefin/nfse').length;

function gerada(d: Desfecho | undefined): Extract<DesfechoNfse, { tipo: 'autorizado' }> {
  if (d?.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d)}`);
  return d as Extract<DesfechoNfse, { tipo: 'autorizado' }>;
}

describe('createNfseEmissor contra a NFS-e simulada, HTTPS com mTLS', () => {
  test('emitir gera a NFS-e com a DPS gravada; consulta, DANFSe, substituição e cancelamento', async () => {
    // O `@sinete/da/nfse` real, com um espião que guarda o documento e as opções de cada render.
    const renders: { readonly opcoes: Record<string, unknown>; readonly doc: danfse.Doc }[] = [];
    const s = await cenario({
      da: {
        danfse: (xml: string, o?: object): unknown => {
          const doc = danfse.danfse(xml, o);
          renders.push({ opcoes: { ...o }, doc });
          return doc;
        },
        toPdf: danfse.toPdf,
      },
    });
    const marca = (i: number): string | undefined =>
      renders[i]?.doc.pages[0]?.ops.find((op) => op.t === 'text' && op.rot !== undefined && op.rot !== 0)?.[
        's' as never
      ];
    expect(s.emissor.titular.cnpj).toBe(PRESTADOR);
    const d = gerada(await s.emissor.emitir('nfse-1', dps()));
    expect(d.id).toBe(d.protocolo.idDps);
    expect(d.proc).toBe(d.protocolo.xml);
    expect(s.guardados.map((g) => g.ref)).toEqual(['nfse-1']);
    expect(await s.store.ler('nfse', 'nfse-1')).toBeUndefined();
    expect((await s.emissor.consultar(d.protocolo.chaveAcesso))?.chaveAcesso).toBe(d.protocolo.chaveAcesso);
    // DANFSe local pelo XML guardado: nada vai à rede.
    const antes = s.caminhos.length;
    const pdf = await s.emissor.pdf(d.proc, { canhoto: false });
    expect(new TextDecoder().decode(pdf.subarray(0, 8))).toBe('%PDF-1.4');
    expect(s.caminhos.length).toBe(antes);
    expect([renders[0]?.opcoes, renders[0]?.doc.title, marca(0)]).toEqual([
      { canhoto: false },
      `DANFSe ${d.protocolo.chaveAcesso}`,
      undefined,
    ]);

    const substituicao = {
      chSubstda: d.protocolo.chaveAcesso,
      cMotivo: '99',
      xMotivo: 'Correcao do valor do servico',
    } as const;
    await expect(s.emissor.substituir('nfse-2', dps({ nDPS: '2' }))).rejects.toMatchObject({ code: 'config_invalida' });
    const nova = gerada(await s.emissor.substituir('nfse-2', dps({ nDPS: '2', substituicao })));
    expect(nova.protocolo.chaveAcesso).not.toBe(d.protocolo.chaveAcesso);
    const canc = await s.emissor.cancelar({
      chave: nova.protocolo.chaveAcesso,
      cMotivo: '1',
      xMotivo: 'Erro na emissão da nota de teste',
    });
    if (canc.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${canc.tipo}`);
    expect([canc.recuperado, canc.evento.tpEvento]).toEqual([false, '101101']);
    const outra = await s.emissor.cancelar({
      chave: nova.protocolo.chaveAcesso,
      cMotivo: '1',
      xMotivo: 'Erro na emissão da nota de teste',
    });
    // Segundo cancelamento: a Sefin responde E0840, e a consulta do e101101 traz o evento já registrado.
    if (outra.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${outra.tipo}`);
    expect([outra.recuperado, outra.cStat, outra.bruto?.cStat]).toEqual([true, '100', 'E0840']);
    expect(outra.procEvento).toBe(canc.procEvento);
    // A substituída tem o e105102, não o e101101: a E0840 não é deste cancelamento e continua recusada.
    const substituida = await s.emissor.cancelar({
      chave: d.protocolo.chaveAcesso,
      cMotivo: '1',
      xMotivo: 'Erro na emissão da nota de teste',
    });
    expect([substituida.tipo, substituida.cStat]).toEqual(['recusado', 'E0840']);
    expect(substituida.tipo === 'recusado' && substituida.xMotivo).toContain('Substituição');
    expect(s.caminhos.filter((c) => c.startsWith('GET /sefin/nfse/') && c.endsWith('/eventos/101101/1'))).toHaveLength(
      2,
    );
    expect(emissoes(s)).toBe(2);

    // Com o evento: "CANCELADA" pelo e101101 e "SUBSTITUÍDA" pelo e105102 registrado pela Sefin.
    await s.emissor.pdfCancelado(nova.proc, canc.procEvento);
    expect(marca(1)).toBe('CANCELADA');
    const e105102 = (
      await s.emissor.cliente.consultarEventos(d.protocolo.chaveAcesso, { tpEvento: '105102', nSeqEvento: 1 })
    )[0];
    await s.emissor.pdfCancelado(d.proc, e105102?.xml ?? '');
    expect(marca(2)).toBe('SUBSTITUÍDA');
    await expect(s.emissor.pdfCancelado(d.proc, canc.procEvento)).rejects.toMatchObject({
      code: 'evento_incompativel',
    });
    // O mesmo evento com o namespace num prefixo continua sendo de substituição; XML malformado vai ao `danfse`.
    const prefixado = (e105102?.xml ?? '')
      .replace(/<(\/?)e105102\b/g, '<$1n:e105102')
      .replace('<n:e105102', '<n:e105102 xmlns:n="http://www.sped.fazenda.gov.br/nfse"');
    expect(prefixado).toContain('<n:e105102 xmlns:n=');
    await s.emissor.pdfCancelado(d.proc, prefixado);
    expect(marca(renders.length - 1)).toBe('SUBSTITUÍDA');
    await expect(s.emissor.pdfCancelado(d.proc, '<evento')).rejects.toMatchObject({ code: 'xml_invalido' });

    // Sem o XML guardado: a consulta da chave e dos eventos, com a marca que a Sefin tem.
    await s.emissor.pdfPorChave(nova.protocolo.chaveAcesso);
    expect([renders.at(-1)?.opcoes.cancelamento, marca(renders.length - 1)]).toEqual([canc.procEvento, 'CANCELADA']);
    await s.emissor.pdfPorChave(d.protocolo.chaveAcesso, { canhoto: false });
    expect(marca(renders.length - 1)).toBe('SUBSTITUÍDA');
    expect(renders.at(-1)?.opcoes.canhoto).toBe(false);
    const ultimo = renders.length;
    // Chave bem formada que a Sefin não conhece: outro número de NFS-e (13 dígitos depois da inscrição).
    const k = d.protocolo.chaveAcesso;
    expect(await s.emissor.pdfPorChave(`${k.slice(0, 23)}${'9'.repeat(13)}${k.slice(36)}`)).toBeUndefined();
    expect(renders.length).toBe(ultimo);
  });

  test('processou e não respondeu, nem a consulta: a retomada depois de reiniciar guarda com os mesmos bytes', async () => {
    const s = await cenario({ timeoutMs: 400 });
    s.sim.injectFault({ kind: 'hang', phase: 'after' }, { rota: 'emitir' });
    s.sim.injectFault({ kind: 'hang', phase: 'before' }, { rota: 'consultarDps' });
    const p = await s.emissor.emitir('nfse-3', dps({ nDPS: '3' }));
    expect([p.tipo, p.tipo === 'pendente' && p.motivo]).toEqual(['pendente', 'sem-resposta']);
    const gravado = await s.store.ler('nfse', 'nfse-3');
    const depois = await s.novoEmissor();
    const d = gerada(await depois.emitir('nfse-3', dps({ nDPS: '30' })));
    expect(d.id).toBe(gravado?.id as string);
    expect(emissoes(s)).toBe(1);
    expect(s.guardados.map((g) => g.ref)).toEqual(['nfse-3']);
  });

  test('não chegou, e envio cancelado depois de sair: a consulta da DPS decide', async () => {
    const s = await cenario({ timeoutMs: 400 });
    s.sim.injectFault({ kind: 'hang', phase: 'before' }, { rota: 'emitir' });
    gerada(await s.emissor.emitir('nfse-4', dps({ nDPS: '4' })));
    expect(emissoes(s)).toBe(2);

    let cancelou = false;
    const t = await cenario({}, (caminho) => {
      if (cancelou || !caminho.startsWith('POST ') || !caminho.endsWith('/nfse')) return;
      cancelou = true;
      throw new TransportError('cancelado', 'envio cancelado');
    });
    gerada(await t.emissor.emitir('nfse-5', dps({ nDPS: '5' })));
    expect([cancelou, emissoes(t)]).toEqual([true, 1]);
  });

  test('E0014 da DPS que já gerou NFS-e: a consulta conclui; outra DPS no número é divergente', async () => {
    const s = await cenario();
    gerada(await s.emissor.emitir('a', dps({ nDPS: '7' })));
    const outra = dps({ nDPS: '7', valores: { vServ: '2000.00' } });
    const d = await s.emissor.emitir('b', outra);
    if (d.tipo !== 'divergente') throw new Error(`esperava divergente, veio ${d.tipo}`);
    expect(d.cStat).toBe('E0014');
    expect(d.chaveRegistrada).toBeDefined();
    expect(await s.store.ler('nfse', 'b')).toBeDefined();
    const retomada = await s.emissor.retomar('b');
    expect([retomada?.tipo, retomada?.tipo === 'divergente' && retomada.cStat]).toEqual(['divergente', undefined]);

    const invalida = await s.emissor.emitir('c', dps({ nDPS: '8', valores: { vServ: '1.001' } })).catch((e) => e);
    expect(invalida).toBeInstanceOf(ValidationError);
  });

  test('cancelamento sem resposta: o evento vem da consulta de eventos; sem ele, pendente', async () => {
    const s = await cenario({ timeoutMs: 400 });
    const d = gerada(await s.emissor.emitir('nfse-9', dps({ nDPS: '9' })));
    const chave = d.protocolo.chaveAcesso;
    s.sim.injectFault({ kind: 'hang', phase: 'before' }, { rota: 'evento' });
    const nada = await s.emissor.cancelar({ chave, cMotivo: '1', xMotivo: 'Erro na emissão da nota de teste' });
    expect([nada.tipo, nada.tipo === 'pendente' && nada.motivo]).toEqual(['pendente', 'sem-resposta']);
    s.sim.injectFault({ kind: 'hang', phase: 'before' }, { rota: 'evento' });
    s.sim.injectFault({ kind: 'hang', phase: 'before' }, { rota: 'consultarEventos' });
    const semConsulta = await s.emissor.cancelar({ chave, cMotivo: '1', xMotivo: 'Erro na emissão da nota de teste' });
    expect(semConsulta.tipo).toBe('pendente');
    s.sim.injectFault({ kind: 'hang', phase: 'after' }, { rota: 'evento' });
    const r = await s.emissor.cancelar({ chave, cMotivo: '1', xMotivo: 'Erro na emissão da nota de teste' });
    if (r.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${r.tipo}`);
    expect([r.recuperado, r.cStat, r.evento.tpEvento]).toEqual([true, '100', '101101']);
  });

  test('resposta perdida e nova tentativa: a E0840 da segunda leva ao evento que a Sefin já tinha registrado', async () => {
    const s = await cenario({ timeoutMs: 400 });
    const d = gerada(await s.emissor.emitir('nfse-10', dps({ nDPS: '10' })));
    const chave = d.protocolo.chaveAcesso;
    s.sim.injectFault({ kind: 'hang', phase: 'after' }, { rota: 'evento' });
    s.sim.injectFault({ kind: 'hang', phase: 'before' }, { rota: 'consultarEventos' });
    const perdida = await s.emissor.cancelar({ chave, cMotivo: '1', xMotivo: 'Erro na emissão da nota de teste' });
    expect([perdida.tipo, perdida.tipo === 'pendente' && perdida.motivo]).toEqual(['pendente', 'sem-resposta']);
    expect(s.sim.inspect.eventos(chave).map((e) => e.tpEvento)).toEqual(['101101']);
    const denovo = await s.emissor.cancelar({ chave, cMotivo: '1', xMotivo: 'Erro na emissão da nota de teste' });
    if (denovo.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${denovo.tipo}`);
    expect([denovo.recuperado, denovo.bruto?.cStat, denovo.evento.tpEvento]).toEqual([true, 'E0840', '101101']);
    expect(denovo.procEvento).toBe(s.sim.inspect.eventos(chave)[0]?.xml as string);
    s.sim.injectFault({ kind: 'hang', phase: 'before' }, { rota: 'consultarEventos' });
    const semConsulta = await s.emissor.cancelar({ chave, cMotivo: '1', xMotivo: 'Erro na emissão da nota de teste' });
    expect([semConsulta.tipo, semConsulta.tipo === 'pendente' && semConsulta.bruto?.cStat]).toEqual([
      'pendente',
      'E0840',
    ]);
    expect(s.sim.inspect.eventos(chave)).toHaveLength(1);
  });
});
