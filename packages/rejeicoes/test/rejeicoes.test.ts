import { describe, expect, test } from 'bun:test';
import { criarAutorizado, criarPendente, criarRecusado, ehCStat } from '@sinete/core';
import table from '../src/data/rejeicoes.json' with { type: 'json' };
import type { Rejeicao } from '../src/index.ts';
import {
  CATEGORIAS_REJEICAO,
  completarRecusado,
  completarResultado,
  dicaRejeicao,
  REJEICOES,
  rejeicaoPorCodigo,
  TABELA_REJEICOES,
} from '../src/index.ts';

describe('catálogo', () => {
  test('formato de cada entrada', () => {
    const docs = new Set(TABELA_REJEICOES.fontes.map((s) => s.id));
    let prev = 0;
    for (const r of REJEICOES) {
      expect(ehCStat(r.codigo), r.codigo).toBe(true);
      expect(Number(r.codigo)).toBeGreaterThan(prev);
      prev = Number(r.codigo);
      expect(r.mensagem.length, r.codigo).toBeGreaterThan(5);
      expect(r.mensagem, r.codigo).not.toMatch(/^Rejeição/);
      expect(r.modelos.length).toBeGreaterThan(0);
      for (const m of r.modelos) expect(['55', '65']).toContain(m);
      expect(CATEGORIAS_REJEICAO).toContain(r.categoria);
      expect(r.fonte).toMatch(
        /^(MOC 7\.0 Anexo I|NT 2025\.002 v1\.40|NT 2025\.001 v1\.03|NT 2024\.003 v1\.10|NT 2026\.007 v1\.10), (tabela 4\.4\.[23]|regra \S+)$|^(NT 2025\.001 v1\.03, item 90\.1|NT 2023\.002 v1\.01, item 7)$/,
      );
      for (const rule of r.regras) expect(docs.has(rule.documento), `${r.codigo} ${rule.documento}`).toBe(true);
      // curadoria vem sempre completa e com a regra citada
      const curated = [r.causaProvavel, r.comoCorrigir, r.referencia].filter((x) => x !== undefined).length;
      expect([0, 3], r.codigo).toContain(curated);
    }
  });

  test('cobertura mínima: MOC 7.0 (tabela 4.4.2 e regras), denegações e reforma tributária', () => {
    expect(REJEICOES.length).toBeGreaterThanOrEqual(810);
    expect(REJEICOES.filter((r) => r.efeito === 'denegacao').map((r) => r.codigo)).toEqual(['301', '302', '303']);
    const reforma = REJEICOES.filter((r) => r.categoria === 'reforma');
    expect(reforma.length).toBeGreaterThanOrEqual(200);
    for (const r of reforma) expect(Number(r.codigo)).toBeGreaterThanOrEqual(1000);
    // códigos que só existem no corpo das regras (a tabela 4.4.2 não é exaustiva)
    for (const c of ['108', '109', '491', '492', '493', '764', '776']) expect(rejeicaoPorCodigo(c), c).toBeDefined();
    expect(REJEICOES.filter((r) => r.causaProvavel).length).toBeGreaterThanOrEqual(40);
  });

  test('mensagens oficiais conferidas no documento', () => {
    expect(rejeicaoPorCodigo('204')?.mensagem).toBe('Duplicidade de NF-e [nRec:999999999999999]');
    expect(rejeicaoPorCodigo('233')?.mensagem).toBe('IE do destinatário não cadastrada');
    expect(rejeicaoPorCodigo('1037')?.mensagem).toBe('Alíquota da CBS inválida [nItem: 999]');
    expect(rejeicaoPorCodigo('1179')?.mensagem).toBe(
      'CFOP inválido para Nota Fiscal de devolução ou de retorno de mercadoria emitida por MEI',
    );
    expect(rejeicaoPorCodigo('1154')?.mensagem).toBe('Data de previsão de entrega posterior ao permitido');
    expect(rejeicaoPorCodigo('640')?.mensagens).toHaveLength(2);
    // regressão: a célula de id em duas linhas (B32-10/BB02-10) cortava a mensagem na primeira linha
    expect(rejeicaoPorCodigo('1008')?.mensagem).toBe(
      'Nota de compra governamental e alíquota dos outros entes informada incorretamente',
    );
    expect(rejeicaoPorCodigo('1212')?.mensagem).toBe(
      'DFe referenciado em operação com ente governamental com a mesma Chave de Acesso da Nota Fiscal atual [nOcor:nnn]',
    );
    expect(rejeicaoPorCodigo('1020')?.regras).toEqual([{ documento: 'nt2025002', id: 'UB13-10' }]);
    expect(rejeicaoPorCodigo('209')?.regras.map((r) => r.id)).toContain('C17-20');
    expect(rejeicaoPorCodigo('1003')?.modelos).toEqual(['55']);
  });

  test('nenhuma mensagem com sinal de corte', () => {
    // Mesma checagem do builder: artigo, preposição ou conjunção no fim, ou parêntese/colchete sem fechar.
    // As exceções estão assim no PDF oficial (tabela 4.4.2 do Anexo I).
    const officialOddities = new Set(['396', '397', '400', '562']);
    const dangling = /\s(a|o|as|os|ao|aos|e|ou|de|da|do|das|dos|com|para|por|no|na|nos|nas|em|um|uma|que|se|sem)$/i;
    const count = (m: string, c: string): number => m.split(c).length - 1;
    const bad: string[] = [];
    for (const r of REJEICOES) {
      for (const m of r.mensagens ?? [r.mensagem]) {
        if (dangling.test(m)) bad.push(`${r.codigo}: ${m}`);
        if (officialOddities.has(r.codigo)) continue;
        if (count(m, '(') !== count(m, ')') || count(m, '[') !== count(m, ']')) bad.push(`${r.codigo}: ${m}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('categorias de referência', () => {
    const cat = (c: string): string | undefined => rejeicaoPorCodigo(c)?.categoria;
    expect(cat('215')).toBe('schema');
    expect(cat('297')).toBe('assinatura');
    expect(cat('290')).toBe('certificado');
    expect(cat('213')).toBe('certificado');
    expect(cat('230')).toBe('cadastro');
    expect(cat('302')).toBe('cadastro');
    expect(cat('204')).toBe('duplicidade');
    expect(cat('539')).toBe('duplicidade');
    expect(cat('610')).toBe('regra-negocio');
    expect(cat('1022')).toBe('reforma');
  });

  test('metadados e fontes', () => {
    expect(TABELA_REJEICOES.versaoDoFormato).toBe(1);
    expect(TABELA_REJEICOES.versao).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    for (const s of TABELA_REJEICOES.fontes) {
      expect(s.url).toStartWith('https://www.nfe.fazenda.gov.br/');
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(table.geradoPor).toBe('tools/rejeicoes-data/build.ts');
  });
});

describe('consulta e enriquecimento', () => {
  test('lookup por código de 3 e 4 dígitos', () => {
    expect(rejeicaoPorCodigo(' 539 ')?.codigo).toBe('539');
    expect(rejeicaoPorCodigo('1041')?.categoria).toBe('reforma');
    expect(rejeicaoPorCodigo('100')).toBeUndefined();
    expect(rejeicaoPorCodigo('9999')).toBeUndefined();
  });

  test('dicaRejeicao só com curadoria', () => {
    expect(dicaRejeicao('204')).toEqual({
      causaProvavel: rejeicaoPorCodigo('204')?.causaProvavel ?? '',
      comoCorrigir: rejeicaoPorCodigo('204')?.comoCorrigir ?? '',
      fonte: 'MOC 7.0 Anexo I, RV 2B08-20',
    });
    const semCuradoria = REJEICOES.find((r) => !r.causaProvavel);
    expect(semCuradoria && dicaRejeicao(semCuradoria.codigo)).toBeUndefined();
    expect(dicaRejeicao('100')).toBeUndefined();
  });

  test('completarRecusado preenche a dica sem sobrescrever', () => {
    const r = criarRecusado({ cStat: '297', xMotivo: 'Rejeição: Assinatura difere do calculado' });
    const e = completarRecusado(r);
    expect(e.dica?.fonte).toBe('MOC 7.0 Anexo I, RV F02');
    expect(e.cStat).toBe('297');
    const manual = criarRecusado({ cStat: '297', xMotivo: 'x' }, { causaProvavel: 'a', comoCorrigir: 'b', fonte: 'c' });
    expect(completarRecusado(manual)).toBe(manual);
    const unknown = criarRecusado({ cStat: '9998', xMotivo: 'x' });
    expect(completarRecusado(unknown)).toBe(unknown);
  });

  test('completarResultado só mexe no recusado', () => {
    const a = criarAutorizado({ cStat: '100', xMotivo: 'Autorizado o uso da NF-e' }, { nProt: '1' });
    expect(completarResultado(a)).toBe(a);
    const p = criarPendente({ cStat: '105', xMotivo: 'Lote em processamento' });
    expect(completarResultado(p)).toBe(p);
    const r = completarResultado(criarRecusado({ cStat: '1037', xMotivo: 'Rejeição: Alíquota da CBS inválida' }));
    expect(r.tipo === 'recusado' && r.dica?.fonte).toBe('NT 2025.002 v1.40, RV UB56-10 e UB56-20');
  });
});

describe('dica da 327 (RV I08-140)', () => {
  test('1.949 e 2.949 valem em qualquer devolução, sem condição sobre o destinatário (NT 2026.009)', () => {
    const d = dicaRejeicao('327');
    if (d === undefined) throw new Error('327 sem dica');
    for (const texto of [d.comoCorrigir, d.orientacao ?? '']) {
      expect(texto).toContain('1.949');
      expect(texto).not.toMatch(/só (?:são aceitos|cabem) na devolução de venda para não contribuinte/);
      expect(texto).not.toContain('indIEDest');
    }
    expect(d.fonte).toContain('NT 2026.009');
  });
});

describe('contribuinte exclusivo do IBS/CBS (NT 2026.007 v1.10)', () => {
  const NOVOS = [
    '156',
    '157',
    '158',
    '159',
    '161',
    '162',
    '163',
    '164',
    '165',
    '166',
    '167',
    '168',
    '169',
    '170',
    '171',
    '173',
    '175',
    '176',
    '177',
    '178',
    '179',
    '180',
    '181',
    '182',
    '183',
    '184',
    '185',
    '186',
    '187',
    '188',
  ];

  test('as 30 rejeições novas estão no catálogo, com a regra da NT', () => {
    for (const c of NOVOS) {
      const r = rejeicaoPorCodigo(c);
      expect(r?.fonte).toStartWith('NT 2026.007 v1.10, regra ');
      expect(r?.regras.some((x) => x.documento === 'nt2026007')).toBe(true);
    }
    const daNt = REJEICOES.filter((r) => r.fonte.startsWith('NT 2026.007'));
    expect(daNt.map((r) => r.codigo)).toEqual(NOVOS);
    for (const c of ['160', '172', '174', '942'])
      expect(rejeicaoPorCodigo(c)?.fonte.startsWith('NT 2026.007')).not.toBe(true);
    expect(TABELA_REJEICOES.fontes.map((f) => f.id)).toContain('nt2026007');
  });

  test('mensagem, regra e modelos seguem a NT', () => {
    const casos: [string, string, string, string[]][] = [
      ['156', 'C17-42', 'NFC-e não pode ser emitida por contribuinte exclusivo do IBS/CBS.', ['65']],
      ['157', 'C17-43', 'Obrigatório informar CNPJ do emitente para contribuinte exclusivo do IBS/CBS.', ['55']],
      ['158', 'C18-50', 'Proibido informar IEST para contribuinte exclusivo do IBS/CBS', ['55']],
      ['161', 'N01-10', 'Proibido informar ICMS para contribuinte exclusivo do IBS/CBS [nItem:999]', ['55']],
      ['162', 'UB12-11', 'Grupo IBS/CBS obrigatório para contribuinte exclusivo do IBS/CBS [nItem:999]', ['55']],
      ['166', 'C17-11', 'UF de autorização não permitida para contribuinte exclusivo do IBS/CBS', ['55']],
      ['188', '1P10-40', 'Evento de NF-e de contribuinte exclusivo do IBS/CBS deve ser autorizado na SVRS', ['55']],
      ['178', '12C02-10', 'CNPJ [XX.XXX.XXX/XXXX-DV] do emitente não cadastrado na Receita Federal', ['55', '65']],
      [
        '187',
        '1P10-30',
        'CNPJ [XX.XXX.XXX/XXXX-DV] do Autor de Evento não cadastrado na Receita Federal',
        ['55', '65'],
      ],
    ];
    for (const [c, regra, mensagem, modelos] of casos) {
      const r = rejeicaoPorCodigo(c);
      expect(r?.mensagem).toBe(mensagem);
      expect(r?.regras).toContainEqual({ documento: 'nt2026007', id: regra });
      expect(r?.modelos).toEqual(modelos as Rejeicao['modelos']);
    }
  });
});
