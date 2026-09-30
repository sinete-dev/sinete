/**
 * Regras do grupo E (destinatário) do MOC 7.0 Anexo I conferidas na montagem (ADR 0012, seção "Destinatário"): cada
 * uma recusa o caso da regra com o caminho da entrada e `origem: 'entrada'`, e deixa passar as exceções da própria
 * regra.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import type { DadosNfe, ResultadoMontagemNfe } from '../../src/index.ts';
import { montarNfe } from '../../src/index.ts';
import { CNPJ_DEST, CNPJ_EMIT, CPF, item, nota, opcoes } from '../helpers/nota.ts';

type Dest = NonNullable<DadosNfe['destinatario']>;

const SP = { xLgr: 'RUA', nro: '1', xBairro: 'CENTRO', cMun: '3550308', xMun: 'SAO PAULO', UF: 'SP' } as const;
const RJ = { xLgr: 'RUA', nro: '1', xBairro: 'CENTRO', cMun: '3304557', xMun: 'RIO DE JANEIRO', UF: 'RJ' } as const;
const EXTERIOR = {
  exterior: true,
  xLgr: 'AVENIDA FICTICIA',
  nro: '1',
  xBairro: 'CENTRO',
  cPais: '1600',
  xPais: 'CHINA',
} as const;
/** IE do RJ sintética, com o dígito do roteiro da UF. */
const IE_RJ = '12345674';

const ocorrencias = (r: ResultadoMontagemNfe): readonly Ocorrencia[] => (r.ok ? [] : r.ocorrencias);
const achar = (r: ResultadoMontagemNfe, path: string): Ocorrencia | undefined =>
  ocorrencias(r).find((i) => i.caminho === path);
const comRegra = (r: ResultadoMontagemNfe, regra: string): Ocorrencia | undefined =>
  ocorrencias(r).find((i) => i.mensagem.includes(regra));
const monta = (extra: Partial<DadosNfe>, o = {}): Promise<ResultadoMontagemNfe> => montarNfe(nota(extra), opcoes(o));
const dest = (d: Record<string, unknown>): { destinatario: Dest } => ({ destinatario: d as Dest });

