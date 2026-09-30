/**
 * Ponta a ponta: o `@sinete/mdfe` contra o `@sinete/sefaz-sim` pelo `@sinete/transport` real, em HTTPS com mTLS. A
 * AC, o e-CPF do produtor, o e-CNPJ da transportadora e o certificado do servidor são gerados na hora (nada vai para o
 * repo). O cliente resolve os endpoints do MDF-e (SVRS) pelos dados do transporte, como em produção; o `redirecionarParaSim`
 * troca só a URL de cada pedido.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import { contextoDeTempo, ErroDeTempoEsgotado, relogioManual } from '@sinete/core';
import { conferirAssinatura } from '@sinete/core/xml';
import type { CertificadoSintetico, SefazSim } from '@sinete/sefaz-sim';
import { certificadoSintetico, criarSefazSim, iniciarServidorSefazSim, redirecionarParaSim } from '@sinete/sefaz-sim';
import type { Transporte } from '@sinete/transport';
import { criarTransporte } from '@sinete/transport';
import type { ClienteMdfe, DadosMdfe, MontarMdfeOpcoes } from '../../src/index.ts';
import { assinarMdfe, criarClienteMdfe, montarMdfe, resolverEnvioSemResposta } from '../../src/index.ts';
import { CNPJ_EMIT, CPF_EMIT, cargaPropria, EMISSAO, opcoes, prestador } from '../helpers/mdfe.ts';

interface Certs {
  readonly ac: CertificadoSintetico;
  readonly servidor: CertificadoSintetico;
  readonly produtor: CertificadoSintetico;
  readonly transportadora: CertificadoSintetico;
}

let c: Certs;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = relogioManual(EMISSAO);
  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac', diasDeValidade: 3650 });
  const [servidor, produtor, transportadora] = await Promise.all([
    certificadoSintetico({ relogio: clock, papel: 'servidor', emissor: ac }),
    certificadoSintetico({ relogio: clock, papel: 'titular', cpf: CPF_EMIT, emissor: ac }),
    certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: CNPJ_EMIT, emissor: ac }),
  ]);
  c = { ac, servidor, produtor, transportadora };
}, 60_000);

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
});

interface Cenario {
  readonly clock: RelogioManual;
  readonly sim: SefazSim;
  /** Caminhos pedidos ao simulador, na ordem. */
  readonly caminhos: string[];
  cliente(canal: CertificadoSintetico, timeoutMs?: number): ClienteMdfe;
  emitir(
    input: DadosMdfe,
    assinante: CertificadoSintetico,
    o?: Partial<MontarMdfeOpcoes>,
  ): Promise<{ chave: string; xml: string }>;
}

