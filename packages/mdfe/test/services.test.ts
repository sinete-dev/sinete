/**
 * Serviços do `@sinete/mdfe` contra o `@sinete/sefaz-sim` em processo (`simTransport`): o cliente resolve os
 * endpoints pelos dados do transporte e o `redirectToSim` troca só a URL. A suíte por HTTPS com mTLS está em
 * `e2e/sefaz-sim.test.ts`.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import type { ManualClock } from '@sinete/core';
import { manualClock, TimeoutError, timeContext, ValidationError } from '@sinete/core';
import type { SefazSim, SefazSimOptions, SyntheticCertificate } from '@sinete/sefaz-sim';
import { createSefazSim, redirectToSim, SIM_BASE_URL, simTransport, syntheticCertificate } from '@sinete/sefaz-sim';
import { PolicyError } from '@sinete/transport';
import type { BuildMdfeOptions, MdfeClient, MdfeInput } from '../src/index.ts';
import {
  buildMdfe,
  createMdfeClient,
  MDFE_NS,
  mdfeAssinadoDoProc,
  recuperarEventoRegistrado,
  resolverEnvioSemResposta,
  signMdfe,
} from '../src/index.ts';
import {
  CNPJ_EMIT,
  CNPJ_TERCEIRO,
  CPF_CONDUTOR,
  CPF_EMIT,
  cargaPropria,
  chaveDoc,
  EMISSAO,
  opcoes,
  prestador,
} from './helpers/mdfe.ts';

interface Certs {
  readonly produtor: SyntheticCertificate;
  readonly transportadora: SyntheticCertificate;
  readonly terceiro: SyntheticCertificate;
}

let c: Certs;

beforeAll(async () => {
  const clock = manualClock(EMISSAO);
  const ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
  const [produtor, transportadora, terceiro] = await Promise.all([
    syntheticCertificate({ clock, role: 'titular', cpf: CPF_EMIT, issuer: ac }),
    syntheticCertificate({ clock, role: 'titular', cnpj: CNPJ_EMIT, issuer: ac }),
    syntheticCertificate({ clock, role: 'titular', cnpj: CNPJ_TERCEIRO, issuer: ac }),
  ]);
  c = { produtor, transportadora, terceiro };
}, 60_000);

interface Cenario {
  readonly clock: ManualClock;
  readonly sim: SefazSim;
  readonly client: MdfeClient;
  cliente(canal: SyntheticCertificate, timeoutMs?: number): MdfeClient;
  emitir(
    input?: MdfeInput,
    o?: Partial<BuildMdfeOptions>,
    assinante?: SyntheticCertificate,
  ): Promise<{ chave: string; xml: string }>;
  /** Emite e autoriza; devolve a chave e o nProt. */
  autorizado(input?: MdfeInput, o?: Partial<BuildMdfeOptions>): Promise<{ chave: string; nProt: string; xml: string }>;
}

