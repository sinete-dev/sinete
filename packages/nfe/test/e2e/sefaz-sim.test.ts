/**
 * Ponta a ponta: o `@sinete/nfe` contra o `@sinete/sefaz-sim` pelo `@sinete/transport` real, em HTTPS com mTLS. A AC,
 * os e-CNPJ e o certificado do servidor são gerados na hora (nada vai para o repo). O cliente resolve os endpoints
 * pelos dados do transporte, como em produção; o `redirectToSim` do simulador troca só a URL de cada pedido.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import { contextoDeTempo, ErroDeTempoEsgotado, ErroDeValidacao, relogioManual } from '@sinete/core';
import type { SefazSim, SefazSimOptions, SyntheticCertificate } from '@sinete/sefaz-sim';
import { createSefazSim, redirectToSim, startSefazSimServer, syntheticCertificate } from '@sinete/sefaz-sim';
import type { Transporte } from '@sinete/transport';
import { criarTransporte } from '@sinete/transport';
import { calcularDvCnpj } from '@sinete/validators';
import type { NfeClient, NfeClientOptions, NfeInput } from '../../src/index.ts';
import { buildNfe, createNfeClient, resolverEnvioSemResposta, signNfe } from '../../src/index.ts';
import { CNPJ_DEST, CNPJ_EMIT, EMISSAO, IE_SP, nota, opcoes } from '../helpers/nota.ts';

/** Transmissor terceiro (contabilidade): outra raiz de CNPJ. */
const CNPJ_TERCEIRO = `778889990001${calcularDvCnpj('778889990001')}`;

interface Certs {
  readonly ac: SyntheticCertificate;
  readonly servidor: SyntheticCertificate;
  readonly emitente: SyntheticCertificate;
  readonly destinatario: SyntheticCertificate;
  readonly terceiro: SyntheticCertificate;
}

let c: Certs;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = relogioManual(EMISSAO);
  const ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
  const titular = (cnpj: string): Promise<SyntheticCertificate> =>
    syntheticCertificate({ clock, role: 'titular', cnpj, issuer: ac });
  const [servidor, emitente, destinatario, terceiro] = await Promise.all([
    syntheticCertificate({ clock, role: 'servidor', issuer: ac }),
    titular(CNPJ_EMIT),
    titular(CNPJ_DEST),
    titular(CNPJ_TERCEIRO),
  ]);
  c = { ac, servidor, emitente, destinatario, terceiro };
}, 60_000);

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
});

afterAll(async () => {
  for (const f of fechar.splice(0)) await f();
});

interface Cenario {
  readonly clock: RelogioManual;
  readonly sim: SefazSim;
  /** Caminhos pedidos ao simulador, na ordem (`/uf/ws/NFeAutorizacao4`...). */
  readonly caminhos: string[];
  readonly client: NfeClient;
  /** Outro cliente no mesmo simulador: canal TLS, assinatura e opções próprias. */
  cliente(o: {
    readonly canal: SyntheticCertificate;
    readonly assinante?: SyntheticCertificate;
    readonly opcoes?: Partial<NfeClientOptions>;
    readonly timeoutMs?: number;
  }): NfeClient;
  /** Monta e assina uma NF-e no relógio do cenário. */
  emitir(extra?: Partial<NfeInput>, assinante?: SyntheticCertificate): Promise<{ chave: string; xml: string }>;
}

const DEST_CNPJ: NonNullable<NfeInput['destinatario']> = {
  CNPJ: CNPJ_DEST,
  xNome: 'DESTINATARIO SINTETICO LTDA',
  indIEDest: '9',
  endereco: {
    xLgr: 'AVENIDA FICTICIA',
    nro: '1',
    xBairro: 'BAIRRO',
    cMun: '3550308',
    xMun: 'SAO PAULO',
    UF: 'SP',
  },
};

