import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { comparar, mudou, proximoEstado, relatorio } from '../src/comparar.ts';
import {
  decodificarEntidades,
  ementaDaAliquotaDeReferencia,
  extrairNormasDoSenado,
  extrairPaginaGovBr,
  extrairPortalDfe,
  extrairPortalNfe,
  extrairProcessosDoSenado,
} from '../src/extrair.ts';
import type { Fonte } from '../src/fontes.ts';
import { FONTES } from '../src/fontes.ts';

const fonte: Fonte = {
  id: 'teste',
  titulo: 'Fonte de teste',
  url: 'https://exemplo.gov.br/lista',
  extrator: 'portal-nfe',
  afeta: 'nada',
};

describe('extratores', () => {
  test('portal da NF-e: título do span, + do identificador restaurado, duplicados e entidades', () => {
    const html = `
      <p class="tituloSessao">VERSÕES OFICIAIS</p>
      <p><a target="_blank" href="exibirArquivo.aspx?conteudo=kp0SXLu ZdI="><span class="tituloConteudo">Pacote 010f &#8211; NT 2025.002 v.1.50</span></a></p>
      <p><a href="exibirArquivo.aspx?conteudo=AAAA=">  <span class="tituloConteudo">Nota&nbsp;Técnica   2026.001</span></a></p>
      <p><a href="exibirArquivo.aspx?conteudo=AAAA="><span class="tituloConteudo">repetido</span></a></p>
      <p><a href="principal.aspx">Página Principal</a></p>`;
    expect(extrairPortalNfe(html)).toEqual([
      { id: 'exibirArquivo.aspx?conteudo=AAAA=', titulo: 'Nota Técnica 2026.001' },
      { id: 'exibirArquivo.aspx?conteudo=kp0SXLu+ZdI=', titulo: 'Pacote 010f – NT 2025.002 v.1.50' },
    ]);
  });

  test('portal DF-e: sistema, tipo e nome, inclusive nome com parênteses e entidades', () => {
    const html = `
      <a onclick="download_arquivo_estatico('MDFE', 2, 'PL_MDFe_300b_NT012025_1.04.zip')">x</a>
      <a onclick="download_arquivo_estatico('DFE', 16, 'IT 2025.002 v.1.60 - Classifica&#231;&#227;o (2026_06_22).pdf')">y</a>
      function download_arquivo_estatico(sistema, tipo, nome) {}`;
    expect(extrairPortalDfe(html)).toEqual([
      {
        id: 'DFE/16/IT 2025.002 v.1.60 - Classificação (2026_06_22).pdf',
        titulo: 'IT 2025.002 v.1.60 - Classificação (2026_06_22).pdf',
      },
      { id: 'MDFE/2/PL_MDFe_300b_NT012025_1.04.zip', titulo: 'PL_MDFe_300b_NT012025_1.04.zip' },
    ]);
  });

  test('gov.br: só links abaixo da página, sem a âncora da própria página, sem /view e sem query', () => {
    const pagina = 'https://www.gov.br/nfse/doc/producao-restrita';
    const html = `
      <a href="#main-content">Ir para o Conteúdo</a>
      <a href="${pagina}/esquemas-v1.zip/view">Esquemas v1</a>
      <a href="${pagina}/anexo.xlsx?download=1"><span>Anexo</span> B</a>
      <a href="https://www.gov.br/nfse/doc/documentacao-atual">outra página</a>
      <a href="https://www.gov.br/pt-br">gov.br</a>`;
    expect(extrairPaginaGovBr(html, pagina)).toEqual([
      { id: `${pagina}/anexo.xlsx`, titulo: 'Anexo B' },
      { id: `${pagina}/esquemas-v1.zip`, titulo: 'Esquemas v1' },
    ]);
  });

  test('gov.br: relativo resolve pelo <base href> sem barra final, como no navegador', () => {
    const pagina = 'https://www.gov.br/nfse/doc/documentacao-atual';
    const html = `<base href="${pagina}" />
      <a href="documentacao-atual">GOV.BR</a>
      <a href="documentacao-atual/anexo-a.xlsx">Anexo A</a>`;
    expect(extrairPaginaGovBr(html, pagina)).toEqual([{ id: `${pagina}/anexo-a.xlsx`, titulo: 'Anexo A' }]);
  });

  test('gov.br: o documento da própria página (og:url) fica de fora', () => {
    const pagina = 'https://www.gov.br/nfse/doc/rtc';
    const html = `<meta property="og:url" content="${pagina}/rtc" />
      <a class="plain" href="${pagina}/rtc">GOV.BR</a>
      <a href="${pagina}/nt-009.pdf">NT 009</a>`;
    expect(extrairPaginaGovBr(html, pagina)).toEqual([{ id: `${pagina}/nt-009.pdf`, titulo: 'NT 009' }]);
  });

  test('gov.br: arquivo do mesmo site em outra pasta entra só se citado no corpo da página (#40)', () => {
    const pagina = 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc';
    const via = 'https://www.gov.br/nfse/pt-br/nfs-e-via/documentacao-tecnica';
    const html =
      `<nav><a href="${via}/menu.pdf">Menu</a><a href="https://www.gov.br/nfse/pt-br/municipios">Municípios</a></nav>` +
      '<div id="content-core">' +
      `<a href="${via}/notas-tecnicas/nt-010.pdf">NT 010</a>` +
      `<a href="${via}">Página da NFS-e Via</a>` +
      '<a href="https://outro.gov.br/nt.pdf">Outro site</a>' +
      `<a href="${pagina}/nt-009.pdf">NT 009</a>` +
      '</div><div id="viewlet-below-content">' +
      `<a href="${via}/depois.pdf">Depois do corpo</a></div>`;
    expect(extrairPaginaGovBr(html, pagina)).toEqual([
      { id: `${pagina}/nt-009.pdf`, titulo: 'NT 009' },
      { id: `${via}/notas-tecnicas/nt-010.pdf`, titulo: 'NT 010' },
    ]);
    // Sem o marcador do corpo, vale só o caminho da página.
    expect(extrairPaginaGovBr(html.replace('content-core', 'outro'), pagina)).toEqual([
      { id: `${pagina}/nt-009.pdf`, titulo: 'NT 009' },
    ]);
  });

  test('gov.br: a NT SE/CGNFS-e 010 na página da RTC (trecho real da página, #40)', () => {
    const pagina = 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc';
    const html = readFileSync(path.join(import.meta.dir, 'fixtures/govbr-nfse-rtc.html'), 'utf8');
    const itens = extrairPaginaGovBr(html, pagina);
    expect(itens).toContainEqual({
      id: 'https://www.gov.br/nfse/pt-br/nfs-e-via/documentacao-tecnica/notas-tecnicas/nt-010-se-cgnfse-leiaute-nfse-via-v-1.00.pdf',
      titulo: 'Nota Técnica 010 SE/CGNFS-e nº 010 versão 1.00',
    });
    // Fora do caminho da página, só arquivos citados no corpo: nada de menu, rodapé ou subpágina de outra pasta.
    const fora = itens.filter((i) => !i.id.startsWith(`${pagina}/`)).map((i) => i.id.split('/').at(-1));
    expect(fora).toEqual([
      'anexovi-leiautesrn_rtc_ibscbs-v1-01-03-nt004.xlsx',
      'nfse-esquemas_xsd-rtc-v1-00-20251210.zip',
      'nt-004-se-cgnfse-novo-layout-rtc-v2-00-20251210.pdf',
      'nt-010-se-cgnfse-leiaute-nfse-via-v-1.00.pdf',
    ]);
  });

  test('gov.br: sem <base>, relativo resolve pelo endereço da página', () => {
    const pagina = 'https://www.gov.br/nfse/doc/rtc';
    expect(extrairPaginaGovBr('<a href="rtc/nt-009.pdf">NT 009</a><a href="rtc">rtc</a>', pagina)).toEqual([
      { id: `${pagina}/nt-009.pdf`, titulo: 'NT 009' },
    ]);
  });

  test('ementa da alíquota de referência: com ou sem acento, IBS e CBS pelo nome ou pela sigla', () => {
    expect(
      ementaDaAliquotaDeReferencia(
        'Fixa as alíquotas de referência da Contribuição Social sobre Bens e Serviços (CBS) para 2027.',
      ),
    ).toBe(true);
    expect(ementaDaAliquotaDeReferencia('FIXA A ALIQUOTA DE REFERENCIA DE QUE TRATA O ART. 130 DO ADCT')).toBe(true);
    expect(ementaDaAliquotaDeReferencia('Dispõe sobre o Imposto sobre Bens e Serviços')).toBe(true);
    expect(ementaDaAliquotaDeReferencia('Altera a resolução do IBS')).toBe(true);
    expect(ementaDaAliquotaDeReferencia('Estabelece alíquota máxima para o ITCMD')).toBe(false);
    expect(ementaDaAliquotaDeReferencia('Altera as tabelas de referencia de vencimentos')).toBe(false);
    expect(ementaDaAliquotaDeReferencia('Autoriza operação com o CBSX')).toBe(false);
  });

  test('Senado, legislação: só as resoluções da alíquota de referência; lista vazia é leitura válida', () => {
    const doc = (id: string, normaNome: string, ementa: string) => ({ id, normaNome, ementa, tipo: 'RSF' });
    const json = {
      ListaDocumento: {
        documentos: {
          documento: [
            doc('1', 'Resolução do Senado Federal nº 43 de 04/09/2026', 'Autoriza operação de crédito externo.'),
            doc('2', 'Resolução do Senado Federal nº 60 de 10/12/2026', 'Fixa as alíquotas de referência da CBS.'),
            { id: '3', normaNome: 'sem ementa' },
          ],
        },
      },
    };
    expect(extrairNormasDoSenado(json)).toEqual([
      {
        id: 'https://legis.senado.leg.br/norma/2',
        titulo: 'Resolução do Senado Federal nº 60 de 10/12/2026: Fixa as alíquotas de referência da CBS.',
      },
    ]);
    // Um documento só vem como objeto, não como lista.
    expect(extrairNormasDoSenado({ ListaDocumento: { documentos: { documento: doc('9', 'n', 'x') } } })).toEqual([]);
    // Envelope reconhecido sem nenhuma norma: leitura válida, lista vazia.
    expect(extrairNormasDoSenado({ ListaDocumento: { documentos: { documento: [] } } })).toEqual([]);
    expect(extrairNormasDoSenado({ ListaDocumento: { documentos: {} } })).toEqual([]);
    // Objeto de erro com HTTP 200, envelope mudado ou registro fora do formato: falha de leitura, nunca lista vazia.
    expect(() => extrairNormasDoSenado({ erro: 'fora do ar' })).toThrow(/lista de normas/);
    expect(() => extrairNormasDoSenado({ ListaDocumento: { normas: [doc('9', 'n', 'x')] } })).toThrow(
      /lista de normas/,
    );
    expect(() => extrairNormasDoSenado({ documentos: { documento: [doc('9', 'n', 'x')] } })).toThrow(/lista de normas/);
    expect(() => extrairNormasDoSenado({ ListaDocumento: { documentos: { documento: 'erro' } } })).toThrow(/normas/);
    expect(() =>
      extrairNormasDoSenado({ ListaDocumento: { documentos: { documento: [{ erro: 'fora do ar' }] } } }),
    ).toThrow(/fora do formato/);
  });

  test('Senado, processos: projetos de resolução da alíquota de referência; resposta sem lista falha', () => {
    const json = [
      { codigoMateria: 120542, identificacao: 'PRS 17/2015', ementa: 'Altera o Regimento Interno.' },
      { codigoMateria: 999, identificacao: 'PRS 80/2026', ementa: 'Fixa a alíquota de referência do IBS e da CBS.' },
    ];
    expect(extrairProcessosDoSenado(json)).toEqual([
      {
        id: 'https://www25.senado.leg.br/web/atividade/materias/-/materia/999',
        titulo: 'PRS 80/2026: Fixa a alíquota de referência do IBS e da CBS.',
      },
    ]);
    // Lista vazia é leitura válida.
    expect(extrairProcessosDoSenado([])).toEqual([]);
    // Objeto de erro com HTTP 200, envelope mudado ou registro fora do formato: falha de leitura, nunca lista vazia.
    expect(() => extrairProcessosDoSenado({ erro: 'fora do ar' })).toThrow(/lista de processos/);
    expect(() => extrairProcessosDoSenado({ processos: json })).toThrow(/lista de processos/);
    expect(() => extrairProcessosDoSenado(null)).toThrow(/lista de processos/);
    expect(() => extrairProcessosDoSenado([{ erro: 'fora do ar' }])).toThrow(/fora do formato/);
    expect(() => extrairProcessosDoSenado([...json, { id: 1, ementa: 'sem codigoMateria' }])).toThrow(/registro 2/);
  });

  test('entidades numéricas, hexadecimais e nomeadas; desconhecida fica como está', () => {
    expect(decodificarEntidades('a&amp;b &#231; &#xE3; &foo;')).toBe('a&b ç ã &foo;');
  });
});

