// DANFSe v2 (NT SE/CGNFS-e 008/2026 v1.02) sobre fixtures sintéticas: os dois pacotes de esquemas, as marcas, o QR
// lido de volta pelo zbar e o limite de uma página.
import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CABECALHO_DANFSE, QR_DANFSE, TEXTOS_DANFSE } from '../src/data/leiaute-danfse.ts';
import { readNfse } from '../src/input/nfse.ts';
import type { Documento, OpTexto } from '../src/model.ts';
import { danfse, ErroDa, gerarHtml, gerarPdf, gerarSvg } from '../src/nfse.ts';
import type { NfseFx } from './fixtures-nfse.ts';
import { chaveNfse, eventoNfseXml, NFSE_FIXTURES, nfseXml, PREST_CNPJ, PREST_CNPJ_ALFA } from './fixtures-nfse.ts';

function fx(name: string): NfseFx {
  const f = NFSE_FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(name);
  return f;
}

const textos = (d: Documento): OpTexto[] => (d.paginas[0]?.ops ?? []).filter((o): o is OpTexto => o.t === 'texto');
const tem = (d: Documento, s: string): boolean => textos(d).some((o) => o.s.includes(s));

const completa = nfseXml(fx('danfse-completa'));
const alfa = nfseXml(fx('danfse-alfanumerico-homologacao'));
const minima = nfseXml(fx('danfse-minima'));
const longos = nfseXml(fx('danfse-textos-longos'));