async function cenario(): Promise<Cenario> {
  const clock = relogioManual(EMISSAO);
  const sim = criarSefazSim({ relogio: clock, uf: 'MT' });
  const server = await iniciarServidorSefazSim(sim, { certificado: c.servidor.pem, chave: c.servidor.chavePem });
  const caminhos: string[] = [];
  const transports: Transporte[] = [];
  fechar.push(async () => {
    for (const t of transports) await t.fechar();
    await server.fechar();
  });
  const cliente = (canal: CertificadoSintetico, timeoutMs = 10_000): ClienteMdfe => {
    const real = criarTransporte({ identidade: canal.identidadeTls, acsAdicionais: [c.ac.pem], timeoutMs });
    const gravador: Transporte = {
      capacidades: real.capacidades,
      enviar: (r) => {
        caminhos.push(new URL(r.url).pathname);
        return real.enviar(r);
      },
      fechar: () => real.fechar(),
    };
    const transport = redirecionarParaSim(gravador, server.urlBase);
    transports.push(transport);
    return criarClienteMdfe({
      transporte: transport,
      assinador: canal.assinador,
      ambiente: 'homologacao',
      relogio: clock,
      autor: canal === c.produtor ? { CPF: CPF_EMIT } : { CNPJ: CNPJ_EMIT },
    });
  };
  const emitir: Cenario['emitir'] = async (input, assinante, o = {}) => {
    const b = await montarMdfe(input, { ...opcoes(), tempo: contextoDeTempo({ emissao: clock }), ...o });
    if (!b.ok) throw new Error(b.ocorrencias.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
    return { chave: b.valor.chave, xml: await assinarMdfe(b.valor, assinante.assinador) };
  };
  return { clock, sim, caminhos, cliente, emitir };
}

describe('MDF-e contra a SEFAZ simulada, HTTPS com mTLS', () => {
  test('produtor rural (e-CPF): status, autorização, consulta, não encerrados e encerramento', async () => {
    const cen = await cenario();
    const client = cen.cliente(c.produtor);
    expect((await client.statusServico()).cStat).toBe('107');
    const mdfe = await cen.emitir(cargaPropria(), c.produtor);
    const r = await client.autorizar(mdfe.xml);
    if (r.tipo !== 'autorizado') throw new Error(JSON.stringify(r));
    // O mdfeProc leva o MDF-e byte a byte e a assinatura continua conferindo dentro do envelope.
    expect(r.valor.mdfeProc).toContain(mdfe.xml);
    expect(
      (await conferirAssinatura(r.valor.mdfeProc ?? '', { id: `MDFe${mdfe.chave}`, elemento: 'infMDFe' })).ok,
    ).toBe(true);
    const q = await client.consultar(mdfe.chave, mdfe.xml);
    expect(q.tipo === 'autorizado' && q.valor.digValConfere).toBe(true);
    const abertos = await client.consultarNaoEncerrados();
    expect(abertos.tipo === 'autorizado' && abertos.valor.map((m) => m.chMDFe)).toEqual([mdfe.chave]);
    cen.clock.avancar(6 * 3_600_000);
    const enc = await client.encerrar({ chave: mdfe.chave, nProt: r.valor.nProt ?? '', uf: 'SP', cMun: '3550308' });
    if (enc.tipo !== 'autorizado') throw new Error(JSON.stringify(enc));
    expect(enc.valor.procEventoMDFe).toContain('<evEncMDFe>');
    const fim = await client.consultar(mdfe.chave);
    expect(fim.tipo === 'autorizado' && fim.valor.situacao).toBe('encerrado');
    expect(fim.tipo === 'autorizado' && fim.valor.eventos.length).toBe(1);
    expect(cen.caminhos).toEqual([
      '/uf/ws/MDFeStatusServico',
      '/uf/ws/MDFeRecepcaoSinc',
      '/uf/ws/MDFeConsulta',
      '/uf/ws/MDFeConsNaoEnc',
      '/uf/ws/MDFeRecepcaoEvento',
      '/uf/ws/MDFeConsulta',
    ]);
  });

  test('transportadora (e-CNPJ): contingência off-line autorizada depois, e cancelamento', async () => {
    const cen = await cenario();
    const client = cen.cliente(c.transportadora);
    const mdfe = await cen.emitir(prestador(), c.transportadora, { tpEmis: '2' });
    expect(mdfe.xml).toContain('&amp;sign=');
    cen.clock.avancar(48 * 3_600_000);
    const r = await client.autorizar(mdfe.xml);
    if (r.tipo !== 'autorizado') throw new Error(JSON.stringify(r));
    const canc = await client.cancelar({
      chave: mdfe.chave,
      nProt: r.valor.nProt ?? '',
      xJust: 'VIAGEM NAO REALIZADA TESTE',
    });
    expect(canc.tipo === 'autorizado' && canc.cStat).toBe('135');
    const q = await client.consultar(mdfe.chave);
    expect(q.tipo === 'autorizado' && q.valor.situacao).toBe('cancelado');
  });

  test('processou e não respondeu: timeout, e o resolvedor recupera o mdfeProc pela consulta', async () => {
    const cen = await cenario();
    const mdfe = await cen.emitir(cargaPropria(), c.produtor);
    cen.sim.injetarFalha({ tipo: 'travar', fase: 'depois' }, { servico: 'MDFeRecepcaoSinc' });
    const apressado = cen.cliente(c.produtor, 400);
    expect(await apressado.autorizar(mdfe.xml).catch((e: unknown) => e)).toBeInstanceOf(ErroDeTempoEsgotado);
    expect(cen.sim.inspecao.mdfe(mdfe.chave)?.situacao).toBe('autorizado');
    const res = await resolverEnvioSemResposta(cen.cliente(c.produtor), mdfe.xml);
    expect(res.acao).toBe('concluida');
    if (res.acao === 'concluida')
      expect(res.resultado.tipo === 'autorizado' && res.resultado.valor.mdfeProc).toContain(mdfe.xml);
  });
});