function cenario(simOptions: Partial<SefazSimOptions> = {}, canal: SyntheticCertificate = c.produtor): Cenario {
  const clock = manualClock(EMISSAO);
  const sim = createSefazSim({ clock, uf: 'MT', ...simOptions });
  const cliente = (ch: SyntheticCertificate, timeoutMs?: number): MdfeClient =>
    createMdfeClient({
      transport: redirectToSim(
        simTransport(sim, { clientCertificate: ch.der, ...(timeoutMs === undefined ? {} : { timeoutMs }) }),
        SIM_BASE_URL,
      ),
      signer: ch.signer,
      ambiente: 'homologacao',
      clock,
      autor: ch === c.produtor ? { CPF: CPF_EMIT } : { CNPJ: CNPJ_EMIT },
    });
  const emitir: Cenario['emitir'] = async (input = cargaPropria(), o = {}, assinante = canal) => {
    const b = buildMdfe(input, { ...opcoes(), time: timeContext({ emissao: clock }), ...o });
    if (!b.ok) throw new Error(b.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
    return { chave: b.value.chave, xml: await signMdfe(b.value, assinante.signer) };
  };
  const client = cliente(canal);
  return {
    clock,
    sim,
    client,
    cliente,
    emitir,
    async autorizado(input, o) {
      const e = await emitir(input, o);
      const r = await client.autorizar(e.xml);
      if (r.status !== 'authorized') throw new Error(`não autorizou: ${JSON.stringify(r)}`);
      return { ...e, nProt: r.value.nProt ?? '' };
    },
  };
}

const HORA = 3_600_000;

describe('status e autorização', () => {
  test('status 107 e paralisação 108', async () => {
    const s = cenario();
    const r = await s.client.statusServico();
    expect(r.status === 'authorized' && r.cStat).toBe('107');
    s.sim.setParalisacaoMdfe('108');
    const p = await s.client.statusServico();
    expect(p.status === 'rejected' && p.cStat).toBe('108');
  });

  test('autoriza e monta o mdfeProc com o MDF-e assinado byte a byte', async () => {
    const s = cenario();
    const e = await s.emitir();
    const r = await s.client.autorizar(e.xml);
    if (r.status !== 'authorized') throw new Error(JSON.stringify(r));
    expect(r.cStat).toBe('100');
    expect(r.value.nProt).toMatch(/^95126\d{10}$/);
    expect(r.value.mdfeProc).toStartWith(
      `<mdfeProc xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">${e.xml}<protMDFe`,
    );
    expect(s.sim.inspect.mdfe(e.chave)?.situacao).toBe('autorizado');
  });

  test('MDF-e de outro ambiente é recusado com PolicyError antes do envio', async () => {
    const s = cenario();
    const producao = await s.emitir(cargaPropria(), { ambiente: 'producao' });
    const erro = await s.client.autorizar(producao.xml).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(PolicyError);
    expect(erro).toMatchObject({ code: 'politica_recusou', details: { tpAmb: '1', esperado: '2' } });
    expect(s.sim.inspect.mdfes()).toHaveLength(0);

    // Um cliente de produção também recusa o MDF-e de homologação.
    const homologacao = await s.emitir(cargaPropria({ nMDF: 2 }));
    const clienteProducao = createMdfeClient({ ...s.client.options, ambiente: 'producao' });
    await expect(clienteProducao.autorizar(homologacao.xml)).rejects.toMatchObject({
      code: 'politica_recusou',
      details: { tpAmb: '2', esperado: '1' },
    });
    // Sem tpAmb no ide, também recusa: o schema exige o campo.
    const semTpAmb = homologacao.xml.replace('<tpAmb>2</tpAmb>', '');
    await expect(s.client.autorizar(semTpAmb)).rejects.toMatchObject({ details: { tpAmb: '', esperado: '2' } });
    expect(s.sim.inspect.mdfes()).toHaveLength(0);
  });

  test('mdfeAssinadoDoProc: os bytes assinados de dentro do mdfeProc servem na retomada', async () => {
    const s = cenario();
    const e = await s.emitir(cargaPropria({ nMDF: 40 }));
    const r = await s.client.autorizar(e.xml);
    if (r.status !== 'authorized' || r.value.mdfeProc === undefined) throw new Error('não autorizou');
    expect(mdfeAssinadoDoProc(r.value.mdfeProc)).toBe(e.xml);
    expect(mdfeAssinadoDoProc(e.xml)).toBe(e.xml);
    // Proc de outro emissor, com o xmlns só no envelope: a fatia volta a declarar o namespace na raiz.
    const semXmlns = r.value.mdfeProc.replace(`<MDFe xmlns="${MDFE_NS}">`, '<MDFe>');
    expect(semXmlns).not.toBe(r.value.mdfeProc);
    const recortado = mdfeAssinadoDoProc(semXmlns);
    expect(recortado).toBe(e.xml);
    const res = await resolverEnvioSemResposta(s.client, recortado);
    expect(res.acao).toBe('concluida');
    expect(() => mdfeAssinadoDoProc(`<mdfeProc xmlns="${MDFE_NS}" versao="3.00"/>`)).toThrow('esperado');
    expect(() => mdfeAssinadoDoProc('<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"/>')).toThrow('esperado');
  });

  test('reenvio dos mesmos bytes: 204, e o resolvedor conclui com o protocolo existente', async () => {
    const s = cenario();
    const e = await s.emitir();
    await s.client.autorizar(e.xml);
    const dup = await s.client.autorizar(e.xml);
    expect(dup.status === 'rejected' && dup.cStat).toBe('204');
    expect(dup.status === 'rejected' && dup.hint?.source).toContain('F82');
    const res = await resolverEnvioSemResposta(s.client, e.xml, dup);
    expect(res.acao).toBe('concluida');
    if (res.acao === 'concluida')
      expect(res.outcome.status === 'authorized' && res.outcome.value.mdfeProc).toContain(e.xml);
  });

  test('o mesmo número com outro cMDF: 539 com a chave autorizada, e o resolvedor manda descartar', async () => {
    const s = cenario();
    const a = await s.autorizado(cargaPropria({ cMDF: '12345678' }));
    const b = await s.emitir(cargaPropria({ cMDF: '87654321' }));
    const r = await s.client.autorizar(b.xml);
    expect(r.status === 'rejected' && r.cStat).toBe('539');
    const res = await resolverEnvioSemResposta(s.client, b.xml, r);
    expect(res).toMatchObject({ acao: 'divergente', chMDFe: a.chave });
  });

  test('sem resposta depois de processar: o resolvedor recupera o mdfeProc; antes de processar, manda reenviar', async () => {
    const s = cenario();
    const lento = s.cliente(c.produtor, 200);
    const e = await s.emitir();
    s.sim.injectFault({ kind: 'hang', phase: 'after' }, { servico: 'MDFeRecepcaoSinc' });
    await expect(lento.autorizar(e.xml)).rejects.toBeInstanceOf(TimeoutError);
    const res = await resolverEnvioSemResposta(s.client, e.xml);
    expect(res.acao === 'concluida' && res.situacao).toBe('autorizado');

    const outro = await s.emitir(
      cargaPropria({
        nMDF: 2,
        rodoviario: { ...cargaPropria().rodoviario, tracao: { ...cargaPropria().rodoviario.tracao, placa: 'DEF2G34' } },
      }),
    );
    s.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'MDFeRecepcaoSinc' });
    await expect(s.client.autorizar(outro.xml)).rejects.toThrow();
    const r2 = await resolverEnvioSemResposta(s.client, outro.xml);
    expect(r2.acao).toBe('reenviar');
    if (r2.acao === 'reenviar') expect((await s.client.autorizar(r2.mdfeAssinado)).status).toBe('authorized');
  });

  test('protocolo sem digVal na resposta e na consulta: sem mdfeProc, e o resolvedor devolve sem-prova', async () => {
    const s = cenario();
    const e = await s.emitir();
    s.sim.setProtocoloSemDigVal('todos');
    const r = await s.client.autorizar(e.xml);
    expect(r.status === 'authorized' && r.value.digVal).toBeUndefined();
    expect(r.status === 'authorized' && r.value.mdfeProc).toBeUndefined();
    const res = await resolverEnvioSemResposta(s.client, e.xml);
    expect(res).toMatchObject({ acao: 'sem-prova', situacao: 'autorizado' });
    // Só a resposta da autorização sem digVal: a consulta prova o conteúdo e conclui.
    s.sim.setProtocoloSemDigVal('todos', 'autorizacao');
    const res2 = await resolverEnvioSemResposta(s.client, e.xml);
    expect(res2.acao === 'concluida' && res2.outcome.status === 'authorized' && res2.outcome.value.mdfeProc).toContain(
      e.xml,
    );
    // `denegacao` não alcança o MDF-e, que não tem denegação.
    s.sim.setProtocoloSemDigVal('denegacao');
    expect((await resolverEnvioSemResposta(s.client, e.xml)).acao).toBe('concluida');
  });

  test('assinatura de outro titular (213) e emissão normal atrasada (228); a contingência tem 168 horas', async () => {
    const s = cenario();
    const alheio = await s.emitir(cargaPropria(), {}, c.terceiro);
    const r = await s.client.autorizar(alheio.xml);
    expect(r.status === 'rejected' && r.cStat).toBe('213');
    const atrasado = await s.emitir(cargaPropria({ nMDF: 5 }));
    s.clock.advance(25 * HORA);
    const r2 = await s.client.autorizar(atrasado.xml);
    expect(r2.status === 'rejected' && r2.cStat).toBe('228');
    s.clock.advance(-25 * HORA);
    const cont = await s.emitir(cargaPropria({ nMDF: 6 }), { tpEmis: '2' });
    s.clock.advance(100 * HORA);
    const r3 = await s.client.autorizar(cont.xml);
    expect(r3.status).toBe('authorized');
  });
});