describe('entrada nos dois pacotes de esquemas', () => {
  test('o pacote sai da vigência pela data e pelo ambiente da DPS', () => {
    expect(readNfse(completa).modulo).toBe('nfse/1.01-20260209');
    expect(readNfse(alfa).modulo).toBe('nfse/1.01-20260727');
    expect(readNfse(minima).modulo).toBe('nfse/1.01-20260727');
    // Produção só passa ao 20260727 em 10/08/2026; a produção restrita, em 27/07/2026.
    const julho = (tpAmb: string): string =>
      completa
        .replace('<tpAmb>1</tpAmb>', `<tpAmb>${tpAmb}</tpAmb>`)
        .replace(/<dhEmi>[^<]+/, '<dhEmi>2026-08-01T10:00:00-03:00');
    expect(readNfse(julho('1')).modulo).toBe('nfse/1.01-20260209');
    expect(readNfse(julho('2')).modulo).toBe('nfse/1.01-20260727');
    // Antes da primeira vigência registrada (leiaute 1.00) ou sem data legível: o pacote mais antigo.
    expect(readNfse(completa.replace(/<dhEmi>[^<]+/, '<dhEmi>2025-12-01T10:00:00-03:00')).modulo).toBe(
      'nfse/1.01-20260209',
    );
    expect(readNfse(completa.replace(/<dhEmi>[^<]+/, '<dhEmi>ontem')).modulo).toBe('nfse/1.01-20260209');
  });

  test('gera PDF e HTML de uma página nos dois pacotes, com a chave sem o prefixo', () => {
    for (const [xml, cnpj] of [
      [completa, PREST_CNPJ],
      [alfa, PREST_CNPJ_ALFA],
    ] as const) {
      const d = danfse(xml);
      const chave = chaveNfse(cnpj);
      expect(d.paginas).toHaveLength(1);
      expect(d.paginas[0]).toMatchObject({ w: 210, h: 297 });
      expect(d.titulo).toBe(`DANFSe ${chave}`);
      expect(textos(d).filter((o) => o.s === chave)).toHaveLength(1);
      expect(tem(d, `1234 / ${chave}`)).toBe(true);
      expect(new TextDecoder().decode(gerarPdf(d).slice(0, 8))).toBe('%PDF-1.4');
      expect(gerarHtml(d)).toContain(chave);
      expect(gerarSvg(d.paginas[0] as Documento['paginas'][number], d)).toContain('<svg');
    }
    expect(tem(danfse(alfa), '12.ABC.345/01DE-35')).toBe(true);
  });

  test('determinístico', () => {
    expect(gerarPdf(danfse(completa))).toEqual(gerarPdf(danfse(completa)));
  });

  test('campos da NT com as descrições das opções e os formatos do 2.4.5', () => {
    const d = danfse(completa);
    for (const s of [
      'DANFSe v2.0',
      'Documento Auxiliar da NFS-e',
      'Município: São Paulo / SP',
      'Ambiente Gerador: Sistema Nacional da NFS-e',
      'Tipo de Ambiente: Produção',
      'NFS-e Gerada',
      'NFS-e regular',
      'Prestador',
      '10/05/2026 10:20:45',
      '01.01.01 / 001',
      '1.1502.10.00',
      'São Paulo / SP / BR',
      '3550308 / 01.001-000',
      'AVENIDA DAS FIXTURES, 1000, CENTRO',
      'Sociedade de Profissionais',
      'Exigibilidade Suspensa por Decisão Judicial',
      'Retido pelo Tomador',
      'R$ 1.000,00',
      'R$ 940,00',
      '100301 / 3550308 / São Paulo / SP',
      '000 / 000001',
      'Desenvolvimento de programas de computador sob encomenda (descrição municipal fictícia).',
      'Inf. Cont.: CONTRATO FICTICIO 123/2026 | Doc. Ref.: PEDIDO-REF-01 | Cod. Obra: OBRA-0001 | Insc. Imob.: 000.111.222-3',
      'Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: R$ 46,50; Estaduais: R$ 0,00; Municipais: R$ 50,00',
      'DESTINATARIO FICTICIO DA OPERACAO LTDA',
      'INTERMEDIARIO FICTICIO DE NEGOCIOS LTDA',
      'PIS/COFINS Não Retidos',
    ]) {
      expect({ s, presente: tem(d, s) }).toEqual({ s, presente: true });
    }
    // Nome e endereço do prestador vêm do emitente quando a DPS traz só o documento (mesmo CNPJ).
    expect(tem(d, 'EMPRESA FICTICIA DE SERVICOS DO SINETE LTDA')).toBe(true);
    // Sem o nome do município no XML, o código com a UF; com o nome resolvido pelo chamador, o nome.
    expect(tem(d, '3304557 / RJ')).toBe(true);
    const nomes = danfse(completa, { nomeMunicipio: (c) => (c === '3304557' ? 'Rio de Janeiro' : undefined) });
    expect(tem(nomes, 'Rio de Janeiro / RJ')).toBe(true);
  });

  test('conteúdo em 7 pt, rótulos em 6 pt ou mais (NT 008/2026, 2.4)', () => {
    for (const f of NFSE_FIXTURES) {
      for (const o of textos(danfse(nfseXml(f)))) {
        expect({ s: o.s, ok: o.tamanho >= 6 }).toEqual({ s: o.s, ok: true });
        if (o.fonte === 'Helvetica' && !o.rotacao && o.tamanho < 7) {
          // Só o cabeçalho (ambientes) e o texto do QR Code saem em 6 pt normal.
          expect(
            o.s.startsWith('Ambiente') || o.s.startsWith('Tipo de Ambiente') || QR_DANFSE.texto.includes(o.s),
          ).toBe(true);
        }
      }
    }
  });

  test('texto de autenticidade do QR Code em três linhas (2.4.3)', () => {
    const linhas = textos(danfse(completa)).filter((o) => QR_DANFSE.texto.includes(o.s) && o.tamanho === 6);
    expect(linhas).toHaveLength(3);
    expect(linhas.map((o) => o.s).join(' ')).toBe(QR_DANFSE.texto);
  });
});