async function cenario(simOptions: Partial<SefazSimOptions> = {}): Promise<Cenario> {
  const clock = relogioManual(EMISSAO);
  const sim = createSefazSim({
    clock,
    uf: 'SP',
    cadastro: [{ UF: 'SP', IE: IE_SP, CNPJ: CNPJ_EMIT, xNome: 'EMPRESA SINTETICA LTDA' }],
    ...simOptions,
  });
  const server = await startSefazSimServer(sim, { cert: c.servidor.pem, key: c.servidor.keyPem });
  const caminhos: string[] = [];
  const transports: Transporte[] = [];
  fechar.push(async () => {
    for (const t of transports) await t.fechar();
    await server.close();
  });

  const cliente: Cenario['cliente'] = (o) => {
    // O transporte real, com o certificado do canal; o gravador só anota o caminho que chegou ao simulador.
    const real = criarTransporte({
      identidade: o.canal.tlsIdentity,
      acsAdicionais: [c.ac.pem],
      timeoutMs: o.timeoutMs ?? 10_000,
    });
    const gravador: Transporte = {
      capacidades: real.capacidades,
      enviar: (r) => {
        caminhos.push(new URL(r.url).pathname);
        return real.enviar(r);
      },
      fechar: () => real.fechar(),
    };
    const transport = redirectToSim(gravador, server.baseUrl);
    transports.push(transport);
    return createNfeClient({
      transport,
      signer: (o.assinante ?? o.canal).signer,
      ambiente: 'homologacao',
      uf: 'SP',
      clock,
      // A espera entre consultas do recibo avança o relógio injetado, sem dormir.
      sleep: async (ms) => clock.avancar(ms),
      ...(o.timeoutMs === undefined ? {} : { timeoutMs: o.timeoutMs }),
      ...o.opcoes,
    });
  };

  const emitir: Cenario['emitir'] = async (extra = {}, assinante = c.emitente) => {
    const r = await buildNfe(
      nota({ destinatario: DEST_CNPJ, ...extra }),
      opcoes({ time: contextoDeTempo({ emissao: clock }) }),
    );
    if (!r.ok) throw new Error(r.issues.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
    return { chave: r.value.chave, xml: await signNfe(r.value, assinante.signer) };
  };

  const client = cliente({ canal: c.emitente, opcoes: { autor: { CNPJ: CNPJ_EMIT } } });
  return { clock, sim, caminhos, client, cliente, emitir };
}

describe('NF-e contra a SEFAZ simulada, HTTPS com mTLS', () => {
  test('status do serviço', async () => {
    const { client, caminhos } = await cenario();
    const r = await client.statusServico();
    expect(r.tipo).toBe('autorizado');
    if (r.tipo === 'autorizado') expect(r.valor.cUF).toBe('35');
    expect(caminhos).toEqual(['/uf/ws/NFeStatusServico4']);
  });

  test('status do serviço da NFC-e: o autorizador do modelo 65', async () => {
    const { client, sim } = await cenario();
    expect((await client.statusServico({ mod: '65' })).tipo).toBe('autorizado');
    sim.setParalisacao('108');
    expect((await client.statusServico({ mod: '65' })).cStat).toBe('108');
  });

  test('montagem, assinatura e autorização síncrona; consulta confirma o digVal', async () => {
    const { client, emitir, sim } = await cenario();
    const nfe = await emitir({ nNF: 1 });
    const r = await client.autorizar(nfe.xml);
    expect([r.tipo, r.cStat]).toEqual(['autorizado', '100']);
    if (r.tipo !== 'autorizado') throw new Error('não autorizou');
    expect(r.valor.nProt).toBe(sim.inspect.nfe(nfe.chave)?.nProt as string);
    // O nfeProc leva a NF-e assinada byte a byte.
    expect(r.valor.nfeProc).toContain(nfe.xml);
    const consulta = await client.consultar(nfe.chave, nfe.xml);
    expect(consulta.tipo).toBe('autorizado');
    if (consulta.tipo === 'autorizado') {
      expect(consulta.valor.situacao).toBe('autorizada');
      expect(consulta.valor.digValConfere).toBe(true);
    }
  });

  test('autorização assíncrona: recibo pendente (105) e consulta até o lote ser processado', async () => {
    const { client, emitir, caminhos } = await cenario({ atrasoProcessamentoMs: 3000 });
    const nfe = await emitir({ nNF: 2 });
    const pendente = await client.autorizar(nfe.xml, { sincrono: false });
    expect([pendente.tipo, pendente.cStat]).toEqual(['pendente', '103']);
    if (pendente.tipo !== 'pendente') throw new Error('sem recibo');
    const nRec = pendente.referencia as string;
    expect((await client.consultarRecibo(nRec, nfe.xml)).cStat).toBe('105');
    const r = await client.aguardarRecibo(nRec, nfe.xml, { esperaMinimaMs: 1000, multiplicador: 2 });
    expect([r.tipo, r.cStat]).toEqual(['autorizado', '100']);
    if (r.tipo === 'autorizado') expect(r.valor.nfeProc).toContain(nfe.xml);
    expect(caminhos.filter((p) => p === '/uf/ws/NFeRetAutorizacao4').length).toBeGreaterThanOrEqual(3);
  });

  test('processou e não respondeu: timeout, reenvio com 204 e 539 resolvidos pela consulta protocolo', async () => {
    const cen = await cenario();
    const nfe = await cen.emitir({ nNF: 3 });
    cen.sim.injectFault({ kind: 'hang', phase: 'after' }, { servico: 'NFeAutorizacao' });
    const apressado = cen.cliente({ canal: c.emitente, timeoutMs: 400 });
    expect(await apressado.autorizar(nfe.xml).catch((e: unknown) => e)).toBeInstanceOf(ErroDeTempoEsgotado);
    expect(cen.sim.inspect.nfe(nfe.chave)?.situacao).toBe('autorizada');

    // Sem resposta: a consulta recupera o protocolo e monta o nfeProc com os bytes gravados.
    const semResposta = await resolverEnvioSemResposta(cen.client, nfe.xml);
    expect(semResposta.acao).toBe('concluida');
    if (semResposta.acao === 'concluida') {
      expect(semResposta.outcome.tipo).toBe('autorizado');
      if (semResposta.outcome.tipo === 'autorizado') expect(semResposta.outcome.valor.nfeProc).toContain(nfe.xml);
    }

    // Reenvio dos mesmos bytes: 204; o resolvedor conclui pela consulta.
    const dup = await cen.client.autorizar(nfe.xml);
    expect([dup.tipo, dup.cStat]).toEqual(['recusado', '204']);
    const r204 = await resolverEnvioSemResposta(cen.client, nfe.xml, dup);
    expect(r204.acao).toBe('concluida');

    // Nota remontada com outro cNF para o mesmo número: 539 com a chave autorizada, e a local deve ser descartada.
    const regerada = await cen.emitir({ nNF: 3, cNF: '87654321' });
    expect(regerada.chave).not.toBe(nfe.chave);
    const r539 = await cen.client.autorizar(regerada.xml);
    expect([r539.tipo, r539.cStat]).toEqual(['recusado', '539']);
    const divergente = await resolverEnvioSemResposta(cen.client, regerada.xml, r539);
    expect(divergente).toMatchObject({ acao: 'divergente', chNFe: nfe.chave });

    // Chave que nunca chegou: 217 na consulta, reenviar os mesmos bytes.
    const inedita = await cen.emitir({ nNF: 4 });
    expect(await resolverEnvioSemResposta(cen.client, inedita.xml)).toEqual({
      acao: 'reenviar',
      nfeAssinada: inedita.xml,
    });
  });

  test('CC-e com sequência 1 e 2, repetição rejeitada (573); cancelamento e consulta 101', async () => {
    const { client, emitir, clock } = await cenario();
    const nfe = await emitir({ nNF: 5 });
    const aut = await client.autorizar(nfe.xml);
    if (aut.tipo !== 'autorizado') throw new Error('não autorizou');
    clock.avancar(60_000);
    for (const nSeqEvento of [1, 2]) {
      const r = await client.cartaCorrecao({
        chave: nfe.chave,
        xCorrecao: `CORRECAO NUMERO ${nSeqEvento}`,
        nSeqEvento,
      });
      expect([r.tipo, r.cStat]).toEqual(['autorizado', '135']);
      if (r.tipo === 'autorizado') {
        expect(r.valor.nSeqEvento).toBe(String(nSeqEvento));
        expect(r.valor.procEventoNFe).toContain('<procEventoNFe');
      }
    }
    const repetida = await client.cartaCorrecao({ chave: nfe.chave, xCorrecao: 'CORRECAO REPETIDA', nSeqEvento: 1 });
    expect([repetida.tipo, repetida.cStat]).toEqual(['recusado', '573']);

    const canc = await client.cancelar({
      chave: nfe.chave,
      nProt: aut.valor.nProt as string,
      xJust: 'Cancelamento por erro na digitacao do pedido',
    });
    expect([canc.tipo, canc.cStat]).toEqual(['autorizado', '135']);
    const consulta = await client.consultar(nfe.chave, nfe.xml);
    expect(consulta.cStat).toBe('101');
    if (consulta.tipo === 'autorizado') {
      expect(consulta.valor.situacao).toBe('cancelada');
      expect(consulta.valor.eventos.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('destinatário: resumo na distribuição, ciência no AN e a NF-e completa depois', async () => {
    const cen = await cenario();
    const nfe = await cen.emitir({ nNF: 6 });
    expect((await cen.client.autorizar(nfe.xml)).tipo).toBe('autorizado');
    const dest = cen.cliente({ canal: c.destinatario, opcoes: { autor: { CNPJ: CNPJ_DEST } } });

    const antes = await dest.distribuicaoDFe({ ultNSU: 0 });
    if (antes.tipo !== 'autorizado') throw new Error(`distribuição ${antes.cStat}`);
    const resumo = antes.valor.documentos.find((d) => d.tipo === 'resNFe');
    expect(resumo?.resNFe?.chNFe).toBe(nfe.chave);
    expect(antes.valor.documentos.some((d) => d.tipo === 'procNFe')).toBe(false);

    const ciencia = await dest.manifestar({ chave: nfe.chave, tipo: 'ciencia' });
    expect([ciencia.tipo, ciencia.cStat]).toEqual(['autorizado', '135']);
    expect(cen.caminhos).toContain('/an/ws/NFeRecepcaoEvento4');

    const depois = await dest.distribuicaoDFe({ ultNSU: antes.valor.ultNSU });
    if (depois.tipo !== 'autorizado') throw new Error(`distribuição ${depois.cStat}`);
    const proc = depois.valor.documentos.find((d) => d.tipo === 'procNFe');
    expect(proc?.xml).toContain(nfe.xml);
    const porChave = await dest.distribuicaoDFe({ chNFe: nfe.chave });
    if (porChave.tipo !== 'autorizado') throw new Error(`consChNFe ${porChave.cStat}`);
    expect(porChave.valor.documentos.map((d) => d.tipo)).toEqual(['procNFe']);
    expect(cen.caminhos.filter((p) => p === '/an/ws/NFeDistribuicaoDFe')).toHaveLength(3);
  });

  test('inutilização com CNPJ homologada (e 563 ao repetir); com CPF recusada antes de enviar', async () => {
    const { client, caminhos } = await cenario();
    const pedido = { ano: 2026, serie: 1, nNFIni: 50, nNFFin: 52, xJust: 'Numeracao pulada por falha no sistema' };
    const r = await client.inutilizar(pedido);
    expect([r.tipo, r.cStat]).toEqual(['autorizado', '102']);
    if (r.tipo === 'autorizado') expect(r.valor.procInutNFe).toContain('<ProcInutNFe');
    const repetida = await client.inutilizar(pedido);
    expect([repetida.tipo, repetida.cStat]).toEqual(['recusado', '563']);
    const enviados = caminhos.length;
    // NT 2018.001 v1.10, item 6.1: o controle de inutilização não se aplica ao emitente pessoa física.
    const cpf = await client
      .inutilizar({ ...pedido, serie: 920, autor: { CPF: '11144477735' } })
      .catch((e: unknown) => e);
    expect(cpf).toBeInstanceOf(ErroDeValidacao);
    expect(caminhos).toHaveLength(enviados);
  });

  test('consulta cadastro', async () => {
    const { client } = await cenario();
    const r = await client.consultarCadastro({ uf: 'SP', CNPJ: CNPJ_EMIT });
    expect([r.tipo, r.cStat]).toEqual(['autorizado', '111']);
    if (r.tipo === 'autorizado') expect(r.valor.infCad[0]?.IE).toBe(IE_SP);
    expect((await client.consultarCadastro({ uf: 'SP', CNPJ: CNPJ_DEST })).cStat).toBe('259');
  });

  test('contingência SVC: a UF responde 108 e a NF-e tpEmis 6 é autorizada no SVC-AN', async () => {
    const cen = await cenario();
    cen.sim.setContingencia('SVC-AN');
    expect((await cen.client.statusServico()).cStat).toBe('108');
    const svc = cen.cliente({ canal: c.emitente, opcoes: { contingencia: 'svc' } });
    expect((await svc.statusServico()).cStat).toBe('107');
    const nfe = await cen.emitir({
      nNF: 7,
      contingencia: {
        tpEmis: '6',
        dhCont: cen.clock.agora(),
        xJust: 'SEFAZ de origem fora do ar no momento da emissao',
      },
    });
    const r = await svc.autorizar(nfe.xml);
    expect([r.tipo, r.cStat]).toEqual(['autorizado', '100']);
    expect(cen.caminhos).toContain('/svc/ws/NFeAutorizacao4');
    const consulta = await svc.consultar(nfe.chave, nfe.xml);
    expect(consulta.tipo).toBe('autorizado');
    expect(cen.caminhos.at(-1)).toBe('/svc/ws/NFeConsultaProtocolo4');
  });

  test('transmissor terceiro: canal de outro CNPJ com assinatura do emitente é aceito; assinatura de outra raiz é 213', async () => {
    const cen = await cenario();
    const contabilidade = cen.cliente({ canal: c.terceiro });
    const nfe = await cen.emitir({ nNF: 8 });
    const r = await contabilidade.autorizar(nfe.xml);
    expect([r.tipo, r.cStat]).toEqual(['autorizado', '100']);

    const assinadaPeloTerceiro = await cen.emitir({ nNF: 9 }, c.terceiro);
    const r213 = await contabilidade.autorizar(assinadaPeloTerceiro.xml);
    expect([r213.tipo, r213.cStat]).toEqual(['recusado', '213']);
    // Rejeição enriquecida pelo @sinete/rejeicoes: causa, correção e a regra de origem.
    if (r213.tipo === 'recusado') {
      expect(r213.dica?.fonte).toContain('F03');
      expect(r213.dica?.comoCorrigir).toContain('e-CNPJ');
    }
  });
});