describe('comparação', () => {
  const antes = {
    titulo: fonte.titulo,
    url: fonte.url,
    itens: [
      { id: 'a', titulo: 'A' },
      { id: 'b', titulo: 'B' },
    ],
  };

  test('novos, removidos e título mudado', () => {
    const m = comparar(fonte, antes, [
      { id: 'a', titulo: 'A v2' },
      { id: 'c', titulo: 'C' },
    ]);
    expect(m.novos).toEqual([{ id: 'c', titulo: 'C' }]);
    expect(m.removidos).toEqual([{ id: 'b', titulo: 'B' }]);
    expect(m.renomeados).toEqual([{ id: 'a', antes: 'A', depois: 'A v2' }]);
    expect(mudou(m)).toBe(true);
  });

  test('igual não é mudança; fonte sem estado anterior é', () => {
    expect(mudou(comparar(fonte, antes, antes.itens))).toBe(false);
    expect(mudou(comparar(fonte, undefined, antes.itens))).toBe(true);
  });

  test('fonte que falhou mantém a lista anterior no estado novo', () => {
    const outra: Fonte = { ...fonte, id: 'outra' };
    const novo = proximoEstado({ fontes: { teste: antes, outra: { ...antes, itens: [] } } }, [
      { fonte, erro: 'HTTP 503' },
      { fonte: outra, itens: [{ id: 'z', titulo: 'Z' }] },
    ]);
    expect(novo.fontes.teste).toEqual(antes);
    expect(novo.fontes.outra?.itens).toEqual([{ id: 'z', titulo: 'Z' }]);
  });

  test('relatório: nada mudou, mudança com instrução de fechamento e falhas', () => {
    expect(relatorio([comparar(fonte, antes, antes.itens)], [])).toBe('Nenhuma fonte oficial mudou.\n');
    const r = relatorio(
      [comparar(fonte, antes, [...antes.itens, { id: 'n', titulo: 'Nova NT' }])],
      [{ fonte, erro: 'HTTP 503' }],
    );
    expect(r).toContain('### Fonte de teste');
    expect(r).toContain('Nova NT');
    expect(r).toContain('--gravar');
    expect(r).toContain('Fonte de teste: HTTP 503');
  });
});

test('fontes: identificadores únicos e só HTTPS', () => {
  expect(new Set(FONTES.map((f) => f.id)).size).toBe(FONTES.length);
  for (const f of FONTES) expect(f.url.startsWith('https://')).toBe(true);
});