describe('blocos suprimidos e linhas condicionais (2.3 e notas 1 a 6)', () => {
  test('sem tomador, destinatário, intermediário e ISSQN: só a frase', () => {
    const d = danfse(minima);
    for (const s of [
      TEXTOS_DANFSE.tomadorAusente,
      TEXTOS_DANFSE.destinatarioAusente,
      TEXTOS_DANFSE.intermediarioAusente,
      TEXTOS_DANFSE.issqnAusente,
    ]) {
      expect(tem(d, s)).toBe(true);
    }
    expect(tem(d, 'TOMADOR / ADQUIRENTE')).toBe(false);
    expect(tem(d, 'BC ISSQN')).toBe(false);
    // Competência de 2027: sem a linha de PIS e COFINS (nota 6); totais do Simples Nacional.
    expect(tem(d, 'PIS - Débito Apuração Própria')).toBe(false);
    expect(tem(d, 'Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Simples Nacional: 6,00%')).toBe(true);
    // Sem o grupo IBSCBS: o bloco fica, com traço nos campos (nota 12).
    expect(tem(d, 'TRIBUTAÇÃO IBS / CBS')).toBe(true);
    // Linhas com ** sem dado nenhum saem (nota 5).
    expect(tem(d, 'Regime Especial de Tributação do ISSQN')).toBe(false);
  });

  test('destinatário é o próprio tomador (2.3.2), PIS/COFINS retidos e percentuais', () => {
    const d = danfse(alfa);
    expect(tem(d, TEXTOS_DANFSE.destinatarioTomador)).toBe(true);
    expect(tem(d, '123.456.789-09')).toBe(true);
    // tpRetPisCofins 1: contribuições retidas somam CSLL, PIS e COFINS; débito próprio zerado (2.4.5).
    expect(tem(d, 'R$ 39,53')).toBe(true);
    expect(textos(d).filter((o) => o.s === 'R$ 0,00').length).toBeGreaterThanOrEqual(2);
    expect(tem(d, 'Federais: 4,65%; Estaduais: 0,00%; Municipais: 5,00%')).toBe(true);
    expect(tem(d, 'Regime Especial de Tributação do ISSQN')).toBe(false);
  });

  test('retenção de PIS e COFINS tributo a tributo, pelo tpRetPisCofins (2.4.5 estendido aos códigos 3 a 9)', () => {
    // O valor de um campo é o texto logo depois do rótulo (o `campo` desenha os dois em sequência).
    const valor = (d: Documento, rotulo: string): string | undefined => {
      const ts = textos(d);
      return ts[ts.findIndex((o) => o.s === rotulo) + 1]?.s;
    };
    const com = (codigo: string): Documento =>
      danfse(completa.replace(/<tpRetPisCofins>\d<\/tpRetPisCofins>/, `<tpRetPisCofins>${codigo}</tpRetPisCofins>`));
    // CSLL 8,50, PIS 5,53 e COFINS 25,50 na fixture.
    for (const [codigo, retidas, pis, cofins] of [
      ['0', 'R$ 8,50', 'R$ 5,53', 'R$ 25,50'],
      ['1', 'R$ 39,53', 'R$ 0,00', 'R$ 0,00'],
      ['2', 'R$ 8,50', 'R$ 5,53', 'R$ 25,50'],
      ['3', 'R$ 39,53', 'R$ 0,00', 'R$ 0,00'],
      ['4', 'R$ 39,53', 'R$ 0,00', 'R$ 0,00'],
      ['5', 'R$ 14,03', 'R$ 0,00', 'R$ 25,50'],
      ['6', 'R$ 34,00', 'R$ 5,53', 'R$ 0,00'],
      ['7', 'R$ 34,00', 'R$ 5,53', 'R$ 0,00'],
      ['8', 'R$ 8,50', 'R$ 5,53', 'R$ 25,50'],
      ['9', 'R$ 14,03', 'R$ 0,00', 'R$ 25,50'],
    ] as const) {
      const d = com(codigo);
      expect({
        codigo,
        retidas: valor(d, 'Contribuições Sociais - Retidas'),
        pis: valor(d, 'PIS - Débito Apuração Própria'),
        cofins: valor(d, 'COFINS - Débito Apuração Própria'),
      }).toEqual({ codigo, retidas, pis, cofins });
    }
  });

  test('indicador de operação da DPS mesmo sem o grupo IBSCBS calculado pela Sefin', () => {
    const semCalculo = completa.replace(/<IBSCBS><cLocalidadeIncid>.*?<\/totCIBS><\/IBSCBS>/, '');
    expect(semCalculo).not.toContain('cLocalidadeIncid');
    const d = danfse(semCalculo);
    expect(tem(d, '100301')).toBe(true);
    expect(tem(d, '100301 / 3550308')).toBe(false);
  });

  test('tomador no exterior e totais não informados', () => {
    const d = danfse(longos);
    expect(tem(d, 'A1B2C3D4E5')).toBe(true);
    expect(tem(d, 'NEW YORK / NY')).toBe(true);
    expect(tem(d, 'Federais: -; Estaduais: -; Municipais: -')).toBe(true);
  });

  test('canhoto opcional (2.3.3)', () => {
    expect(tem(danfse(completa), 'IDENTIFICAÇÃO E ASSINATURA')).toBe(true);
    expect(tem(danfse(completa, { canhoto: false }), 'IDENTIFICAÇÃO E ASSINATURA')).toBe(false);
  });

  test('município do cabeçalho some com o item 99 do código de tributação nacional', () => {
    const d = danfse(completa.replace('<cTribNac>010101</cTribNac>', '<cTribNac>990101</cTribNac>'));
    expect(tem(d, 'Município: São Paulo')).toBe(false);
  });
});

