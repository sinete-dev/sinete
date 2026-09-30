import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import qrcode from 'qrcode-generator';
import { code128C, code128Chave, modules, valoresChave } from '../src/barcode/code128.ts';
import type { NivelCorrecaoQr } from '../src/barcode/qr.ts';
import { matrizQr } from '../src/barcode/qr.ts';
import { barcode, qrcode as drawQr } from '../src/layout/common.ts';
import { Canvas } from '../src/render/canvas.ts';
import { gerarPdf } from '../src/render/pdf.ts';
import { chaveDe } from './fixtures.ts';

describe('CODE-128C', () => {
  test('exemplo do MOC 7.0, Anexo II, 2.2 (09758364, DV 48)', () => {
    expect(code128C('09758364').join('')).toBe(
      '211232' + '221213' + '241211' + '114212' + '111422' + '313121' + '2331112',
    );
  });
  test('chave de 44 dígitos: 22 símbolos + start + DV + stop = 277 módulos', () => {
    expect(modules(code128C('3'.repeat(44)))).toBe(11 * 24 + 13);
  });
  test('híbrido C/A da NT 2025.001, seção 6: exemplo 5225AB83 com DV 30', () => {
    expect(valoresChave('5225AB83')).toEqual([105, 52, 25, 101, 33, 34, 99, 83, 30, 106]);
  });
  test('chave numérica sai igual ao CODE-128C; dígito ímpar antes da letra vai no subconjunto A', () => {
    const chave = '35260911222333000181550010000012341123456787';
    expect(code128Chave(chave)).toEqual(code128C(chave));
    expect(valoresChave('123A45').slice(0, -2)).toEqual([105, 12, 101, 19, 33, 99, 45]);
    expect(valoresChave('12A345').slice(0, -2)).toEqual([105, 12, 101, 33, 19, 99, 45]);
    // Par de dígitos no meio fica no A (voltar ao C não encurta).
    expect(valoresChave('12A34B56').slice(0, -2)).toEqual([105, 12, 101, 33, 19, 20, 34, 99, 56]);
    // Pior caso: CNPJ com letra e dígito alternados, 32 símbolos, 365 módulos.
    expect(modules(code128Chave(chaveDe('55', '1', 1234, 'A1B2C3D4E5F667')))).toBe(365);
    expect(valoresChave('12AB').slice(0, -2)).toEqual([105, 12, 101, 33, 34]);
    expect(() => code128Chave('12a4')).toThrow(expect.objectContaining({ code: 'codigo_barras_invalido' }));
  });
  test('quantidade ímpar de dígitos é erro tipado', () => {
    expect(() => code128C('123')).toThrow(expect.objectContaining({ code: 'codigo_barras_invalido' }));
    expect(() => code128C('12a4')).toThrow(expect.objectContaining({ code: 'codigo_barras_invalido' }));
  });
});

/** Máscara gravada na informação de formato de uma matriz (bits 10 a 12, depois do XOR com 0x5412). */
function maskOf(m: boolean[][]): number {
  let bits = 0;
  const pos: [number, number][] = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  pos.forEach(([x, y], i) => {
    if (m[y]?.[x]) bits |= 1 << i;
  });
  return ((bits ^ 0x5412) >> 10) & 7;
}

function reference(text: string, ecc: NivelCorrecaoQr): boolean[][] {
  const q = qrcode(0, ecc);
  q.addData(unescape(encodeURIComponent(text)), 'Byte');
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

describe('QR Code', () => {
  // Tamanhos que passam por todas as faixas de versão (1 a 40) e pelos quatro níveis.
  const lengths = [1, 14, 17, 40, 78, 100, 150, 250, 400, 600, 900, 1200, 1500, 1800, 2200, 2331];
  for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
    test(`igual ao qrcode-generator (MIT) na mesma máscara, nível ${ecc}`, () => {
      for (const len of lengths) {
        const text = `https://x.test/${'áb0|'.repeat(len)}`.slice(0, len);
        let ref: boolean[][];
        try {
          ref = reference(text, ecc);
        } catch {
          continue; // maior que a versão 40 no nível
        }
        const mine = matrizQr(text, { nivelDeCorrecao: ecc, mascara: maskOf(ref) });
        expect(mine.length).toBe(ref.length);
        expect(mine).toEqual(ref);
      }
    });
  }
  test('escolhe a máscara de menor penalidade e é determinístico', () => {
    const a = matrizQr('https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=1&tpAmb=1');
    expect(matrizQr('https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=1&tpAmb=1')).toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(21);
  });
  test('conteúdo maior que a versão 40 é erro tipado', () => {
    expect(() => matrizQr('x'.repeat(3000), { nivelDeCorrecao: 'H' })).toThrow(
      expect.objectContaining({ code: 'codigo_barras_invalido' }),
    );
  });
});

// Leitura real com o zbar (ADR 0006, decisão 4): só roda onde zbarimg e pdftoppm existem.
const hasZbar = ((): boolean => {
  try {
    execFileSync('zbarimg', ['--version'], { stdio: 'ignore' });
    execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasZbar)('leitura com zbarimg', () => {
  test('CODE-128C da chave e QR Code a 25 mm lidos a 150 dpi', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sinete-danfe-'));
    try {
      const chave = '35260911222333000181550010000012341123456787';
      const url = `https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=${chave}|3|2`;
      const c = new Canvas('Helvetica', 'Helvetica-Bold');
      barcode(c, chave, 10, 10, 80, 10);
      drawQr(c, url, 10, 30, 25);
      writeFileSync(
        path.join(dir, 'x.pdf'),
        gerarPdf({
          titulo: 't',
          paginas: [{ w: 100, h: 60, ops: c.ops }],
          imagens: {},
          estatisticas: { reduzidos: 0, quebrados: 0, cortados: 0 },
        }),
      );
      execFileSync('pdftoppm', ['-r', '150', '-png', '-singlefile', path.join(dir, 'x.pdf'), path.join(dir, 'x')]);
      const out = execFileSync('zbarimg', ['-q', path.join(dir, 'x.png')]).toString();
      expect(out).toContain(`CODE-128:${chave}`);
      expect(out).toContain(`QR-Code:${url}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  // O híbrido tem mais símbolos: no módulo de 0,24 mm, 150 dpi dá 1,4 px por módulo, abaixo do que o zbar resolve.
  test('chave com CNPJ alfanumérico no híbrido C/A lida a 300 dpi', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sinete-danfe-'));
    try {
      const chave = chaveDe('55', '1', 1234, '12ABC34501DE35');
      const c = new Canvas('Helvetica', 'Helvetica-Bold');
      barcode(c, chave, 5, 10, 90, 10);
      writeFileSync(
        path.join(dir, 'x.pdf'),
        gerarPdf({
          titulo: 't',
          paginas: [{ w: 100, h: 30, ops: c.ops }],
          imagens: {},
          estatisticas: { reduzidos: 0, quebrados: 0, cortados: 0 },
        }),
      );
      execFileSync('pdftoppm', ['-r', '300', '-png', '-singlefile', path.join(dir, 'x.pdf'), path.join(dir, 'x')]);
      expect(execFileSync('zbarimg', ['-q', path.join(dir, 'x.png')]).toString()).toContain(`CODE-128:${chave}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
