/**
 * Unidades: valores, códigos e identificadores, montagem da DPS e do pedido de evento, gzip e leitura das respostas.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import {
  contextoDeTempo,
  ErroDeConfiguracao,
  ErroNaoSuportado,
  ErroRespostaInvalida,
  formatarVerProc,
  relogioFixo,
} from '@sinete/core';
import { codificarBase64 } from '@sinete/core/xml';
import { gunzipBase64Duplo } from '../src/gzip.ts';
import {
  codigoServicoParametrizacao,
  comprimirGzipBase64,
  cTribNacDps,
  descomprimirGzipBase64,
  formatarValor,
  idDps,
  idPedidoEvento,
  inscricaoId,
  leiauteVigente,
  lerChaveNfse,
  montarDps,
  montarPedidoAnaliseFiscal,
  montarPedidoCancelamento,
} from '../src/index.ts';
import { documentosCompactados, documentosDosEventos, lerJson, mensagens, rejeicao } from '../src/respostas.ts';
import { VERSAO_PACOTE } from '../src/versao-gerada.ts';
import { cpf, dps, PRESTADOR, PRESTADOR_CPF, SAO_PAULO, TOMADOR } from './helpers.ts';

const time = contextoDeTempo({ emissao: relogioFixo('2026-09-25T10:00:00-03:00') });
const RESTO = `${'1'.padStart(13, '0')}2609${'1'.padStart(9, '0')}7`;
const CHAVE = `${SAO_PAULO}22${PRESTADOR}${RESTO}`;

describe('valores', () => {
  test('texto e número viram 2 casas; o resto é ocorrência', () => {
    const issues: Ocorrencia[] = [];
    expect(formatarValor('1500', 'v', issues)).toBe('1500.00');
    expect(formatarValor('007.5', 'v', issues)).toBe('7.50');
    expect(formatarValor('2.500', 'v', issues)).toBe('2.50');
    expect(formatarValor(0.1 + 0.2, 'v', issues)).toBe('0.30');
    expect(formatarValor(12, 'v', issues)).toBe('12.00');
    expect(issues).toEqual([]);
    expect(formatarValor(1.005, 'a', issues)).toBeUndefined();
    expect(formatarValor(-1, 'b', issues)).toBeUndefined();
    expect(formatarValor(Number.NaN, 'c', issues)).toBeUndefined();
    expect(formatarValor('1,50', 'd', issues)).toBeUndefined();
    expect(formatarValor('1.505', 'e', issues)).toBeUndefined();
    expect(issues.map((i) => `${i.caminho}:${i.code}`)).toEqual([
      'a:valor_casas',
      'b:valor_invalido',
      'c:valor_invalido',
      'd:valor_invalido',
      'e:valor_casas',
    ]);
  });
});

describe('códigos e identificadores', () => {
  test('cTribNac, código da parametrização e inscrição', () => {
    expect(cTribNacDps('01.01.01')).toBe('010101');
    expect(cTribNacDps(' 170101 ')).toBe('170101');
    expect(() => cTribNacDps('1.01.01')).toThrow(ErroDeConfiguracao);
    expect(codigoServicoParametrizacao('010101')).toBe('01.01.01.000');
    expect(codigoServicoParametrizacao('01.01.01', '002')).toBe('01.01.01.002');
    expect(() => codigoServicoParametrizacao('010101', '2')).toThrow(ErroDeConfiguracao);
    expect(inscricaoId({ CPF: PRESTADOR_CPF })).toEqual({ tpInsc: '1', inscricao: `000${PRESTADOR_CPF}` });
    expect(inscricaoId({ CNPJ: '12ABC34501DE35' })).toEqual({ tpInsc: '2', inscricao: '12ABC34501DE35' });
    expect(() => inscricaoId({ CNPJ: '123' })).toThrow(ErroDeConfiguracao);
    expect(() => inscricaoId({ CPF: '123' })).toThrow(ErroDeConfiguracao);
  });

  test('Id da DPS, chave e Id do pedido de evento', () => {
    expect(idDps({ cLocEmi: SAO_PAULO, emitente: { CNPJ: PRESTADOR }, serie: '1', nDPS: '42' })).toBe(
      `DPS${SAO_PAULO}2${PRESTADOR}00001000000000000042`,
    );
    expect(() => idDps({ cLocEmi: '355', emitente: { CNPJ: PRESTADOR }, serie: '1', nDPS: '1' })).toThrow('cLocEmi');
    expect(() => idDps({ cLocEmi: SAO_PAULO, emitente: { CNPJ: PRESTADOR }, serie: 'A', nDPS: '1' })).toThrow('série');
    expect(() => idDps({ cLocEmi: SAO_PAULO, emitente: { CNPJ: PRESTADOR }, serie: '1', nDPS: 'x' })).toThrow('nDPS');
    expect(lerChaveNfse(CHAVE)).toMatchObject({ tpInsc: '2', inscricao: PRESTADOR, anoMes: '2609', dv: '7' });
    const comCpf = `${SAO_PAULO}21000${PRESTADOR_CPF}${RESTO}`;
    expect(lerChaveNfse(comCpf).inscricao).toBe(PRESTADOR_CPF);
    expect(() => lerChaveNfse(`${SAO_PAULO}21123${PRESTADOR_CPF}${RESTO}`)).toThrow('CPF');
    expect(() => lerChaveNfse('123')).toThrow(ErroDeConfiguracao);
    expect(idPedidoEvento(CHAVE, '101101')).toBe(`PRE${CHAVE}101101`);
    expect(() => idPedidoEvento(CHAVE, '1011')).toThrow('evento');
  });

  test('leiaute vigente pela data e pelo ambiente', () => {
    expect(leiauteVigente('producao', relogioFixo('2026-08-01T12:00:00-03:00')).vigencia.modulo).toBe(
      'nfse/1.01-20260209',
    );
    expect(leiauteVigente('homologacao', relogioFixo('2026-09-25T12:00:00-03:00')).leiaute.schema.pl).toBe(
      'NFSe_v1.01_20260727',
    );
  });
});

describe('montarDps', () => {
  test('DPS completa: declaração UTF-8, Id, competência padrão, grupos opcionais e IBS/CBS', async () => {
    const r = await montarDps(
      dps({
        nDPS: 123n,
        serie: 2,
        intermediario: { CPF: cpf('987654321'), xNome: 'INTERMEDIARIO' },
        servico: {
          local: { cLocPrestacao: SAO_PAULO },
          cTribNac: '010101',
          cTribMun: '001',
          xDescServ: 'Servico',
          cIntContrib: 'X1',
          infoCompl: { xInfComp: 'informacao' },
        },
        valores: { vServ: 1000, vReceb: '900', vDescIncond: '10', vDescCond: '5' },
        tributacao: {
          issqn: { tribISSQN: '1', tpRetISSQN: '2', pAliq: '2' },
          federal: { vRetIRRF: '15.00' },
          totTrib: { pTotTribSN: '6.00' },
        },
        ibsCbs: {
          finNFSe: '0',
          indFinal: '1',
          cIndOp: '100301',
          tpOper: '1',
          refNFSe: [CHAVE],
          tpEnteGov: '1',
          indDest: '1',
          destinatario: { CNPJ: TOMADOR, xNome: 'DEST' },
          classificacao: {
            CST: '000',
            cClassTrib: '000001',
            cCredPres: '01',
            tributacaoRegular: { CSTReg: '000', cClassTribReg: '000001' },
            diferimento: { pDifUF: '10', pDifMun: 10, pDifCBS: '0' },
          },
        },
      }),
      { ambiente: 'homologacao', tempo: time, verAplic: 'app-teste', deslocamentoMin: -240 },
    );
    if (!r.ok) throw new Error(JSON.stringify(r.ocorrencias));
    const x = r.valor.xml;
    expect(
      x.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">',
      ),
    ).toBe(true);
    expect(r.valor.id).toBe(`DPS${SAO_PAULO}2${PRESTADOR}00002000000000000123`);
    expect(r.valor.dhEmi).toBe('2026-09-25T09:00:00-04:00');
    expect(r.valor.dCompet).toBe('2026-09-25');
    expect(x).toContain('<verAplic>app-teste</verAplic>');
    expect(x).toContain('<vServPrest><vReceb>900.00</vReceb><vServ>1000.00</vServ></vServPrest>');
    expect(x).toContain(
      '<vDescCondIncond><vDescIncond>10.00</vDescIncond><vDescCond>5.00</vDescCond></vDescCondIncond>',
    );
    expect(x).toContain('<pAliq>2.00</pAliq>');
    expect(x).toContain('<gDif><pDifUF>10.00</pDifUF><pDifMun>10.00</pDifMun><pDifCBS>0.00</pDifCBS></gDif>');
    expect(x).toContain(`<gRefNFSe><refNFSe>${CHAVE}</refNFSe></gRefNFSe>`);
  });

  test('verAplic padrão é "sinete <versão do pacote>"; override explícito prevalece', async () => {
    const padrao = await montarDps(dps(), { ambiente: 'homologacao', tempo: time });
    const esperado = formatarVerProc('sinete', VERSAO_PACOTE);
    expect(padrao.ok && padrao.valor.xml).toContain(`<verAplic>${esperado}</verAplic>`);
    expect(esperado.length).toBeLessThanOrEqual(20);

    const override = await montarDps(dps(), { ambiente: 'homologacao', tempo: time, verAplic: 'app-teste' });
    expect(override.ok && override.valor.xml).toContain('<verAplic>app-teste</verAplic>');
  });

  test('tpEmit 2 usa a inscrição do tomador; sem CNPJ ou CPF do emitente é ocorrência', async () => {
    const r = await montarDps(dps({ tpEmit: '2', cMotivoEmisTI: '1' }), { ambiente: 'homologacao', tempo: time });
    expect(r.ok && r.valor.id).toBe(`DPS${SAO_PAULO}2${TOMADOR}00001000000000000001`);
    const semDoc = await montarDps(dps({ tpEmit: '3' }), { ambiente: 'homologacao', tempo: time });
    expect(!semDoc.ok && semDoc.ocorrencias.map((i) => i.code)).toEqual(['emitente_sem_inscricao']);
  });

  test('todas as ocorrências de uma vez, antes do schema', async () => {
    const r = await montarDps(
      dps({
        serie: '99999',
        nDPS: '0',
        dCompet: '2026-09-26',
        cLocEmi: '355',
        prestador: { CNPJ: '11222333000100', regTrib: { opSimpNac: '1', regEspTrib: '0' } },
        tomador: { CPF: '12345678900', xNome: 'X' },
        intermediario: { CNPJ: '11222333000100', xNome: 'Y' },
        servico: { ...dps().servico, cTribNac: '1.1.1' },
        valores: { vServ: '1,00', vDescIncond: -1 },
        tributacao: { ...dps().tributacao, issqn: { tribISSQN: '1', tpRetISSQN: '1', pAliq: '2.555' } },
        ibsCbs: {
          cIndOp: '100301',
          indDest: '0',
          classificacao: { CST: '000', cClassTrib: '000001', diferimento: { pDifUF: 'x', pDifMun: '0', pDifCBS: '0' } },
        },
      }),
      { ambiente: 'homologacao', tempo: time },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.ocorrencias.map((i) => `${i.caminho}:${i.code}`).sort()).toEqual(
      [
        'dCompet:competencia_posterior_emissao',
        'serie:campo_invalido',
        'nDPS:campo_invalido',
        'prestador.CNPJ:documento_invalido',
        'tomador.CPF:documento_invalido',
        'intermediario.CNPJ:documento_invalido',
        'cLocEmi:campo_invalido',
        'servico.cTribNac:campo_invalido',
        'valores.vServ:valor_invalido',
        'valores.vDescIncond:valor_invalido',
        'tributacao.issqn.pAliq:valor_casas',
        'tributacao.totTrib.pTotTribSN:campo_proibido',
        'ibsCbs.classificacao.diferimento.pDifUF:valor_invalido',
      ].sort(),
    );
  });

  test('total de tributos pelo regime do Simples (E0710, E0712, E0713)', async () => {
    const regime = (opSimpNac: '1' | '2' | '3', totTrib?: Record<string, unknown>) =>
      montarDps(
        dps({
          prestador: { ...dps().prestador, regTrib: { opSimpNac, regEspTrib: '0' } },
          tributacao: {
            issqn: { tribISSQN: '1', tpRetISSQN: '1' },
            ...(totTrib === undefined ? {} : { totTrib: totTrib as never }),
          },
        }),
        { ambiente: 'homologacao', tempo: time },
      );
    const mei = await regime('2');
    expect(mei.ok && mei.valor.xml).toContain('<totTrib><indTotTrib>0</indTotTrib></totTrib>');
    const codigos = (r: Awaited<ReturnType<typeof regime>>): string[] =>
      r.ok ? [] : r.ocorrencias.map((i) => `${i.caminho}:${i.code}`);
    expect(codigos(await regime('3'))).toEqual(['tributacao.totTrib:campo_obrigatorio']);
    expect(codigos(await regime('1'))).toEqual(['tributacao.totTrib:campo_obrigatorio']);
    expect(codigos(await regime('3', { indTotTrib: '0' }))).toEqual(['tributacao.totTrib.indTotTrib:campo_proibido']);
    expect(codigos(await regime('1', { indTotTrib: '0' }))).toEqual(['tributacao.totTrib.indTotTrib:campo_proibido']);
    expect(codigos(await regime('1', { pTotTribSN: '6.00' }))).toEqual([
      'tributacao.totTrib.pTotTribSN:campo_proibido',
    ]);
    expect(codigos(await regime('2', { pTotTribSN: '6.00' }))).toEqual([
      'tributacao.totTrib.pTotTribSN:campo_proibido',
    ]);
    const percentual = await regime('1', { pTotTrib: { pTotTribFed: '1.00', pTotTribEst: '0', pTotTribMun: '2.00' } });
    expect(percentual.ok).toBe(true);
    // Tomador emitente: o regime do prestador não vale para ele; nada é presumido nem recusado.
    const tomador = (totTrib?: Record<string, unknown>) =>
      montarDps(
        dps({
          tpEmit: '2',
          prestador: { ...dps().prestador, regTrib: { opSimpNac: '2', regEspTrib: '0' } },
          tributacao: {
            issqn: { tribISSQN: '1', tpRetISSQN: '1' },
            ...(totTrib === undefined ? {} : { totTrib: totTrib as never }),
          },
        }),
        { ambiente: 'homologacao', tempo: time },
      );
    expect(codigos(await tomador())).toEqual(['tributacao.totTrib:campo_obrigatorio']);
    expect((await tomador({ indTotTrib: '0' })).ok).toBe(true);
    expect((await tomador({ pTotTribSN: '6.00' })).ok).toBe(true);
  });

  test('schema e serialização viram ocorrência; verAplic inválido é ErroDeConfiguracao', async () => {
    const schema = await montarDps(dps({ chNFSeRej: 'X' }), {
      ambiente: 'homologacao',
      tempo: time,
    });
    expect(!schema.ok && schema.ocorrencias[0]?.code).toBe('schema');
    const serial = await montarDps(
      dps({ tributacao: { ...dps().tributacao, issqn: { tribISSQN: '1', tpRetISSQN: 1 as never } } }),
      {
        ambiente: 'homologacao',
        tempo: time,
      },
    );
    expect(!serial.ok && serial.ocorrencias[0]).toMatchObject({ code: 'schema' });
    await expect(montarDps(dps(), { ambiente: 'homologacao', tempo: time, verAplic: '' })).rejects.toThrow(
      ErroDeConfiguracao,
    );
    const nulo = await montarDps(dps(), { ambiente: 'homologacao', tempo: time, verAplic: 'v\u0000' });
    expect(!nulo.ok && nulo.ocorrencias[0]?.code).toBe('caractere_invalido');
  });
});

describe('pedido de evento', () => {
  const opts = { ambiente: 'homologacao' as const, relogio: relogioFixo('2026-09-25T10:00:00-03:00') };

  test('verAplic padrão é "sinete <versão do pacote>"; override explícito prevalece', () => {
    const esperado = formatarVerProc('sinete', VERSAO_PACOTE);
    const padrao = montarPedidoCancelamento(
      { chave: CHAVE, autor: { CPF: PRESTADOR_CPF }, cMotivo: '9', xMotivo: 'Motivo com mais de 15' },
      opts,
    );
    expect(padrao.ok && padrao.valor.xml).toContain(`<verAplic>${esperado}</verAplic>`);

    const override = montarPedidoCancelamento(
      { chave: CHAVE, autor: { CPF: PRESTADOR_CPF }, cMotivo: '9', xMotivo: 'Motivo com mais de 15' },
      { ...opts, verAplic: 'app-teste' },
    );
    expect(override.ok && override.valor.xml).toContain('<verAplic>app-teste</verAplic>');
  });

  test('cancelamento e análise fiscal com autor CPF; chave, motivo curto e verAplic', () => {
    const c = montarPedidoCancelamento(
      { chave: CHAVE, autor: { CPF: PRESTADOR_CPF }, cMotivo: '9', xMotivo: 'Motivo com mais de 15' },
      opts,
    );
    expect(c.ok && c.valor.xml).toContain(`<CPFAutor>${PRESTADOR_CPF}</CPFAutor><chNFSe>${CHAVE}</chNFSe><e101101>`);
    const a = montarPedidoAnaliseFiscal(
      { chave: CHAVE, autor: { CNPJ: PRESTADOR }, cMotivo: '1', xMotivo: 'Motivo com mais de 15' },
      opts,
    );
    expect(a.ok && a.valor.tpEvento).toBe('101103');
    const ruim = montarPedidoCancelamento({ chave: '1', autor: { CNPJ: PRESTADOR }, cMotivo: '1', xMotivo: 'x' }, opts);
    expect(!ruim.ok && ruim.ocorrencias[0]?.code).toBe('chave_invalida');
    const curto = montarPedidoCancelamento(
      { chave: CHAVE, autor: { CNPJ: PRESTADOR }, cMotivo: '1', xMotivo: 'curto' },
      opts,
    );
    expect(!curto.ok && curto.ocorrencias[0]?.code).toBe('schema');
    const serial = montarPedidoCancelamento(
      { chave: CHAVE, autor: { CNPJ: PRESTADOR }, cMotivo: 1 as never, xMotivo: 'Motivo com mais de 15' },
      opts,
    );
    expect(!serial.ok && serial.ocorrencias[0]?.code).toBe('schema');
    const nulo = montarPedidoCancelamento(
      { chave: CHAVE, autor: { CNPJ: PRESTADOR }, cMotivo: '1', xMotivo: 'Motivo com\u0000 mais de 15' },
      opts,
    );
    expect(!nulo.ok && nulo.ocorrencias[0]?.code).toBe('caractere_invalido');
    expect(() =>
      montarPedidoCancelamento(
        { chave: CHAVE, autor: { CNPJ: PRESTADOR }, cMotivo: '1', xMotivo: 'x' },
        { ...opts, verAplic: '' },
      ),
    ).toThrow(ErroDeConfiguracao);
  });
});

describe('gzip e respostas', () => {
  test('gzip em base64 de ida e volta; base64 e gzip inválidos são ErroRespostaInvalida', async () => {
    expect(await descomprimirGzipBase64(await comprimirGzipBase64('<a>ção</a>'))).toBe('<a>ção</a>');
    await expect(descomprimirGzipBase64('***')).rejects.toBeInstanceOf(ErroRespostaInvalida);
    await expect(
      descomprimirGzipBase64(codificarBase64(new TextEncoder().encode('nao e gzip')), 'nfse'),
    ).rejects.toThrow('nfse');
    const duplo = codificarBase64(new TextEncoder().encode(await comprimirGzipBase64('<a>ção</a>')));
    expect(await gunzipBase64Duplo(duplo)).toBe('<a>ção</a>');
    await expect(gunzipBase64Duplo('***', 'arquivoXml')).rejects.toThrow('arquivoXml com base64 inválido');
    await expect(gunzipBase64Duplo(codificarBase64(new Uint8Array([0xff])))).rejects.toBeInstanceOf(
      ErroRespostaInvalida,
    );
  });

  test('sem CompressionStream na runtime é ErroNaoSuportado', async () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const original = g.CompressionStream;
    g.CompressionStream = undefined;
    try {
      await expect(comprimirGzipBase64('x')).rejects.toBeInstanceOf(ErroNaoSuportado);
    } finally {
      g.CompressionStream = original;
    }
  });

  test('erros nas duas grafias, lista ou objeto, e documentos compactados em qualquer profundidade', () => {
    expect(lerJson('[1]')).toBeUndefined();
    expect(lerJson('x')).toBeUndefined();
    const m = mensagens(
      {
        erro: { codigo: 'E0312', descricao: 'd', complemento: 'c' },
      },
      'erros',
    );
    expect(m[0]).toMatchObject({ codigo: 'E0312', complemento: 'c' });
    expect(m[0]?.catalogo?.codigo).toBe('E0312');
    const n = mensagens(
      { Alertas: [null, { Codigo: 1234 }, { Codigo: '' }, { Codigo: 'A1', Mensagem: 'm', Complemento: '' }] },
      'alertas',
    );
    expect(n).toEqual([
      { codigo: '1234', descricao: '' },
      { codigo: 'A1', descricao: 'm' },
    ]);
    expect(() => rejeicao({ erros: [{ Codigo: 'X' }] }, 400, 'op')).toThrow(ErroRespostaInvalida);
    expect(() => rejeicao(undefined, 400, 'op')).toThrow(ErroRespostaInvalida);
    const r = rejeicao({ erros: [{ Codigo: 'E9999', Descricao: 'fora do catálogo' }] }, 409, 'op');
    expect(r).toMatchObject({ tipo: 'recusado', cStat: 'E9999', statusHttp: 409 });
    expect(r.dica).toBeUndefined();
    expect(
      documentosCompactados({ a: [{ eventoXmlGZipB64: '1' }, { b: { nfseXmlGZipB64: '2', outro: 3 } }], c: 'x' }),
    ).toEqual(['1', '2']);
    expect(documentosDosEventos({ Eventos: [{ arquivoXml: 'a' }, { eventoXmlGZipB64: 'b' }] }, 'op')).toEqual([
      { b64: 'a', duplo: true },
      { b64: 'b', duplo: false },
    ]);
    expect(documentosDosEventos({ evento: { eventoXmlGZipB64: 'c' } }, 'op')).toEqual([{ b64: 'c', duplo: false }]);
    expect(documentosDosEventos({ eventos: [] }, 'op')).toEqual([]);
    expect(() => documentosDosEventos({ eventos: [{ arquivoXml: '' }] }, 'op')).toThrow('evento sem arquivoXml');
    expect(() => documentosDosEventos({}, 'op')).toThrow('resposta sem eventos');
  });
});