describe('página única com textos longos (2.2)', () => {
  test('descrição e informações de 2.000 caracteres: uma página, reticências e a linha dos tributos intacta', () => {
    const d = danfse(longos);
    expect(d.paginas).toHaveLength(1);
    expect(d.estatisticas.cortados).toBeGreaterThanOrEqual(2);
    const ts = textos(d);
    expect(ts.some((o) => o.s.endsWith('...') && o.s.includes('LOREM'))).toBe(true);
    expect(tem(d, 'Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012:')).toBe(true);
    // Nada passa da borda nem invade o canhoto.
    const canhoto = ts.find((o) => o.s === 'DATA CIENTIFICAÇÃO:');
    for (const o of ts) {
      if (o.rotacao) continue;
      expect(o.y).toBeLessThan(295);
      expect(o.x + o.w).toBeLessThanOrEqual(207.2);
      if (o.s.includes('LOREM') || o.s.startsWith('Totais')) expect(o.y).toBeLessThan(canhoto?.y ?? 0);
    }
    // Sem canhoto, o quadro das informações cresce.
    const sem = danfse(longos, { canhoto: false });
    const linhas = (x: Documento): number => textos(x).filter((o) => o.s.includes('LOREM')).length;
    expect(linhas(sem)).toBeGreaterThan(linhas(d));
  });
});

describe('marcas (2, 2.4.3, 2.5.1 e 2.5.2)', () => {
  const marca = (d: Documento): OpTexto | undefined => textos(d).find((o) => o.rotacao);

  test('produção restrita: "NFS-e SEM VALIDADE JURÍDICA" em vermelho, negrito, 9 pt, abaixo do título', () => {
    const h = textos(danfse(alfa)).find((o) => o.s === CABECALHO_DANFSE.homologacao);
    expect(h).toMatchObject({ fonte: 'Helvetica-Bold', tamanho: 9, rgb: [1, 0, 0] });
    const titulo = textos(danfse(alfa)).find((o) => o.s === 'Documento Auxiliar da NFS-e');
    expect(h?.y ?? 0).toBeGreaterThan(titulo?.y ?? 0);
    expect(tem(danfse(completa), CABECALHO_DANFSE.homologacao)).toBe(false);
    expect(gerarHtml(danfse(alfa))).toContain('fill="rgb(255,0,0)"');
    expect(marca(danfse(alfa))).toBeUndefined();
  });

  test('cancelada: "CANCELADA" em diagonal, normal, cinza K35, no mínimo 50 pt, atrás do conteúdo', () => {
    const chave = chaveNfse(PREST_CNPJ);
    for (const c of [
      true,
      eventoNfseXml('e101101', chave),
      eventoNfseXml('e105104', chave),
      eventoNfseXml('e305101', chave),
    ] as const) {
      const d = danfse(completa, { cancelamento: c });
      const m = marca(d);
      expect(m).toMatchObject({ s: 'CANCELADA', fonte: 'Helvetica', cinza: TEXTOS_DANFSE.marca.cinza });
      expect(m?.tamanho ?? 0).toBeGreaterThanOrEqual(TEXTOS_DANFSE.marca.minimo);
      expect(d.paginas[0]?.ops[0]).toBe(m);
    }
  });

  test('substituída: "SUBSTITUÍDA" pelo evento de cancelamento por substituição', () => {
    const d = danfse(completa, { substituicao: eventoNfseXml('e105102', chaveNfse(PREST_CNPJ)) });
    expect(marca(d)).toMatchObject({ s: 'SUBSTITUÍDA', fonte: 'Helvetica' });
    expect(marca(d)?.tamanho ?? 0).toBeGreaterThanOrEqual(50);
    expect(marca(danfse(completa, { substituicao: true }))?.s).toBe('SUBSTITUÍDA');
    expect(marca(danfse(completa))).toBeUndefined();
  });

  test('evento de outro tipo, de outra NFS-e, sem registro ou as duas marcas juntas', () => {
    const chave = chaveNfse(PREST_CNPJ);
    const erro = (f: () => unknown): string => {
      try {
        f();
      } catch (e) {
        return e instanceof ErroDa ? e.code : String(e);
      }
      return 'sem erro';
    };
    expect(erro(() => danfse(completa, { cancelamento: eventoNfseXml('e105102', chave) }))).toBe('evento_incompativel');
    expect(erro(() => danfse(completa, { substituicao: eventoNfseXml('e101101', chave) }))).toBe('evento_incompativel');
    expect(erro(() => danfse(completa, { cancelamento: eventoNfseXml('e202201', chave) }))).toBe('evento_incompativel');
    expect(erro(() => danfse(completa, { cancelamento: eventoNfseXml('e101101', chaveNfse(PREST_CNPJ, 9)) }))).toBe(
      'evento_incompativel',
    );
    expect(erro(() => danfse(completa, { cancelamento: eventoNfseXml('e101101', chave, false) }))).toBe(
      'documento_inesperado',
    );
    expect(erro(() => danfse(completa, { cancelamento: true, substituicao: true }))).toBe('evento_incompativel');
  });
});

