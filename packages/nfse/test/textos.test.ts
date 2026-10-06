/**
 * Texto e tamanho dos campos de texto conferidos na entrada da DPS (ADR 0011): caminho da entrada, `origem: 'entrada'`,
 * `campo_invalido` e a mensagem para quem preenche, com o tipo do leiaute vigente.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import { contextoDeTempo, relogioManual } from '@sinete/core';
import { camposSemElemento } from '@sinete/schemas';
import * as v20260209 from '@sinete/schemas/nfse/1.01-20260209';
import * as v20260727 from '@sinete/schemas/nfse/1.01-20260727';
import type { DadosDps } from '../src/index.ts';
import { montarDps, rotuloDoCaminho } from '../src/index.ts';
import { CAMPOS } from '../src/textos.ts';
import { dps, EMISSAO, PRESTADOR, TOMADOR } from './helpers.ts';

const opcoes = { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: relogioManual(EMISSAO) }) } as const;
const CH1 = `355030${PRESTADOR}${'0'.repeat(30)}`;
const INVISIVEL = 'caractere não aceito (símbolo ou caractere de controle)';

async function ocorrencias(e: DadosDps): Promise<readonly Ocorrencia[]> {
  const r = await montarDps(e, opcoes);
  if (r.ok) throw new Error('esperava ocorrências');
  for (const i of r.ocorrencias) {
    expect(i.caminho.startsWith('/') || i.caminho.startsWith('infDPS')).toBe(false);
    expect(i.origem).toBe('entrada');
  }
  return r.ocorrencias;
}

const texto = (caminho: string, mensagem: string): Ocorrencia => ({
  caminho,
  code: 'campo_invalido',
  mensagem,
  origem: 'entrada',
});

const descricao = (xDescServ: string): DadosDps => dps({ servico: { ...dps().servico, xDescServ } });
const motivo = (xMotivo: string): DadosDps =>
  dps({ substituicao: { chSubstda: CH1, cMotivo: '99', xMotivo } as never });

describe('montarDps: texto conferido na entrada', () => {
  test('todo campo da tabela tem elemento nos dois pacotes de esquemas', () => {
    expect(camposSemElemento(v20260209.DPSElement.tipo, CAMPOS)).toEqual([]);
    expect(camposSemElemento(v20260727.DPSElement.tipo, CAMPOS)).toEqual([]);
  });

  test('tamanho, em branco e caractere fora do tipo', async () => {
    expect(await ocorrencias(descricao('X'.repeat(2001)))).toEqual([
      texto('servico.xDescServ', 'no máximo 2000 caracteres (tem 2001)'),
    ]);
    expect(await ocorrencias(descricao('   '))).toEqual([texto('servico.xDescServ', 'não pode ficar em branco')]);
    expect(await ocorrencias(descricao(''))).toEqual([texto('servico.xDescServ', 'não pode ficar em branco')]);
    expect(await ocorrencias(motivo('Correcao do valor do servico '))).toEqual([
      texto('substituicao.xMotivo', 'sem espaço no começo nem no fim'),
    ]);
    expect(await ocorrencias(motivo('Correcao do valor € servico'))).toEqual([
      texto('substituicao.xMotivo', 'caractere não aceito: “€”'),
    ]);
    expect(await ocorrencias(motivo('Correcao'))).toEqual([
      texto('substituicao.xMotivo', 'no mínimo 15 caracteres (tem 8)'),
    ]);
  });

  test('o tipo é o do leiaute da NFS-e: a descrição aceita espaço nas pontas e €', async () => {
    const r = await montarDps(descricao(' Desenvolvimento € '), opcoes);
    expect(r.ok).toBe(true);
  });

  test('caractere que o XML não representa sai no campo, inclusive em grupo repassado e em lista', async () => {
    expect(await ocorrencias(descricao('Desenvolvimento \u0001 software'))).toEqual([
      texto('servico.xDescServ', INVISIVEL),
    ]);
    expect(await ocorrencias(dps({ tomador: { CNPJ: TOMADOR, xNome: 'TOMADOR \u0001 LTDA' } as never }))).toEqual([
      texto('tomador.xNome', INVISIVEL),
    ]);
    const ibsCbs = {
      cIndOp: '100301',
      indDest: '0',
      classificacao: { CST: '000', cClassTrib: '000001' },
      refNFSe: [CH1, `${CH1.slice(0, -1)}\u0001`],
    } as never;
    expect(await ocorrencias(dps({ ibsCbs }))).toEqual([texto('ibsCbs.refNFSe[1]', INVISIVEL)]);
  });

  test('o tipo do leiaute vale nos grupos repassados no tipo do schema', async () => {
    expect(await ocorrencias(dps({ tomador: { CNPJ: TOMADOR, xNome: 'A'.repeat(301) } as never }))).toEqual([
      texto('tomador.xNome', 'no máximo 300 caracteres (tem 301)'),
    ]);
    const end = { endNac: { cMun: '3550308', CEP: '01001000' }, xLgr: 'RUA X ', nro: '1', xBairro: 'CENTRO' };
    expect(await ocorrencias(dps({ tomador: { CNPJ: TOMADOR, xNome: 'TOMADOR', end } as never }))).toEqual([
      texto('tomador.end.xLgr', 'sem espaço no começo nem no fim'),
    ]);
  });

  test('problemas em dois campos saem juntos', async () => {
    const e = dps({
      servico: { ...dps().servico, xDescServ: 'a\u0001' },
      substituicao: { chSubstda: CH1, cMotivo: '99', xMotivo: 'Correcao do valor do servico ' } as never,
    });
    expect(await ocorrencias(e)).toEqual([
      texto('servico.xDescServ', INVISIVEL),
      texto('substituicao.xMotivo', 'sem espaço no começo nem no fim'),
    ]);
  });

  test('campos que a montagem transforma continuam aceitos', async () => {
    const r = await montarDps(dps({ serie: ' 1 ', servico: { ...dps().servico, cTribNac: '01.01.01' } }), opcoes);
    const base = await montarDps(dps(), opcoes);
    expect(r.ok && base.ok && r.valor.xml === base.valor.xml).toBe(true);
  });

  test('o campo que já tem ocorrência da entrada não ganha outra pelo texto', async () => {
    const issues = await ocorrencias(dps({ tomador: { CNPJ: '123', xNome: 'TOMADOR' } as never }));
    expect(issues.map((i) => [i.caminho, i.code])).toEqual([['tomador.CNPJ', 'documento_invalido']]);
  });

  test('os caminhos novos têm grupo e campo no rótulo', () => {
    expect(rotuloDoCaminho('ibsCbs.refNFSe[1]')).toBe('IBS/CBS, NFS-e referenciada');
    expect(rotuloDoCaminho('tomador.end.xLgr')).toBe('Endereço do tomador, Logradouro');
    expect(rotuloDoCaminho('substituicao.xMotivo')).toBe('Substituição, Descrição do motivo');
  });
});