describe('grupo E: destinatário', () => {
  test('estrangeiro: idEstrangeiro na operação com o exterior, sem IE, só com os caracteres permitidos', async () => {
    const comCnpj = await monta(dest({ CNPJ: CNPJ_DEST, indIEDest: '9', endereco: EXTERIOR }));
    expect(comRegra(comCnpj, 'E03a-10')).toMatchObject({ caminho: 'destinatario', origem: 'entrada' });
    const ok = await monta(dest({ idEstrangeiro: 'AB-123/45', indIEDest: '9', endereco: EXTERIOR }));
    expect(ocorrencias(ok)).toEqual([]);
    const vazio = await monta(dest({ idEstrangeiro: '', indIEDest: '9', endereco: EXTERIOR }));
    expect(ocorrencias(vazio)).toEqual([]);

    const semConsumidorFinal = await monta({
      ...dest({ idEstrangeiro: 'AB123', indIEDest: '9', endereco: SP }),
      indFinal: '0',
    });
    expect(comRegra(semConsumidorFinal, 'E03a-20')?.caminho).toBe('destinatario.idEstrangeiro');
    const consumidorFinal = await monta(dest({ idEstrangeiro: 'AB123', indIEDest: '9', endereco: SP }));
    expect(comRegra(consumidorFinal, 'E03a-20')).toBeUndefined();

    const comIe = await monta(dest({ idEstrangeiro: 'AB123', indIEDest: '9', IE: '110042490114', endereco: SP }));
    expect(comRegra(comIe, 'E03a-30')?.caminho).toBe('destinatario.IE');
    const caracteres = await monta(dest({ idEstrangeiro: 'AB#123', indIEDest: '9', endereco: EXTERIOR }));
    expect(comRegra(caracteres, 'E03a-60')?.caminho).toBe('destinatario.idEstrangeiro');
  });

  test('nome em produção e endereço na NF-e', async () => {
    const semNome = await monta(dest({ CPF, indIEDest: '9', endereco: SP }), { ambiente: 'producao' });
    expect(comRegra(semNome, 'E04-10')?.caminho).toBe('destinatario.xNome');
    // Em homologação o nome é o literal da E04-20, posto pelo montador.
    expect(comRegra(await monta(dest({ CPF, indIEDest: '9', endereco: SP })), 'E04-10')).toBeUndefined();
    const semEndereco = await monta(dest({ CPF, xNome: 'CONSUMIDOR', indIEDest: '9' }));
    expect(comRegra(semEndereco, 'E05-10')?.caminho).toBe('destinatario.endereco');
  });

  test('município da UF do destinatário e país no exterior', async () => {
    const outraUf = await monta(dest({ CPF, xNome: 'X', indIEDest: '9', endereco: { ...SP, cMun: '3304557' } }));
    expect(comRegra(outraUf, 'E10-20')?.caminho).toBe('destinatario.endereco.cMun');
    const brasil = await monta(
      dest({ idEstrangeiro: 'AB123', indIEDest: '9', endereco: { ...EXTERIOR, cPais: '01058', xPais: 'BRASIL' } }),
    );
    expect(comRegra(brasil, 'E14-30')?.caminho).toBe('destinatario.endereco.cPais');
  });

  test('idDest contra as UFs (E12-30 a E12-60), com as exceções da regra', async () => {
    const contribuinte = (endereco: object, IE: string): { destinatario: Dest } =>
      dest({ CNPJ: CNPJ_DEST, xNome: 'CLIENTE', indIEDest: '1', IE, endereco });
    const interestadualNaMesmaUf = await monta({ ...contribuinte(SP, '110042490114'), idDest: '2' });
    expect(comRegra(interestadualNaMesmaUf, 'E12-30')).toMatchObject({ caminho: 'idDest', origem: 'entrada' });
    const comEntrega = await monta({
      ...contribuinte(SP, '110042490114'),
      idDest: '2',
      entrega: { CNPJ: CNPJ_DEST, ...RJ },
    });
    expect(comRegra(comEntrega, 'E12-30')).toBeUndefined();
    const transferencia = await monta({
      ...dest({ CNPJ: CNPJ_EMIT, xNome: 'FILIAL', indIEDest: '1', IE: '110042490114', endereco: SP }),
      idDest: '2',
    });
    expect(comRegra(transferencia, 'E12-30')).toBeUndefined();
    // CNPJ alfanumérico: a mesma raiz numérica com letras diferentes é outra empresa.
    const outraAlfanumerica = await monta({
      emitente: { ...nota().emitente, CNPJ: '12345678DA0164' } as DadosNfe['emitente'],
      ...dest({ CNPJ: '12345678ZA0164', xNome: 'OUTRA', indIEDest: '1', IE: '110042490114', endereco: SP }),
      idDest: '2',
    });
    expect(comRegra(outraAlfanumerica, 'E12-30')?.caminho).toBe('idDest');
    const entradaInterestadual = await monta({ ...contribuinte(SP, '110042490114'), idDest: '2', tpNF: '0' });
    expect(comRegra(entradaInterestadual, 'E12-50')?.caminho).toBe('idDest');

    const internaForaDaUf = await monta({ ...contribuinte(RJ, IE_RJ), idDest: '1' });
    expect(comRegra(internaForaDaUf, 'E12-40')?.caminho).toBe('idDest');
    const consumidorFinal = await monta({ ...contribuinte(RJ, IE_RJ), idDest: '1', indFinal: '1' });
    expect(comRegra(consumidorFinal, 'E12-40')).toBeUndefined();
    const retiradaNoDestino = await monta({
      ...contribuinte(RJ, IE_RJ),
      idDest: '1',
      retirada: { CNPJ: CNPJ_DEST, ...RJ },
    });
    expect(comRegra(retiradaNoDestino, 'E12-40')).toBeUndefined();
    const entradaInterna = await monta({ ...contribuinte(RJ, IE_RJ), idDest: '1', tpNF: '0' });
    expect(comRegra(entradaInterna, 'E12-60')?.caminho).toBe('idDest');
    // Sem idDest informado, o padrão sai das UFs e nenhuma das duas recusa.
    expect(ocorrencias(await monta(contribuinte(RJ, IE_RJ)))).toEqual([]);
  });

  test('combustível (UFCons): outra UF afasta a E12-30, a UF do emitente afasta a E12-40', async () => {
    const contribuinte = (endereco: object, IE: string): { destinatario: Dest } =>
      dest({ CNPJ: CNPJ_DEST, xNome: 'CLIENTE', indIEDest: '1', IE, endereco });
    const comb = (UFCons: string): Partial<DadosNfe> => {
      const base = item();
      const especifico = { comb: { cProdANP: '320102001', descANP: 'GASOLINA C COMUM', UFCons } };
      return { itens: [{ ...base, produto: { ...base.produto, especifico } } as DadosNfe['itens'][number]] };
    };
    const consumidoEmOutraUf = await monta({ ...contribuinte(SP, '110042490114'), idDest: '2', ...comb('RJ') });
    expect(comRegra(consumidoEmOutraUf, 'E12-30')).toBeUndefined();
    const consumidoNaUf = await monta({ ...contribuinte(SP, '110042490114'), idDest: '2', ...comb('SP') });
    expect(comRegra(consumidoNaUf, 'E12-30')?.caminho).toBe('idDest');
    const internaConsumidaNaUf = await monta({ ...contribuinte(RJ, IE_RJ), idDest: '1', ...comb('SP') });
    expect(comRegra(internaConsumidaNaUf, 'E12-40')).toBeUndefined();
    const internaConsumidaFora = await monta({ ...contribuinte(RJ, IE_RJ), idDest: '1', ...comb('RJ') });
    expect(comRegra(internaConsumidaFora, 'E12-40')?.caminho).toBe('idDest');
  });

  test('indicador da IE: exterior é não contribuinte, e não contribuinte na saída é consumidor final', async () => {
    const exteriorContribuinte = await monta(dest({ idEstrangeiro: 'AB123', indIEDest: '2', endereco: EXTERIOR }));
    expect(comRegra(exteriorContribuinte, 'E16a-20')?.caminho).toBe('destinatario.indIEDest');
    const naoContribuinte = await monta({ ...dest({ CPF, xNome: 'X', indIEDest: '9', endereco: SP }), indFinal: '0' });
    expect(comRegra(naoContribuinte, 'E16a-40')?.caminho).toBe('indFinal');
    // Na entrada a regra não vale.
    const entrada = await monta({
      ...dest({ CPF, xNome: 'X', indIEDest: '9', endereco: SP }),
      indFinal: '0',
      tpNF: '0',
    });
    expect(comRegra(entrada, 'E16a-40')).toBeUndefined();
  });

  test('IE: contribuinte informa, isento não informa, exterior não informa; não contribuinte com IE passa', async () => {
    const semIe = await monta(dest({ CNPJ: CNPJ_DEST, xNome: 'X', indIEDest: '1', endereco: SP }));
    expect(comRegra(semIe, 'E17-20')).toMatchObject({ caminho: 'destinatario.IE', code: 'campo_obrigatorio' });
    const isentoComIe = await monta(
      dest({ CNPJ: CNPJ_DEST, xNome: 'X', indIEDest: '2', IE: '110042490114', endereco: SP }),
    );
    expect(comRegra(isentoComIe, 'E17-30')?.caminho).toBe('destinatario.IE');
    const exteriorComIe = await monta(
      dest({ idEstrangeiro: 'AB123', indIEDest: '9', IE: '110042490114', endereco: EXTERIOR }),
    );
    expect(comRegra(exteriorComIe, 'E17-40')?.caminho).toBe('destinatario.IE');
    // IE de não contribuinte (indIEDest 9): a 5E17-12 depende do cadastro e é implementação futura.
    const naoContribuinteComIe = await monta(
      dest({ CNPJ: CNPJ_DEST, xNome: 'X', indIEDest: '9', IE: '110042490114', endereco: SP }),
    );
    expect(ocorrencias(naoContribuinteComIe)).toEqual([]);
  });

  test('Suframa: só nas UFs e municípios da área incentivada', async () => {
    const comIsuf = (endereco: object): { destinatario: Dest } =>
      dest({ CPF, xNome: 'X', indIEDest: '9', ISUF: '123456789', endereco });
    expect(comRegra(await monta(comIsuf(SP)), 'E18-30')?.caminho).toBe('destinatario.ISUF');
    const manaus = { xLgr: 'RUA', nro: '1', xBairro: 'CENTRO', cMun: '1302603', xMun: 'MANAUS', UF: 'AM' };
    expect(comRegra(await monta(comIsuf(manaus)), 'E18-30')).toBeUndefined();
    const macapa = { xLgr: 'RUA', nro: '1', xBairro: 'CENTRO', cMun: '1600303', xMun: 'MACAPA', UF: 'AP' };
    expect(comRegra(await monta(comIsuf(macapa)), 'E18-30')).toBeUndefined();
    const oiapoque = { ...macapa, cMun: '1600501', xMun: 'OIAPOQUE' };
    expect(comRegra(await monta(comIsuf(oiapoque)), 'E18-30')?.caminho).toBe('destinatario.ISUF');
    const exterior = await monta(
      dest({ idEstrangeiro: 'AB123', indIEDest: '9', ISUF: '123456789', endereco: EXTERIOR }),
    );
    expect(comRegra(exterior, 'E18-30')?.caminho).toBe('destinatario.ISUF');
  });

  test('NFC-e: as regras de 55 e 65 valem, as só do 55 não', async () => {
    const nfce = (d: Record<string, unknown>): Promise<ResultadoMontagemNfe> =>
      montarNfe(
        nota({
          modelo: '65',
          ...dest(d),
          itens: [item()],
          pagamento: { detPag: [{ tPag: '01', vPag: '20.00' }] },
        }),
        opcoes(),
      );
    const municipio = await nfce({ CPF, indIEDest: '9', endereco: { ...SP, cMun: '3304557' } });
    expect(comRegra(municipio, 'E10-20')?.caminho).toBe('destinatario.endereco.cMun');
    const semNomeNemEndereco = await nfce({ CPF, indIEDest: '9' });
    expect(ocorrencias(semNomeNemEndereco)).toEqual([]);
  });
});