describe('entrada inválida', () => {
  test('XML malformado, outra raiz e NFS-e sem infNFSe', () => {
    expect(() => danfse('<NFSe')).toThrow(expect.objectContaining({ code: 'xml_invalido' }));
    expect(() => danfse('<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"/>')).toThrow(
      expect.objectContaining({ code: 'documento_inesperado' }),
    );
    expect(() => danfse('<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"/>')).toThrow(
      expect.objectContaining({ code: 'campo_ausente' }),
    );
  });

  test('NFS-e sem a DPS: sai com traço, sem quebrar', () => {
    const d = danfse(
      `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${chaveNfse()}"><nNFSe>1</nNFSe></infNFSe></NFSe>`,
    );
    expect(d.paginas).toHaveLength(1);
    expect(tem(d, TEXTOS_DANFSE.tomadorAusente)).toBe(true);
  });
});

// Leitura real do QR com o zbar (ADR 0006, decisão 4): só roda onde zbarimg e pdftoppm existem.
const hasZbar = ((): boolean => {
  try {
    execFileSync('zbarimg', ['--version'], { stdio: 'ignore' });
    execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasZbar)('QR Code lido com o zbarimg', () => {
  for (const [nome, xml, cnpj] of [
    ['20260209', completa, PREST_CNPJ],
    ['20260727 com CNPJ alfanumérico', alfa, PREST_CNPJ_ALFA],
  ] as const) {
    test(`${nome}: endereço do Portal Nacional com a chave, a 150 e a 300 dpi`, () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'sinete-danfse-'));
      try {
        const d = danfse(xml, { cancelamento: true });
        const qr = d.paginas[0]?.ops.find((o) => o.t === 'qr');
        expect(qr).toMatchObject({ x: QR_DANFSE.x, y: QR_DANFSE.y, tamanho: QR_DANFSE.lado });
        writeFileSync(path.join(dir, 'x.pdf'), gerarPdf(d));
        for (const dpi of [150, 300]) {
          // Só o canto do QR Code (de 160 a 207 mm na horizontal, de 10 a 40 mm na vertical), para o zbar ser rápido.
          const px = (mm: number): string => String(Math.round((mm / 25.4) * dpi));
          execFileSync('pdftoppm', [
            '-r',
            String(dpi),
            '-x',
            px(160),
            '-y',
            px(10),
            '-W',
            px(47),
            '-H',
            px(30),
            '-png',
            '-singlefile',
            path.join(dir, 'x.pdf'),
            path.join(dir, 'x'),
          ]);
          const out = execFileSync('zbarimg', ['-q', path.join(dir, 'x.png')]).toString();
          expect(out).toContain(`QR-Code:${QR_DANFSE.url}${chaveNfse(cnpj)}`);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