describe('consultas', () => {
  test('consulta: 217 fora da base, 100 com digVal conferido', async () => {
    const s = cenario();
    const e = await s.emitir();
    const nao = await s.client.consultar(e.chave);
    expect(nao.status === 'rejected' && nao.cStat).toBe('217');
    await s.client.autorizar(e.xml);
    const r = await s.client.consultar(e.chave, e.xml);
    if (r.status !== 'authorized') throw new Error(JSON.stringify(r));
    expect(r.value).toMatchObject({ situacao: 'autorizado', digValConfere: true, eventos: [] });
    expect(r.value.protocolo?.mdfeProc).toContain(e.xml);
    await expect(s.client.consultar(chaveDoc(1))).rejects.toBeInstanceOf(ValidationError);
  });

  test('não encerrados: 111 com a lista, 112 depois de encerrar; H04 pelo certificado do canal', async () => {
    const s = cenario();
    const a = await s.autorizado();
    const r = await s.client.consultarNaoEncerrados();
    expect(r.status === 'authorized' && r.value).toEqual([{ chMDFe: a.chave, nProt: a.nProt }]);
    await s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'SP', cMun: '3550308' });
    const vazio = await s.client.consultarNaoEncerrados();
    expect(vazio.status === 'authorized' && vazio.cStat).toBe('112');
    const outroCanal = s.cliente(c.terceiro);
    const h04 = await outroCanal.consultarNaoEncerrados({ CNPJ: CNPJ_EMIT });
    expect(h04.status === 'rejected' && h04.cStat).toBe('213');
  });
});

