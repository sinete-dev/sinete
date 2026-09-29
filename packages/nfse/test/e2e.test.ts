/**
 * Ponta a ponta: o `@sinete/nfse` contra a NFS-e simulada do `@sinete/sefaz-sim`, pelo `@sinete/transport` real em
 * HTTPS com mTLS. O cliente resolve as bases pelos dados do transporte (`nfseEndpoint`), como em produção; o
 * `redirectNfseToSim` troca só a origem. Nenhum pedido sai da máquina.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { isRejected, TimeoutError, timeContext, unwrapAuthorized } from '@sinete/core';
import { verifySignature } from '@sinete/core/xml';
import { validateRoot } from '@sinete/schemas';
import { eventoElement, NFSeElement } from '@sinete/schemas/nfse/1.01-20260727';
import type { NfseRejeicao } from '../src/index.ts';
import { buildDps, createNfseClient, parseChaveNfse, resolverEnvioSemResposta, signDps } from '../src/index.ts';
import type { Cenario, Certs } from './helpers.ts';
import { cenario, dps, gerarCerts, PRESTADOR, SAO_PAULO, TOMADOR } from './helpers.ts';

let c: Certs;
const abertos: Cenario[] = [];

beforeAll(async () => {
  c = await gerarCerts();
}, 60_000);

afterEach(async () => {
  for (const s of abertos.splice(0)) await s.close();
});

async function novo(o?: Parameters<typeof cenario>[1]): Promise<Cenario> {
  const s = await cenario(c, o);
  abertos.push(s);
  return s;
}

describe('emissão', () => {
  test('DPS assinada vira NFS-e: chave, DPS embutida sem reserializar, assinatura da Sefin e XSD', async () => {
    const s = await novo();
    const assinada = await s.assinar(dps());
    const r = await s.client.autorizar(assinada);
    expect(r.status).toBe('authorized');
    const v = unwrapAuthorized(r);
    expect(r.cStat).toBe('100');
    expect(r.xMotivo).toBe('NFS-e Gerada');
    const ch = parseChaveNfse(v.chaveAcesso);
    expect(ch).toMatchObject({
      cMun: SAO_PAULO,
      ambGer: '2',
      tpInsc: '2',
      inscricao: PRESTADOR,
      nNFSe: '0000000000001',
    });
    expect(v.idDps).toBe(`DPS${SAO_PAULO}2${PRESTADOR}00001000000000000001`);
    // A DPS assinada entra na NFS-e byte a byte (sem a declaração XML).
    expect(v.xml).toContain(assinada.replace('<?xml version="1.0" encoding="UTF-8"?>', ''));
    expect(validateRoot(NFSeElement, v.xml)).toEqual([]);
    const assinaturas = await Promise.all([
      verifySignature(v.xml, { id: `NFS${v.chaveAcesso}`, element: 'infNFSe' }),
      verifySignature(v.xml, { id: v.idDps, element: 'infDPS' }),
    ]);
    expect(assinaturas.map((a) => a.ok)).toEqual([true, true]);
    expect(v.nfse.infNFSe.valores).toMatchObject({
      vBC: '1500.00',
      pAliqAplic: '2.00',
      vISSQN: '30.00',
      vLiq: '1500.00',
    });
    expect(v.nfse.infNFSe.cLocIncid).toBe(SAO_PAULO);
    expect(v.nNFSe).toBe('1');
    expect(v.alertas).toEqual([]);
    expect(s.caminhos).toEqual(['POST /sefin/nfse']);
    // Consulta pela chave e pela DPS.
    const lida = await s.client.consultar(v.chaveAcesso);
    expect(lida?.xml).toBe(v.xml);
    expect(await s.client.consultarDps(v.idDps)).toEqual({ idDps: v.idDps, chaveAcesso: v.chaveAcesso });
    expect(await s.client.consultarDps(`DPS${SAO_PAULO}2${PRESTADOR}00001000000000000099`)).toBeUndefined();
  });

  test('IBS/CBS: a DPS leva a classificação e a NFS-e traz os valores calculados pela Sefin', async () => {
    const s = await novo();
    const r = await s.client.autorizar(
      await s.assinar(
        dps({
          ibsCbs: {
            cIndOp: '100301',
            indDest: '0',
            classificacao: { CST: '000', cClassTrib: '000001' },
          },
        }),
      ),
    );
    const v = unwrapAuthorized(r);
    expect(v.xml).toContain('<IBSCBS><finNFSe>0</finNFSe><cIndOp>100301</cIndOp>');
    expect(v.nfse.infNFSe.IBSCBS?.totCIBS).toMatchObject({ gCBS: { vCBS: '13.50' }, gIBS: { vIBSTot: '1.50' } });
  });

  test('rejeição de regra municipal (E0312) com o catálogo do Anexo I', async () => {
    const s = await novo();
    const r = await s.client.autorizar(await s.assinar(dps({ servico: { ...dps().servico, cTribNac: '17.01.01' } })));
    expect(isRejected(r)).toBe(true);
    const rej = r as NfseRejeicao;
    expect(rej.cStat).toBe('E0312');
    expect(rej.httpStatus).toBe(400);
    expect(rej.erros[0]?.catalogo?.nivel).toBe('3');
    expect(rej.hint?.source).toContain('Anexo I');
    expect(() => unwrapAuthorized(r)).toThrow('E0312');
  });

  test('DPS sem declaração UTF-8 é recusada antes do envio; a mesma DPS assinada por outro CNPJ volta E0718', async () => {
    const s = await novo();
    const assinada = await s.assinar(dps());
    await expect(s.client.autorizar(assinada.replace(/^<\?xml[^>]*>/, ''))).rejects.toThrow('E1229');
    const r = await s.client.autorizar(await s.assinar(dps(), c.outro));
    expect(r.cStat).toBe('E0718');
    expect(s.caminhos).toHaveLength(1);
  });

  test('duplicidade (E0014) e envio sem resposta resolvido pela consulta da DPS', async () => {
    const s = await novo();
    const assinada = await s.assinar(dps({ nDPS: '7' }));
    s.sim.injectFault({ kind: 'drop', phase: 'after' }, { rota: 'emitir' });
    await expect(s.client.autorizar(assinada)).rejects.toThrow();
    const res = await resolverEnvioSemResposta(s.client, assinada);
    expect(res.acao).toBe('concluida');
    if (res.acao === 'concluida')
      expect([res.outcome.status, res.outcome.value.idDps]).toEqual([
        'authorized',
        res.nfse.nfse.infNFSe.DPS.infDPS.Id,
      ]);
    const dup = await s.client.autorizar(assinada);
    expect(dup.cStat).toBe('E0014');
    // Pedido que não chegou: reenviar os mesmos bytes.
    const outra = await s.assinar(dps({ nDPS: '8' }));
    s.sim.injectFault({ kind: 'hang', phase: 'before' }, { rota: 'emitir' });
    const cliente = createNfseClient({
      transport: s.transport,
      ambiente: 'homologacao',
      clock: s.clock,
      timeoutMs: 300,
    });
    await expect(cliente.autorizar(outra)).rejects.toBeInstanceOf(TimeoutError);
    expect(await resolverEnvioSemResposta(s.client, outra)).toEqual({ acao: 'reenviar', dpsAssinada: outra });
    expect((await s.client.autorizar(outra)).status).toBe('authorized');
  });

  test('DPS de produção num cliente de homologação é erro de configuração', async () => {
    const s = await novo();
    const r = buildDps(dps(), { ambiente: 'producao', time: timeContext({ emissao: s.clock }) });
    if (!r.ok) throw new Error('montagem');
    const assinada = await signDps(r.value, c.prestador.signer);
    await expect(s.client.autorizar(assinada)).rejects.toThrow('tpAmb 1');
  });
});

describe('eventos e substituição', () => {
  test('cancelamento (e101101), consulta de eventos e cancelamento repetido (E0840)', async () => {
    const s = await novo();
    const v = unwrapAuthorized(await s.client.autorizar(await s.assinar(dps())));
    s.clock.advance(3_600_000);
    const r = await s.client.cancelar({
      chave: v.chaveAcesso,
      autor: { CNPJ: PRESTADOR },
      cMotivo: '1',
      xMotivo: 'Erro na emissão da nota de teste',
    });
    const ev = unwrapAuthorized(r);
    expect(ev).toMatchObject({ chaveAcesso: v.chaveAcesso, tpEvento: '101101', nSeqEvento: '1' });
    expect(validateRoot(eventoElement, ev.xml)).toEqual([]);
    const lista = await s.client.consultarEventos(v.chaveAcesso, { tpEvento: '101101', nSeqEvento: 1 });
    expect(lista.map((e) => [e.tpEvento, e.nSeqEvento, e.id])).toEqual([['101101', '1', ev.id]]);
    expect(lista[0]?.xml).toBe(ev.xml);
    expect(await s.client.consultarEventos(v.chaveAcesso, { tpEvento: '101101', nSeqEvento: 2 })).toEqual([]);
    expect(await s.client.consultarEventos(v.chaveAcesso, { tpEvento: '105102', nSeqEvento: 1 })).toEqual([]);
    const de_novo = await s.client.cancelar({
      chave: v.chaveAcesso,
      autor: { CNPJ: PRESTADOR },
      cMotivo: '9',
      xMotivo: 'Segunda tentativa de cancelamento',
    });
    expect(de_novo.cStat).toBe('E0840');
    expect(de_novo.xMotivo).toContain('Cancelamento de NFS-e');
  });

  test('prazo de cancelamento do município (E0822)', async () => {
    const s = await novo();
    const v = unwrapAuthorized(await s.client.autorizar(await s.assinar(dps())));
    s.clock.advance(31 * 86_400_000);
    const r = await s.client.cancelar({
      chave: v.chaveAcesso,
      autor: { CNPJ: PRESTADOR },
      cMotivo: '2',
      xMotivo: 'Servico nao prestado ao tomador',
    });
    expect(r.cStat).toBe('E0822');
    const analise = await s.client.solicitarAnaliseFiscal({
      chave: v.chaveAcesso,
      autor: { CNPJ: PRESTADOR },
      cMotivo: '2',
      xMotivo: 'Servico nao prestado ao tomador',
    });
    expect(unwrapAuthorized(analise).tpEvento).toBe('101103');
  });

  test('substituição: a Sefin gera a nova NFS-e e registra o e105102 na substituída', async () => {
    const s = await novo();
    const v = unwrapAuthorized(await s.client.autorizar(await s.assinar(dps())));
    await expect(s.client.substituir(await s.assinar(dps({ nDPS: '2' })))).rejects.toThrow('subst');
    const nova = unwrapAuthorized(
      await s.client.substituir(
        await s.assinar(
          dps({
            nDPS: '2',
            substituicao: { chSubstda: v.chaveAcesso, cMotivo: '99', xMotivo: 'Correcao do valor do servico' },
          }),
        ),
      ),
    );
    const eventos = await s.client.consultarEventos(v.chaveAcesso, { tpEvento: '105102', nSeqEvento: 1 });
    expect(eventos.map((e) => e.tpEvento)).toEqual(['105102']);
    expect(eventos[0]?.xml).toContain(`<chSubstituta>${nova.chaveAcesso}</chSubstituta>`);
    const cancelar = await s.client.cancelar({
      chave: v.chaveAcesso,
      autor: { CNPJ: PRESTADOR },
      cMotivo: '1',
      xMotivo: 'Cancelar a substituida nao pode',
    });
    expect(cancelar.cStat).toBe('E0840');
    const outraVez = await s.client.substituir(
      await s.assinar(
        dps({
          nDPS: '3',
          substituicao: { chSubstda: v.chaveAcesso, cMotivo: '99', xMotivo: 'Terceira nota para a mesma substituida' },
        }),
      ),
    );
    expect(outraVez.cStat).toBe('E0046');
  });
});

describe('parâmetros municipais', () => {
  test('convênio, alíquota vigente e histórico com código de 9 dígitos, e o cache evita a segunda consulta', async () => {
    const s = await novo();
    const conv = await s.client.parametros.convenio(SAO_PAULO);
    expect(conv).toMatchObject({ aderenteAmbienteNacional: true, aderenteEmissorNacional: true, aderenteMAN: false });
    expect(conv?.permiteAproveitamentoDeCreditos).toBe(true);
    expect(await s.client.parametros.aliquota(SAO_PAULO, '010101', '2026-09-25')).toEqual([
      { incidencia: 'SIM', aliquota: '2.00', inicio: '2026-01-01', fim: undefined },
    ]);
    expect(await s.client.parametros.aliquota(SAO_PAULO, '01.01.01', '2026-09-25')).toHaveLength(1);
    expect(await s.client.parametros.aliquota(SAO_PAULO, '17.01.01.000', '2026-09-25')).toBeUndefined();
    expect(await s.client.parametros.historicoAliquotas(SAO_PAULO, '17.01.01')).toEqual([
      { incidencia: 'SIM', aliquota: '5.00', inicio: '2025-03-17', fim: '2025-03-17' },
    ]);
    expect((await s.client.parametros.regimesEspeciais(SAO_PAULO, '01.01.01', '2026-09-25'))?.dados).toEqual({
      regimesEspeciais: [{ codigo: 1 }],
    });
    expect((await s.client.parametros.retencoes(SAO_PAULO, '2026-09-25'))?.mensagem).toContain('sucesso');
    expect(await s.client.parametros.beneficio(SAO_PAULO, '12345678901234', '2026-09-25')).toBeDefined();
    expect(await s.client.parametros.convenio('9999999')).toBeUndefined();
    await s.client.parametros.convenio(SAO_PAULO);
    const convenios = s.caminhos.filter((p) => p.endsWith('/convenio'));
    expect(convenios).toEqual([`GET /parametrizacao/${SAO_PAULO}/convenio`, 'GET /parametrizacao/9999999/convenio']);
    expect(s.caminhos).toContain(`GET /parametrizacao/${SAO_PAULO}/01.01.01.000/2026-09-25/aliquota`);
    // Vencido o prazo, consulta de novo.
    s.clock.advance(7 * 3_600_000);
    await s.client.parametros.convenio(SAO_PAULO);
    expect(s.caminhos.filter((p) => p.endsWith(`${SAO_PAULO}/convenio`))).toHaveLength(2);
  });

  test('município sem convênio ativo recusa a DPS (E0038) e município desconhecido (E0037)', async () => {
    const s = await novo();
    const r = await s.client.autorizar(await s.assinar(dps({ cLocEmi: '3509502' })));
    expect(r.cStat).toBe('E0038');
    const r2 = await s.client.autorizar(await s.assinar(dps({ cLocEmi: '3304557', nDPS: '2' })));
    expect(r2.cStat).toBe('E0037');
    expect(TOMADOR).toHaveLength(14);
  });
});
