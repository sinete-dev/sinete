import { describe, expect, test } from 'bun:test';
import { comparar, mudou, proximoEstado, relatorio } from '../src/comparar.ts';
import { decodificarEntidades, extrairPaginaGovBr, extrairPortalDfe, extrairPortalNfe } from '../src/extrair.ts';
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
