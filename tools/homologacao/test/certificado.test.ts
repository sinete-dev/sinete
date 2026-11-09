import { describe, expect, test } from 'bun:test';
import { abrirCertificado, exigirReferenciaVw } from '../src/certificado.ts';

describe('exigirReferenciaVw', () => {
  test('vw:// passa', () => {
    expect(() => exigirReferenciaVw('vw://Agentes/item')).not.toThrow();
  });
  test('op:// falha dizendo que o 1Password foi aposentado', () => {
    expect(() => exigirReferenciaVw('op://Agentes/item')).toThrow(/1Password foi aposentado.*vw:\/\/Agentes/);
  });
  test('outro esquema falha', () => {
    expect(() => exigirReferenciaVw('Agentes/item')).toThrow(/vw:\/\/Agentes/);
  });
});

describe('abrirCertificado com leitor externo', () => {
  test('op:// é recusado antes de chamar qualquer leitor', async () => {
    await expect(abrirCertificado({ op: 'op://Agentes/item', opBin: 'false' })).rejects.toThrow(
      /1Password foi aposentado/,
    );
  });
  test('leitor que falha vira erro sem eco do segredo', async () => {
    const origem = { op: 'vw://Agentes/item/', opBin: 'false' };
    await expect(abrirCertificado(origem)).rejects.toThrow(/false read falhou \(…\/pfx_base64\): status 1/);
  });
});
