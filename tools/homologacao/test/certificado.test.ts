import { describe, expect, test } from 'bun:test';
import { abrirCertificado, leitorPadrao } from '../src/certificado.ts';

describe('leitorPadrao', () => {
  test('vw:// usa o vw-agentes', () => {
    expect(leitorPadrao('vw://Agentes/item')).toBe('vw-agentes');
  });
  test('op:// segue o op', () => {
    expect(leitorPadrao('op://Agentes/item')).toBe('op');
  });
});

describe('abrirCertificado com leitor externo', () => {
  test('leitor que falha vira erro sem eco do segredo', async () => {
    const origem = { op: 'vw://Agentes/item/', opBin: 'false' };
    await expect(abrirCertificado(origem)).rejects.toThrow(/false read falhou \(…\/pfx_base64\): status 1/);
  });
});