describe('não encerrados bloqueiam a emissão (F85 a F88)', () => {
  const mesmaPlaca = (extra: Partial<MdfeInput>): MdfeInput => cargaPropria({ nMDF: 2, ...extra });

  test('611: mesma placa e UF de descarga; libera depois do encerramento', async () => {
    const s = cenario();
    const a = await s.autorizado();
    const b = await s.emitir(mesmaPlaca({}));
    const r = await s.client.autorizar(b.xml);
    expect(r.status === 'rejected' && r.cStat).toBe('611');
    expect(r.status === 'rejected' && r.xMotivo).toContain(a.chave);
    await s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'SP', cMun: '3550308' });
    expect((await s.client.autorizar(b.xml)).status).toBe('authorized');
  });

  test('662: a volta sem encerrar a ida', async () => {
    const s = cenario();
    await s.autorizado();
    const volta = mesmaPlaca({
      ufIni: 'SP',
      ufFim: 'MT',
      carregamento: [{ cMun: '3550308', xMun: 'SAO PAULO' }],
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA', nfe: [{ chave: chaveDoc(9) }] }],
    });
    const r = await s.client.autorizar((await s.emitir(volta)).xml);
    expect(r.status === 'rejected' && r.cStat).toBe('662');
  });

  test('686: MDF-e aberto há mais de 30 dias bloqueia o emitente', async () => {
    const s = cenario({ regrasMdfeDesligadas: ['F85', 'F87'] });
    await s.autorizado();
    s.clock.advance(31 * 24 * HORA);
    const r = await s.client.autorizar(
      (
        await s.emitir(
          mesmaPlaca({
            ufFim: 'GO',
            percurso: [],
            descarregamentos: [{ cMun: '5208707', xMun: 'GOIANIA', nfe: [{ chave: chaveDoc(9) }] }],
          }),
        )
      ).xml,
    );
    expect(r.status === 'rejected' && r.cStat).toBe('686');
  });
});

