import { describe, expect, test } from 'bun:test';
import { fixedClock } from '@sinete/core';
import type { CertificateInfo } from '../src/index.ts';
import { icpIdentity, openPfx } from '../src/index.ts';
import { fixture, SENHA, SENHA_ACENTUADA } from './helpers.ts';

const clock = fixedClock('2026-09-25T12:00:00Z');

function fake(cn: string | undefined, otherNames: { oid: string; value: string }[] = []): CertificateInfo {
  return {
    subject: { commonName: cn, text: cn ? `CN=${cn}` : '', attributes: [], der: new Uint8Array() },
    subjectAltNames: { otherNames, emails: [], dnsNames: [], uris: [], ipAddresses: [] },
  } as unknown as CertificateInfo;
}

describe('identidade ICP-Brasil', () => {
  test('e-CNPJ: CNPJ (OCTET STRING), responsável e nascimento', async () => {
    const ks = await openPfx(fixture('ecnpj-legacy.pfx'), { password: SENHA, clock });
    expect(ks.identity).toEqual({
      tipo: 'e-CNPJ',
      cnpj: '11222333000181',
      cpf: undefined,
      pessoa: { cpf: '11144477735', dataNascimento: '1980-01-01', nome: 'FULANO SINTETICO DE TESTE' },
      nome: 'EMPRESA SINTETICA DE TESTE LTDA',
      source: 'san',
    });
  });

  test('e-CPF: CPF do titular (UTF8String)', async () => {
    const ks = await openPfx(fixture('ecpf-legacy-acentuada.pfx'), { password: SENHA_ACENTUADA, clock });
    expect(ks.identity.tipo).toBe('e-CPF');
    expect(ks.identity.cpf).toBe('11144477735');
    expect(ks.identity.cnpj).toBeUndefined();
    expect(ks.identity.nome).toBe('FULANO SINTETICO DE TESTE');
  });

  test('sem OIDs, cai no CN NOME:DOCUMENTO', () => {
    expect(icpIdentity(fake('EMPRESA X:11222333000181'))).toMatchObject({
      tipo: 'e-CNPJ',
      cnpj: '11222333000181',
      source: 'cn',
      nome: 'EMPRESA X',
    });
    expect(icpIdentity(fake('FULANO:11144477735'))).toMatchObject({ tipo: 'e-CPF', cpf: '11144477735', source: 'cn' });
    expect(icpIdentity(fake('servidor.exemplo'))).toMatchObject({
      tipo: 'desconhecido',
      source: 'nenhuma',
      nome: 'servidor.exemplo',
    });
    expect(icpIdentity(fake(undefined))).toMatchObject({ tipo: 'desconhecido', nome: undefined });
  });

  test('campos zerados ou curtos são ignorados', () => {
    const zeros = '0'.repeat(55);
    expect(icpIdentity(fake('X', [{ oid: '2.16.76.1.3.1', value: zeros }])).tipo).toBe('desconhecido');
    expect(icpIdentity(fake('X', [{ oid: '2.16.76.1.3.1', value: '0101' }])).tipo).toBe('desconhecido');
    expect(icpIdentity(fake('X', [{ oid: '2.16.76.1.3.3', value: '00000000000000' }])).tipo).toBe('desconhecido');
    const semNasc = icpIdentity(fake('Y', [{ oid: '2.16.76.1.3.1', value: `00000000${'11144477735'}` }]));
    expect(semNasc.pessoa).toEqual({ cpf: '11144477735', dataNascimento: undefined, nome: 'Y' });
    const cnpjSemResp = icpIdentity(fake('Z', [{ oid: '2.16.76.1.3.3', value: '11.222.333/0001-81' }]));
    expect(cnpjSemResp).toMatchObject({ tipo: 'e-CNPJ', cnpj: '11222333000181', pessoa: undefined });
  });

  test('CNPJ alfanumérico (IN RFB 2.229/2024) no SAN e no CN', () => {
    expect(icpIdentity(fake('X', [{ oid: '2.16.76.1.3.3', value: '12.abc.345/01de-35' }]))).toMatchObject({
      tipo: 'e-CNPJ',
      cnpj: '12ABC34501DE35',
      source: 'san',
    });
    expect(icpIdentity(fake('EMPRESA NOVA:12ABC34501DE35'))).toMatchObject({
      tipo: 'e-CNPJ',
      cnpj: '12ABC34501DE35',
      source: 'cn',
      nome: 'EMPRESA NOVA',
    });
    expect(icpIdentity(fake('X', [{ oid: '2.16.76.1.3.3', value: '12ABC34501DEXY' }])).tipo).toBe('desconhecido');
  });
});
