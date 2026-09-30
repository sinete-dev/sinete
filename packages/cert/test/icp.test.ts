import { describe, expect, test } from 'bun:test';
import { relogioFixo } from '@sinete/core';
import type { CertificadoX509 } from '../src/index.ts';
import { abrirPfx, identidadeIcp } from '../src/index.ts';
import { fixture, SENHA, SENHA_ACENTUADA } from './helpers.ts';

const clock = relogioFixo('2026-09-25T12:00:00Z');

function fake(cn: string | undefined, otherNames: { oid: string; value: string }[] = []): CertificadoX509 {
  return {
    subject: { commonName: cn, texto: cn ? `CN=${cn}` : '', atributos: [], der: new Uint8Array() },
    subjectAltNames: { otherNames, emails: [], nomesDns: [], uris: [], enderecosIp: [] },
  } as unknown as CertificadoX509;
}

describe('identidade ICP-Brasil', () => {
  test('e-CNPJ: CNPJ (OCTET STRING), responsável e nascimento', async () => {
    const ks = await abrirPfx(fixture('ecnpj-legacy.pfx'), { senha: SENHA, relogio: clock });
    expect(ks.identidade).toEqual({
      tipo: 'e-CNPJ',
      cnpj: '11222333000181',
      cpf: undefined,
      pessoa: { cpf: '11144477735', dataNascimento: '1980-01-01', nome: 'FULANO SINTETICO DE TESTE' },
      nome: 'EMPRESA SINTETICA DE TESTE LTDA',
      origem: 'san',
    });
  });

  test('e-CPF: CPF do titular (UTF8String)', async () => {
    const ks = await abrirPfx(fixture('ecpf-legacy-acentuada.pfx'), { senha: SENHA_ACENTUADA, relogio: clock });
    expect(ks.identidade.tipo).toBe('e-CPF');
    expect(ks.identidade.cpf).toBe('11144477735');
    expect(ks.identidade.cnpj).toBeUndefined();
    expect(ks.identidade.nome).toBe('FULANO SINTETICO DE TESTE');
  });

  test('sem OIDs, cai no CN NOME:DOCUMENTO', () => {
    expect(identidadeIcp(fake('EMPRESA X:11222333000181'))).toMatchObject({
      tipo: 'e-CNPJ',
      cnpj: '11222333000181',
      origem: 'cn',
      nome: 'EMPRESA X',
    });
    expect(identidadeIcp(fake('FULANO:11144477735'))).toMatchObject({
      tipo: 'e-CPF',
      cpf: '11144477735',
      origem: 'cn',
    });
    expect(identidadeIcp(fake('servidor.exemplo'))).toMatchObject({
      tipo: 'desconhecido',
      origem: 'nenhuma',
      nome: 'servidor.exemplo',
    });
    expect(identidadeIcp(fake(undefined))).toMatchObject({ tipo: 'desconhecido', nome: undefined });
  });

  test('campos zerados ou curtos são ignorados', () => {
    const zeros = '0'.repeat(55);
    expect(identidadeIcp(fake('X', [{ oid: '2.16.76.1.3.1', value: zeros }])).tipo).toBe('desconhecido');
    expect(identidadeIcp(fake('X', [{ oid: '2.16.76.1.3.1', value: '0101' }])).tipo).toBe('desconhecido');
    expect(identidadeIcp(fake('X', [{ oid: '2.16.76.1.3.3', value: '00000000000000' }])).tipo).toBe('desconhecido');
    const semNasc = identidadeIcp(fake('Y', [{ oid: '2.16.76.1.3.1', value: `00000000${'11144477735'}` }]));
    expect(semNasc.pessoa).toEqual({ cpf: '11144477735', dataNascimento: undefined, nome: 'Y' });
    const cnpjSemResp = identidadeIcp(fake('Z', [{ oid: '2.16.76.1.3.3', value: '11.222.333/0001-81' }]));
    expect(cnpjSemResp).toMatchObject({ tipo: 'e-CNPJ', cnpj: '11222333000181', pessoa: undefined });
  });

  test('CNPJ alfanumérico (IN RFB 2.229/2024) no SAN e no CN', () => {
    expect(identidadeIcp(fake('X', [{ oid: '2.16.76.1.3.3', value: '12.abc.345/01de-35' }]))).toMatchObject({
      tipo: 'e-CNPJ',
      cnpj: '12ABC34501DE35',
      origem: 'san',
    });
    expect(identidadeIcp(fake('EMPRESA NOVA:12ABC34501DE35'))).toMatchObject({
      tipo: 'e-CNPJ',
      cnpj: '12ABC34501DE35',
      origem: 'cn',
      nome: 'EMPRESA NOVA',
    });
    expect(identidadeIcp(fake('X', [{ oid: '2.16.76.1.3.3', value: '12ABC34501DEXY' }])).tipo).toBe('desconhecido');
  });
});