describe('eventos', () => {
  test('CPF cujo 000 + CPF também forma CNPJ válido: o autor dos eventos sai como CPF (série 920 a 969)', async () => {
    const ambiguo = '00123456797';
    const ac = await syntheticCertificate({ clock: manualClock(EMISSAO), role: 'ac' });
    const cert = await syntheticCertificate({ clock: manualClock(EMISSAO), role: 'titular', cpf: ambiguo, issuer: ac });
    const s = cenario({}, cert);
    const base = cargaPropria();
    const e = base.emitente;
    const a = await s.autorizado({
      ...base,
      emitente: { CPF: ambiguo, IE: e.IE, xNome: e.xNome, endereco: e.endereco },
    });
    const r = await s.client.cancelar({ chave: a.chave, nProt: a.nProt, xJust: 'VIAGEM NAO REALIZADA TESTE' });
    expect(r.status === 'authorized' && r.cStat).toBe('135');
    expect(r.status === 'authorized' && r.value.procEventoMDFe).toContain(`<CPF>${ambiguo}</CPF>`);
  }, 30_000);

  test('encerramento pelo transportador terceiro: o proprietário do veículo assina e é o autor (NT 2024.001)', async () => {
    const s = cenario();
    const base = cargaPropria();
    const tracao = {
      ...base.rodoviario.tracao,
      proprietario: { CNPJ: CNPJ_TERCEIRO, RNTRC: '87654321', xNome: 'TRANSPORTADOR TERCEIRO', tpProp: '2' as const },
    };
    const contratantes = [{ xNome: 'PRODUTOR', CPF: CPF_EMIT }];
    const rodoviario = {
      ...base.rodoviario,
      tracao,
      contratantes,
      ciot: [{ CIOT: '123456789012', CNPJ: CNPJ_TERCEIRO }],
    };
    const a = await s.autorizado({ ...base, tpTransp: '1', rodoviario });
    const pedido = { chave: a.chave, nProt: a.nProt, uf: 'SP', cMun: '3550308' };
    // O emitente não pode se declarar terceiro (K11).
    await expect(s.client.encerrar({ ...pedido, terceiro: { CPF: CPF_EMIT } })).rejects.toThrow(/K11/);
    const r = await s.cliente(c.terceiro).encerrar({ ...pedido, terceiro: { CNPJ: CNPJ_TERCEIRO } });
    expect(r.status === 'authorized' && r.cStat).toBe('135');
    expect(r.status === 'authorized' && r.value.procEventoMDFe).toContain('<indEncPorTerceiro>1</indEncPorTerceiro>');
    expect(s.sim.inspect.mdfe(a.chave)?.situacao).toBe('encerrado');
  });

  test('cancelamento no prazo (101 na consulta); fora do prazo 220; protocolo errado 222', async () => {
    const s = cenario();
    const a = await s.autorizado();
    const errado = await s.client.cancelar({
      chave: a.chave,
      nProt: '951260000009999',
      xJust: 'JUSTIFICATIVA SINTETICA DE TESTE',
    });
    expect(errado.status === 'rejected' && errado.cStat).toBe('222');
    s.clock.advance(HORA);
    const r = await s.client.cancelar({ chave: a.chave, nProt: a.nProt, xJust: 'JUSTIFICATIVA SINTETICA DE TESTE' });
    if (r.status !== 'authorized') throw new Error(JSON.stringify(r));
    expect(r.value.procEventoMDFe).toContain('<evCancMDFe><descEvento>Cancelamento</descEvento>');
    const q = await s.client.consultar(a.chave);
    expect(q.status === 'authorized' && q.cStat).toBe('101');
    expect(q.status === 'authorized' && q.value.eventos.length).toBe(1);
    const enc = await s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'SP', cMun: '3550308' });
    expect(enc.status === 'rejected' && enc.cStat).toBe('218');

    const b = await s.autorizado(cargaPropria({ nMDF: 3 }));
    s.clock.advance(25 * HORA);
    const tarde = await s.client.cancelar({
      chave: b.chave,
      nProt: b.nProt,
      xJust: 'JUSTIFICATIVA SINTETICA DE TESTE',
    });
    expect(tarde.status === 'rejected' && tarde.cStat).toBe('220');
    expect(tarde.status === 'rejected' && tarde.hint?.suggestedFix).toContain('encerre');
  });

  test('recuperarEventoRegistrado: cancelamento sem resposta confirmado pela consulta, nunca pelo cStat', async () => {
    const s = cenario();
    const a = await s.autorizado(cargaPropria({ nMDF: 41 }));
    const antes = await recuperarEventoRegistrado(s.client, a.chave, '110111');
    expect([antes.registrado, antes.consulta.cStat]).toEqual([false, '100']);
    s.clock.advance(HORA);
    s.sim.injectFault({ kind: 'hang', phase: 'after' }, { servico: 'MDFeRecepcaoEvento' });
    const curto = s.cliente(c.produtor, 300);
    const pedido = { chave: a.chave, nProt: a.nProt, xJust: 'JUSTIFICATIVA SINTETICA DE TESTE' };
    expect(await curto.cancelar(pedido).catch((e: unknown) => e)).toBeInstanceOf(TimeoutError);
    const rec = await recuperarEventoRegistrado(s.client, a.chave, '110111');
    if (!rec.registrado) throw new Error('evento não recuperado');
    expect([rec.evento.chMDFe, rec.evento.tpEvento, rec.evento.nSeqEvento]).toEqual([a.chave, '110111', '1']);
    expect(rec.evento.nProt).toMatch(/^[0-9]{15}$/);
    expect(rec.evento.procEventoMDFe).toContain('<evCancMDFe><descEvento>Cancelamento</descEvento>');
    expect(rec.evento.retEventoMDFe).toContain('<cStat>135</cStat>');
    expect(rec.consulta.status === 'authorized' && rec.consulta.value.situacao).toBe('cancelado');
    // O pedido de novo é recusado; a recuperação continua devolvendo o mesmo evento.
    expect((await s.client.cancelar(pedido)).status).toBe('rejected');
    const outra = await recuperarEventoRegistrado(s.client, a.chave, '110111');
    expect(outra.registrado && outra.evento.procEventoMDFe).toBe(rec.evento.procEventoMDFe);
    expect((await recuperarEventoRegistrado(s.client, a.chave, '110112')).registrado).toBe(false);
    const inedito = await s.emitir(cargaPropria({ nMDF: 42 }));
    const nada = await recuperarEventoRegistrado(s.client, inedito.chave, '110111');
    expect([nada.registrado, nada.consulta.status]).toEqual([false, 'rejected']);
  });

  test('encerramento: 132 na consulta, depois 631 e 609; município e UF conferidos antes de enviar', async () => {
    const s = cenario();
    const a = await s.autorizado();
    await expect(s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'SP', cMun: '5103403' })).rejects.toThrow(
      '614',
    );
    await expect(s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'EX', cMun: '3550308' })).rejects.toThrow(
      '689',
    );
    const antes = await s.client.encerrar({
      chave: a.chave,
      nProt: a.nProt,
      uf: 'SP',
      cMun: '3550308',
      dtEnc: '2026-09-25',
    });
    expect(antes.status === 'rejected' && antes.cStat).toBe('615');
    const r = await s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'SP', cMun: '3550308' });
    expect(r.status === 'authorized' && r.value.xEvento).toBe('Encerramento');
    const q = await s.client.consultar(a.chave);
    expect(q.status === 'authorized' && q.value.situacao).toBe('encerrado');
    // O mesmo evento de novo cai na duplicidade (J08, 631), que o MOC confere antes das regras do tipo (K09, 609).
    const deNovo = await s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'SP', cMun: '3550308' });
    expect(deNovo.status === 'rejected' && deNovo.cStat).toBe('631');
    const canc = await s.client.cancelar({ chave: a.chave, nProt: a.nProt, xJust: 'JUSTIFICATIVA SINTETICA DE TESTE' });
    expect(canc.status === 'rejected' && canc.cStat).toBe('609');
  });

  test('inclusão de condutor: sequencial, duplicidade (631) e CPF conferido antes de enviar', async () => {
    const s = cenario();
    const a = await s.autorizado();
    const condutor = { xNome: 'SEGUNDO CONDUTOR', CPF: CPF_EMIT };
    const r = await s.client.incluirCondutor({ chave: a.chave, nSeqEvento: 1, condutor });
    expect(r.status).toBe('authorized');
    const dup = await s.client.incluirCondutor({ chave: a.chave, nSeqEvento: 1, condutor });
    expect(dup.status === 'rejected' && dup.cStat).toBe('631');
    expect((await s.client.incluirCondutor({ chave: a.chave, nSeqEvento: 2, condutor })).status).toBe('authorized');
    await expect(
      s.client.incluirCondutor({ chave: a.chave, nSeqEvento: 3, condutor: { ...condutor, CPF: '1' } }),
    ).rejects.toThrow('645');
    await expect(s.client.incluirCondutor({ chave: a.chave, nSeqEvento: 100, condutor })).rejects.toThrow('K01');
  });

  test('inclusão de DF-e no carregamento posterior; encerrar sem inclusão é 715; MDF-e comum é 708', async () => {
    const s = cenario();
    const posterior = cargaPropria({
      indCarregaPosterior: true,
      ufFim: 'MT',
      percurso: [],
      descarregamentos: [{ cMun: '5103403', xMun: 'CUIABA' }],
    });
    const a = await s.autorizado(posterior);
    const enc = await s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'MT', cMun: '5103403' });
    expect(enc.status === 'rejected' && enc.cStat).toBe('715');
    const pedido = {
      chave: a.chave,
      nProt: a.nProt,
      nSeqEvento: 1,
      carregamento: { cMun: '5103403', xMun: 'CUIABA' },
      documentos: [{ cMunDescarga: '5108402', xMunDescarga: 'VARZEA GRANDE', chNFe: chaveDoc(1) }],
    };
    expect((await s.client.incluirDFe(pedido)).status).toBe('authorized');
    const repetida = await s.client.incluirDFe({ ...pedido, nSeqEvento: 2 });
    expect(repetida.status === 'rejected' && repetida.cStat).toBe('711');
    expect((await s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'MT', cMun: '5108402' })).status).toBe(
      'authorized',
    );

    const comum = await s.autorizado(
      cargaPropria({
        nMDF: 7,
        rodoviario: { ...cargaPropria().rodoviario, tracao: { ...cargaPropria().rodoviario.tracao, placa: 'GHI3J45' } },
      }),
    );
    const r = await s.client.incluirDFe({ ...pedido, chave: comum.chave, nProt: comum.nProt });
    expect(r.status === 'rejected' && r.cStat).toBe('708');
  });

  test('pagamento da operação: TAC agregado (135) e sem proprietário TAC agregado (723)', async () => {
    const s = cenario({}, c.transportadora);
    const prop = { CPF: CPF_CONDUTOR, RNTRC: '87654321', xNome: 'TAC AGREGADO SINTETICO', tpProp: '0' as const };
    const base = prestador();
    const comTac: MdfeInput = {
      ...base,
      tpTransp: '2',
      rodoviario: {
        ...base.rodoviario,
        tracao: { ...base.rodoviario.tracao, proprietario: prop },
        contratantes: [{ CNPJ: CNPJ_EMIT }],
      },
    };
    const a = await s.autorizado(comTac);
    const pagamentos = [
      {
        CPF: CPF_CONDUTOR,
        componentes: [{ tpComp: '04' as const, vComp: '1500.00' }],
        indPag: '0' as const,
        banco: { PIX: 'pix-tac@exemplo.invalid' },
      },
    ];
    const r = await s.client.pagamentoOperacao({
      chave: a.chave,
      nProt: a.nProt,
      qtdViagens: 1,
      nroViagem: 1,
      pagamentos,
    });
    expect(r.status === 'authorized' && r.value.tpEvento).toBe('110116');
    const b = await s.autorizado({
      ...base,
      nMDF: 11,
      rodoviario: { ...base.rodoviario, tracao: { ...base.rodoviario.tracao, placa: 'JKL4M56' } },
    });
    const sem = await s.client.pagamentoOperacao({
      chave: b.chave,
      nProt: b.nProt,
      qtdViagens: 1,
      nroViagem: 1,
      pagamentos,
    });
    expect(sem.status === 'rejected' && sem.cStat).toBe('723');
    await expect(
      s.client.pagamentoOperacao({
        chave: b.chave,
        nProt: b.nProt,
        qtdViagens: 1,
        nroViagem: 1,
        pagamentos: [{ ...pagamentos[0], indPag: '1' as const }] as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('signal', () => {
  test('todo método que vai à rede repassa o signal: abortado, recusa sem chegar à SEFAZ', async () => {
    const s = cenario();
    const a = await s.autorizado();
    const ac = new AbortController();
    ac.abort(new Error('parou'));
    const signal = ac.signal;
    const pagamentos = [
      {
        CPF: CPF_CONDUTOR,
        componentes: [{ tpComp: '04' as const, vComp: '1500.00' }],
        indPag: '0' as const,
        banco: { PIX: 'pix-tac@exemplo.invalid' },
      },
    ];
    const chamadas: readonly (readonly [string, () => Promise<unknown>])[] = [
      ['statusServico', () => s.client.statusServico({ signal })],
      ['autorizar', async () => s.client.autorizar((await s.emitir(cargaPropria({ nMDF: 9 }))).xml, { signal })],
      ['consultar', () => s.client.consultar(a.chave, undefined, { signal })],
      ['consultarNaoEncerrados', () => s.client.consultarNaoEncerrados(undefined, { signal })],
      [
        'cancelar',
        () => s.client.cancelar({ chave: a.chave, nProt: a.nProt, xJust: 'JUSTIFICATIVA SINTETICA' }, { signal }),
      ],
      ['encerrar', () => s.client.encerrar({ chave: a.chave, nProt: a.nProt, uf: 'SP', cMun: '3550308' }, { signal })],
      [
        'incluirCondutor',
        () =>
          s.client.incluirCondutor(
            { chave: a.chave, nSeqEvento: 1, condutor: { xNome: 'SEGUNDO CONDUTOR', CPF: CPF_EMIT } },
            { signal },
          ),
      ],
      [
        'incluirDFe',
        () =>
          s.client.incluirDFe(
            {
              chave: a.chave,
              nProt: a.nProt,
              nSeqEvento: 1,
              carregamento: { cMun: '5103403', xMun: 'CUIABA' },
              documentos: [{ cMunDescarga: '5108402', xMunDescarga: 'VARZEA GRANDE', chNFe: chaveDoc(1) }],
            },
            { signal },
          ),
      ],
      [
        'pagamentoOperacao',
        () =>
          s.client.pagamentoOperacao(
            { chave: a.chave, nProt: a.nProt, qtdViagens: 1, nroViagem: 1, pagamentos },
            { signal },
          ),
      ],
    ];
    for (const [nome, chamar] of chamadas) {
      const erro = await chamar().catch((e: unknown) => e);
      expect([nome, erro]).toMatchObject([nome, { code: 'cancelado', cause: signal.reason }]);
    }
    expect(s.sim.inspect.mdfes()).toHaveLength(1);
    expect(s.sim.inspect.mdfe(a.chave)?.situacao).toBe('autorizado');
  });
});
